import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export type FeedTab = 'My Feed' | 'University' | 'Birthdays' | 'Communities';
const TABS: FeedTab[] = ['My Feed', 'University', 'Birthdays', 'Communities'];
export type FilterLevel = 'School' | 'Programme' | 'Batch' | 'Semester';
const FILTERS: FilterLevel[] = ['School', 'Programme', 'Batch', 'Semester'];

/** Icon-font glyphs live in the private-use area and count as "text"; remove them before comparing. */
const clean = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').trim();

export { guardWrites, pageResponse, type CapturedWrite } from '@utils/helpers/guard-writes';

/**
 * Admin > Social Feed (`/feed`): four tabs, cascading School/Programme/Batch/Semester filters, a compose box
 * and "Create Post" modal, post cards (reactions, comment, share, delete) and the post detail screen.
 * Interactions only: expectations live in the specs.
 *
 * React Native Web: most controls are plain pressable <div>s (tabs, filters, round icons), located by size.
 */
export class SocialFeedPage extends BasePage {
  protected readonly path = '/feed';

  private readonly composeBox: Locator;
  private readonly modalTitle: Locator;
  private readonly postButton: Locator;
  private readonly textArea: Locator;

  constructor(page: Page) {
    super(page);
    this.composeBox = page.getByText("What's on your mind?", { exact: true }).first();
    this.modalTitle = page.getByText('Create Post', { exact: true });
    this.postButton = page.getByRole('button', { name: 'Post', exact: true });
    this.textArea = page.getByPlaceholder("What's on your mind?").last();
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.composeBox);
  }

  /** The underlying page, for assertions that are not tied to one element (messages, timing). */
  get screen(): Page {
    return this.page;
  }

  // ---------- generic: pressable <div tabindex=0> found by geometry ----------

  private async pressables(match: { w?: number; h?: number; minX?: number; maxX?: number; minY?: number; maxY?: number }) {
    return this.page.evaluate((m) => {
      return Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"], [role="button"]'))
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(
          ({ r }) =>
            (m.w === undefined || Math.abs(r.width - m.w) < 2) &&
            (m.h === undefined || Math.abs(r.height - m.h) < 2) &&
            (m.minX === undefined || r.x >= m.minX) &&
            (m.maxX === undefined || r.x <= m.maxX) &&
            (m.minY === undefined || r.y >= m.minY) &&
            (m.maxY === undefined || r.y <= m.maxY) &&
            r.width > 0,
        )
        .sort((a, b) => a.r.x - b.r.x || a.r.y - b.r.y)
        .map(({ e, r }) => ({
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          text: e.innerText ?? '',
          ariaDisabled: e.getAttribute('aria-disabled'),
        }));
    }, match);
  }

  private async clickPressable(match: Parameters<SocialFeedPage['pressables']>[0], index: number, label: string): Promise<void> {
    const list = await this.pressables(match);
    if (!list[index]) throw new Error(`${label} not found`);
    await this.page.mouse.click(list[index].x, list[index].y);
  }

  // ---------- tabs ----------

  /** The four tab buttons, left to right (72x87 icons under the app bar). */
  private tabMatch = { w: 72, h: 87, maxY: 120 };

  async openTab(tab: FeedTab): Promise<void> {
    await this.clickPressable(this.tabMatch, TABS.indexOf(tab), `tab "${tab}"`);
  }

  /** Text lines inside a tab button: its label, plus a number when a badge is shown. */
  async tabText(tab: FeedTab): Promise<string[]> {
    const list = await this.pressables(this.tabMatch);
    return (list[TABS.indexOf(tab)]?.text ?? '').split('\n').map(clean).filter(Boolean);
  }

  /** Colour of a tab's label: the active tab is drawn in a different colour from the others. */
  async tabLabelColor(tab: FeedTab): Promise<string> {
    const idx = TABS.indexOf(tab);
    return this.page.evaluate(
      ({ idx, name }) => {
        const tabs = Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"]'))
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return Math.abs(r.width - 72) < 2 && Math.abs(r.height - 87) < 2 && r.y < 120;
          })
          .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x);
        const label = Array.from(tabs[idx].querySelectorAll<HTMLElement>('div')).find((d) => d.children.length === 0 && d.innerText.trim() === name);
        return label ? getComputedStyle(label).color : '';
      },
      { idx, name: tab },
    );
  }

  /** Marks the window so a test can prove the page was not fully reloaded. */
  async markWindow(): Promise<void> {
    await this.page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));
  }
  async windowKept(): Promise<boolean> {
    return this.page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept === true);
  }

  get universityEmpty(): Locator {
    return this.page.getByText('No university posts in this category', { exact: true });
  }
  universityChip(name: string): Locator {
    return this.page.getByText(name, { exact: true }).first();
  }
  get birthdaysNone(): Locator {
    return this.page.getByText('No birthdays today', { exact: true });
  }
  get birthdayHeadline(): Locator {
    return this.page.getByText(/Happy Birthday!/).first();
  }
  get feedFilteredEmpty(): Locator {
    return this.page.getByText('No posts match this filter', { exact: true });
  }
  get feedEmpty(): Locator {
    return this.page.getByText('No posts yet. Be the first to share!', { exact: true });
  }

  // ---------- filters ----------

  private filterMatch = { h: 31, minY: 170, maxY: 230 };

  /**
   * Text of the four filter chips in order ("School" until something is chosen). Reads every chip, enabled or
   * not: a disabled chip is not focusable, so it never shows up among the pressable elements.
   */
  async filterLabels(): Promise<string[]> {
    const raw = await this.page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('div'))
        .filter((d) => {
          const r = d.getBoundingClientRect();
          return d.children.length === 0 && r.y > 175 && r.y < 230 && r.x > 240 && (d.innerText ?? '').trim() !== '';
        })
        .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x)
        .map((d) => d.innerText),
    );
    return raw.map(clean).filter((t) => t && t !== 'Clear all' && !/^\d+$/.test(t));
  }
  async filterLabel(level: FilterLevel): Promise<string> {
    return (await this.filterLabels())[FILTERS.indexOf(level)] ?? '';
  }
  /** Labels of the chips that can currently be pressed. */
  async enabledFilters(): Promise<string[]> {
    const list = await this.pressables(this.filterMatch);
    return list.map((p) => clean(p.text)).filter((t) => t && t !== 'Clear all');
  }
  /** Centre of a filter chip's label (found by its text, in left-to-right order, so icons never shift the index). */
  private async chipPoint(level: FilterLevel): Promise<{ x: number; y: number }> {
    const idx = FILTERS.indexOf(level);
    const points = await this.page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('div'))
        .filter((d) => {
          const r = d.getBoundingClientRect();
          return d.children.length === 0 && r.y > 175 && r.y < 230 && r.x > 240 && (d.innerText ?? '').trim() !== '';
        })
        .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x)
        .map((d) => {
          const r = d.getBoundingClientRect();
          return { text: d.innerText, x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }),
    );
    const chips = points.filter((p) => {
      const t = clean(p.text);
      return t && t !== 'Clear all' && !/^\d+$/.test(t);
    });
    if (!chips[idx]) throw new Error(`filter "${level}" not found`);
    return chips[idx];
  }

  /**
   * Opens a filter's picker. The picker slides in, and when the feed data arrives the filter bar re-renders and
   * can close it again, so: click, wait for it, let it settle, and confirm it is still open (retry if not).
   */
  async openFilter(level: FilterLevel): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const p = await this.chipPoint(level);
      await this.page.mouse.click(p.x, p.y);
      try {
        await this.waits.forVisible(this.pickerAll(level), 6_000);
        await this.page.waitForTimeout(1_500); // settle: clicking an option mid-slide is lost
        if (await this.pickerAll(level).isVisible()) return;
      } catch (error) {
        if (attempt >= 4) throw error;
      }
      if (attempt >= 4) throw new Error(`The ${level} picker keeps closing`);
    }
  }

  /**
   * Opens a filter, picks an option and checks the chip now shows it. If a click was swallowed (the picker is
   * animated and the click can land mid-slide), reloads and tries again; `retryable` is false when the page state
   * built so far must not be lost.
   */
  async selectFilter(level: FilterLevel, name: string, retryable = true): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.openFilter(level);
        await this.choosePicker(name);
        await expect_label(this, level, name.slice(0, 8));
        return;
      } catch (error) {
        if (!retryable || attempt >= 3) throw error;
        await this.page.reload();
        await this.waitForReady();
      }
    }
  }

  /** The picker that opens for a filter has its own heading ("School", "Programme", ...). */
  pickerAll(level: FilterLevel): Locator {
    const all = { School: 'All schools', Programme: 'All programmes', Batch: 'All batches', Semester: 'All semesters' }[level];
    return this.page.getByText(all, { exact: true });
  }
  async pickerOptions(): Promise<string[]> {
    // Options are the rows between the picker heading and its close X; read every leaf text in the open picker.
    const raw = await this.page.evaluate(() => {
      const all = Array.from(document.querySelectorAll<HTMLElement>('div')).filter((d) => /^All (schools|programmes|batches|semesters)$/.test((d.innerText ?? '').trim()) && d.children.length === 0);
      const first = all[0];
      if (!first) return [];
      let panel: HTMLElement | null = first;
      for (let i = 0; i < 6 && panel; i++) {
        panel = panel.parentElement;
        if (panel && panel.getBoundingClientRect().width > 400 && panel.getBoundingClientRect().height > 250) break;
      }
      return Array.from((panel ?? document.body).querySelectorAll<HTMLElement>('div'))
        .filter((d) => d.children.length === 0)
        .map((d) => d.innerText ?? '');
    });
    return raw.map(clean).filter(Boolean);
  }
  async choosePicker(name: string): Promise<void> {
    const option = this.page.getByText(name, { exact: true }).filter({ visible: true }).last();
    await this.waits.forVisible(option);
    // The picker slides in: wait until the option has stopped moving, or the click lands on another row.
    let last = '';
    let still = 0;
    for (let i = 0; i < 50 && still < 3; i++) {
      const now = JSON.stringify(await option.boundingBox({ timeout: 2_000 }).catch(() => null));
      still = now === last ? still + 1 : 0;
      last = now;
      await this.page.waitForTimeout(80); // sampling interval of an animation probe, not a wait for a condition
    }
    // force: the picker keeps animating while the machine is busy, so Playwright's "stable" check never settles
    await option.click({ force: true, timeout: 20_000 });
  }
  async clearAllFilters(): Promise<void> {
    await this.actions.click(this.page.getByText('Clear all', { exact: true }), 'Clear all');
  }

  // ---------- compose / modal ----------

  get compose(): Locator {
    return this.composeBox;
  }
  async openCompose(): Promise<void> {
    await this.actions.click(this.composeBox, 'compose box');
    await this.waits.forVisible(this.modalTitle);
  }
  /** The small Photo / Video icons at the right of the compose box (36x36). */
  async openComposeViaIcon(which: 'photo' | 'video'): Promise<void> {
    await this.clickPressable({ w: 36, h: 36, minY: 200, maxY: 320 }, which === 'photo' ? 0 : 1, `compose ${which} icon`);
    await this.waits.forVisible(this.modalTitle);
  }
  async closeModal(): Promise<void> {
    // The modal slides in: wait until the 32x34 close button stops moving, then click it.
    let c = (await this.pressables({ w: 32, h: 34 }))[0];
    for (let i = 0; i < 40 && c; i++) {
      await this.page.waitForTimeout(100); // sampling interval of an animation probe, not a wait for a condition
      const next = (await this.pressables({ w: 32, h: 34 }))[0];
      const still = next && Math.abs(next.y - c.y) < 0.5;
      c = next ?? c;
      if (still) break;
    }
    if (!c) throw new Error('modal close button not found');
    await this.page.mouse.click(c.x, c.y);
    await this.waits.forHidden(this.modalTitle);
  }
  get modal(): Locator {
    return this.modalTitle;
  }
  get post(): Locator {
    return this.postButton;
  }
  get text(): Locator {
    return this.textArea;
  }
  async type(value: string): Promise<void> {
    await this.actions.fill(this.textArea, value, 'post text');
  }
  /** Chooses a file through the modal's Photo or Video button. */
  async attach(kind: 'Photo' | 'Video', filePath: string): Promise<void> {
    await this.actions.uploadViaChooser(this.page.getByText(kind, { exact: true }).last(), filePath, `${kind} button`);
  }
  /** Number of picture / video previews shown in the modal. */
  async previews(): Promise<{ images: number; videos: number }> {
    return this.page.evaluate(() => ({
      images: Array.from(document.querySelectorAll('img')).filter((e) => e.src.startsWith('data:') || e.src.startsWith('blob:')).length,
      videos: document.querySelectorAll('video').length,
    }));
  }
  async submitPost(): Promise<void> {
    await this.actions.click(this.postButton, 'Post');
  }

  // ---------- post cards ----------

  get deleteButtons(): Locator {
    return this.page.getByRole('button', { name: 'Delete post' });
  }
  get commentButtons(): Locator {
    return this.page.getByRole('button', { name: 'Comment on post' });
  }
  get shareButtons(): Locator {
    return this.page.getByRole('button', { name: 'Share post' });
  }
  /** The reaction emoji buttons of the first post card. */
  reaction(emoji: string): Locator {
    return this.page.getByText(emoji, { exact: true }).first();
  }

  // ---------- post detail / comments ----------

  get commentInput(): Locator {
    return this.page.getByPlaceholder('Write a comment...');
  }
  get noComments(): Locator {
    return this.page.getByText('No comments yet', { exact: true });
  }
  /**
   * The send icon of the comment box: a 34x34 div at the bottom right. While disabled it is NOT focusable
   * (tabindex -1, aria-disabled=true), so it cannot be found among the pressables.
   */
  private async sendIcon(): Promise<{ x: number; y: number; disabled: boolean } | null> {
    return this.page.evaluate(() => {
      const el = Array.from(document.querySelectorAll<HTMLElement>('div')).find((d) => {
        const r = d.getBoundingClientRect();
        return Math.abs(r.width - 34) < 2 && Math.abs(r.height - 34) < 2 && r.y > window.innerHeight - 130 && r.x > window.innerWidth * 0.55 && d.hasAttribute('tabindex');
      });
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: el.getAttribute('aria-disabled') === 'true' };
    });
  }
  async commentSend(): Promise<{ disabled: boolean }> {
    const icon = await this.sendIcon();
    if (!icon) throw new Error('comment send icon not found');
    return { disabled: icon.disabled };
  }
  async clickCommentSend(): Promise<void> {
    const icon = await this.sendIcon();
    if (!icon) throw new Error('comment send icon not found');
    await this.page.mouse.click(icon.x, icon.y);
  }

  // ---------- communities tab ----------

  get communitiesHeading(): Locator {
    return this.page.getByText('Clubs & Groups', { exact: true });
  }
  get flagButtons(): Locator {
    return this.page.getByRole('button', { name: 'Flag post' });
  }
  get flaggedMarkers(): Locator {
    return this.page.getByText('Flagged', { exact: true });
  }

  // ---------- data from the page's own API calls ----------

  /** Reads the post list the app loaded (GET /social-feed) while running `action`. */
  async feedResponse<T = { id: number; body: string }>(action: () => Promise<unknown>): Promise<T[]> {
    const response = this.page.waitForResponse((r) => /\/social-feed\?/.test(r.url()) && r.request().method() === 'GET');
    await action();
    const json = (await (await response).json()) as { data: { content: T[] } };
    return json.data.content;
  }
}

async function expect_label(page: SocialFeedPage, level: FilterLevel, startsWith: string): Promise<void> {
  const deadline = Date.now() + 6_000;
  while (Date.now() < deadline) {
    if ((await page.filterLabel(level)).startsWith(startsWith)) return;
    await page.screen.waitForTimeout(200); // polling interval while the chip label updates
  }
  throw new Error(`Filter "${level}" did not change to "${startsWith}..." (shows "${await page.filterLabel(level)}")`);
}
