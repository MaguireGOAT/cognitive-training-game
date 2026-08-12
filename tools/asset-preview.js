const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const previewDir = path.join(root, 'optimization-preview');
const appBase = process.env.APP_URL || 'http://localhost:4173/';
const cdpPort = Number(process.env.CDP_PORT || 9444);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.join(os.tmpdir(), 'cognitive-pwa-preview-' + Date.now());

const foodDir = path.join(root, 'assets', 'food');
const gestureDir = path.join(root, 'assets', 'gestures', 'right');

const variants = [
  { id: 'original', label: 'Original', quality: null, maxDimension: null },
  { id: 'high', label: 'Optimized High', quality: 0.85, maxDimension: 1280 },
  { id: 'balanced', label: 'Optimized Balanced', quality: 0.75, maxDimension: 1024 }
];

function selectLargestWebp(dir) {
  const files = fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.webp'))
    .map((name) => path.join(dir, name));
  files.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  return path.basename(files[0]);
}

function selectMedianWebp(dir) {
  const files = fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.webp'))
    .map((name) => path.join(dir, name));
  files.sort((a, b) => fs.statSync(a).size - fs.statSync(b).size);
  return path.basename(files[Math.floor(files.length / 2)]);
}

const samples = [
  {
    id: 'food-largest',
    label: 'Largest food image',
    assetPath: 'assets/food/' + selectLargestWebp(foodDir)
  },
  {
    id: 'gesture-largest',
    label: 'Largest gesture image',
    assetPath: 'assets/gestures/right/' + selectLargestWebp(gestureDir)
  },
  {
    id: 'food-median',
    label: 'Typical food image',
    assetPath: 'assets/food/' + selectMedianWebp(foodDir)
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

function formatKB(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function relativeAssetSrc(assetPath) {
  return '../' + assetPath.split(path.sep).join('/');
}

async function main() {
  fs.mkdirSync(previewDir, { recursive: true });

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

    async function waitForReady(url, timeoutMs) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const state = await evaluate(`({ ready: document.readyState, href: location.href })`);
          if (state.ready === 'complete' && state.href.startsWith(url)) return;
        } catch (error) {}
        await delay(250);
      }
      throw new Error('Page did not become ready: ' + url);
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.navigate', { url: appBase + 'tools/asset-preview-page.html' });
    await waitForReady(appBase + 'tools/asset-preview-page.html', 30000);

    async function inspectImage(url, byteLength) {
      return evaluate(`(async () => {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('image load failed'));
          image.src = ${JSON.stringify(url)};
        });
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        if (!width || !height) throw new Error('invalid image dimensions');
        return { width, height, byteLength: ${byteLength} };
      })()`);
    }

    async function optimizeImage(url, quality, maxDimension) {
      return evaluate(`(async () => {
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
    }

    const results = [];
    let totalOriginalBytes = 0;
    let totalHighBytes = 0;
    let totalBalancedBytes = 0;

    for (const sample of samples) {
      const absolutePath = path.join(root, sample.assetPath.split('/').join(path.sep));
      const originalBytes = fs.statSync(absolutePath).size;
      const url = appBase + sample.assetPath.split(path.sep).join('/');
      const original = await inspectImage(url, originalBytes);
      const row = {
        ...sample,
        fileName: path.basename(absolutePath),
        original,
        variants: [{ ...variants[0], ...original, src: '' }]
      };

      for (const variant of variants.slice(1)) {
        const optimized = await optimizeImage(url, variant.quality, variant.maxDimension);
        const outputName = sample.id + '-' + variant.id + '.webp';
        fs.writeFileSync(
          path.join(previewDir, outputName),
          Buffer.from(optimized.dataUrl.split(',')[1], 'base64')
        );
        row.variants.push({
          ...variant,
          src: outputName,
          width: optimized.width,
          height: optimized.height,
          byteLength: optimized.byteLength
        });
        totalOriginalBytes += originalBytes;
        if (variant.id === 'high') totalHighBytes += optimized.byteLength;
        if (variant.id === 'balanced') totalBalancedBytes += optimized.byteLength;
      }

      results.push(row);
      console.log('sample=' + JSON.stringify({
        id: sample.id,
        original: originalBytes,
        high: row.variants[1].byteLength,
        balanced: row.variants[2].byteLength
      }));
    }

    const webpBytes = 48.12 * 1024 * 1024;
    const projection = {
      high: webpBytes * (totalHighBytes / totalOriginalBytes) / (1024 * 1024),
      balanced: webpBytes * (totalBalancedBytes / totalOriginalBytes) / (1024 * 1024)
    };

    const sampleCards = results.map((sample) => {
      const imageCells = sample.variants.map((variant) => {
        const src = variant.src || relativeAssetSrc(sample.assetPath);
        const originalRatio = variant.byteLength / sample.original.byteLength;
        const ratioText = variant.id === 'original'
          ? 'reference'
          : ((1 - originalRatio) * 100).toFixed(0) + '% smaller';
        return `
          <div class="cell">
            <div class="cell-title">${escapeHtml(variant.label)}</div>
            <div class="image-wrap">
              <img src="${escapeHtml(encodeURI(src))}" alt="${escapeHtml(variant.label)}" />
            </div>
            <div class="meta">${variant.width} x ${variant.height}</div>
            <div class="meta">${formatKB(variant.byteLength)}</div>
            <div class="meta">${ratioText}</div>
          </div>`;
      }).join('');

      return `
        <section class="sample">
          <h2>${escapeHtml(sample.label)}</h2>
          <div class="file-name">${escapeHtml(sample.fileName)}</div>
          <div class="grid">${imageCells}</div>
        </section>`;
    }).join('');

    const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Asset optimization preview</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f0e8;
      --panel: #fffdf8;
      --ink: #24312b;
      --muted: #68756e;
      --line: #d9d0c2;
      --accent: #2e7d5b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: "Segoe UI", "Microsoft JhengHei", system-ui, sans-serif;
    }
    main {
      max-width: 1280px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
    }
    .summary {
      color: var(--muted);
      margin: 0 0 28px;
      font-size: 15px;
      line-height: 1.5;
    }
    .sample {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    h2 {
      margin: 0 0 4px;
      font-size: 19px;
    }
    .file-name {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }
    .cell {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
      background: #fff;
    }
    .cell-title {
      font-weight: 600;
      margin-bottom: 10px;
    }
    .image-wrap {
      min-height: 260px;
      display: grid;
      place-items: center;
      background:
        linear-gradient(45deg, #efebe3 25%, transparent 25%, transparent 75%, #efebe3 75%),
        linear-gradient(45deg, #efebe3 25%, #fff 25%, #fff 75%, #efebe3 75%);
      background-size: 20px 20px;
      background-position: 0 0, 10px 10px;
      margin-bottom: 10px;
    }
    .image-wrap img {
      max-width: 100%;
      max-height: 260px;
      object-fit: contain;
      display: block;
    }
    .meta {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    @media (max-width: 760px) {
      .grid { grid-template-columns: 1fr; }
      .image-wrap { min-height: 200px; }
      .image-wrap img { max-height: 200px; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Asset optimization preview</h1>
    <p class="summary">
      Sample image set before full optimization. Current image assets are about 48.12 MB.
      Rough projected total after this sample: High ${projection.high.toFixed(1)} MB, Balanced ${projection.balanced.toFixed(1)} MB.
    </p>
    ${sampleCards}
  </main>
</body>
</html>`;

    fs.writeFileSync(path.join(previewDir, 'preview.html'), html, 'utf8');

    await send('Page.navigate', { url: appBase + 'optimization-preview/preview.html' });
    await waitForReady(appBase + 'optimization-preview/preview.html', 30000);
    await evaluate(`(async () => {
      const start = Date.now();
      while (Date.now() - start < 30000) {
        const images = Array.from(document.images);
        if (images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0)) return true;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return false;
    })()`);

    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true
    });
    fs.writeFileSync(
      path.join(previewDir, 'preview.png'),
      Buffer.from(screenshot.data, 'base64')
    );

    console.log('preview=' + path.join(previewDir, 'preview.html'));
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
