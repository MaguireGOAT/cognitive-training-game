(function (global) {
    'use strict';

    function createRouter(adapters) {
        adapters = adapters || {};
        var documentRef = adapters.document || null;
        var getScreens = adapters.getScreens || function () {
            if (documentRef && typeof documentRef.querySelectorAll === 'function') {
                return Array.prototype.slice.call(documentRef.querySelectorAll('.app-screen'));
            }
            return adapters.screens || [];
        };

        var screens = getScreens();
        var stack = [];
        var currentScreen = null;
        var screenDefs = {};
        var initialized = false;
        var syncLayout = typeof adapters.syncTopBarCentering === 'function'
            ? adapters.syncTopBarCentering
            : function () {
                if (typeof window !== 'undefined' && typeof window.syncTopBarCentering === 'function') {
                    window.syncTopBarCentering();
                }
            };
        var transitioning = false;
        var transitionTimer = null;
        var afterTransitionQueue = [];
        var reducedMotion = false;

        if (documentRef && documentRef.defaultView &&
            typeof documentRef.defaultView.matchMedia === 'function') {
            try {
                reducedMotion = documentRef.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
            } catch (error) {
                reducedMotion = false;
            }
        } else if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            try {
                reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            } catch (error) {
                reducedMotion = false;
            }
        }

        var transitionMs = reducedMotion ? 140 : 200;
        var setTimeoutRef = adapters.setTimeout ||
            (typeof setTimeout !== 'undefined' ? setTimeout : null);
        var clearTimeoutRef = adapters.clearTimeout ||
            (typeof clearTimeout !== 'undefined' ? clearTimeout : function () {});

        function findScreen(id) {
            return screens.filter(function (screen) {
                return screen.id === id;
            })[0] || null;
        }

        function setVisibility(id) {
            screens.forEach(function (screen) {
                if (screen.classList && typeof screen.classList.toggle === 'function') {
                    screen.classList.toggle('hidden', screen.id !== id);
                }
            });
        }

        function updateChrome() {
            var homeBtn = documentRef && typeof documentRef.getElementById === 'function'
                ? documentRef.getElementById('slideHomeBtn')
                : null;
            if (homeBtn) {
                homeBtn.classList.toggle('hidden', currentScreen === 'home');
            }
            var menu = documentRef && typeof documentRef.getElementById === 'function'
                ? documentRef.getElementById('slideMenu')
                : null;
            if (menu) {
                menu.classList.remove('open');
            }
        }

        function getDefinition(id) {
            return screenDefs[id] || null;
        }

        function callHook(hook, id) {
            var definition = getDefinition(id);
            if (definition && typeof definition[hook] === 'function') {
                definition[hook]();
            }
        }

        function closeOverlays() {
            if (!documentRef) return;
            if (typeof window !== 'undefined' && window.CognitiveMessage &&
                typeof window.CognitiveMessage.close === 'function') {
                window.CognitiveMessage.close();
            }
            if (typeof documentRef.querySelectorAll === 'function') {
                var overlays = documentRef.querySelectorAll('.overlay.active');
                for (var i = 0; i < overlays.length; i++) {
                    if (overlays[i].classList && typeof overlays[i].classList.remove === 'function') {
                        overlays[i].classList.remove('active');
                    }
                }
            }
            if (typeof documentRef.getElementById === 'function') {
                var menu = documentRef.getElementById('slideMenu');
                if (menu && menu.classList && typeof menu.classList.remove === 'function') {
                    menu.classList.remove('open');
                }
            }
        }

        function isTransitioning() {
            return transitioning;
        }

        function afterTransition(callback) {
            if (typeof callback !== 'function') return false;
            if (transitioning) {
                afterTransitionQueue.push(callback);
                return true;
            }
            callback();
            return false;
        }

        function removeTransitionClasses() {
            if (documentRef && documentRef.body && documentRef.body.classList &&
                typeof documentRef.body.classList.remove === 'function') {
                documentRef.body.classList.remove(
                    'cognitive-screen-transition',
                    'screen-forward',
                    'screen-back',
                    'screen-home'
                );
            }
            screens.forEach(function (screen) {
                if (screen.classList && typeof screen.classList.remove === 'function') {
                    screen.classList.remove('screen-from', 'screen-to');
                }
            });
        }

        function finishTransition(id) {
            if (transitionTimer !== null && typeof clearTimeoutRef === 'function') {
                clearTimeoutRef(transitionTimer);
                transitionTimer = null;
            }
            removeTransitionClasses();
            setVisibility(id);
            syncLayout();
            transitioning = false;
            var callbacks = afterTransitionQueue;
            afterTransitionQueue = [];
            callbacks.forEach(function (callback) {
                if (typeof callback === 'function') callback();
            });
        }

        function leaveCurrent() {
            if (!currentScreen) return;
            callHook('pause', currentScreen);
            callHook('exit', currentScreen);
        }

        function show(id, mode) {
            var previousScreen = currentScreen;
            if (mode !== 'instant' && isTransitioning()) return false;
            if (documentRef && documentRef.body) closeOverlays();
            leaveCurrent();
            currentScreen = id;

            if (!documentRef || !documentRef.body || mode === 'instant' ||
                previousScreen === id || !setTimeoutRef) {
                setVisibility(id);
                updateChrome();
                callHook('enter', id);
                syncLayout();
                return true;
            }

            var oldScreen = findScreen(previousScreen);
            var newScreen = findScreen(id);
            if (!oldScreen || !newScreen) {
                setVisibility(id);
                updateChrome();
                callHook('enter', id);
                syncLayout();
                return true;
            }

            transitioning = true;
            oldScreen.classList.add('screen-from');
            newScreen.classList.add('screen-to');
            documentRef.body.classList.add(
                'cognitive-screen-transition',
                mode === 'back' ? 'screen-back' :
                    mode === 'home' ? 'screen-home' : 'screen-forward'
            );
            updateChrome();
            callHook('enter', id);
            transitionTimer = setTimeoutRef(function () {
                finishTransition(id);
            }, transitionMs);
            setVisibility(id);
            return true;
        }

        function normalizeDefinition(definition) {
            definition = definition || {};
            return {
                enter: typeof definition.enter === 'function' ? definition.enter : null,
                exit: typeof definition.exit === 'function' ? definition.exit : null,
                pause: typeof definition.pause === 'function' ? definition.pause : null,
                back: definition.back !== undefined ? definition.back : null
            };
        }

        function defineScreen(id, definition) {
            var current = screenDefs[id] || {};
            var next = normalizeDefinition(definition);
            screenDefs[id] = {
                enter: next.enter || current.enter,
                exit: next.exit || current.exit,
                pause: next.pause || current.pause,
                back: next.back !== null ? next.back : current.back
            };
        }

        function registerEnter(id, fn) {
            defineScreen(id, { enter: fn });
        }

        function registerExit(id, fn) {
            defineScreen(id, { exit: fn });
        }

        function navigate(id) {
            if (!findScreen(id)) return false;
            if (isTransitioning()) return false;
            if (stack.length > 0 && stack[stack.length - 1] === id) {
                show(id, 'forward');
                return true;
            }
            stack.push(id);
            show(id, 'forward');
            return true;
        }

        function replace(id) {
            if (!findScreen(id)) return false;
            if (isTransitioning()) return false;
            if (stack.length === 0) {
                stack.push(id);
            } else {
                stack[stack.length - 1] = id;
            }
            show(id, 'forward');
            return true;
        }

        function resolveBackFallback() {
            var definition = getDefinition(currentScreen);
            if (!definition) return null;
            if (typeof definition.back === 'function') {
                return definition.back();
            }
            return definition.back;
        }

        function goBack() {
            if (isTransitioning()) return false;
            if (stack.length > 1) {
                stack.pop();
                show(stack[stack.length - 1], 'back');
                return true;
            }

            var fallback = resolveBackFallback();
            var target = typeof fallback === 'string' && findScreen(fallback) ? fallback : 'home';
            if (!findScreen(target)) return false;
            stack = [target];
            show(target, 'back');
            return true;
        }

        function goHome() {
            if (!findScreen('home')) return false;
            if (isTransitioning()) return false;
            stack = ['home'];
            show('home', 'home');
            return true;
        }

        function initialize(id) {
            if (!findScreen(id)) return false;
            if (initialized) {
                show(id, 'instant');
                return true;
            }
            initialized = true;
            stack = [id];
            show(id, 'instant');
            return true;
        }

        function getCurrent() {
            return currentScreen;
        }

        function getHistory() {
            return stack.slice();
        }

        return {
            navigate: navigate,
            replace: replace,
            goBack: goBack,
            goHome: goHome,
            defineScreen: defineScreen,
            registerEnter: registerEnter,
            registerExit: registerExit,
            initialize: initialize,
            getCurrent: getCurrent,
            getHistory: getHistory,
            isTransitioning: isTransitioning,
            afterTransition: afterTransition
        };
    }

    var api = {
        createRouter: createRouter
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveRouter = createRouter({
            document: typeof document !== 'undefined' ? document : null
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
