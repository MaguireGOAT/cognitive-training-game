        // 第四部分：Go/No Go 遊戲
        // =============================================================

        const gngState = {
            goCategory: '水果',
            noGoCategory: '全部',
            autoSwitch: false,
            switchType: 'swap',
            switchFreq: 10,
            imageCount: 1,
            speed: 5,
            isPlaying: false,
            sequence: [],
            currentIndex: -1,
            score: 0,
            totalTrials: 0,
            correctHits: 0,
            interval: 0,
            currentItems: [],
            matchPending: false,
            roundCounter: 0,
            timerPaused: false,
            messagePaused: false,
        };

        const gngGridContainer = document.getElementById('gngGridContainer');
        const gngGridWrapper = document.getElementById('gngGridWrapper');
        const gngScoreNum = document.getElementById('gngScoreNum');
        const gngGoLabel = document.getElementById('gngGoLabel');
        const gngNoGoLabel = document.getElementById('gngNoGoLabel');
        const gngRuleText = document.getElementById('gngRuleText');
        const gngPlayBtn = document.getElementById('gngPlayBtn');
        const gngSpeedDisplay = document.getElementById('gngSpeedDisplay');
        const gngSpeedDown = document.getElementById('gngSpeedDown');
        const gngSpeedUp = document.getElementById('gngSpeedUp');
        const gngGoBtn = document.getElementById('gngGoBtn');
        const gngNoGoBtn = document.getElementById('gngNoGoBtn');
        const gngBackBtn = document.getElementById('gngBackBtn');
        const gngSettingsBackBtn = document.getElementById('gngSettingsBackBtn');
        const gngGoCategory = document.getElementById('gngGoCategory');
        const gngNoGoCategory = document.getElementById('gngNoGoCategory');
        const gngAutoToggle = document.getElementById('gngAutoToggle');
        const gngSwitchType = document.getElementById('gngSwitchType');
        const gngSwitchFreq = document.getElementById('gngSwitchFreq');
        const gngStartBtn = document.getElementById('gngStartBtn');
        const gngSaveSettingsBtn = document.getElementById('gngSaveSettingsBtn');

        const gngPreferences = window.CognitivePrefs
            ? CognitivePrefs.load('cognitiveGngPrefs')
            : null;
        const gngActivity = window.CognitiveActivity.create({
            minInterval: 1000,
            maxInterval: 6000,
            speedSteps: 10,
            defaultSpeed: gngState.speed,
            tick: function () { if (gngState.isPlaying && !gngState.timerPaused) nextGngImage(); },
            onPause: syncGngSessionUi,
            onResume: syncGngSessionUi
        });

        function syncGngPlayButton() {
            gngPlayBtn.classList.toggle('playing', gngState.isPlaying);
        }

        function syncGngSessionUi() {
            gngState.messagePaused = gngActivity.isPaused() && !gngState.timerPaused;
            gngPlayBtn.classList.toggle('playing', gngState.isPlaying && (gngState.timerPaused || gngActivity.isRunning()));
        }

        function resetGngTimer() {
            if (!gngState.isPlaying || gngState.timerPaused) return;
            if (gngState.messagePaused && gngActivity.isPaused()) {
                gngActivity.restart();
                return;
            }
            gngActivity.reset();
        }

        function generateGngSequence(length = 50) {
            const { goCategories, noGoCategories } = getGngSignalCategories();
            const excludeIds = getAmbiguousGngFoodIds(goCategories, noGoCategories);
            const seq = [];
            for (let i = 0; i < length; i++) {
                const isGoTrial = noGoCategories.length === 0 || Math.random() < 0.5;
                const categoryPool = isGoTrial ? goCategories : noGoCategories;
                seq.push(pickGngTrialItems(categoryPool, gngState.imageCount, excludeIds));
            }
            return seq;
        }

        function getGngSignalCategories() {
            const goCat = gngState.goCategory;
            const noGoCat = gngState.noGoCategory;
            if (goCat === '全部' && noGoCat === '全部') {
                return { goCategories: CATEGORY_NAMES, noGoCategories: [] };
            }
            if (goCat === '全部') {
                return {
                    goCategories: CATEGORY_NAMES.filter(c => c !== noGoCat),
                    noGoCategories: [noGoCat],
                };
            }
            if (noGoCat === '全部') {
                return {
                    goCategories: [goCat],
                    noGoCategories: CATEGORY_NAMES.filter(c => c !== goCat),
                };
            }
            if (goCat === noGoCat) {
                return { goCategories: [goCat], noGoCategories: [] };
            }
            return { goCategories: [goCat], noGoCategories: [noGoCat] };
        }

        function getAmbiguousGngFoodIds(goCategories, noGoCategories) {
            const goSet = new Set(goCategories);
            const noGoSet = new Set(noGoCategories);
            const flagsByName = new Map();
            for (const item of FOOD_DATA) {
                if (!flagsByName.has(item.name)) flagsByName.set(item.name, { go: false, noGo: false });
                const flags = flagsByName.get(item.name);
                if (goSet.has(item.category)) flags.go = true;
                if (noGoSet.has(item.category)) flags.noGo = true;
            }
            const ambiguous = new Set();
            for (const item of FOOD_DATA) {
                const flags = flagsByName.get(item.name);
                if (flags.go && flags.noGo) ambiguous.add(getFoodId(item));
            }
            return ambiguous;
        }

        function pickGngTrialItems(categories, count, excludeIds) {
            const category = pickRandom(categories);
            const pool = FOOD_DATA.filter(item => item.category === category && !excludeIds.has(getFoodId(item)));
            const result = [];
            const remaining = pool.slice();
            for (let i = 0; i < count; i++) {
                if (remaining.length === 0) remaining.push(...pool);
                result.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
            }
            return result;
        }

        function getGngRule() {
            return { goCat: gngState.goCategory, noGoCat: gngState.noGoCategory };
        }

        function updateGngRuleDisplay(showPopup = false) {
            const { goCat, noGoCat } = getGngRule();
            const goDisplay = goCat === '全部' ? '全部' : goCat;
            const noGoDisplay = noGoCat === '全部' ? '全部' : noGoCat;
            gngGoLabel.textContent = goDisplay;
            gngNoGoLabel.textContent = noGoDisplay;
            if (showPopup) {
                const msg = `任務已變更：✅ ${goDisplay} → ❌ ${noGoDisplay}`;
                window.CognitiveMessage.show({
                    title: msg,
                    subtitle: '請繼續作答！',
                    pauseTimer: true
                });
            }
        }

        function showGngIntro() {
            window.CognitiveMessage.show({
                title: gngRuleText.textContent.trim(),
                subtitle: '',
                extraLarge: true,
                pauseTimer: false
            });
        }

        function isGngGo(items) {
            const { goCat } = getGngRule();
            if (goCat === '全部') {
                const { noGoCat } = getGngRule();
                if (noGoCat === '全部') {
                    return true;
                }
                return items.some(item => item.category !== noGoCat);
            }
            return items.some(item => item.category === goCat);
        }

        function switchGngTask() {
            const allCats = ['全部', ...CATEGORY_NAMES];
            const currentGo = gngState.goCategory;
            const currentNoGo = gngState.noGoCategory;

            if (gngState.switchType === 'random') {
                if (currentNoGo === '全部') {
                    let candidates = CATEGORY_NAMES.filter(c => c !== currentGo);
                    if (candidates.length === 0) return;
                    gngState.goCategory = pickRandom(candidates);
                    gngState.noGoCategory = '全部';
                    updateGngRuleDisplay(true);
                    gngState.sequence = generateGngSequence(gngState.sequence.length);
                    return;
                }
                if (currentGo === '全部') {
                    let candidates = CATEGORY_NAMES.filter(c => c !== currentNoGo);
                    if (candidates.length === 0) return;
                    gngState.noGoCategory = pickRandom(candidates);
                    gngState.goCategory = '全部';
                    updateGngRuleDisplay(true);
                    gngState.sequence = generateGngSequence(gngState.sequence.length);
                    return;
                }
                let goCandidates = CATEGORY_NAMES.filter(c => c !== currentGo && c !== currentNoGo);
                let noGoCandidates = CATEGORY_NAMES.filter(c => c !== currentGo && c !== currentNoGo);
                if (goCandidates.length === 0 || noGoCandidates.length === 0) return;
                gngState.goCategory = pickRandom(goCandidates);
                gngState.noGoCategory = pickRandom(noGoCandidates);
                if (gngState.goCategory === gngState.noGoCategory) {
                    const backup = CATEGORY_NAMES.filter(c => c !== gngState.goCategory);
                    if (backup.length > 0) {
                        gngState.noGoCategory = pickRandom(backup);
                    }
                }
                updateGngRuleDisplay(true);
                gngState.sequence = generateGngSequence(gngState.sequence.length);
            } else if (gngState.switchType === 'swap') {
                if (currentGo === '全部' && currentNoGo === '全部') {
                    return;
                }
                const temp = currentGo;
                gngState.goCategory = currentNoGo;
                gngState.noGoCategory = temp;
                updateGngRuleDisplay(true);
                gngState.sequence = generateGngSequence(gngState.sequence.length);
            }
        }

        function pauseGngTimer() {
            if (!gngState.isPlaying || gngState.timerPaused) return;
            gngState.timerPaused = true;
            gngActivity.pause();
        }

        function startGng() {
            if (gngState.isPlaying) return;
            gngState.sequence = generateGngSequence(50);
            gngState.currentIndex = -1;
            gngState.score = 0;
            gngState.totalTrials = 0;
            gngState.correctHits = 0;
            gngState.roundCounter = 0;
            gngState.timerPaused = false;
            gngState.messagePaused = false;
            updateGngScore();
            updateGngRuleDisplay(false);
            gngState.isPlaying = true;
            syncGngPlayButton();
            gngState.matchPending = false;
            gngActivity.start(gngState.speed);
            nextGngImage();
        }

        function pauseGng() {
            gngActivity.stop();
            gngState.isPlaying = false;
            gngState.timerPaused = false;
            gngState.messagePaused = false;
            syncGngPlayButton();
            window.CognitiveFeedback.clear(gngGridWrapper);
        }

        function renderGngImage() {
            if (gngState.currentIndex < 0 || gngState.sequence.length === 0) return;
            const items = gngState.sequence[gngState.currentIndex];
            gngState.currentItems = items;
            gngState.matchPending = false;

            const count = items.length;
            gngGridContainer.className = `gng-grid-container cols-${count}`;
            gngGridContainer.innerHTML = '';
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'gng-card';
                const img = document.createElement('img');
                img.src = item.image;
                img.alt = '';
                img.setAttribute('aria-label', item.name);
                img.onerror = function() {
                    this.style.display = 'none';
                    const fallback = document.createElement('span');
                    fallback.textContent = '🖼️';
                    fallback.style.fontSize = 'calc(40px * var(--ui-scale))';
                    this.parentElement.appendChild(fallback);
                };
                card.appendChild(img);
                const magnifyBtn = document.createElement('button');
                magnifyBtn.className = 'magnify-btn gng-magnify-btn';
                magnifyBtn.textContent = '🔍';
                magnifyBtn.title = '放大圖片';
                magnifyBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    openMagnify(item.image, item.name);
                });
                card.appendChild(magnifyBtn);
                gngGridContainer.appendChild(card);
            });
        }

        function nextGngImage() {
            gngState.currentIndex++;
            if (gngState.currentIndex >= gngState.sequence.length) {
                gngState.sequence = generateGngSequence(50);
                gngState.currentIndex = 0;
            }

            gngState.roundCounter++;
            if (gngState.autoSwitch && gngState.roundCounter > gngState.switchFreq) {
                gngState.roundCounter = 0;
                switchGngTask();
            }

            renderGngImage();
            resetGngTimer();
        }

        function handleGngResponse(isGo) {
            if (gngState.currentIndex < 0 || gngState.matchPending) return;
            const items = gngState.currentItems;
            const actualGo = isGngGo(items);
            const correct = (isGo === actualGo);
            gngState.matchPending = true;
            pauseGngTimer();

            if (correct) {
                gngState.score++;
                gngState.correctHits++;
                CognitiveAudio.play('correct');
                window.CognitiveFeedback.show(gngGridWrapper, '✅ 正確！', '#3ba87b');
            } else {
                CognitiveAudio.play('wrong');
                window.CognitiveFeedback.show(gngGridWrapper, '❌ 再試一次！', '#d95a5a');
            }
            gngState.totalTrials++;
            updateGngScore();

            if (correct) {
                setTimeout(() => {
                    gngState.timerPaused = false;
                    if (gngState.isPlaying) nextGngImage();
                    else {
                        gngState.matchPending = false;
                    }
                }, 600);
            } else {
                setTimeout(() => {
                    gngState.matchPending = false;
                }, 600);
            }
        }

        function updateGngScore() { gngScoreNum.textContent = gngState.score; }

        function changeGngSpeed(delta) {
            let newSpeed = gngState.speed + delta;
            if (newSpeed < 1) newSpeed = 1;
            if (newSpeed > 10) newSpeed = 10;
            gngState.speed = newSpeed;
            gngSpeedDisplay.textContent = newSpeed;
            gngActivity.setSpeed(newSpeed);
            if (gngState.isPlaying && !gngState.timerPaused) {
                gngActivity.reset();
            }
        }

        gngAutoToggle.addEventListener('click', function() {
            gngState.autoSwitch = !gngState.autoSwitch;
            this.textContent = gngState.autoSwitch ? '開啟' : '關閉';
            this.style.borderColor = gngState.autoSwitch ? 'var(--highlight-correct)' : 'var(--border-color)';
            this.style.background = gngState.autoSwitch ? 'var(--toggle-on-bg)' : 'var(--card-bg)';
        });

        gngStartBtn.addEventListener('click', function() {
            gngState.goCategory = gngGoCategory.value;
            gngState.noGoCategory = gngNoGoCategory.value;
            gngState.switchType = gngSwitchType.value;
            gngState.switchFreq = parseInt(gngSwitchFreq.value, 10);
            gngState.roundCounter = 0;
            updateGngRuleDisplay(false);
            gngState.score = 0;
            gngState.totalTrials = 0;
            gngState.correctHits = 0;
            updateGngScore();
            gngState.currentIndex = -1;
            gngState.currentItems = [];
            gngState.matchPending = false;
            gngState.sequence = generateGngSequence(50);
            if (window.CognitiveRouter) {
                if (window.CognitiveRouter.navigate('gngGame')) {
                    window.CognitiveRouter.afterTransition(function () {
                        syncTopBarCentering();
                        nextGngImage();
                        showGngIntro();
                    });
                }
            } else {
                document.getElementById('gngSettings').classList.add('hidden');
                document.getElementById('gngGame').style.display = 'flex';
                syncTopBarCentering();
                nextGngImage();
                showGngIntro();
            }
        });

        gngBackBtn.addEventListener('click', function() {
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            } else {
                document.getElementById('gngGame').style.display = 'none';
                document.getElementById('gngSettings').classList.remove('hidden');
                pauseGng();
            }
        });

        gngSettingsBackBtn.addEventListener('click', function() {
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            } else {
                document.getElementById('gngSettings').classList.add('hidden');
                pauseGng();
                goToMainMenu();
            }
        });

        gngPlayBtn.addEventListener('click', function() {
            if (gngState.isPlaying) { pauseGng(); } else { startGng(); }
        });

        gngGoBtn.addEventListener('click', function() { handleGngResponse(true); });
        gngNoGoBtn.addEventListener('click', function() { handleGngResponse(false); });

        gngSpeedDown.addEventListener('click', function() { changeGngSpeed(-1); });
        gngSpeedUp.addEventListener('click', function() { changeGngSpeed(1); });

        gngGridWrapper.addEventListener('click', function(e) {
            if (!gngState.matchPending && e.target.closest('.gng-card')) {
                gngState.timerPaused = false;
                nextGngImage();
            }
        });

        gngRuleText.addEventListener('click', function(e) {
            e.stopPropagation();
            const currentGo = gngState.goCategory;
            const currentNoGo = gngState.noGoCategory;
            const goDisplay = currentGo === '全部' ? '全部' : currentGo;
            const noGoDisplay = currentNoGo === '全部' ? '全部' : currentNoGo;

            window.CognitiveMessage.show({
                title: '🔄 立即切換任務',
                subtitle: `目前：✅ ${goDisplay} → ❌ ${noGoDisplay}`,
                buttons: [{
                    text: '🎲 隨機變更',
                    className: 'btn-stay',
                    action: function() {
                        const allCats = ['全部', ...CATEGORY_NAMES];
                        const currentGo2 = gngState.goCategory;
                        const currentNoGo2 = gngState.noGoCategory;
                        if (currentNoGo2 === '全部') {
                            let candidates = CATEGORY_NAMES.filter(c => c !== currentGo2);
                            if (candidates.length === 0) return;
                            gngState.goCategory = pickRandom(candidates);
                            gngState.noGoCategory = '全部';
                        } else if (currentGo2 === '全部') {
                            let candidates = CATEGORY_NAMES.filter(c => c !== currentNoGo2);
                            if (candidates.length === 0) return;
                            gngState.noGoCategory = pickRandom(candidates);
                            gngState.goCategory = '全部';
                        } else {
                            let goCandidates = CATEGORY_NAMES.filter(c => c !== currentGo2 && c !== currentNoGo2);
                            let noGoCandidates = CATEGORY_NAMES.filter(c => c !== currentGo2 && c !== currentNoGo2);
                            if (goCandidates.length === 0 || noGoCandidates.length === 0) return;
                            gngState.goCategory = pickRandom(goCandidates);
                            gngState.noGoCategory = pickRandom(noGoCandidates);
                            if (gngState.goCategory === gngState.noGoCategory) {
                                const backup = CATEGORY_NAMES.filter(c => c !== gngState.goCategory);
                                if (backup.length > 0) {
                                    gngState.noGoCategory = pickRandom(backup);
                                }
                            }
                        }
                        updateGngRuleDisplay(true);
                        gngState.sequence = generateGngSequence(gngState.sequence.length);
                        gngState.roundCounter = 0;
                        resetGngTimer();
                    }
                }, {
                    text: '🔄 互換',
                    className: 'btn-stay',
                    action: function() {
                        const temp = gngState.goCategory;
                        gngState.goCategory = gngState.noGoCategory;
                        gngState.noGoCategory = temp;
                        updateGngRuleDisplay(true);
                        gngState.sequence = generateGngSequence(gngState.sequence.length);
                        gngState.roundCounter = 0;
                        resetGngTimer();
                    }
                }],
                pauseTimer: false
            });
        });

        gngSpeedDisplay.textContent = gngState.speed;
        gngGoCategory.value = '水果';
        gngNoGoCategory.value = '全部';
        gngAutoToggle.textContent = '關閉';
        gngAutoToggle.style.borderColor = 'var(--border-color)';
        gngAutoToggle.style.background = 'var(--card-bg)';
        gngSwitchType.value = 'swap';
        gngSwitchFreq.value = '10';

        if (gngPreferences) {
            gngGoCategory.value = gngPreferences.goCategory;
            gngNoGoCategory.value = gngPreferences.noGoCategory;
            gngState.autoSwitch = gngPreferences.autoSwitch;
            gngAutoToggle.textContent = gngState.autoSwitch ? '開啟' : '關閉';
            gngAutoToggle.style.borderColor = gngState.autoSwitch ? 'var(--highlight-correct)' : 'var(--border-color)';
            gngAutoToggle.style.background = gngState.autoSwitch ? 'var(--toggle-on-bg)' : 'var(--card-bg)';
            gngSwitchType.value = gngPreferences.switchType;
            gngSwitchFreq.value = String(gngPreferences.switchFreq);
        }

        if (gngSaveSettingsBtn) {
            gngSaveSettingsBtn.addEventListener('click', function() {
                const prefs = {
                    goCategory: gngGoCategory.value,
                    noGoCategory: gngNoGoCategory.value,
                    autoSwitch: gngState.autoSwitch,
                    switchType: gngSwitchType.value,
                    switchFreq: parseInt(gngSwitchFreq.value, 10)
                };
                if (window.CognitivePrefs) {
                    CognitivePrefs.save('cognitiveGngPrefs', prefs);
                }
                window.CognitiveMessage.show({
                    title: '設定已儲存',
                    subtitle: '下次進入遊戲時會使用已儲存的偏好設定。',
                    buttons: [{
                        text: '好的',
                        className: 'btn-stay',
                        action: function() {}
                    }],
                    pauseTimer: false
                });
            });
        }

        if (window.CognitiveRouter) {
            window.CognitiveRouter.defineScreen('gngSettings', {
                exit: pauseGng,
                back: 'mainMenu'
            });
            window.CognitiveRouter.defineScreen('gngGame', {
                exit: pauseGng,
                back: 'gngSettings'
            });
        }

        // =============================================================
