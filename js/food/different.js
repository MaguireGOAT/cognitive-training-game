        // 找不同遊戲
        // =============================================================

        const differentState = {
            imageCount: 4,
            score: 0,
            round: 0,
            items: [],
            oddItem: null,
            isAnswered: false,
            isWaitingForNext: false,
            wrongFlashTimer: null
        };

        const differentGameScreen = document.getElementById('differentGame');
        const differentGridContainer = document.getElementById('differentGridContainer');
        const differentScoreNum = document.getElementById('differentScoreNum');
        const differentRoundInfo = document.getElementById('differentRoundInfo');
        const differentBackBtn = document.getElementById('differentBackBtn');
        const differentCountSelect = document.getElementById('differentCountSelect');

        const differentPreferences = window.CognitivePrefs ? CognitivePrefs.load(
            'cognitiveDifferentPrefs',
            { imageCount: 4 },
            { imageCount: [3, 4, 5, 6] }
        ) : null;

        if (differentPreferences) {
            differentState.imageCount = differentPreferences.imageCount;
            differentCountSelect.value = String(differentState.imageCount);
        }

        function buildDifferentRound() {
            const count = differentState.imageCount;
            for (let attempt = 0; attempt < 50; attempt++) {
                const commonCategory = pickRandom(CATEGORY_NAMES);
                const oddCandidates = CATEGORY_NAMES.filter(cat => cat !== commonCategory);
                const oddCategory = pickRandom(oddCandidates);
                const commonPool = shuffle(FOOD_DATA.filter(item => item.category === commonCategory));
                const oddPool = shuffle(FOOD_DATA.filter(item => item.category === oddCategory));
                const commonItems = [];
                const usedNames = new Set();

                for (const item of commonPool) {
                    if (commonItems.length >= count - 1) break;
                    if (usedNames.has(item.name)) continue;
                    commonItems.push(item);
                    usedNames.add(item.name);
                }
                if (commonItems.length !== count - 1) continue;

                const oddItem = oddPool.find(item => !usedNames.has(item.name));
                if (!oddItem) continue;

                differentState.oddItem = oddItem;
                differentState.items = shuffle([
                    ...commonItems.map(item => ({ ...item, isCorrect: false })),
                    { ...oddItem, isCorrect: true }
                ]);
                return differentState.items;
            }

            const allFoods = shuffle(FOOD_DATA);
            differentState.items = allFoods.slice(0, count).map((item, index) => ({
                ...item,
                isCorrect: index === 0
            }));
            differentState.oddItem = differentState.items[0];
            return differentState.items;
        }

        function renderDifferentGrid(items) {
            const count = items.length;
            differentGridContainer.className = `different-grid-container count-${count}`;
            differentGridContainer.innerHTML = '';

            function createDifferentCard(item, index) {
                const card = document.createElement('div');
                card.className = 'different-card';
                card.dataset.index = index;
                card.dataset.correct = item.isCorrect ? 'true' : 'false';

                const magnifyBtn = document.createElement('button');
                magnifyBtn.className = 'magnify-btn different-magnify-btn';
                magnifyBtn.textContent = '🔍';
                magnifyBtn.title = '放大圖片';
                magnifyBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    openMagnify(item.image, item.name, false);
                });

                const img = document.createElement('img');
                img.src = item.image;
                img.alt = item.name;
                img.setAttribute('aria-label', item.name);
                img.loading = 'lazy';
                img.onerror = function() {
                    this.style.display = 'none';
                    const fallback = document.createElement('span');
                    fallback.textContent = '🖼️';
                    fallback.style.fontSize = 'calc(40px * var(--ui-scale))';
                    card.appendChild(fallback);
                };

                card.appendChild(magnifyBtn);
                card.appendChild(img);
                card.addEventListener('click', function() { handleDifferentCardClick(index); });
                return card;
            }

            if (count === 5) {
                const topRow = document.createElement('div');
                topRow.className = 'different-row';
                const bottomRow = document.createElement('div');
                bottomRow.className = 'different-row';
                items.forEach((item, index) => {
                    (index < 3 ? topRow : bottomRow).appendChild(createDifferentCard(item, index));
                });
                differentGridContainer.appendChild(topRow);
                differentGridContainer.appendChild(bottomRow);
            } else {
                items.forEach((item, index) => {
                    differentGridContainer.appendChild(createDifferentCard(item, index));
                });
            }
        }

        function handleDifferentCardClick(index) {
            if (differentState.isAnswered || differentState.isWaitingForNext) return;
            const item = differentState.items[index];
            const card = differentGridContainer.querySelector(`.different-card[data-index="${index}"]`);
            if (!item || !card) return;

            if (item.isCorrect) {
                differentState.isAnswered = true;
                differentState.isWaitingForNext = true;
                differentState.score++;
                updateDifferentScore();
                card.classList.add('correct-highlight');
                Array.from(differentGridContainer.querySelectorAll('.different-card')).forEach(child => child.classList.add('disabled'));
                CognitiveAudio.play('correct');
                showCustomMessage(
                    '✅ 正確！',
                    getRandomEncourage(),
                    [{
                        text: '下一題 ➜',
                        class: 'btn-next',
                        action: function() {
                            hideOverlay();
                            nextDifferentRound();
                        }
                    }],
                    false,
                    false
                );
            } else {
                CognitiveAudio.play('wrong');
                card.classList.add('wrong-flash');
                clearTimeout(differentState.wrongFlashTimer);
                differentState.wrongFlashTimer = setTimeout(function() {
                    card.classList.remove('wrong-flash');
                }, 600);
            }
        }

        function updateDifferentScore() {
            differentScoreNum.textContent = differentState.score;
        }

        function updateDifferentRound() {
            differentRoundInfo.textContent = `第 ${differentState.round} 題`;
        }

        function nextDifferentRound() {
            hideOverlay();
            differentState.round++;
            generateDifferentRound();
        }

        function generateDifferentRound() {
            renderDifferentGrid(buildDifferentRound());
            updateDifferentRound();
            differentState.isAnswered = false;
            differentState.isWaitingForNext = false;
        }

        function pauseDifferent() {
            clearTimeout(differentState.wrongFlashTimer);
            differentState.isAnswered = false;
            differentState.isWaitingForNext = false;
        }

        function prepareDifferentGame() {
            pauseDifferent();
            differentState.score = 0;
            differentState.round = 0;
            updateDifferentScore();
            generateDifferentRound();
            showCustomMessage(
                '找出與其他食物不同的一張',
                '',
                [],
                false,
                false,
                true
            );

            if (window.CognitiveRouter) {
                syncTopBarCentering();
            } else {
                differentGameScreen.style.display = 'flex';
                syncTopBarCentering();
            }
        }

        differentBackBtn.addEventListener('click', function() {
            pauseDifferent();
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            } else {
                differentGameScreen.style.display = 'none';
                goToMainMenu();
            }
        });

        differentCountSelect.addEventListener('change', function() {
            const count = parseInt(this.value, 10);
            if (count >= 3 && count <= 6) {
                differentState.imageCount = count;
                if (window.CognitivePrefs) {
                    CognitivePrefs.save('cognitiveDifferentPrefs', { imageCount: count });
                }
                generateDifferentRound();
            }
        });

        updateDifferentScore();
        updateDifferentRound();

        if (window.CognitiveRouter) {
            window.CognitiveRouter.registerEnter('differentGame', prepareDifferentGame);
            window.CognitiveRouter.registerExit('differentGame', pauseDifferent);
        }

        // =============================================================
