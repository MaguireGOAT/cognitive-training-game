        (function () {
            'use strict';

            function load(key, defaults, allowed) {
                var settings = Object.assign({}, defaults);
                try {
                    var raw = localStorage.getItem(key);
                    if (raw) {
                        var parsed = JSON.parse(raw);
                        Object.keys(allowed).forEach(function (field) {
                            if (parsed[field] === undefined) return;
                            var value = parsed[field];
                            var rule = allowed[field];
                            var valid = Array.isArray(rule)
                                ? rule.indexOf(value) !== -1
                                : typeof value === rule;
                            if (valid) settings[field] = value;
                        });
                    }
                } catch (e) {
                    // 保留預設值
                }
                return settings;
            }

            function save(key, settings) {
                try {
                    localStorage.setItem(key, JSON.stringify(settings));
                    return true;
                } catch (e) {
                    return false;
                }
            }

            window.CognitivePrefs = {
                load: load,
                save: save
            };
        })();
