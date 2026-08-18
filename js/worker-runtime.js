(function (global) {
    'use strict';

    function createCognitiveWorker(env) {
        env = env || {};
        var worker = env.self || global;
        var appCacheName = env.appCacheName || env.cacheName || 'cognitive-app';
        var mediaCacheName = env.mediaCacheName || 'cognitive-media';
        var appAssetPaths = env.assetPaths || [];
        var mediaAssetPaths = env.mediaAssetPaths || [];
        var cacheApi = env.caches || worker.caches;
        var fetchImpl = env.fetch || worker.fetch;
        var ResponseImpl = env.Response || worker.Response;
        var URLImpl = env.URL || worker.URL;
        var log = env.console || worker.console;
        var mediaExtensions = new Set(['.webp', '.png', '.mp3']);

        function isMediaUrl(url) {
            var pathname = url.pathname || url.pathname || '';
            var dot = pathname.lastIndexOf('.');
            if (dot < 0) return false;
            return mediaExtensions.has(pathname.slice(dot).toLowerCase());
        }

        function installHandler(event) {
            event.waitUntil((async () => {
                const appCache = await cacheApi.open(appCacheName);
                const mediaCache = await cacheApi.open(mediaCacheName);
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
                        total: appAssetPaths.length + mediaAssetPaths.length,
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

                async function findInOldCaches(assetPath) {
                    const keys = await cacheApi.keys();
                    for (const key of keys) {
                        if (key === appCacheName || key === mediaCacheName) continue;
                        try {
                            const oldCache = await cacheApi.open(key);
                            const response = await oldCache.match(assetPath);
                            if (response) return response;
                        } catch (error) {}
                    }
                    return null;
                }

                async function cacheAsset(cache, assetPath, allowOld) {
                    let response = null;
                    if (allowOld) response = await findInOldCaches(assetPath);
                    if (!response) {
                        for (let attempt = 0; attempt < 2 && !response; attempt++) {
                            try {
                                response = await fetchImpl(assetPath, { cache: 'reload' });
                                if (!response.ok) throw new Error(assetPath + ' returned ' + response.status);
                            } catch (error) {
                                response = null;
                            }
                        }
                    }
                    if (!response) {
                        failed++;
                        failedPaths.push(assetPath);
                        loaded++;
                        notify(false);
                        return;
                    }
                    try {
                        await cache.put(assetPath, response);
                    } catch (error) {
                        failed++;
                        failedPaths.push(assetPath);
                    }
                    loaded++;
                    notify(false);
                }

                for (const assetPath of appAssetPaths) {
                    await cacheAsset(appCache, assetPath, false);
                }
                for (const assetPath of mediaAssetPaths) {
                    await cacheAsset(mediaCache, assetPath, true);
                }

                notify(true);
                if (failedPaths.length > 0 && log && typeof log.warn === 'function') {
                    log.warn('Precache incomplete:', failedPaths.length + ' of ' + (appAssetPaths.length + mediaAssetPaths.length) + ' assets failed.');
                }
                await worker.skipWaiting();
            })());
        }

        function activateHandler(event) {
            event.waitUntil((async () => {
                const keys = await cacheApi.keys();
                await Promise.all(keys
                    .filter(key => key !== appCacheName && key !== mediaCacheName)
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
                        const cache = await cacheApi.open(appCacheName);
                        cache.put(request, response.clone());
                        return response;
                    } catch (error) {
                        const cache = await cacheApi.open(appCacheName);
                        const cached = await cache.match('index.html');
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
                const isMedia = isMediaUrl(url);
                const cacheName = isMedia ? mediaCacheName : appCacheName;
                const cache = await cacheApi.open(cacheName);

                if (isMedia) {
                    const cached = await cache.match(request);
                    if (cached) return cached;
                    try {
                        const response = await fetchImpl(request);
                        if (response.ok) cache.put(request, response.clone());
                        return response;
                    } catch (error) {
                        return new ResponseImpl('', { status: 408, statusText: 'Offline' });
                    }
                }

                const cachedPromise = cache.match(request);
                const networkPromise = fetchImpl(request).then(async (response) => {
                    if (response.ok) cache.put(request, response.clone());
                    return response;
                }).catch(() => null);

                const cached = await cachedPromise;
                if (cached) {
                    networkPromise.catch(() => {});
                    return cached;
                }
                const network = await networkPromise;
                if (network) return network;
                return new ResponseImpl('', { status: 408, statusText: 'Offline' });
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
