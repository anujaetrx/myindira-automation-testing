import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export type AckAudience = 'Students' | 'Employees';

/** Icon-font glyphs live in the private-use area and count as "text"; remove them before comparing. */
const clean = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').trim();

/**
 * Admin > Acknowledgements: Pending / Completed tabs, request cards, and the "Create Acknowledgement" modal
 * (Title, Description, Deadline date input, Assign To checkboxes). Interactions only: expectations live in specs.
 *
 * React Native Web: the round "+" and the modal's close X are plain pressable <div>s, located by size.
 */
export class AcknowledgementsPage extends BasePage {
  protected readonly path = '/acknowledgements';

  private readonly pendingTab: Locator;
  private readonly completedTab: Locator;
  private readonly cardsLocator: Locator;
  private readonly pendingBadge: Locator;
  private readonly modalTitle: Locator;
  private readonly publishButton: Locator;
  private readonly titleInput: Locator;
  private readonly descriptionInput: Locator;
  private readonly deadlineInput: Locator;

  constructor(page: Page) {
    super(page);
    this.pendingTab = page.getByRole('button', { name: 'Pending', exact: true });
    this.completedTab = page.getByRole('button', { name: 'Completed', exact: true });
    this.cardsLocator = page.getByTestId('card');
    this.pendingBadge = page.getByText(/^\d+ pending$/);
    this.modalTitle = page.getByText('Create Acknowledgement', { exact: true });
    this.publishButton = page.getByRole('button', { name: 'Publish', exact: true });
    this.titleInput = page.getByTestId('text-input-outlined').nth(0);
    this.descriptionInput = page.getByTestId('text-input-outlined').nth(1);
    this.deadlineInput = page.locator('input[type="date"]');
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.pendingTab);
    await this.waits.forVisible(this.completedTab);
  }

  // ---------- list ----------

  get pending(): Locator {
    return this.pendingTab;
  }
  get completed(): Locator {
    return this.completedTab;
  }
  get badge(): Locator {
    return this.pendingBadge;
  }
  get cards(): Locator {
    return this.cardsLocator;
  }
  get pendingEmpty(): Locator {
    return this.page.getByText('No pending acknowledgement requests', { exact: true });
  }
  get completedEmpty(): Locator {
    return this.page.getByText('No completed acknowledgement requests', { exact: true });
  }
  async openCompleted(): Promise<void> {
    await this.actions.click(this.completedTab, 'Completed tab');
  }
  async openPending(): Promise<void> {
    await this.actions.click(this.pendingTab, 'Pending tab');
  }
  /** Background colour of a tab: the selected tab is filled with the brand blue. */
  async tabIsSelected(tab: 'Pending' | 'Completed'): Promise<boolean> {
    const el = tab === 'Pending' ? this.pendingTab : this.completedTab;
    return el.evaluate((e) => {
      const chain: HTMLElement[] = [e as HTMLElement, ...Array.from((e as HTMLElement).querySelectorAll<HTMLElement>('div'))];
      return chain.some((n) => getComputedStyle(n).backgroundColor === 'rgb(21, 86, 133)');
    });
  }

  async readCards(): Promise<{ title: string; status: string; author: string; deadline: string; lines: string[] }[]> {
    const n = await this.cardsLocator.count();
    const out: { title: string; status: string; author: string; deadline: string; lines: string[] }[] = [];
    for (let i = 0; i < n; i++) {
      const lines = (await this.cardsLocator.nth(i).innerText()).split('\n').map(clean).filter(Boolean);
      out.push({
        title: lines[0],
        status: lines[1],
        author: lines[2],
        deadline: lines.find((l) => l.startsWith('Deadline:')) ?? '',
        lines,
      });
    }
    return out;
  }

  /** Colour of the "Deadline: ..." text on the first card. */
  async deadlineColor(card: Locator): Promise<string> {
    return card.getByText(/^Deadline:/).evaluate((e) => getComputedStyle(e).color);
  }

  // ---------- create modal ----------

  private async pressable(w: number, h: number, within: { minX?: number; minY?: number; maxX?: number; maxY?: number }, label: string) {
    const box = await this.page.evaluate(
      ({ w, h, within }) => {
        const el = Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"]')).find((e) => {
          const r = e.getBoundingClientRect();
          return (
            Math.abs(r.width - w) < 2 &&
            Math.abs(r.height - h) < 2 &&
            r.x >= (within.minX ?? -Infinity) &&
            r.x <= (within.maxX ?? Infinity) &&
            r.y >= (within.minY ?? -Infinity) &&
            r.y <= (within.maxY ?? Infinity)
          );
        });
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      },
      { w, h, within },
    );
    if (!box) throw new Error(`${label} not found`);
    return box;
  }

  async openCreateModal(): Promise<void> {
    const c = await this.pressable(56, 56, { minX: 500, minY: 400 }, '"+" button');
    await this.page.mouse.click(c.x, c.y);
    await this.waits.forVisible(this.modalTitle);
  }
  async closeCreateModal(): Promise<void> {
    // The modal slides in, so wait until the button has stopped moving before clicking it.
    let c = await this.pressable(32, 34, {}, 'modal close button');
    for (let i = 0; i < 40; i++) {
      await this.page.waitForTimeout(100); // sampling interval of an animation probe, not a wait for a condition
      const next = await this.pressable(32, 34, {}, 'modal close button');
      const still = Math.abs(next.y - c.y) < 0.5;
      c = next;
      if (still) break;
    }
    await this.page.mouse.click(c.x, c.y);
    await this.waits.forHidden(this.modalTitle);
  }
  /** Clicks the dimmed area outside the modal. */
  async clickBackdrop(): Promise<void> {
    const vp = this.page.viewportSize() ?? { width: 1280, height: 720 };
    await this.page.mouse.click(vp.width - 40, vp.height / 2);
    await this.page.waitForTimeout(800); // give a dismiss animation time to run before the caller asserts
  }

  get modal(): Locator {
    return this.modalTitle;
  }
  get publish(): Locator {
    return this.publishButton;
  }
  get titleField(): Locator {
    return this.titleInput;
  }
  get descriptionField(): Locator {
    return this.descriptionInput;
  }
  get deadlineField(): Locator {
    return this.deadlineInput;
  }

  async setTitle(v: string): Promise<void> {
    await this.actions.fill(this.titleInput, v, 'title');
  }
  async setDescription(v: string): Promise<void> {
    await this.actions.fill(this.descriptionInput, v, 'description');
  }
  /** `iso` is yyyy-mm-dd (the value format of a native date input). */
  async setDeadline(iso: string): Promise<void> {
    await this.deadlineInput.fill(iso);
  }
  async deadlineValue(): Promise<string> {
    return this.deadlineInput.inputValue();
  }
  async deadlineMin(): Promise<string> {
    return this.deadlineInput.evaluate((e) => (e as HTMLInputElement).min);
  }

  audience(name: AckAudience): Locator {
    return this.page.getByRole('checkbox', { name });
  }
  async toggleAudience(name: AckAudience): Promise<void> {
    await this.actions.click(this.audience(name), `audience ${name}`);
  }
  /** The checkbox has no aria-checked: a checked box renders the icon glyph U+F0132 (mdi checkbox-marked). */
  async isAudienceChecked(name: AckAudience): Promise<boolean> {
    const text = await this.audience(name).evaluate((e) => (e as HTMLElement).innerText);
    return text.includes('\u{F0132}');
  }

  async fillValid(): Promise<void> {
    await this.setTitle('Ack title');
    await this.setDescription('Ack description');
    await this.setDeadline(futureIso());
    await this.toggleAudience('Employees');
  }

  /** WRITES DATA and notifies users: only from gated tests. */
  async publishAndWait(): Promise<number> {
    const [res] = await Promise.all([
      this.page.waitForResponse((r) => /\/admin\/acknowledgement-requests/.test(r.url()) && r.request().method() === 'POST', { timeout: 30_000 }),
      this.actions.click(this.publishButton, 'Publish'),
    ]);
    return res.status();
  }
}

/** A date well in the future as yyyy-mm-dd (a year from today). */
export function futureIso(daysAhead = 365): string {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}
