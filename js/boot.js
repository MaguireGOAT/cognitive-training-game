(function () {
    'use strict';

    var bootLoader = document.getElementById('bootLoader');
    var bootProgress = document.getElementById('bootLoaderProgress');
    var started = false;
    var ready = false;
    var pendingCallbacks = [];
    var installWaiter = null;
    var registrationRef = null;
    var bootTimer = null;
    var pendingUpdate = false;
    var pendingUpdateReload = false;
    var reloading = false;

    function setProgress(loaded, total) {
        if (!bootProgress || !total) return;
        var percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
        bootProgress.style.width = percent + '%';
    }

    function showLoader() {
        if (bootLoader) bootLoader.classList.remove('hidden');
    }

    function hideLoader() {
        if (bootLoader) bootLoader.classList.add('hidden');
    }

    function reloadForUpdate() {
        if (reloading) return;
        reloading = true;
        window.location.reload();
    }

    function complete() {
        if (bootTimer) {
            clearTimeout(bootTimer);
            bootTimer = null;
        }
        hideLoader();
        if (ready) return;
        ready = true;
        var callbacks = pendingCallbacks;
        pendingCallbacks = [];
        callbacks.forEach(function (callback) {
            try {
                callback();
            } catch (error) {
                console.error('App boot callback failed:', error);
            }
        });
    }

    function onProgressMessage(event) {
        var data = event && event.data;
        if (!data || data.type !== 'cognitive-precache-progress') return;
        setProgress(data.loaded, data.total);
        if (data.done && installWaiter) {
            var finish = installWaiter;
            installWaiter = null;
            finish();
        }
    }

    function waitForInstall(registration) {
        return new Promise(function (resolve) {
            var worker = registration.installing || registration.waiting;
            var settled = false;
            var timeout = setTimeout(finish, 90000);

            function finish() {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (worker) worker.removeEventListener('statechange', onState);
                if (installWaiter === finish) installWaiter = null;
                resolve();
            }

            function onState() {
                if (worker && (worker.state === 'activated' || worker.state === 'redundant')) {
                    finish();
                }
            }

            if (installWaiter) {
                var previous = installWaiter;
                installWaiter = null;
                previous();
            }
            installWaiter = finish;
            if (worker) worker.addEventListener('statechange', onState);
            if (!worker || worker.state === 'activated' || worker.state === 'redundant') {
                finish();
            }
        });
    }

    function waitForActive(registration) {
        return new Promise(function (resolve) {
            var worker = registration.installing || registration.waiting || registration.active;
            if (!worker || worker.state === 'activated' || worker.state === 'redundant') {
                resolve();
                return;
            }
            worker.addEventListener('statechange', function onState() {
                if (worker.state === 'activated' || worker.state === 'redundant') {
                    worker.removeEventListener('statechange', onState);
                    resolve();
                }
            });
        });
    }

    function getCurrentScreen() {
        if (window.CognitiveRouter && typeof window.CognitiveRouter.getCurrent === 'function') {
            return window.CognitiveRouter.getCurrent();
        }
        return null;
    }

    function installPendingUpdate(registration, shouldReload) {
        pendingUpdate = false;
        pendingUpdateReload = false;
        showLoader();
        finishWorkerUpdate(registration, shouldReload)
            .catch(complete);
    }

    function finishWorkerUpdate(registration, shouldReload) {
        return waitForInstall(registration)
            .then(function () {
                return waitForActive(registration);
            })
            .then(function () {
                if (shouldReload && registration.active && registration.active.state === 'activated') {
                    reloadForUpdate();
                    return;
                }
                complete();
            });
    }

    function startUpdateCheck(registration) {
        if (!registration) return;
        registration.addEventListener('updatefound', function () {
            if (!(registration.installing || registration.waiting)) return;
            var current = getCurrentScreen();
            if (current && current !== 'home') {
                pendingUpdate = true;
                pendingUpdateReload = !!navigator.serviceWorker.controller;
                return;
            }
            installPendingUpdate(registration, !!navigator.serviceWorker.controller);
        });
        if (registration.active && navigator.onLine !== false) {
            registration.update().catch(function () {});
        }
    }

    function start(callback) {
        if (ready) {
            callback();
            return;
        }
        pendingCallbacks.push(callback);
        if (started) return;
        started = true;

        showLoader();
        var hadController = !!navigator.serviceWorker.controller;

        if (!('serviceWorker' in navigator)) {
            complete();
            return;
        }

        navigator.serviceWorker.addEventListener('message', onProgressMessage);

        if (navigator.onLine === false && navigator.serviceWorker.controller) {
            complete();
            return;
        }

        navigator.serviceWorker.register('sw.js').then(function (registration) {
            registrationRef = registration;

            if (window.CognitiveRouter && window.CognitiveRouter.registerEnter) {
                window.CognitiveRouter.registerEnter('home', function () {
                    if (pendingUpdate && registrationRef) {
                        installPendingUpdate(registrationRef, pendingUpdateReload);
                    }
                });
            }

            if (registration.installing || registration.waiting) {
                return finishWorkerUpdate(registration, hadController);
            }

            if (registration.active) {
                complete();
                startUpdateCheck(registration);
                return;
            }

            return new Promise(function (resolve) {
                var timer = setTimeout(function () {
                    registration.removeEventListener('updatefound', onFound);
                    resolve();
                }, 3000);

                function onFound() {
                    clearTimeout(timer);
                    registration.removeEventListener('updatefound', onFound);
                    resolve();
                }

                registration.addEventListener('updatefound', onFound);
            }).then(function () {
                if (registration.installing || registration.waiting) {
                    return finishWorkerUpdate(registration, hadController);
                }
                complete();
                return null;
            });
        }).catch(function () {
            complete();
        });

        bootTimer = setTimeout(function () {
            complete();
        }, 90000);
    }

    window.CognitiveBoot = {
        start: start
    };
})();
