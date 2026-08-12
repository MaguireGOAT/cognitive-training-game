(function () {
    'use strict';

    var screens = Array.prototype.slice.call(document.querySelectorAll('.app-screen'));
    var stack = [];
    var currentScreen = null;
    var enterHooks = {};
    var exitHooks = {};
    var initialized = false;

    function findScreen(id) {
        return screens.filter(function (screen) {
            return screen.id === id;
        })[0] || null;
    }

    function setVisibility(id) {
        screens.forEach(function (screen) {
            screen.classList.toggle('hidden', screen.id !== id);
        });
    }

    function updateChrome() {
        var homeBtn = document.getElementById('slideHomeBtn');
        if (homeBtn) {
            homeBtn.classList.toggle('hidden', currentScreen === 'home');
        }
        var menu = document.getElementById('slideMenu');
        if (menu) {
            menu.classList.remove('open');
        }
    }

    function show(id) {
        if (currentScreen && exitHooks[currentScreen]) {
            exitHooks[currentScreen]();
        }
        currentScreen = id;
        setVisibility(id);
        updateChrome();
        if (enterHooks[id]) {
            enterHooks[id]();
        }
        if (typeof window.syncTopBarCentering === 'function') {
            window.syncTopBarCentering();
        }
    }

    function navigate(id) {
        if (!findScreen(id)) {
            return;
        }
        if (stack.length > 0 && stack[stack.length - 1] === id) {
            show(id);
            return;
        }
        stack.push(id);
        show(id);
    }

    function replace(id) {
        if (!findScreen(id)) {
            return;
        }
        if (stack.length === 0) {
            stack.push(id);
        } else {
            stack[stack.length - 1] = id;
        }
        show(id);
    }

    function goBack() {
        if (stack.length > 1) {
            stack.pop();
            show(stack[stack.length - 1]);
            return;
        }
        stack = ['home'];
        show('home');
    }

    function goHome() {
        stack = ['home'];
        show('home');
    }

    function registerEnter(id, fn) {
        enterHooks[id] = fn;
    }

    function registerExit(id, fn) {
        exitHooks[id] = fn;
    }

    function initialize(id) {
        if (initialized) {
            show(id);
            return;
        }
        initialized = true;
        stack = [id];
        show(id);
    }

    function getCurrent() {
        return currentScreen;
    }

    window.CognitiveRouter = {
        navigate: navigate,
        replace: replace,
        goBack: goBack,
        goHome: goHome,
        registerEnter: registerEnter,
        registerExit: registerExit,
        initialize: initialize,
        getCurrent: getCurrent
    };
})();
