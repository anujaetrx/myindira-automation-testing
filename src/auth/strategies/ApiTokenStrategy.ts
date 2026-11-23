import { request } from '@playwright/test';
import { credentialsFor, env, type Role } from '@config/environment';
import { AuthApiClient } from '@api/clients/AuthApiClient';
import { loginResponseSchema } from '@api/schemas/user.schema';
import { Logger } from '@utils/logger/Logger';
import { TokenService } from '../TokenService';
import type { AuthResult } from '../types';
import type { IAuthStrategy } from './IAuthStrategy';

/** Thrown when the backend has no usable login API, so an 'auto' strategy can fall back to the UI. */
export class ApiLoginUnsupportedError extends Error {
  constructor(readonly status: number) {
    super(`API login not supported (HTTP ${status})`);
    this.name = 'ApiLoginUnsupportedError';
  }
}

/** Fast path: obtains a token over HTTP and places it where the app reads it. No browser needed. */
export class ApiTokenStrategy implements IAuthStrategy {
  readonly name = 'api';
  private readonly log = Logger.for('ApiTokenStrategy');

  async authenticate(role: Role): Promise<AuthResult> {
    this.log.info(`API login for role "${role}" on ${env.name}`);
    const ctx = await request.newContext({ baseURL: env.apiBaseUrl });
    try {
      const res = await new AuthApiClient(ctx).login(credentialsFor(role));
      if ([404, 405, 501].includes(res.status)) throw new ApiLoginUnsupportedError(res.status);
      if (!res.ok) throw new Error(`API login failed for role "${role}" on ${env.name}: HTTP ${res.status}`);

      const { token } = await res.body(loginResponseSchema);
      return { strategy: 'api', token, storageState: TokenService.toStorageState(token) };
    } finally {
      await ctx.dispose();
    }
  }
}
