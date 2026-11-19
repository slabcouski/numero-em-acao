import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { getPool } from '../src/api/database.js';
import { hashPassword, verifyPassword } from '../src/api/password.js';
import app from '../src/api/app.js';
import { OAuth2Client } from 'google-auth-library';

function legacyHash(password) {
    const salt = '0123456789abcdef0123456789abcdef';
    const hash = scryptSync(Buffer.from(password, 'latin1'), salt, 64);
    return `legacy-scrypt$${salt}$${hash.toString('hex')}`;
}

test('preserva senhas antigas e armazena novas senhas com scrypt', async () => {
    const legacy = legacyHash('café');
    assert.equal(await verifyPassword('café', legacy), true);
    assert.equal(await verifyPassword('outra', legacy), false);
    assert.equal(await verifyPassword('cafe\u0301', legacy), false);
    const current = await hashPassword('senha de teste');
    assert.equal(await verifyPassword('senha de teste', current), true);
    assert.equal(await verifyPassword('outra', current), false);
});

test('login cria sessão e progresso usa a identidade autenticada', async t => {
    process.env.MYSQL_HOST = 'localhost';
    process.env.MYSQL_DATABASE = 'test';
    process.env.MYSQL_USER = 'test';
    process.env.MYSQL_PASSWORD = 'test';
    process.env.MYSQL_ALLOW_INSECURE = 'true';
    delete process.env.MYSQL_CA_PATH;
    delete process.env.MYSQL_CA_PEM;
    const pool = getPool();
    const hash = legacyHash('senha123');
    const user = { id: '550e8400-e29b-41d4-a716-446655440000', username: 'Teste', email: 'teste@example.test', password_hash: hash };
    let updated = false;
    let progressUser;
    t.mock.method(pool, 'execute', async (sql, params) => {
        if (sql.startsWith('SELECT id, username')) return [[user]];
        if (sql.startsWith('UPDATE users SET password_hash')) {
            updated = true;
            assert.equal(await verifyPassword('senha123', params[0]), true);
            return [{ affectedRows: 1 }];
        }
        if (sql.startsWith('INSERT INTO sessions')) return [{ affectedRows: 1 }];
        if (sql.startsWith('SELECT u.id')) return [[user]];
        if (sql.startsWith('SELECT level')) {
            progressUser = params[0];
            return [[{ level: 2, chapter: 1, exercise: 1, score: 10, consecutive_correct: 2 }]];
        }
        throw new Error('Consulta inesperada');
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    process.env.APP_URL = origin;
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await pool.end();
    });

    const blocked = await fetch(`${origin}/api/login`, {
        method: 'POST', headers: { origin: 'https://other.example', 'content-type': 'application/json' },
        body: JSON.stringify({ username: user.email, password: 'senha123' })
    });
    assert.equal(blocked.status, 403);
    const noSession = await fetch(`${origin}/api/get-game-progress`);
    assert.equal(noSession.status, 401);
    const login = await fetch(`${origin}/api/login`, {
        method: 'POST', headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ username: user.email, password: 'senha123' })
    });
    assert.equal(login.status, 200);
    assert.equal(updated, true);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const progress = await fetch(`${origin}/api/get-game-progress?userId=outra-pessoa`, { headers: { cookie } });
    assert.equal(progress.status, 200);
    assert.equal(progressUser, user.id);
    assert.equal((await progress.json()).consecutiveCorrect, 2);

    process.env.GOOGLE_CLIENT_ID = 'test-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    const orphanId = '550e8400-e29b-41d4-a716-446655440001';
    let restoredId;
    t.mock.method(OAuth2Client.prototype, 'getToken', async () => ({ tokens: { id_token: 'test-token' } }));
    t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({
        getPayload: () => ({ sub: 'google-subject', email: 'google@example.test', email_verified: true, name: 'Google' })
    }));
    t.mock.method(pool, 'getConnection', async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        execute: async (sql, params) => {
            if (sql.startsWith('SELECT user_id FROM google_identities')) return [[{ user_id: orphanId }]];
            if (sql.startsWith('SELECT id FROM users')) return [[]];
            if (sql.startsWith('INSERT INTO users')) {
                restoredId = params[0];
                return [{ affectedRows: 1 }];
            }
            throw new Error('Consulta OAuth inesperada');
        }
    }));
    const start = await fetch(`${origin}/api/auth/google`, { redirect: 'manual' });
    assert.equal(start.status, 302);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const oauthCookie = start.headers.get('set-cookie').split(';')[0];
    const invalid = await fetch(`${origin}/api/auth/google/callback?state=${'0'.repeat(64)}&code=test`, {
        headers: { cookie: oauthCookie }, redirect: 'manual'
    });
    assert.equal(invalid.status, 400);
    const callback = await fetch(`${origin}/api/auth/google/callback?state=${state}&code=test`, {
        headers: { cookie: oauthCookie }, redirect: 'manual'
    });
    assert.equal(callback.status, 302);
    assert.equal(restoredId, orphanId);
});
