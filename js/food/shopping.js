        // =============================================================
        // 第五部分：買餸記憶遊戲
        // =============================================================

        const shoppingState = {
            listDisplayMode: 'image',
            listCount: 3,
            listRevealMode: 'manual',
            listSeconds: 0,
            choiceCount: 6,
            orderRequired: false,
            recallTimed: false,
            recallSeconds: 0,
            score: 0,
            round: 0,
            list: [],
            gridItems: [],
            completedNames: [],
            nextOrderIndex: 0,
            phase: 'list',
            timer: null,
            timerToken: 0,
            countdown: 0,
            roundLocked: false,
            roundCompletePending: false,
            timeoutPending: false,
            feedbackTimer: null,
            wrongFlashTimer: null,
        };

        const shoppingGameScreen = document.getElementById('shoppingGame');
        const shoppingSettingsScreen = document.getElementById('shoppingSettings');
        const shoppingStage = document.getElementById('shoppingStage');
        const shoppingPhaseText = document.getElementById('shoppingPhaseText');
        const shoppingListView = document.getElementById('shoppingListView');
        const shoppingRecallView = document.getElementById('shoppingRecallView');
        const shoppingListGrid = document.getElementById('shoppingListGrid');
        const shoppingListHint = document.getElementById('shoppingListHint');
        const shoppingRecallGrid = document.getElementById('shoppingRecallGrid');
        const shoppingScoreNum = document.getElementById('shoppingScoreNum');
        const shoppingProgress = document.getElementById('shoppingProgress');
        const shoppingTimer = document.getElementById('shoppingTimer');
        const shoppingManualStartBtn = document.getElementById('shoppingManualStartBtn');
        const shoppingNameToggleBtn = document.getElementById('shoppingNameToggleBtn');
        const shoppingBackBtn = document.getElementById('shoppingBackBtn');
        const shoppingSettingsBackBtn = document.getElementById('shoppingSettingsBackBtn');
        const shoppingStartBtn = document.getElementById('shoppingStartBtn');
        const shoppingListDisplayMode = document.getElementById('shoppingListDisplayMode');
        const shoppingListCount = document.getElementById('shoppingListCount');
        const shoppingMemoryTime = document.getElementById('shoppingMemoryTime');
        const shoppingChoiceCount = document.getElementById('shoppingChoiceCount');
        const shoppingOrderRequired = document.getElementById('shoppingOrderRequired');
        const shoppingRecallTime = document.getElementById('shoppingRecallTime');
        const shoppingSaveSettingsBtn = document.getElementById('shoppingSaveSettingsBtn');

        const shoppingPreferences = window.CognitivePrefs ? CognitivePrefs.load(
            'cognitiveShoppingPrefs',
            {
                listDisplayMode: 'image',
                listCount: 3,
                memoryTime: 'manual',
                choiceCount: 6,
                orderRequired: false,
                recallTime: '0'
            },
            {
                listDisplayMode: ['image', 'name'],
                listCount: [2, 3, 4, 5, 6],
                memoryTime: ['5', '10', '15', '20', 'manual'],
                choiceCount: [4, 6, 8],
                orderRequired: 'boolean',
                recallTime: ['0', '15', '30', '45', '60']
            }
        ) : null;

        if (shoppingPreferences) {
            shoppingListDisplayMode.value = shoppingPreferences.listDisplayMode;
            shoppingListCount.value = String(shoppingPreferences.listCount);
            shoppingMemoryTime.value = shoppingPreferences.memoryTime;
            shoppingChoiceCount.value = String(shoppingPreferences.choiceCount);
            shoppingOrderRequired.value = String(shoppingPreferences.orderRequired);
            shoppingRecallTime.value = shoppingPreferences.recallTime;
        }

        if (shoppingSaveSettingsBtn) {
            shoppingSaveSettingsBtn.addEventListener('click', function() {
                const prefs = {
                    listDisplayMode: shoppingListDisplayMode.value,
                    listCount: parseInt(shoppingListCount.value, 10),
                    memoryTime: shoppingMemoryTime.value,
                    choiceCount: parseInt(shoppingChoiceCount.value, 10),
                    orderRequired: shoppingOrderRequired.value === 'true',
                    recallTime: shoppingRecallTime.value
                };
                if (window.CognitivePrefs) {
                    CognitivePrefs.save('cognitiveShoppingPrefs', prefs);
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

        function buildShoppingRound() {
            const shuffled = shuffle(FOOD_DATA);
            const list = [];
            const seenNames = new Set();
            for (const item of shuffled) {
                if (list.length >= shoppingState.listCount) break;
                if (seenNames.has(item.name)) continue;
                seenNames.add(item.name);
                list.push(item);
            }
            const listIds = new Set(list.map(item => getFoodId(item)));
            const distractors = shuffle(FOOD_DATA.filter(item => !listIds.has(getFoodId(item)) && !seenNames.has(item.name)))
                .slice(0, shoppingState.choiceCount - shoppingState.listCount);
            shoppingState.list = list;
            shoppingState.gridItems = shuffle([
                ...list.map(item => ({ ...item, isTarget: true })),
                ...distractors.map(item => ({ ...item, isTarget: false })),
            ]);
            shoppingState.completedNames = [];
            shoppingState.nextOrderIndex = 0;
        }

        function renderShoppingList() {
            const count = shoppingState.list.length;
            shoppingListGrid.className = `shopping-list-grid count-${count}`;
            shoppingListGrid.innerHTML = '';
            const showImage = shoppingState.listDisplayMode !== 'name';
            const showName = shoppingState.listDisplayMode === 'name' || (showImage && showNames);
            shoppingListHint.textContent = shoppingState.listRevealMode === 'timer'
                ? `記住清單，${shoppingState.listSeconds} 秒後開始揀選`
                : '記住清單，準備好後按「開始揀選」';

            shoppingState.list.forEach(item => {
                const card = document.createElement('div');
                card.className = 'shopping-list-card';

                if (showImage) {
                    const magnifyBtn = document.createElement('button');
                    magnifyBtn.className = 'magnify-btn';
                    magnifyBtn.textContent = '🔍';
                    magnifyBtn.title = '放大圖片';
                    magnifyBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        openMagnify(item.image, item.name, showName);
                    });
                    card.appendChild(magnifyBtn);
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
                        fallback.style.fontSize = '44px';
                        this.parentElement.appendChild(fallback);
                    };
                    imgWrapper.appendChild(img);
                    card.appendChild(imgWrapper);
                } else {
                    card.classList.add('name-only');
                }

                if (showName) {
                    const nameSpan = document.createElement('div');
                    nameSpan.className = 'food-name';
                    nameSpan.textContent = item.name;
                    card.appendChild(nameSpan);
                }
                shoppingListGrid.appendChild(card);
            });
        }

        function renderShoppingRecallGrid() {
            const count = shoppingState.gridItems.length;
            shoppingRecallGrid.className = `shopping-recall-grid count-${count}`;
            shoppingRecallGrid.innerHTML = '';
            shoppingState.gridItems.forEach((item, index) => {
                const card = document.createElement('div');
                card.className = 'shopping-recall-card';
                card.dataset.index = index;
                card.dataset.target = item.isTarget ? 'true' : 'false';

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
                    fallback.style.fontSize = '44px';
                    this.parentElement.appendChild(fallback);
                };
                imgWrapper.appendChild(img);

                const nameSpan = document.createElement('div');
                nameSpan.className = 'food-name';
                nameSpan.textContent = item.name;

                const badge = document.createElement('span');
                badge.className = 'shopping-selected-badge';
                badge.textContent = '';
                if (shoppingState.completedNames.includes(getFoodId(item))) {
                    card.classList.add('selected');
                    const orderNumber = shoppingState.list.findIndex(listItem => getFoodId(listItem) === getFoodId(item)) + 1;
                    badge.textContent = shoppingState.orderRequired ? String(orderNumber) : '✓';
                    badge.classList.add('visible');
                }

                card.appendChild(magnifyBtn);
                card.appendChild(badge);
                card.appendChild(imgWrapper);
                card.appendChild(nameSpan);
                card.addEventListener('click', function() { handleShoppingCardClick(index); });
                shoppingRecallGrid.appendChild(card);
            });
            applyNameVisibility();
        }

        function updateShoppingScore() {
            shoppingScoreNum.textContent = shoppingState.score;
        }

        function updateShoppingProgress() {
            const done = shoppingState.completedNames.length;
            const total = shoppingState.list.length;
            shoppingProgress.textContent = done >= total && total > 0
                ? `✅ 已完成 ${total} / ${total}`
                : `已揀選 ${done} / ${total}`;
        }

        function updateShoppingTimer() {
            const active = shoppingState.phase === 'list' || shoppingState.phase === 'recall';
            if (active && shoppingState.timer) {
                shoppingTimer.textContent = `⏱ ${shoppingState.countdown} 秒`;
                shoppingTimer.classList.toggle('alert', shoppingState.countdown <= 5);
            } else {
                shoppingTimer.textContent = '--';
                shoppingTimer.classList.remove('alert');
            }
        }

        function stopShoppingTimer() {
            shoppingState.timerToken++;
            if (shoppingState.timer) {
                clearInterval(shoppingState.timer);
                shoppingState.timer = null;
            }
        }

        function startShoppingCountdown(seconds, onExpire) {
            stopShoppingTimer();
            shoppingState.countdown = seconds;
            const token = ++shoppingState.timerToken;
            shoppingState.timer = setInterval(function() {
                if (token !== shoppingState.timerToken) return;
                shoppingState.countdown--;
                updateShoppingTimer();
                if (shoppingState.countdown <= 0) {
                    stopShoppingTimer();
                    onExpire();
                }
            }, 1000);
            updateShoppingTimer();
        }

        function showShoppingListPhase() {
            stopShoppingTimer();
            shoppingState.phase = 'list';
            shoppingState.roundLocked = false;
            shoppingState.timeoutPending = false;
            shoppingState.completedNames = [];
            shoppingState.nextOrderIndex = 0;
            shoppingListView.classList.remove('hidden');
            shoppingRecallView.classList.add('hidden');
            shoppingManualStartBtn.classList.toggle('hidden', shoppingState.listRevealMode !== 'manual');
            shoppingPhaseText.textContent = `📋 購物清單（${shoppingState.list.length} 樣）`;
            shoppingProgress.classList.add('hidden');
            renderShoppingList();
            updateShoppingProgress();
            clearShoppingFeedback();
            syncTopBarCentering();
            if (shoppingState.listRevealMode === 'timer') {
                startShoppingCountdown(shoppingState.listSeconds, function() {
                    startShoppingRecall();
                });
            } else {
                updateShoppingTimer();
            }
        }

        function startShoppingRecall() {
            stopShoppingTimer();
            shoppingState.phase = 'recall';
            shoppingListView.classList.add('hidden');
            shoppingRecallView.classList.remove('hidden');
            shoppingManualStartBtn.classList.add('hidden');
            shoppingPhaseText.textContent = '揀選清單中的食物';
            shoppingProgress.classList.remove('hidden');
            renderShoppingRecallGrid();
            updateShoppingProgress();
            clearShoppingFeedback();
            syncTopBarCentering();
            if (shoppingState.recallTimed) {
                startShoppingCountdown(shoppingState.recallSeconds, handleShoppingRecallTimeout);
            } else {
                updateShoppingTimer();
            }
        }

        function handleShoppingRecallTimeout() {
            if (shoppingState.roundLocked) return;
            shoppingState.roundLocked = true;
            shoppingState.timeoutPending = true;
            if (sfxEnabled) playWrongSound();
            showShoppingFeedback('⏰ 時間到！再看一次清單', '#ff9800');
            setTimeout(function() {
                showCustomMessage(
                    '⏰ 時間到',
                    '先記住購物清單，再試一次！',
                    [{
                        text: '再看清單',
                        class: 'btn-stay',
                        action: function() {
                            hideOverlay();
                            showShoppingListPhase();
                        }
                    }]
                );
            }, 400);
        }

        function handleShoppingCardClick(index) {
            if (shoppingState.phase !== 'recall' || shoppingState.roundLocked) return;
            const item = shoppingState.gridItems[index];
            const card = shoppingRecallGrid.children[index];
            if (!item || !card) return;
            if (shoppingState.completedNames.includes(getFoodId(item))) return;

            const isExpectedNext = shoppingState.orderRequired
                ? shoppingState.list[shoppingState.nextOrderIndex] &&
                  getFoodId(item) === getFoodId(shoppingState.list[shoppingState.nextOrderIndex])
                : item.isTarget;

            if (item.isTarget && isExpectedNext) {
                shoppingState.completedNames.push(getFoodId(item));
                if (shoppingState.orderRequired) shoppingState.nextOrderIndex++;
                shoppingState.score++;
                updateShoppingScore();
                const orderNumber = shoppingState.list.findIndex(listItem => getFoodId(listItem) === getFoodId(item)) + 1;
                const badge = card.querySelector('.shopping-selected-badge');
                if (badge) {
                    badge.textContent = shoppingState.orderRequired ? String(orderNumber) : '✓';
                    badge.classList.add('visible');
                }
                card.classList.add('selected');
                if (sfxEnabled) playCorrectSound();
                showShoppingFeedback('✅ 正確！', '#3ba87b');
                updateShoppingProgress();
                if (shoppingState.completedNames.length >= shoppingState.list.length) {
                    completeShoppingRound();
                }
            } else {
                if (sfxEnabled) playWrongSound();
                showShoppingFeedback(getRandomWrongEncourage(), '#d95a5a');
                card.classList.add('wrong-flash');
                shoppingState.wrongFlashTimer = setTimeout(function() {
                    card.classList.remove('wrong-flash');
                }, 600);
            }
        }

        function completeShoppingRound() {
            if (shoppingState.roundLocked) return;
            shoppingState.roundLocked = true;
            shoppingState.roundCompletePending = true;
            stopShoppingTimer();
            updateShoppingProgress();
            shoppingRecallGrid.querySelectorAll('.shopping-recall-card').forEach(card => {
                if (!card.classList.contains('selected')) card.classList.add('dimmed');
            });
            if (sfxEnabled) playCorrectSound();
            showCustomMessage(
                '🎉 買餸完成！',
                `你正確揀選了 ${shoppingState.list.length} 樣食物，總得分 ${shoppingState.score}！`,
                [{
                    text: '下一輪 ➜',
                    class: 'btn-restart',
                    action: function() {
                        hideOverlay();
                        shoppingState.roundCompletePending = false;
                        startShoppingRound();
                    }
                }]
            );
        }

        function startShoppingRound() {
            shoppingState.roundCompletePending = false;
            shoppingState.round++;
            buildShoppingRound();
            showShoppingListPhase();
        }

        function startShoppingSession() {
            pauseShopping();
            shoppingState.listDisplayMode = shoppingListDisplayMode.value;
            shoppingState.listCount = parseInt(shoppingListCount.value, 10);
            const memoryTimeValue = shoppingMemoryTime.value;
            shoppingState.listRevealMode = memoryTimeValue === 'manual' ? 'manual' : 'timer';
            shoppingState.listSeconds = memoryTimeValue === 'manual' ? 0 : parseInt(memoryTimeValue, 10);
            shoppingState.choiceCount = Math.max(parseInt(shoppingChoiceCount.value, 10), shoppingState.listCount);
            shoppingState.orderRequired = shoppingOrderRequired.value === 'true';
            const recallTimeValue = shoppingRecallTime.value;
            shoppingState.recallTimed = recallTimeValue !== '0';
            shoppingState.recallSeconds = recallTimeValue === '0' ? 0 : parseInt(recallTimeValue, 10);
            shoppingState.choiceCount = Math.max(
                shoppingState.choiceCount,
                shoppingState.listCount <= 4 ? 4 : 6
            );
            shoppingState.choiceCount = Math.min(shoppingState.choiceCount, 8);
            shoppingChoiceCount.value = String(shoppingState.choiceCount);
            shoppingState.score = 0;
            shoppingState.round = 0;
            updateShoppingScore();
            buildShoppingRound();
            showShoppingListPhase();
        }

        function clearShoppingFeedback() {
            if (shoppingState.feedbackTimer) {
                clearTimeout(shoppingState.feedbackTimer);
                shoppingState.feedbackTimer = null;
            }
            if (shoppingState.wrongFlashTimer) {
                clearTimeout(shoppingState.wrongFlashTimer);
                shoppingState.wrongFlashTimer = null;
            }
            shoppingStage.querySelectorAll('.shopping-feedback').forEach(el => el.remove());
            shoppingRecallGrid.querySelectorAll('.shopping-recall-card.wrong-flash').forEach(el => el.classList.remove('wrong-flash'));
        }

        function showShoppingFeedback(text, color) {
            clearShoppingFeedback();
            const overlay = document.createElement('div');
            overlay.className = 'shopping-feedback';
            overlay.textContent = text;
            overlay.style.color = color;
            shoppingStage.appendChild(overlay);
            shoppingState.feedbackTimer = setTimeout(function() {
                overlay.style.opacity = '0';
                setTimeout(function() { overlay.remove(); }, 300);
            }, 650);
        }

        function pauseShopping() {
            stopShoppingTimer();
            clearShoppingFeedback();
            shoppingState.roundLocked = false;
            shoppingState.roundCompletePending = false;
            shoppingState.timeoutPending = false;
        }

        shoppingManualStartBtn.addEventListener('click', function() {
            if (shoppingState.phase !== 'list') return;
            startShoppingRecall();
        });

        shoppingNameToggleBtn.addEventListener('click', function() {
            showNames = !showNames;
            applyNameVisibility();
            this.classList.toggle('name-hidden', !showNames);
            if (shoppingState.phase === 'list') renderShoppingList();
        });

        shoppingStartBtn.addEventListener('click', function() {
            if (window.CognitiveRouter) {
                window.CognitiveRouter.navigate('shoppingGame');
                syncTopBarCentering();
                startShoppingSession();
            } else {
                shoppingSettingsScreen.classList.add('hidden');
                shoppingGameScreen.style.display = 'flex';
                syncTopBarCentering();
                startShoppingSession();
            }
        });

        shoppingBackBtn.addEventListener('click', function() {
            pauseShopping();
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            } else {
                shoppingGameScreen.style.display = 'none';
                shoppingSettingsScreen.classList.remove('hidden');
            }
        });

        shoppingSettingsBackBtn.addEventListener('click', function() {
            pauseShopping();
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            } else {
                shoppingSettingsScreen.classList.add('hidden');
                goToMainMenu();
            }
        });

        shoppingScoreNum.textContent = '0';
        shoppingProgress.textContent = '已揀選 0 / 3';
        shoppingTimer.textContent = '--';

        if (window.CognitiveRouter) {
            window.CognitiveRouter.registerExit('shoppingGame', pauseShopping);
            window.CognitiveRouter.registerExit('shoppingSettings', pauseShopping);
        }

        // =============================================================
