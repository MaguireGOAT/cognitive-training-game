        // 第五部分：主選單與遊戲切換
        // =============================================================

        const mainMenu = document.getElementById('mainMenu');
        const foodGame = document.getElementById('foodGame');
        const nbackGame = document.getElementById('nbackGame');
        const gngGame = document.getElementById('gngGame');
        const gngSettings = document.getElementById('gngSettings');
        const differentGame = document.getElementById('differentGame');
        const shoppingGame = document.getElementById('shoppingGame');
        const shoppingSettings = document.getElementById('shoppingSettings');
        const foodCategorySelect = document.getElementById('foodCategorySelect');
        const slideMenu = document.getElementById('slideMenu');

        function goToMainMenu() {
            slideMenu.classList.remove('open');
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            }
        }

        function switchGame(gameId) {
            if (!window.CognitiveRouter) return;
            if (gameId === 'food') {
                window.CognitiveRouter.navigate('foodCategorySelect');
            } else if (gameId === 'gng') {
                window.CognitiveRouter.navigate('gngSettings');
            } else if (gameId === 'different') {
                window.CognitiveRouter.navigate('differentGame');
            } else if (gameId === 'shopping') {
                window.CognitiveRouter.navigate('shoppingSettings');
            }
        }

        if (window.CognitiveRouter) {
            window.CognitiveRouter.defineScreen('mainMenu', {
                back: 'home'
            });
        }

        document.getElementById('gameFoodBtn').addEventListener('click', () => switchGame('food'));
        document.getElementById('gameGngBtn').addEventListener('click', () => switchGame('gng'));
        document.getElementById('gameDifferentBtn').addEventListener('click', () => switchGame('different'));
        document.getElementById('gameShoppingBtn').addEventListener('click', () => switchGame('shopping'));

        showNames = true;
        applyNameVisibility();

        console.log('✅ 所有遊戲已載入，使用 ☰ 選單控制設定！');
