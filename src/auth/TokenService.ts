import { env } from '@config/environment';
import type { StorageState } from './types';

type JwtPayload = { exp?: number; iat?: number; [claim: string]: unknown };

/**
 * Token handling: decode (never verify; we are a client), read expiry, place a token where the
 * app expects it, and read it back from a storage state. No token or password is ever logged.
 */
export const TokenService = {
  /** Decodes a JWT payload. Returns null for opaque (non-JWT) tokens. */
  decode(token: string): JwtPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
      return JSON.parse(json) as JwtPayload;
    } catch {
      return null;
    }
  },

  /** Expiry in epoch ms, or null when the token is opaque or has no `exp`. */
  expiresAt(token: string): number | null {
    const exp = TokenService.decode(token)?.exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  },

  /** Builds a storage state that holds the token where the app reads it. */
  toStorageState(token: string, baseUrl: string = env.baseUrl): StorageState {
    const url = new URL(baseUrl);
    if (env.auth.tokenLocation === 'cookie') {
      return {
        cookies: [
          {
            name: env.auth.tokenKey,
            value: token,
            domain: url.hostname,
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: url.protocol === 'https:',
            sameSite: 'Lax',
          },
        ],
        origins: [],
      };
    }
    return {
      cookies: [],
      origins: [{ origin: url.origin, localStorage: [{ name: env.auth.tokenKey, value: token }] }],
    };
  },

  /** localStorage of the app origin as a plain map. */
  localStorageOf(state: StorageState, baseUrl: string = env.baseUrl): Record<string, string> {
    const origin = new URL(baseUrl).origin;
    const items = state.origins.filter((o) => o.origin === origin).flatMap((o) => o.localStorage);
    return Object.fromEntries(items.map((i) => [i.name, i.value]));
  },

  /** Reads the token back from a storage state, wherever the app keeps it. */
  fromStorageState(state: StorageState): string | undefined {
    const fromLocal = state.origins
      .flatMap((o) => o.localStorage)
      .find((i) => i.name === env.auth.tokenKey)?.value;
    return fromLocal ?? state.cookies.find((c) => c.name === env.auth.tokenKey)?.value;
  },
};
