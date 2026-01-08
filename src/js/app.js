// Gerenciamento de eventos da aplicação
import { loginWithGoogle, checkAuthStatus } from './auth-google.js';

const selectors = {
    form: 'main form',
    startButton: 'main form button',
    headerLogin: 'header button',
    nameInput: 'main form input[type="text"]',
    emailInput: 'main form input[type="email"]',
    passwordInputs: 'main form input[type="password"]',
};

const ensureToastContainer = () => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-3';
        document.body.appendChild(container);
    }
    return container;
};

const showToast = (type, message) => {
    const container = ensureToastContainer();
    const toast = document.createElement('div');

    const base = 'bg-white shadow-2xl rounded-2xl px-5 py-4 text-sm font-bold flex items-start gap-3 max-w-sm border-4';
    const variants = {
        success: 'border-green-500 text-green-800 shadow-green-500/30',
        error: 'border-red-500 text-red-800 shadow-red-500/30',
        info: 'border-sky-500 text-sky-800 shadow-sky-500/30'
    };

    toast.className = `${base} ${variants[type] || variants.info}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined text-xl pt-0.5 flex-shrink-0">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span>
        <span class="leading-5 flex-1 text-gray-900">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-2', 'transition-all', 'duration-300');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

const getFormData = () => {
    const nameInput = document.querySelector(selectors.nameInput);
    const emailInput = document.querySelector(selectors.emailInput);
    const passwordInputs = document.querySelectorAll(selectors.passwordInputs);
    
    return {
        name: nameInput?.value?.trim() ?? '',
        email: emailInput?.value?.trim() ?? '',
        password: passwordInputs[0]?.value ?? '',
        passwordConfirm: passwordInputs[1]?.value ?? ''
    };
};

const resetForm = () => {
    const form = document.querySelector(selectors.form);
    if (form) {
        form.reset();
    }
};

const registerUser = async () => {
    const { name, email, password, passwordConfirm } = getFormData();

    // Validações básicas
    if (!name) {
        showToast('error', 'Por favor, insira seu nome!');
        return false;
    }

    if (!email) {
        showToast('error', 'Por favor, insira seu e-mail!');
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('error', 'Por favor, insira um e-mail válido!');
        return false;
    }

    if (!password || !passwordConfirm) {
        showToast('error', 'Por favor, insira o código secreto!');
        return false;
    }

    if (password !== passwordConfirm) {
        showToast('error', 'Os códigos secretos não coincidem!');
        return false;
    }

    if (password.length < 6) {
        showToast('error', 'O código secreto deve ter pelo menos 6 caracteres!');
        return false;
    }

    try {
        const apiUrl = '/api/register';
        
        console.log('Enviando requisição para:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                email,
                password,
                passwordConfirm
            })
        });

        console.log('Status da resposta:', response.status);
        
        const result = await response.json();
        
        console.log('Resultado da API:', result);

        if (!response.ok) {
            showToast('error', 'Erro ao registrar: ' + (result.error || 'Tente novamente'));
            return false;
        }

        // Armazenar dados do usuário localmente
        if (result.passwordHash) {
            localStorage.setItem('passwordHash', result.passwordHash);
        }
        if (result.user) {
            localStorage.setItem('userId', result.user.id);
            localStorage.setItem('username', result.user.username);
            localStorage.setItem('email', result.user.email);
        }

        showToast('success', 'Perfil criado com sucesso! 🎉');
        
        // Redirecionar para dashboard após 1.5 segundos
        setTimeout(() => {
            window.location.href = '../dashboard/index.html';
        }, 1500);
        
        resetForm();
        return true;

    } catch (error) {
        console.error('Erro na requisição:', error);
        showToast('error', 'Erro ao conectar com o servidor: ' + error.message);
        return false;
    }
};

const attachHandlers = () => {
    const form = document.querySelector(selectors.form);
    const startButton = document.querySelector(selectors.startButton);
    const headerLogin = document.querySelector(selectors.headerLogin);

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            await registerUser();
        });
    }

    if (startButton) {
        startButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await registerUser();
        });
    }

    if (headerLogin) {
        headerLogin.addEventListener('click', async (event) => {
            event.preventDefault();
            await loginWithGoogle();
        });
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthStatus();
    attachHandlers();
});
