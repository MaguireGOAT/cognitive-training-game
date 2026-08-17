        // 雙重 N-back 遊戲
        // =============================================================

        const DUAL_NBACK_SEQUENCE_LENGTH = 50;

        const DUAL_CHANNEL_LABELS = {
            image: '圖片',
            position: '位置',
            color: '顏色',
            audio: '聲音'
        };

        const DUAL_POSITION_GRIDS = {
            '2x1': { cols: 2, rows: 1 },
            '3x1': { cols: 3, rows: 1 },
            '2x2': { cols: 2, rows: 2 },
            '3x2': { cols: 3, rows: 2 },
            '3x3': { cols: 3, rows: 3 }
        };

        const DUAL_COLOR_PALETTES = {
            '6': [
                { name: '紅色', css: '#e53935' },
                { name: '橙色', css: '#fb8c00' },
                { name: '黃色', css: '#fdd835' },
                { name: '綠色', css: '#43a047' },
                { name: '藍色', css: '#1e88e5' },
                { name: '紫色', css: '#8e24aa' }
            ],
            '3': [
                { name: '紅色', css: '#e53935' },
                { name: '綠色', css: '#43a047' },
                { name: '藍色', css: '#1e88e5' }
            ]
        };

        const dualNbackState = {
            channels: [],
            positionGrid: '3x3',
            colorPalette: '6',
            n: 1,
            speed: 5,
            audioRate: 1,
            isPlaying: false,
            sequences: {},
            currentIndex: -1,
            currentItems: {},
            matchLocked: {},
            score: 0,
            totalTrials: 0,
            interval: 0
        };

        const dualNbackGame = document.getElementById('dualNbackGame');
        const dualNbackSettings = document.getElementById('dualNbackSettings');
        const dualNbackModeSelect = document.getElementById('nbackModeSelect');
        const dualNbackStage = document.getElementById('dualNbackStage');
        const dualNbackGrid = document.getElementById('dualNbackGrid');
        const dualNbackCard = document.getElementById('dualNbackCard');
        const dualNbackImage = document.getElementById('dualNbackImage');
        const dualNbackScoreNum = document.getElementById('dualNbackScoreNum');
        const dualNbackPlayBtn = document.getElementById('dualNbackPlayBtn');
        const dualNbackSpeedDisplay = document.getElementById('dualNbackSpeedDisplay');
        const dualNbackSpeedDown = document.getElementById('dualNbackSpeedDown');
        const dualNbackSpeedUp = document.getElementById('dualNbackSpeedUp');
        const dualNbackNSelect = document.getElementById('dualNbackNSelect');
        const dualNbackMatchButtons = document.getElementById('dualNbackMatchButtons');
        const dualNbackBackBtn = document.getElementById('dualNbackBackBtn');
        const dualNbackSettingsBackBtn = document.getElementById('dualNbackSettingsBackBtn');
        const nbackModeBackBtn = document.getElementById('nbackModeBackBtn');
        const singleNbackBtn = document.getElementById('singleNbackBtn');
        const dualNbackBtn = document.getElementById('dualNbackBtn');

        const dualChannel1Select = document.getElementById('dualChannel1Select');
        const dualChannel2Select = document.getElementById('dualChannel2Select');
        const dualPositionSettings = document.getElementById('dualPositionSettings');
        const dualPositionGridSelect = document.getElementById('dualPositionGridSelect');
        const dualColorSettings = document.getElementById('dualColorSettings');
        const dualColorPaletteSelect = document.getElementById('dualColorPaletteSelect');
        const dualStartBtn = document.getElementById('dualStartBtn');

        let dualFeedbackTimer = null;
        const dualNbackTimer = window.CognitiveActivityTimer.create();

        function getDualFoodId(item) {
            return item.id || item.name;
        }

        function getDualChannelValue(channel, value) {
            if (channel === 'image' || channel === 'audio') return getDualFoodId(value);
            if (channel === 'color') return value.name;
            return value;
        }

        function cloneDualChannelValue(channel, value) {
            if (channel === 'image' || channel === 'audio') return value ? { ...value } : value;
            if (channel === 'color') return value ? { ...value } : value;
            return value;
        }

        function getDualChannelChoices(channel) {
            if (channel === 'image' || channel === 'audio') return FOOD_DATA;
            if (channel === 'position') {
                const grid = DUAL_POSITION_GRIDS[dualNbackState.positionGrid] || DUAL_POSITION_GRIDS['3x3'];
                return Array.from({ length: grid.cols * grid.rows }, (_, index) => index);
            }
            if (channel === 'color') {
                return DUAL_COLOR_PALETTES[dualNbackState.colorPalette] || DUAL_COLOR_PALETTES['6'];
            }
            return [];
        }

        function buildDualSequences() {
            dualNbackState.sequences = {};
            if (!window.CognitiveSequence) return;
            dualNbackState.channels.forEach(channel => {
                const choices = getDualChannelChoices(channel);
                dualNbackState.sequences[channel] = window.CognitiveSequence.generateTrials({
                    choices: choices,
                    n: dualNbackState.n,
                    length: DUAL_NBACK_SEQUENCE_LENGTH,
                    matchProbability: window.CognitiveSequence.matchProbability,
                    cloneValue: value => cloneDualChannelValue(channel, value),
                    keyFor: value => getDualChannelValue(channel, value)
                });
            });
        }

        function updateDualNbackInterval() {
            const maxDelay = 4000;
            const minDelay = 2000;
            const factor = (dualNbackState.speed - 1) / 9;
            dualNbackState.interval = maxDelay - factor * (maxDelay - minDelay);
        }

        function startDualNbackSession() {
            dualNbackTimer.start({
                mode: 'repeating',
                intervalMs: dualNbackState.interval,
                tick: function () {
                    if (dualNbackState.isPlaying) {
                        nextDualNbackTrial(true);
                    }
                },
                onPause: syncDualNbackSessionUi,
                onResume: syncDualNbackSessionUi
            });
        }

        function syncDualNbackPlayButton() {
            dualNbackPlayBtn.classList.toggle('playing', dualNbackState.isPlaying);
        }

        function syncDualNbackSessionUi() {
            const active = dualNbackState.isPlaying && dualNbackTimer.isRunning();
            dualNbackPlayBtn.classList.toggle('playing', active);
        }

        function resetDualNbackTimer() {
            if (!dualNbackState.isPlaying) return;
            updateDualNbackInterval();
            startDualNbackSession();
        }

        function holdDualNbackTimer() {
            dualNbackTimer.stop();
        }

        function getDualVisibleContent() {
            return dualNbackState.channels.indexOf('position') !== -1 ? dualNbackGrid : dualNbackCard;
        }

        function renderDualGrid() {
            const gridInfo = DUAL_POSITION_GRIDS[dualNbackState.positionGrid] || DUAL_POSITION_GRIDS['3x3'];
            const hasImage = dualNbackState.channels.indexOf('image') !== -1;
            const hasColor = dualNbackState.channels.indexOf('color') !== -1;
            const position = dualNbackState.currentItems.position || 0;
            const imageItem = dualNbackState.currentItems.image;
            const colorItem = dualNbackState.currentItems.color;

            dualNbackGrid.className = `dual-grid dual-grid-${dualNbackState.positionGrid}`;
            dualNbackGrid.style.setProperty('--grid-cols', gridInfo.cols);
            dualNbackGrid.style.setProperty('--grid-rows', gridInfo.rows);
            dualNbackGrid.innerHTML = '';

            for (let i = 0; i < gridInfo.cols * gridInfo.rows; i++) {
                const cell = document.createElement('div');
                cell.className = 'dual-grid-cell' + (i === position ? ' active' : '');
                if (i === position && hasImage && imageItem) {
                    const img = document.createElement('img');
                    img.src = imageItem.image;
                    img.alt = imageItem.name;
                    img.setAttribute('aria-label', imageItem.name);
                    cell.appendChild(img);
                } else if (i === position && hasColor && colorItem) {
                    cell.classList.add('color-cell');
                    cell.style.background = colorItem.css;
                } else if (i === position) {
                    cell.classList.add('position-only');
                }
                dualNbackGrid.appendChild(cell);
            }
        }

        function renderDualCard() {
            const hasImage = dualNbackState.channels.indexOf('image') !== -1;
            const hasColor = dualNbackState.channels.indexOf('color') !== -1;
            const imageItem = dualNbackState.currentItems.image;
            const colorItem = dualNbackState.currentItems.color;

            dualNbackCard.classList.toggle('color-card', hasColor);
            dualNbackCard.style.background = hasColor && colorItem ? colorItem.css : '';
            if (hasImage && imageItem) {
                dualNbackImage.style.display = 'block';
                dualNbackImage.src = imageItem.image;
                dualNbackImage.alt = imageItem.name;
                dualNbackImage.setAttribute('aria-label', imageItem.name);
            } else {
                dualNbackImage.style.display = 'none';
                dualNbackImage.removeAttribute('src');
                dualNbackImage.alt = '';
            }
        }

        function playDualNbackAudio() {
            if (dualNbackState.channels.indexOf('audio') === -1) return;
            const item = dualNbackState.currentItems.audio;
            if (!item || !window.CognitiveNbackAudioMap) return;
            const src = window.CognitiveNbackAudioMap[getDualFoodId(item)] ||
                        window.CognitiveNbackAudioMap[item.name];
            if (!src) return;
            CognitiveAudio.stopFile();
            // Edge clips are generated at 0.5x, so play them at normal speed.
            CognitiveAudio.playFile(src, {
                volume: 1,
                preservesPitch: true,
                playbackRate: dualNbackState.audioRate || 1,
                bypassSfx: true
            });
        }

        function commitDualNbackTrial(index, playAudio) {
            if (!dualNbackState.channels.length) return;
            dualNbackState.currentIndex = index;
            dualNbackState.currentItems = {};
            dualNbackState.matchLocked = {};

            dualNbackState.channels.forEach(channel => {
                const trial = dualNbackState.sequences[channel][index];
                dualNbackState.currentItems[channel] = trial ? trial.value : undefined;
                dualNbackState.matchLocked[channel] = false;
            });

            const showGrid = dualNbackState.channels.indexOf('position') !== -1;
            dualNbackGrid.classList.toggle('hidden', !showGrid);
            dualNbackCard.classList.toggle('hidden', showGrid);
            if (showGrid) {
                renderDualGrid();
            } else {
                renderDualCard();
            }
            if (playAudio) playDualNbackAudio();
        }

        function nextDualNbackTrial() {
            if (!dualNbackState.channels.length) return;
            holdDualNbackTimer();
            dualNbackState.currentIndex++;
            if (dualNbackState.currentIndex >= DUAL_NBACK_SEQUENCE_LENGTH) {
                buildDualSequences();
                dualNbackState.currentIndex = 0;
            }
            commitDualNbackTrial(dualNbackState.currentIndex, true);
            resetDualNbackTimer();
        }

        function pauseDual() {
            dualNbackTimer.pause();
            dualNbackState.isPlaying = false;
            syncDualNbackPlayButton();
            CognitiveAudio.stopFile();
            hideOverlay();
            window.CognitiveFeedback.clear(dualNbackStage);
        }

        function startDual() {
            if (dualNbackState.isPlaying) {
                pauseDual();
                return;
            }
            buildDualSequences();
            dualNbackState.currentIndex = 0;
            dualNbackState.score = 0;
            dualNbackState.totalTrials = 0;
            dualNbackState.isPlaying = true;
            syncDualNbackPlayButton();
            commitDualNbackTrial(0, true);
            updateDualNbackScore();
            resetDualNbackTimer();
        }

        function flashDualNbackFeedback(correct, channel) {
            const visible = getDualVisibleContent();
            visible.classList.remove('correct-highlight', 'wrong-flash');
            clearTimeout(dualFeedbackTimer);
            visible.classList.add(correct ? 'correct-highlight' : 'wrong-flash');
            dualFeedbackTimer = setTimeout(function() {
                visible.classList.remove('correct-highlight', 'wrong-flash');
            }, 600);

            const btn = dualNbackMatchButtons.querySelector(`[data-channel="${channel}"]`);
            if (!btn) return;
            btn.classList.remove('correct-highlight', 'wrong-flash');
            void btn.offsetWidth;
            btn.classList.add(correct ? 'correct-highlight' : 'wrong-flash');
            setTimeout(function() {
                btn.classList.remove('correct-highlight', 'wrong-flash');
            }, 600);
        }

        function handleDualNbackMatch(channel) {
            if (dualNbackState.currentIndex < 0 ||
                dualNbackState.matchLocked[channel]) return;

            const trial = dualNbackState.sequences[channel][dualNbackState.currentIndex];
            const correct = Boolean(trial && trial.isMatch);

            dualNbackState.matchLocked[channel] = true;
            dualNbackState.totalTrials++;
            if (correct) {
                dualNbackState.score++;
                CognitiveAudio.play('correct');
            } else {
                CognitiveAudio.play('wrong');
            }
            updateDualNbackScore();
            flashDualNbackFeedback(correct, channel);
            window.CognitiveFeedback.show(dualNbackStage, correct ? '✅ 正確！' : '❌ 再試一次！', correct ? '#3ba87b' : '#d95a5a');
        }

        function updateDualNbackScore() {
            dualNbackScoreNum.textContent = dualNbackState.score;
        }

        function changeDualNbackSpeed(delta) {
            let newSpeed = dualNbackState.speed + delta;
            if (newSpeed < 1) newSpeed = 1;
            if (newSpeed > 10) newSpeed = 10;
            dualNbackState.speed = newSpeed;
            dualNbackSpeedDisplay.textContent = newSpeed;
            if (dualNbackState.isPlaying) resetDualNbackTimer();
        }

        function showDualNbackInstruction() {
            const labels = dualNbackState.channels.map(channel => DUAL_CHANNEL_LABELS[channel]);
            window.CognitiveMessage.show({
                title: `看看${labels.join('和')}與上 ${dualNbackState.n} 張是否相同`,
                subtitle: '',
                extraLarge: true,
                pauseTimer: false
            });
        }

        function changeDualNbackN(newN) {
            if (newN === dualNbackState.n) return;
            const wasPlaying = dualNbackState.isPlaying;
            if (wasPlaying) pauseDual();
            dualNbackState.n = newN;
            dualNbackNSelect.value = String(newN);
            buildDualSequences();
            dualNbackState.currentIndex = 0;
            dualNbackState.score = 0;
            dualNbackState.totalTrials = 0;
            updateDualNbackScore();
            commitDualNbackTrial(0, false);
            showDualNbackInstruction();
        }

        function buildDualMatchButtons() {
            dualNbackMatchButtons.innerHTML = '';
            dualNbackState.channels.forEach(channel => {
                const btn = document.createElement('button');
                btn.className = 'dual-match-btn';
                btn.dataset.channel = channel;
                btn.textContent = DUAL_CHANNEL_LABELS[channel];
                btn.addEventListener('click', function() {
                    handleDualNbackMatch(channel);
                });
                dualNbackMatchButtons.appendChild(btn);
            });
        }

        function updateDualSettingsState() {
            const channel1 = dualChannel1Select.value;
            const channel2 = dualChannel2Select.value;
            const needsPosition = channel1 === 'position' || channel2 === 'position';
            const needsColor = channel1 === 'color' || channel2 === 'color';

            dualPositionSettings.classList.toggle('hidden', !needsPosition);
            dualColorSettings.classList.toggle('hidden', !needsColor);

            if (needsPosition && !dualPositionGridSelect.value) dualPositionGridSelect.value = '3x3';
            if (needsColor && !dualColorPaletteSelect.value) dualColorPaletteSelect.value = '6';

            const valid = Boolean(channel1 && channel2 && channel1 !== channel2 &&
                (!needsPosition || dualPositionGridSelect.value) &&
                (!needsColor || dualColorPaletteSelect.value));
            dualStartBtn.disabled = !valid;
            dualStartBtn.style.opacity = valid ? '1' : '0.45';
        }

        function startDualFromSettings() {
            const channel1 = dualChannel1Select.value;
            const channel2 = dualChannel2Select.value;
            if (!channel1 || !channel2 || channel1 === channel2) return;
            const needsPosition = channel1 === 'position' || channel2 === 'position';
            const needsColor = channel1 === 'color' || channel2 === 'color';
            if (needsPosition && !dualPositionGridSelect.value) return;
            if (needsColor && !dualColorPaletteSelect.value) return;

            dualNbackState.channels = [channel1, channel2];
            dualNbackState.n = parseInt(dualNbackNSelect.value, 10) || 1;
            dualNbackState.positionGrid = dualPositionGridSelect.value || '3x3';
            dualNbackState.colorPalette = dualColorPaletteSelect.value || '6';
            dualNbackState.audioRate = 1;
            dualNbackState.speed = 5;
            dualNbackSpeedDisplay.textContent = '5';
            dualNbackNSelect.value = String(dualNbackState.n);
            buildDualMatchButtons();

            if (window.CognitiveRouter) {
                window.CognitiveRouter.navigate('dualNbackGame');
            }
        }

        function prepareDualNbackGame() {
            if (!dualNbackState.channels.length) return;
            pauseDual();
            buildDualSequences();
            dualNbackState.currentIndex = 0;
            dualNbackState.score = 0;
            dualNbackState.totalTrials = 0;
            updateDualNbackScore();
            commitDualNbackTrial(0, false);
            showDualNbackInstruction();
        }

        dualNbackPlayBtn.addEventListener('click', startDual);

        dualNbackCard.addEventListener('click', function() {
            nextDualNbackTrial();
        });

        dualNbackGrid.addEventListener('click', function() {
            nextDualNbackTrial();
        });

        dualNbackSpeedDown.addEventListener('click', function() { changeDualNbackSpeed(-1); });
        dualNbackSpeedUp.addEventListener('click', function() { changeDualNbackSpeed(1); });

        dualNbackNSelect.addEventListener('change', function() {
            changeDualNbackN(parseInt(this.value, 10));
        });

        dualNbackBackBtn.addEventListener('click', function() {
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            }
        });

        dualNbackSettingsBackBtn.addEventListener('click', function() {
            if (window.CognitiveRouter) window.CognitiveRouter.goBack();
        });

        nbackModeBackBtn.addEventListener('click', function() {
            if (window.CognitiveRouter) window.CognitiveRouter.goBack();
        });

        singleNbackBtn.addEventListener('click', function() {
            if (window.CognitiveRouter) window.CognitiveRouter.navigate('nbackGame');
        });

        dualNbackBtn.addEventListener('click', function() {
            if (window.CognitiveRouter) window.CognitiveRouter.navigate('dualNbackSettings');
        });

        dualChannel1Select.addEventListener('change', updateDualSettingsState);
        dualChannel2Select.addEventListener('change', updateDualSettingsState);
        dualPositionGridSelect.addEventListener('change', updateDualSettingsState);
        dualColorPaletteSelect.addEventListener('change', updateDualSettingsState);
        dualStartBtn.addEventListener('click', startDualFromSettings);

        dualNbackSpeedDisplay.textContent = dualNbackState.speed;
        dualNbackNSelect.value = String(dualNbackState.n);
        updateDualSettingsState();

        if (window.CognitiveRouter) {
            window.CognitiveRouter.defineScreen('nbackModeSelect', {
                back: 'home'
            });
            window.CognitiveRouter.defineScreen('dualNbackSettings', {
                back: 'nbackModeSelect'
            });
            window.CognitiveRouter.defineScreen('dualNbackGame', {
                enter: prepareDualNbackGame,
                exit: pauseDual,
                back: 'dualNbackSettings'
            });
        }

        // =============================================================
