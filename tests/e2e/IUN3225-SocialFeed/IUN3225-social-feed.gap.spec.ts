import { test, expect } from '@fixtures';
import { guardWrites } from '@utils/helpers/guard-writes';

/**
 * Social Feed: gap review against story IUN-3225 (BR-01 .. BR-05, scenarios 1 to 5, TC_SF_001 .. 008).
 * Adds what the sheet-based spec did not exercise: how a post that already has reactions and comments is DRAWN
 * (totals, per-reaction counts, the viewer's own reaction highlighted, comment count) and that the feed is paged.
 * Post data is mocked with the field names of the real API (GET /social-feed).
 */
test.use({ viewport: { width: 1440, height: 900 } });

type Row = Record<string, unknown>;
/** A post shaped like the real ones: cloned from a real QA post (so type fields are right), then overridden. */
const post = (base: Row, i: number, over: Row = {}): Row => ({
  ...base,
  id: 5000 + i,
  body: `Post ${i}`,
  createdByName: `Author ${i}`,
  reactions: {},
  totalReactions: 0,
  currentUserReaction: null,
  commentsCount: 0,
  reportCount: 0,
  reportedByCurrentUser: false,
  ...over,
});
const envelope = (rows: unknown[], total = rows.length, page = 0) => ({
  success: true,
  message: 'ok',
  code: 'OK',
  data: { totalElements: total, totalPages: Math.max(1, Math.ceil(total / 20)), number: page, size: 20, content: rows, first: page === 0, last: (page + 1) * 20 >= total },
});
const FEED = /\/social-feed\?/;

/** Loads the real feed once to copy a real post, then serves `build(base)` for every later feed request. */
async function openWith(f: import('@pages/SocialFeedPage').SocialFeedPage, page: import('@playwright/test').Page, build: (base: Row) => unknown[], total?: number): Promise<void> {
  const real = page.waitForResponse((r) => FEED.test(r.url()) && r.request().method() === 'GET');
  await f.goto();
  const base = ((await (await real).json()) as { data: { content: Row[] } }).data.content[0];
  await page.route(FEED, (route) => (route.request().method() === 'GET' ? route.fulfill({ json: envelope(build(base), total) }) : route.fallback()));
  await f.goto();
}

test.describe('IUN-3225 gap review: how a post with engagement is drawn @social-feed', () => {
  test('the total reactions and the comment count are shown on the post', async ({ socialFeedPage: f, adminPage }) => {
    await openWith(f, adminPage, (base) => [post(base, 1, { reactions: { LIKE: 2, LOVE: 1 }, totalReactions: 3, commentsCount: 2 })]);
    await expect(adminPage.getByText('2 comments', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('3', { exact: true }).first()).toBeVisible();
  });

  test('a post with one comment uses the singular wording', async ({ socialFeedPage: f, adminPage }) => {
    await openWith(f, adminPage, (base) => [post(base, 1, { commentsCount: 1 })]);
    await expect(adminPage.getByText('1 comment', { exact: true })).toBeVisible();
  });

  test('each reaction pill shows its own count and the others show none', async ({ socialFeedPage: f, adminPage }) => {
    await openWith(f, adminPage, (base) => [post(base, 1, { reactions: { LIKE: 2, LOVE: 1 }, totalReactions: 3 })]);
    await expect(f.deleteButtons.first()).toBeVisible();
    const counts = await adminPage.evaluate(() => {
      const pill = (emoji: string) => {
        // The same emoji also appears in the summary row above; the pill is the lowest copy.
        const copies = Array.from(document.querySelectorAll<HTMLElement>('div')).filter((d) => d.children.length === 0 && d.innerText.trim() === emoji);
        const el = copies.sort((a, b) => b.getBoundingClientRect().y - a.getBoundingClientRect().y)[0];
        return el?.parentElement?.innerText.replace(emoji, '').trim() ?? null;
      };
      return { like: pill('👍'), love: pill('❤️'), celebrate: pill('🎉') };
    });
    expect(counts.like).toBe('2');
    expect(counts.love).toBe('1');
    expect(counts.celebrate).toBe('');
  });

  test("the viewer's own reaction is highlighted", async ({ socialFeedPage: f, adminPage }) => {
    await openWith(f, adminPage, (base) => [post(base, 1, { reactions: { LIKE: 2, LOVE: 1 }, totalReactions: 3, currentUserReaction: 'LIKE' })]);
    await expect(f.deleteButtons.first()).toBeVisible();
    const style = (emoji: string) =>
      adminPage.evaluate((e) => {
        const el = Array.from(document.querySelectorAll<HTMLElement>('div')).find((d) => d.children.length === 0 && d.innerText.trim() === e && d.getBoundingClientRect().y > 380);
        let node = el?.parentElement ?? null;
        for (let i = 0; i < 3 && node; i++, node = node.parentElement) {
          const cs = getComputedStyle(node);
          if (cs.borderTopWidth !== '0px' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)') return `${cs.backgroundColor}|${cs.borderTopColor}`;
        }
        return '';
      }, emoji);
    const own = await style('👍');
    const other = await style('💡');
    expect(own, 'the chosen reaction is drawn differently from an unchosen one').not.toBe(other);
  });

  test('tapping a reaction sends that reaction for that post', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await openWith(f, adminPage, (base) => [post(base, 1)]);
    await expect(f.deleteButtons.first()).toBeVisible();
    await f.reaction('💡').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].path).toBe('/posts/5001/react');
    expect(JSON.parse(writes[0].body)).toEqual({ reactionType: expect.any(String) });
  });

  test('a post by someone else and by the admin both show the delete icon (BR-02)', async ({ socialFeedPage: f, adminPage }) => {
    await openWith(f, adminPage, (base) => [post(base, 1), post(base, 2, { createdByName: 'Isha Kanta Walia' })]);
    await expect(f.deleteButtons).toHaveCount(2);
  });
});

test.describe('IUN-3225 gap review: paging @social-feed', () => {
  test('the feed asks the API for the first page of 20', async ({ socialFeedPage: f, adminPage }) => {
    const request = adminPage.waitForRequest((r) => FEED.test(r.url()));
    await f.goto();
    expect((await request).url()).toMatch(/page=0&size=20/);
  });

  test('posts beyond the first 20 are reachable (second page is requested)', async ({ socialFeedPage: f, adminPage }) => {
    test.fail(true, 'Suspected: with 25 posts only 20 are shown and page 2 is not requested after scrolling to the end (needs confirmation by the team)');
    const pages: number[] = [];
    const real = adminPage.waitForResponse((r) => FEED.test(r.url()) && r.request().method() === 'GET');
    await f.goto();
    const base = ((await (await real).json()) as { data: { content: Row[] } }).data.content[0];
    await adminPage.route(FEED, (route) => {
      const page = Number(/page=(\d+)/.exec(route.request().url())?.[1] ?? 0);
      pages.push(page);
      return route.fulfill({ json: envelope(Array.from({ length: page === 0 ? 20 : 5 }, (_, i) => post(base, page * 20 + i + 1)), 25, page) });
    });
    await f.goto();
    await expect(f.deleteButtons.first()).toBeVisible();
    await adminPage.getByText('Post 20', { exact: true }).scrollIntoViewIfNeeded();
    await adminPage.waitForTimeout(2_500);
    expect(pages, 'pages requested').toContain(1);
  });
});
