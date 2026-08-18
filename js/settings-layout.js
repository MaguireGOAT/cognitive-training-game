(function (global) {
    'use strict';

    function createSettingsLayout(documentRef, options) {
        options = options || {};
        var screens = options.screens || [];
        var raf = options.requestAnimationFrame ||
            global.requestAnimationFrame ||
            function (callback) { setTimeout(callback, 0); };
        var resizeObserver = null;
        var mutationObserver = null;
        var pending = false;

        function isVisible(screen) {
            return screen &&
                !screen.classList.contains('hidden') &&
                screen.getClientRects().length > 0;
        }

        function measureOverflow(screen) {
            screen.classList.add('settings-screen--measure');
            var overflows = screen.scrollHeight > screen.clientHeight + 1;
            screen.classList.remove('settings-screen--measure');
            return overflows;
        }

        function updateScreen(screen) {
            if (!isVisible(screen)) return;
            var scroll = measureOverflow(screen);
            screen.classList.toggle('settings-screen--scroll', scroll);
            screen.classList.toggle('settings-screen--centered', !scroll);
        }

        function refresh() {
            if (pending) return;
            pending = true;
            raf(function () {
                pending = false;
                screens.forEach(updateScreen);
            });
        }

        function attach() {
            if (typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver(refresh);
                screens.forEach(function (screen) {
                    resizeObserver.observe(screen);
                    var optionsEl = screen.querySelector('.settings-options');
                    if (optionsEl) resizeObserver.observe(optionsEl);
                });
            }
            if (typeof MutationObserver !== 'undefined') {
                mutationObserver = new MutationObserver(refresh);
                screens.forEach(function (screen) {
                    mutationObserver.observe(screen, {
                        attributes: true,
                        childList: true,
                        subtree: true,
                        attributeFilter: ['class', 'style', 'hidden']
                    });
                });
            }
            global.addEventListener('resize', refresh);
            documentRef.addEventListener('visibilitychange', refresh);
            refresh();
        }

        return {
            attach: attach,
            refresh: refresh,
            updateScreen: updateScreen
        };
    }

    function boot() {
        if (!global.document) return;
        var screens = Array.prototype.slice.call(global.document.querySelectorAll('.settings-screen'));
        var layout = createSettingsLayout(global.document, { screens: screens });
        layout.attach();
        global.CognitiveSettingsLayout = {
            current: layout,
            create: createSettingsLayout
        };
    }

    if (global.document) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', boot);
        } else {
            boot();
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            createSettingsLayout: createSettingsLayout
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
