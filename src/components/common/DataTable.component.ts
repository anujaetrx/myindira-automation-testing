import type { Locator, Page } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class DataTableComponent extends BaseComponent {
  constructor(page: Page, root: Locator = page.getByRole('table')) {
    super(page, root);
  }

  get rows(): Locator {
    return this.root.getByRole('row').filter({ has: this.page.getByRole('cell') });
  }

  async rowCount(): Promise<number> {
    return this.rows.count();
  }

  rowByText(text: string | RegExp): Locator {
    return this.rows.filter({ hasText: text });
  }

  async headers(): Promise<string[]> {
    return (await this.root.getByRole('columnheader').allInnerTexts()).map((t) => t.trim());
  }
}
