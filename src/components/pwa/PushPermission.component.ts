import type { Page } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

/** The app's in-page notification opt-in UI. Grant/deny the browser permission via context.grantPermissions. */
export class PushPermissionComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByTestId('push-permission'));
  }

  get enableButton() {
    return this.root.getByRole('button', { name: /enable|allow/i });
  }
}
