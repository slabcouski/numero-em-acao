// ============================================
// SISTEMA DE JOGO MATEMÁTICO - NUMERO EM AÇÃO
// ============================================

// --- CONFIGURAÇÃO E ESTADO DO JOGO ---
const OPERATIONS = {
    ADDITION: { symbol: '+', name: 'Adição', icon: 'add', level: 1 },
    SUBTRACTION: { symbol: '−', name: 'Subtração', icon: 'remove', level: 2 },
    MULTIPLICATION: { symbol: '×', name: 'Multiplicação', icon: 'close', level: 3 },
    DIVISION: { symbol: '÷', name: 'Divisão', icon: 'division', level: 4 }
};

const EXERCISES_PER_CHAPTER = 5;
const CHAPTERS_PER_LEVEL = 3;

let gameState = {
    level: 1,           // 1=Adição, 2=Subtração, 3=Multiplicação, 4=Divisão
    chapter: 1,         // Capítulo atual dentro do nível
    exercise: 1,        // Exercício atual dentro do capítulo
    score: 0,           // Pontuação total
    currentExercise: null,  // Dados do exercício atual
    userAnswer: null,   // Resposta do usuário via anéis
    consecutiveCorrect: 0
};

// Rotações dos anéis interativos
let rotations = {
    'ring-outer': 0,
    'ring-middle': 0,
    'ring-inner': 0
};

// --- FUNÇÕES DE PERSISTÊNCIA ---
async function saveProgress() {
    const progress = {
        level: gameState.level,
        chapter: gameState.chapter,
        exercise: gameState.exercise,
        score: gameState.score,
        consecutiveCorrect: gameState.consecutiveCorrect,
        lastPlayed: new Date().toISOString()
    };
    
    // Salvar localmente
    localStorage.setItem('gameProgress', JSON.stringify(progress));
    
    // Salvar no banco de dados
    try {
        const userId = localStorage.getItem('userId');
        if (userId) {
            const response = await fetch('/api/save-game-progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    ...progress
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Erro ao salvar progresso no servidor:', error);
    }
}

async function loadProgress() {
    try {
        const userId = localStorage.getItem('userId');
        if (userId) {
            // Tentar carregar do servidor primeiro
            const response = await fetch(`/api/get-game-progress?userId=${userId}`);
            if (response.ok) {
                const progress = await response.json();
                gameState.level = progress.level || 1;
                gameState.chapter = progress.chapter || 1;
                gameState.exercise = progress.exercise || 1;
                gameState.score = progress.score || 0;
                gameState.consecutiveCorrect = progress.consecutiveCorrect || 0;
                return;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar progresso do servidor:', error);
    }
    
    // Fallback para localStorage
    const saved = localStorage.getItem('gameProgress');
    if (saved) {
        const progress = JSON.parse(saved);
        gameState.level = progress.level || 1;
        gameState.chapter = progress.chapter || 1;
        gameState.exercise = progress.exercise || 1;
        gameState.score = progress.score || 0;
        gameState.consecutiveCorrect = progress.consecutiveCorrect || 0;
    }
}

// --- GERAÇÃO DE EXERCÍCIOS ALEATÓRIOS ---
function generateExercise(level) {
    let factor1, factor2, correctAnswer, operation;
    
    // Números limitados a 1-12 (disponíveis nos círculos)
    const MAX_NUMBER = 12;
    
    switch(level) {
        case 1: // ADIÇÃO
            operation = OPERATIONS.ADDITION;
            // Garantir que ambos fatores estejam entre 1-12
            factor1 = randomInt(1, MAX_NUMBER);
            factor2 = randomInt(1, MAX_NUMBER);
            correctAnswer = factor1 + factor2;
            break;
            
        case 2: // SUBTRAÇÃO
            operation = OPERATIONS.SUBTRACTION;
            // Garantir que o resultado seja positivo e fatores <= 12
            factor1 = randomInt(2, MAX_NUMBER);
            factor2 = randomInt(1, factor1 - 1);
            correctAnswer = factor1 - factor2;
            break;
            
        case 3: // MULTIPLICAÇÃO
            operation = OPERATIONS.MULTIPLICATION;
            // Limitar para que o resultado não seja muito grande
            factor1 = randomInt(1, MAX_NUMBER);
            factor2 = randomInt(1, MAX_NUMBER);
            correctAnswer = factor1 * factor2;
            break;
            
        case 4: // DIVISÃO
            operation = OPERATIONS.DIVISION;
            // Gerar divisões exatas com fatores <= 12
            factor2 = randomInt(2, MAX_NUMBER);
            const quotient = randomInt(1, MAX_NUMBER);
            factor1 = factor2 * quotient;
            correctAnswer = quotient;
            break;
    }
    
    return {
        factor1,
        factor2,
        correctAnswer,
        operation,
        userAnswer: null,
        exercicioId: null,
        startTime: null
    };
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- ATUALIZAÇÃO DA INTERFACE ---
function updateUI() {
    // Atualizar operação e fatores
    const operation = getCurrentOperation();
    document.getElementById('factor-a').textContent = gameState.currentExercise.factor1;
    document.getElementById('factor-b').textContent = gameState.currentExercise.factor2;
    
    // Atualizar símbolo da operação (no meio dos fatores)
    const opSymbol = document.querySelector('.text-gray-300.text-3xl');
    if (opSymbol) {
        opSymbol.textContent = operation.symbol;
    }
    
    // Atualizar nível e capítulo no header
    const levelBadge = document.querySelector('.text-sm.font-bold.text-toy-blue');
    if (levelBadge) {
        levelBadge.textContent = `Nível ${gameState.level} - ${operation.name}`;
    }
    
    const chapterBadge = document.querySelector('.bg-toy-green');
    if (chapterBadge) {
        // Atualizar apenas o texto, não o ícone
        const textNodes = Array.from(chapterBadge.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length > 0) {
            textNodes[textNodes.length - 1].textContent = `Capítulo ${gameState.chapter}`;
        }
    }
    
    // Atualizar número do exercício
    const exerciseTitle = document.querySelector('h2.text-3xl');
    if (exerciseTitle) {
        const titleText = exerciseTitle.childNodes[exerciseTitle.childNodes.length - 1];
        if (titleText) titleText.textContent = `Exercício ${gameState.exercise}`;
    }
    
    // Atualizar número da página
    updatePageNumber();
    
    // Limpar resposta anterior
    document.getElementById('result-display').textContent = '?';
    
    // Atualizar anel do meio com operação correta
    rotateMiddleRingToOperation(operation);
    
    // Resetar anéis
    resetRings();
}

// Registrar exercício no servidor e iniciar cronômetro
async function logExerciseIfPossible() {
    try {
        const opMap = { 1: 'adicao', 2: 'subtracao', 3: 'multiplicacao', 4: 'divisao' };
        const body = {
            level: gameState.level,
            operation: opMap[gameState.level] || 'adicao',
            factor1: gameState.currentExercise.factor1,
            factor2: gameState.currentExercise.factor2,
            correctAnswer: gameState.currentExercise.correctAnswer
        };
        const resp = await fetch('/api/log-exercise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (resp.ok) {
            const data = await resp.json();
            gameState.currentExercise.exercicioId = data.exercicioId || null;
        } else {
            console.error('Falha ao registrar exercício:', resp.status);
        }
    } catch(e) {
        console.error('Erro ao registrar exercício:', e);
    } finally {
        gameState.currentExercise.startTime = Date.now();
    }
}

function updatePageNumber() {
    // Calcular número da página baseado no progresso
    // Cada nível tem 3 capítulos, cada capítulo tem 5 exercícios
    // Página = (level - 1) * 15 + (chapter - 1) * 5 + exercise + 4 (começa em 5)
    const pageNumber = (gameState.level - 1) * 15 + (gameState.chapter - 1) * 5 + gameState.exercise + 4;
    
    // Atualizar página no lado esquerdo (número)
    const pageElement = document.getElementById('page-number');
    if (pageElement) {
        pageElement.textContent = pageNumber;
    }
    
    // Atualizar página no lado direito (texto completo)
    const pageElementRight = document.getElementById('page-number-right');
    if (pageElementRight) {
        pageElementRight.textContent = `Página ${pageNumber}`;
    }
}

function rotateMiddleRingToOperation(operation) {
    const ringMiddle = document.getElementById('ring-middle');
    // Rotacionar o anel do meio para mostrar a operação correta no topo
    const operationAngles = {
        'close': 0,      // × no topo
        'add': 180,      // + embaixo
        'remove': 270,   // − esquerda
        'division': 90   // ÷ direita
    };
    
    const targetAngle = operationAngles[operation.icon] || 0;
    rotations['ring-middle'] = targetAngle;
    ringMiddle.style.transform = `rotate(${targetAngle}deg)`;
}

function updateCalculationDisplay() {
    if (!gameState.currentExercise) return;
    
    // Calcular resposta baseada nos anéis
    const factor1 = getNumberFromRing('ring-outer');
    const factor2 = getNumberFromRing('ring-inner');
    const operationSymbol = getCurrentOperationFromRing();
    
    let result = 0;
    switch(operationSymbol) {
        case '+': result = factor1 + factor2; break;
        case '−': result = factor1 - factor2; break;
        case '×': result = factor1 * factor2; break;
        case '÷': result = factor2 !== 0 ? Math.floor(factor1 / factor2) : 0; break;
    }
    
    gameState.userAnswer = result;
    
    const resultDisplay = document.getElementById('result-display');
    resultDisplay.textContent = result;
    
    // Animação de bounce
    resultDisplay.classList.remove('scale-100');
    resultDisplay.classList.add('scale-125');
    resultDisplay.parentElement.classList.add('bg-primary/20');
    setTimeout(() => {
        resultDisplay.classList.remove('scale-125');
        resultDisplay.classList.add('scale-100');
        resultDisplay.parentElement.classList.remove('bg-primary/20');
    }, 200);
}

function getNumberFromRing(ringId) {
    const ring = document.getElementById(ringId);
    const rotation = rotations[ringId] || 0;
    // Normalizar rotação (0-360)
    const normalized = ((rotation % 360) + 360) % 360;
    // Cada número está a 30° de distância
    // Quando roda gira no sentido horário, os números DIMINUEM
    // 0°=12, 30°=11, 60°=10, 90°=9, 120°=8, 150°=7, 180°=6, 210°=5, 240°=4, 270°=3, 300°=2, 330°=1
    const steps = Math.round(normalized / 30);
    let number = 12 - steps;
    if (number <= 0) number += 12;
    return number;
}

function getCurrentOperationFromRing() {
    const ring = document.getElementById('ring-middle');
    const rotation = rotations['ring-middle'] || 0;
    const normalized = ((rotation % 360) + 360) % 360;
    
    // Mapear ângulo para operação (considerando que ícones estão a 90° cada)
    // 0°: ×, 90°: ÷, 180°: +, 270°: −
    const angle = Math.round(normalized / 90) * 90;
    switch(angle) {
        case 0: return '×';
        case 90: return '÷';
        case 180: return '+';
        case 270: return '−';
        default: return '+';
    }
}

function getCurrentOperation() {
    return Object.values(OPERATIONS).find(op => op.level === gameState.level) || OPERATIONS.ADDITION;
}

// --- VALIDAÇÃO E PROGRESSÃO ---
function checkAnswer() {
    if (!gameState.currentExercise || gameState.userAnswer === null) {
        showToast('Configure os anéis primeiro!', 'warning');
        return;
    }
    
    const isCorrect = gameState.userAnswer === gameState.currentExercise.correctAnswer;
    // Registrar resposta no backend (se possível)
    logAnswerIfPossible(isCorrect);
    
    if (isCorrect) {
        handleCorrectAnswer();
    } else {
        handleWrongAnswer();
    }
}

async function logAnswerIfPossible(isCorrect) {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        const exercicioId = gameState.currentExercise?.exercicioId;
        if (!exercicioId) return;
        const tempo = gameState.currentExercise?.startTime ? (Date.now() - gameState.currentExercise.startTime) : null;
        const pontos = isCorrect ? (10 * gameState.level) : 0;
        const resp = await fetch('/api/log-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                exercicioId,
                respostaUsuario: gameState.userAnswer,
                estaCorreto: !!isCorrect,
                pontosGanhos: pontos,
                tempoResposta: tempo
            })
        });
        if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            console.warn('Falha ao registrar resposta:', data?.error || resp.status);
        }
    } catch (e) {
        console.error('Erro ao registrar resposta:', e);
    }
}

function handleCorrectAnswer() {
    gameState.score += 10 * gameState.level;
    gameState.consecutiveCorrect++;
    
    showToast('Parabéns! Resposta correta! 🎉', 'success');
    playSuccessAnimation();
    
    // Avançar para próximo exercício
    setTimeout(() => {
        nextExercise();
    }, 1500);
}

function handleWrongAnswer() {
    gameState.consecutiveCorrect = 0;
    const correctAnswer = gameState.currentExercise.correctAnswer;
    
    showToast(`Ops! A resposta correta é ${correctAnswer}. Tente novamente! 💪`, 'error');
    playErrorAnimation();
}

async function nextExercise() {
    gameState.exercise++;
    
    // Verificar se completou o capítulo
    if (gameState.exercise > EXERCISES_PER_CHAPTER) {
        gameState.exercise = 1;
        gameState.chapter++;
        
        // Verificar se completou o nível
        if (gameState.chapter > CHAPTERS_PER_LEVEL) {
            gameState.chapter = 1;
            gameState.level++;
            
            // Verificar se completou todos os níveis
            if (gameState.level > 4) {
                showGameComplete();
                return;
            } else {
                showLevelComplete();
            }
        } else {
            showChapterComplete();
        }
    }
    
    // Gerar novo exercício
    gameState.currentExercise = generateExercise(gameState.level);
    gameState.userAnswer = null;
    
    await saveProgress();
    updateUI();
    await logExerciseIfPossible();
}

function resetExercise() {
    gameState.currentExercise = generateExercise(gameState.level);
    gameState.userAnswer = null;
    updateUI();
}

// --- CONTROLE DOS ANÉIS ---
function rotateRing(id) {
    const ring = document.getElementById(id);
    let degree = id === 'ring-middle' ? 90 : 30;
    rotations[id] += degree;
    ring.style.transform = `rotate(${rotations[id]}deg)`;
    updateCalculationDisplay();
}

function resetRings() {
    // Posicionar anéis na resposta correta (para demonstração inicial)
    // Mas sem revelar a resposta
    rotations['ring-outer'] = 0;
    rotations['ring-inner'] = 0;
    
    document.getElementById('ring-outer').style.transform = 'rotate(0deg)';
    document.getElementById('ring-inner').style.transform = 'rotate(0deg)';
    
    updateCalculationDisplay();
}

// --- FEEDBACK VISUAL ---
function showToast(message, type = 'info') {
    // Criar toast customizado
    const toast = document.createElement('div');
    toast.className = `fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl shadow-xl border-4 font-bold text-lg animate-bounce max-w-md text-center`;
    
    const colors = {
        success: 'bg-green-100 border-toy-green text-green-800',
        error: 'bg-red-100 border-toy-red text-red-800',
        warning: 'bg-yellow-100 border-toy-yellow text-yellow-800',
        info: 'bg-blue-100 border-toy-blue text-blue-800'
    };
    
    toast.className += ' ' + (colors[type] || colors.info);
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function playSuccessAnimation() {
    const resultDisplay = document.getElementById('result-display');
    resultDisplay.parentElement.classList.add('!bg-toy-green', '!border-toy-green');
    
    setTimeout(() => {
        resultDisplay.parentElement.classList.remove('!bg-toy-green', '!border-toy-green');
    }, 1000);
}

function playErrorAnimation() {
    const resultDisplay = document.getElementById('result-display');
    resultDisplay.parentElement.classList.add('!bg-toy-red', '!border-toy-red', 'animate-shake');
    
    setTimeout(() => {
        resultDisplay.parentElement.classList.remove('!bg-toy-red', '!border-toy-red', 'animate-shake');
    }, 800);
}

function showChapterComplete() {
    showToast(`🎊 Capítulo ${gameState.chapter - 1} completo! Próximo capítulo desbloqueado!`, 'success');
}

function showLevelComplete() {
    const operation = getCurrentOperation();
    showToast(`🏆 Nível ${gameState.level - 1} completo! Agora vamos para ${operation.name}!`, 'success');
}

async function showGameComplete() {
    showToast('🎓 Parabéns! Você completou todos os níveis do jogo! Você é um mestre da matemática!', 'success');
    gameState.level = 1;
    gameState.chapter = 1;
    gameState.exercise = 1;
    await saveProgress();
}

// --- FUNÇÃO DE LOGOUT ---
async function logout() {
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        if (!response.ok && response.status !== 401) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('Erro ao sair:', error);
        showToast('Não foi possível sair. Tente novamente.', 'error');
        return;
    }
    // Remover TODOS os dados de autenticação e progresso
    localStorage.clear();
    sessionStorage.clear();
    
    // Redirecionar para a página de login (caminho relativo de pages/dashboard/index.html)
    window.location.href = '../../index.html';
}

// --- INICIALIZAÇÃO ---
async function initGame() {
    try {
        const response = await fetch('/api/session');
        if (response.status === 401) {
            window.location.href = '../../index.html';
            return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const { user } = await response.json();
        if (localStorage.getItem('userId') !== user.id) localStorage.removeItem('gameProgress');
        localStorage.setItem('userId', user.id);
        localStorage.setItem('username', user.username || user.email);
        localStorage.setItem('email', user.email);
        localStorage.removeItem('passwordHash');
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        showToast('Não foi possível verificar a sessão. Atualize a página.', 'error');
        return;
    }
    await loadProgress();
    gameState.currentExercise = generateExercise(gameState.level);
    updateUI();
    setupDragRotation();
    await logExerciseIfPossible();
}

// --- ROTAÇÃO MANUAL POR ARRASTE (mouse/touch) ---
const STEP_BY_RING = {
    'ring-outer': 30,
    'ring-inner': 30,
    'ring-middle': 90,
};

function normalizeDeg(deg) {
    return ((deg % 360) + 360) % 360;
}

function setupRingDrag(id) {
    const el = document.getElementById(id);
    if (!el) return;

    let dragging = false;
    let startAngle = 0;
    let startRotation = rotations[id] || 0;
    let activePointerId = null;

    el.style.touchAction = 'none';

    const getAngleFromEvent = (evt) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const x = evt.clientX;
        const y = evt.clientY;
        const rad = Math.atan2(y - cy, x - cx);
        return rad * 180 / Math.PI;
    };

    const onPointerDown = (evt) => {
        evt.preventDefault();
        dragging = true;
        activePointerId = evt.pointerId;
        try { el.setPointerCapture(activePointerId); } catch {}

        el.dataset.prevTransition = el.style.transition || '';
        el.style.transition = 'none';

        startRotation = rotations[id] || 0;
        startAngle = getAngleFromEvent(evt);
    };

    const onPointerMove = (evt) => {
        if (!dragging) return;
        if (activePointerId != null && evt.pointerId !== activePointerId) return;
        const currentAngle = getAngleFromEvent(evt);
        const delta = currentAngle - startAngle;
        const newRot = normalizeDeg(startRotation + delta);
        el.style.transform = `rotate(${newRot}deg)`;
    };

    const onPointerUp = (evt) => {
        if (!dragging) return;
        dragging = false;
        el.style.transition = el.dataset.prevTransition || '';
        try { el.releasePointerCapture(activePointerId); } catch {}
        activePointerId = null;

        const currentAngle = getAngleFromEvent(evt);
        const delta = currentAngle - startAngle;
        let finalRot = normalizeDeg(startRotation + delta);
        const step = STEP_BY_RING[id] || 30;
        finalRot = normalizeDeg(Math.round(finalRot / step) * step);

        rotations[id] = finalRot;
        el.style.transform = `rotate(${finalRot}deg)`;

        updateCalculationDisplay();
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
}

function setupDragRotation() {
    setupRingDrag('ring-outer');
    setupRingDrag('ring-middle');
    setupRingDrag('ring-inner');
}

// --- EXPOR FUNÇÕES GLOBAIS ---
window.rotateRing = rotateRing;
window.updateCalculationDisplay = updateCalculationDisplay;
window.logout = logout;
window.checkAnswer = checkAnswer;
window.resetExercise = resetExercise;

// --- INICIAR JOGO QUANDO DOM ESTIVER PRONTO ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
