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
    const appCache = createCache();
    const mediaCache = createCache();
    const cacheNames = new Set(['cognitive-app-test', 'cognitive-media-test']);
    const deletedCaches = [];
    const messages = [];
    const clients = [{
        postMessage(payload) {
            messages.push(payload);
        }
    }];

    worker.location = { origin: 'https://app.test' };
    worker.caches = {
        open: async (name) => name === 'cognitive-media-test' ? mediaCache : appCache,
        keys: () => Promise.resolve([...cacheNames]),
        delete: (key) => {
            cacheNames.delete(key);
            deletedCaches.push(key);
            return Promise.resolve(true);
        }
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
        appCacheName: 'cognitive-app-test',
        mediaCacheName: 'cognitive-media-test',
        assetPaths,
        mediaAssetPaths: options.mediaAssetPaths || [],
        caches: worker.caches,
        fetch: options.fetch || worker.fetch,
        Response: worker.Response,
        URL,
        console: { warn() {} }
    });

    return {
        worker,
        appCache,
        mediaCache,
        deletedCaches,
        cacheNames,
        messages,
        clients
    };
}

test('worker install precaches app assets and stable media', async function () {
    const fixture = createWorkerFixture(['a.js', 'b.js'], {
        mediaAssetPaths: ['x.webp', 'y.mp3']
    });
    let installPromise;

    fixture.worker.emit('install', {
        waitUntil(promise) {
            installPromise = promise;
        }
    });
    await installPromise;

    assert.equal(fixture.appCache.entries.has('a.js'), true);
    assert.equal(fixture.appCache.entries.has('b.js'), true);
    assert.equal(fixture.mediaCache.entries.has('x.webp'), true);
    assert.equal(fixture.mediaCache.entries.has('y.mp3'), true);
    assert.equal(fixture.worker.skipped, true);
    assert.equal(fixture.messages.length, 5);
    assert.equal(fixture.messages[4].done, true);
    assert.equal(fixture.messages[4].loaded, 4);
});

test('worker activate removes old cache versions but keeps app and media caches', async function () {
    const fixture = createWorkerFixture([]);
    fixture.cacheNames.add('cognitive-game-old');
    let activatePromise;

    fixture.worker.emit('activate', {
        waitUntil(promise) {
            activatePromise = promise;
        }
    });
    await activatePromise;

    assert.deepEqual(fixture.deletedCaches, ['cognitive-game-old']);
    assert.equal(fixture.cacheNames.has('cognitive-app-test'), true);
    assert.equal(fixture.cacheNames.has('cognitive-media-test'), true);
    assert.equal(fixture.worker.claimed, true);
});

test('worker fetch falls back to the cached app shell when offline', async function () {
    const fixture = createWorkerFixture([], {
        fetch: async () => {
            throw new Error('offline');
        }
    });
    const cachedResponse = { body: 'cached' };
    fixture.appCache.entries.set('index.html', cachedResponse);

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
