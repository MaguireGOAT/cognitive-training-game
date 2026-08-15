(function () {
    'use strict';

    function load(key) {
        return window.CognitiveSettingsStore
            ? CognitiveSettingsStore.load(key)
            : null;
    }

    function save(key, patch) {
        return window.CognitiveSettingsStore
            ? CognitiveSettingsStore.save(key, patch)
            : false;
    }

    window.CognitivePrefs = {
        load: load,
        save: save
    };
})();
