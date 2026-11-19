import test from 'node:test';
import assert from 'node:assert/strict';

test('ao concluir o último exercício mostra mensagem e reinicia a progressão', async t => {
    const originals = {
        document: globalThis.document,
        window: globalThis.window,
        localStorage: globalThis.localStorage,
        fetch: globalThis.fetch
    };
    t.after(() => Object.assign(globalThis, originals));

    const element = () => ({
        textContent: '',
        style: {},
        dataset: {},
        classList: { add() {}, remove() {} },
        parentElement: { classList: { add() {}, remove() {} } },
        addEventListener() {},
        remove() {}
    });
    const elements = Object.fromEntries([
        'factor-a', 'factor-b', 'result-display', 'ring-outer', 'ring-inner',
        'ring-middle', 'page-number', 'page-number-right', 'game-complete-dialog'
    ].map(id => [id, element()]));
    const dialog = elements['game-complete-dialog'];
    dialog.open = false;
    let onClose;
    dialog.addEventListener = (event, callback) => { if (event === 'close') onClose = callback; };
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; onClose(); };

    let initialize;
    globalThis.document = {
        readyState: 'loading',
        addEventListener: (event, callback) => { if (event === 'DOMContentLoaded') initialize = callback; },
        getElementById: id => elements[id],
        querySelector: () => null,
        createElement: element,
        body: { appendChild() {} }
    };
    globalThis.window = { addEventListener() {} };
    const storage = new Map();
    globalThis.localStorage = {
        getItem: key => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key)
    };

    let savedProgress;
    globalThis.fetch = async (url, options = {}) => {
        let body = {};
        if (url === '/api/session') {
            body = { user: { id: 'test-user', username: 'Teste', email: 'teste@example.invalid' } };
        } else if (url.startsWith('/api/get-game-progress')) {
            body = { level: 4, chapter: 3, exercise: 5, score: 100, consecutiveCorrect: 0 };
        } else if (url === '/api/new-exercise') {
            const { level } = JSON.parse(options.body);
            body = level === 4
                ? { factor1: 12, factor2: 12, correctAnswer: 1, operation: { symbol: '÷' }, exercicioId: 'final' }
                : { factor1: 1, factor2: 1, correctAnswer: 2, operation: { symbol: '+' }, exercicioId: 'novo' };
        } else if (url === '/api/save-game-progress') {
            savedProgress = JSON.parse(options.body);
        } else if (url !== '/api/log-answer') {
            throw new Error(`Requisição inesperada: ${url}`);
        }
        return { status: 200, ok: true, json: async () => body };
    };

    await import('../src/js/dashboard.js');
    await initialize();
    for (let i = 0; i < 3; i++) window.rotateRing('ring-middle');
    window.checkAnswer();
    const deadline = Date.now() + 5000;
    while ((!dialog.open || !savedProgress) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 25));
    }

    assert.equal(dialog.open, true);
    assert.equal(savedProgress.level, 1);
    assert.equal(savedProgress.chapter, 1);
    assert.equal(savedProgress.exercise, 1);
    assert.equal(savedProgress.score, 140);
    assert.equal(elements['factor-a'].textContent, 12);
    dialog.close();
    while (elements['factor-a'].textContent !== 1 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(elements['factor-a'].textContent, 1);
    assert.equal(elements['factor-b'].textContent, 1);
});
