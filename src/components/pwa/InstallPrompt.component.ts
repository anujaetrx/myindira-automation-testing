import type { Page } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

/** The app's own "Install app" UI (the browser-native prompt is not automatable). */
export class InstallPromptComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByTestId('install-prompt'));
  }

  get installButton() {
    return this.root.getByRole('button', { name: /install/i });
  }
  get dismissButton() {
    return this.root.getByRole('button', { name: /not now|dismiss|later/i });
  }
}
