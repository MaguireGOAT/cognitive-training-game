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

test('normalizeKey keeps speed and punctuation keys', function () {
    assert.equal(keyboard.normalizeKey('-'), '-');
    assert.equal(keyboard.normalizeKey('='), '=');
    assert.equal(keyboard.normalizeKey('+'), '+');
    assert.equal(keyboard.normalizeKey('`'), '`');
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
