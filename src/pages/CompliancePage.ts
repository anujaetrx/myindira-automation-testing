import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Icon-font glyphs live in the private-use area and count as "text"; remove them before comparing. */
const clean = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').trim();

export interface ComplianceCard {
  kind: string; // "Policy" | "Ack Request"
  title: string;
  status: string; // the coloured pill, e.g. OVERDUE
  deadline: string; // "Deadline: M/D/YYYY"
  audiences: string[]; // EMPLOYEE / STUDENT chips
  counter: string; // "6 / 2509 acknowledged"
  percent: string; // "0.2%"
}

/** Row shape of GET /admin/compliance-report (observed on QA). */
export interface ComplianceRow {
  type: 'POLICY' | 'ACK_REQUEST';
  itemId: number;
  title: string;
  deadline: string;
  targetRoles: string[];
  totalAssigned: number;
  totalAcknowledged: number;
  compliancePercentage: number;
  status: string;
}

/** Wraps rows in the API's envelope, for mocking the list call. */
export function complianceResponse(content: ComplianceRow[]): object {
  return {
    success: true,
    message: 'Compliance report fetched',
    code: 'OK',
    data: { totalElements: content.length, totalPages: content.length ? 1 : 0, size: 20, content },
  };
}

export const LIST_API = /\/admin\/compliance-report\?/;
export const EXPORT_API = /\/admin\/compliance-report\/export/;

/**
 * Admin > Compliance ("Compliance Report"): one card per policy / acknowledgement request with a status pill,
 * audience chips, "X / Y acknowledged", a percentage and a progress bar, plus an Export button.
 * Interactions only: expectations live in the specs.
 */
export class CompliancePage extends BasePage {
  protected readonly path = '/compliance';

  private readonly heading: Locator;
  private readonly exportButton: Locator;
  private readonly cardsLocator: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByText('Compliance Report', { exact: true });
    this.exportButton = page.getByRole('button', { name: /Export/ });
    this.cardsLocator = page.getByTestId('card');
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.heading);
  }

  get reportTitle(): Locator {
    return this.heading;
  }
  get export(): Locator {
    return this.exportButton;
  }
  get cards(): Locator {
    return this.cardsLocator;
  }
  get emptyMessage(): Locator {
    return this.page.getByText('No items to report on', { exact: true });
  }
  get loader(): Locator {
    return this.page.getByRole('progressbar').first();
  }
  card(title: string): Locator {
    return this.cardsLocator.filter({ hasText: title }).first();
  }

  async readCards(): Promise<ComplianceCard[]> {
    const n = await this.cardsLocator.count();
    const out: ComplianceCard[] = [];
    for (let i = 0; i < n; i++) {
      const card = this.cardsLocator.nth(i);
      const lines = (await card.innerText()).split('\n').map(clean).filter(Boolean);
      const audiences = (await card.getByTestId('chip').allInnerTexts()).map(clean);
      out.push({
        kind: lines[0],
        title: lines[1],
        status: lines[2],
        deadline: lines.find((l) => l.startsWith('Deadline:')) ?? '',
        audiences,
        counter: lines.find((l) => /acknowledged$/.test(l)) ?? '',
        percent: lines[lines.length - 1],
      });
    }
    return out;
  }

  /**
   * Fill of the progress bar as a percentage (0..100+). The fill is drawn with scaleX and animates in, so
   * wait until the value stops changing.
   */
  async barPercent(card: Locator): Promise<number> {
    const fill = card.getByTestId('progress-bar-fill');
    const read = () =>
      fill.evaluate((e) => {
        const m = /scaleX\(([-\d.e]+)\)/.exec((e as HTMLElement).getAttribute('style') ?? '');
        return m ? Number(m[1]) * 100 : NaN;
      });
    let last = await read();
    for (let i = 0; i < 30; i++) {
      await this.page.waitForTimeout(150); // sampling interval of an animation probe, not a wait for a condition
      const now = await read();
      if (Math.abs(now - last) < 1e-6) return now;
      last = now;
    }
    return last;
  }

  /** Clicks Export and returns the download (null if none arrives in time). */
  async exportFile(timeout = 30_000) {
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout }).catch(() => null),
      this.actions.click(this.exportButton, 'Export'),
    ]);
    return download;
  }
}
