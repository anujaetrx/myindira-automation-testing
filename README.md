# MyIndira PWA Automation

Playwright + TypeScript framework: Page Object Model, fixtures-based DI, typed API layer, PWA helpers.

## Setup

```bash
npm install
npx playwright install
```

Set the environment (default `qa`) and secrets:

- Non-secret values: `config/env/<env>.env` (committed). **Replace the placeholder URLs.**
- Secrets: `config/env/<env>.local.env` (git-ignored) or CI secrets. See `config/env/.env.example`.

## Run

| Command | What it does |
|---|---|
| `npm run test:smoke` | `@smoke` tests |
| `npm run test:pwa` | PWA suites (manifest, service worker, offline, install) |
| `npm run test:api` | API tests only (no browser) |
| `npm run test:qa` / `test:staging` | Whole suite against that environment |
| `npm run report` | Open the HTML report |
| `npm run allure:generate && npm run allure:open` | Allure report |

## Authentication

`AuthManager` (src/auth) is the only thing specs and fixtures use.

| Part | Role |
|---|---|
| `strategies/` | `ApiTokenStrategy`, `UiLoginStrategy`, `AutoStrategy` (API, falls back to UI only if the API route is missing), `OtpStrategy` (stub) |
| `SessionStore` | Persists storage state + metadata per environment and role, with atomic writes |
| `SessionValidator` | Rejects sessions from another env/URL, past TTL, or with a near-expiry JWT; optional server check |
| `TokenService` | Reads JWT expiry, places/reads the token (localStorage or cookie) |
| `SessionInjector` | Seeds a token into a context when a storage-state file cannot be used |

Rules: credentials come only from environment variables (`ADMIN_USERNAME`, `USER_PASSWORD`, ...). In CI
use prefixed names (`QA_ADMIN_PASSWORD`, `STAGING_ADMIN_PASSWORD`) so both environments can coexist.
Tokens are never logged. Run `npm run test:unit` to verify the auth module without an app.

## Layers (dependencies point downward only)

```
tests → fixtures → pages / api / auth / pwa → components → utils / config
```

Rules: specs never use `new` or `page.locator()`; locators live in `pages/` and `components/`;
assertions live in specs; no hard waits.

## Adding things

- **Page**: extend `BasePage` in `src/pages`, then register it in `src/fixtures/pages.fixture.ts`.
- **Component**: extend `BaseComponent` in `src/components`.
- **API client**: extend `BaseApiClient`, add models and a Zod schema, expose it in `api.fixture.ts`.
- **Login method**: implement `IAuthStrategy` and select it in `AuthManager`.

## Outputs (git-ignored)

`reports/` (html, allure-results, junit, json) and `artifacts/` (screenshots, videos, traces, logs).

## Placeholders to replace

Selectors, URLs (`/login`, `/dashboard`, `/profile`) and API endpoints are generic and must be aligned with the real app.
