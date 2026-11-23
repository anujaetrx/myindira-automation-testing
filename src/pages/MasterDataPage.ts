import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export type MasterDataType = 'Department' | 'Campus' | 'Role';
export type MasterDataSection = 'Departments' | 'Campuses' | 'Roles';

export interface MasterDataItem {
  name: string;
  code: string;
}
export interface SectionData {
  /** The number in the heading, e.g. "Departments (64)" -> 64 */
  headingCount: number;
  items: MasterDataItem[];
}
export interface ValidationSummary {
  total: number;
  success: number;
  failed: number;
  duplicates: number;
  invalid: number;
}

const SECTIONS: MasterDataSection[] = ['Departments', 'Campuses', 'Roles'];

/**
 * Admin > Master Data ("Manage Master Data"): lists of Departments, Campuses and Roles as
 * "Name (CODE)" chips, a type selector with a Name/Code form, and a CSV/XLSX upload with a summary.
 * Interactions only: business expectations live in the specs.
 */
export class MasterDataPage extends BasePage {
  protected readonly path = '/master-data';

  private readonly pageTitle: Locator;
  private readonly typeDropdown: Locator;
  private readonly nameInput: Locator;
  private readonly codeInput: Locator;
  private readonly addButton: Locator;
  private readonly downloadTemplateButton: Locator;
  private readonly chooseFileButton: Locator;
  private readonly uploadCsvButton: Locator;
  private readonly resetButton: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.getByText('Manage Master Data', { exact: true });
    // The trigger is a button labelled "Select Type" until a type is chosen, then labelled with that type.
    // (List chips are buttons too, but their names are "Name (CODE)", so they never match.)
    this.typeDropdown = page.getByRole('button', { name: /^(Select Type|Department|Campus|Role)$/ });
    // Plain <input data-testid="text-input-outlined"> (no type attribute): Name first, Code second.
    this.nameInput = page.getByTestId('text-input-outlined').nth(0);
    this.codeInput = page.getByTestId('text-input-outlined').nth(1);
    // The button label follows the chosen type: "Add" -> "Add Department" / "Add Campus" / "Add Role".
    this.addButton = page.getByRole('button', { name: /^Add( (Department|Campus|Role))?$/ });
    // Like Add, the label follows the type: "Download Department Template".
    this.downloadTemplateButton = page.getByRole('button', { name: /^Download( (Department|Campus|Role))? Template$/ });
    this.chooseFileButton = page.getByRole('button', { name: 'Choose File', exact: true });
    this.uploadCsvButton = page.getByRole('button', { name: 'Upload CSV', exact: true });
    // exact: list chips such as "Roll Number Reset Year-wise (...)" are buttons that also contain "Reset".
    this.resetButton = page.getByRole('button', { name: 'Reset', exact: true });
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.pageTitle);
    await this.waits.forVisible(this.page.getByText(/^Departments \(\d+\)$/));
  }

  // ---------- lists ----------

  /**
   * Reads the three lists straight from the rendered page, so a mismatch between a heading count and
   * the chips shown is detectable. Chips are plain "Name (CODE)" elements with no stable class names.
   */
  async readSections(): Promise<Record<MasterDataSection, SectionData>> {
    return this.page.evaluate((sections) => {
      const result = Object.fromEntries(
        sections.map((s) => [s, { headingCount: -1, items: [] as { name: string; code: string }[] }]),
      ) as Record<string, { headingCount: number; items: { name: string; code: string }[] }>;
      const headingRe = new RegExp(`^(${sections.join('|')}) \\((\\d+)\\)$`);
      const chipRe = /^(.+) \(([A-Z0-9_]*[A-Z_][A-Z0-9_]*)\)$/;
      let current: string | null = null;

      for (const el of Array.from(document.querySelectorAll<HTMLElement>('div'))) {
        if (el.children.length > 0) continue;
        const text = (el.innerText ?? '').trim();
        if (!text) continue;
        const heading = headingRe.exec(text);
        if (heading) {
          current = heading[1];
          result[current].headingCount = Number(heading[2]);
          continue;
        }
        if (text === 'Select Type') current = null; // the lists end where the form starts
        const chip = chipRe.exec(text);
        if (current && chip) result[current].items.push({ name: chip[1], code: chip[2] });
      }
      return result;
    }, SECTIONS) as Promise<Record<MasterDataSection, SectionData>>;
  }

  // ---------- add form ----------

  async openTypeDropdown(): Promise<void> {
    // The popup is drawn at the trigger's position, so the trigger must be fully on screen first.
    await this.typeDropdown.scrollIntoViewIfNeeded();
    await this.actions.click(this.typeDropdown, 'type dropdown');
  }

  async chooseType(type: MasterDataType): Promise<void> {
    const option = this.typeOption(type);
    // The first click right after a previous selection can be swallowed while the control resets, so retry
    // until the options are actually showing (only click again when they are NOT, so it never toggles shut).
    for (let attempt = 1; ; attempt++) {
      await this.openTypeDropdown();
      try {
        await this.waits.forVisible(option, 2_500);
        break;
      } catch (error) {
        if (attempt >= 5) throw error;
      }
    }
    await this.waitUntilStill(option); // the popup animates open; a click mid-animation lands on another row

    // The option's handler is on a wrapper above its text (React Native Web), so a normal click is refused.
    await this.actions.clickThrough(option, `type option "${type}"`);

    // Prove the right type was selected: the form title becomes "Add <Type> Manually".
    await this.waits.forVisible(this.page.getByText(`Add ${type} Manually`, { exact: true }));
    // Let the popup finish closing: a click on the trigger while it is still closing is swallowed.
    await this.waits.forHidden(this.page.getByTestId('menu-item-title').first());
  }

  /** Waits until an element's position has not changed for three consecutive checks (animation finished). */
  private async waitUntilStill(target: Locator): Promise<void> {
    let last = '';
    let stable = 0;
    const deadline = Date.now() + 5_000;
    while (stable < 3 && Date.now() < deadline) {
      const now = JSON.stringify(await target.boundingBox());
      stable = now === last ? stable + 1 : 0;
      last = now;
      await this.page.waitForTimeout(80); // sampling interval of an animation probe, not a wait for a condition
    }
  }

  /** The option's label inside the open dropdown (data-testid=menu-item-title). */
  typeOption(type: MasterDataType): Locator {
    return this.page.getByTestId('menu-item-title').filter({ hasText: new RegExp('^' + type + '$') });
  }

  async fillRecord(name: string, code: string): Promise<void> {
    await this.actions.fill(this.nameInput, name, 'name');
    await this.actions.fill(this.codeInput, code, 'code');
  }

  async clearRecord(): Promise<void> {
    await this.actions.fill(this.nameInput, '', 'name');
    await this.actions.fill(this.codeInput, '', 'code');
  }

  async fillName(name: string): Promise<void> {
    await this.actions.fill(this.nameInput, name, 'name');
  }

  async fillCode(code: string): Promise<void> {
    await this.actions.fill(this.codeInput, code, 'code');
  }

  /** Clicks Add and waits for the save request. WRITES DATA: only call from gated tests. */
  async addRecord(): Promise<void> {
    await this.page.waitForLoadState('load');
    await Promise.all([
      this.page.waitForResponse((r) => r.url().includes('/master-data') && r.request().method() !== 'GET', { timeout: 20_000 }),
      this.actions.click(this.addButton, 'Add button'),
    ]);
  }

  // ---------- richer helpers used by the TC_MD suite ----------

  formTitle(type: MasterDataType): Locator {
    return this.page.getByText(`Add ${type} Manually`, { exact: true });
  }

  addButtonFor(type: MasterDataType): Locator {
    return this.page.getByRole('button', { name: `Add ${type}`, exact: true });
  }

  get invalidFileMessage(): Locator {
    return this.page.getByText('Only .csv and .xlsx are allowed', { exact: true });
  }

  /** The chosen file name as shown next to "Choose File". */
  selectedFile(fileName: string): Locator {
    return this.page.getByText(fileName, { exact: true });
  }

  /**
   * Submits the add form if Add is enabled. Returns whether a request was sent and its HTTP status.
   * WRITES DATA when the server accepts the record: only call from gated tests.
   */
  async submitAdd(): Promise<{ sent: boolean; status?: number }> {
    if (await this.addButton.isDisabled()) return { sent: false };
    const response = this.page
      .waitForResponse((r) => r.url().includes('/master-data') && r.request().method() !== 'GET', { timeout: 10_000 })
      .catch(() => null);
    await this.actions.click(this.addButton, 'Add button');
    const res = await response;
    return res ? { sent: true, status: res.status() } : { sent: true };
  }

  /** Clicks Upload CSV and waits for the upload request. WRITES DATA when rows are accepted. */
  async uploadAndWait(): Promise<{ status?: number }> {
    const response = this.page
      .waitForResponse((r) => r.url().includes('/master-data') && r.request().method() !== 'GET', { timeout: 60_000 })
      .catch(() => null);
    await this.actions.click(this.uploadCsvButton, 'Upload CSV');
    const res = await response;
    return { status: res?.status() };
  }

  /** Runs `action` and returns the visible text lines that were not on the page before (toasts, errors). */
  async captureFeedback(action: () => Promise<unknown>): Promise<string[]> {
    const lines = async () => new Set((await this.page.innerText('body')).split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
    const before = await lines();
    await action();
    await this.page.waitForTimeout(1_200); // toasts render a moment after the response
    return [...(await lines())].filter((l) => !before.has(l));
  }

  get add(): Locator {
    return this.addButton;
  }
  get name(): Locator {
    return this.nameInput;
  }
  get code(): Locator {
    return this.codeInput;
  }
  get dropdown(): Locator {
    return this.typeDropdown;
  }

  // ---------- CSV / XLSX ----------

  get downloadTemplate(): Locator {
    return this.downloadTemplateButton;
  }
  get upload(): Locator {
    return this.uploadCsvButton;
  }
  get reset(): Locator {
    return this.resetButton;
  }

  /** Downloads the sample template and returns its file name and text. Needs a type to be chosen first. */
  async downloadSampleTemplate(): Promise<{ fileName: string; content: string }> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.actions.click(this.downloadTemplateButton, 'Download Template'),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return { fileName: download.suggestedFilename(), content: Buffer.concat(chunks).toString('utf-8') };
  }

  async chooseFile(filePath: string): Promise<void> {
    await this.actions.uploadViaChooser(this.chooseFileButton, filePath, 'Choose File');
  }

  async clickUpload(): Promise<void> {
    await this.actions.click(this.uploadCsvButton, 'Upload CSV');
  }

  async clickReset(): Promise<void> {
    await this.actions.click(this.resetButton, 'Reset');
  }

  get noFileSelected(): Locator {
    return this.page.getByText('No file selected', { exact: true });
  }

  /** "Total: 0 Success: 0 Failed: 0 Duplicates: 0 Invalid: 0" */
  async validationSummary(): Promise<ValidationSummary> {
    const text = (await this.page.innerText('body')).replace(/\s+/g, ' ');
    const m = /Total:\s*(\d+)\s*Success:\s*(\d+)\s*Failed:\s*(\d+)\s*Duplicates:\s*(\d+)\s*Invalid:\s*(\d+)/.exec(text);
    if (!m) throw new Error('Validation Summary not found on the page');
    const [, total, success, failed, duplicates, invalid] = m.map(Number);
    return { total, success, failed, duplicates, invalid };
  }

  // ---------- additions from the gap review ----------

  /** "Remove File" appears next to "Choose File" once a file is selected. It clears the file only. */
  get removeFile(): Locator {
    return this.page.getByRole('button', { name: 'Remove File', exact: true });
  }

  /** Snackbar / toast text (shown about 2.5 s). */
  toast(text: string | RegExp): Locator {
    return this.page.getByText(text, { exact: typeof text === 'string' });
  }

  /** The "Row-wise Errors" card that appears after an upload whose response lists errors. */
  get rowErrorsTitle(): Locator {
    return this.page.getByText('Row-wise Errors', { exact: true });
  }

  /** The list heading, e.g. sectionHeading('Departments') matches "Departments (64)". */
  sectionHeading(section: MasterDataSection): Locator {
    return this.page.getByText(new RegExp(`^${section} \\(\\d+\\)$`));
  }

  /** Waits for the page title only (use when the lists may legitimately be empty or failing). */
  async waitForTitle(): Promise<void> {
    await this.waits.forVisible(this.pageTitle);
  }

  async scrollToForm(): Promise<void> {
    await this.page.getByText('Add Record Manually', { exact: true }).scrollIntoViewIfNeeded();
  }
}
