        // ---- 共用彈窗 ----
        function showCustomMessage(title, subtitle, buttons, isVictory = false, pauseTimer = true) {
            const msgIcon = document.getElementById('msgIcon');
            const msgText = document.getElementById('msgText');
            const msgSub = document.getElementById('msgSub');
            const msgBtns = document.getElementById('msgButtons');
            msgIcon.textContent = isVictory ? '🏆' : '';
            msgText.textContent = title;
            msgText.className = 'msg-text' + (isVictory ? ' victory' : '');
            msgSub.textContent = subtitle || '';
            msgBtns.innerHTML = '';
            if (buttons && buttons.length > 0) {
                const btnGroup = document.createElement('div');
                btnGroup.className = 'btn-group';
                buttons.forEach(b => {
                    const btn = document.createElement('button');
                    btn.className = 'btn-option ' + (b.class || 'btn-stay');
                    btn.textContent = b.text;
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (b.action) b.action();
                        if (pauseTimer && typeof resumeGngTimer === 'function') resumeGngTimer();
                    });
                    btnGroup.appendChild(btn);
                });
                msgBtns.appendChild(btnGroup);
            }
            document.getElementById('overlay').classList.add('active');
            if (pauseTimer && typeof pauseGngTimer === 'function') pauseGngTimer();
        }

        function hideOverlay() { document.getElementById('overlay').classList.remove('active'); }

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

        function syncTopBarCentering() {
            document.querySelectorAll('.top-bar').forEach(bar => {
                const left = bar.querySelector('.left-group');
                const right = bar.querySelector('.right-group');
                const text = bar.querySelector('.question-text, .gng-rules-text');
                if (!left || !right || !text) return;
                if (bar.clientWidth <= 0) return;
                const leftRect = left.getBoundingClientRect();
                const rightRect = right.getBoundingClientRect();
                const textRect = text.getBoundingClientRect();
                const barRect = bar.getBoundingClientRect();
                const textW = text.offsetWidth;
                const sameRow = Math.abs(textRect.top - leftRect.top) < 2 &&
                                Math.abs(textRect.top - rightRect.top) < 2;
                const gap = 4;
                const available = rightRect.left - leftRect.right - gap * 2;
                const singleLine = sameRow && available >= textW;
                let extra = 0;
                if (singleLine) {
                    const currentCenter = (leftRect.right + rightRect.left) / 2;
                    const targetCenter = barRect.left + bar.clientWidth / 2;
                    const textLeft = currentCenter - textW / 2;
                    const textRight = currentCenter + textW / 2;
                    const minExtra = leftRect.right + gap - textLeft;
                    const maxExtra = rightRect.left - gap - textRight;
                    extra = Math.max(minExtra, Math.min(targetCenter - currentCenter, maxExtra));
                }
                bar.style.setProperty('--top-extra', extra + 'px');
                bar.classList.toggle('wrapped', !singleLine);
            });
        }

        document.getElementById('overlay').addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
                if (typeof resumeGngTimer === 'function') resumeGngTimer();
                const foodGameVisible = !document.getElementById('foodGame').classList.contains('hidden');
                const hasNextBtn = document.querySelector('#msgButtons .btn-next') !== null;
                if (foodGameVisible && hasNextBtn && typeof nextFoodRound === 'function') {
                    nextFoodRound();
                }
                const shoppingGameVisible = !document.getElementById('shoppingGame').classList.contains('hidden');
                if (shoppingGameVisible && typeof shoppingState !== 'undefined') {
                    if (shoppingState.roundCompletePending && typeof startShoppingRound === 'function') {
                        shoppingState.roundCompletePending = false;
                        startShoppingRound();
                    } else if (shoppingState.timeoutPending && typeof showShoppingListPhase === 'function') {
                        shoppingState.timeoutPending = false;
                        showShoppingListPhase();
                    }
                }
            }
        });

        // ---- 通用按壓動畫 ----
        document.addEventListener('pointerdown', function(e) {
            const target = e.target.closest('button, .category-btn, .menu-item');
            if (!target) return;
            target.classList.remove('pressed');
            void target.offsetWidth;
            target.classList.add('pressed');
            setTimeout(() => target.classList.remove('pressed'), 150);
        });

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
