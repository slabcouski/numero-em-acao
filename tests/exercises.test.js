import test from 'node:test';
import assert from 'node:assert/strict';
import { OPERATIONS, exercisesForLevel, numberFromRotation, operationFromRotation, calculate, matchesExercise } from '../src/js/exercises.js';

test('todos os exercícios têm números representáveis e contas corretas', () => {
    for (let level = 1; level <= 4; level++) {
        const operation = Object.values(OPERATIONS).find(item => item.level === level);
        const exercises = exercisesForLevel(level);
        assert.ok(exercises.length >= 15);
        assert.equal(new Set(exercises.map(item => `${item.factor1}:${item.factor2}`)).size, exercises.length);
        for (const exercise of exercises) {
            assert.ok(exercise.factor1 >= 1 && exercise.factor1 <= 12);
            assert.ok(exercise.factor2 >= 1 && exercise.factor2 <= 12);
            assert.equal(exercise.operation, operation);
            assert.equal(calculate(exercise.factor1, exercise.factor2, operation.symbol), exercise.correctAnswer);
            if (level === 2) assert.ok(exercise.correctAnswer > 0);
            if (level === 4) assert.equal(exercise.factor1 % exercise.factor2, 0);
        }
    }
    for (const level of [1, 3]) {
        const pairs = new Set(exercisesForLevel(level).map(item => `${item.factor1}:${item.factor2}`));
        assert.ok(pairs.has('2:3'));
        assert.ok(pairs.has('3:2'));
    }
    assert.throws(() => exercisesForLevel(5), RangeError);
});

test('roletas representam os números e operações alinhados com o ponteiro', () => {
    for (let number = 1; number <= 12; number++) {
        const rotation = (12 - number) * 30;
        assert.equal(numberFromRotation(rotation), number);
        assert.equal(numberFromRotation(rotation - 360), number);
    }
    assert.equal(operationFromRotation(0), '×');
    assert.equal(operationFromRotation(90), '−');
    assert.equal(operationFromRotation(180), '+');
    assert.equal(operationFromRotation(270), '÷');
    assert.equal(operationFromRotation(360), '×');
    assert.equal(operationFromRotation(-90), '÷');
});

test('divisão não exata não é arredondada para uma resposta correta', () => {
    assert.equal(calculate(8, 2, '÷'), 4);
    assert.equal(calculate(9, 2, '÷'), null);
    assert.equal(calculate(9, 0, '÷'), null);
    assert.equal(calculate(12, 12, '×'), 144);
});

test('confirma somente a conta da missão, não outra com o mesmo resultado', () => {
    const exercise = { factor1: 8, factor2: 2, operation: OPERATIONS.DIVISION };
    assert.equal(matchesExercise(exercise, 8, 2, '÷'), true);
    assert.equal(calculate(8, 2, '÷'), calculate(6, 2, '−'));
    assert.equal(matchesExercise(exercise, 6, 2, '−'), false);
    assert.equal(matchesExercise(exercise, 2, 8, '÷'), false);
    assert.equal(matchesExercise(exercise, 8, 2, '−'), false);
});
