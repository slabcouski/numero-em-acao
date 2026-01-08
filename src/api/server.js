import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import loginRouter from './login.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️  SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
    process.exit(1);
}

// Use sempre a service role key para bypass de RLS no backend
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor rodando!' });
});

// Endpoint de registro
app.post('/api/register', async (req, res) => {
    try {
        const { name, password, passwordConfirm, email: emailRaw } = req.body;

        // Validações
        if (!name || !password || !passwordConfirm) {
            return res.status(400).json({
                error: 'Nome e código secreto são obrigatórios'
            });
        }

        if (password !== passwordConfirm) {
            return res.status(400).json({
                error: 'Os códigos secretos não coincidem'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'O código secreto deve ter pelo menos 6 caracteres'
            });
        }

        const username = name.trim();

        if (username.length < 3) {
            return res.status(400).json({
                error: 'O nome deve ter pelo menos 3 caracteres'
            });
        }

        // Gerar email obrigatório (único) se não vier no corpo
        const emailCandidate = (emailRaw || '').trim().toLowerCase();
        const safeSlug = username.replace(/\s+/g, '').toLowerCase() || 'user';
        const unique = crypto.randomUUID().slice(0, 8);
        const email = emailCandidate || `${safeSlug}+${unique}@app.local`;

        // Gerar hash base64 da senha
        const passwordHash = Buffer.from(password).toString('base64');

        // Inserir usuário na tabela (com password_hash e provider local)
        const { data, error } = await supabase
            .from('users')
            .insert([
                {
                    username,
                    email,
                    password_hash: passwordHash,
                    auth_provider: 'local'
                }
            ])
            .select();

        if (error) {
            console.error('Erro ao inserir usuário:', error);
            return res.status(400).json({
                error: error.message,
                details: error
            });
        }

        res.status(201).json({
            success: true,
            message: 'Usuário registrado com sucesso!',
            user: {
                id: data[0].id,
                username: data[0].username,
                email: data[0].email
            },
            // Enviar de volta hash da senha em base64 para armazenar no client
            passwordHash: passwordHash
        });

    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({
            error: 'Erro ao conectar com o servidor',
            message: error.message
        });
    }
});

// Login router
app.use('/api', loginRouter);

// --- ENDPOINTS DE PROGRESSO DO JOGO ---
// Salvar progresso do jogo
app.post('/api/save-game-progress', async (req, res) => {
    try {
        const { userId, level, chapter, exercise, score, consecutiveCorrect, lastPlayed } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        // Salvar no game_progress
        const { data, error } = await supabase
            .from('game_progress')
            .upsert({
                user_id: userId,
                level: level || 1,
                chapter: chapter || 1,
                exercise: exercise || 1,
                score: score || 0,
                consecutive_correct: consecutiveCorrect || 0,
                last_played: lastPlayed || new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (error) {
            console.error('Erro ao salvar progresso:', error);
            return res.status(500).json({ error: 'Erro ao salvar progresso' });
        }

        // Também atualizar nivel_matematica e pontos_totais na tabela users
        const { error: updateError } = await supabase
            .from('users')
            .update({
                nivel_matematica: level || 1,
                pontos_totais: score || 0,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Erro ao atualizar dados do usuário:', updateError);
            // Não retornar erro aqui pois o progresso foi salvo
        }

        res.json({ success: true, message: 'Progresso salvo com sucesso!', data });

    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: 'Erro ao processar requisição', message: error.message });
    }
});

// Carregar progresso do jogo
app.get('/api/get-game-progress', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        const { data, error } = await supabase
            .from('game_progress')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Erro ao buscar progresso:', error);
            return res.status(500).json({ error: 'Erro ao buscar progresso' });
        }

        if (!data) {
            // Retornar progresso padrão se não existir
            return res.json({
                level: 1,
                chapter: 1,
                exercise: 1,
                score: 0,
                consecutive_correct: 0
            });
        }

        res.json(data);

    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: 'Erro ao processar requisição', message: error.message });
    }
});

// --- LOG DE EXERCÍCIOS E RESPOSTAS ---
// Registrar exercício gerado (para manter integridade com respostas_usuarios)
app.post('/api/log-exercise', async (req, res) => {
    try {
        const { level, operation, factor1, factor2, correctAnswer } = req.body;

        if (!level || !operation || factor1 == null || factor2 == null || correctAnswer == null) {
            return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
        }

        // Mapear operação para valores aceitos: adicao, subtracao, multiplicacao, divisao
        const op = String(operation).toLowerCase();
        const allowed = ['adicao', 'subtracao', 'multiplicacao', 'divisao'];
        if (!allowed.includes(op)) {
            return res.status(400).json({ error: 'Operação inválida' });
        }

        // Montar pergunta legível
        const symbolMap = {
            adicao: '+',
            subtracao: '−',
            multiplicacao: '×',
            divisao: '÷'
        };
        const pergunta = `${factor1} ${symbolMap[op]} ${factor2}`;

        const { data, error } = await supabase
            .from('exercicios')
            .insert([
                {
                    tipo: op,
                    nivel: level,
                    pergunta,
                    resposta_correta: correctAnswer
                }
            ])
            .select('id')
            .single();

        if (error) {
            console.error('Erro ao registrar exercício:', error);
            return res.status(500).json({ error: 'Erro ao registrar exercício' });
        }

        res.json({ success: true, exercicioId: data.id });
    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: 'Erro ao processar requisição', message: error.message });
    }
});

// Registrar resposta do usuário
app.post('/api/log-answer', async (req, res) => {
    try {
        const { userId, exercicioId, respostaUsuario, estaCorreto, pontosGanhos, tempoResposta } = req.body;

        if (!userId || !exercicioId) {
            return res.status(400).json({ error: 'userId e exercicioId são obrigatórios' });
        }

        const { data, error } = await supabase
            .from('respostas_usuarios')
            .insert([
                {
                    user_id: userId,
                    exercicio_id: exercicioId,
                    resposta_usuario: respostaUsuario,
                    esta_correto: !!estaCorreto,
                    pontos_ganhos: pontosGanhos ?? 0,
                    tempo_resposta: tempoResposta ?? null
                }
            ])
            .select('id')
            .single();

        if (error) {
            console.error('Erro ao registrar resposta:', error);
            return res.status(500).json({ error: 'Erro ao registrar resposta' });
        }

        res.json({ success: true, respostaId: data.id });
    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: 'Erro ao processar requisição', message: error.message });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📝 Health check: http://localhost:${PORT}/health`);
    console.log(`💾 Supabase URL: ${supabaseUrl}`);
});

export default app;
