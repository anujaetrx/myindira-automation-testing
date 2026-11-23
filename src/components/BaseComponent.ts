import type { Locator, Page } from '@playwright/test';

/** A component is scoped to a root locator, so the same class works anywhere it appears. */
export abstract class BaseComponent {
  constructor(
    protected readonly page: Page,
    protected readonly root: Locator,
  ) {}

  protected byTestId(id: string): Locator {
    return this.root.getByTestId(id);
  }

  get locator(): Locator {
    return this.root;
  }

  async isVisible(): Promise<boolean> {
    return this.root.isVisible();
  }
}
