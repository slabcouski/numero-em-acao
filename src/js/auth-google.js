// Autenticação com Google e Supabase
import { supabase } from '../config/supabase-config.js';

export async function loginWithGoogle() {
    try {
        // Detecta se está em localhost ou produção
        const redirectUrl = window.location.hostname === 'localhost' 
            ? window.location.origin + '/projetos/Calcular/index.html'
            : window.location.origin + '/index.html';
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
            },
        });

        if (error) {
            console.error('Erro ao autenticar com Google:', error.message);
            alert('Erro na autenticação: ' + error.message);
            return;
        }

        console.log('Autenticação iniciada:', data);
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao autenticar: ' + error.message);
    }
}

export async function saveUserToDatabase() {
    try {
        // Obter usuário autenticado
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.log('Usuário não autenticado ainda');
            return;
        }

        const username = user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário';

        // Salvar dados na tabela 'users' usando service role key
        const response = await fetch('/api/save-google-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: user.id,
                email: user.email,
                username: username,
                avatar_url: user.user_metadata?.avatar_url,
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Erro ao salvar dados:', result.error);
            return;
        }

        // Armazenar dados do usuário no localStorage
        localStorage.setItem('userId', user.id);
        localStorage.setItem('username', username);
        localStorage.setItem('email', user.email);
        localStorage.setItem('googleUser', 'true');

        console.log('Dados salvos com sucesso');
        console.log('Bem-vindo, ' + username + '!');

        // Redirecionar para dashboard
        window.location.href = './pages/dashboard/index.html';
    } catch (error) {
        console.error('Erro ao salvar usuário:', error);
    }
}

export async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username) {
        alert('Por favor, insira seu nome!');
        return;
    }

    await loginWithGoogle();
}

// Verificar se o usuário já está autenticado ao carregar a página
export async function checkAuthStatus() {
    try {
        // Aguardar um pouco para a sessão ser estabelecida pelo Supabase
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            console.log('Usuário autenticado:', session.user.email);
            
            // Se houver sessão do Google, salvar dados
            if (session.user.identities && session.user.identities.some(i => i.provider === 'google')) {
                console.log('Sessão Google detectada, salvando usuário...');
                // Chamar saveUserToDatabase mesmo que já exista no localStorage
                await saveUserToDatabase();
            } else if (localStorage.getItem('userId')) {
                // Já está logado, redirecionar para dashboard
                window.location.href = './pages/dashboard/index.html';
            }
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
    }
}

// Fazer logout
export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Erro ao fazer logout:', error);
    } else {
        console.log('Logout realizado com sucesso');
        window.location.href = './index.html';
    }
}
