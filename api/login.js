import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
}
