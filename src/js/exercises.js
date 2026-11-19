export const OPERATIONS = {
    ADDITION: { symbol: '+', name: 'Adição', level: 1 },
    SUBTRACTION: { symbol: '−', name: 'Subtração', level: 2 },
    MULTIPLICATION: { symbol: '×', name: 'Multiplicação', level: 3 },
    DIVISION: { symbol: '÷', name: 'Divisão', level: 4 }
};

export function exercisesForLevel(level) {
    const operation = Object.values(OPERATIONS).find(item => item.level === level);
    if (!operation) throw new RangeError('Nível de exercício inválido');

    const exercises = [];
    for (let factor1 = 1; factor1 <= 12; factor1++) {
        for (let factor2 = 1; factor2 <= 12; factor2++) {
            const correctAnswer = calculate(factor1, factor2, operation.symbol);
            if (level === 2 && correctAnswer <= 0) continue;
            if (level === 4 && (factor2 < 2 || correctAnswer === null)) continue;
            exercises.push({ factor1, factor2, correctAnswer, operation });
        }
    }
    return exercises;
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
