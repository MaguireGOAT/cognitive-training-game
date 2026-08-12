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

        function loadRealitySettings() {
            try {
                const raw = localStorage.getItem(REALITY_STORAGE_KEY);
                if (!raw) return;
                const saved = JSON.parse(raw);
                if (REALITY_WEATHER_OPTIONS.includes(saved.weather)) realityState.weather = saved.weather;
                const oldSeasonNames = { '春': '春天', '夏': '夏天', '秋': '秋天', '冬': '冬天' };
                const seasonValue = oldSeasonNames[saved.season] || saved.season;
                if (REALITY_SEASON_OPTIONS.includes(seasonValue)) realityState.season = seasonValue;
                if (saved.location === '未設定' || REALITY_HOMES.includes(saved.location)) {
                    realityState.location = saved.location;
                }
            } catch (e) {
                // 忽略損毀的儲存資料
            }
        }

        function saveRealitySettings() {
            try {
                localStorage.setItem(REALITY_STORAGE_KEY, JSON.stringify({
                    weather: realityState.weather,
                    season: realityState.season,
                    location: realityState.location,
                }));
            } catch (e) {
                // 忽略儲存失敗
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
                dot.addEventListener('click', () => showRealityPage(index));
                realityDots.appendChild(dot);
            });
        }

        function showRealityPage(index) {
            const pages = getRealityPageNames();
            if (index < 0 || index >= pages.length) return;
            realityState.currentPageIndex = index;
            document.querySelectorAll('.reality-page').forEach(page => {
                page.classList.toggle('active', page.dataset.page === pages[index]);
            });
            updateRealityNav();
            updateRealityDots();
            fitRealityText();
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

        function fitRealityText() {
            if (realityBoard.classList.contains('hidden')) return;
            const vw = document.documentElement.clientWidth;
            const vh = document.documentElement.clientHeight;
            const valueSize = Math.max(36, Math.min(160, Math.floor(Math.min(vw / 7, vh / 4))));
            const labelSize = Math.max(22, Math.min(60, Math.floor(Math.min(vw / 14, vh / 9))));
            realityBoard.style.setProperty('--reality-value-size', valueSize + 'px');
            realityBoard.style.setProperty('--reality-label-size', labelSize + 'px');
            document.querySelectorAll('.reality-value').forEach(el => {
                fitRealityValue(el, valueSize);
            });
            const weatherSize = Math.max(valueSize, Math.min(190, Math.floor(Math.min(vw / 3.8, vh / 2.8))));
            const locationSize = Math.max(valueSize, Math.min(220, Math.floor(Math.min(vw / 4.4, vh / 2.7)))) * 2.25;
            fitRealityValue(realitySeasonText, weatherSize);
            fitRealityValue(realityWeatherText, weatherSize);
            fitRealityValue(realityLocationText, locationSize);
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
        realityPrevBtn.addEventListener('click', () => showRealityPage(realityState.currentPageIndex - 1));
        realityNextBtn.addEventListener('click', () => showRealityPage(realityState.currentPageIndex + 1));

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
            window.CognitiveRouter.registerEnter('realityBoard', function () {
                realityState.currentPageIndex = 0;
                renderRealityBoard();
                fitRealityText();
                startRealityClock();
            });
            window.CognitiveRouter.registerExit('realityBoard', stopRealityClock);
            window.CognitiveRouter.registerEnter('realitySettings', openRealitySettings);
        }
        })();
