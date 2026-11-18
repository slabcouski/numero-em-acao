import express from 'express';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { getPool } from './database.js';
import { hashPassword, verifyPassword } from './password.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

function cookie(req, name) {
    const item = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
    return item ? item.slice(name.length + 1) : '';
}

function setCookie(res, name, value, maxAge) {
    const secure = new URL(process.env.APP_URL).protocol === 'https:' ? '; Secure' : '';
    res.append('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function oauthClient() {
    const { APP_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
    if (!APP_URL || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error('Configuração Google incompleta');
    const url = new URL(APP_URL);
    if (!['https:', 'http:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
        throw new Error('APP_URL inválida');
    }
    return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, `${url.origin}/api/auth/google/callback`);
}

function wrap(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        try {
            if (!req.headers.origin || new URL(req.headers.origin).origin !== new URL(process.env.APP_URL).origin) {
                return res.status(403).json({ error: 'Origem da requisição inválida' });
            }
        } catch {
            return res.status(403).json({ error: 'Origem da requisição inválida' });
        }
    }
    next();
});

async function createSession(res, userId) {
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await getPool().execute('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hash, userId, expires]);
    setCookie(res, 'session', token, 7 * 24 * 60 * 60);
}

const requireSession = wrap(async (req, res, next) => {
    const token = cookie(req, 'session');
    if (!/^[0-9a-f]{64}$/.test(token)) return res.status(401).json({ error: 'Faça login para continuar' });
    const hash = createHash('sha256').update(token).digest('hex');
    const [rows] = await getPool().execute(
        'SELECT u.id, u.username, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3)',
        [hash]
    );
    if (!rows.length) return res.status(401).json({ error: 'Sessão expirada' });
    req.user = rows[0];
    req.sessionHash = hash;
    next();
});

app.post('/api/register', wrap(async (req, res) => {
    const { name, email, password, passwordConfirm } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 3 || typeof email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 191 ||
        typeof password !== 'string' || password.length < 6 || password.length > 256 || password !== passwordConfirm) {
        return res.status(400).json({ error: 'Confira o nome, e-mail e os códigos secretos' });
    }
    const id = randomUUID();
    const username = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await getPool().execute('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [normalizedEmail]);
    if (existing.length) return res.status(409).json({ error: 'E-mail já cadastrado' });
    const hash = await hashPassword(password);
    try {
        await getPool().execute(
            'INSERT INTO users (id, username, email, password_hash, auth_provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))',
            [id, username, normalizedEmail, hash, 'local']
        );
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'E-mail já cadastrado' });
        throw error;
    }
    await createSession(res, id);
    res.status(201).json({ user: { id, username, email: normalizedEmail } });
}));

app.post('/api/login', wrap(async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password || password.length > 256) {
        return res.status(400).json({ error: 'Informe usuário e senha' });
    }
    const [rows] = await getPool().execute(
        'SELECT id, username, email, password_hash FROM users WHERE LOWER(email) = ? OR BINARY username = BINARY ? LIMIT 2',
        [username.trim().toLowerCase(), username.trim()]
    );
    if (rows.length !== 1 || !(await verifyPassword(password, rows[0].password_hash))) {
        return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }
    const user = rows[0];
    if (user.password_hash.startsWith('legacy-scrypt$')) {
        await getPool().execute('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(password), user.id]);
    }
    await createSession(res, user.id);
    res.json({ user: { id: user.id, username: user.username, email: user.email } });
}));

app.get('/api/session', requireSession, (req, res) => res.json({ user: req.user }));
app.post('/api/logout', requireSession, wrap(async (req, res) => {
    await getPool().execute('DELETE FROM sessions WHERE token_hash = ?', [req.sessionHash]);
    setCookie(res, 'session', '', 0);
    res.json({ success: true });
}));

app.get('/api/auth/google', (req, res) => {
    const state = randomBytes(32).toString('hex');
    setCookie(res, 'oauth_state', state, 600);
    res.redirect(oauthClient().generateAuthUrl({ access_type: 'online', scope: ['openid', 'email', 'profile'], state }));
});

app.get('/api/auth/google/callback', wrap(async (req, res) => {
    const state = cookie(req, 'oauth_state');
    setCookie(res, 'oauth_state', '', 0);
    if (typeof req.query.state !== 'string' || !/^[0-9a-f]{64}$/.test(state) ||
        !/^[0-9a-f]{64}$/.test(req.query.state) ||
        !timingSafeEqual(Buffer.from(state), Buffer.from(req.query.state)) || typeof req.query.code !== 'string') {
        return res.status(400).send('Autenticação Google inválida ou expirada.');
    }
    const client = oauthClient();
    const { tokens } = await client.getToken(req.query.code);
    if (!tokens.id_token) throw new Error('Google não retornou identidade');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || !profile.email_verified) {
        return res.status(403).send('A conta Google não possui e-mail verificado.');
    }
    const connection = await getPool().getConnection();
    let id;
    try {
        await connection.beginTransaction();
        const [identities] = await connection.execute('SELECT user_id FROM google_identities WHERE subject = ? FOR UPDATE', [profile.sub]);
        id = identities.length ? identities[0].user_id : randomUUID();
        const [users] = await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [id]);
        if (!users.length) {
            const [existing] = await connection.execute('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1 FOR UPDATE', [profile.email.toLowerCase()]);
            if (existing.length) {
                await connection.rollback();
                return res.status(409).send('Este e-mail já pertence a outra conta. Entre com o método original.');
            }
            try {
                await connection.execute(
                    'INSERT INTO users (id, email, username, avatar_url, auth_provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))',
                    [id, profile.email.toLowerCase(), profile.name || profile.email.split('@')[0], profile.picture || null, 'google']
                );
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    await connection.rollback();
                    return res.status(409).send('Este e-mail já pertence a outra conta. Entre com o método original.');
                }
                throw error;
            }
        }
        if (!identities.length) await connection.execute('INSERT INTO google_identities (subject, user_id) VALUES (?, ?)', [profile.sub, id]);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
    await createSession(res, id);
    res.redirect('/pages/dashboard/index.html');
}));

app.get('/api/get-game-progress', requireSession, wrap(async (req, res) => {
    const [rows] = await getPool().execute('SELECT level, chapter, exercise, score, consecutive_correct FROM game_progress WHERE user_id = ?', [req.user.id]);
    const progress = rows[0] || { level: 1, chapter: 1, exercise: 1, score: 0, consecutive_correct: 0 };
    res.json({ ...progress, consecutiveCorrect: progress.consecutive_correct });
}));

app.post('/api/save-game-progress', requireSession, wrap(async (req, res) => {
    const { level, chapter, exercise, score, consecutiveCorrect } = req.body || {};
    if (![level, chapter, exercise, score, consecutiveCorrect].every(Number.isSafeInteger) ||
        level < 1 || level > 4 || chapter < 1 || chapter > 3 || exercise < 1 || exercise > 5 || score < 0 || consecutiveCorrect < 0 ||
        score > 2147483647 || consecutiveCorrect > 2147483647) {
        return res.status(400).json({ error: 'Progresso inválido' });
    }
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute(
            'INSERT INTO game_progress (id, user_id, level, chapter, exercise, score, consecutive_correct, last_played, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE level=VALUES(level), chapter=VALUES(chapter), exercise=VALUES(exercise), score=VALUES(score), consecutive_correct=VALUES(consecutive_correct), last_played=UTC_TIMESTAMP(3), updated_at=UTC_TIMESTAMP(3)',
            [randomUUID(), req.user.id, level, chapter, exercise, score, consecutiveCorrect]
        );
        await connection.execute('UPDATE users SET nivel_matematica = ?, pontos_totais = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [level, score, req.user.id]);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
    res.json({ success: true });
}));

app.post('/api/log-exercise', requireSession, wrap(async (req, res) => {
    const { level, operation, factor1, factor2, correctAnswer } = req.body || {};
    const symbols = { adicao: '+', subtracao: '−', multiplicacao: '×', divisao: '÷' };
    if (!Object.hasOwn(symbols, operation) || ![level, factor1, factor2, correctAnswer].every(Number.isSafeInteger) || level < 1 || level > 4) {
        return res.status(400).json({ error: 'Exercício inválido' });
    }
    const id = randomUUID();
    await getPool().execute(
        'INSERT INTO exercicios (id, tipo, nivel, pergunta, resposta_correta, pontos, created_at) VALUES (?, ?, ?, ?, ?, 10, UTC_TIMESTAMP(3))',
        [id, operation, level, `${factor1} ${symbols[operation]} ${factor2}`, correctAnswer]
    );
    res.json({ success: true, exercicioId: id });
}));

app.post('/api/log-answer', requireSession, wrap(async (req, res) => {
    const { exercicioId, respostaUsuario, estaCorreto, pontosGanhos, tempoResposta } = req.body || {};
    if (typeof exercicioId !== 'string' || !/^[0-9a-f-]{36}$/i.test(exercicioId) ||
        !Number.isSafeInteger(respostaUsuario) || typeof estaCorreto !== 'boolean' ||
        !Number.isSafeInteger(pontosGanhos) || (tempoResposta !== null && !Number.isSafeInteger(tempoResposta))) {
        return res.status(400).json({ error: 'Resposta inválida' });
    }
    const id = randomUUID();
    await getPool().execute(
        'INSERT INTO respostas_usuarios (id, user_id, exercicio_id, resposta_usuario, esta_correto, pontos_ganhos, tempo_resposta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))',
        [id, req.user.id, exercicioId, respostaUsuario, estaCorreto, pontosGanhos, tempoResposta]
    );
    res.json({ success: true, respostaId: id });
}));

app.use((error, req, res, next) => {
    console.error('Erro na API:', error.code || error.name);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'Erro ao processar a requisição' });
});

export default app;
