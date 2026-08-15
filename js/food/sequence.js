(function (global) {
    'use strict';

    var DEFAULT_MATCH_PROBABILITY = 0.25;

    function pickRandom(choices, random) {
        return choices[Math.floor(random() * choices.length)];
    }

    function defaultKeyFor(value) {
        if (value && typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }

    function generateTrials(options) {
        var choices = options.choices;
        var n = options.n;
        var length = options.length;
        var matchProbability = options.matchProbability;
        var cloneValue = options.cloneValue || function (value) {
            return value;
        };
        var keyFor = options.keyFor || defaultKeyFor;
        var random = options.random || Math.random;

        if (matchProbability === undefined || matchProbability === null) {
            matchProbability = DEFAULT_MATCH_PROBABILITY;
        }

        var trials = [];
        for (var i = 0; i < length; i++) {
            if (i < n) {
                trials[i] = {
                    value: cloneValue(pickRandom(choices, random)),
                    isMatch: false
                };
                continue;
            }
            if (random() < matchProbability) {
                trials[i] = {
                    value: cloneValue(trials[i - n].value),
                    isMatch: true
                };
                continue;
            }

            var targetKey = keyFor(trials[i - n].value);
            var differentChoices = choices.filter(function (choice) {
                return keyFor(choice) !== targetKey;
            });

            if (!differentChoices.length) {
                trials[i] = {
                    value: cloneValue(trials[i - n].value),
                    isMatch: true
                };
            } else {
                trials[i] = {
                    value: cloneValue(pickRandom(differentChoices, random)),
                    isMatch: false
                };
            }
        }
        return trials;
    }

    var api = {
        matchProbability: DEFAULT_MATCH_PROBABILITY,
        generateTrials: generateTrials
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            CognitiveSequence: api,
            generateTrials: generateTrials,
            matchProbability: DEFAULT_MATCH_PROBABILITY
        };
    }

    if (typeof window !== 'undefined') {
        window.CognitiveSequence = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
