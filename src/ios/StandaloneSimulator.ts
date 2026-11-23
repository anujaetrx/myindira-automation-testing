import type { BrowserContext } from '@playwright/test';

/**
 * SIMULATES the installed-app environment inside WebKit: `navigator.standalone === true` and
 * `(display-mode: standalone)` matching. It exercises the app's own "am I installed?" code paths
 * (hide install banner, show back button, different navigation). It does NOT prove the real installed
 * app works: storage, launch, and the OS shell are different on a physical iPhone (see docs/ios.md).
 */
export async function simulateInstalledStandalone(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });

    const original = window.matchMedia.bind(window);
    const fake = (query: string, matches: boolean): MediaQueryList => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });

    window.matchMedia = (query: string): MediaQueryList => {
      if (/display-mode\s*:\s*standalone/.test(query)) return fake(query, true);
      if (/display-mode\s*:\s*(browser|minimal-ui|fullscreen)/.test(query)) return fake(query, false);
      return original(query);
    };
  });
}
