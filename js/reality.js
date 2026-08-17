        // =============================================================
        // 第六部分：現實導向（Reality Orientation）
        // =============================================================
        (function () {
            'use strict';

        const REALITY_STORAGE_KEY = 'realityOrientationSettings';
        const REALITY_WEATHER_OPTIONS = ['未設定', '晴', '陰', '雨', '雷暴'];
        const REALITY_SEASON_OPTIONS = ['自動', '春天', '夏天', '秋天', '冬天'];
        const REALITY_WEATHER_EMOJIS = { '晴': '☀️', '陰': '☁️', '雨': '🌧️', '雷暴': '⛈️' };
        const REALITY_HOMES = [
            '鰂魚涌富璟',
            '油塘康璟',
            '筲箕灣聖輝',
            '新蒲崗康璟',
            '觀塘慶樺',
            '深水埗慶楠',
            '荃灣慶楠',
            '上水慶楠',
            '沙田富璟',
            '大埔富樺',
            '上水富璟',
            '沙田第一城富璟',
        ];
        const REALITY_HOME_REGIONS = {
            '鰂魚涌富璟': '鰂魚涌',
            '油塘康璟': '油塘',
            '筲箕灣聖輝': '筲箕灣',
            '新蒲崗康璟': '新蒲崗',
            '觀塘慶樺': '觀塘',
            '深水埗慶楠': '深水埗',
            '荃灣慶楠': '荃灣',
            '上水慶楠': '上水',
            '沙田富璟': '沙田',
            '大埔富樺': '大埔',
            '上水富璟': '上水',
            '沙田第一城富璟': '沙田第一城',
        };
        const REALITY_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

        let realityState = {
            weather: '晴',
            season: '自動',
            location: '未設定',
            currentPageIndex: 0,
        };

        const realityBoard = document.getElementById('realityBoard');
        const realitySettings = document.getElementById('realitySettings');
        const realityTime = document.getElementById('realityTime');
        const realityDate = document.getElementById('realityDate');
        const realitySeasonText = document.getElementById('realitySeasonText');
        const realityWeatherBlock = document.getElementById('realityWeatherBlock');
        const realityWeatherIcon = document.getElementById('realityWeatherIcon');
        const realityWeatherText = document.getElementById('realityWeatherText');
        const realityLocationText = document.getElementById('realityLocationText');
        const realityDots = document.getElementById('realityDots');
        const realityPrevBtn = document.getElementById('realityPrevBtn');
        const realityNextBtn = document.getElementById('realityNextBtn');
        const realityBackBtn = document.getElementById('realityBackBtn');
        const realityEditBtn = document.getElementById('realityEditBtn');
        const realitySettingsBackBtn = document.getElementById('realitySettingsBackBtn');
        const realityDoneBtn = document.getElementById('realityDoneBtn');
        const realityWeatherSelect = document.getElementById('realityWeatherSelect');
        const realitySeasonSelect = document.getElementById('realitySeasonSelect');
        const realityLocationSelect = document.getElementById('realityLocationSelect');
        const realityStage = document.getElementById('realityStage');

        function loadRealitySettings() {
            const saved = window.CognitiveSettingsStore
                ? CognitiveSettingsStore.load(REALITY_STORAGE_KEY)
                : null;
            if (!saved) return;
            realityState.weather = saved.weather;
            realityState.season = saved.season;
            realityState.location = saved.location;
        }

        function saveRealitySettings() {
            if (window.CognitiveSettingsStore) {
                CognitiveSettingsStore.save(REALITY_STORAGE_KEY, {
                    weather: realityState.weather,
                    season: realityState.season,
                    location: realityState.location
                });
            }
        }

        function getRealitySeason() {
            const month = new Date().getMonth() + 1;
            if (month >= 3 && month <= 5) return '春天';
            if (month >= 6 && month <= 8) return '夏天';
            if (month >= 9 && month <= 11) return '秋天';
            return '冬天';
        }

        function updateRealityClock() {
            const now = new Date();
            let hour = now.getHours();
            const period = hour < 12 ? '上午' : '下午';
            hour = hour % 12;
            if (hour === 0) hour = 12;
            realityTime.innerHTML =
                `<span class="reality-time-digits">${String(hour).padStart(2, '0')}</span>` +
                `<span class="reality-static">:</span>` +
                `<span class="reality-time-digits">${String(now.getMinutes()).padStart(2, '0')}</span>` +
                `<span class="reality-static"> ${period}</span>`;
            realityDate.innerHTML =
                `<span class="reality-date-main">` +
                `<span class="reality-time-digits">${now.getFullYear()}</span>` +
                `<span class="reality-static"> 年 </span>` +
                `<span class="reality-time-digits">${now.getMonth() + 1}</span>` +
                `<span class="reality-static"> 月 </span>` +
                `<span class="reality-time-digits">${now.getDate()}</span>` +
                `<span class="reality-static"> 日</span>` +
                `</span>` +
                `<span class="reality-date-weekday"><span class="reality-static">（星期</span>` +
                `<span class="reality-weekday">${REALITY_WEEKDAYS[now.getDay()]}</span>` +
                `<span class="reality-static">）</span></span>`;

            const season = realityState.season === '自動' ? getRealitySeason() : realityState.season;
            realitySeasonText.textContent = season;
        }

        function getRealityPageNames() {
            const pages = ['date', 'time', 'season'];
            if (realityState.location !== '未設定') pages.push('location');
            return pages;
        }

        function setRealityPageVisibility() {
            const pages = getRealityPageNames();
            document.querySelectorAll('.reality-page').forEach(page => {
                page.classList.toggle('hidden', !pages.includes(page.dataset.page));
            });
        }

        function updateRealityNav() {
            const pages = getRealityPageNames();
            realityPrevBtn.disabled = realityState.currentPageIndex <= 0;
            realityNextBtn.disabled = realityState.currentPageIndex >= pages.length - 1;
        }

        function updateRealityDots() {
            realityDots.innerHTML = '';
            getRealityPageNames().forEach((name, index) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'reality-dot' + (index === realityState.currentPageIndex ? ' active' : '');
                dot.setAttribute('aria-label', `第 ${index + 1} 頁`);
                dot.addEventListener('click', () => {
                    animateRealityPageTo(realityState.currentPageIndex, index, 0);
                });
                realityDots.appendChild(dot);
            });
        }

        let realityTransitionToken = 0;
        let realityTransitionTimer = null;
        let realityVisiblePage = null;
        let realitySwipe = null;

        function withoutRealityTransitions(callback) {
            if (realityStage) realityStage.classList.add('reality-clearing');
            try {
                callback();
                if (realityStage) void realityStage.offsetWidth;
                document.querySelectorAll('.reality-page').forEach(page => {
                    void getComputedStyle(page).transform;
                    void getComputedStyle(page).opacity;
                });
            } finally {
                if (realityStage) realityStage.classList.remove('reality-clearing');
            }
        }

        function clearRealityTransition() {
            realityTransitionToken++;
            if (realityTransitionTimer) {
                clearTimeout(realityTransitionTimer);
                realityTransitionTimer = null;
            }
            realitySwipe = null;
            if (realityStage) realityStage.classList.remove('reality-dragging');
            if (realityStage) realityStage.classList.remove('reality-bounce');
            withoutRealityTransitions(function() {
                document.querySelectorAll('.reality-page').forEach(page => {
                    page.classList.remove(
                        'slide-in-left', 'slide-in-right', 'slide-out-left', 'slide-out-right',
                        'dismissed-left', 'dismissed-right'
                    );
                    page.style.transform = '';
                    page.style.opacity = '';
                    page.style.pointerEvents = '';
                });
                setRealityPageVisibility();
            });
        }

        function getRealityPageByIndex(index) {
            const pages = getRealityPageNames();
            if (index < 0 || index >= pages.length) return null;
            return document.querySelector('.reality-page[data-page="' + pages[index] + '"]');
        }

        function showRealityPage(index) {
            const pages = getRealityPageNames();
            if (index < 0 || index >= pages.length) return;
            clearRealityTransition();
            realityState.currentPageIndex = index;
            document.querySelectorAll('.reality-page').forEach(page => {
                page.classList.remove('active');
            });
            const page = getRealityPageByIndex(index);
            if (!page) return;
            page.classList.add('active');
            realityVisiblePage = page;
            updateRealityNav();
            updateRealityDots();
            fitRealityText();
        }

        function animateRealityPageTo(startIndex, targetIndex, fromDx) {
            const pages = getRealityPageNames();
            if (targetIndex < 0 || targetIndex >= pages.length) return;
            clearRealityTransition();

            const startPage = getRealityPageByIndex(startIndex);
            const targetPage = getRealityPageByIndex(targetIndex);
            if (!startPage || !targetPage) return;

            realityState.currentPageIndex = targetIndex;
            updateRealityNav();
            updateRealityDots();

            if (startIndex === targetIndex || startPage === targetPage) {
                targetPage.classList.add('active');
                realityVisiblePage = targetPage;
                fitRealityText();
                return;
            }

            const width = realityStage ? (realityStage.clientWidth || window.innerWidth) : window.innerWidth;
            const direction = targetIndex > startIndex ? 1 : -1;
            const targetStartX = fromDx + direction * width;
            const startEndX = -direction * width;

            document.querySelectorAll('.reality-page').forEach(page => {
                if (pages.includes(page.dataset.page)) {
                    page.classList.remove('hidden');
                    page.classList.remove('active');
                    page.style.opacity = '0';
                    page.style.pointerEvents = 'none';
                    page.style.transform = '';
                } else {
                    page.style.opacity = '0';
                    page.style.pointerEvents = 'none';
                }
            });

            startPage.style.opacity = '1';
            targetPage.style.opacity = '1';
            targetPage.classList.add('active');
            startPage.style.transform = 'translate3d(' + fromDx + 'px, 0, 0)';
            targetPage.style.transform = 'translate3d(' + targetStartX + 'px, 0, 0)';

            if (realityStage) realityStage.classList.add('reality-dragging');
            if (startPage) void getComputedStyle(startPage).transform;
            if (realityStage) realityStage.classList.remove('reality-dragging');
            if (startPage) void getComputedStyle(startPage).transform;

            startPage.style.transform = 'translate3d(' + startEndX + 'px, 0, 0)';
            targetPage.style.transform = 'translate3d(0, 0, 0)';

            const token = ++realityTransitionToken;
            realityTransitionTimer = setTimeout(function() {
                if (token !== realityTransitionToken) return;
                clearRealityDragStyles();
                document.querySelectorAll('.reality-page').forEach(page => {
                    page.classList.remove('active');
                });
                targetPage.classList.add('active');
                realityVisiblePage = targetPage;
                updateRealityNav();
                updateRealityDots();
                fitRealityText();
                realityTransitionTimer = null;
            }, 330);
        }

        function bounceRealityPage(fromDx) {
            const pages = getRealityPageNames();
            const currentPage = getRealityPageByIndex(realityState.currentPageIndex);
            if (!currentPage) return;
            clearRealityTransition();

            document.querySelectorAll('.reality-page').forEach(page => {
                if (pages.includes(page.dataset.page)) {
                    page.classList.remove('hidden');
                    page.classList.remove('active');
                    page.style.opacity = '0';
                    page.style.pointerEvents = 'none';
                    page.style.transform = '';
                } else {
                    page.style.opacity = '0';
                    page.style.pointerEvents = 'none';
                }
            });

            currentPage.style.opacity = '1';
            currentPage.classList.add('active');
            currentPage.style.pointerEvents = 'auto';
            currentPage.style.transform = 'translate3d(' + fromDx + 'px, 0, 0)';

            if (realityStage) realityStage.classList.add('reality-dragging');
            void currentPage.offsetWidth;
            if (realityStage) realityStage.classList.remove('reality-dragging');

            if (realityStage) realityStage.classList.add('reality-bounce');
            currentPage.style.transform = 'translate3d(0, 0, 0)';

            const token = ++realityTransitionToken;
            realityTransitionTimer = setTimeout(function() {
                if (token !== realityTransitionToken) return;
                clearRealityDragStyles();
                document.querySelectorAll('.reality-page').forEach(page => {
                    page.classList.remove('active');
                });
                currentPage.classList.add('active');
                realityVisiblePage = currentPage;
                updateRealityNav();
                updateRealityDots();
                fitRealityText();
                realityTransitionTimer = null;
            }, 420);
        }

        function renderRealityBoard() {
            updateRealityClock();
            const hasWeather = realityState.weather !== '未設定';
            realityWeatherBlock.classList.toggle('hidden', !hasWeather);
            if (hasWeather) {
                realityWeatherIcon.textContent = REALITY_WEATHER_EMOJIS[realityState.weather] || '';
                realityWeatherText.textContent = realityState.weather;
            }
            renderRealityLocationText();
            setRealityPageVisibility();
            const pages = getRealityPageNames();
            realityState.currentPageIndex = Math.max(0, Math.min(realityState.currentPageIndex, pages.length - 1));
            showRealityPage(realityState.currentPageIndex);
        }

        function renderRealityLocationText() {
            realityLocationText.innerHTML = '';
            if (realityState.location === '未設定') {
                realityLocationText.textContent = '未設定';
                return;
            }
            const region = REALITY_HOME_REGIONS[realityState.location] || realityState.location;
            const homeName = region === realityState.location ? '' : realityState.location.slice(region.length);
            const regionSpan = document.createElement('span');
            regionSpan.className = 'reality-location-region';
            regionSpan.textContent = region;
            realityLocationText.appendChild(regionSpan);
            realityLocationText.appendChild(document.createElement('br'));
            if (homeName) {
                const homeSpan = document.createElement('span');
                homeSpan.className = 'reality-location-home';
                homeSpan.textContent = homeName;
                realityLocationText.appendChild(homeSpan);
            }
            const suffixSpan = document.createElement('span');
            suffixSpan.className = 'reality-location-suffix';
            suffixSpan.textContent = '護老院';
            realityLocationText.appendChild(suffixSpan);
        }

        function fitRealityValue(el, maxSize) {
            let size = maxSize;
            const maxHeight = parseFloat(getComputedStyle(el).maxHeight);
            el.style.fontSize = size + 'px';
            while (size > 18 && (el.scrollWidth > el.clientWidth + 2 || (maxHeight && el.scrollHeight > maxHeight + 4))) {
                size -= 2;
                el.style.fontSize = size + 'px';
            }
        }

        function getRealityUiScale() {
            let scale = 1;
            try {
                const parsed = parseFloat(
                    getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')
                );
                if (!isNaN(parsed) && parsed > 0) scale = parsed;
            } catch (error) {}
            return scale;
        }

        function fitRealityText() {
            if (realityBoard.classList.contains('hidden')) return;
            const uiScale = getRealityUiScale();
            const valueSize = Math.max(36, Math.round(210 * uiScale));
            const labelSize = Math.max(22, Math.round(76 * uiScale));
            realityBoard.style.setProperty('--reality-value-size', valueSize + 'px');
            realityBoard.style.setProperty('--reality-label-size', labelSize + 'px');
            document.querySelectorAll('.reality-value').forEach(el => {
                fitRealityValue(el, valueSize);
            });
            const weatherSize = Math.max(valueSize, Math.round(260 * uiScale));
            const locationSize = Math.max(valueSize, Math.round(525 * uiScale));
            fitRealityValue(realitySeasonText, weatherSize);
            fitRealityValue(realityWeatherText, weatherSize);
            fitRealityValue(realityLocationText, locationSize);
            fitRealityValue(realityTime, valueSize * 0.8);
            fitRealityValue(realityDate, valueSize * 1.5);
        }

        function openRealitySettings() {
            realityWeatherSelect.value = realityState.weather;
            realitySeasonSelect.value = realityState.season;
            realityLocationSelect.value = realityState.location;
        }

        let realityClockTimer = null;

        function startRealityClock() {
            stopRealityClock();
            updateRealityClock();
            realityClockTimer = setInterval(() => {
                if (!realityBoard.classList.contains('hidden')) updateRealityClock();
            }, 1000);
        }

        function stopRealityClock() {
            if (realityClockTimer) {
                clearInterval(realityClockTimer);
                realityClockTimer = null;
            }
        }

        realityEditBtn.addEventListener('click', function () {
            if (window.CognitiveRouter) window.CognitiveRouter.navigate('realitySettings');
        });
        realitySettingsBackBtn.addEventListener('click', function () {
            if (window.CognitiveRouter) window.CognitiveRouter.goBack();
        });
        realityDoneBtn.addEventListener('click', function () {
            if (window.CognitiveRouter) window.CognitiveRouter.goBack();
        });
        realityBackBtn.addEventListener('click', function () {
            if (window.CognitiveRouter) window.CognitiveRouter.goBack();
        });
        realityPrevBtn.addEventListener('click', () => {
            animateRealityPageTo(realityState.currentPageIndex, realityState.currentPageIndex - 1, 0);
        });
        realityNextBtn.addEventListener('click', () => {
            animateRealityPageTo(realityState.currentPageIndex, realityState.currentPageIndex + 1, 0);
        });

        function clearRealityDragStyles() {
            realitySwipe = null;
            if (realityStage) realityStage.classList.remove('reality-dragging');
            if (realityStage) realityStage.classList.remove('reality-bounce');
            withoutRealityTransitions(function() {
                document.querySelectorAll('.reality-page').forEach(page => {
                    page.style.transform = '';
                    page.style.opacity = '';
                    page.style.pointerEvents = '';
                    page.style.zIndex = '';
                });
                setRealityPageVisibility();
            });
        }

        function updateRealityDragTransform() {
            if (!realitySwipe) return;
            const pages = getRealityPageNames();
            const startIndex = realitySwipe.startIndex;
            const dx = realitySwipe.currentDx;
            const width = realitySwipe.width || realityStage.clientWidth || window.innerWidth;
            const currentPage = document.querySelector('.reality-page[data-page="' + pages[startIndex] + '"]');
            const prevPage = startIndex > 0 ? document.querySelector('.reality-page[data-page="' + pages[startIndex - 1] + '"]') : null;
            const nextPage = startIndex < pages.length - 1 ? document.querySelector('.reality-page[data-page="' + pages[startIndex + 1] + '"]') : null;

            document.querySelectorAll('.reality-page').forEach(page => {
                if (pages.includes(page.dataset.page)) {
                    page.classList.remove('hidden');
                    page.style.opacity = '1';
                    page.style.pointerEvents = 'none';
                    page.style.transform = '';
                    page.classList.remove('active');
                    const pageIndex = pages.indexOf(page.dataset.page);
                    if (pageIndex !== startIndex && pageIndex !== startIndex - 1 && pageIndex !== startIndex + 1) {
                        page.style.opacity = '0';
                    }
                } else {
                    page.style.opacity = '0';
                    page.style.pointerEvents = 'none';
                }
            });
            if (currentPage) {
                currentPage.classList.add('active');
                currentPage.style.transform = 'translate3d(' + dx + 'px, 0, 0)';
            }
            if (prevPage) prevPage.style.transform = 'translate3d(' + (dx - width) + 'px, 0, 0)';
            if (nextPage) nextPage.style.transform = 'translate3d(' + (dx + width) + 'px, 0, 0)';
        }

        function finishRealityDrag(e) {
            if (!realitySwipe || e.pointerId !== realitySwipe.id) return;
            const swipe = realitySwipe;
            const pages = getRealityPageNames();
            const width = swipe.width || realityStage.clientWidth || window.innerWidth;
            const dx = e.clientX - swipe.startX;
            realitySwipe = null;

            if (!swipe.dragging) {
                clearRealityDragStyles();
                return;
            }

            e.preventDefault();
            const elapsed = Math.max(1, performance.now() - swipe.startTime);
            const averageVelocity = Math.abs(dx) / elapsed;
            const sinceLastMove = Math.max(1, performance.now() - swipe.lastTime);
            const lastMoveVelocity = Math.abs(e.clientX - swipe.lastX) / sinceLastMove;
            const velocity = Math.max(
                Math.abs(swipe.velocity || 0),
                averageVelocity,
                lastMoveVelocity
            );
            const distanceThreshold = Math.max(36, width * 0.12);
            const velocityThreshold = 0.55;
            let targetIndex = swipe.startIndex;
            if (dx <= -distanceThreshold && targetIndex < pages.length - 1) targetIndex++;
            else if (dx >= distanceThreshold && targetIndex > 0) targetIndex--;
            else if (dx < -12 && targetIndex < pages.length - 1 && velocity >= velocityThreshold) targetIndex++;
            else if (dx > 12 && targetIndex > 0 && velocity >= velocityThreshold) targetIndex--;

            if (targetIndex === swipe.startIndex) {
                bounceRealityPage(dx);
                return;
            }

            animateRealityPageTo(swipe.startIndex, targetIndex, dx);
        }

        if (realityStage) {
            realityStage.addEventListener('pointerdown', function(e) {
                if (!e.isPrimary) return;
                if (e.target.closest('button, select, a')) return;
                clearRealityTransition();
                realitySwipe = {
                    id: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    startIndex: realityState.currentPageIndex,
                    width: realityStage.clientWidth || window.innerWidth,
                    currentDx: 0,
                    startTime: performance.now(),
                    lastX: e.clientX,
                    lastTime: performance.now(),
                    velocity: 0,
                    dragging: false
                };
                try {
                    realityStage.setPointerCapture(e.pointerId);
                } catch (err) {
                    // Pointer capture can fail in a few older browsers; drag still works.
                }
            });
            realityStage.addEventListener('pointermove', function(e) {
                if (!realitySwipe || e.pointerId !== realitySwipe.id) return;
                const dx = e.clientX - realitySwipe.startX;
                const dy = e.clientY - realitySwipe.startY;
                const now = performance.now();
                const dt = Math.max(1, now - realitySwipe.lastTime);
                const instant = (e.clientX - realitySwipe.lastX) / dt;
                realitySwipe.velocity = realitySwipe.velocity * 0.6 + instant * 0.4;
                realitySwipe.lastX = e.clientX;
                realitySwipe.lastTime = now;
                if (!realitySwipe.dragging) {
                    if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
                    realitySwipe.dragging = true;
                    realityStage.classList.add('reality-dragging');
                }
                e.preventDefault();
                realitySwipe.currentDx = dx;
                updateRealityDragTransform();
            });
            realityStage.addEventListener('pointerup', function(e) {
                finishRealityDrag(e);
            });
            realityStage.addEventListener('pointercancel', function() {
                clearRealityDragStyles();
            });
        }

        realityWeatherSelect.addEventListener('change', function() {
            realityState.weather = this.value;
            saveRealitySettings();
            renderRealityBoard();
        });

        realitySeasonSelect.addEventListener('change', function() {
            realityState.season = this.value;
            saveRealitySettings();
            renderRealityBoard();
        });

        realityLocationSelect.addEventListener('change', function() {
            realityState.location = this.value;
            saveRealitySettings();
            renderRealityBoard();
        });

        window.addEventListener('resize', function() {
            if (!realityBoard.classList.contains('hidden')) renderRealityBoard();
        });

        loadRealitySettings();
        updateRealityClock();

        if (window.CognitiveRouter) {
            window.CognitiveRouter.defineScreen('realityBoard', {
                enter: function () {
                    realityState.currentPageIndex = 0;
                    renderRealityBoard();
                    fitRealityText();
                    startRealityClock();
                },
                exit: stopRealityClock,
                back: 'home'
            });
            window.CognitiveRouter.defineScreen('realitySettings', {
                enter: openRealitySettings,
                back: 'realityBoard'
            });
        }
        })();
