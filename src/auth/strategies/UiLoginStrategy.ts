import { chromium, expect, type Page } from '@playwright/test';
import { credentialsFor, env, type Credentials, type Role } from '@config/environment';
import { LoginPage } from '@pages/LoginPage';
import { MicrosoftLoginPage } from '@pages/MicrosoftLoginPage';
import { SsoLoginPage } from '@pages/SsoLoginPage';
import { Logger } from '@utils/logger/Logger';
import { TokenService } from '../TokenService';
import type { AuthResult } from '../types';
import type { IAuthStrategy } from './IAuthStrategy';

/**
 * Logs in through the real UI. Which UI depends on AUTH_PROVIDER:
 *   form      the app's own username/password form
 *   microsoft "Sign in with Microsoft" (Entra ID), then back to the app
 * Captures cookies, localStorage AND IndexedDB (PWAs often keep sessions there).
 */
export class UiLoginStrategy implements IAuthStrategy {
  readonly name = 'ui';
  private readonly log = Logger.for('UiLoginStrategy');

  async authenticate(role: Role): Promise<AuthResult> {
    this.log.info(`UI login (${env.auth.provider}) for role "${role}" on ${env.name}`);
    const credentials = credentialsFor(role);
    const browser = await chromium.launch({ headless: env.headless });
    try {
      const context = await browser.newContext({ baseURL: env.baseUrl });
      const page = await context.newPage();

      if (env.auth.provider === 'microsoft') await this.loginWithMicrosoft(page, credentials);
      else await this.loginWithForm(page, credentials);

      const storageState = await context.storageState({ indexedDB: true });
      const sessionStorage = await this.readSessionStorage(page);
      this.log.info(`Captured ${storageState.cookies.length} cookies, sessionStorage keys: ${Object.keys(sessionStorage).length}`);
      return { strategy: 'ui', storageState, sessionStorage, token: TokenService.fromStorageState(storageState) };
    } finally {
      await browser.close();
    }
  }

  /** sessionStorage of the APP origin (empty if the page is elsewhere). Names are logged, never values. */
  private async readSessionStorage(page: Page): Promise<Record<string, string>> {
    if (new URL(page.url()).origin !== new URL(env.baseUrl).origin) return {};
    return page.evaluate(() => Object.fromEntries(Object.entries(window.sessionStorage)));
  }

  private async loginWithForm(page: Page, credentials: Credentials): Promise<void> {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(credentials);
    await expect(page, 'login should leave the login page').not.toHaveURL(/\/login/);
  }

  private async loginWithMicrosoft(page: Page, credentials: Credentials): Promise<void> {
    const appOrigin = new URL(env.baseUrl).origin;
    const appLogin = new SsoLoginPage(page);
    await appLogin.goto();
    await appLogin.signInWithMicrosoft();

    await new MicrosoftLoginPage(page).signIn(credentials);

    // Back on the app: the sign-in screen must be gone, proving the app accepted the Microsoft session.
    await page.waitForURL((u) => u.origin === appOrigin, { timeout: 30_000 });
    await expect(page.getByText('Sign in with Microsoft'), 'app should accept the Microsoft login').toBeHidden({ timeout: 30_000 });
    await this.waitForAppSession(page);
  }

  /**
   * The app exchanges the Microsoft result for its own token AFTER redirecting back, so the sign-in
   * screen disappearing is not enough: wait until the token is really stored before snapshotting.
   */
  private async waitForAppSession(page: Page): Promise<void> {
    await page.waitForFunction((key) => window.localStorage.getItem(key) !== null, env.auth.tokenKey, { timeout: 30_000 }).catch(() => {
      throw new Error(
        `Login finished but the app never stored "${env.auth.tokenKey}" in localStorage. Check AUTH_TOKEN_KEY / AUTH_TOKEN_LOCATION for ${env.name}.`,
      );
    });
  }
}
