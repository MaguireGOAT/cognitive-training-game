        // ---- 音效 ----
        let audioCtx = null;
        const bgAudio = (window.CognitiveAudio && window.CognitiveAudio.bg) || null;
        let bgMusicEnabled = !!(window.CognitiveSettings && window.CognitiveSettings.music);
        let sfxEnabled = !!(window.CognitiveSettings && window.CognitiveSettings.sfx);

        function syncAudioSettings() {
            if (!window.CognitiveSettings) return;
            bgMusicEnabled = window.CognitiveSettings.music;
            sfxEnabled = window.CognitiveSettings.sfx;
        }
        document.addEventListener('cognitive-settings-changed', syncAudioSettings);

        function initAudio() {
            if (!audioCtx) audioCtx = new(window.AudioContext || window.webkitAudioContext)();
            return audioCtx;
        }

        function playTone(freq, duration, type = 'sine', volume = 0.25) {
            if (!sfxEnabled) return;
            try {
                const ctx = initAudio();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type;
                osc.frequency.value = freq;
                gain.gain.value = volume;
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + duration);
            } catch (e) {}
        }

        function playCorrectSound() { playTone(880, 0.12, 'sine', 0.2);
            setTimeout(() => playTone(1100, 0.12, 'sine', 0.2), 130); }

        function playWrongSound() { playTone(300, 0.3, 'sawtooth', 0.12); }

        // ---- 側滑選單音效控制 ----
        function toggleBgMusic() {
            if (window.CognitiveSettings) {
                window.CognitiveSettings.setMusic(!window.CognitiveSettings.music);
            }
        }

        function toggleSfx() {
            if (window.CognitiveSettings) {
                window.CognitiveSettings.setSfx(!window.CognitiveSettings.sfx);
            }
        }
