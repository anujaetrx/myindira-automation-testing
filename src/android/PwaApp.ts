import { chromium, type Browser, type Page } from '@playwright/test';
import { androidConfig } from '@config/android.config';
import { env } from '@config/environment';
import { Logger } from '@utils/logger/Logger';
import { pollUntil } from '@utils/retry';
import type { AndroidSession } from './AndroidDevices';
import { hierarchyHasResource } from './AdbParsers';
import { installPwaViaChrome } from './PwaInstaller';

const WEBAPP_ACTIVITY = /Webapp|WebApk/i; // Chrome hosts installed PWAs in WebappActivity*/WebApkActivity*

export interface AttachedPwa {
  page: Page;
  browser: Browser;
  detach(): Promise<void>;
}

/**
 * Controls one installed PWA on a device: install, launch, stop, uninstall, standalone checks,
 * and attaching Playwright to its web content.
 *
 * Playwright browser emulation CANNOT do any of this: there is no home-screen icon, no WebAPK,
 * no Android task or back-stack in an emulated browser.
 */
export class PwaApp {
  private readonly log = Logger.for('PwaApp');
  private pkg: string | undefined = androidConfig.pwaPackage;

  constructor(
    private readonly session: AndroidSession,
    private readonly url: string = env.baseUrl,
  ) {}

  get packageName(): string {
    if (!this.pkg) throw new Error('PWA package unknown: call install() or set ANDROID_PWA_PACKAGE.');
    return this.pkg;
  }

  private get adb() {
    return this.session.adb;
  }
  private get serial() {
    return this.session.serial;
  }

  /** Installs via Chrome's menu and remembers the package. */
  async install(): Promise<string> {
    this.pkg = await installPwaViaChrome(this.session, this.url);
    return this.pkg;
  }

  /** Finds an already-installed WebAPK whose package data mentions this app's host. Best-effort. */
  async findInstalled(): Promise<string | undefined> {
    const host = new URL(this.url).host;
    for (const candidate of await this.adb.listWebApks(this.serial)) {
      if ((await this.adb.dumpPackage(this.serial, candidate)).includes(host)) {
        this.pkg = candidate;
        return candidate;
      }
    }
    return undefined;
  }

  /** Known package, else search the device, else fail with guidance. */
  async ensurePackage(): Promise<string> {
    const found = this.pkg ?? (await this.findInstalled());
    if (!found) {
      throw new Error(`No installed WebAPK found for ${this.url}. Run the install test first, or set ANDROID_PWA_PACKAGE.`);
    }
    return found;
  }

  async isInstalled(): Promise<boolean> {
    return !!this.pkg && (await this.adb.isInstalled(this.serial, this.pkg));
  }

  /** Cold launch from the launcher intent, like tapping the home-screen icon. Returns launch duration in ms. */
  async launch(): Promise<number> {
    const start = Date.now();
    await this.adb.launchApp(this.serial, this.packageName);
    await this.waitUntilStandalone();
    return Date.now() - start;
  }

  async stop(): Promise<void> {
    await this.adb.forceStop(this.serial, this.packageName);
    await this.adb.forceStop(this.serial, androidConfig.chromePackage); // PWAs run inside Chrome's process
  }

  async uninstall(): Promise<void> {
    if (this.pkg && (await this.adb.isInstalled(this.serial, this.pkg))) {
      await this.adb.uninstall(this.serial, this.pkg);
      this.log.info(`Uninstalled ${this.pkg}`);
    }
  }

  // ---------- state ----------

  /** The installed app's own activity is on screen (not a Chrome tab). */
  async isForeground(): Promise<boolean> {
    const top = await this.adb.foregroundActivity(this.serial);
    return !!top && (top.pkg === this.pkg || WEBAPP_ACTIVITY.test(top.activity));
  }

  /**
   * Standalone = our app's activity is foreground AND Chrome's URL bar is absent from the screen.
   * Both checks are native-Android facts; `display-mode: standalone` is checked separately in-page.
   */
  async isStandalone(): Promise<boolean> {
    if (!(await this.isForeground())) return false;
    return !hierarchyHasResource(await this.adb.uiHierarchy(this.serial), `${androidConfig.chromePackage}:id/url_bar`);
  }

  async waitUntilStandalone(timeoutMs = 30_000): Promise<void> {
    await pollUntil(() => this.isStandalone(), { timeoutMs, intervalMs: 1_000, description: 'the PWA to be foreground in standalone mode' });
  }

  async sendToBackground(): Promise<void> {
    await this.adb.pressKey(this.serial, 'KEYCODE_HOME');
  }

  async pressBack(): Promise<void> {
    await this.adb.pressKey(this.serial, 'KEYCODE_BACK');
  }

  // ---------- web content ----------

  /**
   * Attaches Playwright to the RUNNING installed PWA through Chrome's DevTools socket
   * (adb forward + connectOverCDP). Gives full Page access (evaluate, locators) to the live app.
   */
  async attach(): Promise<AttachedPwa> {
    const port = androidConfig.devtoolsPort;
    await this.adb.forwardDevTools(this.serial, port);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);

    const origin = new URL(this.url).origin;
    const page = await pollUntil(
      async () => browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith(origin)),
      { timeoutMs: 20_000, intervalMs: 500, description: `a DevTools page for ${origin}` },
    );

    return {
      page,
      browser,
      detach: async () => {
        await browser.close().catch(() => undefined);
        await this.adb.removeForward(this.serial, port);
      },
    };
  }
}
