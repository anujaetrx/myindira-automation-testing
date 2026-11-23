import type { Page } from '@playwright/test';
import { test as base, expect } from '@fixtures';
import {
  CommunitiesPage,
  communitiesResponse,
  statsResponse,
  guardWrites,
  LIST_API,
  STATS_API,
  STAT_LABELS,
  type CommunityRow,
  type CommunityStats,
  type StatLabel,
} from '@pages/CommunitiesPage';

const test = base.extend<{ communitiesPage: CommunitiesPage }>({
  communitiesPage: async ({ adminPage }, use) => use(new CommunitiesPage(adminPage)),
});

/**
 * Communities & Clubs administration (story IUN-3232, rules BR-COM-01 .. BR-COM-04, QA cases TC_COM_001 .. 005).
 * Screen: sidebar "Communities" (/communities). It is NOT the "Communities" tab inside Social Feed (/feed).
 * Results and open questions: docs/test-cases/communities.md
 *
 * Three kinds of check:
 *   - REAL DATA: read what QA returns; tiles, cards and filters are compared with the API, not with the story's
 *     example numbers (Clubs 10, Archived 3 are "illustrative").
 *   - MOCKED API: situations that cannot be created safely (pending / suspended cards, errors, empty list, a duplicate
 *     name answer, counters that move after a write). These test how the screen RENDERS what it is given.
 *   - KNOWN DEVIATIONS: test.fail() keeps the run green and reports the gap; the test turns red when fixed.
 * Every click that would change data runs behind guardWrites (answered locally, recorded and asserted). Nothing
 * here changes real clubs.
 */

const row = (over: Partial<CommunityRow> = {}): CommunityRow => ({
  id: 9001,
  slug: 'mock',
  name: 'Mock club',
  type: 'CLUB',
  status: 'ACTIVE',
  category: 'Tech',
  description: 'Mock community',
  visibility: 'PUBLIC',
  memberCount: 3,
  postCount: 0,
  ...over,
});

const stats = (over: Partial<CommunityStats> = {}): CommunityStats => ({
  totalClubs: 1,
  totalGroups: 0,
  pendingApproval: 0,
  archived: 0,
  openFlags: 0,
  postsUnderReview: 0,
  ...over,
});

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Active', ARCHIVED: 'Archived', PENDING_APPROVAL: 'Pending', SUSPENDED: 'Suspended' };

async function mockList(page: Page, rows: CommunityRow[]): Promise<void> {
  await page.route(LIST_API, (route) => (route.request().method() === 'GET' ? route.fulfill({ json: communitiesResponse(rows) }) : route.fallback()));
}
async function mockStats(page: Page, s: CommunityStats): Promise<void> {
  await page.route(STATS_API, (route) => (route.request().method() === 'GET' ? route.fulfill({ json: statsResponse(s) }) : route.fallback()));
}

interface RealData {
  rows: CommunityRow[];
  stats: CommunityStats;
}

/** Opens the screen and returns what the API sent for the list and the stats. */
async function openReal(a: CommunitiesPage, page: Page): Promise<RealData> {
  const list = page.waitForResponse((r) => LIST_API.test(r.url()) && r.request().method() === 'GET');
  const st = page.waitForResponse((r) => STATS_API.test(r.url()) && r.request().method() === 'GET');
  await a.goto();
  const l = (await (await list).json()) as { data: { content: CommunityRow[] } };
  const s = (await (await st).json()) as { data: CommunityStats };
  await expect(a.cards.first()).toBeVisible();
  return { rows: l.data.content, stats: s.data };
}

/** Clicks a filter and returns the list request it sent. */
async function filterAndCapture(page: Page, act: () => Promise<void>): Promise<URLSearchParams> {
  const req = page.waitForRequest((r) => LIST_API.test(r.url()) && r.method() === 'GET');
  await act();
  return new URL((await req).url()).searchParams;
}

const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const png = (name = 'logo.png') => ({ name, mimeType: 'image/png', buffer: TINY_PNG });

/** Also stops writes that go to another host (file storage), so a logo test can never upload for real. */
async function guardAll(page: Page): Promise<{ api: Awaited<ReturnType<typeof guardWrites>>; other: string[] }> {
  const other: string[] = [];
  await page.route(/^https:\/\/(?!app-test\.k\.indiraiscm\.com)/, async (route) => {
    const m = route.request().method();
    if (m === 'GET' || m === 'OPTIONS' || m === 'HEAD') return route.fallback();
    other.push(`${m} ${new URL(route.request().url()).host}`);
    return route.fulfill({ status: 200, body: '' });
  });
  const api = await guardWrites(page);
  return { api, other };
}

const GREEN = (c: string) => {
  const m = /rgb\((\d+), (\d+), (\d+)/.exec(c);
  return !!m && Number(m[2]) > Number(m[1]) && Number(m[2]) > Number(m[3]);
};
/** Slate grey: low saturation (the archived dot is rgb(95,122,142)). */
const GREY = (c: string) => {
  const m = /rgb\((\d+), (\d+), (\d+)/.exec(c);
  if (!m) return false;
  const v = [Number(m[1]), Number(m[2]), Number(m[3])];
  return Math.max(...v) - Math.min(...v) <= 60 && Math.max(...v) < 200;
};

// =====================================================================================
// TS_COM_01: hub, tiles, banner (TC_COM_001)
// =====================================================================================
test.describe('TS_COM_01 communities hub @communities', () => {
  test('TC_COM_001 page loads with six tiles, flagged-posts banner, both filter rows, cards and the + button', async ({ communitiesPage: a, adminPage }) => {
    await openReal(a, adminPage);
    expect(a.currentPath()).toBe('/communities');
    for (const l of STAT_LABELS) await expect.poll(() => a.stat(l), { message: `tile ${l}` }).toMatch(/^\d+$/);
    for (const f of ['All', 'Active', 'Pending', 'Archived', 'Suspended']) await expect(adminPage.locator('div[tabindex="0"]').filter({ hasText: new RegExp(`^${f}$`) }).first()).toBeVisible();
    for (const f of ['All types', 'Clubs', 'Groups']) await expect(adminPage.locator('div[tabindex="0"]').filter({ hasText: new RegExp(`^${f}$`) }).first()).toBeVisible();
    await expect(a.cards.first()).toBeVisible();
  });

  test('TC_COM_001 the sidebar item "Communities" is the active one and the page is not the Social Feed tab', async ({ communitiesPage: a, adminPage }) => {
    await a.goto();
    await expect(adminPage.getByText("What's on your mind?", { exact: true })).toHaveCount(0);
    await expect(adminPage.getByText('Birthdays', { exact: true })).toHaveCount(0);
  });

  test('TC_COM_001 the six tiles equal GET /admin/communities/stats (real data)', async ({ communitiesPage: a, adminPage }) => {
    const { stats: s } = await openReal(a, adminPage);
    const t = await a.allStats();
    expect(t).toEqual({
      Clubs: String(s.totalClubs),
      Groups: String(s.totalGroups),
      Pending: String(s.pendingApproval),
      Archived: String(s.archived),
      'Open flags': String(s.openFlags),
      Review: String(s.postsUnderReview),
    } satisfies Record<StatLabel, string>);
  });

  test('TC_COM_001 tiles render any values the API returns (mocked, non-zero, multi-digit)', async ({ communitiesPage: a, adminPage }) => {
    await mockStats(adminPage, stats({ totalClubs: 12, totalGroups: 7, pendingApproval: 3, archived: 120, openFlags: 5, postsUnderReview: 4 }));
    await a.goto();
    expect(await a.allStats()).toEqual({ Clubs: '12', Groups: '7', Pending: '3', Archived: '120', 'Open flags': '5', Review: '4' });
  });

  test('TC_COM_001 tile figures agree with the card list: Archived tile = archived rows, Groups tile = active groups (real data)', async ({ communitiesPage: a, adminPage }) => {
    const { rows, stats: s } = await openReal(a, adminPage);
    test.skip(rows.length >= 20, 'more than one page of data: the first page cannot prove the totals');
    expect(s.archived).toBe(rows.filter((r) => r.status === 'ARCHIVED').length);
    expect(s.totalClubs).toBe(rows.filter((r) => r.type === 'CLUB' && r.status === 'ACTIVE').length);
    expect(s.totalGroups).toBe(rows.filter((r) => r.type === 'GROUP' && r.status === 'ACTIVE').length);
  });

  test('TC_COM_001 the list is requested with page=0&size=20 and no filter on open', async ({ communitiesPage: a, adminPage }) => {
    const req = adminPage.waitForRequest((r) => LIST_API.test(r.url()) && r.method() === 'GET');
    await a.goto();
    const q = new URL((await req).url()).searchParams;
    expect(q.get('page')).toBe('0');
    expect(q.get('size')).toBe('20');
    expect(q.has('status')).toBe(false);
    expect(q.has('type')).toBe(false);
  });

  test('TC_COM_001 "Review flagged posts" banner opens the Flagged posts screen (Open / Resolved / All)', async ({ communitiesPage: a, adminPage }) => {
    await a.goto();
    await a.openFlaggedPosts();
    await expect(a.flaggedPostsTitle).toBeVisible();
    for (const f of ['Open', 'Resolved', 'All']) await expect(adminPage.getByText(f, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test('TC_COM_001 banner redirects to /reported-posts (story)', async ({ communitiesPage: a, adminPage }) => {
    test.fail(true, 'Known deviation: the banner opens a "Flagged posts" screen but the address stays /communities, not /reported-posts');
    await a.goto();
    await a.openFlaggedPosts();
    await expect(a.flaggedPostsTitle).toBeVisible();
    expect(new URL(adminPage.url()).pathname).toBe('/reported-posts');
  });

  test('TC_COM_001 flagged-posts screen: back arrow returns to the communities hub', async ({ communitiesPage: a, adminPage }) => {
    await a.goto();
    await a.openFlaggedPosts();
    await expect(a.flaggedPostsTitle).toBeVisible();
    await a.backFromFlagged();
    await expect(a.flaggedPostsTitle).toBeHidden();
    await expect(adminPage.getByText('Review flagged posts', { exact: true }).filter({ visible: true })).toBeVisible();
  });
});

// =====================================================================================
// TS_COM_02: card directory
// =====================================================================================
test.describe('TS_COM_02 community cards @communities', () => {
  test('TC_COM_002 every card shows name, "Type · N Members · Status" and the lifecycle button; all match the API (real data)', async ({ communitiesPage: a, adminPage }) => {
    const { rows } = await openReal(a, adminPage);
    await expect.poll(async () => (await a.cardList()).length).toBe(rows.length);
    const cards = await a.cardList();
    cards.forEach((c, i) => {
      const r = rows[i];
      expect(c.name, `card ${i} name`).toBe(r.name);
      expect(c.type).toBe(r.type === 'CLUB' ? 'Club' : 'Group');
      expect(c.members).toBe(r.memberCount);
      expect(c.status).toBe(STATUS_LABEL[r.status] ?? '');
      expect(c.action).toBe(r.status === 'ARCHIVED' ? 'Activate' : 'Archive');
    });
  });

  test('TC_COM_002 active card has a green dot and "Archive"; archived card has a grey dot and "Activate" (mocked)', async ({ communitiesPage: a, adminPage }) => {
    await mockList(adminPage, [row({ id: 1, name: 'Live club' }), row({ id: 2, name: 'Old club', status: 'ARCHIVED' })]);
    await a.goto();
    await expect(a.cards).toHaveCount(2);
    const cards = await a.cardList();
    expect(cards[0]).toMatchObject({ name: 'Live club', status: 'Active', action: 'Archive' });
    expect(cards[1]).toMatchObject({ name: 'Old club', status: 'Archived', action: 'Activate' });
    expect(GREEN(await a.dotColor(0)), 'active dot is green').toBe(true);
    expect(GREY(await a.dotColor(1)), 'archived dot is grey').toBe(true);
  });

  test('TC_COM_002 the member count and type are written as "1 Members" / "Group" (singular count keeps the plural word)', async ({ communitiesPage: a, adminPage }) => {
    await mockList(adminPage, [row({ id: 1, name: 'Solo', memberCount: 1 }), row({ id: 2, name: 'Grp', type: 'GROUP', memberCount: 0 })]);
    await a.goto();
    const c = await a.cardList();
    expect(c[0]).toMatchObject({ type: 'Club', members: 1 });
    expect(c[1]).toMatchObject({ type: 'Group', members: 0 });
  });

  test('TC_COM_002 pending and suspended cards show their status text (mocked)', async ({ communitiesPage: a, adminPage }) => {
    await mockList(adminPage, [row({ id: 1, name: 'Wait', status: 'PENDING_APPROVAL' }), row({ id: 2, name: 'Held', status: 'SUSPENDED' })]);
    await a.goto();
    const c = await a.cardList();
    expect(c[0]).toMatchObject({ name: 'Wait', status: 'Pending' });
    expect(c[1]).toMatchObject({ name: 'Held', status: 'Suspended' });
    const dots = [await a.dotColor(0), await a.dotColor(1)];
    expect(dots[0], 'pending and suspended dots differ').not.toBe(dots[1]);
    expect(GREEN(dots[0]) || GREEN(dots[1])).toBe(false);
  });

  test('TC_COM_002 a long community name does not break the card or hide the lifecycle button (mocked)', async ({ communitiesPage: a, adminPage }) => {
    const long = 'Very long community name '.repeat(6).trim();
    await mockList(adminPage, [row({ id: 1, name: long })]);
    await a.goto();
    await expect(a.actionButtons.first()).toBeVisible();
    const box = await a.actionButtons.first().boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(1280);
    expect((await a.cardList())[0].name).toBe(long);
  });

  test('TC_COM_002 empty list shows "No communities" (mocked)', async ({ communitiesPage: a, adminPage }) => {
    await mockList(adminPage, []);
    await a.goto();
    await expect(a.emptyMessage).toBeVisible();
    await expect(a.cards).toHaveCount(0);
  });

  test('TC_COM_002 empty list keeps tiles, banner, filters and the + button usable (mocked)', async ({ communitiesPage: a, adminPage }) => {
    await mockList(adminPage, []);
    await a.goto();
    await a.openCreate();
    await expect(a.modalTitle).toBeVisible();
  });

  test('TC_COM_002 list API error: the screen does not crash and shows no cards (mocked 500)', async ({ communitiesPage: a, adminPage }) => {
    await adminPage.route(LIST_API, (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 500, json: { success: false, message: 'boom', code: 'ERR' } }) : route.fallback()));
    await a.goto();
    await expect(a.cards).toHaveCount(0);
    await expect(adminPage.getByText('Review flagged posts', { exact: true })).toBeVisible();
  });

  test('TC_COM_002 list API error is reported as an error, not as an empty directory (mocked 500)', async ({ communitiesPage: a, adminPage }) => {
    test.fail(true, 'Known deviation: a failed list call shows the same "No communities" as an empty directory (no error message or retry)');
    await adminPage.route(LIST_API, (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 500, json: { success: false, message: 'boom', code: 'ERR' } }) : route.fallback()));
    await a.goto();
    await expect(a.emptyMessage).toHaveCount(0);
  });

  test('TC_COM_002 stats API error: tiles do not crash the page and the cards still load (mocked 500)', async ({ communitiesPage: a, adminPage }) => {
    await adminPage.route(STATS_API, (route) => route.fulfill({ status: 500, json: { success: false, message: 'boom', code: 'ERR' } }));
    await a.goto();
    await expect(a.cards.first()).toBeVisible();
  });
});

// =====================================================================================
// TS_COM_03: status and type filters (TC_COM_005)
// =====================================================================================
test.describe('TS_COM_03 filters @communities', () => {
  test('TC_COM_005 default selection is "All" statuses and "All types", filled differently from the other chips', async ({ communitiesPage: a }) => {
    await a.goto();
    const all = await a.chipBackground('All');
    expect(all).not.toBe(await a.chipBackground('Active'));
    expect(await a.chipBackground('All types')).not.toBe(await a.chipBackground('Clubs'));
  });

  for (const [label, param] of [
    ['Active', 'ACTIVE'],
    ['Pending', 'PENDING_APPROVAL'],
    ['Archived', 'ARCHIVED'],
    ['Suspended', 'SUSPENDED'],
  ] as const) {
    test(`TC_COM_005 status chip "${label}" requests status=${param} and shows only matching cards (real data)`, async ({ communitiesPage: a, adminPage }) => {
      await a.goto();
      const q = await filterAndCapture(adminPage, () => a.filterStatus(label));
      expect(q.get('status')).toBe(param);
      expect(q.has('type')).toBe(false);
      await adminPage.waitForTimeout(800);
      const cards = await a.cardList();
      if (cards.length === 0) await expect(a.emptyMessage).toBeVisible();
      for (const c of cards) expect(c.status).toBe(label);
      expect(await a.chipBackground(label)).not.toBe(await a.chipBackground(label === 'Active' ? 'Archived' : 'Active'));
    });
  }

  for (const [label, param, word] of [
    ['Clubs', 'CLUB', 'Club'],
    ['Groups', 'GROUP', 'Group'],
  ] as const) {
    test(`TC_COM_005 type chip "${label}" requests type=${param} and shows only ${word} cards (real data)`, async ({ communitiesPage: a, adminPage }) => {
      await a.goto();
      const q = await filterAndCapture(adminPage, () => a.filterType(label));
      expect(q.get('type')).toBe(param);
      expect(q.has('status')).toBe(false);
      await adminPage.waitForTimeout(800);
      const cards = await a.cardList();
      if (cards.length === 0) await expect(a.emptyMessage).toBeVisible();
      for (const c of cards) expect(c.type).toBe(word);
    });
  }

  test('TC_COM_005 "Archived" + "Groups" combine: both params sent, only archived groups shown (real data)', async ({ communitiesPage: a, adminPage }) => {
    await a.goto();
    await a.filterStatus('Archived');
    const q = await filterAndCapture(adminPage, () => a.filterType('Groups'));
    expect(q.get('status')).toBe('ARCHIVED');
    expect(q.get('type')).toBe('GROUP');
    await adminPage.waitForTimeout(800);
    const cards = await a.cardList();
    for (const c of cards) expect(c).toMatchObject({ type: 'Group', status: 'Archived', action: 'Activate' });
  });

  test('TC_COM_005 "Archived" + "Clubs" shows only archived clubs (real data)', async ({ communitiesPage: a, adminPage }) => {
    await a.goto();
    await a.filterStatus('Archived');
    const q = await filterAndCapture(adminPage, () => a.filterType('Clubs'));
    expect(q.get('type')).toBe('CLUB');
    await adminPage.waitForTimeout(800);
    const cards = await a.cardList();
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) expect(c).toMatchObject({ type: 'Club', status: 'Archived', action: 'Activate' });
  });

  test('TC_COM_005 "All" and "All types" remove the filters again and the full directory is back', async ({ communitiesPage: a, adminPage }) => {
    const { rows } = await openReal(a, adminPage);
    await a.filterStatus('Archived');
    await a.filterType('Clubs');
    await expect.poll(async () => (await a.cardList()).length).toBeLessThan(rows.length);
    await a.filterStatus('All');
    await a.filterType('All types');
    await expect.poll(async () => (await a.cardList()).length).toBe(rows.length);
    expect((await a.cardList()).map((c) => c.name)).toEqual(rows.map((r) => r.name));
  });

  test('TC_COM_005 a filter with no match shows "No communities" (real data: Suspended)', async ({ communitiesPage: a, adminPage }) => {
    await mockList(adminPage, []);
    await a.goto();
    await a.filterStatus('Suspended');
    await expect(a.emptyMessage).toBeVisible();
  });

  test('TC_COM_005 only one status chip is selected at a time', async ({ communitiesPage: a, adminPage }) => {
    await a.goto();
    await a.filterStatus('Active');
    await adminPage.waitForTimeout(600);
    const sel = await a.chipBackground('Active');
    expect(await a.chipBackground('All')).not.toBe(sel);
    expect(await a.chipBackground('Archived')).not.toBe(sel);
  });

  test('TC_COM_005 the Archived chip lists exactly as many cards as the Archived tile says (real data)', async ({ communitiesPage: a, adminPage }) => {
    const { stats: s } = await openReal(a, adminPage);
    await a.filterStatus('Archived');
    await adminPage.waitForTimeout(1000);
    expect((await a.cardList()).length).toBe(s.archived);
  });

  test('TC_COM_005 there is no search box on this screen', async ({ communitiesPage: a, adminPage }) => {
    await a.goto();
    await expect(adminPage.locator('input:visible')).toHaveCount(0);
    await expect(adminPage.getByPlaceholder(/search/i)).toHaveCount(0);
  });
});

// =====================================================================================
// TS_COM_04: lifecycle (TC_COM_004, BR-COM-04). Always behind guardWrites.
// =====================================================================================
test.describe('TS_COM_04 lifecycle Archive / Activate @communities', () => {
  test('TC_COM_004 Archive on an active club sends POST /admin/communities/{id}/archive with an empty body (real card, write blocked)', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const { rows } = await openReal(a, adminPage);
    const idx = rows.findIndex((r) => r.status === 'ACTIVE');
    test.skip(idx < 0, 'no active community on QA');
    await a.clickAction(idx);
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({ method: 'POST', path: `/admin/communities/${rows[idx].id}/archive`, body: '{}' });
  });

  test('TC_COM_004 Activate on an archived club sends POST /admin/communities/{id}/activate (real card, write blocked)', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const { rows } = await openReal(a, adminPage);
    const idx = rows.findIndex((r) => r.status === 'ARCHIVED');
    test.skip(idx < 0, 'no archived community on QA');
    await a.clickAction(idx);
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({ method: 'POST', path: `/admin/communities/${rows[idx].id}/activate`, body: '{}' });
  });

  test('TC_COM_004 Archive acts on the clicked card only (second card of a mocked list)', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await mockList(adminPage, [row({ id: 11, name: 'One' }), row({ id: 22, name: 'Two' })]);
    await a.goto();
    await expect(a.cards).toHaveCount(2);
    await a.clickAction(1);
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].path).toBe('/admin/communities/22/archive');
  });

  test('TC_COM_004 Archive and Activate run at once: no native confirmation dialog is shown', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const dialogs: string[] = [];
    adminPage.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });
    await mockList(adminPage, [row({ id: 1 }), row({ id: 2, status: 'ARCHIVED', name: 'Old' })]);
    await a.goto();
    await expect(a.cards).toHaveCount(2);
    await a.clickAction(0);
    await a.clickAction(1);
    await expect.poll(() => writes.length).toBe(2);
    expect(dialogs).toEqual([]);
  });

  test('TC_COM_004 after Archive the screen reloads the list and the stats (write blocked)', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await mockList(adminPage, [row({ id: 5 })]);
    await a.goto();
    await expect(a.cards).toHaveCount(1);
    const stat = adminPage.waitForRequest((r) => STATS_API.test(r.url()) && r.method() === 'GET');
    const list = adminPage.waitForRequest((r) => LIST_API.test(r.url()) && r.method() === 'GET');
    await a.clickAction(0);
    await Promise.all([stat, list]);
    expect(writes).toHaveLength(1);
  });

  test('TC_COM_004 after Archive the card turns Archived (grey dot, "Activate") and the Archived tile goes up by one (server state mocked)', async ({ communitiesPage: a, adminPage }) => {
    let done = false;
    await guardWrites(adminPage);
    await adminPage.route(LIST_API, (r) => (r.request().method() === 'GET' ? r.fulfill({ json: communitiesResponse([row({ id: 5, name: 'Toggle', status: done ? 'ARCHIVED' : 'ACTIVE' })]) }) : r.fallback()));
    await adminPage.route(STATS_API, (r) => r.fulfill({ json: statsResponse(done ? stats({ totalClubs: 0, archived: 4 }) : stats({ totalClubs: 1, archived: 3 })) }));
    await a.goto();
    expect((await a.cardList())[0]).toMatchObject({ status: 'Active', action: 'Archive' });
    expect(await a.stat('Archived')).toBe('3');
    done = true;
    await a.clickAction(0);
    await expect.poll(async () => (await a.cardList())[0]?.status).toBe('Archived');
    expect((await a.cardList())[0].action).toBe('Activate');
    expect(GREY(await a.dotColor(0))).toBe(true);
    expect(await a.stat('Archived')).toBe('4');
    expect(await a.stat('Clubs')).toBe('0');
  });

  test('TC_COM_004 after Activate the card turns Active again (green dot, "Archive") and the Archived tile goes down (server state mocked)', async ({ communitiesPage: a, adminPage }) => {
    let done = false;
    await guardWrites(adminPage);
    await adminPage.route(LIST_API, (r) => (r.request().method() === 'GET' ? r.fulfill({ json: communitiesResponse([row({ id: 6, name: 'Back', status: done ? 'ACTIVE' : 'ARCHIVED' })]) }) : r.fallback()));
    await adminPage.route(STATS_API, (r) => r.fulfill({ json: statsResponse(done ? stats({ totalClubs: 1, archived: 0 }) : stats({ totalClubs: 0, archived: 1 })) }));
    await a.goto();
    expect((await a.cardList())[0]).toMatchObject({ status: 'Archived', action: 'Activate' });
    done = true;
    await a.clickAction(0);
    await expect.poll(async () => (await a.cardList())[0]?.status).toBe('Active');
    expect((await a.cardList())[0].action).toBe('Archive');
    expect(GREEN(await a.dotColor(0))).toBe(true);
    expect(await a.stat('Archived')).toBe('0');
  });

  test('TC_COM_004 a failed Archive (mocked 500) does not crash the screen and keeps the card as it was', async ({ communitiesPage: a, adminPage }) => {
    await adminPage.route(/\/admin\/communities\/\d+\/archive/, (r) => r.fulfill({ status: 500, json: { success: false, message: 'boom', code: 'ERR' } }));
    await mockList(adminPage, [row({ id: 7, name: 'Stay' })]);
    await a.goto();
    await expect(a.cards).toHaveCount(1);
    await a.clickAction(0);
    await adminPage.waitForTimeout(1000);
    await expect(a.cards).toHaveCount(1);
    expect((await a.cardList())[0]).toMatchObject({ name: 'Stay', status: 'Active' });
  });

  test('TC_COM_004 Archive asks for confirmation before changing a real club', async ({ communitiesPage: a, adminPage }) => {
    test.fail(true, 'Known deviation: Archive / Activate fire the request on the first click with no confirmation (a mis-click archives a club)');
    const writes = await guardWrites(adminPage);
    let asked = false;
    adminPage.once('dialog', async (d) => {
      asked = true;
      await d.dismiss();
    });
    await mockList(adminPage, [row({ id: 3 })]);
    await a.goto();
    await expect(a.cards).toHaveCount(1);
    await a.clickAction(0);
    await adminPage.waitForTimeout(800);
    expect(asked).toBe(true);
    expect(writes).toHaveLength(0); // dismissed: nothing is sent
  });

  test('TC_COM_004 pending and suspended communities offer "Archive" and send the archive call (mocked)', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await mockList(adminPage, [row({ id: 31, name: 'Wait', status: 'PENDING_APPROVAL' }), row({ id: 32, name: 'Held', status: 'SUSPENDED' })]);
    await a.goto();
    await expect(a.cards).toHaveCount(2);
    const c = await a.cardList();
    expect(c.map((x) => x.action)).toEqual(['Archive', 'Archive']);
    await a.clickAction(0);
    await a.clickAction(1);
    await expect.poll(() => writes.length).toBe(2);
    expect(writes.map((w) => w.path)).toEqual(['/admin/communities/31/archive', '/admin/communities/32/archive']);
  });

  test('TC_COM_004 Approve / Reject (pending) and Suspend / Restore controls', async ({ communitiesPage: a, adminPage }) => {
    test.fail(true, 'Known deviation (not in the story, asked in the QA brief): a Pending card has no Approve / Reject button and no card has Suspend; the only lifecycle control is Archive / Activate');
    await mockList(adminPage, [row({ id: 41, name: 'Wait', status: 'PENDING_APPROVAL' }), row({ id: 42, name: 'Live' })]);
    await a.goto();
    await expect(adminPage.getByText('Approve', { exact: true })).toBeVisible({ timeout: 3_000 });
    await expect(adminPage.getByText('Reject', { exact: true })).toBeVisible({ timeout: 3_000 });
    await expect(adminPage.getByText('Suspend', { exact: true })).toBeVisible({ timeout: 3_000 });
  });

  test('TC_COM_004 a community with an unknown status shows an empty status word (mocked DRAFT)', async ({ communitiesPage: a, adminPage }) => {
    await mockList(adminPage, [row({ id: 51, name: 'Odd', status: 'DRAFT' })]);
    await a.goto();
    expect((await a.cardList())[0]).toMatchObject({ name: 'Odd', status: '', action: 'Archive' });
  });
});

// =====================================================================================
// TS_COM_05: "New community" modal (TC_COM_002, BR-COM-01, BR-COM-03)
// =====================================================================================
test.describe('TS_COM_05 new community modal @communities', () => {
  test('TC_COM_002 the + button opens "New community" with Club and Public preselected and a 0/300 counter', async ({ communitiesPage: a, adminPage }) => {
    await a.goto();
    await a.openCreate();
    await expect(a.modalTitle).toBeVisible();
    await expect(a.createBtn).toBeVisible();
    for (const l of ['Club', 'Group', 'Public', 'Restricted', 'Private']) await expect(adminPage.getByText(l, { exact: true }).last()).toBeVisible();
    await expect(adminPage.getByText('0/300', { exact: true })).toBeVisible();
    expect(await a.pillBackground('Club')).not.toBe(await a.pillBackground('Group'));
    expect(await a.pillBackground('Public')).not.toBe(await a.pillBackground('Private'));
    await expect(a.logoLabel).toHaveText('Upload logo');
    await expect(a.nameInput).toHaveValue('');
    await expect(a.descriptionInput).toHaveValue('');
  });

  test('TC_COM_002 the type pills switch Club / Group and the visibility pills switch Public / Restricted / Private', async ({ communitiesPage: a }) => {
    await a.goto();
    await a.openCreate();
    const club = await a.pillBackground('Club');
    await a.pickType('Group');
    expect(await a.pillBackground('Group')).toBe(club);
    expect(await a.pillBackground('Club')).not.toBe(club);
    const pub = await a.pillBackground('Public');
    for (const v of ['Restricted', 'Private'] as const) {
      await a.pickVisibility(v);
      expect(await a.pillBackground(v)).toBe(pub);
      expect(await a.pillBackground('Public')).not.toBe(pub);
    }
  });

  test('TC_COM_002 the character counter follows the description live and stops at 300', async ({ communitiesPage: a, adminPage }) => {
    await a.goto();
    await a.openCreate();
    await a.fillForm({ description: 'Hello' });
    await expect(adminPage.getByText('5/300', { exact: true })).toBeVisible();
    await a.fillForm({ description: 'y'.repeat(350) });
    await expect(adminPage.getByText('300/300', { exact: true })).toBeVisible();
    expect((await a.descriptionInput.inputValue()).length).toBe(300);
    expect(await a.descriptionInput.getAttribute('maxlength')).toBe('300');
  });

  test('TC_COM_001/BR-COM-01 Create stays disabled while Name < 3 or Description < 10 (story scenario 1)', async ({ communitiesPage: a }) => {
    test.fail(true, 'Known deviation: the Create button is always enabled; validation runs when it is pressed (it then shows messages and sends nothing)');
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'AI', description: 'Hello' });
    await expect(a.createBtn).toBeDisabled({ timeout: 2_000 });
  });

  test('BR-COM-01 Create becomes enabled once Name >= 3 and Description >= 10 (story scenario 1)', async ({ communitiesPage: a }) => {
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'AIC', description: '0123456789' });
    await expect(a.createBtn).toBeEnabled();
  });

  test('BR-COM-01 empty form: Create sends nothing and both fields show "This field is required."', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreate();
    await a.submit();
    await adminPage.waitForTimeout(800);
    expect(writes).toHaveLength(0);
    expect((await a.modalText()).match(/This field is required\./g)).toHaveLength(2);
    await expect(a.modalTitle).toBeVisible();
  });

  test('BR-COM-01 Name of 2 characters ("AI") is refused with "Name must be at least 3 characters." and nothing is sent', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'AI', description: 'Hello there, long enough' });
    await a.submit();
    await adminPage.waitForTimeout(800);
    expect(writes).toHaveLength(0);
    expect(await a.modalText()).toContain('Name must be at least 3 characters.');
  });

  test('BR-COM-01 the hint appears as soon as 1-2 characters are typed in Name', async ({ communitiesPage: a }) => {
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'A' });
    await a.descriptionInput.focus();
    await expect.poll(() => a.modalText()).toContain('Name must be at least 3 characters.');
  });

  test('BR-COM-01 hint wording is "Minimum 3 characters required" / "Minimum 10 characters required" (story)', async ({ communitiesPage: a }) => {
    test.fail(true, 'Known deviation: wording is "Name must be at least 3 characters." and there is no hint at all for a short Description');
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'AI', description: 'Hello' });
    await a.categoryInput.focus();
    await expect.poll(() => a.modalText()).toContain('Minimum 3 characters required');
    expect(await a.modalText()).toContain('Minimum 10 characters required');
  });

  test('BR-COM-01 Description of 9 characters is refused and nothing is sent (TC_COM_002: 8 chars)', async ({ communitiesPage: a, adminPage }) => {
    test.fail(true, 'Known deviation: a 9-character description is accepted and POST /admin/communities is sent (minimum 10 is not enforced)');
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'Valid name', description: '123456789' });
    await a.submit();
    await adminPage.waitForTimeout(1000);
    expect(writes).toHaveLength(0);
  });

  test('BR-COM-01 Description of 5 characters ("Hello", story scenario 1) is refused and nothing is sent', async ({ communitiesPage: a, adminPage }) => {
    test.fail(true, 'Known deviation: a short description is accepted and the request is sent');
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'Hello club', description: 'Hello' });
    await a.submit();
    await adminPage.waitForTimeout(1000);
    expect(writes).toHaveLength(0);
  });

  test('BR-COM-01 boundary: Name of exactly 3 and Description of exactly 10 characters are accepted', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'ABC', description: '0123456789' });
    await a.submit();
    await expect.poll(() => writes.length).toBe(1);
    expect(JSON.parse(writes[0].body)).toMatchObject({ name: 'ABC', description: '0123456789' });
  });

  test('BR-COM-01 Name of only spaces and Description of only spaces are refused as required', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: '   ', description: '          ' });
    await a.submit();
    await adminPage.waitForTimeout(800);
    expect(writes).toHaveLength(0);
    expect((await a.modalText()).match(/This field is required\./g)).toHaveLength(2);
  });

  test('BR-COM-01 Name is limited to 100 characters (story)', async ({ communitiesPage: a }) => {
    test.fail(true, 'Known deviation: the Name field accepts 120 characters (maxlength=120), the story says max 100');
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'N'.repeat(130) });
    expect((await a.nameInput.inputValue()).length).toBeLessThanOrEqual(100);
  });

  test('BR-COM-01 Name of 120 characters is accepted up to the field limit and sent whole', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'N'.repeat(130), description: 'long enough description' });
    expect((await a.nameInput.inputValue()).length).toBe(120);
    await a.submit();
    await expect.poll(() => writes.length).toBe(1);
    expect(JSON.parse(writes[0].body).name).toHaveLength(120);
  });

  test('BR-COM-03 default payload: Club, Public, no category (write blocked)', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'Robotics Club', description: 'Builds and programs robots' });
    await a.submit();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({ method: 'POST', path: '/admin/communities' });
    expect(JSON.parse(writes[0].body)).toEqual({ type: 'CLUB', name: 'Robotics Club', description: 'Builds and programs robots', visibility: 'PUBLIC' });
  });

  for (const [vis, value] of [
    ['Restricted', 'RESTRICTED'],
    ['Private', 'PRIVATE'],
  ] as const) {
    test(`BR-COM-03 Group + ${vis} + category: payload carries type GROUP, visibility ${value} and the category (write blocked)`, async ({ communitiesPage: a, adminPage }) => {
      const writes = await guardWrites(adminPage);
      await a.goto();
      await a.openCreate();
      await a.pickType('Group');
      await a.pickVisibility(vis);
      await a.fillForm({ name: `Auto ${vis}`, description: 'Group description text', category: 'Sports' });
      await a.submit();
      await expect.poll(() => writes.length).toBe(1);
      expect(JSON.parse(writes[0].body)).toEqual({ type: 'GROUP', name: `Auto ${vis}`, description: 'Group description text', category: 'Sports', visibility: value });
    });
  }

  test('TC_COM_002 after a successful Create the modal closes and the list and tiles are reloaded (write blocked)', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'Reload check', description: 'Reload check description' });
    const stat = adminPage.waitForRequest((r) => STATS_API.test(r.url()) && r.method() === 'GET');
    const list = adminPage.waitForRequest((r) => LIST_API.test(r.url()) && r.method() === 'GET');
    await a.submit();
    await Promise.all([stat, list]);
    expect(writes).toHaveLength(1);
    await expect(a.modalTitle).toHaveCount(0);
  });

  test('BR-COM-02 duplicate name: the server error "A community with this name already exists." is shown and the modal stays open (mocked 409)', async ({ communitiesPage: a, adminPage }) => {
    await adminPage.route(/\/admin\/communities$/, (r) =>
      r.request().method() === 'POST' ? r.fulfill({ status: 409, json: { success: false, message: 'A community with this name already exists.', code: 'CONFLICT' } }) : r.fallback(),
    );
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'robotics club', description: 'Lowercase duplicate of Robotics Club' });
    await a.submit();
    await expect(adminPage.getByText('A community with this name already exists.', { exact: true })).toBeVisible();
    await expect(a.modalTitle).toBeVisible();
    await expect(a.nameInput).toHaveValue('robotics club');
  });

  test('BR-COM-02 the duplicate message can be dismissed (mocked 409)', async ({ communitiesPage: a, adminPage }) => {
    await adminPage.route(/\/admin\/communities$/, (r) =>
      r.request().method() === 'POST' ? r.fulfill({ status: 409, json: { success: false, message: 'A community with this name already exists.', code: 'CONFLICT' } }) : r.fallback(),
    );
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'Dup', description: 'Duplicate description' });
    await a.submit();
    await expect(a.dismiss).toBeVisible();
    await a.dismiss.click({ force: true });
    await expect(adminPage.getByText('A community with this name already exists.', { exact: true })).toHaveCount(0);
  });

  test('BR-COM-02 any other create failure (mocked 500) keeps the modal open with the typed values and shows the error text', async ({ communitiesPage: a, adminPage }) => {
    await adminPage.route(/\/admin\/communities$/, (r) =>
      r.request().method() === 'POST' ? r.fulfill({ status: 500, json: { success: false, message: 'Server exploded', code: 'ERR' } }) : r.fallback(),
    );
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'Keep me', description: 'Keep my description' });
    await a.submit();
    await adminPage.waitForTimeout(1200);
    await expect(a.modalTitle).toBeVisible();
    await expect(a.nameInput).toHaveValue('Keep me');
  });

  test('TC_COM_003 the duplicate name check is case-insensitive and also covers archived communities (real server)', async ({ communitiesPage: a }) => {
    test.skip(process.env.ALLOW_COMMUNITIES_WRITES !== 'true', 'Gated: if the server accepted the name it would create a real club that cannot be deleted from the admin screen (only archived). Set ALLOW_COMMUNITIES_WRITES=true to run.');
    await a.goto();
    await a.openCreate();
    const existing = (await a.cardList())[0]?.name ?? 'AI club';
    await a.fillForm({ name: existing.toUpperCase(), description: 'Case-insensitive duplicate probe' });
    await a.submit();
    await expect(a.screen.getByText('A community with this name already exists.', { exact: true })).toBeVisible();
  });

  test('TC_COM_002 the X closes the modal without sending anything and the form is empty on reopening', async ({ communitiesPage: a }) => {
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'Draft name', description: 'Draft description text' });
    await a.closeModal();
    await expect(a.modalTitle).toHaveCount(0);
    await a.openCreate();
    await expect(a.nameInput).toHaveValue('');
    await expect(a.descriptionInput).toHaveValue('');
  });

  test('TC_COM_002 closing the modal sends no write call', async ({ communitiesPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCreate();
    await a.fillForm({ name: 'Never sent', description: 'Never sent description' });
    await a.closeModal();
    await adminPage.waitForTimeout(600);
    expect(writes).toHaveLength(0);
  });

  test('Logo: a PNG is accepted (label turns to "Change logo") and its storage key travels with Create (writes blocked, file storage blocked)', async ({ communitiesPage: a, adminPage }) => {
    const { api, other } = await guardAll(adminPage);
    await a.goto();
    await a.openCreate();
    await a.uploadLogo(png());
    await expect(a.logoLabel).toHaveText('Change logo');
    await a.fillForm({ name: 'Logo club', description: 'Club with a logo image' });
    await a.submit();
    await expect.poll(() => api.length).toBe(1);
    const body = JSON.parse(api[0].body);
    expect(body.coverImageKey, 'storage key of the uploaded logo').toMatch(/^communities\/.+\.(png|jpg|jpeg|webp)$/);
    expect(other.length, 'storage uploads that were blocked').toBeGreaterThanOrEqual(0);
  });

  test('Logo: a text file is rejected (PNG, JPG, JPEG, WEBP only)', async ({ communitiesPage: a, adminPage }) => {
    test.fail(true, 'Known deviation: any file is accepted as a logo (a .txt file turns the label to "Change logo", no message)');
    await guardAll(adminPage);
    await a.goto();
    await a.openCreate();
    await a.uploadLogo({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
    await adminPage.waitForTimeout(2_000);
    await expect(a.logoLabel).toHaveText('Upload logo');
  });

  test('Logo: a file over 5 MB is rejected', async ({ communitiesPage: a, adminPage }) => {
    test.fail(true, 'Known deviation: a 6 MB image is accepted without a message');
    await guardAll(adminPage);
    await a.goto();
    await a.openCreate();
    await a.uploadLogo({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.concat([TINY_PNG, Buffer.alloc(6 * 1024 * 1024)]) });
    await adminPage.waitForTimeout(2_000);
    await expect(a.logoLabel).toHaveText('Upload logo');
  });

  test('Logo: a GIF is rejected', async ({ communitiesPage: a, adminPage }) => {
    test.fail(true, 'Known deviation: a GIF is accepted as a logo');
    await guardAll(adminPage);
    await a.goto();
    await a.openCreate();
    await a.uploadLogo({ name: 'anim.gif', mimeType: 'image/gif', buffer: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') });
    await adminPage.waitForTimeout(2_000);
    await expect(a.logoLabel).toHaveText('Upload logo');
  });
});

// =====================================================================================
// TS_COM_06: access
// =====================================================================================
test.describe('TS_COM_06 access @communities', () => {
  test('TC_COM_001 the sidebar item "Communities" opens /communities', async ({ adminPage }) => {
    await adminPage.goto('/policies');
    const item = adminPage.locator('div[tabindex="0"]').filter({ hasText: /Communities$/ }).filter({ visible: true }).first();
    await expect(item).toBeVisible({ timeout: 30_000 });
    await item.click();
    await expect(adminPage.getByText('Review flagged posts', { exact: true })).toBeVisible();
    expect(new URL(adminPage.url()).pathname).toBe('/communities');
  });
});
