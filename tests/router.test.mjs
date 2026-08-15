import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createRouter } = require('../js/router.js');

function createScreen(id) {
    return {
        id,
        classList: {
            toggle(name, force) {
                this.hidden = force;
            }
        }
    };
}

function createFixture(ids) {
    const screens = ids.map(createScreen);
    const events = [];
    const router = createRouter({
        screens,
        syncTopBarCentering: () => {
            events.push('layout');
        }
    });

    return {
        router,
        events,
        screens
    };
}

function screen(screens, id) {
    return screens.find(screen => screen.id === id);
}

test('initialize enters the first screen and refreshes layout', function () {
    const fixture = createFixture(['home', 'game']);
    fixture.router.defineScreen('home', {
        enter: () => fixture.events.push('enter:home')
    });

    assert.equal(fixture.router.initialize('home'), true);
    assert.equal(fixture.router.getCurrent(), 'home');
    assert.deepEqual(fixture.events, ['enter:home', 'layout']);
    assert.equal(screen(fixture.screens, 'home').classList.hidden, false);
    assert.equal(screen(fixture.screens, 'game').classList.hidden, true);
});

test('uses a layout helper registered after router creation', function () {
    const originalWindow = global.window;
    const events = [];
    global.window = {
        syncTopBarCentering: () => events.push('layout')
    };
    try {
        const router = createRouter({
            screens: [createScreen('home')]
        });
        assert.equal(router.initialize('home'), true);
        assert.deepEqual(events, ['layout']);
    } finally {
        global.window = originalWindow;
    }
});

test('navigation runs pause, exit, entry, and refresh in a fixed order', function () {
    const fixture = createFixture(['home', 'a', 'b']);
    ['home', 'a', 'b'].forEach(id => {
        fixture.router.defineScreen(id, {
            pause: () => fixture.events.push('pause:' + id),
            exit: () => fixture.events.push('exit:' + id),
            enter: () => fixture.events.push('enter:' + id)
        });
    });

    fixture.router.initialize('home');
    fixture.events.length = 0;

    fixture.router.navigate('a');
    assert.deepEqual(fixture.events, ['pause:home', 'exit:home', 'enter:a', 'layout']);

    fixture.events.length = 0;
    fixture.router.navigate('b');
    assert.deepEqual(fixture.events, ['pause:a', 'exit:a', 'enter:b', 'layout']);

    fixture.events.length = 0;
    fixture.router.goBack();
    assert.deepEqual(fixture.events, ['pause:b', 'exit:b', 'enter:a', 'layout']);
    assert.deepEqual(fixture.router.getHistory(), ['home', 'a']);
});

test('back falls back to the declared screen when history is empty', function () {
    const fixture = createFixture(['settings', 'game']);
    fixture.router.defineScreen('settings', {
        enter: () => fixture.events.push('enter:settings')
    });
    fixture.router.defineScreen('game', {
        exit: () => fixture.events.push('exit:game'),
        back: 'settings'
    });

    fixture.router.initialize('game');
    fixture.events.length = 0;

    assert.equal(fixture.router.goBack(), true);
    assert.equal(fixture.router.getCurrent(), 'settings');
    assert.deepEqual(fixture.router.getHistory(), ['settings']);
    assert.deepEqual(fixture.events, ['exit:game', 'enter:settings', 'layout']);
});

test('replace swaps the top of the history without pushing a duplicate', function () {
    const fixture = createFixture(['home', 'settings', 'game']);
    fixture.router.initialize('home');
    fixture.router.navigate('settings');

    assert.equal(fixture.router.replace('game'), true);
    assert.equal(fixture.router.getCurrent(), 'game');
    assert.deepEqual(fixture.router.getHistory(), ['home', 'game']);
});

test('goHome exits the current screen and resets history', function () {
    const fixture = createFixture(['home', 'game']);
    fixture.router.defineScreen('home', {
        enter: () => fixture.events.push('enter:home')
    });
    fixture.router.defineScreen('game', {
        exit: () => fixture.events.push('exit:game')
    });

    fixture.router.initialize('home');
    fixture.router.navigate('game');
    fixture.events.length = 0;

    assert.equal(fixture.router.goHome(), true);
    assert.equal(fixture.router.getCurrent(), 'home');
    assert.deepEqual(fixture.router.getHistory(), ['home']);
    assert.deepEqual(fixture.events, ['exit:game', 'enter:home', 'layout']);
});

test('invalid targets are rejected without changing the current screen', function () {
    const fixture = createFixture(['home']);
    fixture.router.initialize('home');

    assert.equal(fixture.router.navigate('missing'), false);
    assert.equal(fixture.router.replace('missing'), false);
    assert.equal(fixture.router.getCurrent(), 'home');
    assert.deepEqual(fixture.router.getHistory(), ['home']);
});

test('registerEnter and registerExit remain compatible with existing modules', function () {
    const fixture = createFixture(['home']);
    fixture.router.registerEnter('home', () => fixture.events.push('enter:home'));
    fixture.router.registerExit('home', () => fixture.events.push('exit:home'));
    fixture.router.defineScreen('home', { back: 'home' });

    fixture.router.initialize('home');
    fixture.events.length = 0;
    fixture.router.goBack();

    assert.equal(fixture.router.getCurrent(), 'home');
    assert.deepEqual(fixture.events, ['exit:home', 'enter:home', 'layout']);
});
