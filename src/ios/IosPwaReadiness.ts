import type { Page } from '@playwright/test';
import { manifestSchema } from '@pwa/ManifestValidator';

export interface ReadinessReport {
  /** Blocks or breaks a good "Add to Home Screen" experience on iOS. */
  errors: string[];
  /** Works, but is below iOS best practice. */
  warnings: string[];
  passed: string[];
}

/** Width/height of a PNG from its header, or null if the bytes are not a PNG. */
export function pngSize(bytes: Buffer): { width: number; height: number } | null {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

interface HeadInfo {
  touchIcons: { href: string; sizes: string | null }[];
  manifestHref: string | null;
  metas: Record<string, string>;
}

/**
 * Static checks for what iOS needs to offer and render "Add to Home Screen" well. Safari has no
 * install event and no install API, so installability is judged purely from the page's head and manifest.
 * (Playwright cannot perform the install itself: see docs/ios.md.)
 */
export class IosPwaReadiness {
  constructor(private readonly page: Page) {}

  private async head(): Promise<HeadInfo> {
    return this.page.evaluate(() => {
      const metas: Record<string, string> = {};
      document.querySelectorAll('meta[name]').forEach((m) => {
        metas[(m.getAttribute('name') ?? '').toLowerCase()] = m.getAttribute('content') ?? '';
      });
      return {
        touchIcons: Array.from(document.querySelectorAll('link[rel~="apple-touch-icon"], link[rel~="apple-touch-icon-precomposed"]')).map((l) => ({
          href: (l as HTMLLinkElement).href,
          sizes: l.getAttribute('sizes'),
        })),
        manifestHref: (document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null)?.href ?? null,
        metas,
      };
    });
  }

  async check(): Promise<ReadinessReport> {
    const report: ReadinessReport = { errors: [], warnings: [], passed: [] };
    const { touchIcons, manifestHref, metas } = await this.head();
    const ok = (msg: string) => report.passed.push(msg);

    // 1. Secure context: iOS only installs/serves PWA features over HTTPS (or localhost).
    const url = new URL(this.page.url());
    if (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') ok('served from a secure context');
    else report.errors.push(`page is not served over HTTPS (${url.origin})`);

    // 2. Home-screen icon: apple-touch-icon (all iOS versions) and/or manifest icons (iOS 16.4+).
    let hasIcon = false;
    if (touchIcons.length === 0) {
      report.warnings.push('no <link rel="apple-touch-icon">: iOS < 16.4 and many contexts fall back to a page screenshot');
    } else {
      for (const icon of touchIcons) {
        const res = await this.page.request.get(icon.href).catch(() => null);
        const size = res?.ok() ? pngSize(await res.body()) : null;
        if (!res?.ok()) report.errors.push(`apple-touch-icon ${icon.href} is not reachable (HTTP ${res?.status() ?? 'network error'})`);
        else if (!size) report.errors.push(`apple-touch-icon ${icon.href} is not a PNG (iOS ignores SVG/WebP touch icons)`);
        else if (size.width < 180 || size.height < 180) report.warnings.push(`apple-touch-icon is ${size.width}x${size.height}; iPhones use 180x180`);
        else {
          ok(`apple-touch-icon ${size.width}x${size.height}`);
          hasIcon = true;
        }
      }
    }

    // 3. Manifest (used by iOS 16.4+ for name, icons, display mode, start_url, scope).
    if (!manifestHref) {
      report.errors.push('no <link rel="manifest">');
    } else {
      const res = await this.page.request.get(manifestHref).catch(() => null);
      if (!res?.ok()) {
        report.errors.push(`manifest not reachable (HTTP ${res?.status() ?? 'network error'})`);
      } else {
        const parsed = manifestSchema.safeParse(await res.json().catch(() => null));
        if (!parsed.success) {
          report.errors.push(`manifest invalid: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
        } else {
          ok(`manifest valid (display: ${parsed.data.display})`);
          if (parsed.data.display === 'browser') report.errors.push('manifest display is "browser": the installed app would not be standalone');
          const sizes = parsed.data.icons.flatMap((i) => (i.sizes ?? '').split(' '));
          if (!hasIcon && !sizes.some((s) => /^(180|192|512)x/.test(s))) report.errors.push('no usable home-screen icon: neither apple-touch-icon nor a 180/192/512 manifest icon');
        }
      }
    }

    // 4. Meta tags that shape the installed app on iOS.
    const capable = metas['apple-mobile-web-app-capable'] ?? metas['mobile-web-app-capable'];
    if (capable === 'yes') ok('apple-mobile-web-app-capable=yes');
    else report.warnings.push('missing apple-mobile-web-app-capable=yes (older iOS needs it to launch standalone)');

    if (metas['apple-mobile-web-app-title']) ok(`apple-mobile-web-app-title="${metas['apple-mobile-web-app-title']}"`);
    else report.warnings.push('missing apple-mobile-web-app-title: iOS will use the page <title> as the icon label');

    if (metas['apple-mobile-web-app-status-bar-style']) ok(`status bar style: ${metas['apple-mobile-web-app-status-bar-style']}`);
    else report.warnings.push('missing apple-mobile-web-app-status-bar-style (default style is used)');

    const viewport = metas['viewport'] ?? '';
    if (/width\s*=\s*device-width/.test(viewport)) ok('viewport width=device-width');
    else report.errors.push('viewport meta lacks width=device-width');
    if (/viewport-fit\s*=\s*cover/.test(viewport)) ok('viewport-fit=cover (full-screen, notch-aware)');
    else report.warnings.push('viewport lacks viewport-fit=cover: content will not extend under the notch/home indicator');

    if (!metas['theme-color']) report.warnings.push('no theme-color meta');

    return report;
  }
}
