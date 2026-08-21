// keyboard.test.mjs - regression tests for the central keyboard dispatcher helpers
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const keyboard = require('../js/keyboard.js');

test('normalizeKey maps keyboard keys to canonical names', function () {
    assert.equal(keyboard.normalizeKey('j'), 'j');
    assert.equal(keyboard.normalizeKey('J'), 'j');
    assert.equal(keyboard.normalizeKey('k'), 'k');
    assert.equal(keyboard.normalizeKey('p'), 'p');
    assert.equal(keyboard.normalizeKey('s'), 's');
    assert.equal(keyboard.normalizeKey(' '), 'space');
    assert.equal(keyboard.normalizeKey('Escape'), 'escape');
    assert.equal(keyboard.normalizeKey('Enter'), 'enter');
    assert.equal(keyboard.normalizeKey('ArrowLeft'), 'arrowleft');
    assert.equal(keyboard.normalizeKey('ArrowRight'), 'arrowright');
    assert.equal(keyboard.normalizeKey('ArrowUp'), 'arrowup');
    assert.equal(keyboard.normalizeKey('ArrowDown'), 'arrowdown');
    assert.equal(keyboard.normalizeKey(''), '');
    assert.equal(keyboard.normalizeKey(null), '');
});

test('normalizeKey keeps speed and side-menu keys', function () {
    assert.equal(keyboard.normalizeKey('-'), '-');
    assert.equal(keyboard.normalizeKey('='), '=');
    assert.equal(keyboard.normalizeKey('`'), '`');
    assert.equal(keyboard.normalizeKey('+'), '+');
});

test('resolveGlobalAction is modal-first for Escape', function () {
    assert.equal(keyboard.resolveGlobalAction('escape', { messageOpen: true }), 'dismiss-message');
    assert.equal(
        keyboard.resolveGlobalAction('escape', { messageOpen: true, menuOpen: true }),
        'dismiss-message'
    );
    assert.equal(keyboard.resolveGlobalAction('escape', { messageOpen: false, menuOpen: true }), 'close-menu');
    assert.equal(
        keyboard.resolveGlobalAction('escape', { messageOpen: false, menuOpen: false, magnifyOpen: true }),
        'close-magnify'
    );
    assert.equal(keyboard.resolveGlobalAction('escape', {}), 'back');
    assert.equal(keyboard.resolveGlobalAction('escape', null), 'back');
});

test('resolveGlobalAction ignores non-Escape keys', function () {
    assert.equal(keyboard.resolveGlobalAction('j', {}), null);
    assert.equal(keyboard.resolveGlobalAction('space', { messageOpen: true }), null);
    assert.equal(keyboard.resolveGlobalAction('', {}), null);
});

test('isTypingTarget only matches editable or select elements', function () {
    function fake(tag) {
        return {
            matches(selector) {
                return selector.indexOf(tag) !== -1;
            }
        };
    }
    assert.equal(keyboard.isTypingTarget(fake('input')), true);
    assert.equal(keyboard.isTypingTarget(fake('textarea')), true);
    assert.equal(keyboard.isTypingTarget(fake('select')), true);
    assert.equal(keyboard.isTypingTarget(null), false);
    assert.equal(keyboard.isTypingTarget({}), false);
    assert.equal(keyboard.isTypingTarget({ matches: 42 }), false);
});

test('findNeighborIndex navigates a 2x2 grid spatially and stops at edges', function () {
    const rects = [
        { left: 0, top: 0, right: 100, bottom: 100 },
        { left: 110, top: 0, right: 210, bottom: 100 },
        { left: 0, top: 110, right: 100, bottom: 210 },
        { left: 110, top: 110, right: 210, bottom: 210 }
    ];
    assert.equal(keyboard.findNeighborIndex(0, rects, 'right'), 1);
    assert.equal(keyboard.findNeighborIndex(0, rects, 'down'), 2);
    assert.equal(keyboard.findNeighborIndex(1, rects, 'down'), 3);
    assert.equal(keyboard.findNeighborIndex(3, rects, 'up'), 1);
    assert.equal(keyboard.findNeighborIndex(3, rects, 'left'), 2);
    // edges stop
    assert.equal(keyboard.findNeighborIndex(1, rects, 'right'), -1);
    assert.equal(keyboard.findNeighborIndex(0, rects, 'left'), -1);
    assert.equal(keyboard.findNeighborIndex(2, rects, 'down'), -1);
    assert.equal(keyboard.findNeighborIndex(0, rects, 'up'), -1);
});

test('findNeighborIndex handles invalid input', function () {
    assert.equal(keyboard.findNeighborIndex(0, [], 'right'), -1);
    assert.equal(keyboard.findNeighborIndex(0, null, 'right'), -1);
    assert.equal(keyboard.findNeighborIndex(-1, [{ left: 0, top: 0, right: 10, bottom: 10 }], 'right'), -1);
    assert.equal(keyboard.findNeighborIndex(5, [{ left: 0, top: 0, right: 10, bottom: 10 }], 'right'), -1);
    assert.equal(keyboard.findNeighborIndex(0, [{ left: 0, top: 0, right: 10, bottom: 10 }], 'diagonal'), -1);
});

test('findNeighborIndex prefers the closest card in the pressed direction', function () {
    // current at (0,0); two cards to the right at x=110 and x=200
    const rects = [
        { left: 0, top: 0, right: 100, bottom: 100 },
        { left: 110, top: 0, right: 210, bottom: 100 },
        { left: 200, top: 0, right: 300, bottom: 100 }
    ];
    assert.equal(keyboard.findNeighborIndex(0, rects, 'right'), 1);
});