        // 第三部分：N-back 記憶遊戲
        // =============================================================

        const nbackState = {
            n: 1,
            speed: 5,
            isPlaying: false,
            sequence: [],
            currentIndex: -1,
            score: 0,
            totalTrials: 0,
            correctHits: 0,
            falseAlarms: 0,
            interval: 0,
            currentItem: null,
            matchPending: false,
            transitioning: false,
            animationToken: 0,
            transitionTimer: null,
        };

        const nbackImage = document.getElementById('nbackImage');
        const nbackGridWrapper = document.getElementById('nbackGridWrapper');
        const nbackOverlay = document.getElementById('nbackOverlay');
        const nbackStepLabel = document.getElementById('nbackStepLabel');
        const nbackScoreNum = document.getElementById('nbackScoreNum');
        const nbackPlayBtn = document.getElementById('nbackPlayBtn');
        const nbackSpeedDisplay = document.getElementById('nbackSpeedDisplay');
        const nbackSpeedDown = document.getElementById('nbackSpeedDown');
        const nbackSpeedUp = document.getElementById('nbackSpeedUp');
        const nbackMatchBtn = document.getElementById('nbackMatchBtn');
        const nbackNotMatchBtn = document.getElementById('nbackNotMatchBtn');
        const nbackImageContainer = document.getElementById('nbackImageContainer');
        const nbackNSelect = document.getElementById('nbackNSelect');
        const nbackBackBtn = document.getElementById('nbackBackBtn');
        const nbackMagnifyBtn = document.getElementById('nbackMagnifyBtn');
        const NBACK_TRANSITION_MS = 240;
        const nbackTimer = window.CognitiveActivityTimer.create();

        function updateNbackInterval() {
            const maxDelay = 3000,
                minDelay = 500;
            const factor = (nbackState.speed - 1) / 9;
            nbackState.interval = maxDelay - factor * (maxDelay - minDelay);
        }

        function startNbackSession() {
            nbackTimer.start({
                mode: 'repeating',
                intervalMs: nbackState.interval,
                tick: function () {
                    if (nbackState.isPlaying) {
                        nextNbackImage(true);
                    }
                },
                onPause: syncNbackSessionUi,
                onResume: syncNbackSessionUi
            });
        }

        function syncNbackPlayButton() {
            nbackPlayBtn.classList.toggle('playing', nbackState.isPlaying);
        }

        function syncNbackSessionUi() {
            var active = nbackState.isPlaying && nbackTimer.isRunning();
            nbackPlayBtn.classList.toggle('playing', active);
        }

        function resetNbackTimer() {
            if (!nbackState.isPlaying) return;
            updateNbackInterval();
            startNbackSession();
        }

        // Brain Workshop-style random match generation: each trial has a set
        // probability of matching the stimulus N trials earlier. The planner
        // keeps identity and match status in the trial itself.
        function generateNbackSequence(length = 50) {
            return window.CognitiveSequence.generateTrials({
                choices: FOOD_DATA,
                n: nbackState.n,
                length,
                matchProbability: window.CognitiveSequence.matchProbability,
                cloneValue: item => ({ ...item }),
                keyFor: item => item.name
            });
        }

        function clearNbackTransition() {
            nbackState.animationToken++;
            if (nbackState.transitionTimer) {
                clearTimeout(nbackState.transitionTimer);
                nbackState.transitionTimer = null;
            }
            if (nbackImageContainer) {
                nbackImageContainer.classList.remove('is-exiting', 'is-entering');
            }
            nbackState.transitioning = false;
        }

        function commitNbackItem(trial, index) {
            const item = trial && trial.value ? trial.value : trial;
            nbackImage.style.display = 'block';
            nbackMagnifyBtn.style.display = 'flex';
            nbackImage.style.backgroundColor = 'transparent';
            nbackImage.src = item.image;
            nbackImage.alt = '';
            nbackImage.setAttribute('aria-label', item.name);
            nbackOverlay.style.opacity = 0;
            nbackOverlay.textContent = '';
            nbackState.currentItem = item;
            nbackState.matchPending = false;
            nbackStepLabel.textContent = `#${index + 1}`;
        }

        function startNback() {
            if (nbackState.isPlaying) return;
            clearNbackTransition();
            nbackState.sequence = generateNbackSequence(50);
            nbackState.currentIndex = 0;
            nbackState.score = 0;
            nbackState.totalTrials = 0;
            nbackState.correctHits = 0;
            nbackState.falseAlarms = 0;
            updateNbackScore();
            nbackState.isPlaying = true;
            syncNbackPlayButton();
            commitNbackItem(nbackState.sequence[0], 0);
            resetNbackTimer();
        }

        function pauseNback() {
            clearNbackTransition();
            nbackTimer.pause();
            nbackState.isPlaying = false;
            syncNbackPlayButton();
            window.CognitiveFeedback.clear(nbackGridWrapper);
        }

        function holdNbackTimer() {
            nbackTimer.stop();
        }

        function nextNbackImage(fromTimer = false) {
            if (nbackState.transitioning) return;
            holdNbackTimer();
            nbackState.transitioning = true;
            nbackState.matchPending = true;
            const token = ++nbackState.animationToken;
            nbackImageContainer.classList.remove('is-entering');
            nbackImageContainer.classList.add('is-exiting');
            nbackState.transitionTimer = setTimeout(() => {
                if (token !== nbackState.animationToken) return;
                nbackState.currentIndex++;
                if (nbackState.currentIndex >= nbackState.sequence.length) {
                    nbackState.sequence = generateNbackSequence(50);
                    nbackState.currentIndex = 0;
                }
                const trial = nbackState.sequence[nbackState.currentIndex];
                nbackImageContainer.classList.remove('is-exiting');
                nbackImageContainer.classList.add('is-entering');
                commitNbackItem(trial, nbackState.currentIndex);
                nbackState.transitionTimer = setTimeout(() => {
                    if (token !== nbackState.animationToken) return;
                    nbackImageContainer.classList.remove('is-entering');
                    nbackState.transitioning = false;
                }, NBACK_TRANSITION_MS);
                resetNbackTimer();
            }, NBACK_TRANSITION_MS);
        }

        function handleNbackMatch(isMatch) {
            if (nbackState.currentIndex < 0 || nbackState.matchPending || nbackState.transitioning) return;
            if (nbackState.currentIndex < nbackState.n) {
                showNbackFeedback('還不夠 N 步', '#ffaa00');
                return;
            }
            const actualMatch = Boolean(
                nbackState.sequence[nbackState.currentIndex] &&
                nbackState.sequence[nbackState.currentIndex].isMatch
            );
            const correct = (isMatch === actualMatch);
            nbackState.matchPending = true;
            holdNbackTimer();

            if (correct) {
                nbackState.score++;
                if (isMatch) nbackState.correctHits++;
                else nbackState.falseAlarms++;
                showNbackFeedback('✅ 正確！', '#3ba87b');
                CognitiveAudio.play('correct');
            } else {
                showNbackFeedback('❌ 再試一次！', '#d95a5a');
                CognitiveAudio.play('wrong');
            }
            nbackState.totalTrials++;
            updateNbackScore();

            if (correct) {
                setTimeout(() => {
                    if (nbackState.isPlaying) nextNbackImage(true);
                    else {
                        nbackState.matchPending = false;
                    }
                }, 600);
            } else {
                setTimeout(() => {
                    nbackState.matchPending = false;
                }, 600);
            }
        }

        function showNbackFeedback(text, color) {
            window.CognitiveFeedback.show(nbackGridWrapper, text, color);
        }

        function updateNbackScore() { nbackScoreNum.textContent = nbackState.score; }

        function changeNbackSpeed(delta) {
            let newSpeed = nbackState.speed + delta;
            if (newSpeed < 1) newSpeed = 1;
            if (newSpeed > 10) newSpeed = 10;
            nbackState.speed = newSpeed;
            nbackSpeedDisplay.textContent = newSpeed;
            if (nbackState.isPlaying) {
                resetNbackTimer();
            }
        }

        function showNbackInstruction() {
            window.CognitiveMessage.show({
                title: `看看圖片與上 ${nbackState.n} 張是否相同`,
                subtitle: '',
                extraLarge: true,
                pauseTimer: false
            });
        }

        function changeNbackN(newN) {
            const wasPlaying = nbackState.isPlaying;
            nbackState.n = newN;
            if (wasPlaying) pauseNback();
            showNbackInstruction();
        }

        nbackPlayBtn.addEventListener('click', function() {
            if (nbackState.isPlaying) { pauseNback(); } else { startNback(); }
        });

        nbackImageContainer.addEventListener('click', function() {
            if (!nbackState.matchPending && !nbackState.transitioning) {
                nextNbackImage();
            }
        });

        nbackMagnifyBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (nbackState.currentItem) {
                openMagnify(nbackState.currentItem.image, nbackState.currentItem.name);
            }
        });

        nbackMatchBtn.addEventListener('click', function() { handleNbackMatch(true); });
        nbackNotMatchBtn.addEventListener('click', function() { handleNbackMatch(false); });

        nbackSpeedDown.addEventListener('click', function() { changeNbackSpeed(-1); });
        nbackSpeedUp.addEventListener('click', function() { changeNbackSpeed(1); });

        nbackNSelect.addEventListener('change', function() {
            const val = parseInt(this.value, 10);
            changeNbackN(val);
        });

        nbackBackBtn.addEventListener('click', function() {
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            } else {
                document.getElementById('nbackGame').style.display = 'none';
                pauseNback();
                goToMainMenu();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === ' ' && !document.activeElement?.matches('input, button, select')) {
                e.preventDefault();
                if (!document.getElementById('nbackGame').classList.contains('hidden')) {
                    handleNbackMatch(true);
                }
            }
            if (e.key === 'n' && !document.activeElement?.matches('input, button, select')) {
                e.preventDefault();
                if (!document.getElementById('nbackGame').classList.contains('hidden')) {
                    handleNbackMatch(false);
                }
            }
        });

        nbackSpeedDisplay.textContent = nbackState.speed;
        nbackNSelect.value = nbackState.n;

        function prepareNbackGame() {
            pauseNback();
            clearNbackTransition();
            if (nbackState.sequence.length === 0) {
                nbackState.sequence = generateNbackSequence(50);
                nbackState.currentIndex = 0;
                nbackState.currentItem = nbackState.sequence[0].value;
                nbackState.matchPending = false;
                nbackState.score = 0;
                nbackState.totalTrials = 0;
                nbackState.correctHits = 0;
                nbackState.falseAlarms = 0;
                updateNbackScore();
                nbackImage.src = nbackState.currentItem.image;
                nbackImage.alt = '';
                nbackImage.setAttribute('aria-label', nbackState.currentItem.name);
                nbackImage.style.display = 'block';
                nbackOverlay.textContent = '';
                nbackOverlay.style.opacity = 0;
                nbackStepLabel.textContent = '#1';
                nbackMagnifyBtn.style.display = 'flex';
            }
            updateNbackInterval();
            nbackSpeedDisplay.textContent = nbackState.speed;
            showNbackInstruction();
        }

        if (window.CognitiveRouter) {
            window.CognitiveRouter.defineScreen('nbackGame', {
                enter: prepareNbackGame,
                exit: pauseNback,
                back: 'nbackModeSelect'
            });
        }

        // =============================================================
