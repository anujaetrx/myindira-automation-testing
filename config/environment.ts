import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Environment management.
 * Load order (first value wins, dotenv never overrides existing vars):
 *   1. real process env (CI secrets)
 *   2. config/env/<TEST_ENV>.local.env (developer secrets, git-ignored)
 *   3. config/env/<TEST_ENV>.env (committed, non-secret)
 *
 * QA and Staging are fully separated: separate env files, separate credentials,
 * separate session files, and sessions record the env they were created for.
 */
const TEST_ENVS = ['dev', 'qa', 'staging'] as const;
export type TestEnv = (typeof TEST_ENVS)[number];

const rawEnv = (process.env.TEST_ENV ?? 'qa') as TestEnv;
if (!TEST_ENVS.includes(rawEnv)) {
  throw new Error(`Invalid TEST_ENV "${rawEnv}". Allowed: ${TEST_ENVS.join(', ')}`);
}

const envDir = path.resolve(__dirname, 'env');
dotenv.config({ path: path.join(envDir, `${rawEnv}.local.env`), quiet: true });
dotenv.config({ path: path.join(envDir, `${rawEnv}.env`), quiet: true });

const bool = (def: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(def)
    .transform((v) => v === 'true');

const schema = z.object({
  BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  // Path every API route lives under, e.g. /myindiranew/api (a leading-slash route would otherwise drop it).
  API_PATH_PREFIX: z
    .string()
    .default('')
    .transform((p) => {
      const trimmed = p.split('/').filter(Boolean).join('/'); // "/a/b/" -> "a/b"
      return trimmed ? `/${trimmed}` : '';
    }),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  HEADLESS: bool('true'),

  // 'auto' = try API login first, fall back to UI login if the API route is unsupported.
  AUTH_STRATEGY: z.enum(['ui', 'api', 'auto']).default('auto'),
  // 'form' = username/password form in the app; 'microsoft' = "Sign in with Microsoft" (Entra ID SSO)
  AUTH_PROVIDER: z.enum(['form', 'microsoft']).default('form'),
  AUTH_LOGIN_ENDPOINT: z.string().default('/auth/login'),
  AUTH_LOGOUT_ENDPOINT: z.string().default(''),
  AUTH_ME_ENDPOINT: z.string().default('/users/me'),
  // JSON map of header -> template, e.g. {"Authorization":"Bearer ${ls:sso_token}"}. Empty = plain Bearer token.
  AUTH_API_HEADERS: z
    .string()
    .default('')
    .transform((raw, ctx): Record<string, string> | undefined => {
      if (!raw.trim()) return undefined;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Object.values(parsed).every((v) => typeof v === 'string')) {
          return parsed as Record<string, string>;
        }
      } catch {
        /* fall through to the issue below */
      }
      ctx.addIssue({ code: 'custom', message: 'must be a JSON object of header name -> string template' });
      return z.NEVER;
    }),
  AUTH_TOKEN_KEY: z.string().default('token'),
  AUTH_TOKEN_LOCATION: z.enum(['localStorage', 'cookie']).default('localStorage'),
  AUTH_SESSION_TTL_MINUTES: z.coerce.number().positive().default(30),
  AUTH_EXPIRY_SKEW_SECONDS: z.coerce.number().nonnegative().default(60),
  AUTH_VALIDATE_REMOTE: bool('false'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration for "${rawEnv}":\n${issues}`);
}
const e = parsed.data;

/** CI can hold several environments' secrets at once: QA_ADMIN_PASSWORD wins over ADMIN_PASSWORD when TEST_ENV=qa. */
const secret = (key: string): string =>
  process.env[`${rawEnv.toUpperCase()}_${key}`] ?? process.env[key] ?? '';

export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

export const env = {
  name: rawEnv,
  baseUrl: e.BASE_URL,
  apiBaseUrl: e.API_BASE_URL,
  apiPathPrefix: e.API_PATH_PREFIX,
  headless: e.HEADLESS,
  logLevel: e.LOG_LEVEL,
  isCI: !!process.env.CI,
  auth: {
    strategy: e.AUTH_STRATEGY,
    provider: e.AUTH_PROVIDER,
    loginEndpoint: e.AUTH_LOGIN_ENDPOINT,
    logoutEndpoint: e.AUTH_LOGOUT_ENDPOINT,
    meEndpoint: e.AUTH_ME_ENDPOINT,
    apiHeaders: e.AUTH_API_HEADERS,
    tokenKey: e.AUTH_TOKEN_KEY,
    tokenLocation: e.AUTH_TOKEN_LOCATION,
    sessionTtlMs: e.AUTH_SESSION_TTL_MINUTES * 60_000,
    expirySkewMs: e.AUTH_EXPIRY_SKEW_SECONDS * 1000,
    validateRemote: e.AUTH_VALIDATE_REMOTE,
  },
} as const;

export type Env = typeof env;

export interface Credentials {
  username: string;
  password: string;
}

/**
 * Credentials are read lazily and only from environment variables, never from source.
 * Fails with an actionable message instead of sending an empty login request.
 */
export function credentialsFor(role: Role): Credentials {
  const prefix = role.toUpperCase();
  const username = secret(`${prefix}_USERNAME`);
  const password = secret(`${prefix}_PASSWORD`);
  if (!username || !password) {
    const env_ = rawEnv.toUpperCase();
    throw new Error(
      `Missing credentials for role "${role}" in "${rawEnv}". Set ${prefix}_USERNAME and ${prefix}_PASSWORD ` +
        `(or ${env_}_${prefix}_USERNAME / ${env_}_${prefix}_PASSWORD) in config/env/${rawEnv}.local.env or CI secrets.`,
    );
  }
  return { username, password };
}

/** True when both variables for the role are set. Lets setup skip roles that have no test account yet. */
export function hasCredentials(role: Role): boolean {
  const prefix = role.toUpperCase();
  return !!secret(`${prefix}_USERNAME`) && !!secret(`${prefix}_PASSWORD`);
}
