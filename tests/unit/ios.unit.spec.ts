import http from 'node:http';
import zlib from 'node:zlib';
import type { AddressInfo } from 'node:net';
import { test, expect, devices } from '@playwright/test';
import { IosPwaReadiness, pngSize } from '@ios/IosPwaReadiness';
import { simulateInstalledStandalone } from '@ios/StandaloneSimulator';
import { ServiceWorkerHelper } from '@pwa/ServiceWorkerHelper';

// WebKit + iPhone profile for every test in this file.
test.use({ ...devices['iPhone 14'], serviceWorkers: 'allow' });

// ---------- a tiny PWA served from this process ----------
function crc32(buf: Buffer): number {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ~crc >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size: number): Buffer {
  const rowLen = size * 4 + 1;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) raw.set([30, 110, 220, 255], y * rowLen + 1 + x * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

interface Variant {
  appleTags: boolean;
  touchIconSize: number;
}
const variants: Record<string, Variant> = { good: { appleTags: true, touchIconSize: 180 }, bare: { appleTags: false, touchIconSize: 0 }, tiny: { appleTags: true, touchIconSize: 57 } };

let server: http.Server;
let origin = '';

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const [, variantName = 'good', ...rest] = (req.url ?? '/').split('?')[0].split('/');
    const v = variants[variantName] ?? variants.good;
    const file = '/' + rest.join('/');
    const send = (type: string, body: string | Buffer) => {
      res.writeHead(200, { 'content-type': type });
      res.end(body);
    };
    const base = `/${variantName}`;
    if (file === '/' || file === '/index.html') {
      const apple = v.appleTags
        ? `<link rel="apple-touch-icon" href="${base}/touch.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Demo"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
        : '';
      return send('text/html', `<!doctype html><html><head><meta charset=utf-8><title>Demo</title><meta name=viewport content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel=manifest href="${base}/manifest.json">${apple}<meta name=theme-color content="#1e6edc"></head><body><h1>Demo PWA</h1><script>navigator.serviceWorker.register('${base}/sw.js',{scope:'${base}/'})</script></body></html>`);
    }
    if (file === '/manifest.json') {
      return send('application/manifest+json', JSON.stringify({ name: 'Demo', start_url: `${base}/`, scope: `${base}/`, display: 'standalone', icons: [{ src: `${base}/i192.png`, sizes: '192x192', type: 'image/png' }, { src: `${base}/i512.png`, sizes: '512x512', type: 'image/png' }] }));
    }
    if (file === '/sw.js') {
      return send('text/javascript', `self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open('shell').then(c=>c.addAll(['${base}/'])))});self.addEventListener('activate',e=>e.waitUntil(clients.claim()));self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));`);
    }
    if (file === '/touch.png') return send('image/png', png(v.touchIconSize || 180));
    if (file === '/i192.png') return send('image/png', png(192));
    if (file === '/i512.png') return send('image/png', png(512));
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => server.close());

test.describe('IosPwaReadiness', () => {
  test('a well-configured PWA has no errors and no warnings', async ({ page }) => {
    await page.goto(`${origin}/good/`);
    const report = await new IosPwaReadiness(page).check();
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.passed.join(' ')).toContain('apple-touch-icon 180x180');
  });

  test('a PWA without iOS meta tags and touch icon gets warnings but no blocking error', async ({ page }) => {
    await page.goto(`${origin}/bare/`);
    const report = await new IosPwaReadiness(page).check();
    expect(report.errors).toEqual([]); // manifest icons make it installable on iOS 16.4+
    const text = report.warnings.join('\n');
    expect(text).toContain('apple-touch-icon');
    expect(text).toContain('apple-mobile-web-app-title');
    expect(text).toContain('apple-mobile-web-app-capable');
  });

  test('a too-small touch icon is flagged', async ({ page }) => {
    await page.goto(`${origin}/tiny/`);
    const report = await new IosPwaReadiness(page).check();
    expect(report.warnings.join('\n')).toContain('57x57');
  });

  test('pngSize reads dimensions and rejects non-PNG bytes', () => {
    expect(pngSize(png(180))).toEqual({ width: 180, height: 180 });
    expect(pngSize(Buffer.from('<svg></svg>'.padEnd(40)))).toBeNull();
  });
});

test.describe('WebKit PWA behaviour', () => {
  test('service worker + cache + offline reload work in WebKit when the app supports them', async ({ page, context }) => {
    await page.goto(`${origin}/good/`);
    await new ServiceWorkerHelper(page).waitUntilActive();
    await page.reload();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Demo PWA' })).toBeVisible();
    await context.setOffline(false);
  });

  test('simulated installed mode reports standalone, and normal Safari does not', async ({ browser, page }) => {
    await page.goto(`${origin}/good/`);
    expect(await page.evaluate(() => window.matchMedia('(display-mode: standalone)').matches)).toBe(false);

    const context = await browser.newContext({ ...devices['iPhone 14'] });
    await simulateInstalledStandalone(context);
    const installed = await context.newPage();
    await installed.goto(`${origin}/good/`);
    expect(await installed.evaluate(() => (navigator as unknown as { standalone?: boolean }).standalone)).toBe(true);
    expect(await installed.evaluate(() => window.matchMedia('(display-mode: standalone)').matches)).toBe(true);
    expect(await installed.evaluate(() => window.matchMedia('(min-width: 1px)').matches)).toBe(true); // other queries untouched
    await context.close();
  });

  test('emulation gap: maxTouchPoints is 0 in emulated iPhone WebKit (it is 5 on a real iPhone)', async ({ page }) => {
    await page.goto(`${origin}/good/`);
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBe(0);
  });
});
