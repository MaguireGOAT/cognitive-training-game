(function (global) {
    'use strict';

    // Central keyboard support for desktop use.
    // One global keydown dispatcher routes by the router's active screen:
    //   - Esc is modal-first: message box -> slide menu -> magnify -> back.
    //   - Screens register small keymaps (J/K, P, ...) via registerScreen().
    //   - Card/menu grids get a roving tabindex + visible ring via attachGrid().
    // The pure helpers (normalizeKey, resolveGlobalAction, findNeighborIndex,
    // isTypingTarget) are exported for unit tests.

    var documentRef = global.document || null;

    // ------------------------------------------------------------------
    // Pure helpers (unit-testable)
    // ------------------------------------------------------------------

    function normalizeKey(key) {
        if (typeof key !== 'string' || key.length === 0) return '';
        var lower = key.toLowerCase();
        var named = {
            ' ': 'space',
            escape: 'escape',
            enter: 'enter',
            arrowleft: 'arrowleft',
            arrowright: 'arrowright',
            arrowup: 'arrowup',
            arrowdown: 'arrowdown'
        };
        if (named[lower]) return named[lower];
        if (lower.length === 1 && lower >= 'a' && lower <= 'z') return lower;
        return lower;
    }

    function isTypingTarget(el) {
        if (!el || typeof el.matches !== 'function') return false;
        return el.matches('input, textarea, select, [contenteditable="true"]');
    }

    // Which Esc action applies, given what is open. Message box wins, then
    // slide menu, then magnify overlay, then plain back.
    function resolveGlobalAction(key, state) {
        state = state || {};
        if (key !== 'escape') return null;
        if (state.messageOpen) return 'dismiss-message';
        if (state.menuOpen) return 'close-menu';
        if (state.magnifyOpen) return 'close-magnify';
        return 'back';
    }

    // Spatial neighbor search over plain rect objects. Stop at edges: if no
    // card lies in the requested direction, keep the current index (-1 means
    // "no move"). Ties prefer the card aligned on the perpendicular axis so
    // vertical moves stay in the same column and horizontal moves in the same
    // row.
    function findNeighborIndex(index, rects, direction) {
        if (!rects || rects.length === 0) return -1;
        if (index < 0 || index >= rects.length) return -1;
        var current = rects[index];
        if (!current) return -1;
        var currentCX = (current.left + current.right) / 2;
        var currentCY = (current.top + current.bottom) / 2;
        var best = -1;
        var bestPrimary = Infinity;
        var bestSecondary = Infinity;
        for (var i = 0; i < rects.length; i++) {
            if (i === index || !rects[i]) continue;
            var r = rects[i];
            var primary;
            var secondary;
            if (direction === 'right') {
                if (r.left < current.right - 1) continue;
                primary = r.left - current.right;
                secondary = Math.abs((r.top + r.bottom) / 2 - currentCY);
            } else if (direction === 'left') {
                if (r.right > current.left + 1) continue;
                primary = current.left - r.right;
                secondary = Math.abs((r.top + r.bottom) / 2 - currentCY);
            } else if (direction === 'down') {
                if (r.top < current.bottom - 1) continue;
                primary = r.top - current.bottom;
                secondary = Math.abs((r.left + r.right) / 2 - currentCX);
            } else if (direction === 'up') {
                if (r.bottom > current.top + 1) continue;
                primary = current.top - r.bottom;
                secondary = Math.abs((r.left + r.right) / 2 - currentCX);
            } else {
                continue;
            }
            if (primary < bestPrimary ||
                (primary === bestPrimary && secondary < bestSecondary)) {
                bestPrimary = primary;
                bestSecondary = secondary;
                best = i;
            }
        }
        return best;
    }

    // ------------------------------------------------------------------
    // Registry
    // ------------------------------------------------------------------

    var screens = {}; // screenId -> { keys: { keyName: handler } }
    var grids = {};   // screenId -> grid controller

    function registerScreen(id, handlers) {
        if (!screens[id]) screens[id] = { keys: {} };
        var target = screens[id].keys;
        Object.keys(handlers || {}).forEach(function (keyName) {
            var normalized = normalizeKey(keyName);
            if (normalized && typeof handlers[keyName] === 'function') {
                target[normalized] = handlers[keyName];
            }
        });
    }

    // Roving-tabindex grid: no card is focused until the first arrow press;
    // arrows move a visible ring (stop at edges), Enter/Space confirm.
    function createGridController(gridEl, options) {
        options = options || {};
        var cardSelector = options.cardSelector || ':scope > *';
        var current = -1;

        function collect() {
            return Array.prototype.slice.call(gridEl.querySelectorAll(cardSelector));
        }

        function setFocused(index) {
            collect().forEach(function (card, i) {
                if (i === index) {
                    card.setAttribute('tabindex', '0');
                    card.classList.add('kb-focus');
                    if (typeof card.focus === 'function') card.focus();
                } else {
                    if (card.getAttribute('tabindex') !== null) {
                        card.setAttribute('tabindex', '-1');
                    }
                    card.classList.remove('kb-focus');
                }
            });
            current = index;
        }

        function reset() {
            collect().forEach(function (card) {
                card.removeAttribute('tabindex');
                card.classList.remove('kb-focus');
            });
            current = -1;
            if (documentRef && documentRef.activeElement &&
                gridEl.contains(documentRef.activeElement) &&
                typeof documentRef.activeElement.blur === 'function') {
                documentRef.activeElement.blur();
            }
        }

        function handleKey(key) {
            var cards = collect();
            if (cards.length === 0) return false;
            if (key === 'arrowleft' || key === 'arrowright' ||
                key === 'arrowup' || key === 'arrowdown') {
                if (current < 0) {
                    setFocused(0);
                } else {
                    var rects = cards.map(function (card) {
                        var r = card.getBoundingClientRect();
                        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
                    });
                    var next = findNeighborIndex(current, rects, key.slice(5));
                    if (next >= 0) setFocused(next);
                }
                return true;
            }
            if ((key === 'enter' || key === 'space') && current >= 0 && cards[current]) {
                if (typeof options.onConfirm === 'function') {
                    options.onConfirm(current, cards[current]);
                }
                return true;
            }
            return false;
        }

        return {
            handleKey: handleKey,
            reset: reset,
            getCurrent: function () { return current; }
        };
    }

    function attachGrid(screenId, gridEl, options) {
        var controller = createGridController(gridEl, options);
        grids[screenId] = controller;
        return controller;
    }

    // ------------------------------------------------------------------
    // Dispatcher
    // ------------------------------------------------------------------

    var activeScreen = null;

    function getActiveScreen() {
        if (global.CognitiveRouter &&
            typeof global.CognitiveRouter.getCurrent === 'function') {
            return global.CognitiveRouter.getCurrent();
        }
        return null;
    }

    // Reset the previous screen's grid whenever the active screen changes.
    function syncActiveScreen() {
        var next = getActiveScreen();
        if (next !== activeScreen) {
            if (activeScreen && grids[activeScreen]) grids[activeScreen].reset();
            activeScreen = next;
        }
        return activeScreen;
    }

    function isMessageOpen() {
        return !!(global.CognitiveMessage &&
            typeof global.CognitiveMessage.isActive === 'function' &&
            global.CognitiveMessage.isActive());
    }

    function isMenuOpen() {
        return !!(global.CognitiveMenu &&
            typeof global.CognitiveMenu.isOpen === 'function' &&
            global.CognitiveMenu.isOpen());
    }

    function isMagnifyOpen() {
        if (!documentRef || !documentRef.getElementById) return false;
        var el = documentRef.getElementById('magnifyOverlay');
        return !!(el && el.classList && el.classList.contains('active'));
    }

    function closeMagnify() {
        if (!documentRef || !documentRef.getElementById) return;
        var el = documentRef.getElementById('magnifyOverlay');
        if (el) el.classList.remove('active');
    }

    function handleKeydown(event) {
        if (!event || event.defaultPrevented) return;
        var target = event.target || (documentRef && documentRef.body);
        if (isTypingTarget(target)) return;

        var key = normalizeKey(event.key || '');
        if (key === '') return;

        if (key === 'escape') {
            var action = resolveGlobalAction(key, {
                messageOpen: isMessageOpen(),
                menuOpen: isMenuOpen(),
                magnifyOpen: isMagnifyOpen()
            });
            if (action === 'dismiss-message') {
                event.preventDefault();
                if (global.CognitiveMessage &&
                    typeof global.CognitiveMessage.dismiss === 'function') {
                    global.CognitiveMessage.dismiss();
                }
                return;
            }
            if (action === 'close-menu') {
                event.preventDefault();
                if (global.CognitiveMenu &&
                    typeof global.CognitiveMenu.close === 'function') {
                    global.CognitiveMenu.close();
                }
                return;
            }
            if (action === 'close-magnify') {
                event.preventDefault();
                closeMagnify();
                return;
            }
            if (action === 'back') {
                event.preventDefault();
                if (global.CognitiveRouter &&
                    typeof global.CognitiveRouter.goBack === 'function') {
                    global.CognitiveRouter.goBack();
                }
                return;
            }
        }

        var screen = syncActiveScreen();
        if (!screen) return;

        var keymap = screens[screen] && screens[screen].keys;
        if (keymap && typeof keymap[key] === 'function') {
            keymap[key](event);
            return;
        }

        var grid = grids[screen];
        if (grid && grid.handleKey(key)) {
            if (key === 'space' || key.slice(0, 5) === 'arrow') {
                event.preventDefault();
            }
            return;
        }
    }

    // ------------------------------------------------------------------
    // Menu navigation: arrow keys + Enter on the four menu grids.
    // ------------------------------------------------------------------

    function enableMenuNavigation() {
        if (!documentRef || !documentRef.getElementById) return;
        var confirm = function (index, el) {
            if (el && typeof el.click === 'function') el.click();
        };
        var byId = [
            { screen: 'home', gridId: null, selector: '.home-grid' },
            { screen: 'mainMenu', gridId: null, selector: '.game-select' },
            { screen: 'nbackModeSelect', gridId: null, selector: '.nback-mode-grid' },
            { screen: 'foodCategorySelect', gridId: 'foodCategoryGrid', selector: null }
        ];
        byId.forEach(function (entry) {
            var gridEl = entry.gridId
                ? documentRef.getElementById(entry.gridId)
                : documentRef.querySelector(entry.selector);
            if (gridEl) attachGrid(entry.screen, gridEl, {
                cardSelector: '.category-btn',
                onConfirm: confirm
            });
        });
    }

    // ------------------------------------------------------------------
    // Help box
    // ------------------------------------------------------------------

    function getHelpHtml() {
        var section = function (label) {
            return '<div class="help-section">' + label + '</div>';
        };
        var line = function (keys, text) {
            return '<div class="help-line"><span class="help-key">' + keys +
                '</span> ' + text + '</div>';
        };
        return '<div class="help-heading">⌨️ 鍵盤操作</div>' +
            section('遊戲內') +
            line('J / K', '— 按左 / 右按鈕（如：相同 / 不相同、Go / 不Go）') +
            line('← ↑ ↓ →', '— 移動選擇') +
            line('Enter / Space', '— 確認選擇') +
            line('P', '— 開始 / 暫停') +
            line('Esc', '— 返回') +
            section('選單') +
            line('← →', '— 移動選擇') +
            line('Enter', '— 開啟') +
            line('Esc', '— 返回') +
            section('手掌遊戲') +
            line('← / →', '— 下一張') +
            line('P', '— 開始 / 暫停') +
            line('S', '— 左右交換');
    }

    function showHelp() {
        if (!global.CognitiveMessage ||
            typeof global.CognitiveMessage.show !== 'function') return;
        global.CognitiveMessage.show({
            title: getHelpHtml(),
            titleHtml: true,
            textClass: 'help-list',
            subtitle: '',
            pauseTimer: false,
            buttons: [{ text: '知道了', className: 'btn-stay' }]
        });
    }

    // ------------------------------------------------------------------
    // API
    // ------------------------------------------------------------------

    function start() {
        if (documentRef && typeof documentRef.addEventListener === 'function') {
            documentRef.addEventListener('keydown', handleKeydown);
        }
        enableMenuNavigation();
    }

    var api = {
        normalizeKey: normalizeKey,
        isTypingTarget: isTypingTarget,
        resolveGlobalAction: resolveGlobalAction,
        findNeighborIndex: findNeighborIndex,
        registerScreen: registerScreen,
        attachGrid: attachGrid,
        start: start,
        showHelp: showHelp
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof global !== 'undefined') {
        global.CognitiveKeyboard = api;
    }

    // Attach the dispatcher and menu grids when running in a browser. In Node
    // (unit tests) documentRef is null, so this is a no-op.
    start();
})(typeof window !== 'undefined' ? window : globalThis);