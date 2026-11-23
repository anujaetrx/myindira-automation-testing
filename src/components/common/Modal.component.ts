import type { Page } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class ModalComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByRole('dialog'));
  }

  async title(): Promise<string> {
    return (await this.root.getByRole('heading').first().innerText()).trim();
  }
  async confirm(name: string | RegExp = /confirm|ok|yes/i): Promise<void> {
    await this.root.getByRole('button', { name }).click();
  }
  async cancel(name: string | RegExp = /cancel|no|close/i): Promise<void> {
    await this.root.getByRole('button', { name }).click();
  }
}
