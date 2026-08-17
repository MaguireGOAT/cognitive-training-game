// ---- Activity Timing Controller ----
// Owns speed→interval mapping and repeating-timer lifecycle for games.
// Shopping countdown timer is handled separately.
(function (global) {
    'use strict';

    function createActivity(config) {
        config = config || {};
        var timer = global.CognitiveActivityTimer.create();

        var minInterval = config.minInterval || 500;
        var maxInterval = config.maxInterval || 3000;
        var speedSteps = config.speedSteps || 10;
        var onTick = config.tick || function () {};
        var onPauseCb = config.onPause || function () {};
        var onResumeCb = config.onResume || function () {};
        var onCompleteCb = config.onComplete || function () {};

        var customIntervalFn = config.speedToInterval || null;

        var playing = false;
        var speed = config.defaultSpeed || 5;

        function intervalForSpeed(s) {
            if (customIntervalFn) return customIntervalFn(s);
            var factor = (s - 1) / (speedSteps - 1);
            return maxInterval - factor * (maxInterval - minInterval);
        }

        function startSession() {
            timer.start({
                mode: 'repeating',
                intervalMs: intervalForSpeed(speed),
                tick: function () {
                    if (playing) onTick();
                },
                onPause: onPauseCb,
                onResume: onResumeCb,
                onComplete: onCompleteCb
            });
        }

        function start(s) {
            if (typeof s === 'number') speed = s;
            playing = true;
            startSession();
        }

        function setSpeed(s) {
            speed = s;
        }

        function reset() {
            if (!playing) return;
            startSession();
        }

        function restart() {
            if (!playing) return;
            timer.restart(intervalForSpeed(speed));
        }

        function hold() {
            timer.stop();
        }

        function pause() {
            timer.pause();
        }

        function resume() {
            timer.resume();
        }

        function stop() {
            playing = false;
            timer.stop();
        }

        return {
            start: start,
            setSpeed: setSpeed,
            reset: reset,
            restart: restart,
            hold: hold,
            pause: pause,
            resume: resume,
            stop: stop,
            getInterval: intervalForSpeed,
            isPlaying: function () { return playing; },
            isRunning: function () { return timer.isRunning(); },
            isPaused: function () { return timer.isPaused(); },
            isActive: function () { return timer.isActive(); }
        };
    }

    if (typeof window !== 'undefined') {
        window.CognitiveActivity = { create: createActivity };
    }
})(typeof window !== 'undefined' ? window : globalThis);
