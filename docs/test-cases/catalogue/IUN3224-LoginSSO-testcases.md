# IUN-3224 Login Page UI & Microsoft SSO Integration: test case catalogue

| Item | Value |
|---|---|
| Story | IUN-3224 "Login Page UI & Microsoft SSO Integration" (Jira status: QA FAILED) |
| Module | Login / Microsoft SSO (sign-in screen "Campus Connect", session, sign out, role landing) |
| QA environment | `https://app-test.k.indiraiscm.com` (chromium) |
| Spec files | `tests/e2e/IUN3224-LoginSSO/IUN3224-login.spec.ts` (2 tests), `tests/e2e/IUN3224-LoginSSO/IUN3224-login-sso.spec.ts` (39 tests), `tests/e2e/IUN3224-LoginSSO/IUN3224-session.spec.ts` (28 tests) |
| Summary doc | `docs/test-cases/login-sso.md` |
| Catalogue date | 2026-11-20 |
| Last run | 2026-11-20: all passed (known defects are marked `test.fail`, so they pass while the defect exists and turn red when it is fixed) |
| Total tests | 69 (2 + 39 + 28) |

**Test case IDs.** The ID already written in the test title is used (TC_LOGIN_00x = QA case of the story, BR-SSO-0x = business rule). Several tests share one ID, so every row also carries its row number `(row n)`. Tests whose title has no ID got `LOGIN-nnn` in file order (login, login-sso, session).

**Type.** Positive = expected behaviour works. Negative = invalid / hostile input is handled. Boundary = edge of a range. Known defect = `test.fail`: the app deviates from the story and the test records the gap. Gated = real write, not run (none in this story). Mocked API = the data situation is simulated by answering an API call locally.

**Result.** `Pass` = passed in the last full run. `Known defect (expected fail)` = `test.fail`, green while the defect exists. `Skipped (<reason>)` = skipped in code with a reason.

**Preconditions common to all tests.** "Anonymous" tests start in a fresh browser context with no session. "Admin" tests use the stored ADMIN session of the framework setup project (the only account that exists for QA). No credentials are typed except by the single real-login smoke test. Requests to `login.microsoftonline.com` are answered with a stub page (the test only checks where the browser is sent). Fake Microsoft tokens are answered locally by a mocked `POST /auth/sso-login`, so nothing fake reaches the real auth server. Student / faculty behaviour is SIMULATED by mocking `GET /auth/me`; only ADMIN logins exist. Tokens are never printed.

## Story scenarios and business rules covered

| Story scenario / rule | Test case IDs (rows) |
|---|---|
| Scenario 1 / TC_LOGIN_001 login screen content, logo, layout, `/login`, button style | rows 3-9 |
| Scenario 2 / TC_LOGIN_002 redirect to Microsoft, authorize URL, tenant | rows 10-13, 17 |
| Scenario 2 / TC_LOGIN_003 authorization code flow, token exchange, tokens kept, `/auth/me` | rows 14, 21, 46-48 |
| Validation "State & PKCE" | rows 15-16 |
| Scenario 3 / TC_LOGIN_004 rejected (personal / external) accounts, "Back to Login", tenant verification | rows 22-28 |
| Scenario 4 / TC_LOGIN_005 cancel / back from Microsoft | rows 18-20 |
| Protected-route guard (Login Route Access) | rows 2, 29-35, 56 |
| Scenario 5 / TC_LOGIN_007 responsive layout | rows 36-41 |
| TC_LOGIN_008 / BR-SSO-05 session persistence | rows 42-44 |
| BR-SSO-01 institutional e-mail domain | row 46 (positive side only) |
| BR-SSO-02 token storage, lifetime, expiry, sign out | rows 49-51 (storage, lifetime), 52-57 (expiry), 59-62 (sign out) |
| TC_LOGIN_003 avatar menu (name, role, e-mail, Logout) | row 58 |
| BR-SSO-03 first-time provisioning | row 68 (skipped) |
| BR-SSO-04 role-based landing | rows 45, 63-67 |
| TC_LOGIN_006 role landing (student / faculty) | rows 63-67, 69 (skipped) |
| Smoke / existing tests | rows 1-2 |

Row numbers are the position in the single table below (1 to 69), grouped by spec file and screen area.

## Test cases

### A. IUN3224-login.spec.ts (existing, real login)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| LOGIN-001<br>(row 1) | Admin signs in with Microsoft and lands on the dashboard (@smoke) | Positive | Anonymous browser; the ADMIN test account is signed in through the real Microsoft page (credentials come from the framework config) | 1. Open the app root.<br>2. Click "Sign in with Microsoft".<br>3. Complete the Microsoft sign-in with the admin account.<br>4. Wait for the app. | The browser ends on `/dashboard` and the "Admin Dashboard" heading is visible | Pass | - |
| LOGIN-002<br>(row 2) | A visitor without a session only sees the sign-in option (@regression) | Positive | Anonymous browser | 1. Open the app root; check the sign-in screen shows.<br>2. Open `/dashboard` directly.<br>3. Check the sign-in screen shows again. | The sign-in screen is shown on both URLs; the protected route is not rendered for an anonymous user | Pass | - |

### B. IUN3224-login-sso.spec.ts: login screen content (Scenario 1)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_LOGIN_001<br>(row 3) | Sign-in screen shows brand, headline, scope text, Microsoft button and helper text | Positive | Anonymous | 1. Open the app root.<br>2. Check "Campus Connect", the headline, the scope text, the button and the helper text are visible.<br>3. Read the button text (icon glyphs removed).<br>4. Measure the layout. | Button text is exactly "Sign in with Microsoft"; the helper text sits below the button | Pass | - |
| TC_LOGIN_001<br>(row 4) | The dual SCES / INDIRA UNIVERSITY logo image loads and keeps its aspect ratio | Positive | Anonymous | 1. Open the app root.<br>2. Measure the first image (decoded?, rendered size, natural size).<br>3. Read its `src`. | Image is decoded, `src` contains `iu-sces-combined`, rendered ratio is within 2% of the natural ratio | Pass | - |
| TC_LOGIN_001<br>(row 5) | The brand block sits on a gradient canvas, above the sign-in card | Positive | Anonymous | 1. Open the app root.<br>2. Check a gradient background sits behind the logo.<br>3. Compare vertical positions of logo, headline and "Campus Connect". | Gradient present; the logo is above the headline; "Campus Connect" is below the logo | Pass | - |
| TC_LOGIN_001<br>(row 6) | /login renders the same sign-in screen (story: "root or /login") | Positive | Anonymous | 1. Open `/login`.<br>2. Check the sign-in screen, "Campus Connect" and the headline are visible. | The same sign-in screen is rendered | Pass | - |
| TC_LOGIN_001<br>(row 7) | /login keeps its own URL (story: route is /login) | Known defect | Anonymous | 1. Open `/login`.<br>2. Check the sign-in screen shows.<br>3. Read the URL path. | Expected: the path stays `/login`.<br>Actual (defect): there is no /login route; the app rewrites every anonymous URL to "/" | Known defect (expected fail) | none raised (low; story route vs rewrite to "/") |
| TC_LOGIN_001<br>(row 8) | Button styling: white bold label, navy #145684 background, soft shadow, Microsoft icon glyph | Positive | Anonymous | 1. Open the app root.<br>2. Read the computed style of the button. | Label colour is white (255,255,255); font weight >= 600; shadow is not "none"; an icon glyph precedes the label; background is within 3 units per channel of #145684 (observed #155685) | Pass | - |
| TC_LOGIN_001<br>(row 9) | Button background is exactly #145684 | Known defect | Anonymous | 1. Open the app root.<br>2. Read the button background colour. | Expected: rgb(20, 86, 132) = #145684.<br>Actual (defect, trivial): the button is #155685 (rgb 21,86,133) | Known defect (expected fail) | IUN-3363 |

### C. IUN3224-login-sso.spec.ts: redirect to Microsoft (Scenario 2)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_LOGIN_002<br>(row 10) | Clicking the button redirects to the login.microsoftonline.com authorize endpoint | Positive | Anonymous; Microsoft requests answered with a stub page (mocked, nothing leaves the browser) | 1. Open the app root.<br>2. Click "Sign in with Microsoft".<br>3. Record the first URL sent to Microsoft. | Host is `login.microsoftonline.com`, path ends with `/oauth2/v2.0/authorize`; the stub page is shown | Pass | - |
| TC_LOGIN_002<br>(row 11) | The authorize request carries client_id, redirect_uri (the app) and an openid scope | Positive | Anonymous; Microsoft stubbed | 1. Start sign-in and read the authorize URL.<br>2. Check its query parameters. | `client_id` is a GUID; `redirect_uri` origin equals the app origin; `scope` contains `openid`; `response_type` is present | Pass | - |
| TC_LOGIN_002<br>(row 12) | The button is a real link whose href is the same authorize URL | Positive | Anonymous | 1. Open the app root.<br>2. Read the href of the button. | Href host is `login.microsoftonline.com` and has a `client_id` | Pass | - |
| TC_LOGIN_002<br>(row 13) | Authorize URL uses the Indira University tenant id (story: "using the tenant ID") | Known defect | Anonymous; Microsoft stubbed | 1. Start sign-in.<br>2. Read the first path segment of the authorize URL. | Expected: a tenant GUID as first path segment.<br>Actual (defect): the multi-tenant "organizations" endpoint is used, not the university tenant id | Known defect (expected fail) | IUN-3363 |
| TC_LOGIN_003<br>(row 14) | Authorization code flow: response_type=code and callback route /auth/callback | Known defect | Anonymous; Microsoft stubbed | 1. Start sign-in.<br>2. Read `response_type` and the path of `redirect_uri`. | Expected: `response_type=code` and redirect path `/auth/callback`.<br>Actual (defect): implicit flow (`response_type=token`), redirect_uri is the app root, no /auth/callback route | Known defect (expected fail) | IUN-3348 |
| LOGIN-003<br>(row 15) | Validation "State & PKCE": authorize request has a state and a S256 code_challenge | Known defect | Anonymous; Microsoft stubbed | 1. Start sign-in.<br>2. Read `state`, `code_challenge`, `code_challenge_method`. | Expected: state present, code_challenge present, method `S256`.<br>Actual (defect, security): no state, no code_challenge / method, no nonce | Known defect (expected fail) | IUN-3348 |
| LOGIN-004<br>(row 16) | Validation "State & PKCE": the state is unique on every attempt | Known defect | Anonymous; Microsoft stubbed | 1. Start sign-in and record the URL.<br>2. Go back, click the button again.<br>3. Compare the two `state` values. | Expected: both states present and different.<br>Actual (defect, security): the href is static, there is no state at all | Known defect (expected fail) | IUN-3348 |
| TC_LOGIN_002<br>(row 17) | No password or token is placed in the authorize URL | Negative | Anonymous; Microsoft stubbed | 1. Start sign-in.<br>2. Check for `password`, `access_token`, `id_token`, `login_hint` parameters. | None of these parameters is present | Pass | - |

### D. IUN3224-login-sso.spec.ts: cancel, rejected accounts, failed callback (Scenarios 3 and 4)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_LOGIN_005<br>(row 18) | Coming back from Microsoft (cancel / back) shows the intact sign-in screen | Positive | Anonymous; Microsoft stubbed | 1. Start sign-in (browser goes to the Microsoft stub).<br>2. Press browser Back.<br>3. Check the sign-in screen, no error text, localStorage keys.<br>4. Click the button again. | Sign-in screen and headline visible, no error text, localStorage is empty, the button works again (goes to Microsoft) | Pass | - |
| TC_LOGIN_005<br>(row 19) | Microsoft returns "access_denied" in the query string: sign-in screen stays usable, nothing stored | Negative | Anonymous; URL `/?error=access_denied&error_description=...` (x2 variants: rows 19 and 20) | 1. Open the URL.<br>2. Check the screen and uncaught script errors.<br>3. Read localStorage keys. | Sign-in screen and headline shown; no uncaught page errors; nothing stored | Pass | - |
| TC_LOGIN_005<br>(row 20) | Microsoft returns "access_denied" in the URL fragment: sign-in screen stays usable, nothing stored | Negative | Anonymous; URL `/#error=access_denied&error_description=...` | Same steps as row 19 | Same as row 19 | Pass | - |
| TC_LOGIN_003<br>(row 21) | The Microsoft token in the URL fragment is exchanged with POST /auth/sso-login (Authorization header sent) | Mocked API | Anonymous; `POST /auth/sso-login` answered locally with 401 "invalid token"; fake token in the URL fragment | 1. Open `/#access_token=<fake>...`.<br>2. Wait for the request to `/auth/sso-login`. | The request is a POST and has an `Authorization: Bearer ...` header | Pass | - |
| TC_LOGIN_004<br>(row 22) | Backend rejects a personal account: "Unauthorized" screen shows the message (mocked 403) | Mocked API | Anonymous; `/auth/sso-login` mocked 403 with message "Please sign in with your official university Microsoft account." | 1. Open the URL with a fake `#access_token`.<br>2. Wait for the screen (up to 20 s).<br>3. Read localStorage keys. | "Unauthorized" and the official-account message are visible; nothing is stored | Pass | - |
| LOGIN-005<br>(row 23) | Validation "Tenant verification": external tenant message is shown (mocked 400) | Mocked API | Anonymous; `/auth/sso-login` mocked 400 "Access restricted to Indira University accounts only" | 1. Open the URL with a fake `#access_token`.<br>2. Wait for the message. | The message "Access restricted to Indira University accounts only" is visible | Pass | - |
| TC_LOGIN_004<br>(row 24) | The rejection is a full "Unauthorized" page, not an inline error toast / alert on the sign-in screen | Known defect | Anonymous; `/auth/sso-login` mocked 403 | 1. Open the URL with a fake `#access_token`.<br>2. Check the message and the "Sign in with Microsoft" button are both visible. | Expected: inline error alert / toast on the sign-in screen (button still visible).<br>Actual (defect, low): a separate "Unauthorized" page with a "Back to Login" button | Known defect (expected fail) | IUN-3360 |
| TC_LOGIN_004<br>(row 25) | "Back to Login" on the Unauthorized page returns to the sign-in screen | Mocked API | Anonymous; `/auth/sso-login` mocked 403 | 1. Open the URL with a fake `#access_token`.<br>2. Click "Back to Login".<br>3. Check the sign-in screen. | Sign-in screen is shown and "Unauthorized" is gone | Pass | - |
| LOGIN-006<br>(row 26) | A server error (500) during the token exchange: the user gets a way back and nothing is stored | Mocked API | Anonymous; `/auth/sso-login` mocked 500 "Internal error, please try again" | 1. Open the URL with a fake `#access_token`.<br>2. Check the message, localStorage.<br>3. Click "Back to Login". | Message visible; nothing stored; the sign-in screen is shown after "Back to Login" | Pass | - |
| LOGIN-007<br>(row 27) | A server error (500) during the token exchange is not presented as "Unauthorized" | Known defect | Anonymous; `/auth/sso-login` mocked 500 | 1. Open the URL with a fake `#access_token`.<br>2. Check the message and the "Unauthorized" heading. | Expected: the 500 message is shown and no "Unauthorized" heading.<br>Actual (defect, low, mocked): every failure (400, 401, 403, 500) is shown under "Unauthorized" | Known defect (expected fail) | IUN-3360 |
| LOGIN-008<br>(row 28) | A forged access_token in the URL fragment does not sign anybody in | Negative | Anonymous; `/auth/sso-login` mocked 401 "invalid token" | 1. Open the URL with a fake `#access_token=not.a.real.token`.<br>2. Check message, localStorage, "Admin Dashboard", admin API calls. | "invalid token" shown; nothing stored; no "Admin Dashboard"; no request to `/admin/` APIs | Pass | - |

### E. IUN3224-login-sso.spec.ts: protected routes without a session

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_LOGIN_001<br>(row 29) | Anonymous visit to /dashboard shows the sign-in screen and calls no admin API | Negative | Anonymous (one of 6 routes: rows 29-34 use `/dashboard`, `/policies`, `/acknowledgements`, `/compliance`, `/master-data`, `/some/unknown/route`) | 1. Open the route.<br>2. Check the sign-in screen, "Admin Dashboard" absent, admin API calls. | Sign-in screen shown; no "Admin Dashboard"; no `/admin/` request | Pass | - |
| TC_LOGIN_001<br>(row 30) | Anonymous visit to /policies shows the sign-in screen and calls no admin API | Negative | Anonymous | Same steps as row 29 | Same as row 29 | Pass | - |
| TC_LOGIN_001<br>(row 31) | Anonymous visit to /acknowledgements shows the sign-in screen and calls no admin API | Negative | Anonymous | Same steps as row 29 | Same as row 29 | Pass | - |
| TC_LOGIN_001<br>(row 32) | Anonymous visit to /compliance shows the sign-in screen and calls no admin API | Negative | Anonymous | Same steps as row 29 | Same as row 29 | Pass | - |
| TC_LOGIN_001<br>(row 33) | Anonymous visit to /master-data shows the sign-in screen and calls no admin API | Negative | Anonymous | Same steps as row 29 | Same as row 29 | Pass | - |
| TC_LOGIN_001<br>(row 34) | Anonymous visit to /some/unknown/route shows the sign-in screen and calls no admin API | Negative | Anonymous | Same steps as row 29 | Same as row 29 | Pass | - |
| LOGIN-009<br>(row 35) | Anonymous visitor: after sign-in the app does not return to the deep link (story does not require it) | Positive | Anonymous | 1. Open `/policies`.<br>2. Check the sign-in screen.<br>3. Read the URL path. | Sign-in screen shown and the path is "/" (the deep link is not preserved; documents the behaviour) | Pass | - |

### F. IUN3224-login-sso.spec.ts: responsive layout (Scenario 5 / TC_LOGIN_007)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_LOGIN_007<br>(row 36) | mobile 360 (360x740): no horizontal scroll, logo inside the viewport and undistorted, button is full-width tap target | Boundary | Anonymous; viewport 360x740 (rows 36-39 differ only in size: mobile 375 = 375x812, tablet 768 = 768x1024, desktop 1920 = 1920x1080) | 1. Set the viewport and open the app root.<br>2. Wait for the logo to decode.<br>3. Measure the layout. | No horizontal overflow; logo inside the viewport; aspect ratio within 5%; button height >= 44; button width >= min(viewport - 80, 250); helper text visible | Pass | - |
| TC_LOGIN_007<br>(row 37) | mobile 375 (375x812): same checks as row 36 | Boundary | Anonymous; viewport 375x812 | Same steps as row 36 | Same as row 36 | Pass | - |
| TC_LOGIN_007<br>(row 38) | tablet 768 (768x1024): same checks as row 36 | Boundary | Anonymous; viewport 768x1024 | Same steps as row 36 | Same as row 36 | Pass | - |
| TC_LOGIN_007<br>(row 39) | desktop 1920 (1920x1080): same checks as row 36 | Boundary | Anonymous; viewport 1920x1080 | Same steps as row 36 | Same as row 36 | Pass | - |
| LOGIN-010<br>(row 40) | Scenario 5: cards stay centred on desktop and mobile | Positive | Anonymous; widths 360 and 1920 | 1. For each width open the app root.<br>2. Compute the centre of the headline. | The headline centre is within 3 px of half the viewport width at both widths | Pass | - |
| LOGIN-011<br>(row 41) | Scenario 5: the card column is not stretched on a 1920 px desktop | Positive | Anonymous; viewport 1920x1080 | 1. Open the app root.<br>2. Measure the button width. | Button is narrower than 600 px | Pass | - |


### G. IUN3224-session.spec.ts: session persistence (TC_LOGIN_008, BR-SSO-05, BR-SSO-04)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_LOGIN_008<br>(row 42) | Reloading /dashboard keeps the user signed in | Positive | Admin session | 1. Open `/dashboard`.<br>2. Reload.<br>3. Check the dashboard and that "Sign in with Microsoft" is absent. | Dashboard still loaded; no sign-in button | Pass | - |
| TC_LOGIN_008<br>(row 43) | Reloading a deep route (/policies) keeps the user on that route | Positive | Admin session | 1. Open `/policies`, check "Policies".<br>2. Reload.<br>3. Check the URL and the sign-in button. | "Policies" visible after reload; path stays `/policies`; no sign-in button | Pass | - |
| BR-SSO-05<br>(row 44) | A second tab of the same browser is signed in as well (localStorage session) | Positive | Admin session | 1. Open `/dashboard`.<br>2. Open a second tab in the same context on `/dashboard`.<br>3. Check "Admin Dashboard". | The second tab shows the admin dashboard without signing in | Pass | - |
| BR-SSO-04<br>(row 45) | A signed-in admin opening the app root is sent to /dashboard | Positive | Admin session | 1. Open `/`.<br>2. Check the URL and "Admin Dashboard". | URL ends with `/dashboard`; "Admin Dashboard" visible | Pass | - |
| TC_LOGIN_003<br>(row 46) | After sign-in the user hydrates from the API: GET /auth/me returns the ADMIN profile | Positive | Admin session (real API) | 1. Wait for the `/auth/me` response while opening `/dashboard`.<br>2. Read role and official e-mail. | Role is `ADMIN`; official e-mail ends with `@indiraedu.com` or `@indiraiscm.com` (BR-SSO-01, positive side only) | Pass | - |

### H. IUN3224-session.spec.ts: token storage and lifetime (BR-SSO-02)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_LOGIN_003<br>(row 47) | After sign-in the app keeps sso_token, internal_token and user_profile; both tokens are JWTs | Positive | Admin session; tokens only checked for presence and shape | 1. Open `/dashboard`.<br>2. List localStorage keys.<br>3. Count the dot-separated parts of both tokens. | The three keys exist; both tokens have 3 parts (JWT shape) | Pass | - |
| TC_LOGIN_003<br>(row 48) | The internal token carries the ADMIN role and an institutional e-mail claim | Positive | Admin session | 1. Open `/dashboard`.<br>2. Decode the claims of `internal_token` (names / role / shape only). | Role is `ADMIN`; an e-mail claim is present; `exp` is in the future | Pass | - |
| BR-SSO-02<br>(row 49) | Tokens never appear in the page URL or in cookies readable by scripts | Negative | Admin session | 1. Open `/dashboard`.<br>2. Check the URL and `document.cookie`. | URL has no token / jwt / `eyJ`; script-readable cookies hold no JWT | Pass | - |
| BR-SSO-02<br>(row 50) | Session is held in secure HTTP-only cookies (Scenario 2) | Known defect | Admin session | 1. Open `/dashboard`.<br>2. List the browser cookies of the app host.<br>3. Look for a cookie that is HttpOnly and Secure. | Expected: at least one HttpOnly + Secure session cookie.<br>Actual (defect): tokens live in localStorage (readable by any script, XSS-exposed); the app sets no HTTP-only cookie | Known defect (expected fail) | IUN-3350 |
| BR-SSO-02<br>(row 51) | Session lifetime: the internal JWT is valid for 8 hours | Known defect | Admin session | 1. Open `/dashboard`.<br>2. Decode `exp` and `iat` of `internal_token`. | Expected: exp - iat = 28800 s (8 h).<br>Actual (defect): the token lives 30 minutes (1800 s); the user is signed out after 30 min | Known defect (expected fail) | IUN-3345 |

### I. IUN3224-session.spec.ts: session expiry

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| BR-SSO-02<br>(row 52) | Losing "internal_token" from storage sends the user back to the sign-in screen on reload | Negative | Admin session in its own browser context (the stored session file is not touched); rows 52-54 differ by the removed key | 1. Open `/dashboard`, check "Admin Dashboard".<br>2. Remove the key from localStorage.<br>3. Reload.<br>4. Check the sign-in screen. | Sign-in screen shown; "Admin Dashboard" absent | Pass | - |
| BR-SSO-02<br>(row 53) | Losing "sso_token" from storage sends the user back to the sign-in screen on reload | Negative | As row 52, key `sso_token` | Same steps as row 52 | Same as row 52 | Pass | - |
| BR-SSO-02<br>(row 54) | Losing "user_profile" from storage sends the user back to the sign-in screen on reload | Negative | As row 52, key `user_profile` | Same steps as row 52 | Same as row 52 | Pass | - |
| BR-SSO-02<br>(row 55) | A 401 from the API while the user works ends the session: sign-in screen, storage cleared | Mocked API | Admin session; all non-auth API calls answered with 401 "Token expired" after the dashboard has loaded | 1. Open `/dashboard`.<br>2. Install the 401 mock.<br>3. Click "Policies" in the menu.<br>4. Check the screen and localStorage. | Sign-in screen shown; localStorage empty; "Admin Dashboard" absent | Pass | - |
| BR-SSO-02<br>(row 56) | After the session was discarded, a protected deep link does not render admin data | Negative | Admin session, then localStorage cleared | 1. Open `/dashboard`, clear localStorage.<br>2. Open `/compliance`.<br>3. Check the screen and admin API calls. | Sign-in screen shown; no `/admin/` request | Pass | - |
| BR-SSO-02<br>(row 57) | The session expires after 8 hours of inactivity (idle timer) | Positive | Admin session | Not executed | Session ends after 8 h of inactivity | Skipped (needs 8 hours of real time; the server decides expiry; token lifetime is checked in row 51) | - |

### J. IUN3224-session.spec.ts: sign out

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_LOGIN_003<br>(row 58) | The avatar menu shows name, role badge, e-mail and a Logout action | Positive | Admin session; profile name / e-mail read from the stored `user_profile` | 1. Open `/dashboard`.<br>2. Open the avatar menu.<br>3. Check name, "Admin", e-mail and the Logout item. | All four are visible | Pass | - |
| BR-SSO-02<br>(row 59) | Logout asks for confirmation; Cancel keeps the session | Positive | Admin session; Microsoft aborted, API writes answered locally | 1. Open `/dashboard`.<br>2. Open the Sign Out dialog; check "Are you sure you want to sign out?".<br>3. Click Cancel. | Dialog closes; URL still `/dashboard`; `internal_token` still in localStorage | Pass | - |
| BR-SSO-02<br>(row 60) | Confirming Sign Out clears the stored tokens and shows the sign-in screen | Positive | Admin session; writes are recorded and answered locally; Microsoft aborted | 1. Open `/dashboard`.<br>2. Open the Sign Out dialog and confirm.<br>3. Check the screen, localStorage keys and recorded writes. | Sign-in screen shown; `sso_token`, `internal_token`, `user_profile` removed; no write request was sent (sign out is client side only: see IUN-3357) | Pass | IUN-3357 (related: documents that no request is sent) |
| BR-SSO-02<br>(row 61) | After Sign Out a protected URL is not served and the back button does not restore the app | Negative | Admin session; Microsoft aborted, writes answered locally | 1. Sign out as in row 60.<br>2. Open `/dashboard`; check the sign-in screen.<br>3. Press Back. | Sign-in screen on `/dashboard`; after Back "Admin Dashboard" is not shown | Pass | - |
| BR-SSO-02<br>(row 62) | Sign Out revokes the token on the server | Positive | Admin session | Not executed | Expected: the token is revoked server side on Sign Out.<br>Actual (defect, to confirm): Sign Out sends no request, the old token stays valid until it expires | Skipped (the stored admin session is shared by every test run; revoking it would break them) | IUN-3357 |

### K. IUN3224-session.spec.ts: role-based landing (TC_LOGIN_006, BR-SSO-03, BR-SSO-04)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_LOGIN_006<br>(row 63) | ADMIN lands on /dashboard with the admin dashboard | Positive | Admin session (real) | 1. Open `/`.<br>2. Check the URL and "Admin Dashboard". | URL ends `/dashboard`; "Admin Dashboard" visible | Pass | - |
| TC_LOGIN_006<br>(row 64) | (mocked /auth/me = STUDENT) the admin dashboard is not shown to a student | Mocked API | Admin session with `GET /auth/me` answered as a STUDENT profile | 1. Open `/`.<br>2. Check "Upcoming Schedule", "Admin Dashboard" and "Bulk Upload". | "Upcoming Schedule" (student home) visible; no "Admin Dashboard"; no "Bulk Upload" menu item | Pass | - |
| TC_LOGIN_006<br>(row 65) | (mocked /auth/me = STUDENT) student lands on /feed | Known defect | Admin session with `/auth/me` mocked as STUDENT | 1. Open `/`.<br>2. Read the URL. | Expected (BR-SSO-04): URL ends `/feed`.<br>Actual (defect, mocked profile): the student stays on `/dashboard` where a student home is rendered | Known defect (expected fail) | IUN-3352 |
| TC_LOGIN_006<br>(row 66) | (mocked /auth/me = faculty) faculty lands on /timetable | Known defect | Admin session with `/auth/me` mocked as EMPLOYEE (teaching) | 1. Open `/`.<br>2. Read the URL. | Expected (BR-SSO-04): URL ends `/timetable`.<br>Actual (defect, mocked profile): an employee stays on `/dashboard` (feed is rendered there) | Known defect (expected fail) | IUN-3352 |
| LOGIN-012<br>(row 67) | Unauthorized role: a non-admin profile must not call the admin dashboard API | Known defect | Admin session with `/auth/me` mocked as STUDENT | 1. Record requests to `/admin/`.<br>2. Open `/dashboard`.<br>3. Check "Upcoming Schedule". | Expected: no `/admin/` request for a student profile.<br>Actual (defect, mocked profile): `GET /admin/dashboard` is still requested; the server must refuse it (not verifiable here) | Known defect (expected fail) | IUN-3354 |
| BR-SSO-03<br>(row 68) | First-time login auto-provisioning of the local profile | Positive | Needs a Microsoft account in the registry that never logged in | Not executed | A local profile is created at first login | Skipped (no such account exists and tests may not enter credentials) | - |
| TC_LOGIN_006<br>(row 69) | Faculty / student real logins | Positive | Needs real student / faculty accounts | Not executed | Faculty land on /timetable, students on /feed | Skipped (only an ADMIN login exists for QA; landing is simulated in rows 64-66) | - |

Row count: A 2 + B 7 + C 8 + D 11 + E 7 + F 6 + G 5 + H 5 + I 6 + J 5 + K 7 = 69 rows.

## Not automated

| Case | Reason |
|---|---|
| Scenario 2 / TC_LOGIN_003 full login with a valid @indiraedu.com account + MFA | The real login is done by the framework `setup` project and one smoke test (row 1); extra logins would burn the shared 30-minute session |
| TC_LOGIN_004 real login with a personal @outlook / @gmail account | No such account; rejection is covered with a mocked `/auth/sso-login` answer, so the real backend wording and the BR-SSO-01 negative side are untested |
| TC_LOGIN_005 real "Cancel" on the Microsoft page | The Microsoft page is not driven; simulated with browser Back and `error=access_denied` in the URL |
| TC_LOGIN_006 real faculty / student logins | Only an ADMIN login exists; landing for other roles is simulated by mocking `GET /auth/me` |
| BR-SSO-03 just-in-time provisioning | Needs a registry user who never logged in; creates data |
| BR-SSO-02 8 hours of inactivity | Needs 8 real hours; the token lifetime is asserted instead (row 51) |
| BR-SSO-02 token revoked on Sign Out | Would break the shared session |
| Validation "Popup / Redirect Guard" (mobile Safari / Chrome popups) | Only the redirect flow exists (no popup); real-device behaviour is not testable here |
| Scenario 5 on a real phone | Viewport emulation only (360, 375, 768, 1920) |
| MFA, Conditional Access, unassigned-licence error | Microsoft-side, needs special accounts |

Note: `tests/e2e/profile/profile.spec.ts` (2 skipped placeholders) is not part of this story and is not listed here.

## Counts

69 tests: 52 Pass, 13 Known defect (expected fail), 0 Gated, 4 Skipped (rows 57, 62, 68, 69). Rows with a bug key: 14 (12 known-defect rows, skipped row 62, and related row 60). Known defect with no bug raised: row 7 (/login route).

## Bugs raised for this story

| Bug key | Title | Priority | Covering test rows |
|---|---|---|---|
| IUN-3345 | Session lasts 30 minutes instead of 8 hours (BR-SSO-02) | High | 51 (BR-SSO-02 lifetime); related skipped row 57 |
| IUN-3348 | Implicit flow: no PKCE / state / nonce, no /auth/callback route | High | 14, 15, 16 |
| IUN-3350 | Tokens kept in localStorage instead of HTTP-only cookies | High | 50 |
| IUN-3352 | Role redirect: student not sent to /feed, faculty not sent to /timetable (BR-SSO-04, found with mocked profile) | Needs confirmation | 65, 66 |
| IUN-3354 | Student profile still calls GET /admin/dashboard (found with mocked profile) | Needs confirmation | 67 |
| IUN-3357 | Sign Out sends no request (token not revoked on the server) | Needs confirmation | 62 (skipped); related 60 |
| IUN-3360 | A rejected login shows a separate "Unauthorized" page instead of an inline error | Low | 24, 27 |
| IUN-3363 | Visual differences: authorize URL tenant, button colour, serif button label | Low | 13, 9 (the serif label has no automated test) |
