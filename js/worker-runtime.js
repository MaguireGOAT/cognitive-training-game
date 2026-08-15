(function (global) {
    'use strict';

    function createCognitiveWorker(env) {
        env = env || {};
        var worker = env.self || global;
        var cacheName = env.cacheName;
        var assetPaths = env.assetPaths || [];
        var cacheApi = env.caches || worker.caches;
        var fetchImpl = env.fetch || worker.fetch;
        var ResponseImpl = env.Response || worker.Response;
        var URLImpl = env.URL || worker.URL;
        var log = env.console || worker.console;

        function installHandler(event) {
            event.waitUntil((async () => {
                const cache = await cacheApi.open(cacheName);
                const clients = await worker.clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true
                });
                let loaded = 0;
                let failed = 0;
                const failedPaths = [];

                const notify = done => {
                    const payload = {
                        type: 'cognitive-precache-progress',
                        total: assetPaths.length,
                        loaded,
                        failed,
                        done
                    };
                    for (const client of clients) {
                        try {
                            client.postMessage(payload);
                        } catch (error) {
                            // A client may close while the first cache is being built.
                        }
                    }
                };

                for (const assetPath of assetPaths) {
                    let succeeded = false;
                    for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
                        try {
                            const response = await fetchImpl(assetPath, { cache: 'reload' });
                            if (!response.ok) {
                                throw new Error(assetPath + ' returned ' + response.status);
                            }
                            await cache.put(assetPath, response);
                            succeeded = true;
                        } catch (error) {
                            if (attempt === 1) {
                                failed++;
                                failedPaths.push(assetPath);
                            }
                        }
                    }
                    loaded++;
                    notify(false);
                }

                notify(true);
                if (failedPaths.length > 0 && log && typeof log.warn === 'function') {
                    log.warn('Precache incomplete:', failedPaths.length + ' of ' + assetPaths.length + ' assets failed.');
                }
                await worker.skipWaiting();
            })());
        }

        function activateHandler(event) {
            event.waitUntil((async () => {
                const keys = await cacheApi.keys();
                await Promise.all(keys
                    .filter(key => key !== cacheName)
                    .map(key => cacheApi.delete(key)));
                await worker.clients.claim();
            })());
        }

        function fetchHandler(event) {
            const request = event.request;
            if (!request || request.method !== 'GET') return;

            const url = new URLImpl(request.url);
            if (url.origin !== worker.location.origin) return;

            if (request.mode === 'navigate') {
                event.respondWith((async () => {
                    try {
                        const response = await fetchImpl(request);
                        const cache = await cacheApi.open(cacheName);
                        cache.put(request, response.clone());
                        return response;
                    } catch (error) {
                        const cached = await cacheApi.match('index.html');
                        if (cached) return cached;
                        return new ResponseImpl('Offline', {
                            status: 503,
                            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                        });
                    }
                })());
                return;
            }

            event.respondWith((async () => {
                const cached = await cacheApi.match(request);
                if (cached) return cached;
                try {
                    const response = await fetchImpl(request);
                    if (response.ok) {
                        const cache = await cacheApi.open(cacheName);
                        cache.put(request, response.clone());
                    }
                    return response;
                } catch (error) {
                    return new ResponseImpl('', { status: 408, statusText: 'Offline' });
                }
            })());
        }

        worker.addEventListener('install', installHandler);
        worker.addEventListener('activate', activateHandler);
        worker.addEventListener('fetch', fetchHandler);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            createCognitiveWorker: createCognitiveWorker
        };
    }

    if (typeof global !== 'undefined') {
        global.createCognitiveWorker = createCognitiveWorker;
    }
})(typeof self !== 'undefined' ? self : globalThis);
