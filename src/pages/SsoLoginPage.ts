import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Icon-font glyphs live in the private-use area and count as "text"; remove them before comparing. */
export const stripGlyphs = (t: string): string => t.replace(/[-]|[\u{F0000}-\u{FFFFD}]/gu, '').trim();

/**
 * The app's own sign-in screen when authentication is delegated to Microsoft (Entra ID SSO).
 * Observed on QA: there is no /login route. Every URL of an anonymous visitor renders this screen at "/".
 * The button is a plain <a href="https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?...">.
 */
export class SsoLoginPage extends BasePage {
  protected readonly path = '/';

  private readonly microsoftButton: Locator;

  constructor(page: Page) {
    super(page);
    this.microsoftButton = page.getByText('Sign in with Microsoft').first();
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.microsoftButton);
  }

  /** Leaves the app and lands on Microsoft's sign-in page. */
  async signInWithMicrosoft(): Promise<void> {
    await this.actions.click(this.microsoftButton, '"Sign in with Microsoft" button');
  }

  /** Waits (auto-retrying) for the sign-in screen: it may appear after a client-side redirect. */
  async expectShown(): Promise<void> {
    await this.verify.visible(this.microsoftButton, 'the "Sign in with Microsoft" screen should be shown');
  }

  // ---- locators for content checks (assertions stay in the specs) ----
  get button(): Locator {
    return this.page.locator('a').filter({ hasText: 'Sign in with Microsoft' });
  }
  get campusConnect(): Locator {
    return this.page.getByText('Campus Connect', { exact: true });
  }
  get headline(): Locator {
    return this.page.getByText('Sign in to continue', { exact: true });
  }
  get scopeText(): Locator {
    return this.page.getByText('Access your courses, grades, and campus services', { exact: true });
  }
  get helperText(): Locator {
    return this.page.getByText('Use your university Microsoft account', { exact: true });
  }
  get logo(): Locator {
    return this.page.locator('img').first();
  }
  /** Any visible text that looks like an error / alert (toast, banner). */
  get errorText(): Locator {
    return this.page.getByText(/official university account|restricted to Indira|access denied|error|failed/i).filter({ visible: true });
  }

  async buttonHref(): Promise<string> {
    return (await this.button.getAttribute('href')) ?? '';
  }

  /** Computed look of the CTA: colours, weight, shadow, whether an icon glyph precedes the label. */
  async buttonStyle(): Promise<{ bg: string; color: string; weight: string; shadow: string; hasIconGlyph: boolean; width: number; height: number }> {
    return this.button.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        weight: cs.fontWeight,
        shadow: cs.boxShadow,
        hasIconGlyph: /[-]/.test((el as HTMLElement).innerText),
        width: r.width,
        height: r.height,
      };
    });
  }

  /** Layout facts: logo box and natural size, a gradient behind the logo, horizontal overflow, button box. */
  async layout(): Promise<{
    logo: { x: number; y: number; w: number; h: number; naturalW: number; naturalH: number; loaded: boolean };
    hasGradientHeader: boolean;
    overflowX: boolean;
    viewportW: number;
    button: { x: number; w: number; h: number };
    helperBelowButton: boolean;
  }> {
    return this.page.evaluate(() => {
      const img = document.querySelector('img') as HTMLImageElement;
      const ir = img.getBoundingClientRect();
      let n: HTMLElement | null = img;
      let gradient = false;
      while (n && !gradient) {
        gradient = /gradient/.test(getComputedStyle(n).backgroundImage);
        n = n.parentElement;
      }
      const a = document.querySelector('a') as HTMLElement;
      const ar = a.getBoundingClientRect();
      const helper = Array.from(document.querySelectorAll('div')).find(
        (d) => d.innerText === 'Use your university Microsoft account' && d.children.length === 0,
      );
      return {
        logo: { x: ir.x, y: ir.y, w: ir.width, h: ir.height, naturalW: img.naturalWidth, naturalH: img.naturalHeight, loaded: img.complete && img.naturalWidth > 0 },
        hasGradientHeader: gradient,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        viewportW: document.documentElement.clientWidth,
        button: { x: ar.x, w: ar.width, h: ar.height },
        helperBelowButton: !!helper && helper.getBoundingClientRect().top >= ar.bottom - 1,
      };
    });
  }
}
