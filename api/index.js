import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import loginRouter from '../src/api/login.js';

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

// Login routes
app.use('/api', loginRouter);

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

// Rotas estáticas (servir arquivos HTML)
app.get('/', (req, res) => {
    res.sendFile(new URL('../index.html', import.meta.url).pathname);
});

app.get('/pages/cadastro/', (req, res) => {
    res.sendFile(new URL('../pages/cadastro/index.html', import.meta.url).pathname);
});

app.get('/pages/dashboard/', (req, res) => {
    res.sendFile(new URL('../pages/dashboard/index.html', import.meta.url).pathname);
});

// Middleware para servir arquivos estáticos
app.use(express.static(new URL('../', import.meta.url).pathname));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Iniciar servidor apenas se não estiver no Vercel
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    });
}

export default app;
