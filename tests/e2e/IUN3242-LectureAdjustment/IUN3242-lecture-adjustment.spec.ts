import { test, expect } from '@fixtures';

/**
 * IUN-3242 Faculty Lecture Adjustment Request & Academic Admin Approval.
 *
 * The request side is a FACULTY surface (/lecture-adjust) and the approval side is an ACADEMIC ADMIN surface
 * whose location the story does not name. Neither exists in the admin portal reachable with the only QA
 * login, so the functional cases (LA-001 .. LA-049 in docs/test-cases/lecture-adjustment.md) cannot run yet.
 * This spec only guards that fact: green while the module is absent, red the day it appears (then automate the
 * documented cases, with guardWrites + ALLOW_ADJUSTMENT_WRITES for every submit / approve / reject).
 * Nothing here writes data.
 */
const clean = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '');

test.describe('Lecture Adjustment availability for the admin login @lecture-adjustment', () => {
  test('LA-BLOCK-01 admin sidebar has no Lecture Adjust or approvals entry', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await expect(adminPage.getByText('Admin Dashboard', { exact: true })).toBeVisible();
    const text = clean(await adminPage.locator('body').innerText());
    expect(text).not.toMatch(/Lecture\s*Adjust/i);
    expect(text).not.toMatch(/Adjustments?\b/i);
  });

  test('LA-BLOCK-02 /lecture-adjust is not a route of the admin app (falls back to the dashboard)', async ({ adminPage }) => {
    await adminPage.goto('/lecture-adjust');
    await expect(adminPage.getByText('Admin Dashboard', { exact: true })).toBeVisible();
    const text = clean(await adminPage.locator('body').innerText());
    for (const faculty of ['No division selected', 'Complete the selection above to load templates', 'Send for Approval']) {
      expect(text).not.toContain(faculty);
    }
  });
});
