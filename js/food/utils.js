        function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math
                .random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]]; } return a; }

        function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }


        // ---- 鼓勵語 ----
        const ENCOURAGE_PHRASES = ['太棒了！', '好厲害！', '繼續加油！', '你真聰明！', '做得很好！', '超級棒！', '好優秀！', '真了不起！', '哇！好棒！', '太強了！',
            '好有眼光！', '真令人驕傲！'
        ];
        const ENCOURAGE_WRONG = ['再接再厲！', '再試一次！', '加油！', '繼續努力！', '你可以的！'];

        function getRandomEncourage() { return ENCOURAGE_PHRASES[Math.floor(Math.random() * ENCOURAGE_PHRASES.length)]; }

        function getRandomWrongEncourage() { return ENCOURAGE_WRONG[Math.floor(Math.random() * ENCOURAGE_WRONG.length)]; }

