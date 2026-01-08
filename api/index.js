import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️  SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
}

// Use sempre a service role key para bypass de RLS no backend
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// ========== ROTAS DE LOGIN ==========

// Rota de login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .or(`email.eq.${username},username.eq.${username}`)
            .single();

        if (error || !data) {
            return res.status(401).json({ error: 'Usuário ou senha incorretos' });
        }

        // Validar senha
        if (!data.password_hash) {
            return res.status(401).json({ error: 'Esta conta está vinculada ao Google. Entre usando "Entrar com Google".' });
        }

        if (data.password_hash !== password) {
            return res.status(401).json({ error: 'Usuário ou senha incorretos' });
        }

        res.json({
            user: {
                id: data.id,
                email: data.email,
                username: data.username,
                avatar_url: data.avatar_url
            }
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Rota de registro
app.post('/api/register', async (req, res) => {
    const { name, email, passwordHash } = req.body;

    if (!name || !email || !passwordHash) {
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    if (name.length < 3) {
        return res.status(400).json({ error: 'Nome deve ter no mínimo 3 caracteres' });
    }

    try {
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        const { data, error } = await supabase
            .from('users')
            .insert({
                username: name,
                email: email,
                password_hash: passwordHash,
                auth_provider: 'local'
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar usuário:', error);
            return res.status(400).json({ error: error.message });
        }

        res.json({
            user: {
                id: data.id,
                email: data.email,
                username: data.username
            }
        });
    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota de salvar usuário Google
app.post('/api/save-google-user', async (req, res) => {
    const { id, email, username, avatar_url } = req.body;

    if (!id || !email) {
        return res.status(400).json({ error: 'ID e email são obrigatórios' });
    }

    try {
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', id)
            .single();

        if (existingUser) {
            const { data, error } = await supabase
                .from('users')
                .update({
                    email,
                    username: username || existingUser.username,
                    avatar_url,
                    auth_provider: 'google',
                    password_hash: null
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                return res.status(400).json({ error: error.message });
            }

            return res.json({ user: data });
        }

        const { data, error } = await supabase
            .from('users')
            .insert({
                id,
                email,
                username: username || email.split('@')[0],
                avatar_url,
                auth_provider: 'google',
                password_hash: null
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar usuário Google:', error);
            return res.status(400).json({ error: error.message });
        }

        res.json({ user: data });
    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS DE JOGO ==========

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor rodando!' });
});

// Rota de salvamento de progresso
app.post('/api/save-game-progress', async (req, res) => {
    const { userId, level, chapter, exercise, score, consecutiveCorrect, lastPlayed } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório' });
    }

    try {
        const { data, error } = await supabase
            .from('game_progress')
            .upsert(
                {
                    user_id: userId,
                    level,
                    chapter,
                    exercise,
                    score,
                    consecutive_correct: consecutiveCorrect,
                    last_played: lastPlayed,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'user_id' }
            )
            .select();

        if (error) {
            console.error('Erro ao salvar progresso:', error);
            return res.status(500).json({ error: error.message });
        }

        // Atualizar nível e pontos na tabela users
        const { error: updateError } = await supabase
            .from('users')
            .update({
                nivel_matematica: level,
                pontos_totais: score
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Erro ao atualizar usuário:', updateError);
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota de obtenção de progresso
app.get('/api/get-game-progress/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório' });
    }

    try {
        const { data, error } = await supabase
            .from('game_progress')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json(data || {});
    } catch (error) {
        console.error('Erro ao obter progresso:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para logar exercício
app.post('/api/log-exercise', async (req, res) => {
    const { userId, tipo, nivel, pergunta, respostaCorreta, pontos } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório' });
    }

    try {
        const { data, error } = await supabase
            .from('exercicios')
            .insert({
                user_id: userId,
                tipo,
                nivel,
                pergunta,
                resposta_correta: respostaCorreta,
                pontos,
                criado_em: new Date().toISOString()
            })
            .select();

        if (error) {
            console.error('Erro ao logar exercício:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, exercicioId: data[0].id });
    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para logar resposta do usuário
app.post('/api/log-answer', async (req, res) => {
    const { userId, exercicioId, respostaUsuario, estaCorreto, pontosGanhos, tempoResposta } = req.body;

    if (!userId || !exercicioId) {
        return res.status(400).json({ error: 'userId e exercicioId são obrigatórios' });
    }

    try {
        const { data, error } = await supabase
            .from('respostas_usuarios')
            .insert({
                user_id: userId,
                exercicio_id: exercicioId,
                resposta_usuario: respostaUsuario,
                esta_correto: estaCorreto,
                pontos_ganhos: pontosGanhos,
                tempo_resposta: tempoResposta,
                respondido_em: new Date().toISOString()
            })
            .select();

        if (error) {
            console.error('Erro ao logar resposta:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, respostaId: data[0].id });
    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rotas estáticas (servir arquivos HTML) - Vercel serve automaticamente
// As requisições para / irão para index.html
// As requisições para /pages/cadastro/ irão para pages/cadastro/index.html
// As requisições para /pages/dashboard/ irão para pages/dashboard/index.html

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

export default app;
