const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appBase = process.env.APP_URL || 'http://localhost:4173/';
const cdpPort = Number(process.env.CDP_PORT || 9666);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.join(os.tmpdir(), 'cognitive-pwa-optimize-' + Date.now());
const quality = Number(process.env.WEBP_QUALITY || 0.85);
const maxDimension = Number(process.env.MAX_DIMENSION || 1280);
const backupDir = path.join(root, 'optimization-preview', 'original-webp-backup');

function collectWebpFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectWebpFiles(absolute));
    } else if (entry.name.toLowerCase().endsWith('.webp')) {
      result.push(absolute);
    }
  }
  return result;
}

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
  const webpFiles = collectWebpFiles(path.join(root, 'assets'));
  console.log('found=' + webpFiles.length + ' webp assets');

  for (const file of webpFiles) {
    const relative = path.relative(root, file);
    const backupFile = path.join(backupDir, relative);
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    if (!fs.existsSync(backupFile)) {
      fs.copyFileSync(file, backupFile);
    }
  }
  console.log('backup=' + backupDir);

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

    let totalBefore = 0;
    let totalAfter = 0;
    let changed = 0;
    let keptOriginal = 0;

    for (let i = 0; i < webpFiles.length; i += 1) {
      const file = webpFiles[i];
      const relative = path.relative(root, file).split(path.sep).join('/');
      const originalBytes = fs.statSync(file).size;
      const url = appBase + relative;

      const optimized = await evaluate(`(async () => {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('image load failed'));
          image.src = ${JSON.stringify(url)};
        });
        const naturalWidth = image.naturalWidth;
        const naturalHeight = image.naturalHeight;
        if (!naturalWidth || !naturalHeight) throw new Error('invalid image dimensions');
        const scale = Math.min(1, ${maxDimension} / Math.max(naturalWidth, naturalHeight));
        const width = Math.max(1, Math.round(naturalWidth * scale));
        const height = Math.max(1, Math.round(naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, width, height);
        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, 'image/webp', ${quality});
        });
        if (!blob) throw new Error('webp encoding failed');
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return { width, height, byteLength: blob.size, dataUrl };
      })()`);

      totalBefore += originalBytes;
      if (optimized.byteLength < originalBytes) {
        fs.writeFileSync(
          file,
          Buffer.from(optimized.dataUrl.split(',')[1], 'base64')
        );
        totalAfter += optimized.byteLength;
        changed += 1;
      } else {
        totalAfter += originalBytes;
        keptOriginal += 1;
      }

      if ((i + 1) % 20 === 0 || i === webpFiles.length - 1) {
        console.log('progress=' + JSON.stringify({
          done: i + 1,
          total: webpFiles.length,
          changed,
          keptOriginal
        }));
      }
    }

    console.log('result=' + JSON.stringify({
      changed,
      keptOriginal,
      beforeMB: +(totalBefore / (1024 * 1024)).toFixed(2),
      afterMB: +(totalAfter / (1024 * 1024)).toFixed(2)
    }));

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
