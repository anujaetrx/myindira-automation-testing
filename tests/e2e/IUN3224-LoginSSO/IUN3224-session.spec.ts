import type { Page } from '@playwright/test';
import { test as base, expect } from '@fixtures';
import { DashboardPage } from '@pages/DashboardPage';
import { SsoLoginPage } from '@pages/SsoLoginPage';

/**
 * IUN-3224, signed-in side: session persistence (TC_LOGIN_008, BR-SSO-05), token storage and lifetime (BR-SSO-02),
 * expiry, logout, role handling (TC_LOGIN_006, BR-SSO-04). Anonymous side: IUN3224-login-sso.spec.ts.
 * Docs: docs/test-cases/login-sso.md
 *
 * The previous generic tests used a `userPage` (a student/employee account) that does not exist for this QA tenant
 * (only ADMIN credentials exist) and an assumed header test id. They are replaced by admin-based tests on the real UI.
 *
 * Safety: tokens are only inspected for presence / shape / claims, never printed. Sign Out is client-side only (verified:
 * no API write, no Microsoft call); Microsoft is blocked and writes are answered locally anyway. Each test has its own
 * browser context, so clearing storage never touches the stored session file.
 */
const test = base.extend<{ dash: DashboardPage; sso: (page: Page) => SsoLoginPage }>({
  dash: async ({ adminPage }, use) => use(new DashboardPage(adminPage)),
  sso: async ({}, use) => use((page: Page) => new SsoLoginPage(page)),
});

const API = /\/myindiranew\/api\//;

/** Decodes the claims of a JWT in the page, returning only the claim NAMES and numeric / role / email-shape facts. */
async function claims(page: Page, key: string): Promise<{ parts: number; iat?: number; exp?: number; role?: string; hasEmail?: boolean } | null> {
  return page.evaluate((k) => {
    const t = localStorage.getItem(k);
    if (!t) return null;
    const parts = t.split('.');
    const out: { parts: number; iat?: number; exp?: number; role?: string; hasEmail?: boolean } = { parts: parts.length };
    try {
      const j = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      out.iat = j.iat;
      out.exp = j.exp;
      out.role = j.role;
      out.hasEmail = typeof j.email === 'string' && j.email.includes('@');
    } catch {
      /* not a JWT */
    }
    return out;
  }, key);
}

const authBlock = async (page: Page): Promise<void> => {
  // Sign Out must never reach Microsoft or write to the API from a test.
  await page.route(/login\.microsoftonline\.com|login\.live\.com/, (r) => r.abort());
  await page.route(API, (route) => {
    if (route.request().method() === 'GET') return route.continue();
    return route.fulfill({ json: { success: true, message: 'ok', code: 'OK', data: {} } });
  });
};

// =====================================================================================
// TC_LOGIN_008 / BR-SSO-05: persistence
// =====================================================================================
test.describe('Session persistence @login', () => {
  test('TC_LOGIN_008 reloading /dashboard keeps the user signed in', async ({ dash, adminPage }) => {
    await dash.goto();
    await dash.reload();
    await dash.expectLoaded();
    await expect(adminPage.getByText('Sign in with Microsoft')).toHaveCount(0);
  });

  test('TC_LOGIN_008 reloading a deep route (/policies) keeps the user on that route', async ({ adminPage }) => {
    await adminPage.goto('/policies');
    await expect(adminPage.getByText('Policies', { exact: true }).first()).toBeVisible();
    await adminPage.reload();
    await expect(adminPage.getByText('Policies', { exact: true }).first()).toBeVisible();
    expect(new URL(adminPage.url()).pathname).toBe('/policies');
    await expect(adminPage.getByText('Sign in with Microsoft')).toHaveCount(0);
  });

  test('BR-SSO-05 a second tab of the same browser is signed in as well (localStorage session)', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    const tab2 = await adminPage.context().newPage();
    await tab2.goto('/dashboard');
    await expect(tab2.getByText('Admin Dashboard').first()).toBeVisible();
    await tab2.close();
  });

  test('BR-SSO-04 a signed-in admin opening the app root is sent to /dashboard', async ({ adminPage }) => {
    await adminPage.goto('/');
    await expect(adminPage).toHaveURL(/\/dashboard$/);
    await expect(adminPage.getByText('Admin Dashboard').first()).toBeVisible();
  });

  test('TC_LOGIN_003 after sign-in the user hydrates from the API: GET /auth/me returns the ADMIN profile', async ({ adminPage }) => {
    const me = adminPage.waitForResponse((r) => /\/auth\/me$/.test(r.url()));
    await adminPage.goto('/dashboard');
    const body = (await (await me).json()) as { data: { profile: { role: string; officialEmail: string } } };
    expect(body.data.profile.role).toBe('ADMIN');
    expect(body.data.profile.officialEmail).toMatch(/@indira(edu|iscm)\.com$/); // BR-SSO-01: institutional domain
  });
});

// =====================================================================================
// BR-SSO-02: token storage and lifetime
// =====================================================================================
test.describe('Token storage and lifetime @login', () => {
  test('TC_LOGIN_003 after sign-in the app keeps sso_token, internal_token and user_profile; both tokens are JWTs', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    const keys = await adminPage.evaluate(() => Object.keys(localStorage));
    for (const k of ['sso_token', 'internal_token', 'user_profile']) expect(keys, k).toContain(k);
    expect((await claims(adminPage, 'internal_token'))!.parts).toBe(3);
    expect((await claims(adminPage, 'sso_token'))!.parts).toBe(3);
  });

  test('TC_LOGIN_003 the internal token carries the ADMIN role and an institutional e-mail claim', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    const c = await claims(adminPage, 'internal_token');
    expect(c!.role).toBe('ADMIN');
    expect(c!.hasEmail).toBe(true);
    expect(c!.exp!, 'token has an expiry in the future').toBeGreaterThan(Date.now() / 1000);
  });

  test('BR-SSO-02 tokens never appear in the page URL or in cookies readable by scripts', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    expect(adminPage.url()).not.toMatch(/token|jwt|eyJ/i);
    expect(await adminPage.evaluate(() => document.cookie)).not.toMatch(/eyJ/);
  });

  test('BR-SSO-02 / Scenario 2 session is held in secure HTTP-only cookies', async ({ adminPage }) => {
    test.fail(true, 'Deviation: tokens live in localStorage (readable by any script, XSS-exposed); the app sets no HTTP-only cookie.');
    await adminPage.goto('/dashboard');
    const host = new URL(adminPage.url()).hostname;
    const cookies = (await adminPage.context().cookies()).filter((c) => host.endsWith(c.domain.replace(/^\./, '')) || c.domain.replace(/^\./, '') === host);
    expect(cookies.some((c) => c.httpOnly && c.secure)).toBe(true);
  });

  test('BR-SSO-02 session lifetime: the internal JWT is valid for 8 hours', async ({ adminPage }) => {
    test.fail(true, 'Deviation: the internal token lives 30 minutes (exp - iat = 1800 s), not 8 hours; the user is signed out after 30 min.');
    await adminPage.goto('/dashboard');
    const c = await claims(adminPage, 'internal_token');
    expect(c!.exp! - c!.iat!).toBe(8 * 3600);
  });
});

// =====================================================================================
// Expiry / discarded session
// =====================================================================================
test.describe('Session expiry @login', () => {
  for (const key of ['internal_token', 'sso_token', 'user_profile']) {
    test(`BR-SSO-02 losing "${key}" from storage sends the user back to the sign-in screen on reload`, async ({ adminPage, sso }) => {
      await adminPage.goto('/dashboard');
      await expect(adminPage.getByText('Admin Dashboard').first()).toBeVisible();
      await adminPage.evaluate((k) => localStorage.removeItem(k), key);
      await adminPage.reload();
      await sso(adminPage).expectShown();
      await expect(adminPage.getByText('Admin Dashboard')).toHaveCount(0);
    });
  }

  test('BR-SSO-02 a 401 from the API while the user works ends the session: sign-in screen, storage cleared', async ({ adminPage, sso }) => {
    await adminPage.goto('/dashboard');
    await expect(adminPage.getByText('Admin Dashboard').first()).toBeVisible();
    await adminPage.route(/\/myindiranew\/api\/(?!auth\/)/, (r) =>
      r.fulfill({ status: 401, json: { success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' } }),
    );
    await adminPage.getByText('Policies', { exact: true }).first().click();
    await sso(adminPage).expectShown();
    expect(await adminPage.evaluate(() => Object.keys(localStorage))).toEqual([]);
    await expect(adminPage.getByText('Admin Dashboard')).toHaveCount(0);
  });

  test('BR-SSO-02 after the session was discarded, a protected deep link does not render admin data', async ({ adminPage, sso }) => {
    await adminPage.goto('/dashboard');
    await adminPage.evaluate(() => localStorage.clear());
    const adminCalls: string[] = [];
    adminPage.on('request', (r) => {
      if (/\/myindiranew\/api\/admin\//.test(r.url())) adminCalls.push(r.url());
    });
    await adminPage.goto('/compliance');
    await sso(adminPage).expectShown();
    expect(adminCalls).toEqual([]);
  });

  test('BR-SSO-02 the session expires after 8 hours of inactivity (idle timer)', async () => {
    test.skip(true, 'Not automated: needs 8 hours of real time; the server decides expiry (token lifetime itself is checked above).');
  });
});

// =====================================================================================
// Logout
// =====================================================================================
test.describe('Sign out @login', () => {
  test('TC_LOGIN_003 the avatar menu shows name, role badge, e-mail and a Logout action', async ({ dash, adminPage }) => {
    await dash.goto();
    await dash.openUserMenu();
    const profile = await adminPage.evaluate(() => JSON.parse(localStorage.getItem('user_profile') ?? '{}') as { fullName: string; officialEmail: string });
    await expect(adminPage.getByText(profile.fullName, { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Admin', { exact: true }).first()).toBeVisible();
    await expect(adminPage.getByText(profile.officialEmail, { exact: true })).toBeVisible();
    await expect(dash.logoutItem).toBeVisible();
  });

  test('BR-SSO-02 Logout asks for confirmation; Cancel keeps the session', async ({ dash, adminPage }) => {
    await authBlock(adminPage);
    await dash.goto();
    await dash.openSignOutDialog();
    await expect(adminPage.getByText('Are you sure you want to sign out?', { exact: false })).toBeVisible();
    await dash.cancelSignOut();
    await expect(dash.signOutPrompt).toHaveCount(0);
    await expect(adminPage).toHaveURL(/\/dashboard/);
    expect(await adminPage.evaluate(() => Object.keys(localStorage))).toContain('internal_token');
  });

  test('BR-SSO-02 confirming Sign Out clears the stored tokens and shows the sign-in screen', async ({ dash, adminPage, sso }) => {
    const writes: string[] = [];
    await adminPage.route(API, (route) => {
      const q = route.request();
      if (q.method() === 'GET') return route.continue();
      writes.push(`${q.method()} ${q.url()}`);
      return route.fulfill({ json: { success: true, message: 'ok', code: 'OK', data: {} } });
    });
    await adminPage.route(/login\.microsoftonline\.com|login\.live\.com/, (r) => r.abort());
    await dash.goto();
    await dash.openSignOutDialog();
    await dash.confirmSignOut();
    await sso(adminPage).expectShown();
    const keys = await adminPage.evaluate(() => Object.keys(localStorage));
    for (const k of ['sso_token', 'internal_token', 'user_profile']) expect(keys, k).not.toContain(k);
    expect(writes, 'sign out is client side only: it sends no write call').toEqual([]);
  });

  test('BR-SSO-02 after Sign Out a protected URL is not served and the back button does not restore the app', async ({ dash, adminPage, sso }) => {
    await authBlock(adminPage);
    await dash.goto();
    await dash.openSignOutDialog();
    await dash.confirmSignOut();
    await sso(adminPage).expectShown();
    await adminPage.goto('/dashboard');
    await sso(adminPage).expectShown();
    await adminPage.goBack();
    await expect(adminPage.getByText('Admin Dashboard')).toHaveCount(0);
  });

  test('BR-SSO-02 Sign Out revokes the token on the server', async () => {
    test.skip(true, 'Not automated: the stored admin session is shared by every test run; revoking it server-side would break them. Sign Out itself sends no request (checked above), so the old token stays valid until it expires (potential security gap, to confirm with the team).');
  });
});

// =====================================================================================
// Roles (TC_LOGIN_006 / BR-SSO-04): only an ADMIN login exists, so student / faculty are SIMULATED by answering GET /auth/me
// =====================================================================================
test.describe('Role-based landing @login', () => {
  const meResponse = (role: string, isTeaching: boolean) => ({
    json: {
      success: true,
      message: 'Profile fetched',
      code: 'OK',
      data: {
        accessToken: null,
        tokenType: 'Bearer',
        profile: { userId: 11, fullName: 'Role Probe', officialEmail: 'role.probe@indiraedu.com', role, department: 'd', campus: 'c', profileImageId: null, isTeaching },
      },
    },
  });

  test('TC_LOGIN_006 ADMIN lands on /dashboard with the admin dashboard', async ({ adminPage }) => {
    await adminPage.goto('/');
    await expect(adminPage).toHaveURL(/\/dashboard$/);
    await expect(adminPage.getByText('Admin Dashboard').first()).toBeVisible();
  });

  test('TC_LOGIN_006 (mocked /auth/me = STUDENT) the admin dashboard is not shown to a student', async ({ adminPage }) => {
    await adminPage.route(/\/auth\/me$/, (r) => r.fulfill(meResponse('STUDENT', false)));
    await adminPage.goto('/');
    await expect(adminPage.getByText('Upcoming Schedule')).toBeVisible();
    await expect(adminPage.getByText('Admin Dashboard')).toHaveCount(0);
    await expect(adminPage.getByText('Bulk Upload', { exact: true })).toHaveCount(0);
  });

  test('TC_LOGIN_006 (mocked /auth/me = STUDENT) student lands on /feed', async ({ adminPage }) => {
    test.fail(true, 'Deviation (mocked profile): a student stays on /dashboard (a student home is rendered there); the story says /feed.');
    await adminPage.route(/\/auth\/me$/, (r) => r.fulfill(meResponse('STUDENT', false)));
    await adminPage.goto('/');
    await expect(adminPage).toHaveURL(/\/feed$/);
  });

  test('TC_LOGIN_006 (mocked /auth/me = faculty) faculty lands on /timetable', async ({ adminPage }) => {
    test.fail(true, 'Deviation (mocked profile): an employee stays on /dashboard (feed is rendered there); the story says /timetable.');
    await adminPage.route(/\/auth\/me$/, (r) => r.fulfill(meResponse('EMPLOYEE', true)));
    await adminPage.goto('/');
    await expect(adminPage).toHaveURL(/\/timetable$/);
  });

  test('Unauthorized role: a non-admin profile must not call the admin dashboard API', async ({ adminPage }) => {
    test.fail(true, 'Deviation (mocked profile): GET /admin/dashboard is still requested for a STUDENT profile; the server must refuse it (not verifiable here).');
    const adminCalls: string[] = [];
    adminPage.on('request', (r) => {
      if (/\/myindiranew\/api\/admin\//.test(r.url())) adminCalls.push(r.url());
    });
    await adminPage.route(/\/auth\/me$/, (r) => r.fulfill(meResponse('STUDENT', false)));
    await adminPage.goto('/dashboard');
    await expect(adminPage.getByText('Upcoming Schedule')).toBeVisible();
    expect(adminCalls).toEqual([]);
  });

  test('BR-SSO-03 first-time login auto-provisioning of the local profile', async () => {
    test.skip(true, 'Not automated: needs a Microsoft account that is in the registry but has never logged in; no such account and no credentials may be entered by tests.');
  });
  test('TC_LOGIN_006 faculty / student real logins', async () => {
    test.skip(true, 'Not automated: only an ADMIN login exists for QA. Student and faculty landing is simulated above with a mocked profile.');
  });
});
