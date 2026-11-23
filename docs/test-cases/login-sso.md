# Test cases: Login page and Microsoft SSO

**Screen:** sign-in screen "Campus Connect" (anonymous visitors, any URL) on QA, `https://app-test.k.indiraiscm.com`
**Story:** IUN-3224 "Login Page UI & Microsoft SSO Integration" (status QA FAILED; rules BR-SSO-01 to BR-SSO-05; scenarios 1-5; QA cases TC_LOGIN_001 to TC_LOGIN_008)
**Automation:**
- `tests/e2e/IUN3224-LoginSSO/IUN3224-login.spec.ts` (existing: real Microsoft login of the admin, anonymous guard)
- `tests/e2e/IUN3224-LoginSSO/IUN3224-login-sso.spec.ts` (new: anonymous side: content, redirect, cancel, failed callback, guard, responsive)
- `tests/e2e/IUN3224-LoginSSO/IUN3224-session.spec.ts` (rewritten: persistence, token storage and lifetime, expiry, sign out, roles)
- page objects `src/pages/SsoLoginPage.ts` (extended), `src/pages/DashboardPage.ts` (avatar menu / sign-out added)
**Last run:** 2026-11-20, chromium, QA. See "Run summary" at the end.

Run: `npx playwright test tests/e2e/auth --project=chromium --workers=2`
Safety: no credentials are typed by the new tests. Requests to `login.microsoftonline.com` are answered with a stub page (the test only checks where the app sends the browser and with which parameters). Fake tokens are answered locally (the token exchange is mocked), nothing reaches the real auth endpoint. Sign Out is client side only and was verified to send no request; Microsoft and all writes are blocked in those tests anyway. Each test has its own browser context, so clearing storage never touches the stored session file. Tokens are only checked for presence, JWT shape and claims; they are never printed.

## How the real flow works (observed on QA)
1. Any URL of an anonymous visitor renders the sign-in screen and the address becomes `/` (there is no `/login` and no `/auth/callback` route).
2. "Sign in with Microsoft" is a plain link (`<a href>`) to `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?response_type=token&client_id=<guid>&scope=openid profile email&redirect_uri=<app root>` (implicit flow, no `state`, no PKCE, no `nonce`).
3. Microsoft returns to the app root with `#access_token=...`; the app calls `POST /auth/sso-login` with the Microsoft token as Bearer. On success the app stores `sso_token`, `internal_token` (a 30-minute JWT) and `user_profile` in localStorage and `sessionId` in sessionStorage. On failure it shows an "Unauthorized" page with the backend's message and a "Back to Login" button.
4. A 401 from any API call later ends the session (storage cleared, sign-in screen). Sign Out is a custom confirmation dialog and only clears storage.

## Coverage

| Story item | Test (file) | Result |
|---|---|---|
| Scenario 1 / TC_LOGIN_001 content: "Campus Connect", "Sign in to continue", scope text, button, helper text | login-sso: screen shows brand, headline, scope text, button, helper (below the button) | Pass |
| TC_LOGIN_001 dual logo | logo loads, correct image, aspect ratio within 2% | Pass |
| TC_LOGIN_001 teal gradient header, logo above the card | brand block on a gradient, order logo / subtitle / headline | Pass |
| TC_LOGIN_001 "root or /login" | /login renders the same screen | Pass |
| TC_LOGIN_001 route is /login | URL stays /login | **Deviation** (`test.fail`) |
| Validation UI typography: white bold label, soft elevation, Microsoft icon | computed style (colour, weight, shadow, icon glyph, bg within 3 units of #145684) | Pass |
| Validation: background exactly #145684 | | **Deviation** (`test.fail`, trivial: #155685) |
| TC_LOGIN_002 click redirects to login.microsoftonline.com | host, authorize path (Microsoft stubbed) | Pass |
| TC_LOGIN_002 query: client_id, redirect_uri = the app, scope openid, response_type present | | Pass |
| TC_LOGIN_002 button is a link with the authorize href; no password / token in the URL | | Pass |
| Functional scope: "using the tenant ID" | | **Deviation** (`test.fail`): multi-tenant `organizations` endpoint |
| Scenario 2 / TC_LOGIN_003 authorization code, callback `/auth/callback` | | **Deviation** (`test.fail`): implicit flow `response_type=token`, no callback route |
| Validation State & PKCE (state, code_challenge S256, unique state per attempt) | 2 tests | **Deviation** (`test.fail`, security) |
| TC_LOGIN_003 token exchange: fragment token sent to `POST /auth/sso-login` with Authorization header (mocked answer) | | Pass |
| TC_LOGIN_003 tokens stored: `sso_token`, `internal_token`, `user_profile`; JWT shape; ADMIN role and e-mail claims | session | Pass |
| BR-SSO-01 institutional domain | the signed-in profile e-mail ends with @indiraedu.com / @indiraiscm.com | Pass (positive side only) |
| Scenario 3 / TC_LOGIN_004 personal account rejected with "Please sign in with your official university Microsoft account." | mocked `/auth/sso-login` 403 shows that message on an "Unauthorized" page, nothing stored | Pass (text comes from the backend) |
| Validation Tenant verification: "Access restricted to Indira University accounts only" | mocked 400, message shown | Pass |
| Scenario 3 / Validation: shown as inline alert / toast on /login | | **Deviation** (`test.fail`, low): separate "Unauthorized" page |
| "Back to Login" returns to the sign-in screen | | Pass |
| Failed exchange 500 | way back offered, nothing stored | Pass; shown as "Unauthorized" (`test.fail`, low) |
| Scenario 4 / TC_LOGIN_005 cancel: back from Microsoft, error params in query and in fragment | intact screen, no errors, nothing stored, button works again | Pass |
| Forged token in the URL | not signed in, no admin API call | Pass |
| Protected route guard (functional scope "Login Route Access") | /dashboard, /policies, /acknowledgements, /compliance, /master-data, unknown route: sign-in screen, no admin API call | Pass |
| Scenario 5 / TC_LOGIN_007 responsive 360, 375, 768, 1920: no overflow, logo inside viewport, 5% aspect tolerance, tap target >= 44 high, centred | 6 tests | Pass |
| TC_LOGIN_008 / BR-SSO-05 reload keeps the session (dashboard and deep route), second tab signed in | 3 tests | Pass |
| BR-SSO-04 admin lands on /dashboard (also when opening "/") | | Pass |
| BR-SSO-04 student -> /feed, faculty -> /timetable (profile mocked) | 2 tests | **Deviation** (`test.fail`) |
| Unauthorized role: student profile does not see the admin dashboard | | Pass (student home rendered) |
| Unauthorized role: no admin API call for a student profile | | **Deviation** (`test.fail`, mocked) |
| BR-SSO-02 session in HTTP-only cookies (Scenario 2) | | **Deviation** (`test.fail`): localStorage |
| BR-SSO-02 JWT lifetime 8 hours | | **Deviation** (`test.fail`): 30 minutes |
| BR-SSO-02 session expiry: token removed / 401 from the API / discarded session | 5 tests | Pass |
| BR-SSO-02 explicit logout: menu content, Cancel keeps session, Sign Out clears tokens and shows sign-in, protected URL and back button afterwards | 4 tests | Pass |
| Existing tests: admin signs in with Microsoft (real login), visitor sees only the sign-in option | IUN3224-login.spec.ts | Pass (unchanged) |
| Existing `IUN3224-session.spec.ts` (3 generic tests on `userPage`) | replaced by the admin-based tests above | See "Existing tests" |
| Existing `profile.spec.ts` (2 generic tests) | skipped on purpose | See "Existing tests" |

## Where the app differs from the story

| # | Story expects | App does | Severity guess |
|---|---|---|---|
| 1 | Session lasts 8 hours of inactivity (BR-SSO-02) | The internal JWT lives 30 minutes (exp - iat = 1800 s); the user is signed out after 30 min of use. The Microsoft token lives about 65 min | **High** (UAT users will be thrown out) |
| 2 | Authorization code flow, redirect to `/auth/callback`, PKCE and OAuth `state` (Scenario 2, Validation State & PKCE) | Implicit flow (`response_type=token`), redirect to the app root, no `state`, no `code_challenge`, no `nonce`; the href is static | **High** (security: CSRF / token replay, token in the URL fragment) |
| 3 | Secure HTTP-only cookies (Scenario 2) | JWTs in localStorage, readable by any script (XSS) | **High** (security) |
| 4 | Faculty land on /timetable, students on /feed (BR-SSO-04) | Everybody lands on `/dashboard`; the app renders a student home or a feed on that URL by role (seen with a mocked `/auth/me`, no real student account) | Medium |
| 5 | A student must not reach admin functions | With a student profile the app still calls `GET /admin/dashboard` (seen mocked). The server must refuse it; not verifiable with an admin account | Medium (to confirm with the backend) |
| 6 | Error alert / toast on /login for rejected accounts (Scenario 3, Tenant verification) | Separate "Unauthorized" page with the backend message and "Back to Login"; every failure (400, 401, 403, 500) is titled "Unauthorized" | Low |
| 7 | Route `/login` (title, Scenario 1) | No such route: every anonymous URL becomes `/`, so a deep link is also lost after login (the story does not require returning to it) | Low |
| 8 | Tenant id in the authorize URL | Multi-tenant `organizations` endpoint; the restriction depends on the backend | Low / Medium (confirm intent) |
| 9 | Button #145684 | #155685 | Trivial |
| 10 | Sign Out ends the session (BR-SSO-02) | Only the browser storage is cleared; no call is sent, so the token stays valid on the server until it expires (not verified: revoking the shared QA token was avoided) | Medium (to confirm) |
| 11 | Button font | Label is rendered in the browser default serif (Times New Roman), not the app font (visible in the screenshot; the story gives no font) | Low |
| 12 | Logo keeps its aspect ratio (Scenario 5) | At 360 px the box is 272 x 165 for a 900 x 529 image (3% squeeze); at 1280 and 1920 it is exact | Trivial |
| 13 | `/auth/me` failure (401 / 500) | The app keeps the page using the profile cached in localStorage (observed, not asserted) | Info |

## Not automated

| Case | Why |
|---|---|
| Scenario 2 / TC_LOGIN_003 full login with a valid @indiraedu.com account + MFA | Real login is done by the framework's `setup` project (and one existing smoke test). Extra logins would also burn the shared 30-minute session. No credentials are typed by the new tests |
| TC_LOGIN_004 real login with a personal @outlook / @gmail account | No such account; the rejection is covered with a mocked `/auth/sso-login` answer, so the real backend wording and rule (BR-SSO-01 negative side) are untested |
| TC_LOGIN_005 real "Cancel" on the Microsoft page | The Microsoft page is not driven; simulated with browser Back and with `error=access_denied` in the URL |
| TC_LOGIN_006 real faculty / student logins | Only an ADMIN login exists. Landing for other roles was simulated by mocking `GET /auth/me` |
| BR-SSO-03 just-in-time provisioning of a first-time user | Needs a registry user who never logged in; creates data |
| BR-SSO-02 8 hours of inactivity | Needs 8 real hours; the token lifetime is asserted instead |
| BR-SSO-02 token revoked on Sign Out | Would break the shared session |
| Validation "Popup / Redirect Guard" (mobile Safari / Chrome popups) | Only the redirect flow exists (no popup); mobile-safari / chrome real-device behaviour is not testable here |
| Scenario 5 on a real phone | Viewport emulation only (360, 375, 768, 1920) |
| MFA, Conditional Access, unassigned-licence error ("Error & Exception Handling") | Microsoft-side, needs special accounts |

## Existing tests reviewed
- `IUN3224-login.spec.ts`: both tests fit the real app (sign-in screen text, Microsoft login, anonymous guard) and are kept unchanged.
- `IUN3224-session.spec.ts`: the 3 generic tests used `userPage` (no student/employee credentials exist: they failed with "Missing credentials for role user"), a `user-menu` test id and a `/login` URL that the real app does not have. Rewritten on `adminPage` with the real UI (avatar menu, "Sign Out" dialog) and the real behaviour (sign-in screen at `/`).
- `profile.spec.ts`: placeholders for an assumed app (first / last name fields, country select, avatar upload test id, `userPage`). The admin portal has none of these (its only profile UI is the avatar menu). Both tests are skipped with a reason; `ProfilePage.ts` is left untouched.
- `HeaderComponent` / `SidebarComponent` (`banner` role, `user-menu` test id, `navigation` role) do not match the real DOM; the specs use `DashboardPage` locators instead (shared components not changed).

## Notes for maintainers
- `session` tests that remove tokens work on the test's own browser context; the stored admin session on disk is never modified.
- When the app is fixed, a `test.fail()` turns red ("expected to fail but passed"): delete the `test.fail` line and update this table.
- A slow QA backend can make the Unauthorized page appear after several seconds; those tests wait up to 20 s.

## Run summary
2026-11-20, chromium, `--workers=2`: `tests/e2e/auth` ran 3 times (1st: 35 + 64 passed; 2nd with the dashboard and profile folders: 3 flaky-timing failures in my own checks, then fixed and re-run green). About 13 of the passing tests are known deviations (`test.fail`), 4 are skipped with a reason (8 h idle, server-side revoke, JIT provisioning, real faculty/student logins) and the 2 profile placeholders are skipped. 0 failures at the end.
