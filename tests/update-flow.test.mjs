import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createUpdateFlow } = require('../js/update-flow.js');

function createEventTarget() {
    const listeners = new Map();
    return {
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        removeEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            listeners.set(type, handlers.filter(item => item !== handler));
        },
        emit(type, event) {
            const handlers = listeners.get(type) || [];
            handlers.slice().forEach(handler => handler(event || {}));
        },
        listenerCount(type) {
            return (listeners.get(type) || []).length;
        }
    };
}

function createWorker(state) {
    return Object.assign(createEventTarget(), {
        state
    });
}

function createRegistration(activeWorker) {
    return Object.assign(createEventTarget(), {
        installing: null,
        waiting: null,
        active: activeWorker || null,
        updateCalls: 0,
        update: async function () {
            this.updateCalls++;
        }
    });
}

function createServiceWorkerContainer(registration) {
    return Object.assign(createEventTarget(), {
        controller: null,
        register: async () => registration
    });
}

function createLoader() {
    let shown = 0;
    let hidden = 0;
    const progress = [];
    return {
        show() {
            shown++;
        },
        hide() {
            hidden++;
        },
        setProgress(loaded, total) {
            progress.push([loaded, total]);
        },
        counts() {
            return { shown, hidden, progress };
        }
    };
}

function createRouter() {
    let current = 'home';
    const homeHandlers = [];
    return {
        getCurrent() {
            return current;
        },
        setCurrent(screen) {
            current = screen;
        },
        registerEnter(name, handler) {
            if (name === 'home') homeHandlers.push(handler);
        },
        enterHome() {
            homeHandlers.slice().forEach(handler => handler());
        }
    };
}

test('start is ready immediately when service workers are unsupported', async function () {
    const loader = createLoader();
    const flow = createUpdateFlow({
        navigator: {},
        loader
    });
    let ready = 0;

    await flow.start(() => {
        ready++;
    });

    assert.equal(ready, 1);
    assert.equal(loader.counts().hidden, 1);
});

test('active worker with no update completes boot and starts update checks', async function () {
    const worker = createWorker('activated');
    const registration = createRegistration(worker);
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const flow = createUpdateFlow({
        navigator: {
            serviceWorker: container,
            onLine: true
        },
        loader
    });
    let ready = 0;

    await flow.start(() => {
        ready++;
    });

    assert.equal(ready, 1);
    assert.equal(loader.counts().hidden, 1);
    assert.equal(container.listenerCount('message'), 1);
    assert.equal(registration.updateCalls >= 1, true);
});

test('startup update is installed before boot completes', async function () {
    const oldWorker = createWorker('activated');
    const registration = createRegistration(oldWorker);
    const newWorker = createWorker('activated');
    registration.update = async function () {
        this.updateCalls++;
        this.installing = newWorker;
        this.emit('updatefound');
    };
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const flow = createUpdateFlow({
        navigator: {
            serviceWorker: container,
            onLine: true
        },
        loader
    });
    let ready = 0;

    await flow.start(() => {
        ready++;
    });

    assert.equal(ready, 1);
    assert.equal(registration.updateCalls, 1);
    assert.equal(loader.counts().shown, 1);
    assert.equal(loader.counts().hidden, 1);
});

test('update found away from home is deferred until returning home', async function () {
    const worker = createWorker('activated');
    const registration = createRegistration(worker);
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const router = createRouter();
    let reloads = 0;
    container.controller = {};

    const flow = createUpdateFlow({
        navigator: {
            serviceWorker: container,
            onLine: true
        },
        location: {
            reload() {
                reloads++;
            }
        },
        router,
        loader
    });

    await flow.start();

    const newWorker = createWorker('activated');
    router.setCurrent('game');
    registration.installing = newWorker;
    registration.emit('updatefound');

    assert.equal(reloads, 0);

    router.setCurrent('home');
    flow.enterHome();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(reloads, 1);
    assert.equal(loader.counts().shown, 2);
});

test('router home entry installs a deferred update', async function () {
    const worker = createWorker('activated');
    const registration = createRegistration(worker);
    const container = createServiceWorkerContainer(registration);
    const loader = createLoader();
    const router = createRouter();
    container.controller = {};

    const flow = createUpdateFlow({
        navigator: {
            serviceWorker: container,
            onLine: true
        },
        location: {
            reload() {}
        },
        router,
        loader
    });

    await flow.start();

    registration.installing = createWorker('activated');
    router.setCurrent('game');
    registration.emit('updatefound');
    router.setCurrent('home');
    router.enterHome();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(loader.counts().shown, 2);
});
