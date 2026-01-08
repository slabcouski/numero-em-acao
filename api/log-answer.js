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
}
