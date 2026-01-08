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
}
