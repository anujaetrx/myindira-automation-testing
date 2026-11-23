import { test, expect } from '@fixtures';
import { masterDataListSchema } from '@api/clients/MasterDataApiClient';
import { guardWrites } from '@utils/helpers/guard-writes';
import type { PoliciesPage } from '@pages/PoliciesPage';

/**
 * Policies: gap review against story IUN-3239 (BR-POL-01 .. BR-POL-04, scenarios 1 and 2, TC_POL_001 .. 005).
 * The first spec (IUN3239-policies.spec.ts) follows the team's sheet; this one adds what the STORY requires and the sheet
 * did not cover: the exact requests the screen sends (publish payload, archive), the publish confirmation, the
 * strict tracker rule of BR-POL-01, the detail screen fields, filter counts and the PDF download.
 * Nothing here changes data: every write goes through guardWrites and the test asserts what was SENT.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const localIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function fillPolicy(p: PoliciesPage, opts: { title?: string; content?: string; dept?: string; students?: boolean; employees?: boolean } = {}): Promise<void> {
  await p.setTitle(opts.title ?? 'Gap review policy');
  await p.setContent(opts.content ?? 'Policy content used only to check the request that is sent.');
  await p.chooseDepartment(opts.dept ?? 'Administration');
  if (opts.students ?? true) await p.toggleAudience('Students');
  if (opts.employees) await p.toggleAudience('Employees');
}

test.describe('IUN-3239 gap review: requests @policies', () => {
  test('TC_POL_008 Publish sends the title, content, department id and audience (students only)', async ({ policiesPage: p, adminPage, masterDataApi }) => {
    const writes = await guardWrites(adminPage);
    const { data } = await (await masterDataApi.list()).body(masterDataListSchema);
    const dept = data.departments.find((d) => d.name === 'Administration');
    expect(dept, 'Administration exists in Master Data').toBeDefined();

    await p.goto();
    await p.openCreateModal();
    await fillPolicy(p, { title: 'Gap review policy', content: 'Policy content used only to check the request.' });
    await p.publishAndWait();

    const sent = writes.filter((w) => w.method === 'POST' && w.path === '/admin/policies');
    expect(sent, 'exactly one POST /admin/policies').toHaveLength(1);
    const body = JSON.parse(sent[0].body) as { title: string; content: string; issuingDepartmentId: number; effectiveDate: string; deadline: string; targets: { role: string; departmentId: number | null }[] };
    expect(body.title).toBe('Gap review policy');
    expect(body.content).toBe('Policy content used only to check the request.');
    expect(body.issuingDepartmentId, 'department id comes from Master Data').toBe(dept!.id);
    expect(body.targets).toEqual([{ role: 'STUDENT', departmentId: null }]);
  });

  test('TC_POL_008 both audiences are sent as two targets, employees only as one', async ({ policiesPage: p, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await p.goto();
    await p.openCreateModal();
    await fillPolicy(p, { students: true, employees: true });
    await p.publishAndWait();
    const both = JSON.parse(writes.find((w) => w.path === '/admin/policies')!.body) as { targets: { role: string }[] };
    expect(both.targets.map((t) => t.role).sort()).toEqual(['EMPLOYEE', 'STUDENT']);

    writes.length = 0;
    await p.goto();
    await p.openCreateModal();
    await fillPolicy(p, { students: false, employees: true });
    await p.publishAndWait();
    const only = JSON.parse(writes.find((w) => w.path === '/admin/policies')!.body) as { targets: { role: string }[] };
    expect(only.targets.map((t) => t.role)).toEqual(['EMPLOYEE']);
  });

  test('TC_POL_008 the effective date and deadline default to today (the form has no date field)', async ({ policiesPage: p, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await p.goto();
    await p.openCreateModal();
    await fillPolicy(p);
    await p.publishAndWait();
    const body = JSON.parse(writes.find((w) => w.path === '/admin/policies')!.body) as { effectiveDate: string; deadline: string };
    expect(body.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect([localIso(), new Date().toISOString().slice(0, 10)]).toContain(body.effectiveDate);
  });

  test('TC_POL_008 after Publish the modal closes and a success message is shown', async ({ policiesPage: p, adminPage }) => {
    await guardWrites(adminPage);
    await p.goto();
    await p.openCreateModal();
    await fillPolicy(p);
    await p.publishAndWait();
    await expect(p.modal).toBeHidden();
    await expect(adminPage.getByText(/Policy (created|published) successfully/i)).toBeVisible({ timeout: 5_000 });
  });

  test('TC_POL_008 the success message reads "Policy published successfully" (sheet wording)', async ({ policiesPage: p, adminPage }) => {
    test.fail(true, 'The app says "Policy created successfully"');
    await guardWrites(adminPage);
    await p.goto();
    await p.openCreateModal();
    await fillPolicy(p);
    await p.publishAndWait();
    await expect(adminPage.getByText('Policy published successfully', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('TC_POL_005 confirming Archive sends the archive for exactly that policy', async ({ policiesPage: p, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const listResponse = adminPage.waitForResponse((r) => /\/admin\/policies\?/.test(r.url()));
    await p.goto();
    const policies = ((await (await listResponse).json()) as { data: { content: { id: number; title: string }[] } }).data.content;
    await expect(p.cards.first()).toBeVisible();
    const [first] = await p.readCards();
    const expected = policies.find((x) => x.title === first.title)!;

    const message = await p.archive(first.title, true);
    expect(message).toBe(`Archive policy "${first.title}"?`);
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].method).toBe('POST');
    expect(writes[0].path).toBe(`/admin/policies/${expected.id}/archive`);
  });
});

test.describe('IUN-3239 gap review: tracker rule BR-POL-01 @policies', () => {
  test('BR-POL-01 a title of 5 and content of 20 characters each tick their step', async ({ policiesPage: p }) => {
    await p.goto();
    await p.openCreateModal();
    await p.setTitle('t'.repeat(5));
    await expect(p.progress).toHaveText('1/4 completed');
    await p.setContent('c'.repeat(20));
    await expect(p.progress).toHaveText('2/4 completed');
  });

  test('BR-POL-01 a title shorter than 5 characters does not tick its step', async ({ policiesPage: p }) => {
    test.fail(true, 'Any non-empty title (even 2 characters) already counts as a step');
    await p.goto();
    await p.openCreateModal();
    await p.setTitle('abcd');
    await expect(p.progress).toHaveText('0/4 completed');
  });

  test('BR-POL-01 content shorter than 20 characters does not tick its step', async ({ policiesPage: p }) => {
    test.fail(true, 'Any non-empty content (even 5 characters) already counts as a step');
    await p.goto();
    await p.openCreateModal();
    await p.setContent('c'.repeat(15));
    await expect(p.progress).toHaveText('0/4 completed');
  });

  test('TC_POL_002 title 4 + content 15 keeps the tracker at 0/4 (story QA case)', async ({ policiesPage: p }) => {
    test.fail(true, 'The tracker shows 2/4 for 4 and 15 characters');
    await p.goto();
    await p.openCreateModal();
    await p.setTitle('abcd');
    await p.setContent('c'.repeat(15));
    await expect(p.progress).toHaveText('0/4 completed');
  });

  test('BR-POL-02 Publish enables exactly at 4/4 and not before', async ({ policiesPage: p }) => {
    await p.goto();
    await p.openCreateModal();
    await p.setTitle('Valid title');
    await p.setContent('Valid content that is longer than twenty characters.');
    await p.chooseDepartment('Administration');
    await expect(p.progress).toHaveText('3/4 completed');
    await expect(p.publish).toBeDisabled();
    await p.toggleAudience('Employees');
    await expect(p.progress).toHaveText('4/4 completed');
    await expect(p.publish).toBeEnabled();
  });
});

test.describe('IUN-3239 gap review: list, filter and details @policies', () => {
  test('the filtered header count equals the number of cards shown', async ({ policiesPage: p }) => {
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    await p.openFilter();
    await p.chooseFilter('Computer Science');
    await expect(p.header).toHaveText(/^\d+ policies? in Computer Science$/);
    const n = await p.cards.count();
    await expect(p.header).toHaveText(`${n} ${n === 1 ? 'policy' : 'policies'} in Computer Science`);
  });

  test('the header count equals the total the API reports', async ({ policiesPage: p, adminPage }) => {
    const listResponse = adminPage.waitForResponse((r) => /\/admin\/policies\?/.test(r.url()));
    await p.goto();
    const total = ((await (await listResponse).json()) as { data: { totalElements: number } }).data.totalElements;
    await expect(p.header).toHaveText(`${total} ${total === 1 ? 'policy' : 'policies'}`);
  });

  test('the detail screen shows Department, Effective Date, Published By, Published On and the content', async ({ policiesPage: p, adminPage }) => {
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    const [first] = await p.readCards();
    await p.openPolicy(first.title);
    for (const label of ['Policy Information', 'Department', 'Effective Date', 'Published By', 'Published On', 'Policy Content']) {
      await expect(adminPage.getByText(label, { exact: true }).last(), label).toBeVisible();
    }
  });

  test('Download PDF on the detail screen opens a window with the policy', async ({ policiesPage: p, adminPage }) => {
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    const [first] = await p.readCards();
    await p.openPolicy(first.title);
    await expect(p.detailDownload).toBeVisible();
    // The button does not start a file download: it opens a new window (print / save-as-PDF view).
    const [popup] = await Promise.all([adminPage.waitForEvent('popup', { timeout: 15_000 }), p.detailDownload.click()]);
    await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
    await expect.poll(async () => (await popup.locator('body').innerText().catch(() => '')).includes(first.title), { timeout: 10_000 }).toBe(true);
    await popup.close();
  });

  test('the Back arrow of the detail screen returns to the list', async ({ policiesPage: p, adminPage }) => {
    await p.goto();
    await expect(p.cards.first()).toBeVisible();
    const before = await p.cards.count();
    const [first] = await p.readCards();
    await p.openPolicy(first.title);
    await p.detailBack.click();
    await expect(adminPage).toHaveURL(/\/policies$/);
    await expect(p.cards).toHaveCount(before);
  });
});
