import type { Download, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export type UploadType = 'STUDENT' | 'EMPLOYEE' | 'ADMIN' | 'BIRTHDAY' | 'TITLE';
export const UPLOAD_TYPES: UploadType[] = ['STUDENT', 'EMPLOYEE', 'ADMIN', 'BIRTHDAY', 'TITLE'];

/** Icon-font glyphs live in the private-use area and count as "text"; remove them before comparing. */
const clean = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').trim();

export interface Summary {
  total: number;
  success: number;
  failed: number;
  duplicates: number;
  invalid: number;
}

/**
 * Admin > Bulk Upload (`/bulk-upload`): upload type menu, template download, file picker, Upload / Reset,
 * validation summary, row-wise error preview, upload history. Interactions only: expectations live in specs.
 * The screen is made of react-native-paper cards: buttons are real <button>s, menu items have role=menuitem.
 */
export class BulkUploadPage extends BasePage {
  protected readonly path = '/bulk-upload';

  private readonly typeButton: Locator;
  private readonly uploadButton: Locator;
  private readonly resetButton: Locator;
  private readonly chooseButton: Locator;
  private readonly removeButton: Locator;

  constructor(page: Page) {
    super(page);
    this.typeButton = page.getByRole('button', { name: /^(Select Upload Type|STUDENT|EMPLOYEE|ADMIN|BIRTHDAY|TITLE)$/ });
    this.uploadButton = page.getByRole('button', { name: 'Upload', exact: true });
    this.resetButton = page.getByRole('button', { name: 'Reset', exact: true });
    this.chooseButton = page.getByRole('button', { name: 'Choose File', exact: true });
    this.removeButton = page.getByRole('button', { name: 'Remove File', exact: true });
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.typeButton);
    await this.waits.forVisible(this.uploadButton);
  }

  // ---------- plain locators ----------

  get heading(): Locator {
    return this.page.getByText('Bulk Upload Users', { exact: true });
  }
  get typeSelector(): Locator {
    return this.typeButton;
  }
  get menuItems(): Locator {
    return this.page.getByRole('menuitem');
  }
  get templateButton(): Locator {
    return this.page.getByRole('button', { name: /^Download .* Template$/ });
  }
  get upload(): Locator {
    return this.uploadButton;
  }
  get resetBtn(): Locator {
    return this.resetButton;
  }
  get removeFileBtn(): Locator {
    return this.removeButton;
  }
  get noFileText(): Locator {
    return this.page.getByText('No file selected', { exact: true });
  }
  get errorsEmpty(): Locator {
    return this.page.getByText('No errors to display.', { exact: true });
  }
  /** Transient message bar at the bottom (visible about 2.5 s). */
  snackbar(text: string | RegExp): Locator {
    return this.page.getByText(text).last();
  }
  get historyRows(): Locator {
    return this.page.getByText(/^#\d+ \| /);
  }

  /** True when the control is disabled (native attribute or aria-disabled, React Native Web uses both). */
  async isDisabled(target: Locator): Promise<boolean> {
    return target.evaluate((e) => (e as HTMLButtonElement).disabled || e.getAttribute('aria-disabled') === 'true');
  }

  // ---------- actions ----------

  /** Waits until an element stops moving (menus slide in). */
  private async settled(target: Locator): Promise<void> {
    let last = '';
    for (let i = 0; i < 40; i++) {
      const box = await target.boundingBox();
      const now = box ? `${Math.round(box.x)},${Math.round(box.y)}` : '';
      if (now && now === last) return;
      last = now;
      await this.page.waitForTimeout(100); // sampling interval of an animation probe, not a wait for a condition
    }
  }

  async openTypeMenu(): Promise<void> {
    await this.actions.click(this.typeButton, 'Upload type selector');
    if (!(await this.menuItems.first().isVisible().catch(() => false))) {
      // a click during page hydration can be lost; one retry
      await this.waits.forVisible(this.menuItems.first()).catch(async () => this.actions.click(this.typeButton, 'Upload type selector'));
    }
    await this.waits.forVisible(this.menuItems.first());
    await this.settled(this.menuItems.first());
  }

  async selectType(type: UploadType): Promise<void> {
    await this.openTypeMenu();
    await this.actions.click(this.page.getByRole('menuitem', { name: type, exact: true }), `menu item ${type}`);
    await this.waits.forVisible(this.page.getByRole('button', { name: `Download ${type} Template` }));
  }

  async downloadTemplate(): Promise<Download> {
    const [download] = await Promise.all([this.page.waitForEvent('download'), this.actions.click(this.templateButton, 'Download template')]);
    return download;
  }

  async clickTemplate(): Promise<void> {
    await this.actions.click(this.templateButton, 'Download template');
  }

  async chooseFile(filePath: string): Promise<void> {
    await this.actions.uploadViaChooser(this.chooseButton, filePath, 'Choose File');
  }
  async removeFile(): Promise<void> {
    await this.actions.click(this.removeButton, 'Remove File');
  }
  async clickUpload(): Promise<void> {
    await this.actions.click(this.uploadButton, 'Upload');
  }
  async clickReset(): Promise<void> {
    await this.actions.click(this.resetButton, 'Reset');
  }

  // ---------- reading ----------

  /** Visible text between two headings of the page (the page is one long scroll of cards). */
  private async section(from: string, to: string): Promise<string[]> {
    const all = await this.page.evaluate(() => document.body.innerText);
    const start = all.indexOf(from);
    const end = to ? all.indexOf(to, start + from.length) : -1;
    const slice = all.slice(start + from.length, end === -1 ? undefined : end);
    return slice.split('\n').map(clean).filter(Boolean);
  }

  async selectedFileName(): Promise<string> {
    const [name] = await this.section('Accepted: .csv, .xlsx | Max 10MB', 'Choose File');
    return name ?? '';
  }

  async summary(): Promise<Summary> {
    const lines = await this.section('Validation Summary', 'Row-wise Error Preview');
    const num = (label: string): number => Number(lines.find((l) => l.startsWith(`${label}:`))?.split(':')[1].trim() ?? NaN);
    return { total: num('Total'), success: num('Success'), failed: num('Failed'), duplicates: num('Duplicates'), invalid: num('Invalid') };
  }

  /** Lines under "Row-wise Error Preview" (up to the "Upload History" heading). */
  async errorLines(): Promise<string[]> {
    return this.section('Row-wise Error Preview', 'Upload History');
  }

  /** The history list as the screen shows it. */
  async readHistory(): Promise<{ raw: string; batchId: number; type: string; by: string; total: number; success: number; failed: number; status: string }[]> {
    const n = await this.historyRows.count();
    const out = [];
    for (let i = 0; i < n; i++) {
      const raw = clean(await this.historyRows.nth(i).innerText());
      const m = /^#(\d+) \| (.*?) \| (.*) \| (\d+)\/(\d+)\/(\d+) \| (\S+)$/.exec(raw);
      if (!m) throw new Error(`Unexpected history row format: ${raw}`);
      out.push({ raw, batchId: +m[1], type: m[2], by: m[3], total: +m[4], success: +m[5], failed: +m[6], status: m[7] });
    }
    return out;
  }

  /** Text of the whole page body, for "does the screen mention X" checks. */
  async bodyText(): Promise<string> {
    return clean(await this.page.evaluate(() => document.body.innerText));
  }
}
