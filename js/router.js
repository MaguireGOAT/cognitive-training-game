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

        function leaveCurrent() {
            if (!currentScreen) return;
            callHook('pause', currentScreen);
            callHook('exit', currentScreen);
        }

        function show(id) {
            leaveCurrent();
            currentScreen = id;
            setVisibility(id);
            updateChrome();
            callHook('enter', id);
            syncLayout();
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
            if (stack.length > 0 && stack[stack.length - 1] === id) {
                show(id);
                return true;
            }
            stack.push(id);
            show(id);
            return true;
        }

        function replace(id) {
            if (!findScreen(id)) return false;
            if (stack.length === 0) {
                stack.push(id);
            } else {
                stack[stack.length - 1] = id;
            }
            show(id);
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
            if (stack.length > 1) {
                stack.pop();
                show(stack[stack.length - 1]);
                return true;
            }

            var fallback = resolveBackFallback();
            var target = typeof fallback === 'string' && findScreen(fallback) ? fallback : 'home';
            if (!findScreen(target)) return false;
            stack = [target];
            show(target);
            return true;
        }

        function goHome() {
            if (!findScreen('home')) return false;
            stack = ['home'];
            show('home');
            return true;
        }

        function initialize(id) {
            if (!findScreen(id)) return false;
            if (initialized) {
                show(id);
                return true;
            }
            initialized = true;
            stack = [id];
            show(id);
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
            getHistory: getHistory
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
