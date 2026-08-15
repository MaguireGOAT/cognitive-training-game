(function () {
    'use strict';

    var LEFT_ALL_GESTURES = [
        'assets/gestures/left/rock.webp',
        'assets/gestures/left/paper.webp',
        'assets/gestures/left/scissors.webp',
        'assets/gestures/left/thumbsup.webp',
        'assets/gestures/left/thumbsdown.webp',
        'assets/gestures/left/four.webp',
        'assets/gestures/left/ok.webp',
        'assets/gestures/left/gun.webp'
    ];
    var RIGHT_ALL_GESTURES = [
        'assets/gestures/right/rock.webp',
        'assets/gestures/right/paper.webp',
        'assets/gestures/right/scissors.webp',
        'assets/gestures/right/thumbsup.webp',
        'assets/gestures/right/thumbsdown.webp',
        'assets/gestures/right/four.webp',
        'assets/gestures/right/ok.webp',
        'assets/gestures/right/gun.webp'
    ];
    var LEFT_EASY_GESTURES = [
        'assets/gestures/left/rock.webp',
        'assets/gestures/left/paper.webp',
        'assets/gestures/left/scissors.webp'
    ];
    var RIGHT_EASY_GESTURES = [
        'assets/gestures/right/rock.webp',
        'assets/gestures/right/paper.webp',
        'assets/gestures/right/scissors.webp'
    ];
    var LEFT_PALMAR_ALL_GESTURES = [
        'assets/gestures/left/palmar_rock.webp',
        'assets/gestures/left/palmar_paper.webp',
        'assets/gestures/left/palmar_scissors.webp',
        'assets/gestures/left/palmar_four.webp',
        'assets/gestures/left/palmar_ok.webp',
        'assets/gestures/left/palmar_gun.webp'
    ];
    var RIGHT_PALMAR_ALL_GESTURES = [
        'assets/gestures/right/palmar_rock.webp',
        'assets/gestures/right/palmar_paper.webp',
        'assets/gestures/right/palmar_scissors.webp',
        'assets/gestures/right/palmar_four.webp',
        'assets/gestures/right/palmar_ok.webp',
        'assets/gestures/right/palmar_gun.webp'
    ];
    var LEFT_PALMAR_EASY_GESTURES = [
        'assets/gestures/left/palmar_rock.webp',
        'assets/gestures/left/palmar_paper.webp',
        'assets/gestures/left/palmar_scissors.webp'
    ];
    var RIGHT_PALMAR_EASY_GESTURES = [
        'assets/gestures/right/palmar_rock.webp',
        'assets/gestures/right/palmar_paper.webp',
        'assets/gestures/right/palmar_scissors.webp'
    ];

    var currentDifficulty = 'hard';
    var currentHand = 'both';
    var leftGestures = LEFT_ALL_GESTURES;
    var rightGestures = RIGHT_ALL_GESTURES;
    var lastLeft = null;
    var lastRight = null;
    var currentLeft = null;
    var currentRight = null;
    var isPlaying = false;
    var speedLevel = 5;
    var initialized = false;

    var leftEl = document.getElementById('leftGesture');
    var rightEl = document.getElementById('rightGesture');
    var swapBtn = document.getElementById('swapBtn');
    var difficultySelect = document.getElementById('difficultySelect');
    var handSelect = document.getElementById('handSelect');
    var playBtn = document.getElementById('playBtn');
    var speedDisplay = document.getElementById('speedDisplay');
    var speedUp = document.getElementById('speedUp');
    var speedDown = document.getElementById('speedDown');
    var leftSide = document.getElementById('leftSide');
    var rightSide = document.getElementById('rightSide');
    var palmGame = document.getElementById('palm');
    var palmGrid = palmGame ? palmGame.querySelector('.grid-wrapper') : null;
    var palmBoard = palmGame ? palmGame.querySelector('.game-board') : null;

    function getSpeedInterval(level) {
        var mapping = {
            1: 7000,
            2: 6000,
            3: 5000,
            4: 4000,
            5: 3500,
            6: 3000,
            7: 2500,
            8: 2000,
            9: 1500,
            10: 1000
        };
        return mapping[level] || 3500;
    }

    function randomGesture(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function setGesture(element, path, side) {
        element.innerHTML = '';
        var img = document.createElement('img');
        img.src = path;
        img.alt = '手勢';
        img.onerror = function () {
            element.innerHTML =
                '<div class="error-text">❌ 載入失敗<br><span style="font-size:1rem;">' + path + '</span></div>';
            if (side === 'left') {
                currentLeft = null;
            } else {
                currentRight = null;
            }
        };
        element.appendChild(img);
        if (side === 'left') {
            currentLeft = path;
        } else {
            currentRight = path;
        }
    }

    function updateGame() {
        var newLeft;
        var newRight;
        var attempts = 0;
        var maxAttempts = 50;
        do {
            newLeft = randomGesture(leftGestures);
            attempts++;
        } while (newLeft === lastLeft && attempts < maxAttempts);
        attempts = 0;
        do {
            newRight = randomGesture(rightGestures);
            attempts++;
        } while (newRight === lastRight && attempts < maxAttempts);
        lastLeft = newLeft;
        lastRight = newRight;
        setGesture(leftEl, newLeft, 'left');
        setGesture(rightEl, newRight, 'right');
    }

    function mirrorGesturePath(filePath, side) {
        var parts = filePath.split('/');
        parts[parts.length - 2] = side;
        return parts.join('/');
    }

    function swapGestures() {
        if (currentLeft === null || currentRight === null) return;
        // Move the exact gesture variant, including palmar/backhand, to the other side.
        var newLeftPath = mirrorGesturePath(currentRight, 'left');
        var newRightPath = mirrorGesturePath(currentLeft, 'right');
        setGesture(leftEl, newLeftPath, 'left');
        setGesture(rightEl, newRightPath, 'right');
        lastLeft = newLeftPath;
        lastRight = newRightPath;
        restartTimerIfPlaying();
    }

    function updateGestureLists() {
        var isEasy = currentDifficulty === 'easy';
        var isPalmar = currentHand === 'palmar';
        var leftBase;
        var rightBase;
        if (isPalmar) {
            if (isEasy) {
                leftBase = LEFT_PALMAR_EASY_GESTURES;
                rightBase = RIGHT_PALMAR_EASY_GESTURES;
            } else {
                leftBase = LEFT_PALMAR_ALL_GESTURES.concat([
                    'assets/gestures/left/thumbsup.webp',
                    'assets/gestures/left/thumbsdown.webp'
                ]);
                rightBase = RIGHT_PALMAR_ALL_GESTURES.concat([
                    'assets/gestures/right/thumbsup.webp',
                    'assets/gestures/right/thumbsdown.webp'
                ]);
            }
        } else {
            var leftNonPalmar = isEasy ? LEFT_EASY_GESTURES : LEFT_ALL_GESTURES;
            var rightNonPalmar = isEasy ? RIGHT_EASY_GESTURES : RIGHT_ALL_GESTURES;
            var leftPalmar = isEasy ? LEFT_PALMAR_EASY_GESTURES : LEFT_PALMAR_ALL_GESTURES;
            var rightPalmar = isEasy ? RIGHT_PALMAR_EASY_GESTURES : RIGHT_PALMAR_ALL_GESTURES;
            leftBase = leftNonPalmar.concat(leftPalmar);
            rightBase = rightNonPalmar.concat(rightPalmar);
        }
        leftGestures = leftBase;
        rightGestures = rightBase;
    }

    function getPalmSessionConfig() {
        return {
            mode: 'repeating',
            intervalMs: getSpeedInterval(speedLevel),
            tick: function () {
                if (isPlaying) updateGame();
            }
        };
    }

    function startPalmSession() {
        if (window.CognitiveSession) {
            window.CognitiveSession.start(getPalmSessionConfig());
        }
    }

    function startAutoPlay() {
        if (isPlaying) return;
        isPlaying = true;
        playBtn.classList.add('playing');
        updateGame();
        startPalmSession();
    }

    function stopAutoPlay() {
        if (!isPlaying) return;
        isPlaying = false;
        playBtn.classList.remove('playing');
        if (window.CognitiveSession) {
            window.CognitiveSession.stop();
        }
    }

    function togglePlay() {
        if (isPlaying) {
            stopAutoPlay();
        } else {
            startAutoPlay();
        }
    }

    function restartTimerIfPlaying() {
        if (!isPlaying) return;
        startPalmSession();
    }

    function changeSpeed(delta) {
        var newLevel = speedLevel + delta;
        if (newLevel >= 1 && newLevel <= 10) {
            speedLevel = newLevel;
            speedDisplay.textContent = speedLevel;
            restartTimerIfPlaying();
        }
    }

    function switchImageManually() {
        updateGame();
        restartTimerIfPlaying();
    }

    function isPalmVisible() {
        return !document.getElementById('palm').classList.contains('hidden');
    }

    function syncPalmLayout() {
        if (!palmGrid || !palmBoard) return;
        var rect = palmGrid.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        var gap = 14;
        var useRow = rect.width >= rect.height;
        var side = useRow
            ? Math.min((rect.width - gap) / 2, rect.height)
            : Math.min(rect.width, (rect.height - gap) / 2);
        side = Math.max(0, Math.floor(side));
        palmBoard.style.setProperty('--palm-dir', useRow ? 'row' : 'column');
        palmBoard.style.setProperty('--palm-side', side + 'px');
    }

    difficultySelect.addEventListener('change', function () {
        currentDifficulty = difficultySelect.value;
        updateGestureLists();
        lastLeft = null;
        lastRight = null;
        updateGame();
        restartTimerIfPlaying();
    });

    handSelect.addEventListener('change', function () {
        currentHand = handSelect.value;
        updateGestureLists();
        lastLeft = null;
        lastRight = null;
        updateGame();
        restartTimerIfPlaying();
    });

    swapBtn.addEventListener('click', swapGestures);
    playBtn.addEventListener('click', togglePlay);
    leftSide.addEventListener('click', switchImageManually);
    rightSide.addEventListener('click', switchImageManually);
    speedUp.addEventListener('click', function () {
        changeSpeed(1);
    });
    speedDown.addEventListener('click', function () {
        changeSpeed(-1);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key !== ' ' || !isPalmVisible()) return;
        if (event.target !== document.body) return;
        event.preventDefault();
        updateGame();
    });

    if (window.ResizeObserver) {
        var palmResizeObserver = new ResizeObserver(syncPalmLayout);
        if (palmGrid) palmResizeObserver.observe(palmGrid);
    } else {
        window.addEventListener('resize', syncPalmLayout);
    }

    speedDisplay.textContent = speedLevel;
    updateGestureLists();
    syncPalmLayout();

    if (window.CognitiveRouter) {
        window.CognitiveRouter.registerEnter('palm', function () {
            if (!initialized) {
                initialized = true;
                updateGame();
            }
            syncPalmLayout();
        });
        window.CognitiveRouter.registerExit('palm', stopAutoPlay);
    }
})();
