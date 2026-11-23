const { chromium, webkit, devices } = require('@playwright/test');
const fs = require('fs');
const out = process.argv[2] || 'artifacts/mobile-ui';
const root = 'd:/Playwright/MyIndira Automation/src/auth/storage-state/qa/';
const BASE = 'https://app-test.k.indiraiscm.com';
const DEVICES = [
  ['Pixel 7', chromium, 'android'], ['Galaxy S9+', chromium, 'android'],
  ['iPhone SE (3rd gen)', webkit, 'ios'], ['iPhone 14', webkit, 'ios'], ['iPad Pro 11', webkit, 'ios'],
];
const PAGES = [['login', '/', false], ['dashboard', '/dashboard'], ['feed', '/feed'], ['posts', '/posts'], ['bulk-upload', '/bulk-upload'], ['master-data', '/master-data'],
  ['notifications', '/notifications'], ['policies', '/policies'], ['acknowledgements', '/acknowledgements'], ['compliance', '/compliance'], ['reported-posts', '/reported-posts'], ['communities', '/communities']];
const measure = (minTap) => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const label = (e) => ((e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.tagName).trim().replace(/\s+/g, ' ')).slice(0, 40);
  const sel = 'a,button,input,textarea,select,[role=button],[role=checkbox],[role=tab],[role=switch],div[tabindex="0"]';
  const taps = Array.from(document.querySelectorAll(sel)).filter(vis).map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh * 3).filter(({ r }) => Math.min(r.width, r.height) < minTap);
  const small = Array.from(document.querySelectorAll('div,span,a,button,p,h1,h2,h3,label')).filter((e) => e.children.length === 0 && (e.innerText || '').trim().length > 1 && vis(e)).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12);
  const wide = Array.from(document.querySelectorAll('body *')).filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.right > vw + 2 && r.width < vw * 3; }).slice(0, 400);
  const clipped = Array.from(document.querySelectorAll('div,span')).filter((e) => e.children.length === 0 && vis(e) && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible' && (e.innerText || '').trim()).map(label);
  const side = Array.from(document.querySelectorAll('div')).find((d) => { const r = d.getBoundingClientRect(); return /Dashboard/.test(d.innerText || '') && /Policies/.test(d.innerText || '') && r.left <= 1 && r.width > 100 && r.width < vw * 0.9 && r.height > vh * 0.5; });
  const sw = side ? Math.round(side.getBoundingClientRect().width) : 0;
  return {
    vw, vh, scrollW: document.scrollingElement.scrollWidth, overflowX: document.scrollingElement.scrollWidth > vw + 1,
    sidebarWidth: sw, contentShare: sw ? Math.round(((vw - sw) / vw) * 100) : 100,
    smallTaps: taps.length, smallTapExamples: taps.slice(0, 6).map(({ e, r }) => `${label(e)} ${Math.round(r.width)}x${Math.round(r.height)}`),
    smallText: small.length, smallTextExamples: Array.from(new Set(small.map((e) => `${label(e)} ${getComputedStyle(e).fontSize}`))).slice(0, 5),
    pastRight: wide.length, pastRightExamples: Array.from(new Set(wide.map((e) => `${label(e)} right=${Math.round(e.getBoundingClientRect().right)}`))).slice(0, 5),
    clipped: Array.from(new Set(clipped)).slice(0, 6),
  };
};
(async () => {
  const results = [];
  for (const [name, engine, os] of DEVICES) {
    const browser = await engine.launch();
    const d = devices[name];
    const minTap = os === 'ios' ? 44 : 48;
    for (const [pname, path, auth] of PAGES) {
      const ctx = await browser.newContext({ ...d, ...(auth === false ? {} : { storageState: root + 'admin.state.json' }), ignoreHTTPSErrors: true });
      const p = await ctx.newPage();
      try {
        await p.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
        await p.waitForTimeout(4500);
        const m = await p.evaluate(measure, minTap);
        const shot = `${out}/${name.replace(/[^A-Za-z0-9]/g, '')}_${pname}.png`;
        await p.screenshot({ path: shot });
        results.push({ device: name, page: pname, url: p.url().replace(BASE, ''), minTap, ...m });
      } catch (e) { results.push({ device: name, page: pname, error: String(e.message).slice(0, 120) }); }
      await ctx.close();
    }
    await browser.close();
    console.log('done', name);
  }
  fs.writeFileSync(out + '/results.json', JSON.stringify(results, null, 1));
})();
