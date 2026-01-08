import { loginWithGoogle, checkAuthStatus } from './auth-google.js';

// Toast notification system
const ensureToastContainer = () => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    return container;
};

const showToast = (type, message) => {
    const container = ensureToastContainer();
    const toast = document.createElement('div');

    const base = 'bg-white shadow-2xl rounded-2xl px-5 py-4 text-sm font-bold flex items-start gap-3 max-w-sm border-4 pointer-events-auto';
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

// Toggle password visibility
const togglePasswordVisibility = () => {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.querySelector('[data-toggle-password]');
    const icon = toggleButton.querySelector('.material-symbols-outlined');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        passwordInput.type = 'password';
        icon.textContent = 'visibility';
    }
};

// Handle login
const handleLogin = async (event) => {
    event.preventDefault();

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Validação básica
    if (!username) {
        showToast('error', 'Por favor, digite seu nome ou e-mail!');
        usernameInput.focus();
        return;
    }

    if (!password) {
        showToast('error', 'Por favor, digite sua senha!');
        passwordInput.focus();
        return;
    }

    if (password.length < 6) {
        showToast('error', 'A senha deve ter no mínimo 6 caracteres!');
        passwordInput.focus();
        return;
    }

    try {
        // Encode password in base64
        const passwordHash = btoa(password);

        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password: passwordHash
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast('error', data.error || 'Erro ao fazer login!');
            return;
        }

        // Armazenar dados do usuário
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('username', data.user.username || data.user.email);
        localStorage.setItem('email', data.user.email);
        localStorage.setItem('passwordHash', passwordHash);

        showToast('success', `Bem-vindo de volta, ${data.user.username || data.user.email}!`);

        // Redirecionar após 1 segundo
        setTimeout(() => {
            window.location.href = './pages/dashboard/index.html';
        }, 1000);

    } catch (error) {
        console.error('Erro ao fazer login:', error);
        showToast('error', 'Erro ao conectar com o servidor. Tente novamente!');
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check if already logged in
    const userId = localStorage.getItem('userId');
    if (userId) {
        showToast('info', 'Você já está logado! Redirecionando...');
        setTimeout(() => {
            window.location.href = './pages/dashboard/index.html';
        }, 1500);
        return;
    }

    // Verificar se há sessão do Google (callback do OAuth)
    await checkAuthStatus();

    const loginForm = document.querySelector('form');
    const googleLoginButton = document.getElementById('google-login-btn');
    const toggleButton = document.querySelector('button[type="button"]:not(#google-login-btn)');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', async () => {
            try {
                await loginWithGoogle();
            } catch (error) {
                console.error('Erro ao fazer login com Google:', error);
                showToast('error', 'Erro ao fazer login com Google!');
            }
        });
    }

    if (toggleButton && toggleButton.querySelector('.material-symbols-outlined')?.textContent === 'visibility') {
        toggleButton.setAttribute('data-toggle-password', '');
        toggleButton.addEventListener('click', togglePasswordVisibility);
    }

    // Help modal functionality
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const closeHelpConfirmBtn = document.getElementById('close-help-confirm-btn');

    if (helpBtn && helpModal) {
        const openHelpModal = () => {
            helpModal.classList.remove('opacity-0', 'pointer-events-none');
            helpModal.classList.add('opacity-100');
            const modalContent = helpModal.querySelector('div:nth-child(1)');
            modalContent.classList.remove('scale-95');
            modalContent.classList.add('scale-100');
        };

        const closeHelpModal = () => {
            helpModal.classList.add('opacity-0', 'pointer-events-none');
            helpModal.classList.remove('opacity-100');
            const modalContent = helpModal.querySelector('div:nth-child(1)');
            modalContent.classList.add('scale-95');
            modalContent.classList.remove('scale-100');
        };

        helpBtn.addEventListener('click', openHelpModal);
        closeHelpBtn.addEventListener('click', closeHelpModal);
        closeHelpConfirmBtn.addEventListener('click', closeHelpModal);

        // Close modal when clicking outside of it
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                closeHelpModal();
            }
        });

        // Close with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !helpModal.classList.contains('opacity-0')) {
                closeHelpModal();
            }
        });
    }
});

