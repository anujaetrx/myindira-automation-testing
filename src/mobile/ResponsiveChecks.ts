import type { Page } from '@playwright/test';

/** Common Android viewport widths (CSS px). Add the breakpoints your CSS actually uses. */
export const Viewports = {
  smallPhone: { name: 'small phone', width: 320, height: 568 },
  phone: { name: 'phone', width: 360, height: 800 },
  largePhone: { name: 'large phone', width: 412, height: 915 },
  phoneLandscape: { name: 'phone landscape', width: 915, height: 412 },
  tablet: { name: 'tablet', width: 768, height: 1024 },
  tabletLandscape: { name: 'tablet landscape', width: 1024, height: 768 },
} as const;

/** Runs a page.evaluate that survives client-side redirects: waits for the navigation to settle and retries. */
async function stable<T>(page: Page, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.waitForLoadState('load');
      return await fn();
    } catch (error) {
      const navigated = error instanceof Error && /Execution context was destroyed|navigation/i.test(error.message);
      if (!navigated || attempt >= 3) throw error;
    }
  }
}

export interface SmallTarget {
  tag: string;
  text: string;
  width: number;
  height: number;
}

/** Layout checks that apply to any mobile page; business layout rules stay in specs. */
export const ResponsiveChecks = {
  /** True when the page can be scrolled sideways: the classic "doesn't fit the screen" bug. */
  hasHorizontalOverflow(page: Page): Promise<boolean> {
    return stable(page, () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1));
  },

  /** Elements wider than the viewport, to name the culprit when overflow is detected. */
  overflowingElements(page: Page): Promise<string[]> {
    return stable(page, () => page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      return Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((el) => el.getBoundingClientRect().right > limit + 1 && getComputedStyle(el).position !== 'fixed')
        .slice(0, 10)
        .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`);
    }));
  },

  async hasViewportMeta(page: Page): Promise<boolean> {
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    return !!content && /width\s*=\s*device-width/.test(content);
  },

  /** Visible interactive elements smaller than `minPx` (WCAG 2.5.5 suggests 44px; Material suggests 48dp). */
  smallTapTargets(page: Page, minPx = 44): Promise<SmallTarget[]> {
    return stable(page, () => page.evaluate((min) => {
      const selector = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link]';
      return Array.from(document.querySelectorAll<HTMLElement>(selector))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ el, r }) => r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden')
        .filter(({ r }) => r.width < min || r.height < min)
        .map(({ el, r }) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          width: Math.round(r.width),
          height: Math.round(r.height),
        }));
    }, minPx));
  },

  /** Whether CSS thinks this is a coarse-pointer (touch) device. */
  isTouchPrimary(page: Page): Promise<boolean> {
    return page.evaluate(() => window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);
  },
};
