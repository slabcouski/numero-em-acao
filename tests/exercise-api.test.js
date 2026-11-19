import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getPool } from '../src/api/database.js';
import { exercisesForLevel } from '../src/js/exercises.js';
import app from '../src/api/app.js';

test('registra missões por aluno e nível, inclusive entre acessos e ciclos', async t => {
    process.env.MYSQL_HOST = 'localhost';
    process.env.MYSQL_DATABASE = 'test';
    process.env.MYSQL_USER = 'test';
    process.env.MYSQL_PASSWORD = 'test';
    process.env.MYSQL_ALLOW_INSECURE = 'true';
    delete process.env.MYSQL_CA_PATH;
    delete process.env.MYSQL_CA_PEM;

    const pool = getPool();
    const tokens = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
    const users = ['aluno-1', 'aluno-2', 'aluno-1'];
    const hashes = tokens.map(token => createHash('sha256').update(token).digest('hex'));
    const history = [];
    const exercises = [];
    const locks = new Map();
    let failInsert = false;
    let rollbacks = 0;

    t.mock.method(pool, 'execute', async (sql, params) => {
        if (sql.startsWith('SELECT u.id')) {
            const index = hashes.indexOf(params[0]);
            return [index < 0 ? [] : [{ id: users[index] }]];
        }
        throw new Error(`Consulta inesperada: ${sql}`);
    });
    t.mock.method(pool, 'getConnection', async () => {
        let releaseLock;
        const pending = {};
        return {
            beginTransaction: async () => {},
            execute: async (sql, params) => {
                if (sql.startsWith('SELECT id FROM users')) {
                    const prior = locks.get(params[0]) || Promise.resolve();
                    const current = new Promise(resolve => { releaseLock = resolve; });
                    locks.set(params[0], prior.then(() => current));
                    await prior;
                    return [[{ id: params[0] }]];
                }
                if (sql.startsWith('SELECT MAX(cycle)')) {
                    const rows = history.filter(row => row.user_id === params[0] && row.nivel === params[1]);
                    return [[{ cycle: rows.length ? Math.max(...rows.map(row => row.cycle)) : null }]];
                }
                if (sql.startsWith('SELECT factor1, factor2')) {
                    return [history.filter(row => row.user_id === params[0] && row.nivel === params[1] && row.cycle === params[2]).reverse()];
                }
                if (sql.startsWith('INSERT INTO exercicios')) {
                    pending.exercise = params;
                    return [{ affectedRows: 1 }];
                }
                if (sql.startsWith('INSERT INTO exercise_history')) {
                    if (failInsert) throw new Error('Falha simulada');
                    const [exercicio_id, user_id, nivel, cycle, factor1, factor2] = params;
                    pending.history = { exercicio_id, user_id, nivel, cycle, factor1, factor2 };
                    return [{ affectedRows: 1 }];
                }
                throw new Error(`Consulta inesperada: ${sql}`);
            },
            commit: async () => {
                exercises.push(pending.exercise);
                history.push(pending.history);
            },
            rollback: async () => { rollbacks++; },
            release: () => { if (releaseLock) releaseLock(); }
        };
    });

    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    process.env.APP_URL = origin;
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await pool.end();
    });

    const request = (level, token = tokens[0]) => fetch(`${origin}/api/new-exercise`, {
        method: 'POST',
        headers: { origin, cookie: `session=${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ level })
    });
    assert.equal((await request(5)).status, 400);
    assert.equal((await request(1, 'invalid')).status, 401);

    const count = exercisesForLevel(4).length;
    const responses = await Promise.all(Array.from({ length: count }, (_, index) => request(4, tokens[index % 2 ? 2 : 0])));
    assert.ok(responses.every(response => response.status === 200));
    const firstCycle = await Promise.all(responses.map(response => response.json()));
    assert.equal(new Set(firstCycle.map(item => `${item.factor1}:${item.factor2}`)).size, count);
    assert.ok(history.every(row => row.user_id === users[0] && row.cycle === 1));

    const last = history[history.length - 1];
    const restarted = await (await request(4)).json();
    assert.notEqual(`${restarted.factor1}:${restarted.factor2}`, `${last.factor1}:${last.factor2}`);
    assert.equal(history[history.length - 1].cycle, 2);

    assert.equal((await request(4, tokens[1])).status, 200);
    assert.equal(history[history.length - 1].cycle, 1);
    assert.equal(history[history.length - 1].user_id, users[1]);
    for (const level of [1, 2, 3]) {
        const responses = await Promise.all(Array.from({ length: 15 }, () => request(level)));
        const items = await Promise.all(responses.map(response => response.json()));
        assert.ok(responses.every(response => response.status === 200));
        assert.equal(new Set(items.map(item => `${item.factor1}:${item.factor2}`)).size, 15);
        assert.equal(history[history.length - 1].cycle, 1);
        assert.equal(history[history.length - 1].nivel, level);
    }

    const beforeFailure = history.length;
    failInsert = true;
    assert.equal((await request(1)).status, 500);
    assert.equal(rollbacks, 1);
    assert.equal(history.length, beforeFailure);
    assert.equal(exercises.length, beforeFailure);
});
