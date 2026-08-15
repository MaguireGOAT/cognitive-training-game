import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createAudioEngine } = require('../js/food/audio.js');

function createStorage(initial) {
    const data = new Map(Object.entries(initial || {}));
    return {
        getItem: key => data.has(key) ? data.get(key) : null,
        setItem: (key, value) => data.set(key, value),
        snapshot: () => Object.fromEntries(data)
    };
}

function createToneContext() {
    const oscillators = [];
    const context = {
        currentTime: 0,
        destination: {},
        createOscillator() {
            const oscillator = {
                type: '',
                frequency: { value: 0 },
                connect() {},
                start() {},
                stop() {}
            };
            oscillators.push(oscillator);
            return oscillator;
        },
        createGain() {
            return {
                gain: {
                    value: 0,
                    exponentialRampToValueAtTime() {}
                },
                connect() {}
            };
        }
    };
    return { context, oscillators };
}

function createAdapters(overrides) {
    const storage = overrides && overrides.storage
        ? overrides.storage
        : createStorage();
    const tone = createToneContext();
    const players = [];
    const background = {
        loop: false,
        volume: 1,
        paused: true,
        play() {
            this.paused = false;
            return Promise.resolve();
        },
        pause() {
            this.paused = true;
        }
    };

    return {
        storage,
        tone,
        players,
        background,
        adapters: {
            storage,
            schedule: () => 1,
            cancel: () => {},
            createToneContext: () => tone.context,
            createFilePlayer: src => {
                const player = {
                    src,
                    volume: 1,
                    preservesPitch: false,
                    playbackRate: 1,
                    paused: true,
                    currentTime: 0,
                    play() {
                        this.paused = false;
                        return Promise.resolve();
                    },
                    pause() {
                        this.paused = true;
                    }
                };
                players.push(player);
                return player;
            },
            getBackgroundAudio: () => background
        }
    };
}

test('sound intents use the tone adapter while sfx is enabled', function () {
    const fixture = createAdapters();
    const audio = createAudioEngine(fixture.adapters);

    audio.play('correct');
    audio.play('wrong');

    assert.equal(audio.getSfxEnabled(), true);
    assert.equal(fixture.tone.oscillators.length, 2);
});

test('disabling sfx persists the setting and blocks tone playback', function () {
    const fixture = createAdapters();
    const audio = createAudioEngine(fixture.adapters);

    audio.setSfxEnabled(false);
    audio.play('correct');

    assert.equal(audio.getSfxEnabled(), false);
    assert.equal(fixture.storage.snapshot().cognitiveAppSfx, 'false');
    assert.equal(fixture.tone.oscillators.length, 0);
});

test('music setting pauses and resumes the background adapter', function () {
    const fixture = createAdapters();
    const audio = createAudioEngine(fixture.adapters);

    audio.setMusicEnabled(false);
    assert.equal(fixture.background.paused, true);
    assert.equal(fixture.storage.snapshot().cognitiveAppMusic, 'false');

    audio.setMusicEnabled(true);
    assert.equal(fixture.background.paused, false);
});

test('file playback applies options and can be stopped', function () {
    const fixture = createAdapters();
    const audio = createAudioEngine(fixture.adapters);

    const player = audio.playFile('assets/audio/sample.mp3', {
        volume: 0.5,
        playbackRate: 1,
        preservesPitch: true
    });

    assert.equal(player, fixture.players[0]);
    assert.equal(player.volume, 0.5);
    assert.equal(player.playbackRate, 1);
    assert.equal(player.preservesPitch, true);
    assert.equal(player.paused, false);

    audio.stopFile();
    assert.equal(player.paused, true);
    assert.equal(player.currentTime, 0);
});

test('file playback honors sfx unless bypassSfx is requested', function () {
    const fixture = createAdapters();
    const audio = createAudioEngine(fixture.adapters);

    audio.setSfxEnabled(false);
    assert.equal(audio.playFile('assets/audio/sample.mp3'), null);

    const forced = audio.playFile('assets/audio/sample.mp3', { bypassSfx: true });
    assert.equal(forced, fixture.players[0]);
    assert.equal(forced.paused, false);
});

test('syncFromStorage restores persisted audio preferences', function () {
    const storage = createStorage({
        cognitiveAppMusic: 'false',
        cognitiveAppSfx: 'false'
    });
    const fixture = createAdapters({ storage });
    const audio = createAudioEngine(fixture.adapters);

    assert.equal(audio.getMusicEnabled(), false);
    assert.equal(audio.getSfxEnabled(), false);
    assert.equal(fixture.background.paused, true);
});
