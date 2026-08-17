        // ---- 共用彈窗 ----
        function hideOverlay() {
            if (window.CognitiveMessage) window.CognitiveMessage.close();
        }

        // ---- 共用即時回饋（正確／錯誤提示） ----
        window.CognitiveFeedback = {
            _entries: new WeakMap(),
            show: function (host, text, color) {
                const hostEl = typeof host === 'string' ? document.getElementById(host) : host;
                if (!hostEl) return;
                this.clear(hostEl);
                const pill = document.createElement('div');
                pill.className = 'feedback-pill';
                pill.textContent = text;
                if (color) pill.style.color = color;
                hostEl.appendChild(pill);
                const timer = setTimeout(function () {
                    pill.style.opacity = '0';
                    setTimeout(function () { if (pill.parentNode) pill.remove(); }, 300);
                }, 650);
                this._entries.set(hostEl, { pill: pill, timer: timer });
            },
            clear: function (host) {
                const hostEl = typeof host === 'string' ? document.getElementById(host) : host;
                if (!hostEl) return;
                const entry = this._entries.get(hostEl);
                if (entry) {
                    clearTimeout(entry.timer);
                    if (entry.pill.parentNode) entry.pill.remove();
                    this._entries.delete(hostEl);
                }
                hostEl.querySelectorAll('.feedback-pill').forEach(function (el) { el.remove(); });
            }
        };

        // ---- 共用圖片切換動畫 ----
        (function () {
            var reducedMotion = false;
            if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
                try { reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
            }
            var fadeDuration = reducedMotion ? 60 : 150;

            function fadeInCards(cards) {
                for (var i = 0; i < cards.length; i++) {
                    cards[i].classList.add('card-fade-in');
                }
                setTimeout(function () {
                    for (var i = 0; i < cards.length; i++) {
                        cards[i].classList.remove('card-fade-in');
                    }
                }, fadeDuration + 50);
            }

            function fadeSwap(options) {
                var container = options.container;
                var renderFn = options.render;
                var selector = options.selector;

                if (!container || !renderFn) { if (renderFn) renderFn(); return; }

                var oldCards = selector ? container.querySelectorAll(selector) : container.children;
                var hasOld = oldCards && oldCards.length > 0;

                if (!hasOld) {
                    renderFn();
                    var newCards = selector ? container.querySelectorAll(selector) : container.children;
                    fadeInCards(newCards);
                    return;
                }

                for (var i = 0; i < oldCards.length; i++) {
                    oldCards[i].classList.add('card-fade-out');
                }
                setTimeout(function () {
                    renderFn();
                    var newCards = selector ? container.querySelectorAll(selector) : container.children;
                    fadeInCards(newCards);
                }, fadeDuration);
            }

            window.CognitiveAnimations = { fadeSwap: fadeSwap };
        })();

        // ---- 共用圖片放大 ----
        function openMagnify(src, name, showNameOverride) {
            const overlay = document.getElementById('magnifyOverlay');
            const image = document.getElementById('magnifyImage');
            const nameEl = document.getElementById('magnifyName');
            nameEl.textContent = name;
            if (typeof showNameOverride === 'boolean') {
                nameEl.style.opacity = showNameOverride ? '1' : '0';
            } else {
                const foodHidden = document.getElementById('foodGame').classList.contains('hide-names');
                const shoppingHidden = document.getElementById('shoppingGame').classList.contains('hide-names');
                nameEl.style.opacity = (foodHidden || shoppingHidden) ? '0' : '1';
            }
            image.onload = sizeMagnifyImage;
            image.onerror = sizeMagnifyImage;
            image.src = src;
            overlay.classList.add('active');
            sizeMagnifyImage();
        }

        function sizeMagnifyImage() {
            const overlay = document.getElementById('magnifyOverlay');
            const image = document.getElementById('magnifyImage');
            const box = overlay.querySelector('.magnify-box');
            const wrapper = overlay.querySelector('.image-wrapper');
            if (!box || !wrapper || !overlay.classList.contains('active')) return;

            const prevWidth = wrapper.style.width;
            const prevHeight = wrapper.style.height;
            wrapper.style.width = '1px';
            wrapper.style.height = '1px';
            const boxRect = box.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();
            const nonImageW = Math.max(0, boxRect.width - wrapperRect.width);
            const nonImageH = Math.max(0, boxRect.height - wrapperRect.height);
            wrapper.style.width = prevWidth || '1px';
            wrapper.style.height = prevHeight || '1px';

            const pad = 20;
            const availW = Math.max(160, window.innerWidth - nonImageW - pad);
            const availH = Math.max(160, window.innerHeight - nonImageH - pad);
            const naturalW = image.naturalWidth || availW;
            const naturalH = image.naturalHeight || availW;
            const scale = Math.min(availW / naturalW, availH / naturalH);
            wrapper.style.width = Math.round(naturalW * scale) + 'px';
            wrapper.style.height = Math.round(naturalH * scale) + 'px';
        }

        document.getElementById('magnifyCloseBtn').addEventListener('click', function() {
            document.getElementById('magnifyOverlay').classList.remove('active');
        });
        document.getElementById('magnifyOverlay').addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });
        window.addEventListener('resize', sizeMagnifyImage);

        let topBarCenteringBusy = false;

        function syncTopBarCentering() {
            if (topBarCenteringBusy) return;
            topBarCenteringBusy = true;
            try {
                document.querySelectorAll('.top-bar').forEach(bar => {
                    const left = bar.querySelector('.left-group');
                    const right = bar.querySelector('.right-group');
                    const text = bar.querySelector('.question-text, .gng-rules-text');
                    if (!left || !right || !text) return;
                    if (bar.clientWidth <= 0) return;
                    const leftRect = left.getBoundingClientRect();
                    const rightRect = right.getBoundingClientRect();
                    const textW = text.offsetWidth;
                    const gap = 4;
                    const available = rightRect.left - leftRect.right - gap * 2;
                    const canFit = available >= textW;
                    bar.style.setProperty('--top-extra', '0px');
                    bar.classList.toggle('wrapped', !canFit);
                });
            } finally {
                topBarCenteringBusy = false;
            }
        }

        // ---- 通用按壓動畫 ----
        const pressSelectors = 'button, [role="button"], .category-btn, .menu-item, .food-card, .different-card, .shopping-list-card, .reality-dot, #palm .game-board, #palm .side';
        const pressedByPointer = new Map();

        function isPressDisabled(target) {
            return target.disabled || target.classList.contains('disabled');
        }

        function releasePressed(e) {
            const target = pressedByPointer.get(e.pointerId);
            if (!target) return;
            pressedByPointer.delete(e.pointerId);
            target.classList.remove('pressed');
        }

        document.addEventListener('pointerdown', function(e) {
            const target = e.target.closest(pressSelectors);
            if (!target || isPressDisabled(target)) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            pressedByPointer.set(e.pointerId, target);
            target.classList.add('pressed');
        });

        document.addEventListener('pointerout', function(e) {
            const target = pressedByPointer.get(e.pointerId);
            if (!target) return;
            const related = e.relatedTarget;
            if (!related || !target.contains(related)) target.classList.remove('pressed');
        });

        document.addEventListener('pointerover', function(e) {
            const target = pressedByPointer.get(e.pointerId);
            if (target && target.contains(e.target)) target.classList.add('pressed');
        });

        document.addEventListener('pointerup', releasePressed);
        document.addEventListener('pointercancel', releasePressed);
        document.addEventListener('lostpointercapture', releasePressed);

        window.addEventListener('resize', syncTopBarCentering);
        if (window.ResizeObserver) {
            const topBarObserver = new ResizeObserver(syncTopBarCentering);
            document.querySelectorAll('.top-bar').forEach(bar => {
                topBarObserver.observe(bar);
                bar.querySelectorAll('.left-group, .right-group, .question-text, .gng-rules-text')
                    .forEach(el => topBarObserver.observe(el));
            });
        } else {
            syncTopBarCentering();
        }

        // =============================================================
