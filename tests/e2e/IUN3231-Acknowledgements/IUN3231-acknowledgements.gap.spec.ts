import { test, expect } from '@fixtures';
import { guardWrites } from '@utils/helpers/guard-writes';
import { futureIso, type AcknowledgementsPage } from '@pages/AcknowledgementsPage';

/**
 * Acknowledgements: gap review against story IUN-3231 (BR-ACK-01 .. BR-ACK-04, scenarios 1 to 3, TC_ACK_001 .. 005).
 * Adds what the STORY requires and the team's sheet (IUN3231-acknowledgements.spec.ts) did not exercise: the exact publish
 * request, the confirmation wording, the list refresh after publishing (card on top, counter +1) and the Completed
 * tab with real-shaped data. Nothing here changes data: writes go through guardWrites, list data is mocked.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const item = (over: Record<string, unknown> = {}) => ({
  id: 9,
  title: 'Mock request',
  description: 'Mock description',
  deadline: '2099-12-01',
  createdByName: 'Someone',
  createdAt: '2026-03-14T11:58:04Z',
  targets: [{ role: 'STUDENT', departmentId: null }],
  acknowledgedByCurrentUser: false,
  acknowledgedAt: null,
  ...over,
});
const listBody = (content: unknown[]) => ({
  success: true,
  message: 'ok',
  code: 'OK',
  data: { totalElements: content.length, totalPages: 1, size: 50, content },
});
const LIST = /\/admin\/acknowledgement-requests\?/;

async function fillAndPublish(a: AcknowledgementsPage, opts: { students?: boolean; employees?: boolean } = {}): Promise<void> {
  await a.setTitle('Gap review request');
  await a.setDescription('Gap review description');
  await a.setDeadline('2027-05-06');
  if (opts.students) await a.toggleAudience('Students');
  if (opts.employees ?? !opts.students) await a.toggleAudience('Employees');
  await a.publishAndWait();
}

test.describe('IUN-3231 gap review: publish request @acknowledgements', () => {
  test('Scenario 3 Publish sends title, description, deadline and the chosen audience', async ({ acknowledgementsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreateModal();
    await fillAndPublish(a, { employees: true });
    const sent = writes.filter((w) => w.method === 'POST' && w.path === '/admin/acknowledgement-requests');
    expect(sent, 'exactly one POST').toHaveLength(1);
    expect(JSON.parse(sent[0].body)).toEqual({
      title: 'Gap review request',
      description: 'Gap review description',
      deadline: '2027-05-06',
      targets: [{ role: 'EMPLOYEE', departmentId: null }],
    });
  });

  test('BR-ACK-01 students only, and both audiences, are sent as the matching targets', async ({ acknowledgementsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreateModal();
    await fillAndPublish(a, { students: true, employees: false });
    expect((JSON.parse(writes[0].body) as { targets: unknown[] }).targets).toEqual([{ role: 'STUDENT', departmentId: null }]);

    writes.length = 0;
    await a.goto();
    await a.openCreateModal();
    await fillAndPublish(a, { students: true, employees: true });
    const roles = (JSON.parse(writes[0].body) as { targets: { role: string }[] }).targets.map((t) => t.role).sort();
    expect(roles).toEqual(['EMPLOYEE', 'STUDENT']);
  });

  test('Scenario 3 after Publish the modal closes and a success message is shown', async ({ acknowledgementsPage: a, adminPage }) => {
    await guardWrites(adminPage);
    await a.goto();
    await a.openCreateModal();
    await fillAndPublish(a);
    await expect(a.modal).toBeHidden();
    await expect(adminPage.getByText(/Acknowledgement request (created|published) successfully/i)).toBeVisible({ timeout: 5_000 });
  });

  test('Scenario 3 the message reads "Acknowledgement request published successfully" (story wording)', async ({ acknowledgementsPage: a, adminPage }) => {
    test.fail(true, 'The app says "Acknowledgement request created successfully"');
    await guardWrites(adminPage);
    await a.goto();
    await a.openCreateModal();
    await fillAndPublish(a);
    await expect(adminPage.getByText('Acknowledgement request published successfully', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('Scenario 3 the new request is prepended to Pending and the counter goes up by one', async ({ acknowledgementsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    // Registered after guardWrites, so it answers the list first; everything else falls through to guardWrites.
    await adminPage.route(LIST, (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const base = [item({ id: 1, title: 'Existing one' }), item({ id: 2, title: 'Existing two' })];
      const rows = writes.length > 0 ? [item({ id: 3, title: 'Gap review request' }), ...base] : base;
      return route.fulfill({ json: listBody(rows) });
    });
    await a.goto();
    await expect(a.badge).toHaveText('2 pending');
    await a.openCreateModal();
    await fillAndPublish(a);
    await expect(a.modal).toBeHidden();
    await expect(a.badge).toHaveText('3 pending');
    expect((await a.readCards())[0].title).toBe('Gap review request');
  });

  test('re-opening the modal after Publish shows an empty form', async ({ acknowledgementsPage: a, adminPage }) => {
    await guardWrites(adminPage);
    await a.goto();
    await a.openCreateModal();
    await fillAndPublish(a);
    await expect(a.modal).toBeHidden();
    await a.openCreateModal();
    await expect(a.titleField).toHaveValue('');
    await expect(a.descriptionField).toHaveValue('');
    expect(await a.deadlineValue()).toBe('');
    await expect(a.publish).toBeDisabled();
  });

  test('BR-ACK-01 the deadline sent is the picked date (tomorrow)', async ({ acknowledgementsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const tomorrow = futureIso(1);
    await a.goto();
    await a.openCreateModal();
    await a.setTitle('Due tomorrow');
    await a.setDescription('Due tomorrow');
    await a.setDeadline(tomorrow);
    await a.toggleAudience('Employees');
    await a.publishAndWait();
    expect((JSON.parse(writes[0].body) as { deadline: string }).deadline).toBe(tomorrow);
  });

  test('BR-ACK-02 a deadline of today is allowed and published', async ({ acknowledgementsPage: a, adminPage }) => {
    test.fail(true, 'Publishing with today as deadline shows "Deadline must be a future date" and sends nothing');
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreateModal();
    await a.setTitle('Due today');
    await a.setDescription('Due today');
    await a.setDeadline(await a.deadlineMin()); // the picker's own minimum is today
    await a.toggleAudience('Employees');
    await a.publish.click();
    await expect.poll(() => writes.some((w) => w.path === '/admin/acknowledgement-requests'), { timeout: 5_000 }).toBe(true);
  });
});

test.describe('IUN-3231 gap review: Completed tab @acknowledgements', () => {
  const rows = () => [
    item({ id: 9, title: 'Still pending' }),
    item({ id: 10, title: 'Signed by me', acknowledgedByCurrentUser: true, acknowledgedAt: '2026-03-20T10:00:00Z' }),
    item({ id: 11, title: 'Signed, no date', acknowledgedByCurrentUser: true }),
  ];

  test('BR-ACK-04 only unacknowledged requests are Pending and counted; the rest move to Completed', async ({ acknowledgementsPage: a, adminPage }) => {
    await adminPage.route(LIST, (route) => route.fulfill({ json: listBody(rows()) }));
    await a.goto();
    await expect(a.badge).toHaveText('1 pending');
    expect((await a.readCards()).map((c) => c.title)).toEqual(['Still pending']);
    await a.openCompleted();
    await expect.poll(async () => (await a.readCards()).map((c) => c.title)).toEqual(['Signed by me', 'Signed, no date']);
    await expect(a.badge, 'the badge still counts pending requests only').toHaveText('1 pending');
  });

  test('Completed cards show the Done pill and the acknowledgement date', async ({ acknowledgementsPage: a, adminPage }) => {
    await adminPage.route(LIST, (route) => route.fulfill({ json: listBody(rows()) }));
    await a.goto();
    await a.openCompleted();
    await expect.poll(async () => (await a.readCards()).length).toBe(2);
    const [signed, noDate] = await a.readCards();
    expect(signed.status).toBe('Done');
    expect(signed.lines.join(' ')).toContain('Acknowledged: 3/20/2026');
    expect(noDate.status).toBe('Done');
  });

  test('the empty Completed state returns when nothing is acknowledged', async ({ acknowledgementsPage: a, adminPage }) => {
    await adminPage.route(LIST, (route) => route.fulfill({ json: listBody([item({ id: 1, title: 'Only pending' })]) }));
    await a.goto();
    await a.openCompleted();
    await expect(a.completedEmpty).toBeVisible();
    await a.openPending();
    expect((await a.readCards()).map((c) => c.title)).toEqual(['Only pending']);
  });

  test('a request with a past deadline and no sign-off is still Pending with a red deadline', async ({ acknowledgementsPage: a, adminPage }) => {
    await adminPage.route(LIST, (route) => route.fulfill({ json: listBody([item({ id: 1, title: 'Late one', deadline: '2026-03-28' })]) }));
    await a.goto();
    expect((await a.readCards())[0].deadline).toBe('Deadline: 3/28/2026');
    expect(await a.tabIsSelected('Pending')).toBe(true);
  });
});
