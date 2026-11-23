import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { TokenService } from '@auth/TokenService';
import { SessionValidator } from '@auth/SessionValidator';
import { SessionStore } from '@auth/SessionStore';
import { AuthManager } from '@auth/AuthManager';
import { AutoStrategy } from '@auth/strategies/AutoStrategy';
import { ApiLoginUnsupportedError } from '@auth/strategies/ApiTokenStrategy';
import type { IAuthStrategy } from '@auth/strategies/IAuthStrategy';
import type { AuthResult, SessionMeta } from '@auth/types';
import { credentialsFor, env } from '@config/environment';

/** Builds an unsigned JWT-shaped string. Test data only: not a real credential. */
const fakeJwt = (expSecondsFromNow: number): string => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  return `${b64({ alg: 'none' })}.${b64({ exp })}.sig`;
};

const meta = (over: Partial<SessionMeta> = {}): SessionMeta => ({
  env: env.name,
  role: 'user',
  baseUrl: env.baseUrl,
  strategy: 'api',
  createdAt: Date.now(),
  expiresAt: Date.now() + 10 * 60_000,
  ...over,
});

test.describe('TokenService', () => {
  test('reads expiry from a JWT and returns null for opaque tokens', () => {
    const token = fakeJwt(600);
    const exp = TokenService.expiresAt(token);
    expect(exp).not.toBeNull();
    expect(exp! - Date.now()).toBeGreaterThan(590_000);
    expect(TokenService.expiresAt('opaque-token')).toBeNull();
  });

  test('round-trips a token through a storage state', () => {
    const state = TokenService.toStorageState('abc');
    expect(TokenService.fromStorageState(state)).toBe('abc');
  });
});

test.describe('SessionValidator', () => {
  const opts = { env: env.name, baseUrl: env.baseUrl, skewMs: 60_000 };

  test('accepts a fresh session', () => {
    expect(SessionValidator.validateLocal(meta(), fakeJwt(600), opts).valid).toBe(true);
  });

  test('rejects a session from another environment', () => {
    const r = SessionValidator.validateLocal(meta({ env: 'someother' }), undefined, opts);
    expect(r).toMatchObject({ valid: false });
  });

  test('rejects a session created for another base URL', () => {
    const r = SessionValidator.validateLocal(meta({ baseUrl: 'https://other.example.com' }), undefined, opts);
    expect(r.valid).toBe(false);
  });

  test('rejects when TTL is within the safety skew', () => {
    const r = SessionValidator.validateLocal(meta({ expiresAt: Date.now() + 30_000 }), undefined, opts);
    expect(r).toMatchObject({ valid: false, reason: 'session TTL reached' });
  });

  test('rejects an expired or nearly expired token', () => {
    expect(SessionValidator.validateLocal(meta(), fakeJwt(-5), opts).valid).toBe(false);
    expect(SessionValidator.validateLocal(meta(), fakeJwt(30), opts).valid).toBe(false);
  });

  test('stores the earlier of TTL and token expiry', () => {
    const now = Date.now();
    expect(SessionValidator.computeExpiry(fakeJwt(60), now, 3_600_000)).toBeLessThan(now + 61_000);
    expect(SessionValidator.computeExpiry('opaque', now, 120_000)).toBe(now + 120_000);
  });
});

test.describe('SessionStore', () => {
  let dir: string;
  test.beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sessions-'));
  });
  test.afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const result: AuthResult = { strategy: 'api', token: 't', storageState: TokenService.toStorageState('t') };

  test('saves, loads and deletes a session; a missing session is null', () => {
    const store = new SessionStore(dir);
    expect(store.load('user')).toBeNull();

    store.save('user', result, meta());
    const loaded = store.load('user');
    expect(loaded?.meta.role).toBe('user');
    expect(TokenService.fromStorageState(loaded!.state)).toBe('t');

    store.delete('user');
    expect(store.load('user')).toBeNull();
  });

  test('roles are isolated from each other', () => {
    const store = new SessionStore(dir);
    store.save('user', result, meta());
    expect(store.load('admin')).toBeNull();
  });

  test('a corrupt file is treated as no session', () => {
    const store = new SessionStore(dir);
    store.save('user', result, meta());
    fs.writeFileSync(store.statePath('user'), '{not json');
    expect(store.load('user')).toBeNull();
  });

  test('QA and Staging sessions live in different folders', () => {
    const qa = new SessionStore(path.join(dir, 'qa'));
    const staging = new SessionStore(path.join(dir, 'staging'));
    qa.save('user', result, meta({ env: 'qa' }));
    expect(staging.load('user')).toBeNull();
  });
});

test.describe('AuthManager', () => {
  let dir: string;
  test.beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sessions-'));
  });
  test.afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const counting = (token: string) => {
    const strategy = {
      name: 'fake',
      calls: 0,
      async authenticate(): Promise<AuthResult> {
        strategy.calls++;
        return { strategy: 'api', token, storageState: TokenService.toStorageState(token) };
      },
    };
    return strategy;
  };

  test('reuses a valid session instead of logging in again', async () => {
    const strategy = counting(fakeJwt(3600));
    const manager = new AuthManager(strategy, new SessionStore(dir), null);

    const first = await manager.ensureSession('user');
    const second = await new AuthManager(strategy, new SessionStore(dir), null).ensureSession('user');

    expect(strategy.calls).toBe(1);
    expect(second.token).toBe(first.token);
  });

  test('logs in again when the stored token has expired', async () => {
    const store = new SessionStore(dir);
    const expired = fakeJwt(-10);
    store.save('user', { strategy: 'api', token: expired, storageState: TokenService.toStorageState(expired) }, meta());

    const strategy = counting(fakeJwt(3600));
    await new AuthManager(strategy, store, null).ensureSession('user');
    expect(strategy.calls).toBe(1);
  });

  test('concurrent requests for one role share a single login', async () => {
    const strategy = counting(fakeJwt(3600));
    const manager = new AuthManager(strategy, new SessionStore(dir), null);
    await Promise.all([manager.ensureSession('user'), manager.ensureSession('user'), manager.ensureSession('user')]);
    expect(strategy.calls).toBe(1);
  });

  test('logout discards the session so the next call logs in again', async () => {
    const strategy = counting(fakeJwt(3600));
    const manager = new AuthManager(strategy, new SessionStore(dir), null);
    await manager.ensureSession('user');
    await manager.logout('user'); // no logout endpoint configured: only discards locally
    await manager.ensureSession('user');
    expect(strategy.calls).toBe(2);
  });
});

test.describe('AutoStrategy', () => {
  const result: AuthResult = { strategy: 'ui', storageState: { cookies: [], origins: [] } };
  const make = (impl: () => Promise<AuthResult>, name: string): IAuthStrategy => ({ name, authenticate: impl });

  test('falls back to UI when API login is unsupported', async () => {
    const auto = new AutoStrategy(
      make(() => Promise.reject(new ApiLoginUnsupportedError(404)), 'api'),
      make(() => Promise.resolve(result), 'ui'),
    );
    expect((await auto.authenticate('user')).strategy).toBe('ui');
  });

  test('does NOT mask a genuine login failure', async () => {
    const auto = new AutoStrategy(
      make(() => Promise.reject(new Error('API login failed: HTTP 401')), 'api'),
      make(() => Promise.resolve(result), 'ui'),
    );
    await expect(auto.authenticate('user')).rejects.toThrow(/401/);
  });
});

test.describe('credentials', () => {
  test('missing credentials produce an actionable error and never a blank login', () => {
    const saved = { ...process.env };
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    delete process.env[`${env.name.toUpperCase()}_ADMIN_USERNAME`];
    delete process.env[`${env.name.toUpperCase()}_ADMIN_PASSWORD`];
    try {
      expect(() => credentialsFor('admin')).toThrow(/ADMIN_USERNAME and ADMIN_PASSWORD/);
    } finally {
      Object.assign(process.env, saved);
    }
  });

  test('env-prefixed secrets win over unprefixed ones', () => {
    const prefix = env.name.toUpperCase();
    process.env.USER_USERNAME = 'plain';
    process.env.USER_PASSWORD = 'plain-pw';
    process.env[`${prefix}_USER_USERNAME`] = 'scoped';
    process.env[`${prefix}_USER_PASSWORD`] = 'scoped-pw';
    try {
      expect(credentialsFor('user').username).toBe('scoped');
    } finally {
      delete process.env.USER_USERNAME;
      delete process.env.USER_PASSWORD;
      delete process.env[`${prefix}_USER_USERNAME`];
      delete process.env[`${prefix}_USER_PASSWORD`];
    }
  });
});
