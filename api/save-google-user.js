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
}
