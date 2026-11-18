export function loginWithGoogle() {
    window.location.href = '/api/auth/google';
}

export async function checkAuthStatus() {
    const response = await fetch('/api/session');
    if (response.status === 401) {
        localStorage.removeItem('passwordHash');
        return false;
    }
    if (!response.ok) throw new Error('Não foi possível verificar a sessão');
    const { user } = await response.json();
    if (localStorage.getItem('userId') !== user.id) localStorage.removeItem('gameProgress');
    localStorage.setItem('userId', user.id);
    localStorage.setItem('username', user.username || user.email);
    localStorage.setItem('email', user.email);
    window.location.href = '/pages/dashboard/index.html';
    return true;
}
