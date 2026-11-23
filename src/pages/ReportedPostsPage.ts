import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Icon-font glyphs live in the private-use area and count as "text"; remove them before comparing. */
export const cleanGlyphs = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').trim();

export { guardWrites, pageResponse, type CapturedWrite } from '@utils/helpers/guard-writes';

/** API path of the queue (GET, page 0, size 50). */
export const REPORTED_API = /\/myindiranew\/api\/admin\/reported-posts/;

/** A reported post as the API returns it (fields the screen reads). */
export interface ReportedPost {
  id: number;
  title?: string | null;
  body: string;
  createdByName: string;
  createdAt: string;
  reportCount: number;
}

/**
 * Admin > Reported Posts (`/reported-posts`): header with a red flag, title and "N posts" counter; one card per
 * reported post (report-count badge, author, relative time, trash icon, title, body); an empty state.
 * Interactions only: expectations live in the specs.
 */
export class ReportedPostsPage extends BasePage {
  protected readonly path = '/reported-posts';

  constructor(page: Page) {
    super(page);
  }

  /** The screen has either the header (list or empty) or the red error text; all of them are stable end states. */
  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.counter.or(this.errorText));
  }

  /** The underlying page, for assertions that are not tied to one element. */
  get screen(): Page {
    return this.page;
  }

  // ---------- header ----------

  /** Header title (the sidebar item has the same text and comes first in the DOM, so take the last one). */
  get heading(): Locator {
    return this.page.getByText('Reported Posts', { exact: true }).last();
  }
  /** "N posts" badge at the right of the header. */
  get counter(): Locator {
    return this.page.getByText(/^\d+ posts?$/);
  }
  /** Colour of the icon-font glyph drawn in the header row ('' when there is none). */
  async headerIconColor(): Promise<string> {
    return this.glyphColor(0, 130);
  }
  /** Colour of the icon-font glyph drawn in the empty state ('' when there is none). */
  async emptyIconColor(): Promise<string> {
    return this.glyphColor(150, 600);
  }
  private async glyphColor(minY: number, maxY: number): Promise<string> {
    return this.page.evaluate(
      ({ minY, maxY }) => {
        const glyph = /^[-\u{F0000}-\u{FFFFD}]+$/u;
        const el = Array.from(document.querySelectorAll<HTMLElement>('div')).find((d) => {
          const r = d.getBoundingClientRect();
          return d.children.length === 0 && r.x > 300 && r.y > minY && r.y < maxY && glyph.test((d.innerText ?? '').trim());
        });
        return el ? getComputedStyle(el).color : '';
      },
      { minY, maxY },
    );
  }

  // ---------- sidebar ----------

  /** The "Reported Posts" item of the left menu. */
  get sidebarItem(): Locator {
    return this.page.getByText('Reported Posts', { exact: true }).first();
  }
  async openFromSidebar(): Promise<void> {
    await this.actions.click(this.sidebarItem, 'sidebar "Reported Posts"');
  }

  // ---------- states ----------

  get emptyTitle(): Locator {
    return this.page.getByText('No reported posts', { exact: true });
  }
  get emptySubtitle(): Locator {
    return this.page.getByText('All clear! No posts have been reported.', { exact: true });
  }
  /** Red text shown when the list call fails. */
  get errorText(): Locator {
    return this.page.getByText('Failed to load reported posts', { exact: true });
  }
  /** Any "Retry" control (the story asks for one next to the error). */
  get retryControl(): Locator {
    return this.page.getByText(/^retry$/i).or(this.page.getByRole('button', { name: /retry/i }));
  }

  // ---------- cards ----------

  get deleteButtons(): Locator {
    return this.page.locator('[aria-label="Delete post"]');
  }
  get reportBadges(): Locator {
    return this.page.getByText(/^\d+ reports?$/);
  }
  /** Buttons the story names for the moderation workflow. */
  get dismissControls(): Locator {
    return this.page.getByText(/dismiss/i).or(this.page.getByRole('button', { name: /dismiss|approve/i }));
  }
  get warnControls(): Locator {
    return this.page.getByText(/warn|suspend/i);
  }
  text(value: string | RegExp): Locator {
    return this.page.getByText(value).filter({ visible: true });
  }
  /** The n-th card's delete button (cards are listed in API order). */
  async deletePost(index: number): Promise<void> {
    await this.actions.click(this.deleteButtons.nth(index), `delete post #${index + 1}`);
  }
  /** Clicks delete and answers the browser confirm(); returns the message that was shown. */
  async deleteAndAnswer(index: number, accept: boolean): Promise<string> {
    let message = '';
    this.page.once('dialog', (d) => {
      message = d.message();
      void (accept ? d.accept() : d.dismiss());
    });
    await this.deleteButtons.nth(index).click();
    return message;
  }

  /** Marks the window so a test can prove the page was not fully reloaded. */
  async markWindow(): Promise<void> {
    await this.page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));
  }
  async windowKept(): Promise<boolean> {
    return this.page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept === true);
  }

  /** Height in px of the first card's body text block (to prove the 4-line clamp). */
  async bodyHeight(snippet: string): Promise<number> {
    return this.page.evaluate((s) => {
      const el = Array.from(document.querySelectorAll<HTMLElement>('div')).filter((d) => (d.innerText ?? '').startsWith(s) && d.getBoundingClientRect().height > 0).pop();
      return el ? el.getBoundingClientRect().height : 0;
    }, snippet);
  }

  // ---------- data from the page's own API call ----------

  /** Reads the queue the app loaded (GET /admin/reported-posts) while running `action`. */
  async queueResponse(action: () => Promise<unknown>): Promise<{ totalElements: number; content: ReportedPost[] }> {
    const response = this.page.waitForResponse((r) => REPORTED_API.test(r.url()) && r.request().method() === 'GET');
    await action();
    const json = (await (await response).json()) as { data: { totalElements: number; content: ReportedPost[] } };
    return json.data;
  }
}
