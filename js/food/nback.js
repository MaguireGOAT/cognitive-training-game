        // 第三部分：N-back 記憶遊戲
        // =============================================================

        const NBACK_TARGET_COUNT = 15;
        const NBACK_MIN_PLANNED_GAP = 3;

        function getNbackFoodId(item) {
            return item.id || item.name;
        }

        function pickPlannedNbackIndices(length, n, targetCount, minGap, excludeIndices) {
            const start = n;
            const end = Math.max(start, length - 1);
            const excluded = new Set(excludeIndices || []);
            const usable = Math.max(1, end - start + 1);
            const count = Math.max(0, Math.min(targetCount, usable));
            if (count === 0) return [];

            const step = usable / count;
            const positions = [];
            for (let k = 0; k < count; k++) {
                const base = start + Math.round((k + 0.5) * step);
                const lo = Math.max(start, k === 0 ? start : positions[k - 1] + minGap);
                const hi = Math.min(end, k === count - 1 ? end : start + Math.round((k + 1.5) * step) - minGap);
                const jitter = Math.max(0, Math.floor(Math.max(1, hi - lo + 1) * 0.28));
                const min = Math.max(lo, base - jitter);
                const max = Math.min(hi, base + jitter);
                const candidates = [];
                for (let value = min; value <= max; value++) {
                    if (!excluded.has(value)) candidates.push(value);
                }
                if (!candidates.length) return [];
                positions[k] = candidates[Math.floor(Math.random() * candidates.length)];
            }

            for (let i = 1; i < positions.length; i++) {
                let adjusted = Math.max(positions[i], positions[i - 1] + minGap);
                while (adjusted <= end && excluded.has(adjusted)) adjusted++;
                if (adjusted > end) return [];
                positions[i] = adjusted;
            }
            return positions;
        }

        function generateNbackStream(choices, n, length, plannedIndices, valueOf, cloneValue) {
            const planned = new Set(plannedIndices);
            const seq = [];
            for (let i = 0; i < length; i++) {
                if (i < n) {
                    seq[i] = cloneValue ? cloneValue(pickRandom(choices)) : pickRandom(choices);
                    continue;
                }
                if (planned.has(i)) {
                    seq[i] = cloneValue ? cloneValue(seq[i - n]) : seq[i - n];
                    continue;
                }
                const previous = seq[i - n];
                const candidates = choices.filter(candidate => valueOf(candidate) !== valueOf(previous));
                seq[i] = cloneValue
                    ? cloneValue(candidates.length ? pickRandom(candidates) : pickRandom(choices))
                    : (candidates.length ? pickRandom(candidates) : pickRandom(choices));
            }
            return seq;
        }

        window.CognitiveNbackSequence = {
            targetCount: NBACK_TARGET_COUNT,
            minGap: NBACK_MIN_PLANNED_GAP,
            pickPlannedIndices: pickPlannedNbackIndices,
            generateStream: generateNbackStream,
            foodId: getNbackFoodId
        };

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
            transitioning: false,
            animationToken: 0,
            transitionTimer: null,
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
        const NBACK_TRANSITION_MS = 240;

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

        // Planned-target sequence: pre-select 15 spread-out match positions, then build
        // each trial step by step and avoid accidental N-back matches.
        function generateNbackSequence(length = 50) {
            const plannedIndices = pickPlannedNbackIndices(
                length,
                nbackState.n,
                NBACK_TARGET_COUNT,
                NBACK_MIN_PLANNED_GAP
            );
            return generateNbackStream(
                FOOD_DATA,
                nbackState.n,
                length,
                plannedIndices,
                getNbackFoodId,
                item => ({ ...item })
            );
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

        function commitNbackItem(item, index) {
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
            nbackPlayBtn.classList.add('playing');
            commitNbackItem(nbackState.sequence[0], 0);
            resetNbackTimer();
        }

        function pauseNback() {
            clearNbackTransition();
            nbackState.timerToken++;
            if (nbackState.timer) { clearInterval(nbackState.timer);
                nbackState.timer = null; }
            nbackState.isPlaying = false;
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
                const item = nbackState.sequence[nbackState.currentIndex];
                nbackImageContainer.classList.remove('is-exiting');
                nbackImageContainer.classList.add('is-entering');
                commitNbackItem(item, nbackState.currentIndex);
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

        function showNbackInstruction() {
            window.nbackInstructionPending = true;
            showCustomMessage(
                `看看圖片與上 ${nbackState.n} 張是否相同`,
                '',
                [],
                false,
                false,
                true
            );
        }

        function finishNbackInstruction() {
            window.nbackInstructionPending = false;
            hideOverlay();
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
            clearNbackTransition();
            if (nbackState.sequence.length === 0) {
                nbackState.sequence = generateNbackSequence(50);
                nbackState.currentIndex = 0;
                nbackState.currentItem = nbackState.sequence[0];
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

        window.finishNbackInstruction = finishNbackInstruction;

        if (window.CognitiveRouter) {
            window.CognitiveRouter.registerEnter('nbackGame', prepareNbackGame);
            window.CognitiveRouter.registerExit('nbackGame', pauseNback);
        }

        // =============================================================
