(function (global) {
    'use strict';

    var MUSIC_KEY = 'cognitiveAppMusic';
    var SFX_KEY = 'cognitiveAppSfx';

    function createAudioEngine(adapters) {
        adapters = adapters || {};
        var storage = adapters.storage ||
            (typeof window !== 'undefined' ? window.localStorage : null);
        var settingsStore = adapters.settingsStore ||
            (typeof window !== 'undefined' ? window.CognitiveSettingsStore : null);
        var schedule = adapters.schedule || function (fn, ms) {
            return setTimeout(fn, ms);
        };
        var cancel = adapters.cancel || function (handle) {
            if (handle !== null && handle !== undefined) {
                clearTimeout(handle);
            }
        };
        var createToneContext = adapters.createToneContext || function () {
            return new (window.AudioContext || window.webkitAudioContext)();
        };
        var createFilePlayer = adapters.createFilePlayer || function (src) {
            return new Audio(src);
        };
        var getBackgroundAudio = adapters.getBackgroundAudio || function () {
            if (typeof document === 'undefined') return null;
            return document.getElementById('appBgAudio');
        };

        var settings = {
            music: true,
            sfx: true
        };
        var toneContext = null;
        var backgroundAudio = null;
        var activeFilePlayer = null;
        var toneTimer = null;

        function readFlag(key, fallback) {
            if (!storage) return fallback;
            try {
                var value = storage.getItem(key);
                if (value === null) return fallback;
                return value !== 'false';
            } catch (error) {
                return fallback;
            }
        }

        function writeFlag(key, value) {
            if (!storage) return;
            try {
                storage.setItem(key, String(value));
            } catch (error) {}
        }

        function syncFromStorage() {
            if (settingsStore) {
                settings.music = settingsStore.load(MUSIC_KEY).music;
                settings.sfx = settingsStore.load(SFX_KEY).sfx;
            } else {
                settings.music = readFlag(MUSIC_KEY, true) !== false;
                settings.sfx = readFlag(SFX_KEY, true) !== false;
            }
            if (!settings.music) pauseMusic();
            return {
                music: settings.music,
                sfx: settings.sfx
            };
        }

        function setMusicEnabled(value) {
            settings.music = !!value;
            if (settingsStore) {
                settingsStore.save(MUSIC_KEY, { music: settings.music });
            } else {
                writeFlag(MUSIC_KEY, settings.music);
            }
            if (settings.music) {
                playMusic();
            } else {
                pauseMusic();
            }
        }

        function setSfxEnabled(value) {
            settings.sfx = !!value;
            if (settingsStore) {
                settingsStore.save(SFX_KEY, { sfx: settings.sfx });
            } else {
                writeFlag(SFX_KEY, settings.sfx);
            }
        }

        function getMusicEnabled() {
            return settings.music;
        }

        function getSfxEnabled() {
            return settings.sfx;
        }

        function initToneContext() {
            if (!toneContext) toneContext = createToneContext();
            return toneContext;
        }

        function playTone(freq, duration, type, volume) {
            if (!settings.sfx) return;
            try {
                var ctx = initToneContext();
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = type;
                osc.frequency.value = freq;
                gain.gain.value = volume;
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + duration);
            } catch (error) {}
        }

        function play(intent) {
            if (intent === 'correct') {
                playTone(880, 0.12, 'sine', 0.2);
                if (toneTimer) cancel(toneTimer);
                toneTimer = schedule(function () {
                    toneTimer = null;
                    playTone(1100, 0.12, 'sine', 0.2);
                }, 130);
                return true;
            }
            if (intent === 'wrong') {
                playTone(300, 0.3, 'sawtooth', 0.12);
                return true;
            }
            return false;
        }

        function getBackground() {
            if (!backgroundAudio) backgroundAudio = getBackgroundAudio();
            if (backgroundAudio) {
                backgroundAudio.loop = true;
                backgroundAudio.volume = 0.3;
            }
            return backgroundAudio;
        }

        function playMusic() {
            if (!settings.music) return false;
            var audio = getBackground();
            if (!audio) return false;
            var promise = audio.play();
            if (promise && typeof promise.catch === 'function') {
                promise.catch(function () {});
            }
            return true;
        }

        function pauseMusic() {
            var audio = getBackground();
            if (!audio) return false;
            audio.pause();
            return true;
        }

        function playFile(src, options) {
            options = options || {};
            if (!settings.sfx && !options.bypassSfx) return null;
            stopFile();
            var audio = createFilePlayer(src);
            if (!audio) return null;
            audio.volume = options.volume === undefined ? 1 : options.volume;
            audio.preservesPitch = options.preservesPitch !== false;
            if (options.playbackRate !== undefined) {
                audio.playbackRate = options.playbackRate;
            }
            try {
                var promise = audio.play && audio.play();
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(function () {});
                }
            } catch (error) {}
            activeFilePlayer = audio;
            return audio;
        }

        function stopFile() {
            if (activeFilePlayer) {
                if (typeof activeFilePlayer.pause === 'function') {
                    activeFilePlayer.pause();
                }
                if ('currentTime' in activeFilePlayer) {
                    activeFilePlayer.currentTime = 0;
                }
                activeFilePlayer = null;
            }
        }

        var api = {
            bg: getBackground(),
            syncFromStorage: syncFromStorage,
            setMusicEnabled: setMusicEnabled,
            setSfxEnabled: setSfxEnabled,
            getMusicEnabled: getMusicEnabled,
            getSfxEnabled: getSfxEnabled,
            play: play,
            playFile: playFile,
            stopFile: stopFile,
            playMusic: playMusic,
            pauseMusic: pauseMusic
        };

        syncFromStorage();
        return api;
    }

    var audio = createAudioEngine();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            CognitiveAudio: audio,
            createAudioEngine: createAudioEngine
        };
    }

    if (typeof window !== 'undefined') {
        window.CognitiveAudio = audio;
    }
})(typeof window !== 'undefined' ? window : globalThis);
