const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appBase = process.env.APP_URL || 'http://localhost:4173/';
const cdpPort = Number(process.env.CDP_PORT || 9555);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.join(os.tmpdir(), 'cognitive-pwa-quality-' + Date.now());

const comparisons = [
  {
    name: 'food-largest-high',
    original: 'assets/food/乳鴿.webp',
    optimized: 'optimization-preview/food-largest-high.webp'
  },
  {
    name: 'food-largest-balanced',
    original: 'assets/food/乳鴿.webp',
    optimized: 'optimization-preview/food-largest-balanced.webp'
  },
  {
    name: 'gesture-largest-high',
    original: 'assets/gestures/right/palmar_rock.webp',
    optimized: 'optimization-preview/gesture-largest-high.webp'
  },
  {
    name: 'gesture-largest-balanced',
    original: 'assets/gestures/right/palmar_rock.webp',
    optimized: 'optimization-preview/gesture-largest-balanced.webp'
  },
  {
    name: 'food-median-high',
    original: 'assets/food/冬瓜.webp',
    optimized: 'optimization-preview/food-median-high.webp'
  },
  {
    name: 'food-median-balanced',
    original: 'assets/food/冬瓜.webp',
    optimized: 'optimization-preview/food-median-balanced.webp'
  }
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTargets() {
  const response = await fetch('http://127.0.0.1:' + cdpPort + '/json/list');
  return response.json();
}

async function waitForTarget(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const targets = await getTargets();
      const page = targets.find((target) => target.type === 'page');
      if (page) return page;
    } catch (error) {}
    await delay(200);
  }
  throw new Error('Chrome DevTools target did not appear');
}

async function main() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=' + cdpPort,
    '--user-data-dir=' + profileDir,
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const page = await waitForTarget(20000);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    let nextId = 1;
    const pending = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !pending.has(message.id)) return;
      const handlers = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) handlers.reject(new Error(message.error.message));
      else handlers.resolve(message.result);
    });

    function send(method, params) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }

    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      if (result.exceptionDetails) {
        throw new Error('Evaluation failed: ' + JSON.stringify(result.exceptionDetails));
      }
      return result.result.value;
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: appBase + 'tools/asset-preview-page.html' });

    for (const comparison of comparisons) {
      const result = await evaluate(`(async () => {
        async function loadImage(src) {
          const image = new Image();
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('image load failed: ' + src));
            image.src = src;
          });
          return image;
        }

        const original = await loadImage(${JSON.stringify(appBase + comparison.original)});
        const optimized = await loadImage(${JSON.stringify(appBase + comparison.optimized)});
        const width = optimized.naturalWidth;
        const height = optimized.naturalHeight;
        const originalCanvas = document.createElement('canvas');
        const optimizedCanvas = document.createElement('canvas');
        originalCanvas.width = width;
        originalCanvas.height = height;
        optimizedCanvas.width = width;
        optimizedCanvas.height = height;
        const originalContext = originalCanvas.getContext('2d');
        const optimizedContext = optimizedCanvas.getContext('2d');
        originalContext.imageSmoothingEnabled = true;
        originalContext.imageSmoothingQuality = 'high';
        originalContext.drawImage(original, 0, 0, width, height);
        optimizedContext.drawImage(optimized, 0, 0, width, height);

        const originalData = originalContext.getImageData(0, 0, width, height).data;
        const optimizedData = optimizedContext.getImageData(0, 0, width, height).data;
        let totalDifference = 0;
        let totalSquared = 0;
        const count = width * height * 3;
        for (let i = 0; i < width * height; i += 1) {
          const offset = i * 4;
          for (let channel = 0; channel < 3; channel += 1) {
            const difference = Math.abs(originalData[offset + channel] - optimizedData[offset + channel]);
            totalDifference += difference;
            totalSquared += difference * difference;
          }
        }
        const meanAbsPct = (totalDifference / (count * 255)) * 100;
        const mse = totalSquared / count;
        const psnr = mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse);
        return { width, height, meanAbsPct: +meanAbsPct.toFixed(3), psnr: +psnr.toFixed(1) };
      })()`);
      console.log('quality=' + JSON.stringify({ name: comparison.name, ...result }));
    }

    ws.close();
  } finally {
    chrome.kill();
    await delay(500);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
