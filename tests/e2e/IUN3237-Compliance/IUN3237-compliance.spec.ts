import path from 'node:path';
import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '@fixtures';
import { env } from '@config/environment';
import { isZip, readXlsxRows } from '@utils/helpers/xlsx.helper';
import {
  complianceResponse,
  EXPORT_API,
  LIST_API,
  type CompliancePage,
  type ComplianceRow,
} from '@pages/CompliancePage';

/**
 * Compliance Report test cases from the team's sheet (TC_CR_001 .. TC_CR_034, scenarios TS_CR_01 .. TS_CR_08).
 * Titles start with the sheet's TC id. Rules: story IUN-3237 (BR-CR-01 .. BR-CR-04).
 * Results and open questions: docs/test-cases/compliance.md
 *
 * Three kinds of check:
 *   - REAL DATA: read what QA returns (the sheet's example numbers 6/406, 0/303 do not match QA, so counts are
 *     compared with the API instead of fixed values).
 *   - MOCKED API: the list call is replaced to force a situation that cannot be created safely (zero audience,
 *     100%, more acknowledged than assigned, errors). These test how the screen RENDERS what it is given.
 *   - KNOWN DEVIATIONS: test.fail() keeps the run green and reports the gap; the test turns red when fixed.
 * Nothing here changes data: Export only reads.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const row = (over: Partial<ComplianceRow> = {}): ComplianceRow => ({
  type: 'POLICY',
  itemId: 1,
  title: 'Mock policy',
  deadline: '2099-01-01',
  targetRoles: ['STUDENT', 'EMPLOYEE'],
  totalAssigned: 406,
  totalAcknowledged: 6,
  compliancePercentage: 1.5,
  status: 'PENDING',
  ...over,
});

async function mockList(page: Page, rows: ComplianceRow[]): Promise<void> {
  await page.route(LIST_API, (route) => route.fulfill({ json: complianceResponse(rows) }));
}

/** Opens the report and returns the rows the API sent for it. */
async function openReal(a: CompliancePage, page: Page): Promise<ComplianceRow[]> {
  const response = page.waitForResponse((r) => LIST_API.test(r.url()));
  await a.goto();
  const body = (await (await response).json()) as { data: { content: ComplianceRow[] } };
  await expect(a.cards.first()).toBeVisible();
  return body.data.content;
}

const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// =====================================================================================
// TS_CR_01: page load
// =====================================================================================
test.describe('TS_CR_01 page load @compliance', () => {
  test('TC_CR_001 page loads with title, Export button and cards', async ({ compliancePage: a }) => {
    await a.goto();
    await expect(a.reportTitle).toBeVisible();
    await expect(a.export).toBeVisible();
    await expect(a.cards.first()).toBeVisible();
  });

  test('TC_CR_002 loading state: a loader shows, then the cards replace it', async ({ compliancePage: a, adminPage }) => {
    await adminPage.route(LIST_API, async (route) => {
      await new Promise((r) => setTimeout(r, 2_500)); // simulated slow network
      await route.continue();
    });
    await adminPage.goto('/compliance'); // not a.goto(): that waits for the heading, which renders with the data
    await expect(a.loader).toBeVisible();
    await expect(a.cards).toHaveCount(0);
    await expect(a.cards.first()).toBeVisible({ timeout: 15_000 });
  });
});

// =====================================================================================
// TS_CR_02: card content and audience tags
// =====================================================================================
test.describe('TS_CR_02 card content @compliance', () => {
  test('TC_CR_003 every card shows the type pill, title, status and a M/D/YYYY deadline', async ({ compliancePage: a }) => {
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    for (const c of await a.readCards()) {
      expect(['Policy', 'Ack Request'], `type pill on "${c.title}"`).toContain(c.kind);
      expect(c.title).not.toBe('');
      expect(c.status, `status on "${c.title}"`).not.toBe('');
      expect(c.deadline, `deadline on "${c.title}"`).toMatch(/^Deadline: (1[0-2]|[1-9])\/(3[01]|[12]\d|[1-9])\/\d{4}$/);
    }
  });

  test('TC_CR_004 an employee-only policy shows only the EMPLOYEE tag', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ title: 'sdvg', targetRoles: ['EMPLOYEE'], totalAssigned: 303, totalAcknowledged: 0, compliancePercentage: 0 })]);
    await a.goto();
    expect((await a.readCards())[0].audiences).toEqual(['EMPLOYEE']);
  });

  test('TC_CR_005 a campus-wide policy shows both tags', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ title: 'MD test', targetRoles: ['EMPLOYEE', 'STUDENT'] })]);
    await a.goto();
    expect((await a.readCards())[0].audiences.sort()).toEqual(['EMPLOYEE', 'STUDENT']);
  });

  test('TC_CR_006 a student-only policy shows only the STUDENT tag', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ title: 'Student policy', targetRoles: ['STUDENT'], totalAssigned: 103, totalAcknowledged: 0, compliancePercentage: 0 })]);
    await a.goto();
    expect((await a.readCards())[0].audiences).toEqual(['STUDENT']);
  });

  test('TC_CR_007 audience tags on the screen match the API for real data', async ({ compliancePage: a, adminPage }) => {
    const rows = await openReal(a, adminPage);
    const cards = await a.readCards();
    expect(cards.length).toBe(rows.length);
    rows.forEach((r, i) => expect(cards[i].audiences.sort(), r.title).toEqual([...r.targetRoles].sort()));
  });

  test('TC_CR_007 an archived policy is not displayed', async ({ compliancePage: a, adminPage, policiesPage }) => {
    test.fail(true, 'Archived policies still appear in the Compliance Report');
    // Active policies as the Policies screen lists them.
    const activeResponse = adminPage.waitForResponse((r) => /\/admin\/policies\?/.test(r.url()));
    await policiesPage.goto();
    const active = ((await (await activeResponse).json()) as { data: { content: { id: number; archived: boolean }[] } }).data.content;
    const activeIds = new Set(active.filter((p) => !p.archived).map((p) => p.id));
    const rows = await openReal(a, adminPage);
    const shownPolicies = rows.filter((r) => r.type === 'POLICY');
    const archivedShown = shownPolicies.filter((r) => !activeIds.has(r.itemId)).map((r) => `${r.itemId} ${r.title}`);
    expect(archivedShown, 'policies in the report that are not active').toEqual([]);
  });
});

// =====================================================================================
// TS_CR_03: denominators
// =====================================================================================
test.describe('TS_CR_03 acknowledgement counters @compliance', () => {
  test('TC_CR_008 the "X / Y acknowledged" text matches the API for every card', async ({ compliancePage: a, adminPage }) => {
    const rows = await openReal(a, adminPage);
    const cards = await a.readCards();
    rows.forEach((r, i) => expect(cards[i].counter, r.title).toBe(`${r.totalAcknowledged} / ${r.totalAssigned} acknowledged`));
  });

  test('TC_CR_009 campus-wide policies share one denominator, employee-only policies a smaller one', async ({ compliancePage: a, adminPage }) => {
    const rows = (await openReal(a, adminPage)).filter((r) => r.type === 'POLICY');
    const both = new Set(rows.filter((r) => r.targetRoles.length === 2).map((r) => r.totalAssigned));
    const employee = new Set(rows.filter((r) => r.targetRoles.length === 1 && r.targetRoles[0] === 'EMPLOYEE').map((r) => r.totalAssigned));
    expect(both.size, 'one campus-wide denominator').toBe(1);
    expect(employee.size, 'one employee-only denominator').toBe(1);
    expect(Math.max(...employee)).toBeLessThan(Math.max(...both));
  });

  test('TC_CR_010 a student-only policy shows the student denominator', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ targetRoles: ['STUDENT'], totalAssigned: 103, totalAcknowledged: 0, compliancePercentage: 0 })]);
    await a.goto();
    expect((await a.readCards())[0].counter).toBe('0 / 103 acknowledged');
  });

  test('TC_CR_011 zero acknowledgements shows "0 / Y" and 0%', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ totalAcknowledged: 0, compliancePercentage: 0 })]);
    await a.goto();
    const [c] = await a.readCards();
    expect(c.counter).toBe('0 / 406 acknowledged');
    expect(c.percent).toBe('0%');
  });

  test('TC_CR_012 a target audience with 0 users shows "0 / 0", 0% and no NaN', async ({ compliancePage: a, adminPage }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await mockList(adminPage, [row({ totalAssigned: 0, totalAcknowledged: 0, compliancePercentage: 0 })]);
    await a.goto();
    const [c] = await a.readCards();
    expect(c.counter).toBe('0 / 0 acknowledged');
    expect(c.percent).toBe('0%');
    await expect(adminPage.getByText(/NaN|Infinity/)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('TC_CR_013 all users acknowledged shows 100%', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ totalAssigned: 103, totalAcknowledged: 103, compliancePercentage: 100, status: 'COMPLIANT' })]);
    await a.goto();
    const [c] = await a.readCards();
    expect(c.counter).toBe('103 / 103 acknowledged');
    expect(c.percent).toBe('100%');
  });
});

// =====================================================================================
// TS_CR_04: percentage and progress bar
// =====================================================================================
test.describe('TS_CR_04 percentage and bar @compliance', () => {
  test('TC_CR_014 percentage is ack/total*100 to one decimal (real data)', async ({ compliancePage: a, adminPage }) => {
    const rows = await openReal(a, adminPage);
    const cards = await a.readCards();
    rows.forEach((r, i) => {
      const exact = r.totalAssigned === 0 ? 0 : (r.totalAcknowledged / r.totalAssigned) * 100;
      const shown = parseFloat(cards[i].percent);
      expect(Math.abs(shown - exact), `${r.title}: ${cards[i].percent} vs exact ${exact.toFixed(3)}`).toBeLessThanOrEqual(0.05 + 1e-9);
    });
  });

  test('TC_CR_015 a ratio of 1.477 is displayed as 1.5%', async ({ compliancePage: a, adminPage }) => {
    test.fail(true, 'The screen prints the API value unchanged ("1.477%"); it only looks right today because the backend pre-rounds');
    await mockList(adminPage, [row({ totalAssigned: 406, totalAcknowledged: 6, compliancePercentage: 1.477 })]);
    await a.goto();
    expect((await a.readCards())[0].percent).toBe('1.5%');
  });

  test('TC_CR_016 exactly 0% is displayed as "0%"', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ totalAcknowledged: 0, compliancePercentage: 0 })]);
    await a.goto();
    expect((await a.readCards())[0].percent).toBe('0%');
  });

  test('TC_CR_017 progress bar width matches the percentage (1.48% for 6/406)', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ totalAssigned: 406, totalAcknowledged: 6, compliancePercentage: 1.477 })]);
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    const width = await a.barPercent(a.cards.first());
    expect(width).toBeGreaterThan(1.4);
    expect(width).toBeLessThan(1.56);
  });

  test('TC_CR_018 percentage never exceeds 100 or goes negative (more acknowledged than assigned)', async ({ compliancePage: a, adminPage }) => {
    test.fail(true, 'The screen shows 180% and draws the bar past 100%');
    await mockList(adminPage, [row({ totalAssigned: 5, totalAcknowledged: 9, compliancePercentage: 180 })]);
    await a.goto();
    const [c] = await a.readCards();
    const value = parseFloat(c.percent);
    expect(value).toBeLessThanOrEqual(100);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(await a.barPercent(a.cards.first())).toBeLessThanOrEqual(100);
  });
});

// =====================================================================================
// TS_CR_05: OVERDUE and sorting
// =====================================================================================
test.describe('TS_CR_05 OVERDUE and order @compliance', () => {
  test('TC_CR_019 past deadline with less than 100% shows the red OVERDUE pill', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ title: 'test policy', deadline: '2026-03-19', status: 'OVERDUE' })]);
    await a.goto();
    const [c] = await a.readCards();
    expect(c.status).toBe('OVERDUE');
    const color = await a.cards.first().getByText('OVERDUE', { exact: true }).evaluate((e) => getComputedStyle(e).backgroundColor + '|' + getComputedStyle(e.parentElement as Element).backgroundColor);
    expect(color, 'OVERDUE pill uses a red background').toMatch(/rgb\((2[0-5]\d|1[89]\d), (\d|[1-8]\d), (\d|[1-8]\d)\)/);
  });

  test('TC_CR_019 backend rule: OVERDUE exactly when the deadline has passed and completion is below 100% (real data)', async ({ compliancePage: a, adminPage }) => {
    const rows = await openReal(a, adminPage);
    const today = todayIso();
    for (const r of rows) {
      const shouldBeOverdue = r.deadline < today && r.totalAcknowledged < r.totalAssigned;
      expect(r.status === 'OVERDUE', `${r.title} (deadline ${r.deadline}, ${r.totalAcknowledged}/${r.totalAssigned}, status ${r.status})`).toBe(shouldBeOverdue);
    }
  });

  test('TC_CR_020 a future deadline is not shown as OVERDUE', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ deadline: '2099-01-01', status: 'PENDING' })]);
    await a.goto();
    expect((await a.readCards())[0].status).not.toBe('OVERDUE');
    await expect(adminPage.getByText('OVERDUE', { exact: true })).toHaveCount(0);
  });

  test('TC_CR_021 a deadline of today is not shown as OVERDUE', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, [row({ deadline: todayIso(), status: 'AT_RISK' })]);
    await a.goto();
    expect((await a.readCards())[0].status).not.toBe('OVERDUE');
  });

  test('TC_CR_022 default sort: OVERDUE with the lowest completion first, then the rest', async ({ compliancePage: a, adminPage }) => {
    test.fail(true, 'Cards come back in ID order, not by risk: a 0.2% card is listed before 0% cards');
    const rows = await openReal(a, adminPage);
    const cards = await a.readCards();
    const severity = (s: string) => (s === 'OVERDUE' ? 0 : s === 'AT_RISK' ? 1 : 2);
    const shown = cards.map((c, i) => ({ status: c.status, pct: rows[i].compliancePercentage }));
    const expected = [...shown].sort((x, y) => severity(x.status) - severity(y.status) || x.pct - y.pct);
    expect(shown).toEqual(expected);
  });
});

// =====================================================================================
// TS_CR_06: export
// =====================================================================================
test.describe('TS_CR_06 export @compliance', () => {
  const REQUIRED = ['Policy Title', 'Issuing Department', 'Deadline', 'Target Audience', 'Total Assigned', 'Total Acknowledged', 'Non-Compliant', 'Compliance Rate', 'Status'];

  async function exported(a: CompliancePage, testInfo: { outputPath: (n: string) => string }) {
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    const download = await a.exportFile();
    expect(download, 'a file is downloaded').not.toBeNull();
    const file = testInfo.outputPath(download!.suggestedFilename());
    await download!.saveAs(file);
    return { name: download!.suggestedFilename(), file, bytes: fs.readFileSync(file) };
  }

  test('TC_CR_023 Export downloads a file', async ({ compliancePage: a }, testInfo) => {
    const { name, bytes } = await exported(a, testInfo);
    expect(name).toMatch(/^compliance-report\.(xlsx|csv)$/);
    expect(bytes.length).toBeGreaterThan(0);
  });

  test('TC_CR_023 the file name extension matches the real format', async ({ compliancePage: a }, testInfo) => {
    test.fail(true, 'File is named .csv but is an Excel (.xlsx) workbook');
    const { name, bytes } = await exported(a, testInfo);
    const ext = path.extname(name).toLowerCase();
    expect(ext === '.xlsx' ? isZip(bytes) : !isZip(bytes), `${name} content type`).toBe(true);
  });

  test('TC_CR_024 the file has columns for title, deadline, audience, counts, rate and status', async ({ compliancePage: a }, testInfo) => {
    const { bytes } = await exported(a, testInfo);
    const header = readXlsxRows(bytes)[0].map((h) => h.toLowerCase());
    for (const col of ['title', 'deadline', 'target', 'assigned', 'acknowledged', 'compliance', 'status']) {
      expect(header.some((h) => h.includes(col)), `column "${col}" in [${header.join(', ')}]`).toBe(true);
    }
  });

  test('TC_CR_024 the file has every column listed in BR-CR-04', async ({ compliancePage: a }, testInfo) => {
    test.fail(true, 'Issuing Department and Non-Compliant Count columns are missing');
    const { bytes } = await exported(a, testInfo);
    const header = readXlsxRows(bytes)[0].join('|').toLowerCase();
    for (const col of REQUIRED) expect(header, `column "${col}"`).toContain(col.toLowerCase());
  });

  test('TC_CR_025 exported data matches the screen', async ({ compliancePage: a }, testInfo) => {
    const { bytes } = await exported(a, testInfo);
    const [header, ...data] = readXlsxRows(bytes);
    const col = (needle: string) => header.findIndex((h) => h.toLowerCase().includes(needle));
    const cards = await a.readCards();
    expect(data.length, 'one file row per card').toBe(cards.length);
    cards.forEach((c, i) => {
      expect(data[i][col('title')], 'title').toBe(c.title);
      const [ack, total] = c.counter.match(/\d+/g)!.map(Number);
      expect(Number(data[i][col('assigned')]), `${c.title} assigned`).toBe(total);
      expect(Number(data[i][col('acknowledged')]), `${c.title} acknowledged`).toBe(ack);
      expect(Number(data[i][col('compliance')]), `${c.title} rate`).toBeCloseTo(parseFloat(c.percent), 1);
      expect(data[i][col('status')].replace(/_/g, ' '), `${c.title} status`).toBe(c.status.replace(/_/g, ' '));
    });
  });

  test('TC_CR_026 Export shows "Exporting..." and ignores a second click while running', async ({ compliancePage: a, adminPage }) => {
    test.fail(true, 'The button keeps the label "Export" and a second click starts a second export');
    let requests = 0;
    await adminPage.route(EXPORT_API, async (route) => {
      requests++;
      await new Promise((r) => setTimeout(r, 2_500));
      await route.continue();
    });
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    await a.export.click();
    await a.export.click({ force: true }).catch(() => undefined);
    await expect(adminPage.getByText('Exporting...', { exact: true })).toBeVisible({ timeout: 1_000 });
    await adminPage.waitForTimeout(3_000);
    expect(requests, 'export requests').toBe(1);
  });

  test('TC_CR_028 a failed export tells the user', async ({ compliancePage: a, adminPage }) => {
    test.fail(true, 'A failing export call shows no message at all');
    await adminPage.route(EXPORT_API, (route) => route.fulfill({ status: 500, json: { success: false, message: 'fail' } }));
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    await a.export.click();
    await expect(adminPage.getByText(/fail|error|unable|try again|could not/i)).toBeVisible({ timeout: 5_000 });
  });
});

// =====================================================================================
// TS_CR_08: access and errors
// =====================================================================================
test.describe('TS_CR_08 access and errors @compliance', () => {
  test('TC_CR_033 a visitor without a session cannot open /compliance', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL ?? env.baseUrl });
    const page = await context.newPage();
    await page.goto('/compliance');
    await expect(page.getByText('Sign in with Microsoft').first()).toBeVisible();
    await expect(page.getByText('Compliance Report', { exact: true })).toHaveCount(0);
    await context.close();
  });

  test('TC_CR_034 an API error is reported as an error, not as an empty report', async ({ compliancePage: a, adminPage }) => {
    test.fail(true, 'A 500 from the API shows "No items to report on", the same as an empty report');
    await adminPage.route(LIST_API, (route) => route.fulfill({ status: 500, json: { success: false, message: 'boom', code: 'ERR' } }));
    await a.goto();
    await expect(a.cards).toHaveCount(0);
    await expect(a.emptyMessage).toBeHidden();
  });

  test('TC_CR_034 an API error does not crash the page', async ({ compliancePage: a, adminPage }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await adminPage.route(LIST_API, (route) => route.fulfill({ status: 500, json: { success: false, message: 'boom', code: 'ERR' } }));
    await a.goto();
    await expect(a.reportTitle).toBeVisible();
    await expect(a.export).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('TC_CR_027 with no policies the report shows an empty message', async ({ compliancePage: a, adminPage }) => {
    await mockList(adminPage, []);
    await a.goto();
    await expect(a.emptyMessage).toBeVisible();
    await expect(a.cards).toHaveCount(0);
  });
});
