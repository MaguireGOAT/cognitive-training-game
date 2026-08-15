        (function () {
            'use strict';

            var THEME_KEY = 'cognitiveAppTheme';
            var MUSIC_KEY = 'cognitiveAppMusic';
            var SFX_KEY = 'cognitiveAppSfx';
            var audio = window.CognitiveAudio || null;

            function read(key, fallback) {
                try {
                    var value = localStorage.getItem(key);
                    if (value === null) return fallback;
                    if (value === 'true') return true;
                    if (value === 'false') return false;
                    return value;
                } catch (e) {
                    return fallback;
                }
            }

            function write(key, value) {
                try {
                    localStorage.setItem(key, String(value));
                } catch (e) {}
            }

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
                theme: read(THEME_KEY, 'light') === 'dark' ? 'dark' : 'light',
                music: audio ? audio.getMusicEnabled() : true,
                sfx: audio ? audio.getSfxEnabled() : true,
                save: function () {
                    write(THEME_KEY, settings.theme);
                },
                setTheme: function (value) {
                    settings.theme = value === 'dark' ? 'dark' : 'light';
                    settings.save();
                    applyTheme();
                    updateBadges();
                    notifySettingsChanged();
                },
                setMusic: function (value) {
                    settings.music = !!value;
                    settings.save();
                    updateBadges();
                    notifySettingsChanged();
                    if (audio) audio.setMusicEnabled(settings.music);
                },
                setSfx: function (value) {
                    settings.sfx = !!value;
                    settings.save();
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
                settings.theme = read(THEME_KEY, 'light') === 'dark' ? 'dark' : 'light';
                settings.music = audio ? audio.getMusicEnabled() : true;
                settings.sfx = audio ? audio.getSfxEnabled() : true;
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

            window.addEventListener('pageshow', refreshSettingsFromStorage);
            window.addEventListener('focus', refreshSettingsFromStorage);
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) refreshSettingsFromStorage();
            });
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
