import type { BrowserContext } from '@playwright/test';
import { env } from '@config/environment';
import type { Session } from './types';

/**
 * Applies a session to a context WITHOUT a storage-state file, by seeding the token before any
 * page script runs. Use when the browser cannot be created with `storageState` (some remote or
 * device-cloud sessions), or for storage that storageState does not capture.
 */
export const SessionInjector = {
  /**
   * Replays the app's sessionStorage before any page script runs (MSAL-style SPAs read it on startup).
   * Only applies on the app origin, and never overwrites a key the page has already set.
   */
  async applySessionStorage(context: BrowserContext, session: Session): Promise<void> {
    if (!session.sessionStorage || Object.keys(session.sessionStorage).length === 0) return;
    await context.addInitScript(
      ({ origin, entries }) => {
        if (window.location.origin !== origin) return;
        for (const [k, v] of Object.entries(entries)) {
          if (window.sessionStorage.getItem(k) === null) window.sessionStorage.setItem(k, v);
        }
      },
      { origin: new URL(env.baseUrl).origin, entries: session.sessionStorage },
    );
  },

  async apply(context: BrowserContext, session: Session): Promise<void> {
    if (!session.token) {
      throw new Error(`Session for "${session.role}" has no readable token to inject (HttpOnly cookie session?)`);
    }
    const url = new URL(env.baseUrl);

    if (env.auth.tokenLocation === 'cookie') {
      await context.addCookies([
        {
          name: env.auth.tokenKey,
          value: session.token,
          domain: url.hostname,
          path: '/',
          secure: url.protocol === 'https:',
          sameSite: 'Lax',
        },
      ]);
      return;
    }

    await context.addInitScript(
      ({ origin, key, value }) => {
        if (window.location.origin === origin) window.localStorage.setItem(key, value);
      },
      { origin: url.origin, key: env.auth.tokenKey, value: session.token },
    );
  },
};
