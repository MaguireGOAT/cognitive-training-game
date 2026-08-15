import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCognitiveWorker } = require('../js/worker-runtime.js');

function createEventTarget() {
    const listeners = new Map();
    return {
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        emit(type, event) {
            const handlers = listeners.get(type) || [];
            handlers.slice().forEach(handler => handler(event || {}));
        }
    };
}

function createCache() {
    const entries = new Map();
    const deleted = [];
    const normalizeKey = key => typeof key === 'string' ? key : key && key.url;
    return {
        entries,
        deleted,
        put(key, response) {
            entries.set(normalizeKey(key), response);
            return Promise.resolve();
        },
        match(key) {
            return Promise.resolve(entries.get(normalizeKey(key)) || null);
        },
        keys() {
            return Promise.resolve([...entries.keys()]);
        },
        delete(key) {
            deleted.push(key);
            return Promise.resolve(true);
        }
    };
}

function createWorkerFixture(assetPaths, options) {
    options = options || {};
    const worker = createEventTarget();
    const cache = createCache();
    const messages = [];
    const clients = [{
        postMessage(payload) {
            messages.push(payload);
        }
    }];

    worker.location = { origin: 'https://app.test' };
    worker.caches = {
        open: async () => cache,
        match: key => cache.match(key),
        keys: () => cache.keys(),
        delete: key => cache.delete(key)
    };
    worker.clients = {
        matchAll: async () => clients,
        claim: async () => {
            worker.claimed = true;
        }
    };
    worker.skipWaiting = async () => {
        worker.skipped = true;
    };
    worker.fetch = options.fetch || (async () => ({
        ok: true,
        status: 200,
        clone() {
            return this;
        }
    }));
    worker.Response = class FakeResponse {
        constructor(body, init) {
            this.body = body;
            this.status = init && init.status;
            this.statusText = init && init.statusText;
        }
    };

    createCognitiveWorker({
        self: worker,
        cacheName: 'cognitive-game-test',
        assetPaths,
        caches: worker.caches,
        fetch: options.fetch || worker.fetch,
        Response: worker.Response,
        URL,
        console: { warn() {} }
    });

    return {
        worker,
        cache,
        messages,
        clients
    };
}

test('worker install precaches every asset and reports progress', async function () {
    const fixture = createWorkerFixture(['a.js', 'b.js']);
    let installPromise;

    fixture.worker.emit('install', {
        waitUntil(promise) {
            installPromise = promise;
        }
    });
    await installPromise;

    assert.equal(fixture.cache.entries.has('a.js'), true);
    assert.equal(fixture.cache.entries.has('b.js'), true);
    assert.equal(fixture.worker.skipped, true);
    assert.equal(fixture.messages.length, 3);
    assert.equal(fixture.messages[2].done, true);
    assert.equal(fixture.messages[2].loaded, 2);
});

test('worker activate removes old cache versions', async function () {
    const fixture = createWorkerFixture([]);
    fixture.cache.entries.set('cognitive-game-old', { ok: true });
    fixture.cache.entries.set('cognitive-game-test', { ok: true });
    let activatePromise;

    fixture.worker.emit('activate', {
        waitUntil(promise) {
            activatePromise = promise;
        }
    });
    await activatePromise;

    assert.deepEqual(fixture.cache.deleted, ['cognitive-game-old']);
    assert.equal(fixture.worker.claimed, true);
});

test('worker fetch falls back to the cached app shell when offline', async function () {
    const fixture = createWorkerFixture([], {
        fetch: async () => {
            throw new Error('offline');
        }
    });
    const cachedResponse = { body: 'cached' };
    fixture.cache.entries.set('index.html', cachedResponse);

    let responsePromise;
    fixture.worker.emit('fetch', {
        request: {
            method: 'GET',
            url: 'https://app.test/',
            mode: 'navigate'
        },
        respondWith(promise) {
            responsePromise = promise;
        }
    });

    assert.equal(await responsePromise, cachedResponse);
});
