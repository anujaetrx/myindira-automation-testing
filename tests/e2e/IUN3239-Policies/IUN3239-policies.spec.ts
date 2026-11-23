import fs from 'node:fs';
import { test, expect } from '@fixtures';
import { masterDataListSchema } from '@api/clients/MasterDataApiClient';
import type { PoliciesPage } from '@pages/PoliciesPage';

/**
 * Policies test cases from the team's sheet (TS_POL_01 .. TS_POL_09). Test titles start with the sheet's
 * scenario id. Results and open questions: docs/test-cases/policies.md
 *
 * Groups:
 *   1. Run by default: read-only, or fill the form without saving.
 *   2. Known deviations: the app behaves differently from the sheet. test.fail() keeps the run green while it
 *      reports the difference; the test turns red when the app is fixed (then remove test.fail).
 *   3. Gated (@writes): publish or archive real data. Run only with ALLOW_POLICY_WRITES=true; they create a
 *      clearly named test policy and archive it again (the screen has no hard delete or un-archive).
 */
const WRITES_ALLOWED = process.env.ALLOW_POLICY_WRITES === 'true';
const MB = 1024 * 1024;

test.use({ viewport: { width: 1440, height: 900 } });

const TITLE = 'Valid policy title';
const CONTENT = 'Valid policy content that is long enough.';

async function openModal(p: PoliciesPage): Promise<void> {
  await p.goto();
  await expect(p.header).toBeVisible();
  await p.openCreateModal();
}

async function fillAllFour(p: PoliciesPage, dept = 'Administration'): Promise<void> {
  await p.setTitle(TITLE);
  await p.setContent(CONTENT);
  await p.chooseDepartment(dept);
  await p.toggleAudience('Students');
}

function makeFile(dir: string, name: string, bytes: number): string {
  const file = `${dir}/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(bytes));
  return file;
}

// =====================================================================================
// TS_POL_01 / 02: list, count, detail, filter
// =====================================================================================
test.describe('TS_POL_01 list @policies', () => {
  test('TS_POL_01 policies list renders cards with title, department, author, date and Archive', async ({ policiesPage: p }) => {
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    const cards = await p.readCards();
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      expect(c.title, 'title').not.toBe('');
      expect(c.department, `department badge on "${c.title}"`).not.toBe('');
      expect(c.text, `"${c.title}" shows a date`).toMatch(/\b\d{1,2} [A-Z][a-z]{2} \d{4}\b/);
      expect(c.text, `"${c.title}" has Archive`).toContain('Archive');
    }
  });

  test('TS_POL_01 policy count header matches the number of cards', async ({ policiesPage: p }) => {
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    const n = await p.cards.count();
    await expect(p.header).toHaveText(`${n} ${n === 1 ? 'policy' : 'policies'}`);
  });

  test('TS_POL_01 drill-down opens the policy details with full content', async ({ policiesPage: p, adminPage }) => {
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    const [first] = await p.readCards();
    await p.openPolicy(first.title);
    await expect(p.detailBack).toBeVisible();
    await expect(adminPage.getByText('Policy Information', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Policy Content', { exact: true })).toBeVisible();
    // The list screen stays mounted (hidden) under the detail screen, so the visible title is the last match.
    await expect(adminPage.getByText(first.title, { exact: true }).last()).toBeVisible();
    await expect(p.detailDownload).toBeVisible();
  });

  test('TS_POL_01 no policies: empty state, "0 policies", no errors', async ({ policiesPage: p, adminPage }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await adminPage.route(/\/admin\/policies\?/, (route) =>
      route.fulfill({
        json: { success: true, message: 'All policies fetched', code: 'OK', data: { totalElements: 0, totalPages: 0, size: 50, content: [] } },
      }),
    );
    await p.goto();
    await expect(p.header).toHaveText('0 policies');
    await expect(p.cards).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('TS_POL_02 department filter @policies', () => {
  test('TS_POL_02 filter opens with search box and department list', async ({ policiesPage: p }) => {
    await p.goto();
    await p.openFilter();
    await expect(p.filterSearchBox).toBeVisible();
    const names = await p.filterOptionNames();
    expect(names).toContain('All');
    expect(names.length).toBeGreaterThan(1);
  });

  test('TS_POL_02 search narrows the list in real time', async ({ policiesPage: p }) => {
    await p.goto();
    await p.openFilter();
    const all = await p.filterOptionNames();
    await p.searchFilter('Computer');
    await expect.poll(async () => (await p.filterOptionNames()).length).toBeLessThan(all.length);
    const names = await p.filterOptionNames();
    expect(names).toContain('Computer Science');
    for (const n of names) expect(n.toLowerCase(), 'every result matches the search').toContain('computer');
  });

  test('TS_POL_02 search with no match shows a message and does not crash', async ({ policiesPage: p, adminPage }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await p.goto();
    await p.openFilter();
    await p.searchFilter('zzzz');
    await expect(p.noFilterMatch).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('TS_POL_02 selecting a department closes the flyout and lists only its policies', async ({ policiesPage: p }) => {
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    await p.openFilter();
    await p.chooseFilter('Computer Science');
    await expect(p.filterHeading).toBeHidden();
    await expect(p.filter).toHaveAccessibleName('Department filter, currently Computer Science');
    await expect(p.header).toHaveText(/^\d+ policies? in Computer Science$/);
    await expect.poll(async () => (await p.readCards()).every((c) => c.department === 'Computer Science')).toBe(true);
    expect(await p.cards.count()).toBeGreaterThan(0);
  });

  test('TS_POL_02 reset the filter to All shows every policy again', async ({ policiesPage: p }) => {
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    const total = await p.cards.count();
    await p.openFilter();
    await p.chooseFilter('Computer Science');
    await expect(p.header).toHaveText(/in Computer Science$/);
    await p.openFilter();
    await p.chooseFilter('All');
    await expect(p.filter).toHaveAccessibleName('Department filter, currently All');
    await expect(p.cards).toHaveCount(total);
  });

  test('TS_POL_02 filter list is sourced from Master Data', async ({ policiesPage: p, masterDataApi }) => {
    const { data } = await (await masterDataApi.list()).body(masterDataListSchema);
    const master = new Set(data.departments.map((d) => d.name));
    await p.goto();
    await p.openFilter();
    const names = (await p.filterOptionNames()).filter((n) => n !== 'All');
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(master.has(n), `"${n}" exists in Master Data`).toBe(true);
  });
});

// =====================================================================================
// TS_POL_03 .. 07: create modal (nothing is saved)
// =====================================================================================
test.describe('TS_POL_03 create modal tracker @policies', () => {
  test('TS_POL_03 modal opens at 0/4 with Publish disabled', async ({ policiesPage: p }) => {
    await openModal(p);
    await expect(p.progress).toHaveText('0/4 completed');
    await expect(p.publish).toBeDisabled();
  });

  test('TS_POL_03 tracker goes 1/4 -> 2/4 -> 3/4 -> 4/4 and Publish enables at 4/4', async ({ policiesPage: p }) => {
    await openModal(p);
    await p.setTitle(TITLE);
    await expect(p.progress).toHaveText('1/4 completed');
    await p.setContent(CONTENT);
    await expect(p.progress).toHaveText('2/4 completed');
    await p.chooseDepartment('Administration');
    await expect(p.progress).toHaveText('3/4 completed');
    await expect(p.publish).toBeDisabled();
    await p.toggleAudience('Students');
    await expect(p.progress).toHaveText('4/4 completed');
    await expect(p.publish).toBeEnabled();
  });

  test('TS_POL_03 clearing a field decrements the tracker and disables Publish', async ({ policiesPage: p }) => {
    await openModal(p);
    await fillAllFour(p);
    await expect(p.progress).toHaveText('4/4 completed');
    await p.setTitle('');
    await expect(p.progress).toHaveText('3/4 completed');
    await expect(p.publish).toBeDisabled();
  });

  test('TS_POL_03 Publish stays disabled at 3/4 when the audience is missing', async ({ policiesPage: p }) => {
    await openModal(p);
    await p.setTitle(TITLE);
    await p.setContent(CONTENT);
    await p.chooseDepartment('Administration');
    await expect(p.progress).toHaveText('3/4 completed');
    await expect(p.publish).toBeDisabled();
  });

  test('TS_POL_03 whitespace-only title/content does not count as a step', async ({ policiesPage: p }) => {
    await openModal(p);
    await p.setTitle('     ');
    await p.setContent('     ');
    await expect(p.progress).toHaveText('0/4 completed');
  });
});

test.describe('TS_POL_04 department selection @policies', () => {
  test('TS_POL_04 selecting a department marks it selected (+1)', async ({ policiesPage: p }) => {
    await openModal(p);
    await p.chooseDepartment('Administration');
    await expect.poll(() => p.isDepartmentSelected('Administration')).toBe(true);
    await expect(p.progress).toHaveText('1/4 completed');
  });

  test('TS_POL_04 switching department deselects the previous one (single select)', async ({ policiesPage: p }) => {
    await openModal(p);
    await p.chooseDepartment('Administration');
    await expect.poll(() => p.isDepartmentSelected('Administration')).toBe(true);
    await p.chooseDepartment('Human Resources');
    await expect.poll(() => p.isDepartmentSelected('Human Resources')).toBe(true);
    await expect.poll(() => p.isDepartmentSelected('Administration')).toBe(false);
  });

  test('TS_POL_04 department pills come from Master Data', async ({ policiesPage: p, masterDataApi }) => {
    const { data } = await (await masterDataApi.list()).body(masterDataListSchema);
    await openModal(p);
    const names = await p.modalDepartmentNames();
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names)).toEqual(new Set(data.departments.map((d) => d.name)));
  });

  test('TS_POL_04 no department selected keeps Publish disabled', async ({ policiesPage: p }) => {
    await openModal(p);
    await p.setTitle(TITLE);
    await p.setContent(CONTENT);
    await p.toggleAudience('Students');
    await expect(p.progress).toHaveText('3/4 completed');
    await expect(p.publish).toBeDisabled();
  });
});

test.describe('TS_POL_05 target audience @policies', () => {
  test('TS_POL_05 Students, Employees and both toggle independently', async ({ policiesPage: p }) => {
    await openModal(p);
    await p.setTitle(TITLE);
    await p.setContent(CONTENT);
    await p.chooseDepartment('Administration');
    await p.toggleAudience('Students');
    await expect(p.progress).toHaveText('4/4 completed');
    await p.toggleAudience('Employees'); // both on
    await expect(p.progress).toHaveText('4/4 completed');
    await p.toggleAudience('Students'); // employees only
    await expect(p.progress).toHaveText('4/4 completed');
  });

  test('TS_POL_05 unchecking every audience loses the 4th step and disables Publish', async ({ policiesPage: p }) => {
    await openModal(p);
    await fillAllFour(p);
    await expect(p.publish).toBeEnabled();
    await p.toggleAudience('Students');
    await expect(p.progress).toHaveText('3/4 completed');
    await expect(p.publish).toBeDisabled();
  });
});

test.describe('TS_POL_06 attachment @policies', () => {
  test('TS_POL_06 valid PDF under 10MB shows file name and size', async ({ policiesPage: p, adminPage }, testInfo) => {
    await openModal(p);
    await p.attach(makeFile(testInfo.outputPath('files'), 'policy-8mb.pdf', 8 * MB));
    await expect(p.attached('policy-8mb.pdf')).toBeVisible();
    await expect(adminPage.getByText('8.0 MB', { exact: true })).toBeVisible();
  });

  for (const ext of ['doc', 'docx', 'jpg', 'png']) {
    test(`TS_POL_06 .${ext} is accepted`, async ({ policiesPage: p }, testInfo) => {
      await openModal(p);
      const name = `sample.${ext}`;
      await p.attach(makeFile(testInfo.outputPath('files'), name, 20 * 1024));
      await expect(p.attached(name)).toBeVisible();
    });
  }

  test('TS_POL_06 remove attachment', async ({ policiesPage: p }, testInfo) => {
    await openModal(p);
    await p.attach(makeFile(testInfo.outputPath('files'), 'to-remove.pdf', 20 * 1024));
    await expect(p.attached('to-remove.pdf')).toBeVisible();
    await p.removeAttachment('to-remove.pdf');
    await expect(p.attached('to-remove.pdf')).toBeHidden();
    await expect(p.attachPrompt).toBeVisible();
  });

  test('TS_POL_06 file over 10MB is rejected and not attached', async ({ policiesPage: p }, testInfo) => {
    await openModal(p);
    await p.attach(makeFile(testInfo.outputPath('files'), 'too-big.pdf', 15 * MB));
    // Sheet text: "File exceeds 10MB limit or invalid format". Actual text: "Document must be 10 MB or smaller".
    await expect(p.toast('Document must be 10 MB or smaller')).toBeVisible();
    await expect(p.attached('too-big.pdf')).toBeHidden();
  });

  test('TS_POL_06 unsupported .exe is rejected and not attached', async ({ policiesPage: p }, testInfo) => {
    await openModal(p);
    await p.attach(makeFile(testInfo.outputPath('files'), 'setup.exe', 1024));
    await expect(p.toast('Only PDF, DOC, DOCX, JPG and PNG files are allowed')).toBeVisible();
    await expect(p.attached('setup.exe')).toBeHidden();
  });

  test('TS_POL_06 exactly 10MB is accepted (boundary)', async ({ policiesPage: p }, testInfo) => {
    await openModal(p);
    await p.attach(makeFile(testInfo.outputPath('files'), 'exactly-10mb.pdf', 10 * MB));
    await expect(p.attached('exactly-10mb.pdf')).toBeVisible();
  });
});

// TS_POL_07: field length rules. The screen applies NO length limits (see docs): the rejection cases below are
// known deviations, kept as test.fail() so the run is green but the gap is reported (flips red when fixed).
test.describe('TS_POL_07 length boundaries @policies', () => {
  const lenCase = (title: string, tl: number, cl: number, shouldPublish: boolean, knownDeviation = false) =>
    test(title, async ({ policiesPage: p }) => {
      test.fail(knownDeviation, 'UI enforces no length limits');
      await openModal(p);
      await p.setTitle('t'.repeat(tl));
      await p.setContent('c'.repeat(cl));
      await p.chooseDepartment('Administration');
      await p.toggleAudience('Students');
      if (shouldPublish) await expect(p.publish).toBeEnabled();
      else await expect(p.publish).toBeDisabled();
    });

  lenCase('TS_POL_07 title of 5 and content of 20 are accepted', 5, 20, true);
  lenCase('TS_POL_07 title of 150 and content of 10000 are accepted', 150, 10_000, true);
  lenCase('TS_POL_07 title shorter than 5 is rejected (4 chars)', 4, 20, false, true);
  lenCase('TS_POL_07 title longer than 150 is rejected (151 chars)', 151, 20, false, true);
  lenCase('TS_POL_07 content shorter than 20 is rejected (19 chars)', 5, 19, false, true);
  lenCase('TS_POL_07 content over 10000 is rejected (10001 chars)', 5, 10_001, false, true);
});

// =====================================================================================
// TS_POL_08 / 09 (safe part): close without saving, archive confirmation
// =====================================================================================
test.describe('TS_POL_08/09 no data changed @policies', () => {
  test('TS_POL_08 closing the modal without saving creates no policy', async ({ policiesPage: p, adminPage }) => {
    const writes: string[] = [];
    adminPage.on('request', (r) => {
      if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(`${r.method()} ${r.url()}`);
    });
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    const before = await p.cards.count();
    await p.openCreateModal();
    await fillAllFour(p);
    await p.closeCreateModal();
    await expect(p.cards).toHaveCount(before);
    expect(writes).toEqual([]);
  });

  test('TS_POL_09 Archive asks for confirmation; cancelling keeps the policy active', async ({ policiesPage: p, adminPage }) => {
    const writes: string[] = [];
    adminPage.on('request', (r) => {
      if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(`${r.method()} ${r.url()}`);
    });
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    const before = await p.cards.count();
    const [first] = await p.readCards();
    const message = await p.archive(first.title, false);
    // Sheet text: "Are you sure you want to archive this policy?". Actual: native confirm 'Archive policy "<title>"?'.
    expect(message).toBe(`Archive policy "${first.title}"?`);
    await expect(p.cards).toHaveCount(before);
    await expect(p.header).toHaveText(`${before} policies`);
    expect(writes).toEqual([]);
  });
});

// =====================================================================================
// 3. GATED: publish and archive real data (ALLOW_POLICY_WRITES=true)
// =====================================================================================
test.describe('TS_POL_08/09 publish and archive lifecycle @policies @writes', () => {
  test.skip(!WRITES_ALLOWED, 'Publishes and archives a real policy. Set ALLOW_POLICY_WRITES=true to run.');

  test('TS_POL_08 publish valid policy, then TS_POL_09 archive it (count +1, then -1)', async ({ policiesPage: p }) => {
    const title = `AUTOTEST policy ${Date.now()}`;
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    const before = await p.cards.count();

    await p.openCreateModal();
    await p.setTitle(title);
    await p.setContent('Automated test policy. Safe to ignore; archived by the same test.');
    await p.chooseDepartment('Administration');
    await p.toggleAudience('Employees');
    expect(await p.publishAndWait()).toBeLessThan(300);
    await expect(p.modal).toBeHidden();
    await expect(p.card(title)).toHaveCount(1);
    await expect(p.cards).toHaveCount(before + 1);

    const message = await p.archive(title, true);
    expect(message).toBe(`Archive policy "${title}"?`);
    await expect(p.card(title)).toHaveCount(0);
    await expect(p.cards).toHaveCount(before);
    await p.reload();
    await expect(p.card(title)).toHaveCount(0); // stays hidden after reload
  });
});
