(function (global) {
    'use strict';

    var DEFAULT_MATCH_PROBABILITY = 0.25;

    function pickRandom(choices, random) {
        return choices[Math.floor(random() * choices.length)];
    }

    function generateStream(options) {
        var choices = options.choices;
        var n = options.n;
        var length = options.length;
        var matchProbability = options.matchProbability;
        var cloneValue = options.cloneValue || function (value) {
            return value;
        };
        var random = options.random || Math.random;

        if (matchProbability === undefined || matchProbability === null) {
            matchProbability = DEFAULT_MATCH_PROBABILITY;
        }

        var sequence = [];
        for (var i = 0; i < length; i++) {
            if (i < n) {
                sequence[i] = cloneValue(pickRandom(choices, random));
                continue;
            }
            if (random() < matchProbability) {
                sequence[i] = cloneValue(sequence[i - n]);
                continue;
            }
            sequence[i] = cloneValue(pickRandom(choices, random));
        }
        return sequence;
    }

    var api = {
        matchProbability: DEFAULT_MATCH_PROBABILITY,
        generateStream: generateStream
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            CognitiveSequence: api,
            generateStream: generateStream,
            matchProbability: DEFAULT_MATCH_PROBABILITY
        };
    }

    if (typeof window !== 'undefined') {
        window.CognitiveSequence = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
