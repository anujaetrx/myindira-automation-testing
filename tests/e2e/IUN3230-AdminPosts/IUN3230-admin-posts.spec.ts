import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test as base, expect } from '@fixtures';
import {
  AdminPostsPage,
  CATEGORIES,
  guardMediaUpload,
  guardWrites,
  pageResponse,
  parsePublished,
  type AdminPostRow,
  type Audience,
  type PostCategory,
} from '@pages/AdminPostsPage';

/**
 * Admin Posts test cases for story IUN-3230 (BR-AP-01 .. BR-AP-05, scenarios 1-5, QA cases TC_AP_001 .. TC_AP_008).
 * Titles start with the story's TC id; TC_AP_009 and up are extra cases (negative, boundary, targeting, media).
 * Results and open questions: docs/test-cases/admin-posts.md
 *
 * SAFETY: publishing an admin post notifies real students and employees, so nothing here publishes for real.
 * Every test that clicks Publish / Delete / a reaction first calls guardWrites() (and guardMediaUpload() when a file is
 * attached): the call is answered locally and recorded, and the test asserts what the screen SENT (method, path,
 * body, which shows the targeting). The one test that really publishes and deletes is gated: ALLOW_ADMINPOSTS_WRITES=true.
 *
 * Known deviations use test.fail(): green in the run, red when the app is fixed (then remove the marker).
 */
const WRITES_ALLOWED = process.env.ALLOW_ADMINPOSTS_WRITES === 'true';
const MB = 1024 * 1024;

const test = base.extend<{ adminPostsPage: AdminPostsPage }>({
  adminPostsPage: async ({ adminPage }, use) => use(new AdminPostsPage(adminPage)),
});

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

function makeFile(name: string, data: Buffer): string {
  // own temp folder per test: the shared test-output folder is cleaned by other runs
  const dir = path.join(os.tmpdir(), 'admin-posts-media', `${process.pid}-${test.info().workerIndex}-${test.info().testId}`);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${dir}/${name}`;
  fs.writeFileSync(file, data);
  return file;
}

const post = (id: number, category: string, extra: Partial<AdminPostRow> = {}) => ({
  id,
  title: `Title ${category}`,
  body: `Body ${category}`,
  imageUrl: null,
  mediaType: null,
  createdByUserId: 1,
  createdByName: `Admin ${category}`,
  createdByTitle: 'Registrar',
  createdAt: '2026-11-05T10:00:00Z',
  targets: [{ role: 'STUDENT', departmentId: null }],
  reactions: {},
  totalReactions: 0,
  currentUserReaction: null,
  commentsCount: 0,
  postType: 'ADMIN_POST',
  category,
  reportCount: 0,
  reportedByCurrentUser: false,
  rankScore: null,
  cursor: null,
  ...extra,
});

/** Answers the post list with `body` (a status/JSON the situation needs); every other call goes through. */
async function mockList(page: import('@playwright/test').Page, answer: { status?: number; json: object }): Promise<void> {
  await page.route(/\/myindiranew\/api\/admin\/posts\?/, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: answer.status ?? 200, json: answer.json });
  });
}

/** Fills the whole form. `audience` may be empty. */
async function fillForm(
  p: AdminPostsPage,
  v: { title?: string; body?: string; category?: PostCategory; audience?: Audience[] },
): Promise<void> {
  if (v.title !== undefined) await p.fillTitle(v.title);
  if (v.body !== undefined) await p.fillBody(v.body);
  if (v.category) await p.chooseCategory(v.category);
  for (const a of v.audience ?? []) await p.toggleAudience(a);
}

// =====================================================================================
// Scenario 1: accessing Admin Posts, list and empty state
// =====================================================================================
test.describe('Scenario 1 access, list and empty state @admin-posts', () => {
  test('TC_AP_001 the page shows the quick-post box, the + button and the post list', async ({ adminPostsPage: a, adminPage }) => {
    await a.openFromSidebar();
    await expect(adminPage).toHaveURL(/\/posts$/);
    await expect(a.compose).toBeVisible();
    expect(await a.fabPresent, 'round + button at the bottom right').toBe(true);
    await expect(a.deleteButtons.first()).toBeVisible();
  });

  test('TC_AP_001 with no posts the empty message "No posts yet. Be the first to share!" shows with the box and the + button (BR-AP-05)', async ({
    adminPostsPage: a,
    adminPage,
  }) => {
    await mockList(adminPage, { json: pageResponse([]) });
    await a.goto();
    await expect(a.emptyMessage).toBeVisible();
    await expect(a.compose).toBeVisible();
    expect(await a.fabPresent).toBe(true);
    await expect(a.deleteButtons).toHaveCount(0);
  });

  test('TC_AP_009 the list is read with GET /admin/posts?page=0&size=20 and every returned post is shown', async ({ adminPostsPage: a }) => {
    const list = await a.listResponse(() => a.goto());
    expect(new URL(list.url).search).toBe('?page=0&size=20');
    await expect(a.deleteButtons).toHaveCount(list.rows.length);
    for (const row of list.rows) await expect(a.postTitle(row.title)).toBeVisible();
  });

  test('TC_AP_010 each card shows author, title, body and a category badge that matches the data', async ({ adminPostsPage: a, adminPage }) => {
    await mockList(adminPage, { json: pageResponse(CATEGORIES.map((c, i) => post(i + 1, c.toUpperCase()))) });
    await a.goto();
    for (const c of CATEGORIES) {
      await expect(a.postTitle(`Title ${c.toUpperCase()}`)).toBeVisible();
      await expect(adminPage.getByText(`Body ${c.toUpperCase()}`, { exact: true })).toBeVisible();
      await expect(adminPage.getByText(`Admin ${c.toUpperCase()}`, { exact: true })).toBeVisible();
    }
    expect(await a.badges()).toEqual(CATEGORIES.map((c) => c.toUpperCase()));
    await expect(a.deleteButtons).toHaveCount(5);
  });

  test('TC_AP_011 a post with a photo shows the picture on its card', async ({ adminPostsPage: a, adminPage }) => {
    const dataUri = `data:image/png;base64,${PNG.toString('base64')}`;
    await mockList(adminPage, { json: pageResponse([post(7, 'NEWS', { imageUrl: dataUri, mediaType: 'IMAGE' })]) });
    await a.goto();
    await expect(a.postTitle('Title NEWS')).toBeVisible();
    await expect(adminPage.locator(`img[src="${dataUri}"]`)).toHaveCount(1);
  });

  test('TC_AP_012 when the list cannot be loaded the screen says "Failed to load posts"', async ({ adminPostsPage: a, adminPage }) => {
    await mockList(adminPage, { status: 500, json: { success: false, message: 'Server error', code: 'ERR', data: null } });
    await a.goto();
    await expect(a.errorMessage).toBeVisible();
    await expect(a.deleteButtons).toHaveCount(0);
  });

  test('TC_AP_013 the sidebar item "Admin Posts" is the active item and opens /posts', async ({ adminPostsPage: a, adminPage }) => {
    await a.openFromSidebar();
    await expect(adminPage).toHaveURL(/\/posts$/);
    const color = await adminPage
      .getByText('Admin Posts', { exact: true })
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    const other = await adminPage
      .getByText('Policies', { exact: true })
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(color, 'the active item has its own colour').not.toBe(other);
  });

  test('TC_AP_014 the story route /admin-posts opens the Admin Posts screen', async ({ adminPostsPage: a, adminPage }) => {
    test.fail(true, 'The screen lives at /posts; opening /admin-posts directly shows the Dashboard');
    await adminPage.goto('/admin-posts');
    await expect(a.compose).toBeVisible({ timeout: 15_000 });
  });
});

// =====================================================================================
// Scenario 2: launching the Create Post modal
// =====================================================================================
test.describe('Scenario 2 launching the Create Post modal @admin-posts', () => {
  test('TC_AP_002 the quick-post box opens Create Post, and it closes again', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await expect(a.modal).toBeVisible();
    await a.closeModal();
    await expect(a.modal).toBeHidden();
  });

  test('TC_AP_002 the + button opens Create Post', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openViaFab();
    await expect(a.modal).toBeVisible();
  });

  test('TC_AP_015 the photo icon of the quick-post box opens Create Post', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openViaIcon();
    await expect(a.modal).toBeVisible();
  });

  test('TC_AP_016 the modal shows Title *, Body *, Category *, Media (Optional), Target Audience * and a disabled Publish', async ({
    adminPostsPage: a,
    adminPage,
  }) => {
    await a.goto();
    await a.openCompose();
    await expect(a.titleInput).toBeVisible();
    await expect(a.bodyInput).toBeVisible();
    await expect(adminPage.getByText('Title *', { exact: true }).first()).toBeVisible();
    await expect(adminPage.getByText('Body *', { exact: true }).first()).toBeVisible();
    await expect(adminPage.getByText('Category *', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Media (Optional)', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Target Audience *', { exact: true })).toBeVisible();
    for (const c of CATEGORIES) await expect(adminPage.getByText(c, { exact: true }).last()).toBeVisible();
    await expect(adminPage.getByText('Photo', { exact: true }).last()).toBeVisible();
    await expect(adminPage.getByText('Video', { exact: true }).last()).toBeVisible();
    await expect(a.audience('Students')).toBeVisible();
    await expect(a.audience('Employees')).toBeVisible();
    await expect(a.publish).toBeVisible();
    await expect(a.publish).toBeDisabled();
  });

  test('TC_AP_017 a new form starts with no category selected and both audience boxes empty', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    expect(await a.selectedCategories()).toEqual([]);
    expect(await a.isAudienceChecked('Students')).toBe(false);
    expect(await a.isAudienceChecked('Employees')).toBe(false);
    await expect(a.titleInput).toHaveValue('');
    await expect(a.bodyInput).toHaveValue('');
  });
});

// =====================================================================================
// Mandatory fields and the Publish button (BR-AP-01)
// =====================================================================================
test.describe('BR-AP-01 mandatory fields and the Publish button @admin-posts', () => {
  test('TC_AP_003 Publish stays disabled when Title and Body are blank and only a Category is chosen', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.chooseCategory('Announcement');
    await expect(a.publish).toBeDisabled();
  });

  test('TC_AP_018 Publish stays disabled with only a Title, only a Body or only an audience', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.fillTitle('Only a title');
    await expect(a.publish).toBeDisabled();
    await a.fillTitle('');
    await a.fillBody('Only a body');
    await expect(a.publish).toBeDisabled();
    await a.fillBody('');
    await a.toggleAudience('Students');
    await expect(a.publish).toBeDisabled();
  });

  test('TC_AP_019 a Title or Body of spaces only keeps Publish disabled', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: '     ', body: 'Real body', category: 'News', audience: ['Students'] });
    await expect(a.publish).toBeDisabled();
    await a.fillTitle('Real title');
    await expect(a.publish).toBeEnabled();
    await a.fillBody('     ');
    await expect(a.publish).toBeDisabled();
  });

  test('TC_AP_020 Publish is enabled when Title, Body, a Category and one audience are filled', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Title', body: 'Body', category: 'General', audience: ['Employees'] });
    await expect(a.publish).toBeEnabled();
  });

  test('TC_AP_021 Publish stays disabled until a Category is chosen', async ({ adminPostsPage: a }) => {
    test.fail(true, 'BR-AP-01: Publish is already enabled with only Title and Body (no Category, no audience)');
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Title', body: 'Body', audience: ['Students'] });
    await expect(a.publish).toBeDisabled();
  });

  test('TC_AP_022 Publish stays disabled until a Target Audience is ticked', async ({ adminPostsPage: a }) => {
    test.fail(true, 'BR-AP-01: Publish is enabled with Title, Body and a Category but no audience');
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Title', body: 'Body', category: 'News' });
    await expect(a.publish).toBeDisabled();
  });

  test('TC_AP_023 un-ticking both audience boxes disables Publish again', async ({ adminPostsPage: a }) => {
    test.fail(true, 'Publish is not tied to the audience boxes: it stays enabled when both are cleared');
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Title', body: 'Body', category: 'News', audience: ['Students', 'Employees'] });
    await expect(a.publish).toBeEnabled();
    await a.toggleAudience('Students');
    await a.toggleAudience('Employees');
    await expect(a.publish).toBeDisabled();
  });

  test('TC_AP_024 pressing the (enabled) Publish with no Category and no audience is refused with a message and sends nothing', async ({
    adminPostsPage: a,
    adminPage,
  }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Title', body: 'Body' });
    await a.clickPublish();
    await expect(a.message('Please fill all fields and select at least one target role')).toBeVisible();
    await expect(a.modal).toBeVisible();
    expect(writes, 'nothing was sent').toEqual([]);
  });

  test('TC_AP_025 with a Category but no audience the same message shows and nothing is sent', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Title', body: 'Body', category: 'Event' });
    await a.clickPublish();
    await expect(a.message('Please fill all fields and select at least one target role')).toBeVisible();
    await expect(a.modal).toBeVisible();
    expect(writes).toEqual([]);
  });

  test('TC_AP_026 with an audience but no Category the same message shows and nothing is sent', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Title', body: 'Body', audience: ['Students'] });
    await a.clickPublish();
    await expect(a.message('Please fill all fields and select at least one target role')).toBeVisible();
    await expect(a.modal).toBeVisible();
    expect(writes).toEqual([]);
  });
});

// =====================================================================================
// Scenario 3: category and audience selection (BR-AP-02)
// =====================================================================================
test.describe('Scenario 3 category and audience selection @admin-posts', () => {
  test('TC_AP_004 choosing Leadership after Announcement selects Leadership and deselects Announcement (BR-AP-02)', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.chooseCategory('Announcement');
    expect(await a.selectedCategories()).toEqual(['Announcement']);
    await a.chooseCategory('Leadership');
    expect(await a.selectedCategories()).toEqual(['Leadership']);
  });

  test('TC_AP_027 cycling through all five categories always leaves exactly one selected', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    for (const c of [...CATEGORIES, 'Announcement' as PostCategory]) {
      await a.chooseCategory(c);
      expect(await a.selectedCategories(), `after choosing ${c}`).toEqual([c]);
    }
  });

  test('TC_AP_028 clicking the selected category again keeps it selected', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.chooseCategory('News');
    await a.chooseCategory('News');
    expect((await a.selectedCategories()).length, 'a pill cannot be switched off, one category is always chosen').toBeLessThanOrEqual(1);
  });

  test('TC_AP_005 the Students and Employees boxes toggle independently', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.toggleAudience('Students');
    expect([await a.isAudienceChecked('Students'), await a.isAudienceChecked('Employees')]).toEqual([true, false]);
    await a.toggleAudience('Students');
    await a.toggleAudience('Employees');
    expect([await a.isAudienceChecked('Students'), await a.isAudienceChecked('Employees')]).toEqual([false, true]);
    await a.toggleAudience('Students');
    expect([await a.isAudienceChecked('Students'), await a.isAudienceChecked('Employees')]).toEqual([true, true]);
    await a.toggleAudience('Employees');
    expect([await a.isAudienceChecked('Students'), await a.isAudienceChecked('Employees')]).toEqual([true, false]);
  });

  test('TC_AP_029 the audience rows are real checkboxes (role checkbox, keyboard focusable)', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await expect(a.audience('Students')).toHaveAttribute('tabindex', '0');
    await expect(a.audience('Employees')).toHaveAttribute('tabindex', '0');
  });
});

// =====================================================================================
// Scenario 4: publishing (BR-AP-03 targeting, BR-AP-04 syndication)
// =====================================================================================
test.describe('Scenario 4 publishing and targeting @admin-posts', () => {
  test('TC_AP_006 a text-only post to Students sends POST /admin/posts with the title, body, category and target, then closes and refreshes the list', async ({
    adminPostsPage: a,
    adminPage,
  }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'QA automated title', body: 'QA automated body', category: 'Event', audience: ['Students'] });
    const reload = adminPage.waitForResponse((r) => /\/admin\/posts\?/.test(r.url()) && r.request().method() === 'GET');
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    await reload; // the list is read again so the new post shows at the top

    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe('POST');
    expect(writes[0].path).toBe('/admin/posts');
    expect(parsePublished(writes[0].body)).toEqual({
      title: 'QA automated title',
      body: 'QA automated body',
      targets: [{ role: 'STUDENT', departmentId: null }],
      category: 'EVENT',
    });
  });

  test('TC_AP_030 after publishing a success message is shown', async ({ adminPostsPage: a, adminPage }) => {
    await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'QA title', body: 'QA body', category: 'News', audience: ['Employees'] });
    await a.clickPublish();
    await expect(a.message(/^Post (created|published) successfully$/)).toBeVisible();
  });

  test('TC_AP_031 the success message reads exactly "Post published successfully"', async ({ adminPostsPage: a, adminPage }) => {
    test.fail(true, 'Scenario 4: the toast says "Post created successfully"');
    await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'QA title', body: 'QA body', category: 'News', audience: ['Employees'] });
    await a.clickPublish();
    await expect(a.message('Post published successfully')).toBeVisible();
  });

  test('TC_AP_032 the new post shows at the top of the list after publishing', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const existing = post(1, 'EVENT', { title: 'Older post' });
    let published = false;
    // The server is simulated: the list returns the new post first once Publish has been pressed.
    await adminPage.route(/\/myindiranew\/api\/admin\/posts\?/, (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const rows = published ? [post(2, 'NEWS', { title: 'Brand new post' }), existing] : [existing];
      return route.fulfill({ json: pageResponse(rows) });
    });
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Brand new post', body: 'Body', category: 'News', audience: ['Students'] });
    published = true;
    await a.clickPublish();
    await expect(a.postTitle('Brand new post')).toBeVisible();
    const tops = await adminPage.evaluate(() => {
      const y = (t: string) => Array.from(document.querySelectorAll<HTMLElement>('div')).find((d) => d.children.length === 0 && d.innerText === t)?.getBoundingClientRect().y ?? -1;
      return { fresh: y('Brand new post'), old: y('Older post') };
    });
    expect(tops.fresh).toBeGreaterThan(0);
    expect(tops.fresh).toBeLessThan(tops.old);
    expect(writes).toHaveLength(1);
  });

  const audiences: { label: string; audience: Audience[]; roles: string[] }[] = [
    { label: 'Students only', audience: ['Students'], roles: ['STUDENT'] },
    { label: 'Employees only', audience: ['Employees'], roles: ['EMPLOYEE'] },
    { label: 'Students and Employees (campus-wide)', audience: ['Students', 'Employees'], roles: ['STUDENT', 'EMPLOYEE'] },
  ];
  for (const t of audiences) {
    test(`TC_AP_033 targeting ${t.label} sends exactly those roles, with no department (BR-AP-03)`, async ({ adminPostsPage: a, adminPage }) => {
      const writes = await guardWrites(adminPage);
      await a.goto();
      await a.openCompose();
      await fillForm(a, { title: 'Targeting', body: 'Targeting body', category: 'Announcement', audience: t.audience });
      await a.clickPublish();
      await expect(a.modal).toBeHidden();
      expect(writes).toHaveLength(1);
      const sent = parsePublished(writes[0].body);
      expect(sent.targets).toEqual(t.roles.map((role) => ({ role, departmentId: null })));
    });
  }

  test('TC_AP_034 ticking a box, un-ticking it and ticking the other sends only the second audience', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Switch', body: 'Switch body', category: 'News' });
    await a.toggleAudience('Students');
    await a.toggleAudience('Students');
    await a.toggleAudience('Employees');
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    expect(parsePublished(writes[0].body).targets).toEqual([{ role: 'EMPLOYEE', departmentId: null }]);
  });

  for (const c of CATEGORIES) {
    test(`TC_AP_035 category ${c} is sent as ${c.toUpperCase()}`, async ({ adminPostsPage: a, adminPage }) => {
      const writes = await guardWrites(adminPage);
      await a.goto();
      await a.openCompose();
      await fillForm(a, { title: `Cat ${c}`, body: 'Body', category: c, audience: ['Students'] });
      await a.clickPublish();
      await expect(a.modal).toBeHidden();
      expect(parsePublished(writes[0].body).category).toBe(c.toUpperCase());
    });
  }

  test('TC_AP_036 changing the category before publishing sends only the last one', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Change', body: 'Body', audience: ['Students'] });
    await a.chooseCategory('Announcement');
    await a.chooseCategory('General');
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    expect(parsePublished(writes[0].body).category).toBe('GENERAL');
  });

  test('TC_AP_037 a fresh Create Post after publishing is empty again', async ({ adminPostsPage: a, adminPage }) => {
    await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'First', body: 'First body', category: 'News', audience: ['Students', 'Employees'] });
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    await a.openCompose();
    await expect(a.titleInput).toHaveValue('');
    await expect(a.bodyInput).toHaveValue('');
    expect(await a.selectedCategories()).toEqual([]);
    expect(await a.isAudienceChecked('Students')).toBe(false);
    expect(await a.isAudienceChecked('Employees')).toBe(false);
    await expect(a.publish).toBeDisabled();
  });

  test('TC_AP_038 text is sent as typed: line breaks, accents, emoji and markup characters are kept', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    const title = 'Convocation 2026 – "Président" <b>&</b> 🎓';
    const body = 'Line one\nLine two é ü ñ 日本語\n<script>alert(1)</script> & more';
    await fillForm(a, { title, body, category: 'Event', audience: ['Students'] });
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    const sent = parsePublished(writes[0].body);
    expect(sent.title).toBe(title);
    expect(sent.body).toBe(body);
  });

  test('TC_AP_039 leading and trailing spaces are not sent', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: '   Spaced title   ', body: '   Spaced body   ', category: 'News', audience: ['Students'] });
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    const sent = parsePublished(writes[0].body);
    expect(sent.title).toBe('Spaced title');
    expect(sent.body).toBe('Spaced body');
  });

  test('TC_AP_040 when the server refuses the post the modal stays open with the typed text and the list is not changed', async ({
    adminPostsPage: a,
    adminPage,
  }) => {
    const writes = await guardWrites(adminPage);
    await adminPage.route(/\/myindiranew\/api\/admin\/posts$/, (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      writes.push({ method: 'POST', path: '/admin/posts (refused)', body: '' });
      return route.fulfill({ status: 500, json: { success: false, message: 'Server error', code: 'ERR', data: null } });
    });
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Will fail', body: 'Will fail body', category: 'News', audience: ['Students'] });
    await a.clickPublish();
    await expect.poll(() => writes.length).toBe(1);
    await expect(a.modal).toBeVisible();
    await expect(a.titleInput).toHaveValue('Will fail');
    await expect(a.message(/created successfully|published successfully/)).toHaveCount(0);
  });

  test('TC_AP_041 pressing Publish twice quickly sends the post once', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Double', body: 'Double body', category: 'News', audience: ['Students'] });
    await a.publish.dblclick();
    await expect(a.modal).toBeHidden();
    await adminPage.waitForLoadState('networkidle');
    expect(writes.filter((w) => w.path === '/admin/posts')).toHaveLength(1);
  });
});

// =====================================================================================
// Input limits
// =====================================================================================
test.describe('Input limits @admin-posts', () => {
  test('TC_AP_042 a Title of exactly 120 characters and a Body of exactly 3,000 are accepted and sent in full', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'T'.repeat(120), body: 'B'.repeat(3000), category: 'News', audience: ['Students'] });
    await expect(a.titleInput).toHaveValue('T'.repeat(120));
    await expect(a.bodyInput).toHaveValue('B'.repeat(3000));
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    const sent = parsePublished(writes[0].body);
    expect(sent.title).toHaveLength(120);
    expect(sent.body).toHaveLength(3000);
  });

  test('TC_AP_043 a Title longer than 120 characters is cut at 120', async ({ adminPostsPage: a }) => {
    test.fail(true, 'Title has no limit: 130 characters are accepted (story: max 120)');
    await a.goto();
    await a.openCompose();
    await a.fillTitle('T'.repeat(130));
    expect((await a.titleInput.inputValue()).length).toBeLessThanOrEqual(120);
  });

  test('TC_AP_044 a Body longer than 3,000 characters is cut at 3,000', async ({ adminPostsPage: a }) => {
    test.fail(true, 'Body has no limit: 3,100 characters are accepted (story: max 3,000)');
    await a.goto();
    await a.openCompose();
    await a.fillBody('B'.repeat(3100));
    expect((await a.bodyInput.inputValue()).length).toBeLessThanOrEqual(3000);
  });

  test('TC_AP_045 a Title of 121 characters or a Body of 3,001 is refused (Publish disabled or an error shown, nothing sent)', async ({
    adminPostsPage: a,
    adminPage,
  }) => {
    test.fail(true, 'Over-long text is accepted and sent: no limit is enforced');
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'T'.repeat(121), body: 'B'.repeat(3001), category: 'News', audience: ['Students'] });
    if (await a.publish.isEnabled()) await a.clickPublish();
    await adminPage.waitForTimeout(1_000); // give a (wrong) request time to be sent
    expect(writes).toEqual([]);
  });
});

// =====================================================================================
// Media (photo / video), BR validations
// =====================================================================================
test.describe('Media attachments @admin-posts', () => {
  test('TC_AP_046 a JPEG, PNG or WEBP photo shows a preview with a remove x, and x removes it', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    for (const [name, data] of [
      ['photo.jpg', JPG],
      ['photo.png', PNG],
      ['photo.webp', WEBP],
    ] as const) {
      await a.attach('Photo', makeFile(name, data));
      await expect.poll(async () => (await a.previews()).images, { message: `${name} preview` }).toBeGreaterThan(0);
      expect(await a.hasRemoveButton, `${name} has a remove x`).toBe(true);
      await a.removeMedia();
      await expect.poll(async () => (await a.previews()).images).toBe(0);
      expect(await a.hasRemoveButton).toBe(false);
    }
  });

  test('TC_AP_047 an MP4 video shows a preview with a remove x, and x removes it', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.attach('Video', makeFile('clip.mp4', mp4(2 * MB)));
    await expect.poll(async () => (await a.previews()).videos).toBe(1);
    expect(await a.hasRemoveButton).toBe(true);
    await a.removeMedia();
    await expect.poll(async () => (await a.previews()).videos).toBe(0);
  });

  test('TC_AP_048 a MOV video is accepted and shows a preview', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.attach('Video', makeFile('clip.mov', mp4(2 * MB)));
    await expect.poll(async () => (await a.previews()).videos).toBe(1);
  });

  test('TC_AP_049 choosing a video after a photo replaces the photo (one attachment at a time)', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.attach('Photo', makeFile('first.jpg', JPG));
    await expect.poll(async () => (await a.previews()).images).toBeGreaterThan(0);
    await a.attach('Video', makeFile('second.mp4', mp4(2 * MB)));
    await expect.poll(async () => (await a.previews()).videos).toBe(1);
    expect((await a.previews()).images).toBe(0);
  });

  test('TC_AP_007 a post with a JPEG photo (under 10 MB) uploads the photo, then sends the post with its media key and type IMAGE', async ({
    adminPostsPage: a,
    adminPage,
  }) => {
    const writes = await guardWrites(adminPage);
    const uploads = await guardMediaUpload(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Photo post', body: 'Photo post body', category: 'News', audience: ['Students', 'Employees'] });
    await a.attach('Photo', makeFile('photo.jpg', padTo(JPG, 1 * MB)));
    await expect.poll(async () => (await a.previews()).images).toBeGreaterThan(0);
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    expect(uploads.map((u) => u.method), 'the file goes to cloud storage with a PUT').toEqual(['PUT']);
    expect(writes).toHaveLength(1);
    const sent = parsePublished(writes[0].body);
    expect(sent.mediaType).toBe('IMAGE');
    expect(sent.mediaKey).toMatch(/^posts\/[0-9a-f-]+\.jpg$/);
    expect(sent.targets.map((t) => t.role)).toEqual(['STUDENT', 'EMPLOYEE']);
  });

  test('TC_AP_050 a post with an MP4 video sends media type VIDEO', async ({ adminPostsPage: a, adminPage }) => {
    test.fail(true, 'A video cannot be published: the pre-signed-URL request carries the whole base64 file as fileName, nothing is sent and the modal just stays open');
    const writes = await guardWrites(adminPage);
    await guardMediaUpload(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Video post', body: 'Video body', category: 'Event', audience: ['Students'] });
    await a.attach('Video', makeFile('clip.mp4', mp4(2 * MB)));
    await expect.poll(async () => (await a.previews()).videos).toBe(1);
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    const sent = parsePublished(writes[0].body);
    expect(sent.mediaType).toBe('VIDEO');
    expect(sent.mediaKey).toMatch(/^posts\/[0-9a-f-]+\.mp4$/);
  });

  test('TC_AP_051 a removed attachment is not sent with the post', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const uploads = await guardMediaUpload(adminPage);
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'No photo', body: 'Body', category: 'News', audience: ['Students'] });
    await a.attach('Photo', makeFile('photo.jpg', JPG));
    await expect.poll(async () => (await a.previews()).images).toBeGreaterThan(0);
    await a.removeMedia();
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    const sent = parsePublished(writes[0].body);
    expect(sent.mediaKey).toBeUndefined();
    expect(sent.mediaType).toBeUndefined();
    expect(uploads).toEqual([]);
  });

  test('TC_AP_052 a photo of exactly 10 MB is accepted', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.attach('Photo', makeFile('ten.jpg', padTo(JPG, 10 * MB)));
    await expect.poll(async () => (await a.previews()).images).toBeGreaterThan(0);
  });

  test('TC_AP_053 a photo over 10 MB is refused', async ({ adminPostsPage: a }) => {
    test.fail(true, 'A 12 MB JPG is accepted and previewed (story: photo max 10 MB)');
    await a.goto();
    await a.openCompose();
    await a.attach('Photo', makeFile('big.jpg', padTo(JPG, 12 * MB)));
    await a.screen.waitForTimeout(2_000); // a refusal, if any, would show by now
    expect((await a.previews()).images).toBe(0);
  });

  test('TC_AP_054 a video of 40 MB is accepted', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.attach('Video', makeFile('forty.mp4', mp4(40 * MB)));
    await expect.poll(async () => (await a.previews()).videos, { timeout: 15_000 }).toBe(1);
  });

  test('TC_AP_055 a video over 50 MB is refused', async ({ adminPostsPage: a }) => {
    test.fail(true, 'A 60 MB MP4 is accepted and previewed (story: video max 50 MB)');
    await a.goto();
    await a.openCompose();
    await a.attach('Video', makeFile('big.mp4', mp4(60 * MB)));
    await a.screen.waitForTimeout(4_000); // a refusal, if any, would show by now
    expect((await a.previews()).videos).toBe(0);
  });

  test('TC_AP_056 a PDF chosen as a Photo is not attached', async ({ adminPostsPage: a }) => {
    test.fail(true, 'A PDF chosen through Photo is accepted: an empty preview with a remove x appears');
    await a.goto();
    await a.openCompose();
    await a.attach('Photo', makeFile('doc.pdf', Buffer.from('%PDF-1.4\n%%EOF\n')));
    await a.screen.waitForTimeout(1_500);
    expect((await a.previews()).images).toBe(0);
    expect(await a.hasRemoveButton).toBe(false);
  });

  test('TC_AP_057 a PDF chosen as a Photo shows an error message', async ({ adminPostsPage: a }) => {
    test.fail(true, 'The unsupported file is silently ignored: no message is shown');
    await a.goto();
    await a.openCompose();
    await a.attach('Photo', makeFile('doc.pdf', Buffer.from('%PDF-1.4\n%%EOF\n')));
    await expect(a.message(/not supported|invalid|only .*(JPEG|PNG|image)|file type|format/i)).toBeVisible({ timeout: 3_000 });
  });

  test('TC_AP_058 a PDF chosen as a Video is not attached', async ({ adminPostsPage: a }) => {
    test.fail(true, 'A PDF chosen through the Video button is accepted and shown as a video');
    await a.goto();
    await a.openCompose();
    await a.attach('Video', makeFile('doc.pdf', Buffer.from('%PDF-1.4\n%%EOF\n')));
    await a.screen.waitForTimeout(2_000);
    expect((await a.previews()).videos).toBe(0);
  });

  test('TC_AP_059 an executable chosen as a Photo is not attached', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.attach('Photo', makeFile('tool.exe', Buffer.from('MZ\u0090\u0000\u0003')));
    await a.screen.waitForTimeout(1_500);
    expect((await a.previews()).images).toBe(0);
  });

  test('TC_AP_060 a media-only form (no text) does not enable Publish', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await a.attach('Photo', makeFile('photo.jpg', JPG));
    await expect.poll(async () => (await a.previews()).images).toBeGreaterThan(0);
    await expect(a.publish).toBeDisabled();
  });
});

// =====================================================================================
// Scenario 5: dismissing the modal
// =====================================================================================
test.describe('Scenario 5 dismissing the modal without publishing @admin-posts', () => {
  test('TC_AP_008 the close X dismisses the modal and a typed draft is not sent', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await a.fillTitle('Draft title');
    await a.closeModal();
    await expect(a.modal).toBeHidden();
    expect(writes).toEqual([]);
  });

  test('TC_AP_061 a closed draft is not kept: reopening shows an empty form', async ({ adminPostsPage: a }) => {
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Draft title', body: 'Draft body', category: 'News', audience: ['Students'] });
    await a.closeModal();
    await a.openCompose();
    await expect(a.titleInput).toHaveValue('');
    await expect(a.bodyInput).toHaveValue('');
    expect(await a.selectedCategories()).toEqual([]);
    expect(await a.isAudienceChecked('Students')).toBe(false);
  });

  test('TC_AP_062 closing with unsaved input asks nothing and sends nothing', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const dialogs: string[] = [];
    adminPage.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await a.goto();
    await a.openCompose();
    await fillForm(a, { title: 'Draft', body: 'Draft body', category: 'News', audience: ['Students', 'Employees'] });
    await a.closeModal();
    expect(dialogs).toEqual([]);
    expect(writes).toEqual([]);
  });

  test('TC_AP_063 clicking outside the modal (on the backdrop) dismisses it', async ({ adminPostsPage: a, adminPage }) => {
    test.fail(true, 'Scenario 5: clicking the dimmed backdrop does nothing, the modal stays open');
    const writes = await guardWrites(adminPage);
    await a.goto();
    await a.openCompose();
    await a.fillTitle('Draft');
    await a.clickBackdrop();
    await expect(a.modal).toBeHidden({ timeout: 3_000 });
    expect(writes).toEqual([]);
  });

  test('TC_AP_064 after closing, the list is unchanged and the page is usable again', async ({ adminPostsPage: a }) => {
    await a.goto();
    const before = await a.deleteButtons.count();
    await a.openViaFab();
    await a.closeModal();
    await expect(a.deleteButtons).toHaveCount(before);
    await a.openCompose();
    await expect(a.modal).toBeVisible();
  });
});

// =====================================================================================
// Post actions on a card: delete, react, share
// =====================================================================================
test.describe('Post actions on a card @admin-posts', () => {
  test('TC_AP_065 deleting asks to confirm, then sends DELETE /posts/{id}', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const { rows } = await a.listResponse(() => a.goto());
    expect(rows.length, 'QA has at least one admin post').toBeGreaterThan(0);
    let message = '';
    adminPage.once('dialog', (d) => {
      message = d.message();
      void d.accept();
    });
    await a.deleteButtons.first().click();
    expect(message).toBe('Are you sure you want to delete this post?');
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].method).toBe('DELETE');
    expect(writes[0].path).toBe(`/posts/${rows[0].id}`);
  });

  test('TC_AP_066 cancelling the delete confirmation sends nothing and keeps the post', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const { rows } = await a.listResponse(() => a.goto());
    adminPage.once('dialog', (d) => void d.dismiss());
    await a.deleteButtons.first().click();
    await adminPage.waitForLoadState('networkidle');
    expect(writes).toEqual([]);
    await expect(a.postTitle(rows[0].title)).toBeVisible();
  });

  test('TC_AP_067 every post card has a delete icon and a Share button', async ({ adminPostsPage: a, adminPage }) => {
    await mockList(adminPage, { json: pageResponse([post(1, 'NEWS'), post(2, 'EVENT'), post(3, 'GENERAL')]) });
    await a.goto();
    await expect(a.deleteButtons).toHaveCount(3);
    await expect(a.shareButtons).toHaveCount(3);
  });

  test('TC_AP_068 a reaction on a post sends POST /posts/{id}/react with its type', async ({ adminPostsPage: a, adminPage }) => {
    const writes = await guardWrites(adminPage);
    const { rows } = await a.listResponse(() => a.goto());
    await a.reaction('👍').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].method).toBe('POST');
    expect(writes[0].path).toBe(`/posts/${rows[0].id}/react`);
    expect(JSON.parse(writes[0].body)).toEqual({ reactionType: 'LIKE' });
  });
});

// =====================================================================================
// Real publish (gated)
// =====================================================================================
test.describe('Lifecycle against the real server @admin-posts', () => {
  test('TC_AP_006 + TC_AP_007 publish a real post, see it at the top, then delete it', async ({ adminPostsPage: a, adminPage }) => {
    test.skip(!WRITES_ALLOWED, 'Publishes a real post that notifies users: set ALLOW_ADMINPOSTS_WRITES=true to run it');
    const title = `QA-AUTO ${Date.now()}`;
    await a.goto();
    await a.openCompose();
    // Target a single audience; the post is deleted again at the end.
    await fillForm(a, { title, body: 'Automated test post, deleted right after.', category: 'General', audience: ['Employees'] });
    await a.clickPublish();
    await expect(a.modal).toBeHidden();
    await expect(a.postTitle(title)).toBeVisible();
    // clean up: delete only the card that carries this run's unique title
    adminPage.once('dialog', (d) => void d.accept());
    await a.deleteButtonOf(title).click();
    await expect(a.postTitle(title)).toHaveCount(0);
  });
});
