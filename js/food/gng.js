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
            timer: null,
            timerToken: 0,
            interval: 0,
            currentItems: [],
            matchPending: false,
            roundCounter: 0,
            timerPaused: false,
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

        const gngPreferences = window.CognitivePrefs ? CognitivePrefs.load(
            'cognitiveGngPrefs',
            {
                goCategory: '水果',
                noGoCategory: '全部',
                autoSwitch: false,
                switchType: 'swap',
                switchFreq: 10
            },
            {
                goCategory: ['全部', ...CATEGORY_NAMES],
                noGoCategory: ['全部', ...CATEGORY_NAMES],
                autoSwitch: 'boolean',
                switchType: ['random', 'swap'],
                switchFreq: [5, 10, 15, 20]
            }
        ) : null;

        function updateGngInterval() {
            const maxDelay = 6000,
                minDelay = 1000;
            const factor = (gngState.speed - 1) / 9;
            gngState.interval = maxDelay - factor * (maxDelay - minDelay);
        }

        function resetGngTimer() {
            if (gngState.timer) clearInterval(gngState.timer);
            if (!gngState.isPlaying || gngState.timerPaused) return;
            updateGngInterval();
            const token = ++gngState.timerToken;
            gngState.timer = setInterval(() => {
                if (gngState.isPlaying && !gngState.timerPaused && gngState.timerToken === token) {
                    nextGngImage();
                }
            }, gngState.interval);
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
                showCustomMessage(msg, '請繼續作答！', [], false, true);
            }
        }

        function showGngIntro() {
            gngState.isPlaying = true;
            gngState.timerPaused = true;
            gngPlayBtn.classList.add('playing');
            window.gngIntroPending = true;
            showCustomMessage(
                gngRuleText.textContent.trim(),
                '',
                [],
                false,
                false,
                true
            );
        }

        function finishGngIntro() {
            if (!window.gngIntroPending) return;
            window.gngIntroPending = false;
            hideOverlay();
            gngState.timerPaused = false;
            resetGngTimer();
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
            if (gngState.isPlaying && gngState.timer) {
                gngState.timerToken++;
                clearInterval(gngState.timer);
                gngState.timerPaused = true;
            }
        }

        function resumeGngTimer() {
            if (gngState.isPlaying && gngState.timerPaused) {
                gngState.timerPaused = false;
                resetGngTimer();
            }
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
            updateGngScore();
            updateGngRuleDisplay(false);
            gngState.isPlaying = true;
            gngPlayBtn.classList.add('playing');
            gngState.matchPending = false;
            nextGngImage();
        }

        function pauseGng() {
            gngState.timerToken++;
            if (gngState.timer) { clearInterval(gngState.timer);
                gngState.timer = null; }
            gngState.isPlaying = false;
            gngState.timerPaused = false;
            gngPlayBtn.classList.remove('playing');
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
                if (sfxEnabled) playCorrectSound();
                const encourage = getRandomEncourage();
                showGngFeedback('✅ ' + encourage, '#3ba87b');
            } else {
                if (sfxEnabled) playWrongSound();
                const wrongMsg = getRandomWrongEncourage();
                showGngFeedback('💪 ' + wrongMsg, '#d95a5a');
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

        function showGngFeedback(text, color) {
            const overlay = document.createElement('div');
            overlay.className = 'gng-overlay';
            overlay.textContent = text;
            overlay.style.color = color;
            overlay.style.opacity = 1;
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.fontSize = 'calc(48px * var(--ui-scale))';
            overlay.style.fontWeight = '700';
            overlay.style.textShadow = '0 0 calc(30px * var(--ui-scale)) rgba(0,0,0,0.9)';
            overlay.style.pointerEvents = 'none';
            overlay.style.transition = 'opacity 0.3s';

            gngGridWrapper.style.position = 'relative';
            const existing = gngGridWrapper.querySelector('.gng-overlay');
            if (existing) existing.remove();
            gngGridWrapper.appendChild(overlay);

            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 300);
            }, 500);
        }

        function updateGngScore() { gngScoreNum.textContent = gngState.score; }

        function changeGngSpeed(delta) {
            let newSpeed = gngState.speed + delta;
            if (newSpeed < 1) newSpeed = 1;
            if (newSpeed > 10) newSpeed = 10;
            gngState.speed = newSpeed;
            gngSpeedDisplay.textContent = newSpeed;
            if (gngState.isPlaying && !gngState.timerPaused) {
                resetGngTimer();
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
            pauseGng();
            gngState.score = 0;
            gngState.totalTrials = 0;
            gngState.correctHits = 0;
            updateGngScore();
            gngState.currentIndex = -1;
            gngState.currentItems = [];
            gngState.matchPending = false;
            gngState.sequence = generateGngSequence(50);
            if (window.CognitiveRouter) {
                window.CognitiveRouter.navigate('gngGame');
                syncTopBarCentering();
                nextGngImage();
                showGngIntro();
            } else {
                document.getElementById('gngSettings').classList.add('hidden');
                document.getElementById('gngGame').style.display = 'flex';
                syncTopBarCentering();
                nextGngImage();
                showGngIntro();
            }
        });

        gngBackBtn.addEventListener('click', function() {
            pauseGng();
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            } else {
                document.getElementById('gngGame').style.display = 'none';
                document.getElementById('gngSettings').classList.remove('hidden');
            }
        });

        gngSettingsBackBtn.addEventListener('click', function() {
            pauseGng();
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            } else {
                document.getElementById('gngSettings').classList.add('hidden');
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

            showCustomMessage(
                '🔄 立即切換任務',
                `目前：✅ ${goDisplay} → ❌ ${noGoDisplay}`,
                [{
                    text: '🎲 隨機變更',
                    class: 'btn-stay',
                    action: function() {
                        hideOverlay();
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
                    class: 'btn-stay',
                    action: function() {
                        hideOverlay();
                        const temp = gngState.goCategory;
                        gngState.goCategory = gngState.noGoCategory;
                        gngState.noGoCategory = temp;
                        updateGngRuleDisplay(true);
                        gngState.sequence = generateGngSequence(gngState.sequence.length);
                        gngState.roundCounter = 0;
                        resetGngTimer();
                    }
                }],
                false,
                false
            );
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
                showCustomMessage(
                    '設定已儲存',
                    '下次進入遊戲時會使用已儲存的偏好設定。',
                    [{
                        text: '好的',
                        class: 'btn-stay',
                        action: function() { hideOverlay(); }
                    }],
                    false,
                    false
                );
            });
        }

        window.pauseGngTimer = pauseGngTimer;
        window.resumeGngTimer = resumeGngTimer;

        if (window.CognitiveRouter) {
            window.CognitiveRouter.registerExit('gngGame', pauseGng);
            window.CognitiveRouter.registerExit('gngSettings', pauseGng);
        }

        // =============================================================
