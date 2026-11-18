import fs from 'node:fs/promises';
import { getPool } from '../src/api/database.js';
import { hashLegacyPassword } from '../src/api/password.js';
import { loadLocalEnvironment } from '../src/api/config.js';

loadLocalEnvironment();

const origin = new URL(process.env.SUPABASE_URL);
if (origin.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(origin.hostname) ||
    origin.port || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('URL do Supabase inesperada');
}
if (!process.env.SUPABASE_SECRET_KEY?.startsWith('sb_secret_')) {
    throw new Error('SUPABASE_SECRET_KEY não configurada');
}

async function get(path) {
    const response = await fetch(new URL(path, origin), {
        headers: { apikey: process.env.SUPABASE_SECRET_KEY },
        redirect: 'error',
        signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`Supabase retornou HTTP ${response.status}`);
    return response.json();
}

async function readTable(name) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
        const page = await get(`/rest/v1/${name}?select=*&order=id.asc&limit=500&offset=${offset}`);
        if (!Array.isArray(page)) throw new Error(`Resposta inválida da tabela ${name}`);
        rows.push(...page);
        if (page.length < 500) return rows;
    }
}

async function readIdentities() {
    const identities = [];
    for (let page = 1; ; page++) {
        const result = await get(`/auth/v1/admin/users?page=${page}&per_page=500`);
        if (!Array.isArray(result.users)) throw new Error('Resposta inválida de usuários Auth');
        for (const user of result.users) {
            const detail = await get(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`);
            if (!Array.isArray(detail.identities)) throw new Error('Identidades não disponíveis');
            for (const identity of detail.identities) {
                if (identity.provider === 'google') {
                    if (typeof identity.identity_data?.sub !== 'string' || !identity.identity_data.sub || !detail.id) {
                        throw new Error('Identidade Google incompleta');
                    }
                    identities.push({ subject: identity.identity_data.sub, user_id: detail.id });
                }
            }
        }
        if (result.users.length < 500) return identities;
    }
}

function date(value) {
    if (value == null) return null;
    if (typeof value !== 'string') throw new Error('Data inválida no Supabase');
    if (!/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?$/.test(value) ||
        Number.isNaN(new Date(`${value.replace(' ', 'T')}Z`).getTime())) {
        throw new Error('Data inválida no Supabase');
    }
    return value.replace('T', ' ');
}

async function insertRows(connection, table, columns, rows) {
    const fields = columns.map(column => `\`${column}\``).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${table}\` (${fields}) VALUES (${placeholders})`;
    for (const row of rows) {
        const values = columns.map(column => {
            const value = row[column];
            return ['created_at', 'updated_at', 'last_played'].includes(column) ? date(value) : value ?? null;
        });
        await connection.execute(sql, values);
    }
}

async function main() {
    const names = ['users', 'exercicios', 'game_progress', 'respostas_usuarios'];
    const [users, exercises, progress, answers, identities] = await Promise.all([
        ...names.map(readTable), readIdentities()
    ]);

    for (const user of users) {
        if (user.password_hash) user.password_hash = await hashLegacyPassword(user.password_hash);
    }
    if (new Set(identities.map(identity => identity.subject)).size !== identities.length) {
        throw new Error('Identificadores Google duplicados');
    }
    const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    for (const [table, rows] of [['users', users], ['exercicios', exercises], ['game_progress', progress], ['respostas_usuarios', answers]]) {
        if (rows.some(row => !uuid(row.id)) || new Set(rows.map(row => row.id)).size !== rows.length) {
            throw new Error(`IDs inválidos ou duplicados em ${table}`);
        }
    }
    if (users.some(user => typeof user.email !== 'string' || [...user.email].length > 191) ||
        new Set(users.map(user => user.email.trimEnd())).size !== users.length) {
        throw new Error('E-mails incompatíveis com o destino');
    }
    if (identities.some(identity => !uuid(identity.user_id) || !/^[\x21-\x7e]{1,255}$/.test(identity.subject))) {
        throw new Error('Identidade Google incompatível com o destino');
    }
    const userIds = new Set(users.map(user => user.id));
    const exerciseIds = new Set(exercises.map(exercise => exercise.id));
    if (progress.some(row => !userIds.has(row.user_id)) ||
        new Set(progress.map(row => row.user_id)).size !== progress.length ||
        answers.some(row => (row.user_id != null && !userIds.has(row.user_id)) ||
            (row.exercicio_id != null && !exerciseIds.has(row.exercicio_id)))) {
        throw new Error('Referências inválidas nos dados de origem');
    }
    for (const row of [...users, ...exercises, ...progress, ...answers]) {
        for (const field of ['created_at', 'updated_at', 'last_played']) {
            if (row[field] != null) date(row[field]);
        }
    }

    console.log(`Origem: ${users.length} usuários, ${exercises.length} exercícios, ${progress.length} progressos, ${answers.length} respostas e ${identities.length} identidades Google.`);
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
        const [tables] = await connection.query('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()');
        if (Number(tables[0].total) !== 0) throw new Error('O banco MySQL de destino não está vazio');
        if (!process.argv.includes('--execute')) {
            console.log('Verificação concluída. Nenhuma tabela ou dado foi criado.');
            return;
        }

        const schema = await fs.readFile(new URL('../src/api/schema.sql', import.meta.url), 'utf8');
        for (const statement of schema.split(';').map(part => part.trim()).filter(Boolean)) {
            await connection.query(statement);
        }
        await connection.beginTransaction();
        try {
            await insertRows(connection, 'users', ['id', 'email', 'username', 'avatar_url', 'nivel_matematica', 'pontos_totais', 'created_at', 'updated_at', 'password_hash', 'auth_provider'], users);
            await insertRows(connection, 'exercicios', ['id', 'tipo', 'nivel', 'pergunta', 'resposta_correta', 'pontos', 'created_at'], exercises);
            await insertRows(connection, 'game_progress', ['id', 'user_id', 'level', 'chapter', 'exercise', 'score', 'consecutive_correct', 'last_played', 'created_at', 'updated_at'], progress);
            await insertRows(connection, 'respostas_usuarios', ['id', 'user_id', 'exercicio_id', 'resposta_usuario', 'esta_correto', 'pontos_ganhos', 'tempo_resposta', 'created_at'], answers);
            await insertRows(connection, 'google_identities', ['subject', 'user_id'], identities);
            for (const [table, expected] of [['users', users.length], ['exercicios', exercises.length], ['game_progress', progress.length], ['respostas_usuarios', answers.length], ['google_identities', identities.length]]) {
                const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
                if (Number(rows[0].total) !== expected) throw new Error(`Contagem inconsistente em ${table}`);
            }
            await connection.commit();
            console.log('Dados copiados e contagens verificadas.');
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } finally {
        connection.release();
        await pool.end();
    }
}

main().catch(error => {
    console.error('Migração interrompida:', error.code || error.message);
    process.exitCode = 1;
});
