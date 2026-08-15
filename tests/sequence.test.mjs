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

function values(trials) {
    return trials.map(trial => trial.value);
}

function matches(trials) {
    return trials.map(trial => trial.isMatch);
}

test('empty sequence returns an empty array', function () {
    assert.deepEqual(
        CognitiveSequence.generateTrials({
            choices: ['A'],
            n: 1,
            length: 0,
            random: () => 0
        }),
        []
    );
});

test('first n trials are random choices, not copies', function () {
    const trials = CognitiveSequence.generateTrials({
        choices: ['A', 'B'],
        n: 2,
        length: 2,
        matchProbability: 0,
        random: makeRandom([0, 0.99])
    });

    assert.deepEqual(values(trials), ['A', 'B']);
    assert.deepEqual(matches(trials), [false, false]);
});

test('forced match copies the item from n trials back', function () {
    const trials = CognitiveSequence.generateTrials({
        choices: ['A', 'B'],
        n: 2,
        length: 4,
        matchProbability: 1,
        random: makeRandom([0, 0.99])
    });

    assert.deepEqual(values(trials), ['A', 'B', 'A', 'B']);
    assert.deepEqual(matches(trials), [false, false, true, true]);
});

test('non-match draws a fresh random item and avoids accidental matches', function () {
    const trials = CognitiveSequence.generateTrials({
        choices: ['A', 'B'],
        n: 1,
        length: 3,
        matchProbability: 0,
        random: makeRandom([0, 0, 0.99, 0, 0, 0])
    });

    assert.deepEqual(values(trials), ['A', 'B', 'A']);
    assert.deepEqual(matches(trials), [false, false, false]);
});

test('keyFor controls identity for object values', function () {
    const appleOne = { name: 'apple', id: 1 };
    const appleTwo = { name: 'apple', id: 2 };
    const pear = { name: 'pear', id: 3 };
    const trials = CognitiveSequence.generateTrials({
        choices: [appleOne, appleTwo, pear],
        n: 1,
        length: 3,
        matchProbability: 0,
        keyFor: value => value.name,
        random: makeRandom([0, 0, 0.99, 0, 0, 0])
    });

    assert.deepEqual(values(trials), [appleOne, pear, appleOne]);
    assert.deepEqual(matches(trials), [false, false, false]);
});

test('fallback marks a match when no different choice exists', function () {
    const trials = CognitiveSequence.generateTrials({
        choices: ['A'],
        n: 1,
        length: 2,
        matchProbability: 0,
        random: () => 0
    });

    assert.deepEqual(values(trials), ['A', 'A']);
    assert.deepEqual(matches(trials), [false, true]);
});

test('cloneValue prevents shared object references', function () {
    const choice = { name: 'apple' };
    const trials = CognitiveSequence.generateTrials({
        choices: [choice],
        n: 1,
        length: 2,
        matchProbability: 1,
        cloneValue: value => ({ ...value }),
        random: () => 0
    });

    assert.notEqual(trials[0].value, trials[1].value);
    assert.deepEqual(trials[0].value, { name: 'apple' });
    assert.deepEqual(trials[1].value, { name: 'apple' });
    assert.deepEqual(matches(trials), [false, true]);
});

test('independent planner calls keep trial streams separate', function () {
    const first = CognitiveSequence.generateTrials({
        choices: [0, 1],
        n: 1,
        length: 4,
        matchProbability: 0,
        random: makeRandom([0, 0, 0.99, 0.99, 0, 0, 0.99, 0.99])
    });
    const second = CognitiveSequence.generateTrials({
        choices: [0, 1],
        n: 1,
        length: 4,
        matchProbability: 0,
        random: makeRandom([0.99, 0.99, 0, 0, 0.99, 0.99, 0, 0])
    });

    assert.deepEqual(values(first), [0, 1, 0, 1]);
    assert.deepEqual(values(second), [1, 0, 1, 0]);
    assert.notDeepEqual(first, second);
});
