import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { CognitiveSequence } = require('../js/food/sequence.js');

function makeRandom(values) {
    let index = 0;
    return function () {
        const value = values[index % values.length];
        index++;
        return value;
    };
}

test('empty sequence returns an empty array', function () {
    assert.deepEqual(
        CognitiveSequence.generateStream({
            choices: ['A'],
            n: 1,
            length: 0,
            random: () => 0
        }),
        []
    );
});

test('first n trials are random choices, not copies', function () {
    const sequence = CognitiveSequence.generateStream({
        choices: ['A', 'B'],
        n: 2,
        length: 2,
        matchProbability: 0,
        random: makeRandom([0, 0.99])
    });

    assert.deepEqual(sequence, ['A', 'B']);
});

test('forced match copies the item from n trials back', function () {
    const sequence = CognitiveSequence.generateStream({
        choices: ['A', 'B'],
        n: 2,
        length: 4,
        matchProbability: 1,
        random: makeRandom([0, 0.99])
    });

    assert.deepEqual(sequence, ['A', 'B', 'A', 'B']);
});

test('non-match draws a fresh random item', function () {
    const sequence = CognitiveSequence.generateStream({
        choices: ['A', 'B'],
        n: 1,
        length: 3,
        matchProbability: 0,
        random: makeRandom([0, 0, 0.99, 0, 0, 0])
    });

    assert.deepEqual(sequence, ['A', 'B', 'A']);
});

test('cloneValue prevents shared object references', function () {
    const choice = { name: 'apple' };
    const sequence = CognitiveSequence.generateStream({
        choices: [choice],
        n: 1,
        length: 2,
        matchProbability: 1,
        cloneValue: value => ({ ...value }),
        random: () => 0
    });

    assert.notEqual(sequence[0], sequence[1]);
    assert.deepEqual(sequence[0], { name: 'apple' });
    assert.deepEqual(sequence[1], { name: 'apple' });
});
