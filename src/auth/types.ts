import type { BrowserContext } from '@playwright/test';
import type { Role } from '@config/environment';

/** Playwright's storage-state shape (cookies, localStorage, optionally IndexedDB). */
export type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

export type StrategyName = 'ui' | 'api' | 'otp';

/** What a login strategy produces. It never touches the disk: persistence is SessionStore's job. */
export interface AuthResult {
  storageState: StorageState;
  /** Bearer token when it is readable by scripts (not available for HttpOnly-cookie sessions). */
  token?: string;
  strategy: StrategyName;
  /** App-origin sessionStorage. Playwright's storageState does not capture it, but MSAL-style SPAs keep their login there. */
  sessionStorage?: Record<string, string>;
}

/** Metadata stored next to the storage state; used to decide whether a cached session can be reused. */
export interface SessionMeta {
  env: string;
  role: Role;
  baseUrl: string;
  strategy: StrategyName;
  createdAt: number;
  /** Earliest of (token exp, createdAt + TTL), epoch ms. null = unknown. */
  expiresAt: number | null;
}

/** A ready-to-use session handed to fixtures and API clients. */
export interface Session {
  role: Role;
  storageStatePath: string;
  token?: string;
  sessionStorage?: Record<string, string>;
  /** Headers the app sends with API calls (from AUTH_API_HEADERS, else a plain Bearer token). */
  apiHeaders?: Record<string, string>;
  meta: SessionMeta;
}

export type ValidationResult = { valid: true } | { valid: false; reason: string };
