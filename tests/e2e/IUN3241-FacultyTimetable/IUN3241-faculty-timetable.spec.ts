import { test, expect } from '@fixtures';

/**
 * IUN-3241 Faculty Timetable & Lecture Attendance Marking.
 *
 * The feature is a FACULTY surface (/timetable). The only QA login is an ADMIN, so the functional cases
 * (TT-001 .. TT-045 in docs/test-cases/faculty-timetable.md) cannot run yet. This spec only guards that
 * fact: it is green while the admin app does not expose the module, and turns red the day it does, which is
 * the signal to automate the documented cases. Nothing here writes data.
 */
const clean = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '');

test.describe('Faculty Timetable availability for the admin login @faculty-timetable', () => {
  test('TT-BLOCK-01 admin sidebar has no Timetable entry', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await expect(adminPage.getByText('Admin Dashboard', { exact: true })).toBeVisible();
    const text = clean(await adminPage.locator('body').innerText());
    expect(text).not.toMatch(/\bTimetable\b/);
  });

  test('TT-BLOCK-02 /timetable is not a route of the admin app (falls back to the dashboard)', async ({ adminPage }) => {
    await adminPage.goto('/timetable');
    await expect(adminPage.getByText('Admin Dashboard', { exact: true })).toBeVisible();
    const text = clean(await adminPage.locator('body').innerText());
    for (const faculty of ['No classes today', "View Tomorrow's Schedule", 'Mark Attendance']) {
      expect(text).not.toContain(faculty);
    }
  });

  test('TT-BLOCK-03 the signed-in profile is ADMIN, not a teaching faculty member', async ({ adminPage }) => {
    const me = adminPage.waitForResponse((r) => /\/api\/auth\/me/.test(r.url()) && r.ok());
    await adminPage.goto('/dashboard');
    const body = (await (await me).json()) as { data?: { profile?: { role?: string } }; profile?: { role?: string } };
    expect((body.data?.profile ?? body.profile)?.role).toBe('ADMIN');
  });
});
