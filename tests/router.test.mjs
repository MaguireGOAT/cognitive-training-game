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

function createDomClassList() {
    const values = new Set();
    return {
        add(...names) {
            names.forEach(name => values.add(name));
        },
        remove(...names) {
            names.forEach(name => values.delete(name));
        },
        toggle(name, force) {
            const on = force === undefined ? !values.has(name) : !!force;
            if (on) values.add(name);
            else values.delete(name);
        },
        contains(name) {
            return values.has(name);
        }
    };
}

function createDomScreen(id) {
    return {
        id,
        classList: createDomClassList()
    };
}

function createDomFixture(ids, options) {
    options = options || {};
    const screens = ids.map(createDomScreen);
    const bodyClassList = createDomClassList();
    const timers = [];
    const durations = [];
    const events = [];
    const documentRef = {
        body: {
            classList: bodyClassList
        },
        querySelectorAll: selector => selector === '.app-screen' ? screens : [],
        getElementById: () => null,
        defaultView: options.reducedMotion
            ? { matchMedia: () => ({ matches: true }) }
            : null
    };
    const router = createRouter({
        document: documentRef,
        screens,
        setTimeout(fn, ms) {
            timers.push({ fn, ms });
            durations.push(ms);
            return timers.length;
        },
        clearTimeout() {},
        syncTopBarCentering: () => events.push('layout')
    });

    return {
        router,
        screens,
        events,
        durations,
        bodyClassList,
        runTimers() {
            const pending = timers.slice();
            timers.length = 0;
            pending.forEach(timer => timer.fn());
        }
    };
}

function hasClass(container, name) {
    return (container.classList || container).contains(name);
}

test('browser navigation applies a timed forward transition', function () {
    const fixture = createDomFixture(['home', 'game']);
    fixture.router.defineScreen('game', {
        enter: () => fixture.events.push('enter:game')
    });

    assert.equal(fixture.router.initialize('home'), true);
    assert.equal(fixture.durations.length, 0);
    assert.equal(hasClass(fixture.bodyClassList, 'cognitive-screen-transition'), false);

    fixture.events.length = 0;
    assert.equal(fixture.router.navigate('game'), true);
    assert.equal(fixture.router.isTransitioning(), true);
    assert.equal(fixture.router.getCurrent(), 'game');
    assert.deepEqual(fixture.events, ['enter:game']);
    assert.equal(hasClass(fixture.bodyClassList, 'cognitive-screen-transition'), true);
    assert.equal(hasClass(fixture.bodyClassList, 'screen-forward'), true);
    assert.equal(hasClass(fixture.bodyClassList, 'screen-back'), false);
    assert.equal(hasClass(fixture.screens[0].classList, 'screen-from'), true);
    assert.equal(hasClass(fixture.screens[1].classList, 'screen-to'), true);
    assert.equal(hasClass(fixture.screens[0].classList, 'hidden'), true);
    assert.equal(hasClass(fixture.screens[1].classList, 'hidden'), false);
    assert.equal(fixture.durations[0], 200);

    fixture.runTimers();
    assert.equal(fixture.router.isTransitioning(), false);
    assert.equal(hasClass(fixture.bodyClassList, 'cognitive-screen-transition'), false);
    assert.equal(hasClass(fixture.screens[0].classList, 'screen-from'), false);
    assert.equal(hasClass(fixture.screens[1].classList, 'screen-to'), false);
    assert.equal(hasClass(fixture.screens[0].classList, 'hidden'), true);
    assert.equal(hasClass(fixture.screens[1].classList, 'hidden'), false);
    assert.deepEqual(fixture.events, ['enter:game', 'layout']);
});

test('back and home navigation use their own transition directions', function () {
    const fixture = createDomFixture(['home', 'settings']);
    fixture.router.initialize('home');
    fixture.router.navigate('settings');
    fixture.runTimers();

    fixture.router.goBack();
    assert.equal(hasClass(fixture.bodyClassList, 'screen-back'), true);
    assert.equal(hasClass(fixture.bodyClassList, 'screen-forward'), false);
    fixture.runTimers();

    fixture.router.navigate('settings');
    fixture.runTimers();
    fixture.router.goHome();
    assert.equal(hasClass(fixture.bodyClassList, 'screen-home'), true);
    assert.equal(hasClass(fixture.bodyClassList, 'screen-back'), false);
    fixture.runTimers();
    assert.equal(fixture.router.getCurrent(), 'home');
    assert.deepEqual(fixture.router.getHistory(), ['home']);
});

test('rapid navigation is ignored until the current transition finishes', function () {
    const fixture = createDomFixture(['home', 'a', 'b']);
    fixture.router.initialize('home');

    assert.equal(fixture.router.navigate('a'), true);
    assert.equal(fixture.router.navigate('b'), false);
    assert.equal(fixture.router.getCurrent(), 'a');
    assert.deepEqual(fixture.router.getHistory(), ['home', 'a']);

    fixture.runTimers();
    assert.equal(fixture.router.navigate('b'), true);
    assert.equal(fixture.router.getCurrent(), 'b');
    assert.deepEqual(fixture.router.getHistory(), ['home', 'a', 'b']);
});

test('afterTransition callbacks run after the transition in order', function () {
    const fixture = createDomFixture(['home', 'game']);
    const order = [];
    fixture.router.initialize('home');
    fixture.router.navigate('game');

    assert.equal(fixture.router.afterTransition(() => order.push('one')), true);
    assert.equal(fixture.router.afterTransition(() => order.push('two')), true);
    fixture.runTimers();
    assert.deepEqual(order, ['one', 'two']);

    assert.equal(fixture.router.afterTransition(() => order.push('three')), false);
    assert.deepEqual(order, ['one', 'two', 'three']);
});

test('reduced motion uses the shorter transition duration', function () {
    const fixture = createDomFixture(['home', 'game'], { reducedMotion: true });
    fixture.router.initialize('home');
    fixture.router.navigate('game');

    assert.equal(fixture.durations[0], 140);
});
