import type { Locator, Page } from '@playwright/test';
import type { Credentials } from '@config/environment';
import { BasePage } from './BasePage';

/** Thrown for sign-in outcomes a test account cannot get past automatically (MFA, bad password, lockout). */
export class MicrosoftSignInError extends Error {
  constructor(
    readonly reason: 'mfa' | 'bad-credentials' | 'locked' | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'MicrosoftSignInError';
  }
}

/**
 * Microsoft's hosted sign-in page (login.microsoftonline.com). It is not part of the app, but it is
 * a page like any other: one object, interactions only. Selectors use Microsoft's stable field names.
 */
export class MicrosoftLoginPage extends BasePage {
  protected readonly path = ''; // never navigated to directly: the app redirects here

  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly nextButton: Locator;
  private readonly signInButton: Locator;
  private readonly staySignedInNo: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[name="loginfmt"]');
    this.passwordInput = page.locator('input[name="passwd"]');
    this.nextButton = page.getByRole('button', { name: /^next$/i });
    this.signInButton = page.getByRole('button', { name: /^sign in$/i });
    this.staySignedInNo = page.getByRole('button', { name: /^no$/i });
  }

  async waitForReady(): Promise<void> {
    await this.waits.forVisible(this.emailInput);
  }

  /** Completes the whole Microsoft step and returns once control has left login.microsoftonline.com. */
  async signIn({ username, password }: Credentials): Promise<void> {
    await this.waitForReady();
    await this.actions.fill(this.emailInput, username, 'Microsoft email');
    await this.actions.click(this.nextButton, 'Next');

    await this.waits.forVisible(this.passwordInput.or(this.page.locator('#usernameError')));
    await this.failIfRejected('bad-credentials');
    await this.actions.fill(this.passwordInput, password, 'Microsoft password');
    await this.actions.click(this.signInButton, 'Sign in');

    await this.handleNextStep();
  }

  /** After the password: "Stay signed in?", an error, an MFA challenge, or straight back to the app. */
  private async handleNextStep(): Promise<void> {
    const stay = this.page.getByText(/stay signed in\?/i);
    const passwordError = this.page.locator('#passwordError');
    const mfa = this.page.getByText(/approve sign in request|enter code|verify your identity|more information required|authenticator/i);
    const locked = this.page.getByText(/account is locked|temporarily locked/i);
    const leftMicrosoft = this.page.waitForURL((u) => !u.host.endsWith('microsoftonline.com'), { timeout: 30_000 }).then(() => 'app' as const);

    const outcome = await Promise.race([
      stay.waitFor({ timeout: 30_000 }).then(() => 'stay' as const),
      passwordError.waitFor({ timeout: 30_000 }).then(() => 'bad' as const),
      mfa.first().waitFor({ timeout: 30_000 }).then(() => 'mfa' as const),
      locked.first().waitFor({ timeout: 30_000 }).then(() => 'locked' as const),
      leftMicrosoft,
    ]);

    switch (outcome) {
      case 'stay':
        // "No": do not create a persistent Microsoft session on a test browser.
        await this.actions.click(this.staySignedInNo, 'Stay signed in? -> No');
        return;
      case 'bad':
        throw new MicrosoftSignInError('bad-credentials', `Microsoft rejected the credentials: ${await passwordError.innerText()}`);
      case 'mfa':
        throw new MicrosoftSignInError(
          'mfa',
          'Microsoft is asking for MFA. Use a test account excluded from MFA (conditional access), or capture a session manually: npx playwright codegen --save-storage=<file>.',
        );
      case 'locked':
        throw new MicrosoftSignInError('locked', 'The Microsoft account is locked. Do not retry; unlock it first.');
      default:
        return;
    }
  }

  private async failIfRejected(reason: 'bad-credentials'): Promise<void> {
    const usernameError = this.page.locator('#usernameError');
    if (await usernameError.isVisible()) {
      throw new MicrosoftSignInError(reason, `Microsoft does not recognise the account: ${await usernameError.innerText()}`);
    }
  }
}
