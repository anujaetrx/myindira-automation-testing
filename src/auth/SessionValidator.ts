import { request } from '@playwright/test';
import { env } from '@config/environment';
import { AuthApiClient } from '@api/clients/AuthApiClient';
import { TokenService } from './TokenService';
import type { SessionMeta, ValidationResult } from './types';

export interface ValidationOptions {
  env: string;
  baseUrl: string;
  skewMs: number;
  now?: number;
}

/**
 * Session expiry validation in two layers:
 *  1. Local (free, pure): right environment? within TTL? token `exp` not near?
 *  2. Remote (optional, AUTH_VALIDATE_REMOTE): ask the server whether the token is still accepted.
 */
export const SessionValidator = {
  validateLocal(
    meta: SessionMeta,
    token: string | undefined,
    opts: ValidationOptions = { env: env.name, baseUrl: env.baseUrl, skewMs: env.auth.expirySkewMs },
  ): ValidationResult {
    const now = opts.now ?? Date.now();

    if (meta.env !== opts.env) {
      return { valid: false, reason: `session belongs to "${meta.env}", running "${opts.env}"` };
    }
    if (meta.baseUrl !== opts.baseUrl) {
      return { valid: false, reason: `session was created for ${meta.baseUrl}, running ${opts.baseUrl}` };
    }
    if (meta.expiresAt !== null && now + opts.skewMs >= meta.expiresAt) {
      return { valid: false, reason: 'session TTL reached' };
    }
    const tokenExp = token ? TokenService.expiresAt(token) : null;
    if (tokenExp !== null && now + opts.skewMs >= tokenExp) {
      return { valid: false, reason: 'token expired or about to expire' };
    }
    return { valid: true };
  },

  /** Server-side check. A network error is treated as "unknown", not "invalid", to avoid needless re-logins. */
  async validateRemote(auth: string | Record<string, string>): Promise<ValidationResult> {
    const ctx = await request.newContext({ baseURL: env.apiBaseUrl });
    try {
      const res = await new AuthApiClient(ctx, auth).me();
      if (res.status === 401 || res.status === 403) {
        return { valid: false, reason: `server rejected token (HTTP ${res.status})` };
      }
      return { valid: true };
    } catch {
      return { valid: true };
    } finally {
      await ctx.dispose();
    }
  },

  /** Computes the `expiresAt` to store: earliest of token expiry and TTL. */
  computeExpiry(token: string | undefined, createdAt: number, ttlMs: number = env.auth.sessionTtlMs): number {
    const ttlExpiry = createdAt + ttlMs;
    const tokenExp = token ? TokenService.expiresAt(token) : null;
    return tokenExp === null ? ttlExpiry : Math.min(ttlExpiry, tokenExp);
  },
};
