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
            timer: null,
            timerToken: 0,
            interval: 0,
            currentItem: null,
            matchPending: false,
            showBlank: false,
            blankFromTimer: false,
        };

        const nbackImage = document.getElementById('nbackImage');
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

        function updateNbackInterval() {
            const maxDelay = 3000,
                minDelay = 500;
            const factor = (nbackState.speed - 1) / 9;
            nbackState.interval = maxDelay - factor * (maxDelay - minDelay);
        }

        function resetNbackTimer() {
            if (nbackState.timer) clearInterval(nbackState.timer);
            if (!nbackState.isPlaying) return;
            updateNbackInterval();
            const token = ++nbackState.timerToken;
            nbackState.timer = setInterval(() => {
                if (nbackState.isPlaying && nbackState.timerToken === token) {
                    nextNbackImage(true);
                }
            }, nbackState.interval);
        }

        function generateNbackSequence(length = 50) {
            const seq = [];
            for (let i = 0; i < length; i++) {
                seq.push(pickRandom(FOOD_DATA));
            }
            for (let i = 0; i < length; i++) {
                if (i >= nbackState.n && Math.random() < 0.3) {
                    seq[i] = { ...seq[i - nbackState.n] };
                }
            }
            return seq;
        }

        function startNback() {
            if (nbackState.isPlaying) return;
            nbackState.sequence = generateNbackSequence(50);
            nbackState.currentIndex = -1;
            nbackState.score = 0;
            nbackState.totalTrials = 0;
            nbackState.correctHits = 0;
            nbackState.falseAlarms = 0;
            nbackState.showBlank = false;
            updateNbackScore();
            nbackState.isPlaying = true;
            nbackPlayBtn.classList.add('playing');
            nbackState.matchPending = false;
            nextNbackImage();
        }

        function pauseNback() {
            nbackState.timerToken++;
            if (nbackState.timer) { clearInterval(nbackState.timer);
                nbackState.timer = null; }
            nbackState.isPlaying = false;
            nbackState.blankFromTimer = false;
            nbackPlayBtn.classList.remove('playing');
        }

        function holdNbackTimer() {
            nbackState.timerToken++;
            if (nbackState.timer) {
                clearInterval(nbackState.timer);
                nbackState.timer = null;
            }
        }

        function nextNbackImage(fromTimer = false) {
            if (nbackState.showBlank && nbackState.n === 1) {
                nbackImage.style.display = 'none';
                nbackMagnifyBtn.style.display = 'none';
                nbackOverlay.style.opacity = 0;
                nbackState.showBlank = false;
                nbackState.blankFromTimer = fromTimer;
                nbackStepLabel.textContent = '—';
                resetNbackTimer();
                return;
            }
            nbackImage.style.display = 'block';
            nbackMagnifyBtn.style.display = 'flex';
            nbackImage.style.backgroundColor = 'transparent';
            nbackState.currentIndex++;
            if (nbackState.currentIndex >= nbackState.sequence.length) {
                nbackState.sequence = generateNbackSequence(50);
                nbackState.currentIndex = 0;
            }
            const item = nbackState.sequence[nbackState.currentIndex];
            nbackImage.src = item.image;
            nbackImage.alt = '';
            nbackImage.setAttribute('aria-label', item.name);
            nbackOverlay.style.opacity = 0;
            nbackOverlay.textContent = '';
            nbackState.currentItem = item;
            nbackState.matchPending = false;
            nbackState.blankFromTimer = false;
            nbackStepLabel.textContent = `#${nbackState.currentIndex + 1}`;
            if (nbackState.n === 1) {
                nbackState.showBlank = true;
            } else {
                nbackState.showBlank = false;
            }
            resetNbackTimer();
        }

        function handleNbackMatch(isMatch) {
            if (nbackState.currentIndex < 0 || nbackState.matchPending) return;
            const current = nbackState.currentItem;
            const targetIndex = nbackState.currentIndex - nbackState.n;
            if (targetIndex < 0) {
                showNbackFeedback('還不夠 N 步', '#ffaa00');
                return;
            }
            const targetItem = nbackState.sequence[targetIndex];
            const actualMatch = (targetItem.name === current.name);
            const correct = (isMatch === actualMatch);
            nbackState.matchPending = true;
            holdNbackTimer();

            if (correct) {
                nbackState.score++;
                if (isMatch) nbackState.correctHits++;
                else nbackState.falseAlarms++;
                showNbackFeedback('✅ 正確匹配', '#3ba87b');
                if (sfxEnabled) playCorrectSound();
            } else {
                showNbackFeedback('💪 ' + getRandomWrongEncourage(), '#d95a5a');
                if (sfxEnabled) playWrongSound();
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
            nbackOverlay.textContent = text;
            nbackOverlay.style.color = color;
            nbackOverlay.style.opacity = 1;
            setTimeout(() => { nbackOverlay.style.opacity = 0; }, 500);
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

        function changeNbackN(newN) {
            nbackState.n = newN;
            nbackState.showBlank = false;
            nbackState.blankFromTimer = false;
            if (nbackState.isPlaying) {
                pauseNback();
                startNback();
            }
        }

        nbackPlayBtn.addEventListener('click', function() {
            if (nbackState.isPlaying) { pauseNback(); } else { startNback(); }
        });

        nbackImageContainer.addEventListener('click', function() {
            if (!nbackState.matchPending && !(!nbackState.showBlank && nbackState.blankFromTimer)) {
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
            pauseNback();
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            } else {
                document.getElementById('nbackGame').style.display = 'none';
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
            if (nbackState.sequence.length === 0) {
                nbackState.sequence = generateNbackSequence(50);
                nbackState.currentIndex = 0;
                nbackState.currentItem = nbackState.sequence[0];
                nbackState.matchPending = false;
                nbackState.showBlank = true;
                nbackState.blankFromTimer = false;
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
        }

        if (window.CognitiveRouter) {
            window.CognitiveRouter.registerEnter('nbackGame', prepareNbackGame);
            window.CognitiveRouter.registerExit('nbackGame', pauseNback);
        }

        // =============================================================
