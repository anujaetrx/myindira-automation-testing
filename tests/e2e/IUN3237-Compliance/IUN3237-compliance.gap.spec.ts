import { test, expect } from '@fixtures';
import { complianceResponse, LIST_API, type ComplianceRow } from '@pages/CompliancePage';

/**
 * Compliance: gap review against story IUN-3237 (BR-CR-01 .. BR-CR-04, scenarios 1 to 4, TC_CR_001 .. 005).
 * The sheet-based spec (IUN3237-compliance.spec.ts) covers the story's rules. What the sheet never asked: the list API is
 * paged (page=0&size=20), so a report with more than 20 items must still be fully reachable. Mocked list data.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const row = (i: number): ComplianceRow => ({
  type: 'POLICY',
  itemId: i,
  title: `Policy ${i}`,
  deadline: '2099-01-01',
  targetRoles: ['STUDENT'],
  totalAssigned: 10,
  totalAcknowledged: 1,
  compliancePercentage: 10,
  status: 'PENDING',
});

test.describe('IUN-3237 gap review: paging @compliance', () => {
  test('the report asks the API for the first page of 20', async ({ compliancePage: a, adminPage }) => {
    const request = adminPage.waitForRequest((r) => LIST_API.test(r.url()));
    await a.goto();
    expect((await request).url()).toMatch(/page=0&size=20/);
  });

  test('a report with exactly 20 items shows all 20 cards', async ({ compliancePage: a, adminPage }) => {
    await adminPage.route(LIST_API, (route) => route.fulfill({ json: complianceResponse(Array.from({ length: 20 }, (_, i) => row(i + 1))) }));
    await a.goto();
    await expect(a.cards).toHaveCount(20);
  });

  test('items beyond the first 20 are reachable (second page is requested)', async ({ compliancePage: a, adminPage }) => {
    test.fail(true, 'With 25 items only the first 20 are shown and page 2 is never requested, so the last 5 policies cannot be seen');
    const pages: number[] = [];
    await adminPage.route(LIST_API, (route) => {
      const page = Number(/page=(\d+)/.exec(route.request().url())?.[1] ?? 0);
      pages.push(page);
      const rows = Array.from({ length: page === 0 ? 20 : 5 }, (_, i) => row(page * 20 + i + 1));
      return route.fulfill({
        json: { success: true, message: 'ok', code: 'OK', data: { totalElements: 25, totalPages: 2, number: page, size: 20, content: rows, first: page === 0, last: page === 1 } },
      });
    });
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
    await a.cards.last().scrollIntoViewIfNeeded();
    await adminPage.waitForTimeout(2_000); // give an infinite-scroll loader time to fire
    expect(pages, 'pages requested').toContain(1);
    await expect(a.cards).toHaveCount(25);
  });
});
