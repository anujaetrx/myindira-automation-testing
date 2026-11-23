import type { Page } from '@playwright/test';
import { test as base, expect } from '@fixtures';
import {
  DASHBOARD_API,
  DashboardPage,
  dashboardResponse,
  type DashboardAtRisk,
  type DashboardData,
} from '@pages/DashboardPage';
import { Tags } from '@utils/constants';

/**
 * IUN-3229 "Admin Dashboard & Compliance Overview" (TC_DB_001 .. 007, scenarios 1-4, BR-DB-01 .. 06) plus the story's
 * validations (zero-division guard, drill-down, live data) and the cross-module consistency with Policies,
 * Acknowledgements and Compliance. Results, deviations and what is not automated: docs/test-cases/dashboard.md
 *
 * Three kinds of check, as in the other modules:
 *   - REAL DATA: GET /admin/dashboard is captured and the screen is compared with it (QA counts differ from the story's
 *     illustrative 416 / 303 / 103 numbers, so nothing is hard-coded).
 *   - MOCKED API: the dashboard call is answered with hand-built JSON for situations that cannot be created safely
 *     (tiers, boundaries, empty, errors, 6/406). These test how the screen RENDERS what it is given.
 *   - KNOWN DEVIATIONS: test.fail() keeps the run green and reports the gap; the test turns red when the app is fixed.
 * Nothing here changes data. The other modules are only READ (their list APIs are captured).
 */
const test = base.extend<{ dash: DashboardPage }>({
  dash: async ({ adminPage }, use) => use(new DashboardPage(adminPage)),
});

const RED = 'rgb(229, 57, 53)';
const AMBER = 'rgb(255, 198, 5)';
const GREEN = 'rgb(46, 125, 50)';

const risk = (over: Partial<DashboardAtRisk> = {}): DashboardAtRisk => ({
  policyId: 1,
  policyTitle: 'Mock policy',
  deadline: '2099-01-01',
  totalAssigned: 406,
  totalAcknowledged: 6,
  compliancePercentage: 1.5,
  status: 'AT_RISK',
  ...over,
});

async function mock(page: Page, data: Partial<DashboardData>): Promise<void> {
  await page.route(DASHBOARD_API, (route) => route.fulfill({ json: dashboardResponse(data) }));
}

/** Opens the real dashboard and returns what GET /admin/dashboard sent for it. */
async function openReal(dash: DashboardPage, page: Page): Promise<DashboardData> {
  // The body is read inside the listener: it is no longer available once the page navigates away.
  const captured = new Promise<DashboardData>((resolve) => {
    const handler = async (r: import('@playwright/test').Response): Promise<void> => {
      if (!DASHBOARD_API.test(r.url()) || r.request().method() !== 'GET') return;
      try {
        const body = (await r.json()) as { data: DashboardData };
        page.off('response', handler);
        resolve(body.data);
      } catch {
        /* body gone: wait for the next response */
      }
    };
    page.on('response', handler);
  });
  await dash.goto();
  const data = await captured;
  await expect.poll(async () => (await dash.tiles()).Total).toBe(String(data.totalUsers));
  return data;
}

/** Local calendar date as yyyy-mm-dd, plus N days. */
const isoDay = (plusDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + plusDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Reads a list API of another module (read-only): opens its screen and returns the JSON the screen received. */
async function readModule<T = Record<string, unknown>>(page: Page, route: string, api: RegExp): Promise<{ totalElements: number; content: T[] }> {
  const response = page.waitForResponse((r) => api.test(r.url()) && r.request().method() === 'GET');
  await page.goto(route);
  return ((await (await response).json()) as { data: { totalElements: number; content: T[] } }).data;
}
const POLICIES_API = /\/admin\/policies\?/;
const ACKS_API = /\/admin\/acknowledgement-requests\?/;
const COMPLIANCE_API = /\/admin\/compliance-report\?/;
interface ReportRow {
  type: 'POLICY' | 'ACK_REQUEST';
  itemId: number;
  totalAssigned: number;
  totalAcknowledged: number;
  compliancePercentage: number;
  status: string;
}

const tierOf = (v: number): string => (v < 50 ? 'Low' : v < 85 ? 'Moderate' : 'Compliant');

// =====================================================================================
// TS_DB_01 / TC_DB_001: page load and layout
// =====================================================================================
test.describe('TS_DB_01 page load @dashboard', () => {
  test(`signed-in admin sees the dashboard and admin menu ${Tags.smoke}`, async ({ adminPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();
    await dashboard.expectLoaded();

    for (const item of ['Social Feed', 'Admin Posts', 'Bulk Upload', 'Master Data', 'Notifications', 'Policies', 'Compliance']) {
      await expect(adminPage.getByText(item, { exact: true }).first(), `menu item "${item}"`).toBeVisible();
    }
  });

  test(`a saved session survives a reload ${Tags.regression}`, async ({ adminPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();
    await dashboard.reload();
    await dashboard.expectLoaded();
  });

  test('TC_DB_001 header "Admin Dashboard" with "Indira University Overview", all four sections and six tiles render', async ({ dash }) => {
    await dash.goto();
    await expect(dash.headingLocator).toBeVisible();
    await expect(dash.subtitle).toBeVisible();
    for (const s of ['User Statistics', 'Content', 'Overall Compliance']) await expect(dash.section(s), s).toBeVisible();
    await expect(dash.section('At-Risk Policies')).toBeVisible();
    expect(Object.keys(await dash.tiles()).sort()).toEqual(['Acknowledgement', 'Admins', 'Employees', 'Policies', 'Students', 'Total']);
  });

  test('TC_DB_001 side menu lists Dashboard, Policies, Acknowledgements and Compliance, with Dashboard first', async ({ dash }) => {
    await dash.goto();
    for (const item of ['Dashboard', 'Policies', 'Acknowledgements', 'Compliance', 'Reported Posts', 'Communities']) {
      await expect(dash.sidebarItem(item), item).toBeVisible();
    }
  });

  test('Dashboard Initialization: the KPIs load asynchronously from GET /admin/dashboard (1 call, sometimes 2)', async ({ dash, adminPage }) => {
    const calls: string[] = [];
    adminPage.on('request', (r) => {
      if (DASHBOARD_API.test(r.url()) && r.method() === 'GET') calls.push(r.url());
    });
    await openReal(dash, adminPage);
    await adminPage.waitForTimeout(1_500);
    // Observed: usually one call, sometimes the screen asks twice on load (harmless duplicate, see doc).
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.length).toBeLessThanOrEqual(2);
  });
});

// =====================================================================================
// TS_DB_02 / Scenario 1: KPI cards, BR-DB-01, BR-DB-02
// =====================================================================================
test.describe('TS_DB_02 KPI cards @dashboard', () => {
  test('TC_DB_002 Total / Students / Employees / Admins tiles equal the API counts', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const t = await dash.tiles();
    expect(t.Total).toBe(String(d.totalUsers));
    expect(t.Students).toBe(String(d.totalStudents));
    expect(t.Employees).toBe(String(d.totalEmployees));
    expect(t.Admins).toBe(String(d.totalAdmins));
  });

  test('TC_DB_002 / BR-DB-01 Total Users = Students + Employees + Admins (on screen and in the API)', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    expect(d.totalUsers).toBe(d.totalStudents + d.totalEmployees + d.totalAdmins);
    const t = await dash.tiles();
    expect(Number(t.Total)).toBe(Number(t.Students) + Number(t.Employees) + Number(t.Admins));
  });

  test('TC_DB_002 BR-DB-01 mismatch case (mocked): the screen shows the figures it is given, it does not recompute', async ({ dash, adminPage }) => {
    await mock(adminPage, { totalUsers: 100, totalStudents: 60, totalEmployees: 30, totalAdmins: 5 });
    await dash.goto();
    const t = await dash.tiles();
    expect([t.Total, t.Students, t.Employees, t.Admins]).toEqual(['100', '60', '30', '5']);
  });

  test('TC_DB_003 Content tiles: "Policies" shows policiesPublished and "Acknowledgement" shows ackRequestsPublished', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const t = await dash.tiles();
    expect(t.Policies).toBe(String(d.policiesPublished));
    expect(t.Acknowledgement).toBe(String(d.ackRequestsPublished));
  });

  test('BR-DB-02 the Acknowledgement KPI is the total of completed individual sign-offs across all policies', async ({ dash, adminPage }) => {
    test.fail(true, 'Deviation: the tile shows the NUMBER OF ACK REQUESTS published (ackRequestsPublished, 3 on QA), not the sum of completed sign-offs (17 on QA).');
    await openReal(dash, adminPage);
    const t = await dash.tiles();
    const report = await readModule<ReportRow>(adminPage, '/compliance', COMPLIANCE_API);
    const signOffs = report.content.reduce((n, r) => n + r.totalAcknowledged, 0);
    expect(Number(t.Acknowledgement)).toBe(signOffs);
  });

  test('TC_DB_003 after the data changes, a refresh shows the new Acknowledgement / Policies figures (mocked sequence)', async ({ dash, adminPage }) => {
    let call = 0;
    await adminPage.route(DASHBOARD_API, (route) => {
      call += 1;
      return route.fulfill({ json: dashboardResponse(call === 1 ? { policiesPublished: 5, ackRequestsPublished: 7 } : { policiesPublished: 6, ackRequestsPublished: 8 }) });
    });
    await dash.goto();
    expect(await dash.tiles()).toMatchObject({ Policies: '5', Acknowledgement: '7' });
    await dash.reload();
    await expect.poll(async () => dash.tiles()).toMatchObject({ Policies: '6', Acknowledgement: '8' });
  });

  test('TC_DB_003 coming back to the dashboard from another screen re-reads the data (no stale cache)', async ({ dash, adminPage }) => {
    test.fail(true, 'Deviation (low/medium): in-app navigation back to /dashboard shows the cached figures without a new GET /admin/dashboard; only a browser reload refreshes them.');
    await dash.goto();
    await adminPage.getByText('Policies', { exact: true }).first().click();
    await expect(adminPage).toHaveURL(/\/policies/);
    const again = adminPage.waitForResponse((r) => DASHBOARD_API.test(r.url()), { timeout: 5_000 });
    await dash.sidebarItem('Dashboard').click();
    await again;
    await dash.expectLoaded();
  });

  test('Validation "Live Database Verification": there is no refresh button, refresh = reload of the page', async ({ dash, adminPage }) => {
    await dash.goto();
    await expect(adminPage.getByRole('button', { name: /refresh|reload/i })).toHaveCount(0);
  });
});

// =====================================================================================
// TS_DB_03 / Scenario 2: overall compliance and tier badge, zero-division guard
// =====================================================================================
test.describe('TS_DB_03 overall compliance @dashboard', () => {
  test('TC_DB_004 real data: the score is shown and the tier badge matches it', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const c = (await dash.compliance())!;
    expect(parseFloat(c.text)).toBeCloseTo(d.overallCompliance, 1);
    expect(c.badge).toBe(tierOf(d.overallCompliance));
  });

  const low: Array<[number, string]> = [
    [0, RED],
    [0.1, RED],
    [49.9, RED],
  ];
  for (const [v, colour] of low) {
    test(`TC_DB_004 ${v}% shows the "Low" tier with a red badge (mocked)`, async ({ dash, adminPage }) => {
      await mock(adminPage, { overallCompliance: v });
      await dash.goto();
      const c = (await dash.compliance())!;
      expect(c.badge).toBe('Low');
      expect(c.badgeColor).toBe(colour);
      expect(c.barColor).toBe(colour);
    });
  }

  for (const v of [50, 60, 74.9]) {
    test(`TC_DB_004 ${v}% shows the "Moderate" tier with an amber badge (mocked)`, async ({ dash, adminPage }) => {
      await mock(adminPage, { overallCompliance: v });
      await dash.goto();
      const c = (await dash.compliance())!;
      expect(c.badge).toBe('Moderate');
      expect(c.badgeColor).toBe(AMBER);
    });
  }

  for (const v of [75, 80, 84.9]) {
    test(`TC_DB_004 / BR-DB-05 ${v}% is still "Moderate" (amber): the Compliant tier starts at 85.0%`, async ({ dash, adminPage }) => {
      test.fail(true, 'Deviation: the badge turns green "Healthy" from 75.0% (observed with 75, 79.9, 80, 84.9); the story says Moderate up to 84.9%.');
      await mock(adminPage, { overallCompliance: v });
      await dash.goto();
      const c = (await dash.compliance())!;
      expect(c.badge).toBe('Moderate');
      expect(c.badgeColor).toBe(AMBER);
    });
  }

  for (const v of [85, 100]) {
    test(`TC_DB_004 ${v}% is the top tier with a green badge (mocked)`, async ({ dash, adminPage }) => {
      await mock(adminPage, { overallCompliance: v });
      await dash.goto();
      const c = (await dash.compliance())!;
      expect(c.badgeColor).toBe(GREEN);
      expect(c.barColor).toBe(GREEN);
    });
  }

  test('TC_DB_004 / BR-DB-05 the top tier is labelled "Compliant"', async ({ dash, adminPage }) => {
    test.fail(true, 'Deviation (low): the label is "Healthy", the story says "Compliant".');
    await mock(adminPage, { overallCompliance: 90 });
    await dash.goto();
    expect((await dash.compliance())!.badge).toBe('Compliant');
  });

  test('Scenario 2 / Macro Compliance Calculation: the score is shown to 1 decimal place', async ({ dash, adminPage }) => {
    test.fail(true, 'Deviation: whole numbers are shown without the decimal ("0%", "50%", "100%"), story: "0.0%", "50.0%".');
    await mock(adminPage, { overallCompliance: 50 });
    await dash.goto();
    expect((await dash.compliance())!.text).toBe('50.0%');
  });

  test('Scenario 2 a value with one decimal is shown as given (mocked 37.5)', async ({ dash, adminPage }) => {
    await mock(adminPage, { overallCompliance: 37.5 });
    await dash.goto();
    expect((await dash.compliance())!.text).toBe('37.5%');
  });

  test('Validation "Zero Division Guard": nothing assigned shows 0 / 0 acknowledged and no NaN anywhere (mocked)', async ({ dash, adminPage }) => {
    await mock(adminPage, {
      overallCompliance: 0,
      atRiskPolicies: [risk({ totalAssigned: 0, totalAcknowledged: 0, compliancePercentage: 0, status: 'OVERDUE', deadline: '2020-01-01' })],
    });
    await dash.goto();
    const cards = await dash.riskCards();
    expect(cards[0].counter).toBe('0/0 acknowledged');
    const body = await adminPage.locator('body').innerText();
    expect(body).not.toMatch(/NaN|undefined|Infinity/);
    expect(Number.isFinite((await dash.compliance())!.barScale)).toBe(true);
  });

  test('Validation "Zero Division Guard": Overall Compliance defaults to "0.0%" with no obligations (mocked)', async ({ dash, adminPage }) => {
    test.fail(true, 'Deviation (low): shows "0%" instead of "0.0%" (see the one-decimal test).');
    await mock(adminPage, { overallCompliance: 0, atRiskPolicies: [] });
    await dash.goto();
    expect((await dash.compliance())!.text).toBe('0.0%');
  });

  test('Scenario 2 progress bar of the compliance card follows the score (mocked 49.9 -> 0.499)', async ({ dash, adminPage }) => {
    await mock(adminPage, { overallCompliance: 49.9 });
    await dash.goto();
    await expect.poll(async () => (await dash.compliance())!.barScale).toBeCloseTo(0.499, 2);
  });

  test('Macro Compliance Calculation: the score agrees with completed / required obligations from the Compliance report', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const report = await readModule<ReportRow>(adminPage, '/compliance', COMPLIANCE_API);
    const pct = (rows: ReportRow[]): number => {
      const assigned = rows.reduce((n, r) => n + r.totalAssigned, 0);
      const done = rows.reduce((n, r) => n + r.totalAcknowledged, 0);
      return assigned === 0 ? 0 : Math.round((done / assigned) * 1000) / 10;
    };
    const all = pct(report.content);
    const policiesOnly = pct(report.content.filter((r) => r.type === 'POLICY'));
    const close = (x: number): boolean => Math.abs(x - d.overallCompliance) <= 0.1;
    expect(close(all) || close(policiesOnly), `dashboard ${d.overallCompliance}, all items ${all}, policies only ${policiesOnly}`).toBe(true);
  });
});

// =====================================================================================
// TS_DB_04 / Scenarios 3 and 4: at-risk feed, severity, rounding, sorting, drill-down
// =====================================================================================
test.describe('TS_DB_04 at-risk policies @dashboard', () => {
  test('TC_DB_006 real data: one card per at-risk policy with title, "X/Y acknowledged" and status pill from the API, in API order', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const cards = await dash.riskCards();
    expect(cards).toHaveLength(d.atRiskPolicies.length);
    d.atRiskPolicies.forEach((p, i) => {
      expect(cards[i].title, `card ${i} title`).toBe(p.policyTitle);
      expect(cards[i].counter, `card ${i} counter`).toBe(`${p.totalAcknowledged}/${p.totalAssigned} acknowledged`);
      expect(cards[i].status, `card ${i} status`).toBe(p.status);
    });
  });

  test('TC_DB_006 / BR-DB-03 real data: every denominator is an active target cohort (students + employees, employees only, students only or everybody)', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const cohorts = new Set([d.totalStudents + d.totalEmployees, d.totalEmployees, d.totalStudents, d.totalUsers]);
    for (const p of d.atRiskPolicies) expect(cohorts.has(p.totalAssigned), `${p.policyTitle}: ${p.totalAssigned}`).toBe(true);
    const cards = await dash.riskCards();
    for (const c of cards) expect(c.counter).toMatch(/^\d+\/\d+ acknowledged$/);
  });

  test('TC_DB_006 / BR-DB-03 campus-wide and employee-only policies show their own denominators (mocked)', async ({ dash, adminPage }) => {
    await mock(adminPage, {
      atRiskPolicies: [
        risk({ policyId: 1, policyTitle: 'Campus wide', totalAssigned: 2509, totalAcknowledged: 10 }),
        risk({ policyId: 2, policyTitle: 'Employees only', totalAssigned: 549, totalAcknowledged: 10 }),
      ],
    });
    await dash.goto();
    const cards = await dash.riskCards();
    expect(cards.map((c) => c.counter)).toEqual(['10/2509 acknowledged', '10/549 acknowledged']);
  });

  test('TC_DB_007 / Scenario 4 OVERDUE shows a red pill and AT_RISK an amber pill (mocked)', async ({ dash, adminPage }) => {
    await mock(adminPage, {
      atRiskPolicies: [
        risk({ policyId: 1, policyTitle: 'Expired', deadline: '2020-01-01', totalAssigned: 100, totalAcknowledged: 40, compliancePercentage: 40, status: 'OVERDUE' }),
        risk({ policyId: 2, policyTitle: 'Due soon', deadline: isoDay(3), totalAssigned: 100, totalAcknowledged: 40, compliancePercentage: 40, status: 'AT_RISK' }),
      ],
    });
    await dash.goto();
    const [overdue, atRisk] = await dash.riskCards();
    expect([overdue.status, overdue.pillColor]).toEqual(['OVERDUE', RED]);
    expect([atRisk.status, atRisk.pillColor]).toEqual(['AT_RISK', AMBER]);
  });

  test('TC_DB_007 / BR-DB-06 real data: every listed policy meets the OVERDUE / AT_RISK rule for its deadline and completion', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const today = isoDay(0);
    const in7 = isoDay(7);
    for (const p of d.atRiskPolicies) {
      const ctx = `${p.policyTitle} (${p.deadline}, ${p.compliancePercentage}%)`;
      if (p.deadline < today) {
        expect(p.status, ctx).toBe('OVERDUE');
        expect(p.compliancePercentage, ctx).toBeLessThan(100);
      } else {
        expect(p.status, ctx).toBe('AT_RISK');
        expect(p.deadline < in7, `${ctx} is due within 7 days`).toBe(true);
        expect(p.compliancePercentage, ctx).toBeLessThan(80);
      }
    }
  });

  test('BR-DB-06 the feed is sorted OVERDUE first, then by lowest completion', async ({ dash, adminPage }) => {
    test.fail(true, 'Deviation: the feed follows policy id order (QA: a 0.2% policy is listed before several 0% policies).');
    const d = await openReal(dash, adminPage);
    const rank = (s: string): number => (s === 'OVERDUE' ? 0 : 1);
    const sorted = [...d.atRiskPolicies].sort((a, b) => rank(a.status) - rank(b.status) || a.compliancePercentage - b.compliancePercentage);
    expect(d.atRiskPolicies.map((p) => p.policyId)).toEqual(sorted.map((p) => p.policyId));
  });

  test('Scenario 3 / TC_DB_005 progress bar width follows the exact (unrounded) percentage: 1.48% -> scale 0.0148 (mocked)', async ({ dash, adminPage }) => {
    await mock(adminPage, { atRiskPolicies: [risk({ totalAssigned: 406, totalAcknowledged: 6, compliancePercentage: 1.48 })] });
    await dash.goto();
    const [card] = await dash.riskCards();
    expect(card.barScale).toBeGreaterThan(0.0143);
    expect(card.barScale).toBeLessThan(0.0153);
  });

  test('Scenario 3 / TC_DB_005 progress bar of a half-complete policy is half full (mocked 50%)', async ({ dash, adminPage }) => {
    await mock(adminPage, { atRiskPolicies: [risk({ totalAssigned: 10, totalAcknowledged: 5, compliancePercentage: 50 })] });
    await dash.goto();
    await expect.poll(async () => (await dash.riskCards())[0].barScale).toBeCloseTo(0.5, 2);
  });

  test('Scenario 3 / BR-DB-04 the card shows the rounded percentage text "1.5%" for 6 of 406', async ({ dash, adminPage }) => {
    test.fail(true, 'Deviation: at-risk cards show no percentage text at all (only "6/406 acknowledged" and the bar); the API already sends the value rounded to one decimal, so the exact 1.48 never reaches the screen.');
    await mock(adminPage, { atRiskPolicies: [risk({ totalAssigned: 406, totalAcknowledged: 6, compliancePercentage: 1.5 })] });
    await dash.goto();
    const [card] = await dash.riskCards();
    expect(card.text).toContain('1.5%');
  });

  test('TC_DB_005 real data: bar scale agrees with the API percentage of every card', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    await expect
      .poll(async () => (await dash.riskCards()).every((c, i) => Math.abs(c.barScale - d.atRiskPolicies[i].compliancePercentage / 100) < 0.002))
      .toBe(true);
  });

  test('Validation "Drill-Down Navigation": clicking an at-risk card opens /acknowledgements filtered by that policy id', async ({ dash, adminPage }) => {
    test.fail(true, 'Deviation: the cards are not clickable (no navigation, no handler); the URL stays /dashboard.');
    const d = await openReal(dash, adminPage);
    await dash.riskCard(d.atRiskPolicies[0].policyTitle).click();
    await expect(adminPage).toHaveURL(/\/acknowledgements/, { timeout: 5_000 });
    expect(adminPage.url()).toContain(String(d.atRiskPolicies[0].policyId));
  });

  test('At-Risk feed with no at-risk policy (mocked): no cards, no errors, the rest of the dashboard still shows', async ({ dash, adminPage }) => {
    await mock(adminPage, { atRiskPolicies: [] });
    await dash.goto();
    expect(await dash.riskCards()).toHaveLength(0);
    expect(Object.keys(await dash.tiles())).toHaveLength(6);
    await expect(dash.section('Overall Compliance')).toBeVisible();
  });

  test('At-Risk feed with a very long title and 40 policies (mocked): the page still renders every card', async ({ dash, adminPage }) => {
    const many = Array.from({ length: 40 }, (_, i) => risk({ policyId: i + 1, policyTitle: i === 0 ? 'L'.repeat(150) : `Policy ${i + 1}`, status: 'OVERDUE' }));
    await mock(adminPage, { atRiskPolicies: many });
    await dash.goto();
    expect(await dash.riskCards()).toHaveLength(40);
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
});

// =====================================================================================
// TS_DB_05: loading / empty / error states
// =====================================================================================
test.describe('TS_DB_05 loading, empty and error states @dashboard', () => {
  test('loading state: a spinner shows while the call is slow, no stale numbers, then the data replaces it', async ({ dash, adminPage }) => {
    await adminPage.route(DASHBOARD_API, async (route) => {
      await new Promise((r) => setTimeout(r, 3_000)); // simulated slow network
      await route.continue();
    });
    await adminPage.goto('/dashboard'); // not dash.goto(): it waits for the heading, which renders with the data
    await expect(dash.loader).toBeVisible();
    await expect(dash.cards).toHaveCount(0);
    await expect(dash.headingLocator).toBeVisible({ timeout: 20_000 });
    await expect(dash.cards.first()).toBeVisible();
  });

  test('empty state (mocked, every figure 0): six tiles show 0, no NaN / undefined', async ({ dash, adminPage }) => {
    await mock(adminPage, { totalUsers: 0, totalStudents: 0, totalEmployees: 0, totalAdmins: 0, policiesPublished: 0, ackRequestsPublished: 0, overallCompliance: 0, atRiskPolicies: [] });
    await dash.goto();
    const t = await dash.tiles();
    expect(Object.values(t)).toEqual(['0', '0', '0', '0', '0', '0']);
    expect(await adminPage.locator('body').innerText()).not.toMatch(/NaN|undefined|null/);
  });

  test('empty state (mocked): "Low" badge for 0% with no obligations', async ({ dash, adminPage }) => {
    await mock(adminPage, { overallCompliance: 0, atRiskPolicies: [] });
    await dash.goto();
    expect((await dash.compliance())!.badge).toBe('Low');
  });

  test('missing fields in the payload (mocked data = {}) do not break the page (no NaN, no crash)', async ({ dash, adminPage }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await adminPage.route(DASHBOARD_API, (route) => route.fulfill({ json: { success: true, message: 'ok', code: 'OK', data: {} } }));
    await dash.goto();
    expect(await adminPage.locator('body').innerText()).not.toMatch(/NaN|undefined/);
    expect(errors).toEqual([]);
  });

  for (const [name, status] of [
    ['500 server error', 500],
    ['403 forbidden', 403],
  ] as const) {
    test(`error state: GET /admin/dashboard answers ${name} (mocked) - the user is told the data could not be loaded`, async ({ dash, adminPage }) => {
      test.fail(true, 'Deviation (mocked): no error message; the dashboard silently shows zeros and a red "Low" badge as if they were real figures (misleading for executives).');
      await adminPage.route(DASHBOARD_API, (route) => route.fulfill({ status, json: { success: false, message: 'failure', code: 'ERR' } }));
      await dash.goto();
      await expect(adminPage.getByText(/error|failed|unable|try again|something went wrong|could not/i).filter({ visible: true }).first()).toBeVisible({ timeout: 5_000 });
    });
  }

  test('error state: a network failure on the dashboard call (mocked) - the user is told the data could not be loaded', async ({ dash, adminPage }) => {
    test.fail(true, 'Deviation (mocked): same as for HTTP errors, silent zeros.');
    await adminPage.route(DASHBOARD_API, (route) => route.abort());
    await dash.goto();
    await expect(adminPage.getByText(/error|failed|unable|try again|something went wrong|could not|offline/i).filter({ visible: true }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('error state: the page does not crash on a failed call (mocked 500): header and menu stay usable', async ({ dash, adminPage }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await adminPage.route(DASHBOARD_API, (route) => route.fulfill({ status: 500, json: { success: false, message: 'boom', code: 'ERR' } }));
    await dash.goto();
    await expect(dash.sidebarItem('Policies')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('error state: no retry control after a failed call (mocked 500), a reload recovers once the API is back', async ({ dash, adminPage }) => {
    let fail = true;
    await adminPage.route(DASHBOARD_API, (route) =>
      fail ? route.fulfill({ status: 500, json: { success: false, message: 'boom', code: 'ERR' } }) : route.fulfill({ json: dashboardResponse({ totalUsers: 42, totalStudents: 40, totalEmployees: 1, totalAdmins: 1 }) }),
    );
    await dash.goto();
    fail = false;
    await dash.reload();
    await expect.poll(async () => (await dash.tiles()).Total).toBe('42');
  });
});

// =====================================================================================
// TS_DB_06: navigation
// =====================================================================================
test.describe('TS_DB_06 navigation @dashboard', () => {
  for (const [label, path] of [
    ['Policies', /\/policies/],
    ['Acknowledgements', /\/acknowledgements/],
    ['Compliance', /\/compliance/],
  ] as const) {
    test(`side menu "${label}" opens its screen from the dashboard`, async ({ dash, adminPage }) => {
      await dash.goto();
      await dash.sidebarItem(label).click();
      await expect(adminPage).toHaveURL(path);
    });
  }

  test('KPI tiles are static: clicking one stays on /dashboard and sends no write', async ({ dash, adminPage }) => {
    const writes: string[] = [];
    await adminPage.route(/\/myindiranew\/api\//, (route) => {
      const q = route.request();
      if (q.method() === 'GET') return route.continue();
      writes.push(`${q.method()} ${q.url()}`);
      return route.fulfill({ json: { success: true, message: 'ok', code: 'OK', data: {} } });
    });
    await dash.goto();
    await dash.cards.first().click();
    await adminPage.waitForTimeout(800);
    await expect(adminPage).toHaveURL(/\/dashboard$/);
    expect(writes).toEqual([]);
  });

  test('the Social Feed / Notifications / Master Data menu items stay reachable from the dashboard', async ({ dash }) => {
    await dash.goto();
    for (const item of ['Social Feed', 'Master Data', 'Notifications']) await expect(dash.sidebarItem(item), item).toBeVisible();
  });
});

// =====================================================================================
// TS_DB_07: cross-module consistency (read-only)
// =====================================================================================
test.describe('TS_DB_07 consistency with Policies / Acknowledgements / Compliance @dashboard', () => {
  test('"Acknowledgement" tile equals the number of requests listed on the Acknowledgements screen', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const acks = await readModule(adminPage, '/acknowledgements', ACKS_API);
    expect(acks.totalElements).toBe(d.ackRequestsPublished);
  });

  test('"Policies" tile equals the number of policies listed on the Policies screen', async ({ dash, adminPage }) => {
    test.fail(true, 'Deviation (QA data): the dashboard counts 10 published policies (and the Compliance report lists the same 10), the Policies screen lists 8 (ids 2 and 10 are missing).');
    const d = await openReal(dash, adminPage);
    const policies = await readModule(adminPage, '/policies', POLICIES_API);
    expect(policies.totalElements).toBe(d.policiesPublished);
  });

  test('"Policies" and "Acknowledgement" tiles equal the POLICY and ACK_REQUEST rows of the Compliance report', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const report = await readModule<ReportRow>(adminPage, '/compliance', COMPLIANCE_API);
    expect(report.content.filter((r) => r.type === 'POLICY')).toHaveLength(d.policiesPublished);
    expect(report.content.filter((r) => r.type === 'ACK_REQUEST')).toHaveLength(d.ackRequestsPublished);
  });

  test('every at-risk card shows the same assigned / acknowledged / status as the Compliance report row of that policy', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const report = await readModule<ReportRow>(adminPage, '/compliance', COMPLIANCE_API);
    const byId = new Map(report.content.filter((r) => r.type === 'POLICY').map((r) => [r.itemId, r]));
    for (const p of d.atRiskPolicies) {
      const row = byId.get(p.policyId);
      expect(row, `policy ${p.policyId} (${p.policyTitle}) exists in the Compliance report`).toBeTruthy();
      expect([row!.totalAssigned, row!.totalAcknowledged, row!.status], p.policyTitle).toEqual([p.totalAssigned, p.totalAcknowledged, p.status]);
      expect(row!.compliancePercentage, p.policyTitle).toBeCloseTo(p.compliancePercentage, 1);
    }
  });

  test('every OVERDUE / AT_RISK policy of the Compliance report appears in the dashboard feed (nothing at risk is hidden)', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const report = await readModule<ReportRow>(adminPage, '/compliance', COMPLIANCE_API);
    const flagged = report.content.filter((r) => r.type === 'POLICY' && ['OVERDUE', 'AT_RISK'].includes(r.status)).map((r) => r.itemId).sort((a, b) => a - b);
    expect(d.atRiskPolicies.map((p) => p.policyId).sort((a, b) => a - b)).toEqual(flagged);
  });

  test('Total Users agrees with the number of users the Compliance report targets (everybody but admins)', async ({ dash, adminPage }) => {
    const d = await openReal(dash, adminPage);
    const report = await readModule<ReportRow>(adminPage, '/compliance', COMPLIANCE_API);
    const biggest = Math.max(...report.content.map((r) => r.totalAssigned));
    expect(biggest).toBe(d.totalStudents + d.totalEmployees);
  });
});
