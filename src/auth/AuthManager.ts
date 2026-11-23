import { request } from '@playwright/test';
import { env, ROLES, type Role } from '@config/environment';
import { AuthApiClient } from '@api/clients/AuthApiClient';
import { Logger } from '@utils/logger/Logger';
import { SessionStore } from './SessionStore';
import { SessionValidator } from './SessionValidator';
import type { IAuthStrategy } from './strategies/IAuthStrategy';
import { ApiTokenStrategy } from './strategies/ApiTokenStrategy';
import { AutoStrategy } from './strategies/AutoStrategy';
import { UiLoginStrategy } from './strategies/UiLoginStrategy';
import { ApiAuthHeaders } from './ApiAuthHeaders';
import { TokenService } from './TokenService';
import type { Session, StorageState } from './types';

/**
 * Facade for everything authentication. Tests and fixtures only talk to this class.
 *
 *   ensureSession(role)  reuse a valid session or log in again
 *   logout(role)         server-side logout (if the backend has it) + discard the session
 *   invalidate(role)     discard a session without calling the server
 *
 * Collaborators are injected (strategy, store) so each can be replaced or faked in tests.
 */
export class AuthManager {
  private readonly log = Logger.for('AuthManager');
  /** De-duplicates concurrent logins for the same role inside one worker process. */
  private readonly inFlight = new Map<Role, Promise<Session>>();

  constructor(
    private readonly strategy: IAuthStrategy = AuthManager.defaultStrategy(),
    private readonly store: SessionStore = new SessionStore(),
    /** Header template (AUTH_API_HEADERS). Injectable so unit tests do not depend on the active environment. */
    private readonly headerTemplate: Record<string, string> | null = env.auth.apiHeaders ?? null,
  ) {}

  static defaultStrategy(): IAuthStrategy {
    switch (env.auth.strategy) {
      case 'ui':
        return new UiLoginStrategy();
      case 'api':
        return new ApiTokenStrategy();
      default:
        return new AutoStrategy(new ApiTokenStrategy(), new UiLoginStrategy());
    }
  }

  async ensureSession(role: Role): Promise<Session> {
    const pending = this.inFlight.get(role);
    if (pending) return pending;

    const work = this.resolveSession(role).finally(() => this.inFlight.delete(role));
    this.inFlight.set(role, work);
    return work;
  }

  /** Convenience for API clients that only need the bearer token. */
  async tokenFor(role: Role): Promise<string | undefined> {
    return (await this.ensureSession(role)).token;
  }

  /** What an API client must send for this role: the app's header set, else a plain Bearer token. */
  async apiAuthFor(role: Role): Promise<Record<string, string> | undefined> {
    return (await this.ensureSession(role)).apiHeaders;
  }

  async logout(role: Role): Promise<void> {
    const stored = this.store.load(role);
    const headers = stored ? this.apiHeaders(role, stored.state, stored.sessionStorage) : undefined;

    if (headers && env.auth.logoutEndpoint) {
      const ctx = await request.newContext({ baseURL: env.apiBaseUrl });
      try {
        const res = await new AuthApiClient(ctx, headers).logout();
        this.log.info(`Server logout for "${role}": HTTP ${res.status}`);
      } catch (error) {
        this.log.warn(`Server logout failed for "${role}" (session still discarded): ${String(error)}`);
      } finally {
        await ctx.dispose();
      }
    }
    this.invalidate(role);
  }

  invalidate(role: Role): void {
    this.store.delete(role);
    this.inFlight.delete(role);
    this.log.info(`Session discarded for "${role}" on ${env.name}`);
  }

  async logoutAll(): Promise<void> {
    for (const role of ROLES) await this.logout(role);
  }

  // ---------- internals ----------

  private async resolveSession(role: Role): Promise<Session> {
    const stored = this.store.load(role);

    if (stored) {
      const token = TokenService.fromStorageState(stored.state);
      let verdict = SessionValidator.validateLocal(stored.meta, token);
      const apiHeaders = this.apiHeaders(role, stored.state, stored.sessionStorage);
      if (verdict.valid && env.auth.validateRemote && apiHeaders) {
        verdict = await SessionValidator.validateRemote(apiHeaders);
      }
      if (verdict.valid) {
        this.log.debug(`Reusing session for "${role}" (${stored.meta.strategy})`);
        return { role, storageStatePath: stored.statePath, token, sessionStorage: stored.sessionStorage, apiHeaders, meta: stored.meta };
      }
      this.log.info(`Session for "${role}" is not reusable: ${verdict.reason}`);
      this.store.delete(role);
    }

    return this.login(role);
  }

  /** Template-driven headers if configured, else a plain Bearer token if one is readable, else none. */
  private apiHeaders(role: Role, state: StorageState, sessionStorage?: Record<string, string>): Record<string, string> | undefined {
    if (this.headerTemplate) {
      return ApiAuthHeaders.resolve(this.headerTemplate, { role, localStorage: TokenService.localStorageOf(state), sessionStorage });
    }
    const token = TokenService.fromStorageState(state);
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }

  private async login(role: Role): Promise<Session> {
    const result = await this.strategy.authenticate(role);
    const createdAt = Date.now();
    const meta = {
      env: env.name,
      baseUrl: env.baseUrl,
      createdAt,
      expiresAt: SessionValidator.computeExpiry(result.token, createdAt),
    };
    const storageStatePath = this.store.save(role, result, meta);
    this.log.info(`New ${result.strategy} session for "${role}" on ${env.name}`);
    return {
      role,
      storageStatePath,
      token: result.token,
      sessionStorage: result.sessionStorage,
      apiHeaders: this.apiHeaders(role, result.storageState, result.sessionStorage),
      meta: { ...meta, role, strategy: result.strategy },
    };
  }
}
