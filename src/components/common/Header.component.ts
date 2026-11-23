import type { Page } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class HeaderComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByRole('banner'));
  }

  private get userMenu() {
    return this.byTestId('user-menu');
  }
  private get logoutButton() {
    return this.root.getByRole('button', { name: /log\s?out|sign\s?out/i });
  }

  async userDisplayName(): Promise<string> {
    return (await this.userMenu.innerText()).trim();
  }

  async logout(): Promise<void> {
    await this.userMenu.click();
    await this.logoutButton.click();
  }
}
