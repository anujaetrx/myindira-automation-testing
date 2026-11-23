import { test, expect, devices } from '@playwright/test';
import {
  extractHierarchyXml,
  hierarchyHasResource,
  parseDevices,
  parsePackages,
  parseResumedActivity,
  parseVersionName,
  parseWmSize,
} from '@android/AdbParsers';
import { shQuote } from '@android/AdbClient';
import { DeviceEmulation } from '@mobile/DeviceEmulation';
import { ResponsiveChecks } from '@mobile/ResponsiveChecks';
import { TouchActions } from '@mobile/TouchActions';
import { pollUntil } from '@utils/retry';

test.describe('ADB output parsers', () => {
  test('parses `adb devices -l` including emulators and unauthorised devices', () => {
    const out = [
      '* daemon started successfully',
      'List of devices attached',
      'emulator-5554          device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:1',
      'R5CT10ABCDE            unauthorized transport_id:2',
      '',
    ].join('\n');

    const devices = parseDevices(out);
    expect(devices).toHaveLength(2);
    expect(devices[0]).toMatchObject({ serial: 'emulator-5554', state: 'device', isEmulator: true, model: 'sdk_gphone64_x86_64' });
    expect(devices[1]).toMatchObject({ serial: 'R5CT10ABCDE', state: 'unauthorized', isEmulator: false });
  });

  test('parses package lists and WebAPK names', () => {
    const out = 'package:org.chromium.webapk.a1b2c3\r\npackage:org.chromium.webapk.d4e5f6\r\n';
    expect(parsePackages(out)).toEqual(['org.chromium.webapk.a1b2c3', 'org.chromium.webapk.d4e5f6']);
    expect(parsePackages('')).toEqual([]);
  });

  test('parses the resumed activity on old and new Android formats', () => {
    const modern = '  topResumedActivity=ActivityRecord{1a2b3c u0 com.android.chrome/org.chromium.chrome.browser.webapps.WebappActivity0 t42}';
    const legacy = '  mResumedActivity: ActivityRecord{9f8e7d u0 org.chromium.webapk.a1b2c3/.MainActivity t7}';
    expect(parseResumedActivity(modern)).toEqual({ pkg: 'com.android.chrome', activity: 'org.chromium.chrome.browser.webapps.WebappActivity0' });
    expect(parseResumedActivity(legacy)).toEqual({ pkg: 'org.chromium.webapk.a1b2c3', activity: '.MainActivity' });
    expect(parseResumedActivity('nothing here')).toBeNull();
  });

  test('parses screen size (override wins) and version names', () => {
    expect(parseWmSize('Physical size: 1080x2400')).toEqual({ width: 1080, height: 2400 });
    expect(parseWmSize('Physical size: 1080x2400\nOverride size: 720x1600')).toEqual({ width: 720, height: 1600 });
    expect(parseVersionName('    versionCode=7 minSdk=26\n    versionName=126.0.6478.122\n')).toBe('126.0.6478.122');
  });

  test('detects Chrome UI in a uiautomator hierarchy and strips trailing status text', () => {
    const dump = '<?xml version="1.0"?><hierarchy><node resource-id="com.android.chrome:id/url_bar"/></hierarchy>UI hierchary dumped to: /dev/tty';
    const xml = extractHierarchyXml(dump);
    expect(xml.endsWith('</hierarchy>')).toBe(true);
    expect(hierarchyHasResource(xml, 'com.android.chrome:id/url_bar')).toBe(true);
    expect(hierarchyHasResource(xml, 'com.android.chrome:id/menu_button')).toBe(false);
  });

  test('shell quoting neutralises quotes in URLs', () => {
    expect(shQuote("https://x.test/?q=it's")).toBe(`'https://x.test/?q=it'\\''s'`);
  });
});

test.describe('pollUntil', () => {
  test('resolves when the condition becomes true and times out otherwise', async () => {
    let n = 0;
    await expect(pollUntil(async () => ++n >= 3 && 'done', { intervalMs: 5, timeoutMs: 1000 })).resolves.toBe('done');
    await expect(pollUntil(async () => false, { intervalMs: 5, timeoutMs: 50, description: 'never' })).rejects.toThrow(/never/);
  });
});

// Real Chromium with Pixel 7 emulation against a local page (no app needed).
// (Device profiles must be applied at file level; only tests that use `page` launch a browser.)
test.use({ ...devices['Pixel 7'] });

test.describe('mobile helpers in emulated Android Chrome', () => {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body{margin:0} #big{height:3000px} button{width:60px;height:60px} .tiny{width:20px;height:20px} #wide{width:2000px;height:10px}</style></head>
    <body><button id="b">Tap</button><button class="tiny" id="t">x</button><div id="log"></div><div id="big"></div>
    <script>
      const log = (m) => { document.getElementById('log').textContent += m + ';'; };
      for (const t of ['touchstart','touchend']) document.addEventListener(t, () => log(t));
      document.getElementById('b').addEventListener('click', () => log('click'));
    </script></body></html>`;

  test('tap produces touch events and a click', async ({ page }) => {
    await page.setContent(html);
    await new TouchActions(page).tap(page.locator('#b'));
    const log = await page.locator('#log').textContent();
    expect(log).toContain('touchstart');
    expect(log).toContain('click');
  });

  test('swipe scrolls the page; long press holds between touchstart and touchend', async ({ page }) => {
    await page.setContent(html);
    const touch = new TouchActions(page);

    await touch.swipeViewport('up', 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50);

    await page.evaluate(() => {
      (window as unknown as { marks: number[] }).marks = [];
      document.addEventListener('touchstart', () => (window as unknown as { marks: number[] }).marks.push(performance.now()));
      document.addEventListener('touchend', () => (window as unknown as { marks: number[] }).marks.push(performance.now()));
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await touch.longPress(page.locator('#b'), 600);
    const [down, up] = await page.evaluate(() => (window as unknown as { marks: number[] }).marks);
    expect(up - down).toBeGreaterThanOrEqual(550);
  });

  test('responsive checks detect overflow, tiny tap targets and a missing viewport meta', async ({ page }) => {
    await page.setContent(html);
    expect(await ResponsiveChecks.hasViewportMeta(page)).toBe(true);
    expect(await ResponsiveChecks.isTouchPrimary(page)).toBe(true);
    const small = await ResponsiveChecks.smallTapTargets(page, 44);
    expect(small.map((s) => s.text)).toContain('x');
    expect(await ResponsiveChecks.hasHorizontalOverflow(page)).toBe(false);

    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div id="wide"></div>'));
    expect(await ResponsiveChecks.hasHorizontalOverflow(page)).toBe(true);
    expect(await ResponsiveChecks.overflowingElements(page)).toContain('div#wide');
  });

  test('rotation flips orientation; network profiles and offline apply', async ({ page }) => {
    await page.setContent(html);
    const emulation = new DeviceEmulation(page);
    expect(await emulation.orientation()).toBe('portrait');
    await emulation.rotate();
    expect(await emulation.orientation()).toBe('landscape');

    await emulation.setOffline(true);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await emulation.setOffline(false);
    await emulation.setNetwork('fourG');
  });
});
