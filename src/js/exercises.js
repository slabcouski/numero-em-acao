export const OPERATIONS = {
    ADDITION: { symbol: '+', name: 'Adição', icon: 'add', level: 1 },
    SUBTRACTION: { symbol: '−', name: 'Subtração', icon: 'remove', level: 2 },
    MULTIPLICATION: { symbol: '×', name: 'Multiplicação', icon: 'close', level: 3 },
    DIVISION: { symbol: '÷', name: 'Divisão', icon: 'division', level: 4 }
};

const MAX_NUMBER = 12;

function randomInt(min, max, random) {
    return Math.floor(random() * (max - min + 1)) + min;
}

export function generateExercise(level, random = Math.random) {
    let factor1, factor2, correctAnswer, operation;

    switch (level) {
        case 1:
            operation = OPERATIONS.ADDITION;
            factor1 = randomInt(1, MAX_NUMBER, random);
            factor2 = randomInt(1, MAX_NUMBER, random);
            correctAnswer = factor1 + factor2;
            break;
        case 2:
            operation = OPERATIONS.SUBTRACTION;
            factor1 = randomInt(2, MAX_NUMBER, random);
            factor2 = randomInt(1, factor1 - 1, random);
            correctAnswer = factor1 - factor2;
            break;
        case 3:
            operation = OPERATIONS.MULTIPLICATION;
            factor1 = randomInt(1, MAX_NUMBER, random);
            factor2 = randomInt(1, MAX_NUMBER, random);
            correctAnswer = factor1 * factor2;
            break;
        case 4:
            operation = OPERATIONS.DIVISION;
            factor2 = randomInt(2, MAX_NUMBER, random);
            correctAnswer = randomInt(1, Math.floor(MAX_NUMBER / factor2), random);
            factor1 = factor2 * correctAnswer;
            break;
        default:
            throw new RangeError('Nível de exercício inválido');
    }

    return { factor1, factor2, correctAnswer, operation, userAnswer: null, exercicioId: null, startTime: null };
}

export function numberFromRotation(rotation) {
    const steps = Math.round(((rotation % 360 + 360) % 360) / 30) % 12;
    return 12 - steps;
}

export function operationFromRotation(rotation) {
    const steps = Math.round(((rotation % 360 + 360) % 360) / 90) % 4;
    return ['×', '−', '+', '÷'][steps];
}

export function calculate(factor1, factor2, operation) {
    switch (operation) {
        case '+': return factor1 + factor2;
        case '−': return factor1 - factor2;
        case '×': return factor1 * factor2;
        case '÷': return factor2 !== 0 && factor1 % factor2 === 0 ? factor1 / factor2 : null;
        default: throw new Error('Operação inválida');
    }
}

export function matchesExercise(exercise, factor1, factor2, operation) {
    return factor1 === exercise.factor1 &&
        factor2 === exercise.factor2 &&
        operation === exercise.operation.symbol;
}
