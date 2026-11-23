import fs from 'node:fs';
import { test, expect } from '@fixtures';
import { guardWrites, pageResponse, type FeedTab } from '@pages/SocialFeedPage';

/**
 * Social Feed test cases from the team's sheet (TC_SF_001 .. TC_SF_043, scenarios TS_SF_01 .. TS_SF_08).
 * Titles start with the sheet's TC id. Rules: story IUN-3225 (BR-01 .. BR-05).
 * Results and open questions: docs/test-cases/social-feed.md
 *
 * SAFETY: nothing here changes data on QA. Every test that clicks a write action (Post, react, comment, delete,
 * tab "mark viewed") first calls guardWrites(): the call is answered locally and recorded, and the test asserts
 * what the screen SENT. The one test that really publishes and deletes a post is gated (ALLOW_FEED_WRITES=true).
 *
 * Known deviations use test.fail(): green in the run, red when the app is fixed (then remove the marker).
 */
const WRITES_ALLOWED = process.env.ALLOW_FEED_WRITES === 'true';
const MB = 1024 * 1024;

test.use({ viewport: { width: 1440, height: 900 } });

// ---- small valid media files (so the app can render a preview), padded to the size a case needs ----
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);
const WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const mp4 = (bytes: number): Buffer => {
  const ftyp = Buffer.alloc(24);
  ftyp.writeUInt32BE(24, 0);
  ftyp.write('ftypisom', 4, 'latin1');
  ftyp.writeUInt32BE(512, 12);
  ftyp.write('isommp41', 16, 'latin1');
  const free = Buffer.alloc(bytes - 24);
  free.writeUInt32BE(bytes - 24, 0);
  free.write('free', 4, 'latin1');
  return Buffer.concat([ftyp, free]);
};
const padTo = (data: Buffer, bytes: number): Buffer => Buffer.concat([data, Buffer.alloc(Math.max(0, bytes - data.length))]);

function makeFile(dir: string, name: string, data: Buffer): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = `${dir}/${name}`;
  fs.writeFileSync(file, data);
  return file;
}

const TABS: FeedTab[] = ['My Feed', 'University', 'Birthdays', 'Communities'];
const REACTIONS = ['👍', '🎉', '❤️', '💡', '🙌'];

// =====================================================================================
// TS_SF_01: tabs
// =====================================================================================
test.describe('TS_SF_01 tabs @social-feed', () => {
  test('TC_SF_001 switching tabs loads each view without a full page reload', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage); // opening a tab records "last viewed" with a POST
    await f.goto();
    await f.markWindow();

    await f.openTab('University');
    await expect(f.universityChip('Announcement')).toBeVisible();
    await f.openTab('Birthdays');
    await expect(f.birthdaysNone.or(f.birthdayHeadline)).toBeVisible();
    await f.openTab('Communities');
    await expect(f.communitiesHeading).toBeVisible();
    await f.openTab('My Feed');
    await expect(f.compose).toBeVisible();
    await expect(adminPage).toHaveURL(/\/feed$/);
    expect(await f.windowKept(), 'window object survived: no full reload').toBe(true);
  });

  test('TC_SF_002 the selected tab is highlighted and the highlight moves with the click', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await f.goto();
    for (const tab of ['University', 'Birthdays', 'My Feed'] as FeedTab[]) {
      await f.openTab(tab);
      await adminPage.waitForTimeout(400); // the highlight animates in
      const colours = await Promise.all(TABS.slice(0, 3).map((t) => f.tabLabelColor(t)));
      const active = colours[TABS.indexOf(tab)];
      expect(colours.filter((c) => c === active), `only "${tab}" has the active colour (${colours.join(' / ')})`).toHaveLength(1);
    }
  });
});

// =====================================================================================
// TS_SF_02: create post
// =====================================================================================
test.describe('TS_SF_02 create post @social-feed', () => {
  test('TC_SF_003 the compose box opens Create Post with text field, Photo, Video and close', async ({ socialFeedPage: f, adminPage }) => {
    await f.goto();
    await f.openCompose();
    await expect(f.text).toBeVisible();
    await expect(adminPage.getByText('Photo', { exact: true }).last()).toBeVisible();
    await expect(adminPage.getByText('Video', { exact: true }).last()).toBeVisible();
    await f.closeModal();
  });

  test('TC_SF_004 the photo and video icons also open the modal, every time', async ({ socialFeedPage: f }) => {
    test.fail(true, 'Clicking the photo or video icon beside the compose box does nothing (no modal, no file picker)');
    await f.goto();
    for (const which of ['photo', 'video', 'photo'] as const) {
      await f.openComposeViaIcon(which);
      await expect(f.modal).toBeVisible();
      await f.closeModal();
    }
  });

  test('TC_SF_005 Post is disabled when text and media are empty', async ({ socialFeedPage: f }) => {
    await f.goto();
    await f.openCompose();
    await expect(f.post).toBeDisabled();
  });

  test('TC_SF_006 whitespace-only text keeps Post disabled', async ({ socialFeedPage: f }) => {
    await f.goto();
    await f.openCompose();
    await f.type('     ');
    await expect(f.post).toBeDisabled();
  });

  test('TC_SF_007 a text-only post is sent and the modal closes', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await f.goto();
    await f.openCompose();
    await f.type('Hello campus');
    await expect(f.post).toBeEnabled();
    await f.submitPost();
    await expect(f.modal).toBeHidden();
    const sent = writes.filter((w) => w.method === 'POST' && w.path === '/social-feed');
    expect(sent, 'one POST /social-feed').toHaveLength(1);
    expect(sent[0].body).toContain('"body":"Hello campus"');
  });

  test('TC_SF_008 a 5MB PNG with text is sent as an image post', async ({ socialFeedPage: f, adminPage }, testInfo) => {
    const writes = await guardWrites(adminPage);
    await f.goto();
    await f.openCompose();
    await f.attach('Photo', makeFile(testInfo.outputPath('m'), 'five.png', padTo(PNG, 5 * MB)));
    await expect.poll(async () => (await f.previews()).images).toBe(1);
    await f.type('Photo post');
    await f.submitPost();
    await expect(f.modal).toBeHidden();
    const sent = writes.find((w) => w.path === '/social-feed');
    expect(sent?.body).toContain('"mediaType":"IMAGE"');
    expect(sent?.body).toContain('"body":"Photo post"');
  });

  test('TC_SF_009 JPG and WEBP photos are both accepted', async ({ socialFeedPage: f }, testInfo) => {
    await f.goto();
    await f.openCompose();
    await f.attach('Photo', makeFile(testInfo.outputPath('m'), 'a.jpg', JPG));
    await expect.poll(async () => (await f.previews()).images).toBe(1);
    await f.attach('Photo', makeFile(testInfo.outputPath('m'), 'b.webp', WEBP));
    await expect.poll(async () => (await f.previews()).images).toBe(1); // a new choice replaces the old one
  });

  test('TC_SF_010 an MP4 video under 50MB is accepted', async ({ socialFeedPage: f }, testInfo) => {
    await f.goto();
    await f.openCompose();
    await f.attach('Video', makeFile(testInfo.outputPath('m'), 'clip.mp4', mp4(40 * MB)));
    await expect.poll(async () => (await f.previews()).videos).toBe(1);
  });

  test('TC_SF_011 media without text enables Post and publishes', async ({ socialFeedPage: f }, testInfo) => {
    test.fail(true, 'Post stays disabled when only a photo is attached; the story says only "both empty" disables it');
    await f.goto();
    await f.openCompose();
    await f.attach('Photo', makeFile(testInfo.outputPath('m'), 'a.jpg', JPG));
    await expect.poll(async () => (await f.previews()).images).toBe(1);
    await expect(f.post).toBeEnabled();
  });

  test('TC_SF_012 a photo larger than 10MB is rejected and not attached', async ({ socialFeedPage: f }, testInfo) => {
    test.fail(true, 'A 12MB JPG is accepted and previewed; the limit is not enforced');
    await f.goto();
    await f.openCompose();
    await f.attach('Photo', makeFile(testInfo.outputPath('m'), 'big.jpg', padTo(JPG, 12 * MB)));
    await expect(f.screen.getByText(/10\s?MB|too large|exceeds/i)).toBeVisible({ timeout: 3_000 });
    expect((await f.previews()).images).toBe(0);
  });

  test('TC_SF_013 a video larger than 50MB is rejected and not attached', async ({ socialFeedPage: f }, testInfo) => {
    test.fail(true, 'A 60MB MP4 is accepted; the limit is not enforced');
    await f.goto();
    await f.openCompose();
    await f.attach('Video', makeFile(testInfo.outputPath('m'), 'big.mp4', mp4(60 * MB)));
    await expect(f.screen.getByText(/50\s?MB|too large|exceeds/i)).toBeVisible({ timeout: 3_000 });
    expect((await f.previews()).videos).toBe(0);
  });

  test('TC_SF_014 a PDF chosen as a photo is not attached', async ({ socialFeedPage: f }, testInfo) => {
    await f.goto();
    await f.openCompose();
    await f.attach('Photo', makeFile(testInfo.outputPath('m'), 'doc.pdf', Buffer.from('%PDF-1.4\n%%EOF\n')));
    await f.screen.waitForTimeout(1_000); // give a (wrong) preview time to appear
    expect(await f.previews()).toEqual({ images: 0, videos: 0 });
  });

  test('TC_SF_014 an unsupported file is rejected with a format error', async ({ socialFeedPage: f }, testInfo) => {
    test.fail(true, 'The rejection is silent: no format error is shown');
    await f.goto();
    await f.openCompose();
    await f.attach('Photo', makeFile(testInfo.outputPath('m'), 'doc.pdf', Buffer.from('%PDF-1.4\n%%EOF\n')));
    await expect(f.screen.getByText(/format|supported|allowed|JPG|PNG/i)).toBeVisible({ timeout: 3_000 });
  });

  test('TC_SF_014 a PDF chosen as a video is not attached', async ({ socialFeedPage: f }, testInfo) => {
    test.fail(true, 'A PDF picked through the Video button is accepted and shown as a video');
    await f.goto();
    await f.openCompose();
    await f.attach('Video', makeFile(testInfo.outputPath('m'), 'doc.pdf', Buffer.from('%PDF-1.4\n%%EOF\n')));
    await f.screen.waitForTimeout(1_000);
    expect((await f.previews()).videos).toBe(0);
  });

  test('TC_SF_015 exactly 2000 characters are accepted', async ({ socialFeedPage: f }) => {
    await f.goto();
    await f.openCompose();
    await f.type('a'.repeat(2000));
    expect((await f.text.inputValue()).length).toBe(2000);
    await expect(f.post).toBeEnabled();
  });

  test('TC_SF_016 text over 2000 characters is capped or blocked', async ({ socialFeedPage: f }) => {
    test.fail(true, 'The text area accepts 2001 characters and Post stays enabled');
    await f.goto();
    await f.openCompose();
    await f.type('a'.repeat(2001));
    const length = (await f.text.inputValue()).length;
    const blocked = await f.post.isDisabled();
    expect(length <= 2000 || blocked, `length ${length}, Post disabled ${blocked}`).toBe(true);
  });

  test('TC_SF_017 closing the modal with text discards it and sends nothing', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await f.goto();
    await f.openCompose();
    await f.type('Draft that must not be saved');
    await f.closeModal();
    await expect(f.modal).toBeHidden();
    expect(writes).toEqual([]);
    await f.openCompose();
    await expect(f.text).toHaveValue('');
  });
});

// =====================================================================================
// TS_SF_03: reactions, comments, share
// =====================================================================================
test.describe('TS_SF_03 reactions, comments, share @social-feed', () => {
  test('TC_SF_018 each of the 5 reactions sends its own reaction type', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await f.goto();
    await expect(f.deleteButtons.first()).toBeVisible();
    for (const emoji of REACTIONS) {
      await f.reaction(emoji).click();
      await expect.poll(() => writes.length).toBeGreaterThan(REACTIONS.indexOf(emoji));
    }
    const reacts = writes.filter((w) => /^\/posts\/\d+\/react$/.test(w.path));
    expect(reacts, 'one POST per reaction').toHaveLength(5);
    const types = reacts.map((w) => (JSON.parse(w.body) as { reactionType: string }).reactionType);
    expect(new Set(types).size, `distinct types: ${types.join(', ')}`).toBe(5);
    expect(types[0]).toBe('LIKE');
  });

  test('TC_SF_020 a comment is sent from the post screen', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await f.goto();
    await expect(f.commentButtons.first()).toBeVisible();
    await f.commentButtons.first().click();
    await expect(f.commentInput).toBeVisible();
    await f.commentInput.fill('Nice post');
    await f.clickCommentSend();
    await expect.poll(() => writes.some((w) => /^\/posts\/\d+\/comments$/.test(w.path))).toBe(true);
    const sent = writes.find((w) => /\/comments$/.test(w.path))!;
    expect(sent.body).toContain('"content":"Nice post"');
  });

  test('TC_SF_021 an empty or blank comment cannot be submitted', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await f.goto();
    await expect(f.commentButtons.first()).toBeVisible();
    await f.commentButtons.first().click();
    await expect(f.commentInput).toBeVisible();
    await f.commentInput.fill('   ');
    expect((await f.commentSend()).disabled, 'send is disabled for spaces').toBe(true);
    await f.clickCommentSend();
    await adminPage.waitForTimeout(800);
    expect(writes.filter((w) => /comments/.test(w.path))).toEqual([]);
  });

  test('TC_SF_022 Share hands the post text to the device share sheet', async ({ socialFeedPage: f, adminPage }) => {
    await adminPage.addInitScript(() => {
      (window as unknown as { __shared: unknown[] }).__shared = [];
      (navigator as unknown as { share: (d: unknown) => Promise<void> }).share = async (d) => {
        (window as unknown as { __shared: unknown[] }).__shared.push(d);
      };
    });
    await f.goto();
    const posts = await f.feedResponse(() => adminPage.reload());
    await expect(f.shareButtons.first()).toBeVisible();
    await f.shareButtons.first().click();
    await expect.poll(() => adminPage.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(1);
    const shared = (await adminPage.evaluate(() => (window as unknown as { __shared: { text?: string }[] }).__shared))[0];
    expect(shared.text).toBe(posts[0].body);
  });
});

// =====================================================================================
// TS_SF_04: cascading filters
// =====================================================================================
test.describe('TS_SF_04 cascading filters @social-feed', () => {
  // The pickers slide in with an animation, so a click can occasionally be lost; a retry is the honest fix.
  test.describe.configure({ retries: 2 });

  test('TC_SF_023 choosing a School fills Programme and re-queries the feed', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await f.goto();
    await f.openFilter('School');
    await expect(f.pickerAll('School')).toBeVisible();
    await expect.poll(async () => (await f.pickerOptions()).length).toBeGreaterThan(2);
    await f.pickerAll('School').waitFor();
    const request = adminPage.waitForRequest((r) => /\/social-feed\?.*schoolId=\d+/.test(r.url()), { timeout: 60_000 });
    await f.choosePicker('School Of Business');
    await request;
    await expect.poll(() => f.filterLabel('School')).toContain('School Of Busin');
    await f.openFilter('Programme');
    await expect(f.pickerAll('Programme')).toBeVisible();
    expect((await f.pickerOptions()).length, 'programmes of the school').toBeGreaterThan(1);
  });

  test('TC_SF_024 child filters stay disabled until their parent is chosen', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await f.goto();
    expect(await f.enabledFilters(), 'only School is usable at first').toEqual(['School']);
    expect(await f.filterLabels()).toEqual(['School', 'Programme', 'Batch', 'Semester']);
    await f.selectFilter('School', 'School Of Business');
    await expect.poll(() => f.enabledFilters()).toHaveLength(2); // School + Programme
    expect((await f.enabledFilters())[1]).toBe('Programme');
  });

  test('TC_SF_025 changing the School resets Programme', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await f.goto();
    await f.selectFilter('School', 'School Of Business');
    await f.selectFilter('Programme', 'Master of Business Administration', false);
    await f.selectFilter('School', 'School Of Pharmacy', false);
    await expect.poll(() => f.filterLabel('Programme')).toBe('Programme');
  });

  test('TC_SF_025 Clear all resets every filter', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await f.goto();
    await f.selectFilter('School', 'School Of Business');
    await f.clearAllFilters();
    await expect.poll(() => f.filterLabel('School')).toBe('School');
  });

  test('TC_SF_026 the feed is requested with the chosen cohort (BR-01)', async ({ socialFeedPage: f, adminPage }) => {
    await f.goto();
    const request = adminPage.waitForRequest((r) => /\/social-feed\?/.test(r.url()) && r.url().includes('schoolId='), { timeout: 60_000 });
    await f.selectFilter('School', 'School Of Business');
    expect((await request).url()).toMatch(/schoolId=1(&|$)/);
  });

  test('TC_SF_027 a feed without posts shows the empty state and no errors', async ({ socialFeedPage: f, adminPage }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await adminPage.route(/\/social-feed\?/, (route) => route.fulfill({ json: pageResponse([]) }));
    await f.goto();
    await expect(f.feedEmpty).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('TC_SF_027 a cohort without matching posts shows "No posts match this filter"', async ({ socialFeedPage: f, adminPage }) => {
    const errors: string[] = [];
    adminPage.on('pageerror', (e) => errors.push(e.message));
    await adminPage.route(/\/social-feed\?.*schoolId=/, (route) => route.fulfill({ json: pageResponse([]) }));
    await f.goto();
    await f.selectFilter('School', 'School Of Business');
    await expect(f.feedFilteredEmpty).toBeVisible();
    expect(errors).toEqual([]);
  });
});

// =====================================================================================
// TS_SF_05: University tab
// =====================================================================================
test.describe('TS_SF_05 university tab @social-feed', () => {
  test('TC_SF_028 the University tab lists the categories and each can be selected', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await f.goto();
    await f.openTab('University');
    for (const chip of ['All', 'Announcement', 'Leadership', 'News', 'Event', 'General']) {
      await expect(f.universityChip(chip), chip).toBeVisible();
    }
    for (const chip of ['Announcement', 'Leadership', 'News', 'Event', 'General', 'All']) {
      await f.universityChip(chip).click();
      await adminPage.waitForTimeout(300);
    }
  });

  test('TC_SF_029 a category without posts shows "No university posts in this category"', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await f.goto();
    await f.openTab('University');
    await f.universityChip('Announcement').click();
    await expect(f.universityEmpty).toBeVisible();
  });
});

// =====================================================================================
// TS_SF_06: birthdays
// =====================================================================================
test.describe('TS_SF_06 birthdays @social-feed', () => {
  const today = () => new Date().toISOString().slice(0, 10);
  const person = () => ({ userId: 9001, fullName: 'Test Person', department: 'School of Pharmacy', course: null, designation: 'Senior Clerk', role: 'EMPLOYEE', title: 'Mr.', birthDate: today(), daysUntil: 0 });
  const mockBirthdays = (cards: unknown[]) => ({
    success: true,
    message: 'ok',
    code: 'OK',
    data: { currentUserBirthday: false, currentUserName: 'Admin', totalCount: cards.length, birthdayCards: cards, upcomingBirthdays: [] },
  });

  test('TC_SF_031 the Birthdays tab badge counts today\'s birthdays (BR-03)', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await adminPage.route(/\/birthday-feed/, (route) => route.fulfill({ json: mockBirthdays([person(), { ...person(), userId: 9002, fullName: 'Second Person' }]) }));
    await f.goto();
    await expect.poll(() => f.tabText('Birthdays')).toContain('2');
  });

  test('TC_SF_032 with no birthday today there is no counter and a friendly message', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await adminPage.route(/\/birthday-feed/, (route) => route.fulfill({ json: mockBirthdays([]) }));
    await f.goto();
    expect(await f.tabText('Birthdays')).toEqual(['Birthdays']);
    await f.openTab('Birthdays');
    await expect(f.birthdaysNone).toBeVisible();
  });

  test('TC_SF_033 a birthday card shows the person and a "Happy Birthday!" banner', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await adminPage.route(/\/birthday-feed/, (route) => route.fulfill({ json: mockBirthdays([person()]) }));
    await f.goto();
    await f.openTab('Birthdays');
    await expect(f.birthdayHeadline).toBeVisible();
    await expect(adminPage.getByText('Test Person', { exact: true })).toBeVisible();
  });

  test('TC_SF_033 a birthday card offers quick-wish chips ("Happy Birthday!")', async ({ socialFeedPage: f, adminPage }) => {
    test.fail(true, 'The admin card only says "Wish them when you see them!": no quick-wish chips');
    await guardWrites(adminPage);
    await adminPage.route(/\/birthday-feed/, (route) => route.fulfill({ json: mockBirthdays([person()]) }));
    await f.goto();
    await f.openTab('Birthdays');
    await expect(adminPage.getByText('Wishing you the best!', { exact: false })).toBeVisible({ timeout: 3_000 });
  });

  test('TC_SF_035 a birthday card offers a custom wish box with a send icon', async ({ socialFeedPage: f, adminPage }) => {
    test.fail(true, 'The admin card has no wish input and no send icon');
    await guardWrites(adminPage);
    await adminPage.route(/\/birthday-feed/, (route) => route.fulfill({ json: mockBirthdays([person()]) }));
    await f.goto();
    await f.openTab('Birthdays');
    await expect(adminPage.getByPlaceholder(/wish|greeting|message/i)).toBeVisible({ timeout: 3_000 });
  });
});

// =====================================================================================
// TS_SF_07: communities (the admin tab is a management screen)
// =====================================================================================
test.describe('TS_SF_07 communities @social-feed', () => {
  const communityPost = (over: Record<string, unknown> = {}) => ({
    id: 2,
    communityId: 1,
    communityName: 'AI club',
    communitySlug: 'ai-club',
    authorUserId: 11,
    authorName: 'Test Author',
    authorRole: 'EMPLOYEE',
    authorTitle: 'President',
    postedAsCommunity: false,
    body: 'hello',
    imageUrl: null,
    mediaType: null,
    kind: 'DISCUSSION',
    status: 'PUBLISHED',
    pinned: false,
    likeCount: 0,
    commentCount: 0,
    createdAt: '2026-08-19T12:59:29Z',
    viewerReaction: null,
    viewerFlagged: false,
    viewerCanDelete: true,
    viewerCanModerate: true,
    flagCount: null,
    ...over,
  });
  const mockCommunityFeed = (page: import('@playwright/test').Page, rows: unknown[]) =>
    page.route(/\/communities\/feed\?/, (route) => route.fulfill({ json: pageResponse(rows) }));

  test('TC_SF_037 a community post shows the club, the author and their title', async ({ socialFeedPage: f, adminPage }) => {
    await guardWrites(adminPage);
    await f.goto();
    await f.openTab('Communities');
    await expect(f.communitiesHeading).toBeVisible();
    await expect(adminPage.getByText(/^discussion$/i).first()).toBeVisible();
    await expect(adminPage.getByText('AI club', { exact: true }).first()).toBeVisible();
    await expect(f.flagButtons.first()).toBeVisible();
  });

  test('TC_SF_037 a community post shows the "Owner" badge and the club privacy (BR-04)', async ({ socialFeedPage: f, adminPage }) => {
    test.fail(true, 'Posts show the author\'s own title ("President", "CEO") and no "Owner" badge or Private/Public label');
    await guardWrites(adminPage);
    await mockCommunityFeed(adminPage, [communityPost({ authorTitle: 'Owner' })]);
    await f.goto();
    await f.openTab('Communities');
    await expect(f.communitiesHeading).toBeVisible();
    await expect(adminPage.getByText('Owner', { exact: true })).toBeVisible({ timeout: 3_000 });
    await expect(adminPage.getByText(/Private club|Public/)).toBeVisible({ timeout: 3_000 });
  });

  test('TC_SF_038 flagging asks for confirmation, sends the flag and confirms with a message', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    let message = '';
    adminPage.once('dialog', async (d) => {
      message = d.message();
      await d.accept();
    });
    await mockCommunityFeed(adminPage, [communityPost()]);
    await f.goto();
    await f.openTab('Communities');
    await expect(f.flagButtons.first()).toBeVisible();
    await f.flagButtons.first().click();
    await expect(adminPage.getByText('Post flagged for review.', { exact: true })).toBeVisible();
    expect(message).toBe('Flag this post for a moderator to review?');
    const flag = writes.find((w) => /\/community-posts\/2\/flag$/.test(w.path));
    expect(flag, 'POST /community-posts/2/flag').toBeDefined();
    expect(flag!.method).toBe('POST');
  });

  test('TC_SF_039 cancelling the flag confirmation does not flag the post', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    adminPage.once('dialog', (d) => d.dismiss());
    await mockCommunityFeed(adminPage, [communityPost()]);
    await f.goto();
    await f.openTab('Communities');
    await expect(f.flagButtons.first()).toBeVisible();
    await f.flagButtons.first().click();
    await adminPage.waitForTimeout(800);
    expect(writes.filter((w) => /flag$/.test(w.path))).toEqual([]);
  });

  test('TC_SF_040 an already flagged post shows "Flagged" and cannot be flagged again', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await mockCommunityFeed(adminPage, [communityPost({ viewerFlagged: true })]);
    await f.goto();
    await f.openTab('Communities');
    await expect(f.flaggedMarkers.first()).toBeVisible();
    await expect(f.flagButtons).toHaveCount(0);
    expect(writes.filter((w) => /flag$/.test(w.path))).toEqual([]);
  });
});

// =====================================================================================
// TS_SF_08: admin delete
// =====================================================================================
test.describe('TS_SF_08 admin delete @social-feed', () => {
  test('TC_SF_041 deleting asks for confirmation, then sends the delete for that post', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    let message = '';
    adminPage.once('dialog', async (d) => {
      message = d.message();
      await d.accept();
    });
    await f.goto();
    const posts = await f.feedResponse(() => adminPage.reload());
    await expect(f.deleteButtons.first()).toBeVisible();
    await f.deleteButtons.first().click();
    await expect.poll(() => writes.length).toBe(1);
    expect(message).toBe('Are you sure you want to delete this post?');
    expect(writes[0]).toMatchObject({ method: 'DELETE', path: `/posts/${(posts[0] as { id: number }).id}` });
  });

  test('TC_SF_042 cancelling the delete confirmation keeps the post', async ({ socialFeedPage: f, adminPage }) => {
    const writes = await guardWrites(adminPage);
    adminPage.once('dialog', (d) => d.dismiss());
    await f.goto();
    await expect(f.deleteButtons.first()).toBeVisible();
    const before = await f.deleteButtons.count();
    await f.deleteButtons.first().click();
    await adminPage.waitForTimeout(800);
    expect(writes).toEqual([]);
    expect(await f.deleteButtons.count()).toBe(before);
  });

  test('TC_SF_043 an admin sees a delete icon on every post', async ({ socialFeedPage: f }) => {
    await f.goto();
    await expect(f.deleteButtons.first()).toBeVisible();
    expect(await f.deleteButtons.count()).toBe(await f.commentButtons.count());
  });
});

// =====================================================================================
// GATED: really publish a post, then delete it (ALLOW_FEED_WRITES=true)
// =====================================================================================
test.describe('TS_SF_02/08 publish and delete lifecycle @social-feed @writes', () => {
  test.skip(!WRITES_ALLOWED, 'Publishes a real post visible to users, then deletes it (soft delete + audit entry). Set ALLOW_FEED_WRITES=true to run.');

  test('TC_SF_007 publish a post (appears at the top), TC_SF_041 then delete it', async ({ socialFeedPage: f, adminPage }) => {
    const text = `AUTOTEST feed ${Date.now()}`;
    await f.goto();
    await expect(f.deleteButtons.first()).toBeVisible();
    const before = await f.deleteButtons.count();

    await f.openCompose();
    await f.type(text);
    const [response] = await Promise.all([
      adminPage.waitForResponse((r) => /\/social-feed$/.test(r.url().split('?')[0]) && r.request().method() === 'POST'),
      f.submitPost(),
    ]);
    expect(response.status()).toBeLessThan(300);
    await expect(f.modal).toBeHidden();
    await expect(adminPage.getByText(text, { exact: true }).first()).toBeVisible();
    await expect(f.deleteButtons).toHaveCount(before + 1);

    adminPage.once('dialog', (d) => d.accept());
    await f.deleteButtons.first().click();
    await expect(adminPage.getByText(text, { exact: true })).toHaveCount(0);
    await expect(f.deleteButtons).toHaveCount(before);
  });
});
