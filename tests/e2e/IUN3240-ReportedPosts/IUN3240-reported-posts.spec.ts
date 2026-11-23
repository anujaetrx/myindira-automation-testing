import type { Page } from '@playwright/test';
import { test as base, expect } from '@fixtures';
import { ReportedPostsPage, REPORTED_API, guardWrites, pageResponse, type CapturedWrite, type ReportedPost } from '@pages/ReportedPostsPage';

/**
 * Reported Posts test cases for story IUN-3240 (rules BR-RP-01 .. BR-RP-04, scenarios 1 .. 5, TC_RP_001 .. TC_RP_008).
 * Titles start with the story's TC id; ids that are not in the story's table use TC_RP_1xx (extra, by this suite).
 * Results and open questions: docs/test-cases/reported-posts.md
 *
 * QA currently holds ZERO reported posts, so every situation with cards is produced by replacing the list call
 * (GET /admin/reported-posts) with hand-built JSON shaped like the real API (fields read from the app's own code:
 * id, title, body, createdByName, createdAt, reportCount).
 *
 * SAFETY: nothing here changes data on QA. Every delete click runs behind guardWrites(): the call is answered
 * locally and recorded, and the test asserts what the screen SENT. The one test that really flags and deletes a
 * post is gated (ALLOW_REPORTED_WRITES=true) and was not run.
 *
 * Known deviations use test.fail(): green in the run, red when the app is fixed (then remove the marker).
 */
const WRITES_ALLOWED = process.env.ALLOW_REPORTED_WRITES === 'true';

const test = base.extend<{ reported: ReportedPostsPage }>({
  reported: async ({ adminPage }, use) => use(new ReportedPostsPage(adminPage)),
});

// ---- hand-built API data ----
const minutesAgo = (m: number): string => new Date(Date.now() - m * 60_000).toISOString();

function post(id: number, over: Partial<ReportedPost> = {}): ReportedPost {
  return {
    id,
    title: `Title ${id}`,
    body: `Body text of post ${id}`,
    createdByName: `Author ${id}`,
    createdAt: minutesAgo(30),
    reportCount: 1,
    ...over,
  };
}

/** Replaces the queue's list call. `rows` is read on every call, so a test can change what the next refetch returns. */
async function mockQueue(page: Page, rows: () => ReportedPost[], totalElements?: () => number): Promise<string[]> {
  const urls: string[] = [];
  await page.route(REPORTED_API, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    urls.push(route.request().url());
    const list = rows();
    const body = pageResponse(list) as { data: Record<string, unknown> };
    if (totalElements) body.data.totalElements = totalElements();
    return route.fulfill({ json: body });
  });
  return urls;
}

/** Rows minus the ones whose DELETE /posts/{id} the screen has already sent (the guarded "server" has deleted them). */
const afterDeletes = (all: ReportedPost[], writes: CapturedWrite[]) => (): ReportedPost[] =>
  all.filter((p) => !writes.some((w) => w.method === 'DELETE' && w.path === `/posts/${p.id}`));

const deleteCalls = (writes: CapturedWrite[]): CapturedWrite[] => writes.filter((w) => w.method === 'DELETE');

// =====================================================================================
// TS_RP_01: navigation, header, counter, empty state (Scenario 1)
// =====================================================================================
test.describe('TS_RP_01 navigation, header and empty state @reported-posts', () => {
  test('TC_RP_001 the sidebar item opens /reported-posts with the flag icon, title and counter', async ({ reported: r, adminPage }) => {
    await adminPage.goto('/dashboard');
    await expect(r.sidebarItem).toBeVisible();
    const queue = await r.queueResponse(() => r.openFromSidebar());
    await expect(adminPage).toHaveURL(/\/reported-posts$/);
    await expect(r.heading).toBeVisible();
    await expect(r.counter).toBeVisible();
    const [red, green] = ((await r.headerIconColor()).match(/\d+/g) ?? ['0', '0', '0']).map(Number);
    expect(red, 'the header flag icon is drawn in red').toBeGreaterThan(green + 80);
    const n = queue.content.length;
    await expect(r.counter).toHaveText(`${n} post${n === 1 ? '' : 's'}`);
  });

  test('TC_RP_001 opening the URL directly also shows the screen (deep link)', async ({ reported: r, adminPage }) => {
    await r.goto();
    await expect(adminPage).toHaveURL(/\/reported-posts$/);
    await expect(r.heading).toBeVisible();
    await expect(r.counter).toBeVisible();
  });

  test('TC_RP_001 the list is requested for page 0 with 50 rows', async ({ reported: r, adminPage }) => {
    const urls = await mockQueue(adminPage, () => []);
    await r.goto();
    expect(urls[0]).toMatch(/\/admin\/reported-posts\?page=0&size=50$/);
  });

  test('TC_RP_002 empty queue shows the checkmark icon, "No reported posts" and the "All clear!" subtext', async ({ reported: r }) => {
    await mockQueue(r.screen, () => []);
    await r.goto();
    await expect(r.emptyTitle).toBeVisible();
    await expect(r.emptySubtitle).toBeVisible();
    expect(await r.emptyIconColor(), 'a checkmark glyph is drawn in the empty state').not.toBe('');
    const weight = await r.emptyTitle.evaluate((e) => Number(getComputedStyle(e).fontWeight));
    expect(weight, 'the heading is bold').toBeGreaterThanOrEqual(600);
  });

  test('TC_RP_002 the checkmark icon is drawn in the theme colour (teal, not red)', async ({ reported: r }) => {
    await mockQueue(r.screen, () => []);
    await r.goto();
    const [red, green, blue] = ((await r.emptyIconColor()).match(/\d+/g) ?? ['0', '0', '0']).map(Number);
    expect(green, `green/teal channel clearly above red (${red},${green},${blue})`).toBeGreaterThan(red + 60);
  });

  test('TC_RP_003 counter reads exactly "0 posts" when the queue is empty', async ({ reported: r }) => {
    await mockQueue(r.screen, () => []);
    await r.goto();
    await expect(r.counter).toHaveText('0 posts');
  });

  test('TC_RP_003 the empty state has no cards, report badges or delete buttons left over (zero count handling)', async ({ reported: r }) => {
    await mockQueue(r.screen, () => []);
    await r.goto();
    await expect(r.emptyTitle).toBeVisible();
    await expect(r.deleteButtons).toHaveCount(0);
    await expect(r.reportBadges).toHaveCount(0);
    await expect(r.errorText).toBeHidden();
  });

  test('TC_RP_003 counter equals the number of entries the API returns (real QA data)', async ({ reported: r }) => {
    const queue = await r.queueResponse(() => r.goto());
    const n = queue.content.length;
    await expect(r.counter).toHaveText(`${n} post${n === 1 ? '' : 's'}`);
    await expect(r.deleteButtons).toHaveCount(n);
    if (n === 0) await expect(r.emptyTitle).toBeVisible();
    else await expect(r.emptyTitle).toBeHidden();
  });

  test('TC_RP_103 no "All clear!" text and no counter while the list is still loading', async ({ reported: r, adminPage }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await adminPage.route(REPORTED_API, async (route) => {
      await gate;
      return route.fulfill({ json: pageResponse([post(1)]) });
    });
    await adminPage.goto('/reported-posts');
    await expect(adminPage.getByText('Loading', { exact: false })).toHaveCount(0);
    await expect(r.emptyTitle).toBeHidden();
    await expect(r.emptySubtitle).toBeHidden();
    await expect(r.counter).toBeHidden();
    release();
    await expect(r.counter).toHaveText('1 post');
  });
});

// =====================================================================================
// TS_RP_02: queue cards (Scenario 2, BR-RP-01)
// =====================================================================================
test.describe('TS_RP_02 queue cards @reported-posts', () => {
  test('TC_RP_004 flagged posts appear as cards with author, time, title and body snippet; counter matches', async ({ reported: r }) => {
    await mockQueue(r.screen, () => [
      post(11, { createdByName: 'Asha Rao', title: 'Campus rules', body: 'First reported body', reportCount: 2, createdAt: minutesAgo(5) }),
      post(12, { createdByName: 'Vikram Sethi', title: 'Second title', body: 'Second reported body', reportCount: 1, createdAt: minutesAgo(180) }),
      post(13, { createdByName: 'Meera Nair', title: 'Third title', body: 'Third reported body', reportCount: 7, createdAt: minutesAgo(60 * 24 * 3) }),
    ]);
    await r.goto();
    await expect(r.counter).toHaveText('3 posts');
    await expect(r.deleteButtons).toHaveCount(3);
    for (const t of ['Asha Rao', 'Campus rules', 'First reported body', 'Vikram Sethi', 'Second title', 'Second reported body', 'Meera Nair', 'Third title', 'Third reported body']) {
      await expect(r.text(t), `card text "${t}"`).toBeVisible();
    }
    await expect(r.emptyTitle).toBeHidden();
  });

  test('TC_RP_004 cards are listed in the order the API returns them', async ({ reported: r }) => {
    await mockQueue(r.screen, () => [post(21, { createdByName: 'Zed Last' }), post(22, { createdByName: 'Amy First' }), post(23, { createdByName: 'Mid Person' })]);
    await r.goto();
    await expect(r.deleteButtons).toHaveCount(3);
    const order = await r.screen.evaluate(() =>
      ['Zed Last', 'Amy First', 'Mid Person'].map((n) => {
        const el = Array.from(document.querySelectorAll<HTMLElement>('div')).find((d) => d.children.length === 0 && d.innerText === n);
        return el ? el.getBoundingClientRect().y : -1;
      }),
    );
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });

  test('TC_RP_104 each card shows its report count, "1 report" singular and "N reports" plural', async ({ reported: r }) => {
    await mockQueue(r.screen, () => [post(31, { reportCount: 1 }), post(32, { reportCount: 2 }), post(33, { reportCount: 12 })]);
    await r.goto();
    await expect(r.reportBadges).toHaveText(['1 report', '2 reports', '12 reports']);
  });

  test('TC_RP_105 time since posting is shown as Just now / Xm / Xh / Xd ago and as a date after a week', async ({ reported: r }) => {
    const old = new Date(Date.now() - 20 * 24 * 3600_000);
    await mockQueue(r.screen, () => [
      post(41, { createdAt: new Date().toISOString() }),
      post(42, { createdAt: minutesAgo(45) }),
      post(43, { createdAt: minutesAgo(60 * 5 + 10) }),
      post(44, { createdAt: minutesAgo(60 * 24 * 2 + 10) }),
      post(45, { createdAt: old.toISOString() }),
    ]);
    await r.goto();
    await expect(r.deleteButtons).toHaveCount(5);
    await expect(r.text('Just now')).toBeVisible();
    await expect(r.text('45m ago')).toBeVisible();
    await expect(r.text('5h ago')).toBeVisible();
    await expect(r.text('2d ago')).toBeVisible();
    await expect(r.text(old.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))).toBeVisible();
  });

  test('TC_RP_106 a post without a title renders body and author only', async ({ reported: r }) => {
    await mockQueue(r.screen, () => [post(51, { title: null, body: 'Untitled body', createdByName: 'No Title Person' })]);
    await r.goto();
    await expect(r.text('Untitled body')).toBeVisible();
    await expect(r.text('No Title Person')).toBeVisible();
    await expect(r.text('null')).toHaveCount(0);
    await expect(r.text('undefined')).toHaveCount(0);
  });

  test('TC_RP_107 a long body is clamped to a short snippet (4 lines) instead of stretching the card', async ({ reported: r }) => {
    test.fail(true, 'The body is shown in full (60 words = 9 lines): the 4-line clamp the code asks for is not applied on the web build');
    const long = Array.from({ length: 60 }, (_, i) => `sentence${i}`).join(' ');
    await mockQueue(r.screen, () => [post(61, { body: long })]);
    await r.goto();
    await expect(r.deleteButtons).toHaveCount(1);
    expect(await r.bodyHeight('sentence0'), 'body block found').toBeGreaterThan(0);
    expect(await r.bodyHeight('sentence0'), 'at most 4 lines of 20px').toBeLessThanOrEqual(90);
  });

  test('TC_RP_108 markdown in the body is rendered, not shown as raw symbols', async ({ reported: r }) => {
    await mockQueue(r.screen, () => [post(71, { body: 'Some **bold words** here' })]);
    await r.goto();
    await expect(r.text(/bold words/)).toBeVisible();
    await expect(r.text('**')).toHaveCount(0);
  });

  test('TC_RP_109 HTML in a reported post is shown as text and never executed', async ({ reported: r, adminPage }) => {
    await mockQueue(adminPage, () => [post(81, { title: '<b>Title</b>', body: '<img src=x onerror="window.__xss=1"> <script>window.__xss=2</script>' })]);
    await r.goto();
    await expect(r.deleteButtons).toHaveCount(1);
    expect(await adminPage.evaluate(() => (window as unknown as { __xss?: number }).__xss), 'no script ran').toBeUndefined();
  });

  test('TC_RP_110 unicode, emoji and very long author names render without breaking the card', async ({ reported: r }) => {
    const long = 'Bartholomew '.repeat(12).trim();
    await mockQueue(r.screen, () => [post(91, { createdByName: 'Ananya Iyer 🙂', body: 'नमस्ते दोस्तों 👋' }), post(92, { createdByName: long })]);
    await r.goto();
    await expect(r.text('Ananya Iyer 🙂')).toBeVisible();
    await expect(r.text('नमस्ते दोस्तों 👋')).toBeVisible();
    await expect(r.deleteButtons).toHaveCount(2);
    const overflow = await r.screen.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, 'no horizontal page scroll').toBe(false);
  });

  test('TC_RP_004 a post flagged after the page was first opened shows up on the next visit (reload)', async ({ reported: r }) => {
    let rows: ReportedPost[] = [];
    await mockQueue(r.screen, () => rows);
    await r.goto();
    await expect(r.counter).toHaveText('0 posts');
    rows = [post(101, { createdByName: 'Late Reporter Target' })];
    await r.reload();
    await expect(r.counter).toHaveText('1 post');
    await expect(r.text('Late Reporter Target')).toBeVisible();
  });

  test('TC_RP_004 coming back to the screen from another page picks up a newly flagged post', async ({ reported: r, adminPage }) => {
    let rows: ReportedPost[] = [];
    await mockQueue(adminPage, () => rows);
    await r.goto();
    await expect(r.counter).toHaveText('0 posts');
    await adminPage.goto('/dashboard');
    await expect(r.sidebarItem).toBeVisible();
    rows = [post(102, { createdByName: 'Flagged While Away' })];
    await r.openFromSidebar();
    await expect(r.counter).toHaveText('1 post');
  });

  test('TC_RP_004 the counter says "1 posts" for one post, as the story and the sheet write it', async ({ reported: r }) => {
    test.fail(true, 'The app pluralises correctly ("1 post"); the story and TC_RP_004 literally say "1 posts"');
    await mockQueue(r.screen, () => [post(111)]);
    await r.goto();
    await expect(r.counter).toHaveText('1 posts');
  });

  test('TC_RP_004 each card shows who reported it and the violation reason', async ({ reported: r }) => {
    test.fail(true, 'Cards only show the author and a report COUNT: no reporter name, no reason (the API list has neither)');
    await mockQueue(r.screen, () => [post(121)]);
    await r.goto();
    await expect(r.deleteButtons).toHaveCount(1);
    await expect(r.text(/reported by|reporter|reason/i).first()).toBeVisible();
  });

  test('TC_RP_003 counter equals the total of pending reports when more than one page exists', async ({ reported: r }) => {
    test.fail(true, 'The counter counts the rows loaded (50 max, no paging) instead of the total: 120 pending shows "50 posts"');
    const rows = Array.from({ length: 50 }, (_, i) => post(200 + i));
    await mockQueue(r.screen, () => rows, () => 120);
    await r.goto();
    await expect(r.deleteButtons).toHaveCount(50);
    await expect(r.counter).toHaveText('120 posts');
  });
});

// =====================================================================================
// TS_RP_03: moderation actions (Scenarios 3 and 4, BR-RP-02, BR-RP-04)
// =====================================================================================
test.describe('TS_RP_03 moderation actions @reported-posts', () => {
  test('TC_RP_005 each card has a "Dismiss Report" action', async ({ reported: r }) => {
    test.fail(true, 'No "Dismiss Report" / Approve button exists: the only action on a card is the trash icon (Delete post). Dismiss (BR-RP-02, Scenario 3) is missing');
    await mockQueue(r.screen, () => [post(301)]);
    await r.goto();
    await expect(r.deleteButtons).toHaveCount(1);
    await expect(r.text(/dismiss report/i).first()).toBeVisible();
  });

  test('TC_RP_005 dismissing a report sends the dismiss call and removes the card', async ({ reported: r, adminPage }) => {
    test.fail(true, 'No Dismiss action in the app (see the test above), so nothing can be sent');
    const writes = await guardWrites(adminPage);
    await mockQueue(adminPage, afterDeletes([post(302)], writes));
    await r.goto();
    await adminPage.getByText(/dismiss report/i).first().click({ timeout: 3_000 });
    expect(writes.filter((w) => /report|dismiss/i.test(w.path)), 'a dismiss request').toHaveLength(1);
  });

  test('BR-RP-02 only Dismiss and Delete exist: there is no Warn User / Suspend action', async ({ reported: r }) => {
    await mockQueue(r.screen, () => [post(303)]);
    await r.goto();
    await expect(r.deleteButtons).toHaveCount(1);
    await expect(r.warnControls).toHaveCount(0);
  });

  test('TC_RP_006 Delete post asks for confirmation naming the author', async ({ reported: r, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await mockQueue(adminPage, afterDeletes([post(311, { createdByName: 'Rohan Gupta' })], writes));
    await r.goto();
    const message = await r.deleteAndAnswer(0, false);
    expect(message).toBe('Delete this post by Rohan Gupta? This action cannot be undone.');
  });

  test('TC_RP_006 cancelling the confirmation keeps the post and sends nothing', async ({ reported: r, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await mockQueue(adminPage, afterDeletes([post(312), post(313)], writes));
    await r.goto();
    await r.deleteAndAnswer(0, false);
    await expect(r.deleteButtons).toHaveCount(2);
    await expect(r.counter).toHaveText('2 posts');
    expect(writes, 'no write request after Cancel').toHaveLength(0);
  });

  test('TC_RP_006 confirming sends DELETE /posts/{id} (no body) and the card leaves the queue', async ({ reported: r, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await mockQueue(adminPage, afterDeletes([post(321, { createdByName: 'Keep One' }), post(322, { createdByName: 'Remove Two' }), post(323, { createdByName: 'Keep Three' })], writes));
    await r.goto();
    await expect(r.counter).toHaveText('3 posts');
    await r.deleteAndAnswer(1, true);
    await expect(r.counter).toHaveText('2 posts');
    await expect(r.deleteButtons).toHaveCount(2);
    await expect(r.text('Remove Two')).toHaveCount(0);
    await expect(r.text('Keep One')).toBeVisible();
    await expect(r.text('Keep Three')).toBeVisible();
    const sent = deleteCalls(writes);
    expect(sent, 'exactly one DELETE').toHaveLength(1);
    expect(sent[0].path).toBe('/posts/322');
    expect(sent[0].body).toBe('');
    expect(writes, 'nothing else was written').toHaveLength(1);
  });

  test('TC_RP_006 deleting the first and then the last card each removes exactly that card', async ({ reported: r, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await mockQueue(adminPage, afterDeletes([post(331, { createdByName: 'Person A' }), post(332, { createdByName: 'Person B' }), post(333, { createdByName: 'Person C' })], writes));
    await r.goto();
    await r.deleteAndAnswer(0, true);
    await expect(r.counter).toHaveText('2 posts');
    await r.deleteAndAnswer(1, true);
    await expect(r.counter).toHaveText('1 post');
    await expect(r.text('Person B')).toBeVisible();
    expect(deleteCalls(writes).map((w) => w.path)).toEqual(['/posts/331', '/posts/333']);
  });

  test('TC_RP_006 the delete call is a normal post delete, so the post leaves the feeds (queue only reads, never edits)', async ({ reported: r, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await mockQueue(adminPage, afterDeletes([post(341)], writes));
    await r.goto();
    await r.deleteAndAnswer(0, true);
    await expect(r.emptyTitle).toBeVisible();
    expect(deleteCalls(writes)[0]).toMatchObject({ method: 'DELETE', path: '/posts/341' });
    expect(writes.some((w) => w.method !== 'DELETE'), 'no PUT/POST/PATCH').toBe(false);
  });

  test('TC_RP_007 resolving the last post switches to the empty state without a page reload', async ({ reported: r, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await mockQueue(adminPage, afterDeletes([post(351)], writes));
    await r.goto();
    await expect(r.counter).toHaveText('1 post');
    await r.markWindow();
    await r.deleteAndAnswer(0, true);
    await expect(r.counter).toHaveText('0 posts');
    await expect(r.emptyTitle).toBeVisible();
    await expect(r.emptySubtitle).toBeVisible();
    await expect(r.deleteButtons).toHaveCount(0);
    await expect(r.reportBadges).toHaveCount(0);
    await expect(r.errorText).toBeHidden();
    expect(await r.windowKept(), 'window object survived: no full reload').toBe(true);
    await expect(adminPage).toHaveURL(/\/reported-posts$/);
  });

  test('TC_RP_111 a failed delete (500) leaves the post in the queue and the counter unchanged', async ({ reported: r, adminPage }) => {
    await guardWrites(adminPage);
    await mockQueue(adminPage, () => [post(361, { createdByName: 'Stays Put' })]);
    let calls = 0;
    await adminPage.route(/\/myindiranew\/api\/posts\/361$/, (route) => {
      calls++;
      return route.fulfill({ status: 500, json: { success: false, message: 'Something went wrong', code: 'GEN_500', data: null } });
    });
    await r.goto();
    await r.deleteAndAnswer(0, true);
    await expect.poll(() => calls).toBe(1);
    await expect(r.counter).toHaveText('1 post');
    await expect(r.text('Stays Put')).toBeVisible();
    await expect(r.emptyTitle).toBeHidden();
  });

  test('TC_RP_112 a failed delete tells the admin that it failed', async ({ reported: r, adminPage }) => {
    test.fail(true, 'A failed delete (500) is silent: no message, the admin cannot tell the post was not removed');
    await guardWrites(adminPage);
    await mockQueue(adminPage, () => [post(362)]);
    await adminPage.route(/\/myindiranew\/api\/posts\/362$/, (route) => route.fulfill({ status: 500, json: { success: false, message: 'Something went wrong', code: 'GEN_500', data: null } }));
    await r.goto();
    await r.deleteAndAnswer(0, true);
    await expect(r.text(/failed|error|could not|try again/i).first()).toBeVisible({ timeout: 3_000 });
  });

  test('TC_RP_113 deleting a post that is already gone (404) refreshes the queue without crashing', async ({ reported: r, adminPage }) => {
    await guardWrites(adminPage);
    await mockQueue(adminPage, () => [post(363), post(364, { createdByName: 'Still Here' })]);
    await adminPage.route(/\/myindiranew\/api\/posts\/363$/, (route) => route.fulfill({ status: 404, json: { success: false, message: 'Post not found', code: 'NOT_FOUND', data: null } }));
    await r.goto();
    await r.deleteAndAnswer(0, true);
    await expect(r.text('Still Here')).toBeVisible();
    await expect(r.heading).toBeVisible();
    await expect(r.errorText).toBeHidden();
  });

  test('BR-RP-04 deleting a reported post is recorded in the audit log (Admin ID, Post ID, resolution, timestamp)', async ({ reported: r, adminPage }) => {
    test.fail(true, 'The Audit Log screen (/audit-log) cannot load: GET /admin/audit-logs answers 500 "could not initialize proxy ... no Session", so no moderation entry can ever be seen');
    await adminPage.goto('/audit-log');
    const res = await adminPage.waitForResponse((x) => /\/admin\/audit-logs/.test(x.url()));
    expect(res.status()).toBe(200);
    await expect(r.text('No audit logs found')).toHaveCount(0);
  });
});

// =====================================================================================
// TS_RP_04: error handling (validation "Data Fetch Error Fallback")
// =====================================================================================
test.describe('TS_RP_04 error and access handling @reported-posts', () => {
  test('TC_RP_114 a failing list call shows an error and never the false "All clear!"', async ({ reported: r, adminPage }) => {
    await adminPage.route(REPORTED_API, (route) => route.fulfill({ status: 500, json: { success: false, message: 'Something went wrong', code: 'GEN_500', data: null } }));
    await r.goto();
    await expect(r.errorText).toBeVisible();
    await expect(r.emptyTitle).toBeHidden();
    await expect(r.emptySubtitle).toBeHidden();
    await expect(r.counter).toBeHidden();
  });

  test('TC_RP_114 a network failure also shows the error and not "All clear!"', async ({ reported: r, adminPage }) => {
    await adminPage.route(REPORTED_API, (route) => route.abort('failed'));
    await adminPage.goto('/reported-posts');
    await expect(r.errorText).toBeVisible({ timeout: 40_000 }); // the app retries a dropped connection first
    await expect(r.emptyTitle).toBeHidden();
    await expect(r.counter).toBeHidden();
  });

  test('TC_RP_114 the error banner offers a "Retry" action', async ({ reported: r, adminPage }) => {
    test.fail(true, 'The error is plain red text "Failed to load reported posts" with no Retry button (story: error banner with a Retry action)');
    await adminPage.route(REPORTED_API, (route) => route.fulfill({ status: 500, json: { success: false, message: 'x', code: 'GEN_500', data: null } }));
    await r.goto();
    await expect(r.errorText).toBeVisible();
    await expect(r.retryControl.first()).toBeVisible({ timeout: 3_000 });
  });

  test('TC_RP_114 after an error, reloading with a working API shows the queue again', async ({ reported: r, adminPage }) => {
    let failing = true;
    await adminPage.route(REPORTED_API, (route) => (failing ? route.fulfill({ status: 500, json: { success: false, message: 'x', code: 'GEN_500', data: null } }) : route.fulfill({ json: pageResponse([post(401, { createdByName: 'Back Again' })]) })));
    await r.goto();
    await expect(r.errorText).toBeVisible();
    failing = false;
    await r.reload();
    await expect(r.counter).toHaveText('1 post');
    await expect(r.text('Back Again')).toBeVisible();
    await expect(r.errorText).toBeHidden();
  });

  test('TC_RP_008 a rejected request (403 Forbidden) shows no queue data and no counter', async ({ reported: r, adminPage }) => {
    await adminPage.route(REPORTED_API, (route) => route.fulfill({ status: 403, json: { success: false, message: 'Access denied', code: 'FORBIDDEN', data: null } }));
    await r.goto();
    await expect(r.errorText).toBeVisible();
    await expect(r.counter).toBeHidden();
    await expect(r.deleteButtons).toHaveCount(0);
    await expect(r.emptyTitle).toBeHidden();
  });

  test('TC_RP_008 a rejected request (403) is reported as access denied', async ({ reported: r, adminPage }) => {
    test.fail(true, 'A 403 shows the generic "Failed to load reported posts": no "access denied" / unauthorized notification (and the real non-admin redirect cannot be tried: no student account)');
    await adminPage.route(REPORTED_API, (route) => route.fulfill({ status: 403, json: { success: false, message: 'Access denied', code: 'FORBIDDEN', data: null } }));
    await r.goto();
    await expect(r.text(/access denied|forbidden|not authori[sz]ed|403/i).first()).toBeVisible({ timeout: 3_000 });
  });
});

// =====================================================================================
// TS_RP_05: end-to-end with real writes (gated)
// =====================================================================================
test.describe('TS_RP_05 real flag and delete @reported-posts', () => {
  test('TC_RP_900 a post reported through the API shows in the queue and is removed by Delete post (real writes)', async ({ reported: r, adminPage }) => {
    test.skip(!WRITES_ALLOWED, 'Writes data on QA: set ALLOW_REPORTED_WRITES=true to run. Creates one post, reports it, deletes it; not run by the author.');
    // The app's own token is captured from its requests (never logged) and reused for two setup calls.
    let auth = '';
    adminPage.on('request', (q) => {
      if (/\/myindiranew\/api\//.test(q.url()) && q.headers()['authorization']) auth = q.headers()['authorization'];
    });
    await r.goto();
    expect(auth, 'the app has sent an authorised request').not.toBe('');
    const base = new URL(adminPage.url()).origin + '/myindiranew/api';
    const headers = { authorization: auth, 'content-type': 'application/json' };
    const marker = `AUTOTEST reported ${Date.now()}`;
    const created = await adminPage.request.post(`${base}/social-feed`, { headers, data: { body: marker } });
    expect(created.ok()).toBe(true);
    const id = ((await created.json()) as { data: { id: number } }).data.id;
    let deleted = false;
    try {
      const reportRes = await adminPage.request.post(`${base}/posts/${id}/report`, { headers, data: { reason: 'AUTOTEST' } });
      expect(reportRes.ok(), 'report call accepted').toBe(true);
      await r.reload();
      await expect(r.text(marker)).toBeVisible();
      await expect(r.reportBadges.first()).toBeVisible();
      await r.deleteAndAnswer(0, true);
      deleted = true;
      await expect(r.text(marker)).toHaveCount(0);
    } finally {
      if (!deleted) await adminPage.request.delete(`${base}/posts/${id}`, { headers });
    }
  });
});
