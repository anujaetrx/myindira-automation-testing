import type { Page } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class OfflineBannerComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByTestId('offline-banner'));
  }
}
