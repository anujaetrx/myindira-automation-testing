import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export { guardWrites, pageResponse, type CapturedWrite } from '@utils/helpers/guard-writes';

export type CommunityStatusFilter = 'All' | 'Active' | 'Pending' | 'Archived' | 'Suspended';
export type CommunityTypeFilter = 'All types' | 'Clubs' | 'Groups';
export type StatLabel = 'Clubs' | 'Groups' | 'Pending' | 'Archived' | 'Open flags' | 'Review';
export const STAT_LABELS: StatLabel[] = ['Clubs', 'Groups', 'Pending', 'Archived', 'Open flags', 'Review'];

/** List call: GET /admin/communities?page=0&size=20[&status=..][&type=..] (not the stats call). */
export const LIST_API = /\/admin\/communities\?/;
export const STATS_API = /\/admin\/communities\/stats/;
export const CREATE_API = /\/admin\/communities$/;

export interface CommunityRow {
  id: number;
  slug?: string;
  name: string;
  type: 'CLUB' | 'GROUP';
  status: string;
  category?: string | null;
  description?: string;
  visibility?: string;
  memberCount: number;
  postCount?: number;
}

export interface CommunityStats {
  totalClubs: number;
  totalGroups: number;
  pendingApproval: number;
  archived: number;
  openFlags: number;
  postsUnderReview: number;
}

/** Builds a list response by hand (never route.fetch). */
export function communitiesResponse(rows: CommunityRow[]): object {
  return {
    success: true,
    message: 'Communities fetched',
    code: 'OK',
    data: { totalElements: rows.length, totalPages: rows.length ? 1 : 0, size: 20, content: rows, empty: rows.length === 0 },
  };
}

export function statsResponse(stats: CommunityStats): object {
  return { success: true, message: 'Community stats fetched', code: 'OK', data: stats };
}

/** Icon-font glyphs live in the private-use area and count as "text"; remove them before comparing. */
export const clean = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').trim();

export interface CardInfo {
  name: string;
  /** "Club" or "Group" */
  type: string;
  members: number;
  /** Text after the last "·": Active, Archived, Pending, Suspended or empty for an unknown status */
  status: string;
  /** Label of the lifecycle button on that card (Archive / Activate), '' if none */
  action: string;
}

/**
 * Admin > Communities (`/communities`): six stat tiles, a "Review flagged posts" banner, status and type filter
 * chips, community cards with a lifecycle button and a "+" FAB that opens the "New community" modal.
 * Interactions only: expectations live in the specs.
 *
 * NOT the "Communities" tab inside Social Feed (`/feed`, SocialFeedPage). React Native Web: chips, cards and
 * buttons are plain pressable `div[tabindex=0]`; the FAB and the modal close X are found by size.
 */
export class CommunitiesPage extends BasePage {
  protected readonly path = '/communities';

  private readonly banner: Locator;
  private readonly createButton: Locator;

  constructor(page: Page) {
    super(page);
    this.banner = page.getByText('Review flagged posts', { exact: true });
    this.createButton = page.getByRole('button', { name: 'Create', exact: true });
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.banner);
  }

  get screen(): Page {
    return this.page;
  }

  /** page.evaluate that re-runs when the page navigated while it was running (the app sometimes re-renders / reloads). */
  private async safeEval<R>(fn: () => R): Promise<R> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.page.evaluate(fn);
      } catch (e) {
        lastError = e;
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(500);
      }
    }
    throw lastError;
  }

  // ---------- stat tiles ----------

  /** Number shown on a tile, found as the number printed just above its label. */
  async stat(label: StatLabel): Promise<string> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.page.evaluate((l) => {
          const leaf = Array.from(document.querySelectorAll<HTMLElement>('div')).find((d) => {
            if (d.children.length > 0 || d.innerText.trim() !== l) return false;
            const prev = d.previousElementSibling as HTMLElement | null;
            return !!prev && /^\d+$/.test(prev.innerText.trim());
          });
          return ((leaf?.previousElementSibling as HTMLElement | null)?.innerText ?? '').trim();
        }, label);
      } catch {
        await this.page.waitForLoadState('domcontentloaded'); // the page navigated while reading: read again
      }
    }
    return '';
  }

  async allStats(): Promise<Record<StatLabel, string>> {
    const out = {} as Record<StatLabel, string>;
    for (const l of STAT_LABELS) out[l] = await this.stat(l);
    return out;
  }

  // ---------- banner ----------

  async openFlaggedPosts(): Promise<void> {
    await this.actions.click(this.banner, 'Review flagged posts');
  }

  get flaggedPostsTitle(): Locator {
    return this.page.getByText('Flagged posts', { exact: true });
  }

  /** Back arrow in the top-left corner of the Flagged posts screen. */
  async backFromFlagged(): Promise<void> {
    const pos = await this.page.evaluate(() => {
      const arrow = Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"], [role="button"]')).find((e) => {
        const r = e.getBoundingClientRect();
        return r.x < 60 && r.y < 64 && r.width > 0 && r.width < 60;
      });
      if (!arrow) return null;
      const r = arrow.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!pos) throw new Error('back arrow not found');
    await this.page.mouse.click(pos.x, pos.y);
  }

  // ---------- filters ----------

  private chip(label: string): Locator {
    return this.page.locator('div[tabindex="0"]').filter({ hasText: new RegExp(`^${label}$`) });
  }

  async filterStatus(f: CommunityStatusFilter): Promise<void> {
    await this.chip(f).first().click();
  }

  async filterType(f: CommunityTypeFilter): Promise<void> {
    await this.chip(f).first().click();
  }

  /** Background colour of a chip: the selected chip is drawn filled. */
  async chipBackground(label: string): Promise<string> {
    return this.chip(label).first().evaluate((e) => getComputedStyle(e).backgroundColor);
  }

  // ---------- cards ----------

  /** Card bodies (name + "Type · N Members · Status"). */
  get cards(): Locator {
    return this.page.locator('div[tabindex="0"]').filter({ hasText: /(Club|Group) · \d+ Members?( · \w*)?$/i });
  }

  get actionButtons(): Locator {
    return this.page.locator('div[tabindex="0"]').filter({ hasText: /^(Archive|Activate)$/i });
  }

  get emptyMessage(): Locator {
    return this.page.getByText('No communities', { exact: true });
  }

  /** One entry per card, in screen order. */
  async cardList(): Promise<CardInfo[]> {
    return this.page.evaluate(() => {
      const strip = (t: string) => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').trim();
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"]'));
      const cards = nodes.filter((e) => /(Club|Group) · \d+ Members?( · \w*)?$/i.test(e.textContent ?? ''));
      const buttons = nodes.filter((e) => /^(Archive|Activate)$/i.test((e.textContent ?? '').trim()));
      return cards.map((c, i) => {
        const lines = strip(c.innerText).split('\n').map((s) => s.trim()).filter(Boolean);
        const meta = lines[1] ?? '';
        const m = /^(Club|Group) · (\d+) Members?(?: · (\w*))?$/i.exec(meta);
        return {
          name: lines[0] ?? '',
          type: m?.[1] ?? '',
          members: Number(m?.[2] ?? -1),
          status: m?.[3] ?? '',
          action: strip(buttons[i]?.innerText ?? ''),
        };
      });
    });
  }

  /** Colour of the status dot of a card (green for active, grey for archived). */
  async dotColor(index: number): Promise<string> {
    return this.page.evaluate((i) => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"]'));
      const card = nodes.filter((e) => /(Club|Group) · \d+ Members?( · \w*)?$/i.test(e.textContent ?? ''))[i];
      if (!card) return '';
      const row = card.parentElement as HTMLElement;
      const cardRect = card.getBoundingClientRect();
      const dot = Array.from(row.querySelectorAll<HTMLElement>('div')).find((d) => {
        const r = d.getBoundingClientRect();
        return d.children.length === 0 && r.width > 4 && r.width < 16 && Math.abs(r.width - r.height) < 1 && r.x < cardRect.x + 4;
      });
      return dot ? getComputedStyle(dot).backgroundColor : '';
    }, index);
  }

  async clickAction(index: number): Promise<void> {
    await this.actionButtons.nth(index).click();
  }

  // ---------- create modal ----------

  /** Round "+" button (56x56 pressable). */
  async openCreate(): Promise<void> {
    const pos = await this.safeEval(() => {
      const fab = Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"]')).find((e) => {
        const r = e.getBoundingClientRect();
        return Math.abs(r.width - 56) < 2 && Math.abs(r.height - 56) < 2;
      });
      if (!fab) return null;
      const r = fab.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!pos) throw new Error('"+" button not found');
    await this.page.mouse.click(pos.x, pos.y);
    await this.waits.forVisible(this.modalTitle);
    await this.settle();
  }

  get modalTitle(): Locator {
    return this.page.getByText('New community', { exact: true });
  }

  /** The modal slides in; wait until its Create button stops moving. */
  async settle(): Promise<void> {
    let last = '';
    for (let i = 0; i < 40; i++) {
      const box = await this.createButton.boundingBox().catch(() => null);
      const key = box ? `${Math.round(box.x)},${Math.round(box.y)}` : '';
      if (key && key === last) return;
      last = key;
      await this.page.waitForTimeout(150);
    }
  }

  get createBtn(): Locator {
    return this.createButton;
  }
  get nameInput(): Locator {
    return this.page.locator('input').nth(0);
  }
  get categoryInput(): Locator {
    return this.page.locator('input').nth(1);
  }
  get descriptionInput(): Locator {
    return this.page.locator('textarea').first();
  }

  async fillForm(f: { name?: string; description?: string; category?: string }): Promise<void> {
    if (f.name !== undefined) await this.nameInput.fill(f.name);
    if (f.description !== undefined) await this.descriptionInput.fill(f.description);
    if (f.category !== undefined) await this.categoryInput.fill(f.category);
  }

  async pickType(t: 'Club' | 'Group'): Promise<void> {
    await this.page.getByText(t, { exact: true }).last().click();
  }

  async pickVisibility(v: 'Public' | 'Restricted' | 'Private'): Promise<void> {
    await this.page.getByText(v, { exact: true }).last().click();
  }

  /** Background colour of a modal pill: the selected pill is filled. */
  async pillBackground(label: string): Promise<string> {
    return this.page
      .getByText(label, { exact: true })
      .last()
      .evaluate((e) => {
        let n: HTMLElement | null = e as HTMLElement;
        while (n && getComputedStyle(n).backgroundColor === 'rgba(0, 0, 0, 0)') n = n.parentElement;
        return n ? getComputedStyle(n).backgroundColor : '';
      });
  }

  async uploadLogo(file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
    const trigger = this.page.getByText(/^(Upload|Change) logo$/).last();
    const [chooser] = await Promise.all([this.page.waitForEvent('filechooser'), trigger.click()]);
    await chooser.setFiles(file);
  }

  get logoLabel(): Locator {
    return this.page.getByText(/^(Upload|Change) logo$/).last();
  }

  async submit(): Promise<void> {
    await this.createButton.click();
  }

  /** The "New community" text of the modal body (counter, hints), for message checks. */
  async modalText(): Promise<string> {
    const body = await this.page.locator('body').innerText();
    return clean(body.split('New community')[1] ?? '');
  }

  /** Round X at the top left of the modal (32x34 pressable). */
  async closeModal(): Promise<void> {
    const pos = await this.safeEval(() => {
      const x = Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"]')).find((e) => {
        const r = e.getBoundingClientRect();
        return Math.abs(r.width - 32) < 3 && Math.abs(r.height - 34) < 3;
      });
      if (!x) return null;
      const r = x.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!pos) throw new Error('modal close X not found');
    await this.page.mouse.click(pos.x, pos.y);
  }

  get dismiss(): Locator {
    return this.page.getByText('Dismiss', { exact: true });
  }
}
