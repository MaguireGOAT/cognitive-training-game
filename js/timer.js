(function (global) {
    'use strict';

    var activeTimer = null;

    function createTimer(options) {
        options = options || {};
        var scheduler = options.scheduler || {};
        var schedule = scheduler.schedule || function (fn, ms) {
            return setTimeout(fn, ms);
        };
        var cancel = scheduler.cancel || function (handle) {
            if (handle !== null && handle !== undefined) {
                clearTimeout(handle);
            }
        };
        var now = scheduler.now || function () {
            return Date.now();
        };

        var mode = options.mode || 'repeating';
        var intervalMs = options.intervalMs;
        var durationMs = options.durationMs;
        var tickIntervalMs = options.tickIntervalMs || 1000;
        var tick = options.tick;
        var callbacks = {
            onStart: options.onStart,
            onPause: options.onPause,
            onResume: options.onResume,
            onComplete: options.onComplete
        };

        var status = 'idle';
        var timerHandle = null;
        var pauseHandle = null;
        var startTime = 0;
        var elapsedMs = 0;
        var pendingInterval = null;

        function fire(name) {
            if (typeof callbacks[name] === 'function') {
                callbacks[name]();
            }
        }

        function clearTimerHandle() {
            if (timerHandle !== null) {
                cancel(timerHandle);
                timerHandle = null;
            }
        }

        function clearPauseHandle() {
            if (pauseHandle !== null) {
                cancel(pauseHandle);
                pauseHandle = null;
            }
        }

        function unregister() {
            if (activeTimer === timerApi) {
                activeTimer = null;
            }
        }

        function complete() {
            clearTimerHandle();
            clearPauseHandle();
            status = 'idle';
            elapsedMs = 0;
            pendingInterval = null;
            unregister();
            fire('onComplete');
        }

        function tickInternal() {
            timerHandle = null;
            if (status !== 'running') return;

            if (mode === 'countdown') {
                if (typeof tick === 'function') tick();
                var elapsed = elapsedMs + Math.max(0, now() - startTime);
                if (elapsed >= durationMs) {
                    elapsedMs = durationMs;
                    complete();
                    return;
                }
                elapsedMs = elapsed;
                scheduleNext();
                return;
            }

            if (typeof tick === 'function') tick();
            scheduleNext();
        }

        function scheduleNext() {
            clearTimerHandle();
            if (status !== 'running') return;

            if (mode === 'repeating') {
                timerHandle = schedule(tickInternal, intervalMs);
            } else if (mode === 'countdown') {
                var remaining = Math.max(0, durationMs - elapsedMs);
                if (remaining <= 0) {
                    complete();
                    return;
                }
                timerHandle = schedule(tickInternal, Math.min(tickIntervalMs, remaining));
            }
        }

        function startInternal() {
            if (activeTimer && activeTimer !== timerApi && typeof activeTimer.stop === 'function') {
                activeTimer.stop();
            }
            clearPauseHandle();
            status = 'running';
            startTime = now();
            elapsedMs = 0;
            pendingInterval = null;
            activeTimer = timerApi;
            fire('onStart');
            scheduleNext();
        }

        function start(config) {
            if (config && typeof config === 'object') {
                if (config.mode) mode = config.mode;
                if (config.intervalMs !== undefined) intervalMs = config.intervalMs;
                if (config.durationMs !== undefined) durationMs = config.durationMs;
                if (config.tickIntervalMs !== undefined) tickIntervalMs = config.tickIntervalMs;
                if (config.tick !== undefined) tick = config.tick;
                ['onStart', 'onPause', 'onResume', 'onComplete'].forEach(function (name) {
                    if (config[name] !== undefined) callbacks[name] = config[name];
                });
            }
            clearTimerHandle();
            startInternal();
            return timerApi;
        }

        function restart(newIntervalMs) {
            if (typeof newIntervalMs === 'number' && isFinite(newIntervalMs) && newIntervalMs > 0) {
                intervalMs = newIntervalMs;
            }
            if (status === 'paused') {
                pendingInterval = intervalMs;
                return timerApi;
            }
            return start();
        }

        function pause() {
            if (status !== 'running') return false;
            clearTimerHandle();
            elapsedMs += Math.max(0, now() - startTime);
            status = 'paused';
            fire('onPause');
            return true;
        }

        function resume() {
            if (status !== 'paused') return false;
            clearPauseHandle();
            if (mode === 'repeating' && pendingInterval !== null) {
                intervalMs = pendingInterval;
            }
            pendingInterval = null;
            status = 'running';
            startTime = now();
            scheduleNext();
            fire('onResume');
            return true;
        }

        function stop() {
            var wasActive = status !== 'idle';
            clearTimerHandle();
            clearPauseHandle();
            status = 'idle';
            elapsedMs = 0;
            pendingInterval = null;
            unregister();
            return wasActive;
        }

        function pauseFor(ms, callback) {
            clearPauseHandle();
            if (status === 'running') pause();
            pauseHandle = schedule(function () {
                pauseHandle = null;
                if (typeof callback === 'function') callback();
                if (status === 'paused') resume();
            }, ms);
            return timerApi;
        }

        var timerApi = {
            start: start,
            restart: restart,
            pause: pause,
            resume: resume,
            pauseFor: pauseFor,
            stop: stop,
            isActive: function () {
                return status === 'running' || status === 'paused';
            },
            isRunning: function () {
                return status === 'running';
            },
            isPaused: function () {
                return status === 'paused';
            }
        };

        return timerApi;
    }

    function createPauseCoordinator() {
        var capturedTimer = null;
        return {
            pause: function () {
                capturedTimer = activeTimer;
                if (capturedTimer && typeof capturedTimer.pause === 'function') {
                    capturedTimer.pause();
                }
            },
            resume: function () {
                var timer = capturedTimer;
                capturedTimer = null;
                if (timer && typeof timer.resume === 'function') {
                    timer.resume();
                }
            }
        };
    }

    var api = {
        create: createTimer,
        createPauseCoordinator: createPauseCoordinator
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveActivityTimer = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
