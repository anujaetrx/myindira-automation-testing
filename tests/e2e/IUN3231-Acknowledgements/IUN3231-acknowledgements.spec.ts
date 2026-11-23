import { test, expect } from '@fixtures';
import { futureIso } from '@pages/AcknowledgementsPage';

/**
 * Acknowledgements test cases from the team's sheet (TS_ACK_01 .. TS_ACK_08). Titles start with the sheet's
 * scenario id. Results and open questions: docs/test-cases/acknowledgements.md
 *
 * Groups:
 *   1. Run by default: read-only, or fill the form without saving.
 *   2. Known deviations: the app differs from the sheet. test.fail() keeps the run green while reporting the
 *      gap; the test turns red when the app is fixed (then remove the test.fail marker).
 *   3. Gated (@writes): publish a real request. There is NO archive/delete for acknowledgements and publishing
 *      creates obligations for real users, so it runs only with ALLOW_ACK_WRITES=true.
 */
const WRITES_ALLOWED = process.env.ALLOW_ACK_WRITES === 'true';

test.use({ viewport: { width: 1440, height: 900 } });

const emptyList = {
  success: true,
  message: 'All acknowledgement requests fetched',
  code: 'OK',
  data: { totalElements: 0, totalPages: 0, size: 50, content: [] },
};

const isoDaysFromToday = (days: number): string => futureIso(days);

// =====================================================================================
// TS_ACK_01: tabs, badge, cards
// =====================================================================================
test.describe('TS_ACK_01 list and tabs @acknowledgements', () => {
  test('TS_ACK_01 Pending tab is selected by default, badge matches the cards', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    expect(await a.tabIsSelected('Pending')).toBe(true);
    expect(await a.tabIsSelected('Completed')).toBe(false);
    const n = await a.cards.count();
    await expect(a.badge).toHaveText(`${n} pending`);
  });

  test('TS_ACK_01 each card shows title, Pending pill, author and a red deadline', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    const cards = await a.readCards();
    for (const c of cards) {
      expect(c.title, 'title').not.toBe('');
      expect(c.status, `status pill on "${c.title}"`).toBe('Pending');
      expect(c.author, `author on "${c.title}"`).not.toBe('');
      expect(c.deadline, `deadline on "${c.title}"`).toMatch(/^Deadline: \d{1,2}\/\d{1,2}\/\d{4}$/);
    }
    const color = await a.deadlineColor(a.cards.first());
    const [r, g, b] = color.match(/\d+/g)!.map(Number);
    expect(r, `deadline colour ${color} is red`).toBeGreaterThan(180);
    expect(g).toBeLessThan(90);
    expect(b).toBeLessThan(90);
  });

  test('TS_ACK_01 Completed tab with no records shows the empty message', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCompleted();
    await expect(a.completedEmpty).toBeVisible();
    expect(await a.tabIsSelected('Completed')).toBe(true);
    await expect(a.cards).toHaveCount(0);
  });

  test('TS_ACK_01 Pending tab with zero items shows the empty state and no errors', async ({ acknowledgementsPage: a, adminPage }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await adminPage.route(/\/admin\/acknowledgement-requests\?/, (route) => route.fulfill({ json: emptyList }));
    await a.goto();
    await expect(a.pendingEmpty).toBeVisible();
    await expect(a.cards).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('TS_ACK_01 Pending tab with zero items shows a "0 pending" badge', async ({ acknowledgementsPage: a, adminPage }) => {
    test.fail(true, 'With zero pending items the badge is hidden instead of showing "0 pending"');
    await adminPage.route(/\/admin\/acknowledgement-requests\?/, (route) => route.fulfill({ json: emptyList }));
    await a.goto();
    await expect(a.badge).toHaveText('0 pending');
  });

  test('TS_ACK_01 deadline is shown as M/D/YYYY', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    const [first] = await a.readCards();
    expect(first.deadline).toMatch(/^Deadline: (1[0-2]|[1-9])\/(3[01]|[12]\d|[1-9])\/\d{4}$/); // no zero padding, month first
  });
});

// =====================================================================================
// TS_ACK_02 / 03: modal and Publish enablement
// =====================================================================================
test.describe('TS_ACK_02/03 create modal and Publish @acknowledgements', () => {
  test('TS_ACK_02 "+" opens the modal with Title, Description, Deadline, Assign To and Publish disabled', async ({ acknowledgementsPage: a, adminPage }) => {
    await a.goto();
    await a.openCreateModal();
    await expect(a.titleField).toBeVisible();
    await expect(a.descriptionField).toBeVisible();
    await expect(adminPage.getByText('Select deadline date', { exact: true })).toBeVisible();
    await expect(a.audience('Students')).toBeVisible();
    await expect(a.audience('Employees')).toBeVisible();
    await expect(a.publish).toBeDisabled();
  });

  test('TS_ACK_03 Publish is disabled with empty fields', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    await expect(a.publish).toBeDisabled();
  });

  test('TS_ACK_03 missing Title keeps Publish disabled', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    await a.setDescription('Desc');
    await a.setDeadline(futureIso());
    await a.toggleAudience('Students');
    await expect(a.publish).toBeDisabled();
  });

  test('TS_ACK_03 missing Description keeps Publish disabled', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    await a.setTitle('Title');
    await a.setDeadline(futureIso());
    await a.toggleAudience('Students');
    await expect(a.publish).toBeDisabled();
  });

  test('TS_ACK_03 whitespace-only title/description keeps Publish disabled', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    await a.setTitle('     ');
    await a.setDescription('     ');
    await a.setDeadline(futureIso());
    await a.toggleAudience('Students');
    await expect(a.publish).toBeDisabled();
  });

  test('TS_ACK_03 all fields valid enables Publish', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    await a.fillValid();
    await expect(a.publish).toBeEnabled();
  });

  // Known deviation: Deadline and Assign To are marked required (*) but Publish does not depend on them.
  test.describe('known deviations: Deadline and Assign To are not enforced', () => {
    test('TS_ACK_03 missing Deadline keeps Publish disabled', async ({ acknowledgementsPage: a }) => {
      test.fail(true, 'Publish is enabled with Title + Description only');
      await a.goto();
      await a.openCreateModal();
      await a.setTitle('Z');
      await a.setDescription('Z');
      await a.toggleAudience('Employees');
      await expect(a.publish).toBeDisabled();
    });

    test('TS_ACK_03 missing Assign To keeps Publish disabled', async ({ acknowledgementsPage: a }) => {
      test.fail(true, 'Publish is enabled with Title + Description only');
      await a.goto();
      await a.openCreateModal();
      await a.setTitle('Title');
      await a.setDescription('Desc');
      await a.setDeadline(futureIso());
      await expect(a.publish).toBeDisabled();
    });
  });
});

// =====================================================================================
// TS_ACK_04: deadline
// =====================================================================================
test.describe('TS_ACK_04 deadline @acknowledgements', () => {
  test('TS_ACK_04 a future date populates the field', async ({ acknowledgementsPage: a, adminPage }) => {
    await a.goto();
    await a.openCreateModal();
    const d = isoDaysFromToday(30);
    await a.setDeadline(d);
    expect(await a.deadlineValue()).toBe(d);
    await expect(adminPage.getByText(d, { exact: true })).toBeVisible();
  });

  test('TS_ACK_04 today is accepted', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    const today = new Date().toISOString().slice(0, 10);
    await a.setDeadline(today);
    expect(await a.deadlineValue()).toBe(today);
  });

  test('TS_ACK_04 the date picker blocks past dates (min = today)', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    const today = new Date().toISOString().slice(0, 10);
    expect(await a.deadlineMin()).toBe(today);
  });

  test('TS_ACK_04 invalid date text is not kept', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    // A native date input cannot hold text: assigning an invalid value leaves it empty.
    const kept = await a.deadlineField.evaluate((e) => {
      (e as HTMLInputElement).value = '99/99/9999';
      return (e as HTMLInputElement).value;
    });
    expect(kept).toBe('');
  });

  test('TS_ACK_04 29 Feb of a leap year is accepted and kept as ISO 8601', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    await a.setDeadline('2028-02-29');
    expect(await a.deadlineValue()).toBe('2028-02-29');
  });

  test('TS_ACK_04 a manually typed past date is rejected', async ({ acknowledgementsPage: a }) => {
    test.fail(true, 'Only the picker restricts past dates; a typed past date is accepted and Publish enables');
    await a.goto();
    await a.openCreateModal();
    await a.setTitle('Title');
    await a.setDescription('Desc');
    await a.toggleAudience('Students');
    await a.setDeadline('2020-01-01');
    await expect(a.publish).toBeDisabled();
  });
});

// =====================================================================================
// TS_ACK_05: assign to
// =====================================================================================
test.describe('TS_ACK_05 assign to @acknowledgements', () => {
  test('TS_ACK_05 Students only, Employees only and both toggle independently', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    expect(await a.isAudienceChecked('Students')).toBe(false);
    expect(await a.isAudienceChecked('Employees')).toBe(false);

    await a.toggleAudience('Students');
    expect(await a.isAudienceChecked('Students')).toBe(true);
    expect(await a.isAudienceChecked('Employees')).toBe(false);

    await a.toggleAudience('Employees');
    expect(await a.isAudienceChecked('Students')).toBe(true);
    expect(await a.isAudienceChecked('Employees')).toBe(true);

    await a.toggleAudience('Students');
    expect(await a.isAudienceChecked('Students')).toBe(false);
    expect(await a.isAudienceChecked('Employees')).toBe(true);
  });

  test('TS_ACK_05 unchecking all audiences disables Publish', async ({ acknowledgementsPage: a }) => {
    test.fail(true, 'Assign To is not enforced: Publish stays enabled with nobody selected');
    await a.goto();
    await a.openCreateModal();
    await a.fillValid();
    await expect(a.publish).toBeEnabled();
    await a.toggleAudience('Employees');
    await expect(a.publish).toBeDisabled();
  });
});

// =====================================================================================
// TS_ACK_06: lengths (the UI applies no limits)
// =====================================================================================
test.describe('TS_ACK_06 length boundaries @acknowledgements', () => {
  test('TS_ACK_06 title of 120 and description of 5000 are accepted', async ({ acknowledgementsPage: a }) => {
    await a.goto();
    await a.openCreateModal();
    await a.setTitle('t'.repeat(120));
    await a.setDescription('d'.repeat(5000));
    expect((await a.titleField.inputValue()).length).toBe(120);
    expect((await a.descriptionField.inputValue()).length).toBe(5000);
    await a.setDeadline(futureIso());
    await a.toggleAudience('Students');
    await expect(a.publish).toBeEnabled();
  });

  test('TS_ACK_06 title of 121 is blocked or truncated', async ({ acknowledgementsPage: a }) => {
    test.fail(true, 'UI accepts 121 characters');
    await a.goto();
    await a.openCreateModal();
    await a.setTitle('t'.repeat(121));
    expect((await a.titleField.inputValue()).length).toBeLessThanOrEqual(120);
  });

  test('TS_ACK_06 description of 5001 is blocked or truncated', async ({ acknowledgementsPage: a }) => {
    test.fail(true, 'UI accepts 5001 characters');
    await a.goto();
    await a.openCreateModal();
    await a.setDescription('d'.repeat(5001));
    expect((await a.descriptionField.inputValue()).length).toBeLessThanOrEqual(5000);
  });
});

// =====================================================================================
// TS_ACK_08 (safe part): closing the modal
// =====================================================================================
test.describe('TS_ACK_08 closing the modal @acknowledgements', () => {
  test('TS_ACK_08 closing with X discards the draft, nothing is saved, re-opening shows an empty form', async ({ acknowledgementsPage: a, adminPage }) => {
    const writes: string[] = [];
    adminPage.on('request', (r) => {
      if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(`${r.method()} ${r.url()}`);
    });
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    const before = await a.cards.count();
    await a.openCreateModal();
    await a.fillValid();
    await a.closeCreateModal();
    await expect(a.cards).toHaveCount(before);
    await a.openCreateModal();
    await expect(a.titleField).toHaveValue('');
    await expect(a.descriptionField).toHaveValue('');
    expect(await a.deadlineValue()).toBe('');
    expect(await a.isAudienceChecked('Employees')).toBe(false);
    expect(writes).toEqual([]);
  });

  test('TS_ACK_08 clicking the backdrop dismisses the modal without saving', async ({ acknowledgementsPage: a }) => {
    test.fail(true, 'Clicking the dimmed area does not close the modal');
    await a.goto();
    await a.openCreateModal();
    await a.setTitle('Draft');
    await a.clickBackdrop();
    await expect(a.modal).toBeHidden();
  });
});

// =====================================================================================
// 3. GATED: publish a real request (ALLOW_ACK_WRITES=true)
// =====================================================================================
test.describe('TS_ACK_07 publish @acknowledgements @writes', () => {
  test.skip(!WRITES_ALLOWED, 'Publishes a real request to real users; there is no delete. Set ALLOW_ACK_WRITES=true to run.');

  test('TS_ACK_07 publish acknowledgement: card on top of Pending, badge +1', async ({ acknowledgementsPage: a }) => {
    const title = `AUTOTEST ack ${Date.now()}`;
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    const before = await a.cards.count();
    await a.openCreateModal();
    await a.setTitle(title);
    await a.setDescription('Automated test request. Safe to ignore.');
    await a.setDeadline(futureIso(7));
    await a.toggleAudience('Employees');
    expect(await a.publishAndWait()).toBeLessThan(300);
    await expect(a.modal).toBeHidden();
    await expect(a.cards.first()).toContainText(title);
    await expect(a.badge).toHaveText(`${before + 1} pending`);
  });
});
