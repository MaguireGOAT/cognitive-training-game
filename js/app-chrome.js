        (function () {
            'use strict';

            var store = window.CognitiveSettingsStore;
            var THEME_KEY = store.keys.theme;
            var MUSIC_KEY = store.keys.music;
            var SFX_KEY = store.keys.sfx;
            var audio = window.CognitiveAudio || null;

            function notifySettingsChanged() {
                var event;
                try {
                    event = new CustomEvent('cognitive-settings-changed');
                } catch (e) {
                    event = document.createEvent('Event');
                    event.initEvent('cognitive-settings-changed', false, false);
                }
                document.dispatchEvent(event);
            }

            var settings = {
                theme: store.load(THEME_KEY).theme,
                music: audio ? audio.getMusicEnabled() : store.load(MUSIC_KEY).music,
                sfx: audio ? audio.getSfxEnabled() : store.load(SFX_KEY).sfx,
                setTheme: function (value) {
                    settings.theme = value === 'dark' ? 'dark' : 'light';
                    store.save(THEME_KEY, { theme: settings.theme });
                    applyTheme();
                    updateBadges();
                    notifySettingsChanged();
                },
                setMusic: function (value) {
                    settings.music = !!value;
                    store.save(MUSIC_KEY, { music: settings.music });
                    updateBadges();
                    notifySettingsChanged();
                    if (audio) audio.setMusicEnabled(settings.music);
                },
                setSfx: function (value) {
                    settings.sfx = !!value;
                    store.save(SFX_KEY, { sfx: settings.sfx });
                    updateBadges();
                    notifySettingsChanged();
                    if (audio) audio.setSfxEnabled(settings.sfx);
                }
            };
            window.CognitiveSettings = settings;
            applyTheme();

            function applyTheme() {
                document.documentElement.setAttribute('data-theme', settings.theme);
            }

            function refreshSettingsFromStorage() {
                if (audio) audio.syncFromStorage();
                settings.theme = store.load(THEME_KEY).theme;
                settings.music = audio ? audio.getMusicEnabled() : store.load(MUSIC_KEY).music;
                settings.sfx = audio ? audio.getSfxEnabled() : store.load(SFX_KEY).sfx;
                applyTheme();
                updateBadges();
                notifySettingsChanged();
                if (audio) {
                    if (settings.music) audio.playMusic();
                    else audio.pauseMusic();
                }
            }

            function tryPlayMusic() {
                if (audio) audio.playMusic();
            }

            function badge(on) {
                return on ? '●' : '○';
            }

            function updateBadges() {
                var themeBtn = document.getElementById('slideThemeBtn');
                if (themeBtn) {
                    var dark = settings.theme === 'dark';
                    themeBtn.innerHTML = (dark ? '☀️ 淺色模式' : '🌑 深色模式') +
                        ' <span class="state-badge" id="themeBadge" style="color:' +
                        (dark ? '#42a5f5' : '#888') + ';">' + badge(dark) + '</span>';
                }
                var musicBtn = document.getElementById('slideBgMusicBtn');
                if (musicBtn) {
                    musicBtn.innerHTML = (settings.music ? '🔊 背景音樂' : '🔇 背景音樂') +
                        ' <span class="state-badge" id="bgMusicBadge" style="color:' +
                        (settings.music ? '#42a5f5' : '#888') + ';">' + badge(settings.music) + '</span>';
                }
                var sfxBtn = document.getElementById('slideSfxBtn');
                if (sfxBtn) {
                    sfxBtn.innerHTML = (settings.sfx ? '🔊 音效' : '🔇 音效') +
                        ' <span class="state-badge" id="sfxBadge" style="color:' +
                        (settings.sfx ? '#42a5f5' : '#888') + ';">' + badge(settings.sfx) + '</span>';
                }
            }

            var slideMenu = document.getElementById('slideMenu');

            document.addEventListener('click', function (e) {
                var btn = e.target.closest('.hamburger-btn');
                if (btn) {
                    e.stopPropagation();
                    if (slideMenu) slideMenu.classList.toggle('open');
                }
            });

            document.addEventListener('click', function (e) {
                if (slideMenu && slideMenu.classList.contains('open') &&
                    !slideMenu.contains(e.target) &&
                    !e.target.closest('.hamburger-btn')) {
                    slideMenu.classList.remove('open');
                }
            });

            var themeBtn = document.getElementById('slideThemeBtn');
            if (themeBtn) {
                themeBtn.addEventListener('click', function () {
                    settings.setTheme(settings.theme === 'dark' ? 'light' : 'dark');
                });
            }

            var musicBtn = document.getElementById('slideBgMusicBtn');
            if (musicBtn) {
                musicBtn.addEventListener('click', function () {
                    settings.setMusic(!settings.music);
                });
            }

            var sfxBtn = document.getElementById('slideSfxBtn');
            if (sfxBtn) {
                sfxBtn.addEventListener('click', function () {
                    settings.setSfx(!settings.sfx);
                });
            }

            var homeBtn = document.getElementById('slideHomeBtn');
            if (homeBtn) {
                homeBtn.addEventListener('click', function () {
                    if (slideMenu) slideMenu.classList.remove('open');
                    if (window.CognitiveRouter) {
                        window.CognitiveRouter.goHome();
                    }
                });
            }

            if (window.CognitiveRouter && typeof window.CognitiveRouter.defineScreen === 'function') {
                window.CognitiveRouter.defineScreen('home', { back: 'home' });
            }

            var backButtons = document.querySelectorAll('[data-app-back]');
            for (var i = 0; i < backButtons.length; i++) {
                backButtons[i].addEventListener('click', function () {
                    if (window.CognitiveRouter) {
                        window.CognitiveRouter.goBack();
                    }
                });
            }

            document.addEventListener('pointerdown', function onFirstGesture() {
                tryPlayMusic();
                document.removeEventListener('pointerdown', onFirstGesture);
            });

            refreshSettingsFromStorage();
            setTimeout(tryPlayMusic, 400);

            function pauseAppAudio() {
                if (audio) {
                    audio.pauseMusic();
                    audio.stopFile();
                }
            }

            window.addEventListener('pageshow', refreshSettingsFromStorage);
            window.addEventListener('focus', refreshSettingsFromStorage);
            document.addEventListener('visibilitychange', function () {
                if (document.hidden) {
                    pauseAppAudio();
                } else {
                    refreshSettingsFromStorage();
                }
            });
            window.addEventListener('pagehide', pauseAppAudio);
            window.addEventListener('storage', function (e) {
                if (e.key === null ||
                    e.key === THEME_KEY ||
                    e.key === MUSIC_KEY ||
                    e.key === SFX_KEY) {
                    refreshSettingsFromStorage();
                }
            });

            function isPortraitViewport() {
                if (window.matchMedia && window.matchMedia('(orientation: portrait)').matches) {
                    return true;
                }
                return window.innerHeight > window.innerWidth;
            }

            function updatePortraitLock() {
                var overlay = document.getElementById('portraitLock');
                if (!overlay) return;
                var portrait = isPortraitViewport();
                overlay.classList.toggle('active', portrait);
                overlay.setAttribute('aria-hidden', portrait ? 'false' : 'true');
                if (portrait && window.screen && window.screen.orientation &&
                    typeof window.screen.orientation.lock === 'function') {
                    window.screen.orientation.lock('landscape').catch(function () {});
                }
            }

            updatePortraitLock();
            if (window.matchMedia) {
                var portraitQuery = window.matchMedia('(orientation: portrait)');
                if (portraitQuery.addEventListener) {
                    portraitQuery.addEventListener('change', updatePortraitLock);
                } else if (portraitQuery.addListener) {
                    portraitQuery.addListener(updatePortraitLock);
                }
            }
            window.addEventListener('resize', updatePortraitLock);
        })();
