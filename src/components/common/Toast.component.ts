import type { Page } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class ToastComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByRole('status').or(page.getByRole('alert')).first());
  }

  async message(): Promise<string> {
    return (await this.root.innerText()).trim();
  }
}
