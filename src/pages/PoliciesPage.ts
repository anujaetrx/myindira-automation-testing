import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export type Audience = 'Students' | 'Employees';

/** Icon-font glyphs live in the private-use area and count as "text"; remove them before comparing. */
const clean = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').trim();

/** Brand blue used by the app for a selected pill (department chip). */
const SELECTED_PILL_BG = 'rgb(21, 86, 133)';

/**
 * Admin > Policies: policy cards, department filter flyout, "Create Policy" modal (4-step tracker),
 * policy detail page, and Archive (native confirm). Interactions only: expectations live in the specs.
 *
 * The app is React Native Web: many controls are plain pressable <div>s without roles, so some are located by
 * geometry (the round "+" button, the modal's close button).
 */
export class PoliciesPage extends BasePage {
  protected readonly path = '/policies';

  private readonly filterButton: Locator;
  private readonly countHeader: Locator;
  private readonly cardsLocator: Locator;
  private readonly modalTitle: Locator;
  private readonly progressText: Locator;
  private readonly publishButton: Locator;
  private readonly titleInput: Locator;
  private readonly contentInput: Locator;
  private readonly attachButton: Locator;
  private readonly filterSearch: Locator;

  constructor(page: Page) {
    super(page);
    this.filterButton = page.getByRole('button', { name: /^Department filter/ });
    // "8 policies", "1 policy", "3 policies in Computer Science"
    this.countHeader = page.getByText(/^\d+ policies?( in .+)?$/);
    this.cardsLocator = page.getByTestId('card');
    this.modalTitle = page.getByText('Create Policy', { exact: true });
    this.progressText = page.getByText(/^\d\/4 completed$/);
    this.publishButton = page.getByRole('button', { name: /Publish/ });
    this.titleInput = page.getByTestId('text-input-outlined').nth(0);
    this.contentInput = page.getByTestId('text-input-outlined').nth(1);
    this.attachButton = page.getByRole('button', { name: 'Attach a policy document' });
    this.filterSearch = page.getByPlaceholder('Search departments');
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.filterButton);
  }

  // ---------- list ----------

  get header(): Locator {
    return this.countHeader;
  }
  get cards(): Locator {
    return this.cardsLocator;
  }
  card(title: string): Locator {
    return this.cardsLocator.filter({ hasText: title });
  }
  get filter(): Locator {
    return this.filterButton;
  }

  /** Reads the visible cards: title, department badge, author and date lines. */
  async readCards(): Promise<{ title: string; department: string; text: string }[]> {
    const n = await this.cardsLocator.count();
    const out: { title: string; department: string; text: string }[] = [];
    for (let i = 0; i < n; i++) {
      const lines = (await this.cardsLocator.nth(i).innerText()).split('\n').map(clean).filter(Boolean);
      out.push({ title: lines[0], department: lines[1], text: lines.join('\n') });
    }
    return out;
  }

  async openPolicy(title: string): Promise<void> {
    await this.actions.click(this.page.getByRole('button', { name: `Open policy ${title}` }).first(), `policy "${title}"`);
  }

  /** The detail screen ("Policy" header with a back arrow). */
  get detailBack(): Locator {
    return this.page.getByRole('button', { name: 'Go back' });
  }
  get detailDownload(): Locator {
    return this.page.getByRole('button', { name: 'Download policy as PDF' });
  }

  // ---------- department filter ----------

  async openFilter(): Promise<void> {
    await this.actions.click(this.filterButton, 'department filter');
    await this.waits.forVisible(this.page.getByText('Filter by department', { exact: true }));
  }
  get filterHeading(): Locator {
    return this.page.getByText('Filter by department', { exact: true });
  }
  get filterSearchBox(): Locator {
    return this.filterSearch;
  }
  async searchFilter(text: string): Promise<void> {
    await this.actions.fill(this.filterSearch, text, 'department search');
  }
  /** Option rows of the open flyout (exact department names, plus "All"). */
  filterOption(name: string): Locator {
    // Cards also show department badges, so scope to the flyout: the option sits under the search box.
    return this.page.getByText(name, { exact: true }).last();
  }
  async chooseFilter(name: string): Promise<void> {
    await this.actions.clickThrough(this.filterOption(name), `filter option "${name}"`);
  }
  /** Names listed in the open flyout, in order ("All" first). */
  async filterOptionNames(): Promise<string[]> {
    const raw = await this.page.evaluate(() => {
      const input = document.querySelector('input[placeholder="Search departments"]');
      let panel: HTMLElement | null = input as HTMLElement | null;
      for (let i = 0; i < 3 && panel; i++) panel = panel.parentElement;
      if (!panel) return [];
      return Array.from(panel.querySelectorAll<HTMLElement>('div'))
        .filter((d) => d.children.length === 0)
        .map((d) => d.innerText ?? '');
    });
    return raw.map(clean).filter((t) => t && t !== 'Filter by department');
  }
  get noFilterMatch(): Locator {
    return this.page.getByText(/^No departments match/);
  }

  // ---------- create modal ----------

  /** Finds a pressable <div tabindex=0> by its size and position (it has no role or label to use). */
  private async pressable(size: number, within: { minX?: number; minY?: number; maxY?: number }, label: string): Promise<{ x: number; y: number }> {
    const box = await this.page.evaluate(
      ({ size, within }) => {
        const el = Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"]')).find((e) => {
          const r = e.getBoundingClientRect();
          return (
            Math.abs(r.width - size) < 2 &&
            Math.abs(r.height - size) < 2 &&
            r.x >= (within.minX ?? -Infinity) &&
            r.y >= (within.minY ?? -Infinity) &&
            r.y <= (within.maxY ?? Infinity)
          );
        });
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      },
      { size, within },
    );
    if (!box) throw new Error(`${label} not found`);
    return box;
  }

  async openCreateModal(): Promise<void> {
    // Round 56x56 "+" button in the bottom-right corner.
    const c = await this.pressable(56, { minX: 800, minY: 500 }, '"+" button');
    await this.page.mouse.click(c.x, c.y);
    await this.waits.forVisible(this.modalTitle);
  }

  async closeCreateModal(): Promise<void> {
    // The 36x36 "X" button at the left of the modal header.
    const c = await this.pressable(36, { minY: 60, maxY: 140 }, 'modal close button');
    await this.page.mouse.click(c.x, c.y);
    await this.waits.forHidden(this.modalTitle);
  }

  get modal(): Locator {
    return this.modalTitle;
  }
  get publish(): Locator {
    return this.publishButton;
  }

  /** The "N/4 completed" number. */
  async completed(): Promise<number> {
    const text = await this.progressText.innerText();
    return Number(text.split('/')[0]);
  }
  get progress(): Locator {
    return this.progressText;
  }

  async setTitle(value: string): Promise<void> {
    await this.actions.fill(this.titleInput, value, 'policy title');
  }
  async setContent(value: string): Promise<void> {
    await this.actions.fill(this.contentInput, value, 'policy content');
  }
  get titleField(): Locator {
    return this.titleInput;
  }
  get contentField(): Locator {
    return this.contentInput;
  }

  /** A department pill inside the modal (cards behind it show badges with the same text, so take the last). */
  departmentPill(name: string): Locator {
    return this.page.getByText(name, { exact: true }).last();
  }
  async chooseDepartment(name: string): Promise<void> {
    const pill = this.departmentPill(name);
    await pill.scrollIntoViewIfNeeded();
    await this.actions.clickThrough(pill, `department "${name}"`);
  }
  async isDepartmentSelected(name: string): Promise<boolean> {
    const handle = await this.departmentPill(name).elementHandle();
    if (!handle) return false;
    return handle.evaluate((el, selected) => {
      let node: HTMLElement | null = el as HTMLElement;
      for (let i = 0; i < 4 && node; i++, node = node.parentElement) {
        if (getComputedStyle(node).backgroundColor === selected) return true;
      }
      return false;
    }, SELECTED_PILL_BG);
  }
  /** Department names offered in the modal (between "Issuing Department" and "Target Audience"). */
  async modalDepartmentNames(): Promise<string[]> {
    const raw = await this.page.evaluate(() => {
      const deepest = (re: RegExp): HTMLElement | undefined =>
        Array.from(document.querySelectorAll<HTMLElement>('div'))
          .filter((d) => re.test((d.innerText ?? '').trim()))
          .pop();
      const start = deepest(/^Issuing Department\s*\*?$/);
      const end = deepest(/^Target Audience\s*\*?$/);
      if (!start || !end) return [];
      return Array.from(document.querySelectorAll<HTMLElement>('div'))
        .filter(
          (d) =>
            d.children.length === 0 &&
            !start.contains(d) &&
            !!(start.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING) &&
            !!(d.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING),
        )
        .map((d) => d.innerText ?? '');
    });
    return raw.map(clean).filter((t) => t && t !== '*');
  }

  audienceOption(audience: Audience): Locator {
    return this.page.getByText(audience, { exact: true }).last();
  }
  async toggleAudience(audience: Audience): Promise<void> {
    const option = this.audienceOption(audience);
    await option.scrollIntoViewIfNeeded();
    await this.actions.clickThrough(option, `audience "${audience}"`);
  }

  // ---------- attachment ----------

  async attach(filePath: string): Promise<void> {
    await this.actions.uploadViaChooser(this.attachButton, filePath, 'Attach document');
  }
  get attachPrompt(): Locator {
    return this.attachButton;
  }
  attached(fileName: string): Locator {
    return this.page.getByText(fileName, { exact: true });
  }
  /** Toast shown for a rejected file (size or type). */
  toast(message: string | RegExp): Locator {
    return this.page.getByText(message);
  }
  /** The small remove control on the attached-file row. */
  async removeAttachment(fileName: string): Promise<void> {
    const point = await this.attached(fileName).evaluate((el) => {
      let row: HTMLElement | null = el as HTMLElement;
      for (let i = 0; i < 4 && row; i++, row = row.parentElement) {
        const x = row.querySelector<HTMLElement>('[tabindex="0"],[role="button"]');
        if (x) {
          const r = x.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    });
    if (!point) throw new Error('remove control not found');
    await this.page.mouse.click(point.x, point.y);
  }

  // ---------- publish / archive (WRITES DATA: only from gated tests) ----------

  async publishAndWait(): Promise<number> {
    const [res] = await Promise.all([
      this.page.waitForResponse((r) => /\/admin\/policies/.test(r.url()) && r.request().method() === 'POST', { timeout: 30_000 }),
      this.actions.click(this.publishButton, 'Publish'),
    ]);
    return res.status();
  }

  /** Clicks Archive on a card and answers the native confirm. Returns the confirm text. */
  async archive(title: string, accept: boolean): Promise<string> {
    let message = '';
    this.page.once('dialog', async (d) => {
      message = d.message();
      if (accept) await d.accept();
      else await d.dismiss();
    });
    await this.actions.clickThrough(this.card(title).first().getByText('Archive', { exact: true }), `Archive "${title}"`);
    await this.page.waitForTimeout(800); // the dialog is handled by the listener above
    return message;
  }
}
