import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export type PostCategory = 'Announcement' | 'Leadership' | 'News' | 'Event' | 'General';
export const CATEGORIES: PostCategory[] = ['Announcement', 'Leadership', 'News', 'Event', 'General'];
export type Audience = 'Students' | 'Employees';

export { guardWrites, pageResponse, type CapturedWrite } from '@utils/helpers/guard-writes';

/** Icon-font glyphs live in the private-use area and count as "text"; remove them before comparing. */
export const clean = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').trim();

/** Material Design icon glyph of a ticked checkbox in the audience list (the empty box is U+F0131). */
const CHECKED_GLYPH = '\u{F0132}';

/** One admin post as the list API returns it (only the fields the screen uses). */
export interface AdminPostRow {
  id: number;
  title: string;
  body: string;
  category: string;
  createdByName?: string;
  imageUrl?: string | null;
  mediaType?: string | null;
  targets?: { role: string; departmentId: number | null }[];
}

/** What the screen sent to `POST /admin/posts` (the "post" part of the multipart body, parsed). */
export interface PublishedPost {
  title: string;
  body: string;
  category: string;
  targets: { role: string; departmentId: number | null }[];
  mediaKey?: string;
  mediaType?: string;
}

/** Reads the JSON "post" part out of the multipart body that guardWrites recorded. */
export function parsePublished(body: string): PublishedPost {
  const m = /name="post"[\s\S]*?\r?\n\r?\n([\s\S]*?)\r?\n--/.exec(body);
  if (!m) throw new Error(`No "post" part in the request body: ${body.slice(0, 200)}`);
  return JSON.parse(m[1]) as PublishedPost;
}

/**
 * Photos and videos are uploaded by the browser straight to cloud storage (a PUT to a pre-signed URL) when Publish is
 * pressed. That call is outside the API, so guardWrites does not catch it: block it here. Returns the blocked calls.
 * (The pre-signed URL itself is a GET and is harmless.)
 */
export async function guardMediaUpload(page: Page): Promise<{ method: string; host: string }[]> {
  const uploads: { method: string; host: string }[] = [];
  await page.route(/amazonaws\.com|blob\.core\.windows\.net|storage\.googleapis\.com/, (route) => {
    const req = route.request();
    uploads.push({ method: req.method(), host: new URL(req.url()).host });
    return route.fulfill({ status: 200, body: '' });
  });
  return uploads;
}

/**
 * Admin > Admin Posts (sidebar item "Admin Posts", route `/posts`, list API `GET /admin/posts?page=0&size=20`):
 * quick-post box, post cards (reactions, share, delete), round "+" button and the "Create Post" modal
 * (Title, Body, Category pills, Photo / Video, Target Audience checkboxes, Publish).
 * Interactions only: expectations live in the specs.
 *
 * React Native Web: the round "+" button (56x56), the modal close X (32x34) and the media remove "x" (28x28) are plain
 * pressable <div>s, found by size. The audience rows are role=checkbox.
 */
export class AdminPostsPage extends BasePage {
  protected readonly path = '/posts';

  private readonly composeBox: Locator;
  private readonly loadError: Locator;
  private readonly modalTitle: Locator;
  private readonly publishButton: Locator;

  constructor(page: Page) {
    super(page);
    this.composeBox = page.getByText("What's on your mind?", { exact: true }).first();
    this.loadError = page.getByText('Failed to load posts', { exact: true });
    this.modalTitle = page.getByText('Create Post', { exact: true });
    this.publishButton = page.getByRole('button', { name: /Publish/ });
  }

  /** The compose box exists in the empty state too; the error state shows only its message. */
  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.composeBox.or(this.loadError));
  }

  /** The underlying page, for assertions that are not tied to one element. */
  get screen(): Page {
    return this.page;
  }

  /** Opens the screen the way a user does: from the sidebar item (the route is `/posts`). */
  async openFromSidebar(): Promise<void> {
    await this.page.goto('/dashboard');
    const item = this.page.getByText('Admin Posts', { exact: true }).first();
    await this.waits.forVisible(item);
    await this.actions.click(item, 'sidebar Admin Posts');
    await this.waitForReady();
  }

  // ---------- geometry helper ----------

  private async pressables(match: { w: number; h: number; minX?: number; minY?: number }) {
    return this.page.evaluate((m) => {
      return Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"], [role="button"]'))
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => Math.abs(r.width - m.w) < 2 && Math.abs(r.height - m.h) < 2 && (m.minX === undefined || r.x >= m.minX) && (m.minY === undefined || r.y >= m.minY))
        .map(({ r }) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 }));
    }, match);
  }

  // ---------- list ----------

  get compose(): Locator {
    return this.composeBox;
  }
  get emptyMessage(): Locator {
    return this.page.getByText('No posts yet. Be the first to share!', { exact: true });
  }
  get errorMessage(): Locator {
    return this.loadError;
  }
  get deleteButtons(): Locator {
    return this.page.getByRole('button', { name: 'Delete post' });
  }
  /** The delete icon of the card with this exact title (the innermost block holding both). */
  deleteButtonOf(title: string): Locator {
    const card = this.page
      .locator('div')
      .filter({ has: this.page.getByText(title, { exact: true }) })
      .filter({ has: this.deleteButtons })
      .last();
    return card.getByRole('button', { name: 'Delete post' });
  }
  get shareButtons(): Locator {
    return this.page.getByRole('button', { name: 'Share post' });
  }
  /** The picture icon at the right end of the quick-post box. */
  async clickComposeIcon(): Promise<void> {
    const point = await this.page.evaluate(() => {
      const box = Array.from(document.querySelectorAll<HTMLElement>('div')).find((d) => d.children.length === 0 && d.innerText === "What's on your mind?");
      const row = box?.closest<HTMLElement>('[tabindex="0"]') ?? box?.parentElement?.parentElement;
      const r = row?.getBoundingClientRect();
      return r ? { x: r.right - 25, y: r.y + r.height / 2 } : null;
    });
    if (!point) throw new Error('compose icon not found');
    await this.page.mouse.click(point.x, point.y);
  }
  /** The round "+" button at the bottom right (56x56). */
  async clickFab(): Promise<void> {
    const fab = (await this.pressables({ w: 56, h: 56, minY: 500 }))[0];
    if (!fab) throw new Error('floating "+" button not found');
    await this.page.mouse.click(fab.x, fab.y);
  }
  get fabPresent(): Promise<boolean> {
    return this.pressables({ w: 56, h: 56, minY: 500 }).then((l) => l.length === 1);
  }
  postTitle(title: string): Locator {
    return this.page.getByText(title, { exact: true }).first();
  }
  /** Category badges on the cards (upper case, e.g. "EVENT"). */
  badges(): Promise<string[]> {
    return this.page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('div'))
        .filter((d) => d.children.length === 0 && /^(ANNOUNCEMENT|LEADERSHIP|NEWS|EVENT|GENERAL)$/.test((d.innerText ?? '').trim()))
        .map((d) => d.innerText.trim()),
    );
  }
  /** Reads the post list the app loads (GET /admin/posts) while running `action`. */
  async listResponse(action: () => Promise<unknown>): Promise<{ url: string; rows: AdminPostRow[] }> {
    const response = this.page.waitForResponse((r) => /\/admin\/posts\?/.test(r.url()) && r.request().method() === 'GET');
    await action();
    const res = await response;
    const json = (await res.json()) as { data: { content: AdminPostRow[] } };
    return { url: res.url(), rows: json.data.content };
  }
  reaction(emoji: string): Locator {
    return this.page.getByText(emoji, { exact: true }).first();
  }

  // ---------- modal ----------

  get modal(): Locator {
    return this.modalTitle;
  }
  async openCompose(): Promise<void> {
    await this.actions.click(this.composeBox, 'compose box');
    await this.settleModal();
  }
  async openViaFab(): Promise<void> {
    await this.clickFab();
    await this.settleModal();
  }
  async openViaIcon(): Promise<void> {
    await this.clickComposeIcon();
    await this.settleModal();
  }
  /** The modal slides in: wait until its title stops moving. */
  private async settleModal(): Promise<void> {
    await this.waits.forVisible(this.modalTitle);
    let last = '';
    let still = 0;
    for (let i = 0; i < 50 && still < 3; i++) {
      const now = JSON.stringify(await this.modalTitle.boundingBox({ timeout: 2_000 }).catch(() => null));
      still = now === last ? still + 1 : 0;
      last = now;
      await this.page.waitForTimeout(80); // sampling interval of an animation probe, not a wait for a condition
    }
  }
  async closeModal(): Promise<void> {
    await this.settleModal();
    const c = (await this.pressables({ w: 32, h: 34, minY: 0 }))[0];
    if (!c) throw new Error('modal close button not found');
    await this.page.mouse.click(c.x, c.y);
    await this.waits.forHidden(this.modalTitle);
  }
  /** Clicks the dimmed area to the right of the modal (outside it). */
  async clickBackdrop(): Promise<void> {
    await this.page.mouse.click(1150, 560);
  }

  get titleInput(): Locator {
    return this.page.locator('input[data-testid="text-input-outlined"]');
  }
  get bodyInput(): Locator {
    return this.page.locator('textarea[data-testid="text-input-outlined"]');
  }
  async fillTitle(value: string): Promise<void> {
    await this.actions.fill(this.titleInput, value, 'Title');
  }
  async fillBody(value: string): Promise<void> {
    await this.actions.fill(this.bodyInput, value, 'Body');
  }
  get publish(): Locator {
    return this.publishButton;
  }
  async clickPublish(): Promise<void> {
    await this.actions.click(this.publishButton, 'Publish');
  }

  /** The label above a field, e.g. "Category *" (the app draws the asterisk as part of the text). */
  fieldLabel(name: string): Locator {
    return this.page.getByText(new RegExp(`^${name}\\s*\\*?$`)).filter({ visible: true }).first();
  }
  private pill(category: PostCategory): Locator {
    return this.page.getByText(category, { exact: true }).last();
  }
  async chooseCategory(category: PostCategory): Promise<void> {
    await this.actions.click(this.pill(category), `category ${category}`);
  }
  /** Background colour of a category pill: the selected one is brand blue, the others a pale tint. */
  async pillColor(category: PostCategory): Promise<string> {
    return this.pill(category).evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg;
        node = node.parentElement;
      }
      return '';
    });
  }
  /** Categories whose pill currently has the "selected" colour. */
  async selectedCategories(): Promise<PostCategory[]> {
    const colours = await Promise.all(CATEGORIES.map((c) => this.pillColor(c)));
    const selected = 'rgb(21, 86, 133)';
    return CATEGORIES.filter((_, i) => colours[i] === selected);
  }

  audience(name: Audience): Locator {
    return this.page.getByRole('checkbox', { name });
  }
  async toggleAudience(name: Audience): Promise<void> {
    await this.actions.click(this.audience(name), `audience ${name}`);
  }
  async isAudienceChecked(name: Audience): Promise<boolean> {
    return (await this.audience(name).innerText()).includes(CHECKED_GLYPH);
  }

  // ---------- media ----------

  /** Chooses a file through the modal's Photo or Video button. */
  async attach(kind: 'Photo' | 'Video', filePath: string): Promise<void> {
    await this.actions.uploadViaChooser(this.page.getByText(kind, { exact: true }).last(), filePath, `${kind} button`);
  }
  /** Picture / video previews inside the modal (the page's own avatar image is not counted). */
  async previews(): Promise<{ images: number; videos: number }> {
    return this.page.evaluate(() => ({
      images: Array.from(document.querySelectorAll('img')).filter((e) => e.src.startsWith('data:') || e.src.startsWith('blob:')).length,
      videos: document.querySelectorAll('video').length,
    }));
  }
  /** Clicks the round "x" (28x28) on the media preview. */
  async removeMedia(): Promise<void> {
    const x = (await this.pressables({ w: 28, h: 28, minY: 0 }))[0];
    if (!x) throw new Error('media remove "x" not found');
    await this.page.mouse.click(x.x, x.y);
  }
  get hasRemoveButton(): Promise<boolean> {
    return this.pressables({ w: 28, h: 28, minY: 0 }).then((l) => l.length > 0);
  }

  // ---------- messages ----------

  /** A toast / message line by its text (messages are drawn as plain text at the bottom). */
  message(text: string | RegExp): Locator {
    return this.page.getByText(text).filter({ visible: true }).first();
  }
}
