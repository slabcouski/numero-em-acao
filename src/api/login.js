import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials are required');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Nome de usuário/e-mail e senha são obrigatórios' });
        }

        // Buscar usuário por username ou email
        const { data: users, error: searchError } = await supabase
            .from('users')
            .select('*')
            .or(`username.eq.${username},email.eq.${username}`)
            .limit(1);

        if (searchError) {
            console.error('Erro ao buscar usuário:', searchError);
            return res.status(500).json({ error: 'Erro ao buscar usuário' });
        }

        if (!users || users.length === 0) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        const user = users[0];

        // Verificar senha (comparar hash base64)
        // Nota: O password vem já em base64 do frontend
        // Se a conta é Google-only (sem password_hash), orientar o login correto
        if (!user.password_hash) {
            return res.status(400).json({ error: 'Esta conta está vinculada ao Google. Entre usando "Entrar com Google".' });
        }

        const storedPassword = user.password_hash;

        if (password !== storedPassword) {
            return res.status(401).json({ error: 'Senha incorreta' });
        }

        // Login bem-sucedido
        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                nivel_matematica: user.nivel_matematica,
                pontos_totais: user.pontos_totais
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/save-google-user', async (req, res) => {
    try {
        const { id, email, username, avatar_url } = req.body;

        if (!id || !email) {
            return res.status(400).json({ error: 'ID e e-mail são obrigatórios' });
        }

        // Salvar ou atualizar usuário do Google
        const { data, error } = await supabase
            .from('users')
            .upsert({
                id: id,
                email: email,
                username: username,
                avatar_url: avatar_url,
                auth_provider: 'google',
                password_hash: null,
                nivel_matematica: 1,
                pontos_totais: 0,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'id'
            });

        if (error) {
            console.error('Erro ao salvar usuário Google:', error);
            return res.status(500).json({ error: 'Erro ao salvar usuário' });
        }

        return res.status(201).json({
            success: true,
            user: {
                id: id,
                email: email,
                username: username,
                avatar_url: avatar_url
            }
        });

    } catch (error) {
        console.error('Erro ao processar usuário Google:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

export default router;
