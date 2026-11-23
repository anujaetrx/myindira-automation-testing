import type { BrowserContext, Page } from '@playwright/test';

/** Approximate Chrome DevTools throttling presets (bytes/second, ms). */
export const NetworkProfiles = {
  offline: { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 },
  slow3g: { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 },
  fast3g: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  fourG: { offline: false, latency: 20, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (9 * 1024 * 1024) / 8 },
  none: { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
} as const;

export type NetworkProfile = keyof typeof NetworkProfiles;

/** Android-style conditions you can emulate in a browser: network, orientation, location, locale, theme. */
export class DeviceEmulation {
  constructor(private readonly page: Page) {}

  private get context(): BrowserContext {
    return this.page.context();
  }

  /** Throttle the network of this page (Chromium only), including service-worker traffic. */
  async setNetwork(profile: NetworkProfile): Promise<void> {
    const cdp = await this.context.newCDPSession(this.page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', NetworkProfiles[profile]);
  }

  /** Swaps width and height, like rotating the phone. Fires `resize` and orientation media queries. */
  async rotate(): Promise<'portrait' | 'landscape'> {
    const size = this.page.viewportSize();
    if (!size) throw new Error('No viewport to rotate');
    await this.page.setViewportSize({ width: size.height, height: size.width });
    return size.height > size.width ? 'landscape' : 'portrait';
  }

  async orientation(): Promise<'portrait' | 'landscape'> {
    return this.page.evaluate(() => (window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'));
  }

  async setLocation(latitude: number, longitude: number, accuracy = 20): Promise<void> {
    await this.context.grantPermissions(['geolocation']);
    await this.context.setGeolocation({ latitude, longitude, accuracy });
  }

  async setOffline(offline: boolean): Promise<void> {
    await this.context.setOffline(offline);
  }

  async setColorScheme(scheme: 'light' | 'dark'): Promise<void> {
    await this.page.emulateMedia({ colorScheme: scheme });
  }

  async setReducedMotion(reduce: boolean): Promise<void> {
    await this.page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  }
}
