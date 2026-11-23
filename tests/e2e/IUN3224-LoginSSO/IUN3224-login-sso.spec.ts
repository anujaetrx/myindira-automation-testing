import type { Page } from '@playwright/test';
import { test as base, expect } from '@fixtures';
import { env } from '@config/environment';
import { SsoLoginPage, stripGlyphs } from '@pages/SsoLoginPage';

/**
 * IUN-3224 "Login Page UI & Microsoft SSO Integration" (TC_LOGIN_001 .. 008, scenarios 1-5, BR-SSO-01 .. 05).
 * This file covers the ANONYMOUS side: sign-in screen content, the redirect to Microsoft, cancel / failed callback,
 * protected-route guard, responsive layout. Signed-in behaviour (token storage, expiry, logout, roles) is in IUN3224-session.spec.ts.
 * Results, deviations and what is not automated: docs/test-cases/login-sso.md
 *
 * Safety: no credentials are ever typed. Requests to login.microsoftonline.com are answered with a stub page, so
 * the test only checks WHERE the app sends the browser and with which parameters.
 * `test.fail()` marks a KNOWN deviation: green while the app is wrong, red when it is fixed.
 */
const test = base.extend<{ sso: SsoLoginPage }>({
  sso: async ({ page }, use) => use(new SsoLoginPage(page)),
});

const MS_HOST = 'login.microsoftonline.com';

/** Answers anything sent to Microsoft with a stub page and records the URLs. Nothing leaves the browser. */
async function stubMicrosoft(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.route(/login\.microsoftonline\.com|login\.live\.com|aadcdn\.msauth\.net/, (route) => {
    seen.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Microsoft sign-in (stub)</body></html>' });
  });
  return seen;
}

/** Clicks the button and returns the authorize URL the browser was sent to. */
async function startSignIn(page: Page, sso: SsoLoginPage): Promise<URL> {
  const seen = await stubMicrosoft(page);
  await sso.goto();
  await sso.signInWithMicrosoft();
  await expect.poll(() => seen.length, { message: 'the browser should go to Microsoft' }).toBeGreaterThan(0);
  return new URL(seen[0]);
}

/** Answers the token exchange (POST /auth/sso-login) locally, so no fake token reaches the real server. */
async function mockSsoLogin(page: Page, status: number, message: string): Promise<void> {
  await page.route(/\/auth\/sso-login$/, (route) =>
    route.fulfill({ status, json: { success: false, message, code: status === 403 ? 'FORBIDDEN' : 'ERROR' } }),
  );
}

const rgb = (s: string): number[] => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);

// =====================================================================================
// Scenario 1: viewing the Campus Connect login screen
// =====================================================================================
test.describe('Login screen content @login', () => {
  test('TC_LOGIN_001 sign-in screen shows brand, headline, scope text, Microsoft button and helper text', async ({ sso }) => {
    await sso.goto();
    await expect(sso.campusConnect).toBeVisible();
    await expect(sso.headline).toBeVisible();
    await expect(sso.scopeText).toBeVisible();
    await expect(sso.button).toBeVisible();
    expect(stripGlyphs(await sso.button.innerText())).toBe('Sign in with Microsoft');
    await expect(sso.helperText).toBeVisible();
    const l = await sso.layout();
    expect(l.helperBelowButton, 'helper text sits below the button').toBe(true);
  });

  test('TC_LOGIN_001 the dual SCES / INDIRA UNIVERSITY logo image loads and keeps its aspect ratio', async ({ sso }) => {
    await sso.goto();
    const { logo } = await sso.layout();
    expect(logo.loaded, 'logo image decoded').toBe(true);
    expect(await sso.logo.getAttribute('src')).toMatch(/iu-sces-combined/);
    const natural = logo.naturalW / logo.naturalH;
    expect(Math.abs(logo.w / logo.h - natural) / natural, 'rendered ratio vs natural ratio').toBeLessThan(0.02);
  });

  test('TC_LOGIN_001 the brand block sits on a gradient canvas, above the sign-in card', async ({ sso }) => {
    await sso.goto();
    const l = await sso.layout();
    expect(l.hasGradientHeader, 'a gradient background sits behind the logo').toBe(true);
    const headline = await sso.headline.boundingBox();
    expect(l.logo.y + l.logo.h, 'logo is above the headline').toBeLessThan(headline!.y);
    const subtitle = await sso.campusConnect.boundingBox();
    expect(subtitle!.y, '"Campus Connect" is below the logo').toBeGreaterThan(l.logo.y + l.logo.h);
  });

  test('TC_LOGIN_001 /login renders the same sign-in screen (story: "root or /login")', async ({ page, sso }) => {
    await page.goto('/login');
    await sso.expectShown();
    await expect(sso.campusConnect).toBeVisible();
    await expect(sso.headline).toBeVisible();
  });

  test('TC_LOGIN_001 /login keeps its own URL (story: route is /login)', async ({ page, sso }) => {
    test.fail(true, 'Deviation: there is no /login route; the app rewrites every anonymous URL to "/".');
    await page.goto('/login');
    await sso.expectShown();
    expect(new URL(page.url()).pathname).toBe('/login');
  });

  test('TC_LOGIN_001 button styling: white bold label, navy #145684 background, soft shadow, Microsoft icon glyph', async ({ sso }) => {
    await sso.goto();
    const s = await sso.buttonStyle();
    expect(rgb(s.color)).toEqual([255, 255, 255]);
    expect(Number(s.weight)).toBeGreaterThanOrEqual(600);
    expect(s.shadow).not.toBe('none');
    expect(s.hasIconGlyph, 'an icon glyph precedes the label').toBe(true);
    // Observed rgb(21, 86, 133) = #155685: one unit off the story's #145684 on two channels; accepted within 3.
    const [r, g, b] = rgb(s.bg);
    expect(Math.abs(r - 0x14)).toBeLessThanOrEqual(3);
    expect(Math.abs(g - 0x56)).toBeLessThanOrEqual(3);
    expect(Math.abs(b - 0x84)).toBeLessThanOrEqual(3);
  });

  test('TC_LOGIN_001 button background is exactly #145684', async ({ sso }) => {
    test.fail(true, 'Deviation (trivial): the button is #155685 (rgb 21,86,133), the story says #145684.');
    await sso.goto();
    expect(rgb((await sso.buttonStyle()).bg)).toEqual([0x14, 0x56, 0x84]);
  });
});

// =====================================================================================
// Scenario 2 / TC_LOGIN_002: redirect to Microsoft
// =====================================================================================
test.describe('Sign in with Microsoft: redirect @login', () => {
  test('TC_LOGIN_002 clicking the button redirects to login.microsoftonline.com authorize endpoint', async ({ page, sso }) => {
    const url = await startSignIn(page, sso);
    expect(url.host).toBe(MS_HOST);
    expect(url.pathname).toMatch(/\/oauth2\/v2\.0\/authorize$/);
    await expect(page.getByText('Microsoft sign-in (stub)')).toBeVisible();
  });

  test('TC_LOGIN_002 the authorize request carries client_id, redirect_uri (the app) and an openid scope', async ({ page, sso }) => {
    const url = await startSignIn(page, sso);
    expect(url.searchParams.get('client_id')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(new URL(url.searchParams.get('redirect_uri')!).origin).toBe(new URL(env.baseUrl).origin);
    expect(url.searchParams.get('scope')).toContain('openid');
    expect(url.searchParams.get('response_type')).toBeTruthy();
  });

  test('TC_LOGIN_002 the button is a real link whose href is the same authorize URL', async ({ sso }) => {
    await sso.goto();
    const href = new URL(await sso.buttonHref());
    expect(href.host).toBe(MS_HOST);
    expect(href.searchParams.get('client_id')).toBeTruthy();
  });

  test('TC_LOGIN_002 authorize URL uses the Indira University tenant id (story: "using the tenant ID")', async ({ page, sso }) => {
    test.fail(true, 'Deviation: the URL uses the multi-tenant "organizations" endpoint, not the university tenant id.');
    const url = await startSignIn(page, sso);
    expect(url.pathname.split('/')[1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  test('TC_LOGIN_003 / Scenario 2 authorization code flow: response_type=code and callback route /auth/callback', async ({ page, sso }) => {
    test.fail(true, 'Deviation: implicit flow (response_type=token), redirect_uri is the app root; there is no /auth/callback route.');
    const url = await startSignIn(page, sso);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(new URL(url.searchParams.get('redirect_uri')!).pathname).toBe('/auth/callback');
  });

  test('Validation "State & PKCE": authorize request has a state and a S256 code_challenge', async ({ page, sso }) => {
    test.fail(true, 'Deviation (security): no state, no code_challenge / code_challenge_method, no nonce in the authorize URL.');
    const url = await startSignIn(page, sso);
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  test('Validation "State & PKCE": the state is unique on every attempt', async ({ page, sso }) => {
    test.fail(true, 'Deviation (security): the href is static; there is no state at all, so it cannot be unique per attempt.');
    const first = await startSignIn(page, sso);
    await page.goBack();
    const seen = await stubMicrosoft(page);
    await sso.expectShown();
    await sso.signInWithMicrosoft();
    await expect.poll(() => seen.length).toBeGreaterThan(0);
    const second = new URL(seen[seen.length - 1]);
    expect(first.searchParams.get('state')).toBeTruthy();
    expect(first.searchParams.get('state')).not.toBe(second.searchParams.get('state'));
  });

  test('TC_LOGIN_002 no password or token is placed in the authorize URL', async ({ page, sso }) => {
    const url = await startSignIn(page, sso);
    for (const k of ['password', 'access_token', 'id_token', 'login_hint']) expect(url.searchParams.has(k), k).toBe(false);
  });
});

// =====================================================================================
// Scenario 4 / TC_LOGIN_005: cancel; Scenario 3 / TC_LOGIN_004: rejected accounts; callback errors
// =====================================================================================
test.describe('Cancel and failed callback @login', () => {
  test('TC_LOGIN_005 / Scenario 4 coming back from Microsoft (cancel / back) shows the intact sign-in screen', async ({ page, sso }) => {
    await startSignIn(page, sso);
    await page.goBack();
    await sso.expectShown();
    await expect(sso.headline).toBeVisible();
    await expect(sso.errorText).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    // the button still works after the aborted attempt
    const seen = await stubMicrosoft(page);
    await sso.signInWithMicrosoft();
    await expect.poll(() => seen.length).toBeGreaterThan(0);
  });

  const cancelled = [
    ['query string', '/?error=access_denied&error_description=AADSTS65004%3A+The+user+declined+to+consent'],
    ['URL fragment', '/#error=access_denied&error_description=The+user+cancelled+the+sign-in'],
  ] as const;
  for (const [kind, url] of cancelled) {
    test(`TC_LOGIN_005 Microsoft returns "access_denied" in the ${kind}: sign-in screen stays usable, nothing stored`, async ({ page, sso }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url);
      await sso.expectShown();
      await expect(sso.headline).toBeVisible();
      expect(errors, 'no uncaught script errors').toEqual([]);
      expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    });
  }

  test('TC_LOGIN_003 the Microsoft token in the URL fragment is exchanged with POST /auth/sso-login (Authorization header sent)', async ({ page }) => {
    const exchange = page.waitForRequest((r) => /\/auth\/sso-login$/.test(r.url()));
    await mockSsoLogin(page, 401, 'invalid token');
    await page.goto('/#access_token=fake.jwt.value&token_type=Bearer&expires_in=3600');
    const req = await exchange;
    expect(req.method()).toBe('POST');
    expect(await req.headerValue('authorization')).toMatch(/^Bearer .+/);
  });

  test('TC_LOGIN_004 / Scenario 3 backend rejects a personal account: "Unauthorized" screen shows the message (mocked /auth/sso-login 403)', async ({ page }) => {
    await mockSsoLogin(page, 403, 'Please sign in with your official university Microsoft account.');
    await page.goto('/#access_token=fake.jwt.value&token_type=Bearer&expires_in=3600');
    await expect(page.getByText('Unauthorized', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Please sign in with your official university Microsoft account.')).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage)), 'nothing is stored for a rejected login').toEqual([]);
  });

  test('Validation "Tenant verification": external tenant message is shown (mocked /auth/sso-login 400)', async ({ page }) => {
    await mockSsoLogin(page, 400, 'Access restricted to Indira University accounts only');
    await page.goto('/#access_token=fake.jwt.value&token_type=Bearer&expires_in=3600');
    await expect(page.getByText('Access restricted to Indira University accounts only')).toBeVisible({ timeout: 20_000 });
  });

  test('TC_LOGIN_004 the rejection is a full "Unauthorized" page, not an inline error toast / alert on the sign-in screen', async ({ page }) => {
    test.fail(true, 'Deviation (low): story says "inline error toast" / "error alert" on /login; the app shows a separate "Unauthorized" page with a "Back to Login" button (message text itself comes from the backend).');
    await mockSsoLogin(page, 403, 'Please sign in with your official university Microsoft account.');
    await page.goto('/#access_token=fake.jwt.value&token_type=Bearer&expires_in=3600');
    await expect(page.getByText('Please sign in with your official university Microsoft account.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Sign in with Microsoft')).toBeVisible();
  });

  test('TC_LOGIN_004 "Back to Login" on the Unauthorized page returns to the sign-in screen', async ({ page, sso }) => {
    await mockSsoLogin(page, 403, 'Please sign in with your official university Microsoft account.');
    await page.goto('/#access_token=fake.jwt.value&token_type=Bearer&expires_in=3600');
    await page.getByText('Back to Login', { exact: true }).click({ timeout: 20_000, force: true });
    await sso.expectShown();
    await expect(page.getByText('Unauthorized', { exact: true })).toHaveCount(0);
  });

  test('a server error (500) during the token exchange: the user gets a way back and nothing is stored', async ({ page, sso }) => {
    await mockSsoLogin(page, 500, 'Internal error, please try again');
    await page.goto('/#access_token=fake.jwt.value&token_type=Bearer&expires_in=3600');
    await expect(page.getByText('Internal error, please try again')).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    await page.getByText('Back to Login', { exact: true }).click({ force: true });
    await sso.expectShown();
  });

  test('a server error (500) during the token exchange is not presented as "Unauthorized"', async ({ page }) => {
    test.fail(true, 'Deviation (low, mocked): any failure of /auth/sso-login (400, 401, 403, 500) is shown under the heading "Unauthorized".');
    await mockSsoLogin(page, 500, 'Internal error, please try again');
    await page.goto('/#access_token=fake.jwt.value&token_type=Bearer&expires_in=3600');
    await expect(page.getByText('Internal error, please try again')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Unauthorized', { exact: true })).toHaveCount(0);
  });

  test('a forged access_token in the URL fragment does not sign anybody in', async ({ page }) => {
    const adminCalls: string[] = [];
    page.on('request', (r) => {
      if (/\/myindiranew\/api\/admin\//.test(r.url())) adminCalls.push(r.url());
    });
    await mockSsoLogin(page, 401, 'invalid token');
    await page.goto('/#access_token=not.a.real.token&token_type=Bearer&expires_in=3600');
    await expect(page.getByText('invalid token')).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage)).catch(() => null), { message: 'nothing stored' }).toEqual([]);
    await expect(page.getByText('Admin Dashboard')).toHaveCount(0);
    expect(adminCalls, 'no admin API calls were made').toEqual([]);
  });
});

// =====================================================================================
// Protected-route guard
// =====================================================================================
test.describe('Protected routes without a session @login', () => {
  for (const route of ['/dashboard', '/policies', '/acknowledgements', '/compliance', '/master-data', '/some/unknown/route']) {
    test(`TC_LOGIN_001 anonymous visit to ${route} shows the sign-in screen and calls no admin API`, async ({ page, sso }) => {
      const adminCalls: string[] = [];
      page.on('request', (r) => {
        if (/\/myindiranew\/api\/admin\//.test(r.url())) adminCalls.push(r.url());
      });
      await page.goto(route);
      await sso.expectShown();
      await expect(page.getByText('Admin Dashboard')).toHaveCount(0);
      expect(adminCalls).toEqual([]);
    });
  }

  test('anonymous visitor: after sign-in the app does not return to the deep link (story does not require it)', async ({ page, sso }) => {
    await page.goto('/policies');
    await sso.expectShown();
    // The original path is not preserved (the URL was rewritten to "/"); this documents the behaviour.
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

// =====================================================================================
// Scenario 5 / TC_LOGIN_007: responsive layout
// =====================================================================================
test.describe('Responsive layout @login', () => {
  const sizes = [
    ['mobile 360', 360, 740],
    ['mobile 375', 375, 812],
    ['tablet 768', 768, 1024],
    ['desktop 1920', 1920, 1080],
  ] as const;
  for (const [name, w, h] of sizes) {
    test(`TC_LOGIN_007 ${name}: no horizontal scroll, logo inside the viewport and undistorted, button is full-width tap target`, async ({ page, sso }) => {
      await page.setViewportSize({ width: w, height: h });
      await sso.goto();
      await expect.poll(async () => (await sso.layout()).logo.loaded, { message: 'logo decoded' }).toBe(true);
      const l = await sso.layout();
      expect(l.overflowX, 'no horizontal scroll').toBe(false);
      expect(l.logo.x).toBeGreaterThanOrEqual(0);
      expect(l.logo.x + l.logo.w).toBeLessThanOrEqual(w);
      // The logo box is 272-280 wide; at 360 px it is 272 x 165 for a 900 x 529 image (3% squeeze): tolerance 5%.
      const natural = l.logo.naturalW / l.logo.naturalH;
      expect(Math.abs(l.logo.w / l.logo.h - natural) / natural).toBeLessThan(0.05);
      expect(l.button.h, 'tap target height >= 44').toBeGreaterThanOrEqual(44);
      expect(l.button.w, 'button is wide enough to tap').toBeGreaterThanOrEqual(Math.min(w - 80, 250));
      await expect(sso.helperText).toBeVisible();
    });
  }

  test('Scenario 5 cards stay centred on desktop and mobile', async ({ page, sso }) => {
    for (const w of [360, 1920]) {
      await page.setViewportSize({ width: w, height: 800 });
      await sso.goto();
      const box = await sso.headline.boundingBox();
      const centre = box!.x + box!.width / 2;
      expect(Math.abs(centre - w / 2), `headline centre at ${w}px`).toBeLessThan(3);
    }
  });

  test('Scenario 5 the card column is not stretched on a 1920 px desktop (content stays in a narrow column)', async ({ page, sso }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await sso.goto();
    const l = await sso.layout();
    expect(l.button.w).toBeLessThan(600);
  });
});
