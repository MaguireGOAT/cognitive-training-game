        // 第二部分：食物分類遊戲
        // =============================================================

        const foodState = {
            score: 0,
            round: 0,
            imageCount: 3,
            currentCategory: '',
            correctItem: null,
            items: [],
            isAnswered: false,
            isWaitingForNext: false,
            gameMode: 'random',
            usedFoods: new Set(),
            categoryCompleted: {}
        };
        CATEGORY_NAMES.forEach(c => foodState.categoryCompleted[c] = false);
        let showNames = true;

        const grid = document.getElementById('gridContainer');
        const questionText = document.getElementById('questionText');
        const foodScoreNum = document.getElementById('foodScoreNum');
        const foodRoundInfo = document.getElementById('foodRoundInfo');
        const countSelect = document.getElementById('countSelect');
        const toggleNamesBtn = document.getElementById('toggleNamesBtn');
        const foodBackBtn = document.getElementById('foodBackBtn');
        const nameBadge = document.getElementById('nameBadge');

        function getAvailableItems(category) {
            return FOOD_DATA.filter(item => item.category === category && !foodState.usedFoods.has(getFoodId(item)));
        }

        function isCategoryComplete(category) { return getAvailableItems(category).length === 0; }

        function areAllCategoriesComplete() { return CATEGORY_NAMES.every(cat => foodState.categoryCompleted[cat]); }

        function resetFoodProgress() {
            foodState.usedFoods = new Set();
            CATEGORY_NAMES.forEach(c => foodState.categoryCompleted[c] = false);
            foodState.score = 0;
            foodState.round = 0;
            updateFoodScore();
            updateFoodMenuButtons();
        }

        function updateFoodScore() { foodScoreNum.textContent = foodState.score; }

        function updateFoodRound() { foodRoundInfo.textContent = `第 ${foodState.round} 題`; }

        function applyNameVisibility() {
            document.getElementById('foodGame').classList.toggle('hide-names', !showNames);
            document.getElementById('shoppingGame').classList.toggle('hide-names', !showNames);
            const magnifyName = document.getElementById('magnifyName');
            if (magnifyName) {
                magnifyName.style.opacity = showNames ? '1' : '0';
            }
            nameBadge.textContent = showNames ? '●' : '○';
            nameBadge.style.color = showNames ? '#42a5f5' : '#888';
            const shoppingNameBadge = document.getElementById('shoppingNameBadge');
            if (shoppingNameBadge) {
                shoppingNameBadge.textContent = showNames ? '●' : '○';
                shoppingNameBadge.style.color = showNames ? '#42a5f5' : '#888';
            }
        }

        function generateQuestion() {
            let targetCat = foodState.gameMode;
            if (targetCat === 'random') {
                const availableCats = CATEGORY_NAMES.filter(cat => !foodState.categoryCompleted[cat]);
                if (availableCats.length === 0) { showVictoryScreen(); return; }
                const prevCat = foodState.currentCategory;
                let candidates = availableCats.filter(c => c !== prevCat);
                if (candidates.length === 0) candidates = availableCats;
                targetCat = pickRandom(candidates);
            }
            if (foodState.categoryCompleted[targetCat]) {
                if (foodState.gameMode === 'random') {
                    const availableCats = CATEGORY_NAMES.filter(cat => !foodState.categoryCompleted[cat]);
                    if (availableCats.length === 0) { showVictoryScreen(); return; }
                    targetCat = pickRandom(availableCats);
                } else { showCategoryComplete(targetCat); return; }
            }
            foodState.currentCategory = targetCat;

            const availableCorrects = getAvailableItems(targetCat);
            if (availableCorrects.length === 0) {
                foodState.categoryCompleted[targetCat] = true;
                if (foodState.gameMode === 'random') { generateQuestion(); return; } else { showCategoryComplete(
                    targetCat); return; }
            }
            const correct = pickRandom(availableCorrects);
            foodState.correctItem = correct;

            const total = foodState.imageCount;
            const distractorCount = total - 1;
            let distractors = [];
            let otherCats = CATEGORY_NAMES.filter(c => c !== targetCat);
            if (targetCat === '肉類') otherCats = otherCats.filter(c => c !== '海鮮');
            if (targetCat === '海鮮') otherCats = otherCats.filter(c => c !== '肉類');

            let pool = [];
            for (const cat of otherCats) { const items = getAvailableItems(cat);
                pool.push(...items); }
            pool = shuffle(pool);
            for (const item of pool) {
                if (distractors.length >= distractorCount) break;
                if (item.name !== correct.name) distractors.push(item);
            }
            if (distractors.length < distractorCount) {
                let usedPool = FOOD_DATA.filter(item => foodState.usedFoods.has(getFoodId(item)) && item.name !== correct.name &&
                    item.category !== targetCat);
                if (targetCat === '肉類') usedPool = usedPool.filter(item => item.category !== '海鮮');
                if (targetCat === '海鮮') usedPool = usedPool.filter(item => item.category !== '肉類');
                const shuffledUsed = shuffle(usedPool);
                for (const item of shuffledUsed) {
                    if (distractors.length >= distractorCount) break;
                    if (!distractors.some(d => d.name === item.name)) distractors.push(item);
                }
            }
            while (distractors.length < distractorCount) {
                const fallback = FOOD_DATA.filter(item => item.name !== correct.name && item.category !== targetCat);
                if (targetCat === '肉類') {
                    const filtered = fallback.filter(item => item.category !== '海鮮');
                    if (filtered.length > 0) { const pick = pickRandom(filtered); if (!distractors.some(d => d.name === pick
                                .name)) { distractors.push(pick); continue; } }
                } else if (targetCat === '海鮮') {
                    const filtered = fallback.filter(item => item.category !== '肉類');
                    if (filtered.length > 0) { const pick = pickRandom(filtered); if (!distractors.some(d => d.name === pick
                                .name)) { distractors.push(pick); continue; } }
                }
                const pick = pickRandom(fallback);
                if (pick && !distractors.some(d => d.name === pick.name)) distractors.push(pick);
                else break;
            }

            const allItems = [{ ...correct, isCorrect: true }, ...distractors.map(item => ({ ...item, isCorrect: false }))];
            foodState.items = shuffle(allItems);
            foodState.usedFoods.add(getFoodId(correct));
            distractors.forEach(item => foodState.usedFoods.add(getFoodId(item)));

            renderFoodGrid(foodState.items);
            questionText.innerHTML = QUESTION_TEMPLATES[targetCat] || `哪一個是 ${targetCat} ？`;
            updateFoodRound();
            foodState.isAnswered = false;
            foodState.isWaitingForNext = false;
            document.querySelectorAll('.food-card').forEach(card => {
                card.classList.remove('correct-highlight', 'wrong-highlight', 'disabled');
            });
            hideOverlay();
        }

        function renderFoodGrid(items) {
            const total = items.length;
            grid.className = `grid-container cols-${total}`;
            grid.innerHTML = '';
            items.forEach((item, index) => {
                const card = document.createElement('div');
                card.className = 'food-card';
                card.dataset.index = index;
                card.dataset.correct = item.isCorrect ? 'true' : 'false';

                const magnifyBtn = document.createElement('button');
                magnifyBtn.className = 'magnify-btn';
                magnifyBtn.textContent = '🔍';
                magnifyBtn.title = '放大圖片';
                magnifyBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    openMagnify(item.image, item.name);
                });

                const imgWrapper = document.createElement('div');
                imgWrapper.className = 'food-image';
                const img = document.createElement('img');
                img.src = item.image;
                img.alt = item.name;
                img.loading = 'lazy';
                img.onerror = function() {
                    this.style.display = 'none';
                    const fallback = document.createElement('span');
                    fallback.textContent = '🖼️';
                    fallback.style.fontSize = 'calc(50px * var(--ui-scale))';
                    this.parentElement.appendChild(fallback);
                };
                imgWrapper.appendChild(img);

                const nameSpan = document.createElement('div');
                nameSpan.className = 'food-name';
                nameSpan.textContent = item.name;

                card.appendChild(magnifyBtn);
                card.appendChild(imgWrapper);
                card.appendChild(nameSpan);
                card.addEventListener('click', () => handleFoodCardClick(index));
                grid.appendChild(card);
            });
            applyNameVisibility();
        }

        function handleFoodCardClick(index) {
            if (foodState.isAnswered || foodState.isWaitingForNext) return;
            const item = foodState.items[index];
            const cards = document.querySelectorAll('.food-card');
            const card = cards[index];
            if (!card) return;

            if (item.isCorrect) {
                foodState.isAnswered = true;
                foodState.isWaitingForNext = true;
                foodState.score += 1;
                updateFoodScore();
                card.classList.add('correct-highlight');
                cards.forEach(c => c.classList.add('disabled'));
                if (sfxEnabled) playCorrectSound();
                const encourage = getRandomEncourage();
                showAnswerMessage('correct', '✅', '正確！', encourage);
            } else {
                card.classList.add('wrong-highlight');
                if (sfxEnabled) playWrongSound();
                showAnswerMessage('wrong', '🔄', '請再選擇', '再試一次，你可以的！');
                setTimeout(() => { card.classList.remove('wrong-highlight'); }, 600);
            }
        }

        function showAnswerMessage(type, icon, text, sub) {
            const msgIcon = document.getElementById('msgIcon');
            const msgText = document.getElementById('msgText');
            const msgSub = document.getElementById('msgSub');
            const msgBtns = document.getElementById('msgButtons');
            msgIcon.textContent = icon;
            msgText.textContent = text;
            msgText.className = 'msg-text ' + (type === 'correct' ? 'correct' : 'wrong');
            msgSub.textContent = sub || '';
            msgBtns.innerHTML = '';
            if (type === 'correct') {
                const nextBtn = document.createElement('button');
                nextBtn.className = 'btn-next';
                nextBtn.textContent = '下一題 ➜';
                nextBtn.addEventListener('click', function(e) { e.stopPropagation();
                    nextFoodRound(); });
                msgBtns.appendChild(nextBtn);
            }
            document.getElementById('overlay').classList.add('active');
        }

        function nextFoodRound() {
            hideOverlay();
            foodState.round += 1;
            generateQuestion();
        }

        function showCategoryComplete(category) {
            foodState.categoryCompleted[category] = true;
            updateFoodMenuButtons();
            showCustomMessage(
                `${CATEGORY_ICONS[category] || '🎉'} 你已認識所有「${category}」的食物！`,
                '太棒了！繼續挑戰其他類別吧！',
                [{ text: '返回選單', class: 'btn-stay', action: () => { hideOverlay();
                        goToFoodCategorySelect(); } }]
            );
        }

        function showVictoryScreen() {
            showCustomMessage(
                '🏆 恭喜你！',
                '你已經認識了所有類別的所有食物！\n你是真正的食物大師！ 🎉',
                [{ text: '🔄 重新開始', class: 'btn-restart', action: () => { hideOverlay();
                        resetFoodProgress();
                        goToFoodCategorySelect(); } }],
                true
            );
        }

        function buildFoodCategoryGrid() {
            const grid = document.getElementById('foodCategoryGrid');
            grid.innerHTML = '';
            CATEGORY_NAMES.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'category-btn';
                if (foodState.categoryCompleted[cat]) btn.classList.add('completed');
                const icon = CATEGORY_ICONS[cat] || '❓';
                const badge = foodState.categoryCompleted[cat] ? '<span class="complete-badge">✅</span>' : '';
                btn.innerHTML = `<span class="icon">${icon}</span><span class="label">${cat}</span>${badge}`;
                btn.dataset.category = cat;
                btn.addEventListener('click', () => {
                    if (foodState.categoryCompleted[cat]) { showCategoryComplete(cat); return; }
                    startFoodGame(cat);
                });
                grid.appendChild(btn);
            });
            const randomBtn = document.createElement('button');
            const allDone = areAllCategoriesComplete();
            randomBtn.className = 'category-btn random-btn' + (allDone ? ' completed' : '');
            const badge = allDone ? '<span class="complete-badge">✅</span>' : '';
            randomBtn.innerHTML = `<span class="icon">🎲</span><span class="label">隨機</span>${badge}`;
            randomBtn.addEventListener('click', () => {
                if (allDone) { showVictoryScreen(); return; }
                startFoodGame('random');
            });
            grid.appendChild(randomBtn);
        }

        function updateFoodMenuButtons() {
            const grid = document.getElementById('foodCategoryGrid');
            const btns = grid.querySelectorAll('.category-btn');
            btns.forEach(btn => {
                const cat = btn.dataset.category;
                if (cat) {
                    const isComplete = foodState.categoryCompleted[cat] || false;
                    btn.classList.toggle('completed', isComplete);
                    let badge = btn.querySelector('.complete-badge');
                    if (isComplete && !badge) {
                        badge = document.createElement('span');
                        badge.className = 'complete-badge';
                        badge.textContent = '✅';
                        btn.appendChild(badge);
                    } else if (!isComplete && badge) { badge.remove(); }
                }
            });
            const randomBtn = grid.querySelector('.random-btn');
            if (randomBtn) {
                const allDone = areAllCategoriesComplete();
                randomBtn.classList.toggle('completed', allDone);
                let badge = randomBtn.querySelector('.complete-badge');
                if (allDone && !badge) {
                    badge = document.createElement('span');
                    badge.className = 'complete-badge';
                    badge.textContent = '✅';
                    randomBtn.appendChild(badge);
                } else if (!allDone && badge) { badge.remove(); }
            }
        }

        function showFoodGameIntro() {
            const title = questionText.innerHTML.trim();
            showCustomMessage(
                title,
                '',
                [],
                false,
                false,
                true,
                true
            );
        }

        function startFoodGame(mode) {
            if (mode === 'random') resetFoodProgress();
            else {
                foodState.categoryCompleted[mode] = false;
                const toRemove = [];
                foodState.usedFoods.forEach(id => {
                    const item = FOOD_DATA.find(f => getFoodId(f) === id);
                    if (item && item.category === mode) toRemove.push(id);
                });
                toRemove.forEach(id => foodState.usedFoods.delete(id));
            }
            foodState.gameMode = mode;
            foodState.score = 0;
            foodState.round = 0;
            updateFoodScore();
            hideOverlay();
            updateFoodMenuButtons();
            if (window.CognitiveRouter) {
                window.CognitiveRouter.navigate('foodGame');
                nextFoodRound();
                syncTopBarCentering();
                showFoodGameIntro();
            } else {
                document.getElementById('foodGame').style.display = 'flex';
                document.getElementById('foodCategorySelect').classList.add('hidden');
                syncTopBarCentering();
                nextFoodRound();
                showFoodGameIntro();
            }
        }

        function goToFoodCategorySelect() {
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            } else {
                document.getElementById('foodGame').style.display = 'none';
                document.getElementById('foodCategorySelect').classList.remove('hidden');
                buildFoodCategoryGrid();
                updateFoodMenuButtons();
            }
        }

        foodBackBtn.addEventListener('click', goToFoodCategorySelect);
        document.getElementById('foodCategoryBackBtn').addEventListener('click', function() {
            goToMainMenu();
        });

        countSelect.addEventListener('change', function() {
            const count = parseInt(this.value, 10);
            if (count >= 2 && count <= 4) { foodState.imageCount = count;
                generateQuestion(); }
        });
        toggleNamesBtn.addEventListener('click', function() {
            showNames = !showNames;
            applyNameVisibility();
            this.classList.toggle('name-hidden', !showNames);
        });

        if (window.CognitiveRouter) {
            window.CognitiveRouter.registerEnter('foodCategorySelect', function () {
                buildFoodCategoryGrid();
                updateFoodMenuButtons();
            });
            window.CognitiveRouter.registerExit('foodGame', hideOverlay);
        }

        // =============================================================
