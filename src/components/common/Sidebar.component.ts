import type { Page } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class SidebarComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByRole('navigation', { name: /main|sidebar/i }));
  }

  async navigateTo(label: string | RegExp): Promise<void> {
    await this.root.getByRole('link', { name: label }).click();
  }
}
