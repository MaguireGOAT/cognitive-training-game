(function (global) {
    'use strict';

    function createSessionEngine(scheduler) {
        var schedule = (scheduler && scheduler.schedule) || function (fn, ms) {
            return setTimeout(fn, ms);
        };
        var cancel = (scheduler && scheduler.cancel) || function (handle) {
            if (handle !== null && handle !== undefined) {
                clearTimeout(handle);
            }
        };
        var now = (scheduler && scheduler.now) || function () {
            return Date.now();
        };

        var api = {};
        var mode = null;
        var options = null;
        var status = 'idle';
        var timerHandle = null;
        var startTime = 0;
        var elapsedMs = 0;
        var hiddenAutoResume = false;

        function fire(name) {
            if (options && typeof options[name] === 'function') {
                options[name]();
            }
        }

        function clearTimer() {
            if (timerHandle !== null) {
                cancel(timerHandle);
                timerHandle = null;
            }
        }

        function stopInternal() {
            clearTimer();
            status = 'idle';
            mode = null;
            options = null;
            elapsedMs = 0;
            hiddenAutoResume = false;
        }

        function scheduleTimer(ms, callback) {
            clearTimer();
            timerHandle = schedule(function () {
                timerHandle = null;
                callback();
            }, ms);
        }

        function onCountdownTick() {
            if (status !== 'running' || mode !== 'countdown') return;
            fire('tick');
            if (api.remaining <= 0) {
                elapsedMs += Math.max(0, now() - startTime);
                clearTimer();
                status = 'complete';
                hiddenAutoResume = false;
                var onComplete = options.onComplete;
                if (typeof onComplete === 'function') onComplete();
                return;
            }
            scheduleTimer(options.tickIntervalMs || 1000, onCountdownTick);
        }

        function onRepeatingTick() {
            if (status !== 'running' || mode !== 'repeating') return;
            fire('tick');
            scheduleTimer(options.intervalMs, onRepeatingTick);
        }

        function start(config) {
            stopInternal();
            if (!config || typeof config !== 'object') {
                throw new Error('CognitiveSession.start() requires an options object.');
            }
            mode = config.mode;
            if (mode !== 'countdown' && mode !== 'repeating' && mode !== 'manual') {
                throw new Error('CognitiveSession.start() received an unknown mode: ' + mode);
            }
            if (mode === 'countdown' && (!isFinite(config.durationMs) || config.durationMs <= 0)) {
                throw new Error('CognitiveSession countdown mode requires a positive durationMs.');
            }
            if (mode === 'repeating' && (!isFinite(config.intervalMs) || config.intervalMs <= 0)) {
                throw new Error('CognitiveSession repeating mode requires a positive intervalMs.');
            }
            if (mode === 'repeating' && typeof config.tick !== 'function') {
                throw new Error('CognitiveSession repeating mode requires a tick callback.');
            }
            options = config;
            status = 'running';
            startTime = now();
            fire('onStart');
            if (mode === 'countdown') {
                scheduleTimer(options.tickIntervalMs || 1000, onCountdownTick);
            } else if (mode === 'repeating') {
                scheduleTimer(options.intervalMs, onRepeatingTick);
            }
            return api;
        }

        function enterPaused(auto) {
            if (status !== 'running') return false;
            if (mode === 'countdown' || mode === 'repeating') {
                elapsedMs += Math.max(0, now() - startTime);
            } else {
                elapsedMs = 0;
            }
            clearTimer();
            status = 'paused';
            hiddenAutoResume = auto;
            fire('onPause');
            return true;
        }

        function pause() {
            return enterPaused(false);
        }

        function resume() {
            if (status !== 'paused') return false;
            status = 'running';
            hiddenAutoResume = false;
            startTime = now();
            if (mode === 'countdown') {
                scheduleTimer(options.tickIntervalMs || 1000, onCountdownTick);
            } else if (mode === 'repeating') {
                scheduleTimer(options.intervalMs, onRepeatingTick);
            }
            fire('onResume');
            return true;
        }

        function stop() {
            if (status === 'idle') return false;
            stopInternal();
            return true;
        }

        function advance() {
            if (status !== 'running' || mode !== 'manual') return false;
            if (typeof options.onAdvance === 'function') {
                options.onAdvance();
                return true;
            }
            if (typeof options.tick === 'function') {
                options.tick();
                return true;
            }
            return false;
        }

        api.start = start;
        api.pause = pause;
        api.resume = resume;
        api.stop = stop;
        api.advance = advance;

        Object.defineProperty(api, 'running', {
            get: function () {
                return status === 'running';
            }
        });
        Object.defineProperty(api, 'paused', {
            get: function () {
                return status === 'paused';
            }
        });
        Object.defineProperty(api, 'elapsed', {
            get: function () {
                if (status === 'idle' || mode === 'manual') return 0;
                var extra = status === 'running' ? Math.max(0, now() - startTime) : 0;
                return elapsedMs + extra;
            }
        });
        Object.defineProperty(api, 'remaining', {
            get: function () {
                if (mode !== 'countdown' || status === 'idle') return null;
                return Math.max(0, options.durationMs - api.elapsed);
            }
        });

        if (typeof document !== 'undefined' &&
            typeof document.addEventListener === 'function') {
            document.addEventListener('visibilitychange', function () {
                if (document.hidden) {
                    if (status === 'running') enterPaused(true);
                } else if (hiddenAutoResume) {
                    hiddenAutoResume = false;
                    if (status === 'paused') resume();
                }
            });
        }

        return api;
    }

    var session = createSessionEngine();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            CognitiveSession: session,
            createSessionEngine: createSessionEngine
        };
    }

    if (typeof window !== 'undefined') {
        window.CognitiveSession = session;
    }
})(typeof window !== 'undefined' ? window : globalThis);
