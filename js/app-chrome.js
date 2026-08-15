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
            var slideMenuBackdrop = document.getElementById('slideMenuBackdrop');
            var EDGE_PX = 48;
            var DRAG_START_PX = 8;
            var SNAP_RATIO = 0.5;
            var VELOCITY_PX_MS = 0.45;
            var MENU_ANIMATION_MS = 330;
            var menuDrag = null;
            var menuSuppressClickUntil = 0;
            var menuAnimating = false;
            var menuAnimationTimer = null;

            function getUiScale() {
                var scale = 1;
                try {
                    var parsed = parseFloat(
                        getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')
                    );
                    if (!isNaN(parsed) && parsed > 0) scale = parsed;
                } catch (error) {}
                return scale;
            }

            function getEdgeWidth() {
                return EDGE_PX * getUiScale();
            }

            function getMenuWidth() {
                if (!slideMenu) return 300;
                var rect = slideMenu.getBoundingClientRect();
                return rect.width || 300;
            }

            function isRightEdgePointer(e) {
                var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
                return viewportWidth > 0 && e.clientX >= viewportWidth - getEdgeWidth();
            }

            function isInteractiveMenuTarget(target) {
                if (!target || typeof target.closest !== 'function') return false;
                return !!target.closest(
                    '.hamburger-btn, .slide-menu, .slide-menu-backdrop, button, select, a, input, textarea, [role="button"]'
                );
            }

            function clamp(value, min, max) {
                return Math.max(min, Math.min(max, value));
            }

            function clearMenuAnimation() {
                if (menuAnimationTimer) {
                    clearTimeout(menuAnimationTimer);
                    menuAnimationTimer = null;
                }
                menuAnimating = false;
            }

            function finishMenuAnimation() {
                menuAnimationTimer = null;
                menuAnimating = false;
                if (slideMenu) {
                    slideMenu.classList.remove('dragging');
                    slideMenu.classList.remove('closing');
                    slideMenu.style.transform = '';
                }
                if (slideMenuBackdrop) slideMenuBackdrop.style.opacity = '';
            }

            function animateMenuTo(open) {
                if (!slideMenu) return;
                clearMenuAnimation();
                menuDrag = null;
                menuAnimating = true;
                slideMenu.classList.remove('dragging');
                if (slideMenu.offsetWidth) {}
                if (open) {
                    slideMenu.classList.add('open');
                    slideMenu.classList.remove('closing');
                    slideMenu.style.transform = '';
                    if (slideMenuBackdrop) slideMenuBackdrop.style.opacity = '';
                } else {
                    slideMenu.classList.remove('open');
                    slideMenu.classList.add('closing');
                    slideMenu.style.transform = 'translateX(100%)';
                    if (slideMenuBackdrop) slideMenuBackdrop.style.opacity = '0';
                }
                menuAnimationTimer = setTimeout(finishMenuAnimation, MENU_ANIMATION_MS);
            }

            function cancelMenuDrag() {
                if (!menuDrag) return;
                var wasOpen = slideMenu && slideMenu.classList.contains('open');
                var dragging = menuDrag.dragging;
                menuDrag = null;
                if (dragging) animateMenuTo(wasOpen);
            }

            function updateMenuDrag(dx) {
                if (!slideMenu || !slideMenuBackdrop) return;
                var width = Math.max(1, getMenuWidth());
                var progress;
                if (menuDrag.mode === 'open') {
                    progress = clamp(-dx / width, 0, 1);
                    slideMenu.style.transform = 'translateX(' + ((1 - progress) * 100) + '%)';
                    slideMenuBackdrop.style.opacity = String(progress);
                } else {
                    progress = clamp(dx / width, 0, 1);
                    slideMenu.style.transform = 'translateX(' + (progress * 100) + '%)';
                    slideMenuBackdrop.style.opacity = String(1 - progress);
                }
            }

            function finishMenuDrag(clientX) {
                if (!menuDrag) return;
                var mode = menuDrag.mode;
                var wasDragging = menuDrag.dragging;
                var dx = clientX - menuDrag.startX;
                var width = Math.max(1, getMenuWidth());
                var progress;
                var shouldOpen;
                if (mode === 'open') {
                    progress = clamp(-dx / width, 0, 1);
                    shouldOpen = progress >= SNAP_RATIO || menuDrag.velocity < -VELOCITY_PX_MS;
                } else {
                    progress = clamp(dx / width, 0, 1);
                    shouldOpen = !(progress >= SNAP_RATIO || menuDrag.velocity > VELOCITY_PX_MS);
                }
                menuDrag = null;
                if (wasDragging) {
                    menuSuppressClickUntil = Date.now() + 500;
                    animateMenuTo(shouldOpen);
                }
            }

            document.addEventListener('pointerdown', function (e) {
                if (!slideMenu || !slideMenuBackdrop || menuDrag || menuAnimating) return;
                if (!e.isPrimary) return;

                if (slideMenu.classList.contains('open')) {
                    if (slideMenu.contains(e.target) || slideMenuBackdrop.contains(e.target)) {
                        menuDrag = {
                            mode: 'close',
                            pointerId: e.pointerId,
                            startX: e.clientX,
                            startY: e.clientY,
                            dragging: false,
                            velocity: 0,
                            lastX: e.clientX,
                            lastTime: Date.now()
                        };
                    }
                    return;
                }

                if (!isRightEdgePointer(e)) return;
                if (isInteractiveMenuTarget(e.target)) return;

                menuDrag = {
                    mode: 'open',
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    dragging: false,
                    velocity: 0,
                    lastX: e.clientX,
                    lastTime: Date.now()
                };
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                if (document.documentElement &&
                    typeof document.documentElement.setPointerCapture === 'function') {
                    try {
                        document.documentElement.setPointerCapture(e.pointerId);
                    } catch (error) {}
                }
            }, true);

            document.addEventListener('pointermove', function (e) {
                if (!menuDrag || e.pointerId !== menuDrag.pointerId) return;
                var dx = e.clientX - menuDrag.startX;
                var dy = e.clientY - menuDrag.startY;
                var now = Date.now();
                var dt = Math.max(1, now - menuDrag.lastTime);
                var instantVelocity = (e.clientX - menuDrag.lastX) / dt;
                menuDrag.velocity = menuDrag.velocity * 0.7 + instantVelocity * 0.3;
                menuDrag.lastX = e.clientX;
                menuDrag.lastTime = now;
                if (e.cancelable) e.preventDefault();

                if (!menuDrag.dragging) {
                    if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return;
                    if (Math.abs(dx) < Math.abs(dy)) {
                        cancelMenuDrag();
                        return;
                    }
                    menuDrag.dragging = true;
                    slideMenu.classList.add('dragging');
                }
                updateMenuDrag(dx);
            }, { passive: false });

            document.addEventListener('pointerup', function (e) {
                if (menuDrag && e.pointerId === menuDrag.pointerId) {
                    finishMenuDrag(e.clientX);
                }
            });

            document.addEventListener('pointercancel', function (e) {
                if (menuDrag && e.pointerId === menuDrag.pointerId) {
                    cancelMenuDrag();
                }
            });

            document.addEventListener('click', function (e) {
                if (Date.now() < menuSuppressClickUntil) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            }, true);

            document.addEventListener('click', function (e) {
                var btn = e.target.closest('.hamburger-btn');
                if (btn) {
                    e.stopPropagation();
                    if (slideMenu) animateMenuTo(!slideMenu.classList.contains('open'));
                }
            });

            document.addEventListener('click', function (e) {
                if (slideMenu && slideMenu.classList.contains('open') &&
                    !slideMenu.contains(e.target) &&
                    !e.target.closest('.hamburger-btn')) {
                    animateMenuTo(false);
                }
            });

            window.CognitiveMenu = {
                open: function () {
                    animateMenuTo(true);
                },
                close: function () {
                    animateMenuTo(false);
                },
                isOpen: function () {
                    return !!(slideMenu && slideMenu.classList.contains('open'));
                }
            };

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
                    animateMenuTo(false);
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
