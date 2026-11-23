# Test cases: Admin Dashboard and Compliance Overview

**Screen:** `/dashboard` (admin) on QA, `https://app-test.k.indiraiscm.com`
**Story:** IUN-3229 "Admin Dashboard & Compliance Overview" (status NEW; rules BR-DB-01 to BR-DB-06; scenarios 1-4; QA cases TC_DB_001 to TC_DB_007; validations: zero-division guard, drill-down, live data)
**Automation:** `tests/e2e/IUN3229-Dashboard/IUN3229-dashboard.spec.ts`, page object `src/pages/DashboardPage.ts` (extended with tiles, compliance card, at-risk cards, user menu; helpers `dashboardResponse()` / `DASHBOARD_API` for mocks)
**Last run:** 2026-11-20, chromium, QA. See "Run summary" at the end.

Run: `npx playwright test tests/e2e/dashboard --project=chromium --workers=2`
Nothing here changes data. The other modules are only read (their list APIs are captured: `/admin/policies`, `/admin/acknowledgement-requests`, `/admin/compliance-report`).

## How the screen works (observed on QA)
- One call: `GET /admin/dashboard` returns `totalUsers, totalStudents, totalEmployees, totalAdmins, policiesPublished, ackRequestsPublished, overallCompliance, atRiskPolicies[{policyId, policyTitle, deadline, totalAssigned, totalAcknowledged, compliancePercentage, status}]`.
- Screen: header "Admin Dashboard" + "Indira University Overview"; "User Statistics" (Total, Students, Employees, Admins); "Content" (Policies, Acknowledgement); "Overall Compliance" (big % + tier badge + bar); "At-Risk Policies" (one card per policy: title, "X/Y acknowledged", OVERDUE / AT_RISK pill, bar).
- Cards are all `data-testid="card"`; bars are `progress-bar-fill` elements drawn with `transform: scaleX(value)`.
- Tier colours: red `rgb(229,57,53)`, amber `rgb(255,198,5)`, green `rgb(46,125,50)`.
- Real QA figures today: 2519 users (1960 + 549 + 10), 10 policies, 3 ack requests, 0% compliance, 10 at-risk policies. The story's 416 / 303 / 103 are illustrative, so no number is hard-coded: the screen is compared with the captured API response.

## How the checks work
- **Real data:** screen vs captured `GET /admin/dashboard`.
- **Mocked API:** hand-built JSON (never `route.fetch`) for situations that cannot be created safely: tiers and boundaries, empty, errors, 6/406, 40 cards. They test how the screen renders what it is given.
- **Known deviation:** `test.fail()`, green in the run, turns red when the app is fixed.

## Coverage

| Story item | Test | Result |
|---|---|---|
| Scenario 1 / TC_DB_001 header, sections, six tiles | heading + subtitle, 4 section titles, six tile labels | Pass (header is two lines, not one "Admin Dashboard - Indira University Overview" string: accepted) |
| TC_DB_001 menu | side menu items incl. Dashboard first (+ the two older tests: admin menu, reload keeps session) | Pass |
| Dashboard Initialization (async load) | GET `/admin/dashboard` once, sometimes twice on a load (duplicate request, harmless, accepted up to 2) | Pass |
| Scenario 1 / TC_DB_002 live counts | four user tiles = API | Pass |
| BR-DB-01 headcount balance | API and screen: Total = Students + Employees + Admins; mismatch case shows given figures | Pass |
| TC_DB_003 Policies / Acknowledgement tiles = API fields | | Pass |
| BR-DB-02 Acknowledgement = completed sign-offs | compared with the Compliance report | **Deviation** (`test.fail`) |
| TC_DB_003 data changes then refresh | mocked sequence 5/7 then 6/8: reload shows the new values | Pass |
| TC_DB_003 coming back from another screen refreshes | | **Deviation** (`test.fail`) |
| Scenario 2 / TC_DB_004 tier badge, real data | badge matches the tier of the real score | Pass |
| TC_DB_004 Low: 0, 0.1, 49.9 red | mocked | Pass |
| TC_DB_004 Moderate: 50, 60, 74.9 amber | mocked | Pass |
| TC_DB_004 / BR-DB-05 Moderate up to 84.9 | 75, 80, 84.9 | **Deviation** (`test.fail`) |
| TC_DB_004 85 and 100 green | mocked | Pass |
| BR-DB-05 label "Compliant" | | **Deviation** (`test.fail`): "Healthy" |
| One decimal place on the score ("0.0%", "50.0%") | | **Deviation** (`test.fail`) |
| Value with a decimal shown as given (37.5) | | Pass |
| Compliance bar follows the score (49.9 -> 0.499) | | Pass |
| Macro compliance formula | score within 0.1 of completed / assigned computed from the Compliance report | Pass (weak: both are about 0.0x% on QA today) |
| Zero-division guard | policy with 0 assigned shows "0/0 acknowledged", no NaN / undefined / Infinity, bar finite | Pass |
| Zero-division guard: "0.0%" | | **Deviation** (`test.fail`, same as one decimal) |
| Scenario 3 / TC_DB_005 bar uses the exact percentage | 1.48 -> scale about 0.0148; 50 -> 0.5; real data bars match API | Pass |
| Scenario 3 / BR-DB-04 text "1.5%" on the card | | **Deviation** (`test.fail`): no percentage text on at-risk cards |
| TC_DB_006 / BR-DB-03 audience denominators | real: every denominator is an active cohort; mocked: campus-wide 2509 and employee-only 549 | Pass |
| At-risk cards = API (title, counter, pill, order) | real | Pass |
| Scenario 4 / TC_DB_007 pills | red OVERDUE, amber AT_RISK (mocked) | Pass |
| BR-DB-06 rule on real data | every listed policy: past deadline and < 100% = OVERDUE; otherwise due in under 7 days and < 80% = AT_RISK | Pass |
| BR-DB-06 sorting OVERDUE first, lowest completion first | | **Deviation** (`test.fail`) |
| Validation drill-down to /acknowledgements for the policy id | | **Deviation** (`test.fail`) |
| Empty at-risk feed, 40 cards with a 150-character title | no crash, no horizontal scroll | Pass |
| Loading state | spinner (progress bar) shows, no numbers yet, data replaces it | Pass |
| Empty state (all zero, `data: {}`) | zeros, no NaN / undefined, "Low" badge, no uncaught error | Pass |
| Error state (500, 403, network failure) | page does not crash; reload recovers | Pass |
| Error state shown to the user | | **Deviation** (`test.fail`, 3 tests) |
| Navigation: Policies / Acknowledgements / Compliance from the menu; tiles are static | | Pass |
| Consistency: Acknowledgement tile = Acknowledgements screen count; Policies + Acknowledgement tiles = POLICY / ACK_REQUEST rows of the Compliance report | | Pass |
| Consistency: every at-risk card = Compliance report row of that policy; every OVERDUE / AT_RISK policy of the report is in the feed | | Pass |
| Consistency: largest denominator = students + employees | | Pass |
| Consistency: Policies tile = Policies screen count | | **Deviation** (`test.fail`): 10 vs 8 |

## Where the app differs from the story

| # | Story expects | App does | Severity guess |
|---|---|---|---|
| 1 | API failure is reported (implied by "real-time" monitoring, error handling) | A 500, 403 or network failure (mocked) is swallowed: all tiles show 0, compliance "0%" with a red "Low" badge. Executives would read "0 users" as real | **High** |
| 2 | "Acknowledgement" card = total completed individual sign-offs across all policies (BR-DB-02) | Shows `ackRequestsPublished`, the number of ack requests (3 on QA); real sign-offs in the Compliance report add up to 17 | **High** (wrong KPI definition or wrong label) |
| 3 | Compliant (green) from 85.0%; Moderate 50.0-84.9% (BR-DB-05) | Green badge from 75.0% (75, 79.9, 80, 84.9 all green); label is "Healthy", not "Compliant" | **High** (wrong tier boundary), label Low |
| 4 | At-risk feed sorted OVERDUE first, lowest completion first (BR-DB-06) | Policy id order (QA: 0.2% listed before the 0% ones) | Medium |
| 5 | Clicking an at-risk card opens /acknowledgements filtered by policy id (Validations) | Cards are not clickable | Medium |
| 6 | Card text percentage rounded to 1 decimal, e.g. 1.5%, with the exact 1.48% only in the bar (BR-DB-04, Scenario 3) | At-risk cards show no percentage text; the API already rounds to 1 decimal, so the exact value never reaches the screen | Medium |
| 7 | Score formatted to 1 decimal ("0.0%", zero-division default "0.0%") | Whole numbers print as "0%", "50%", "100%" | Low |
| 8 | Dashboard counts match the other modules | Dashboard (and Compliance report) count 10 published policies, the Policies screen lists 8 (ids 2 and 10 missing). Needs a business decision on which one is right (archived policies?) | Medium (QA data, same family as the archived-policy defect in compliance.md) |
| 9 | Live data on every visit ("Live Database Verification") | After visiting another screen, returning with the menu shows the old figures (no new request); only a reload refreshes. There is no refresh button | Low / Medium |
| 10 | Overall compliance never above 100 | A mocked 100.4 is drawn as "100.4%" with the bar past full (same pattern as compliance.md #4) | Low (backend value) |
| 11 | Header 'Admin Dashboard - Indira University Overview' | Two lines ("Admin Dashboard" / "Indira University Overview") | Trivial |
| 12 | At-risk list is OVERDUE and AT_RISK policies | Acknowledgement requests (3, all overdue on the Compliance report) never appear in the feed, only policies | Info: confirm intended |
| 13 | An empty feed | No "no at-risk policies" message and the "At-Risk Policies" heading disappears (story is silent) | Info |

## Not automated

| Case | Why |
|---|---|
| TC_DB_003 "have a user sign a policy, refresh, KPI +1" | Needs a student/employee account to sign and acknowledgements cannot be undone. Covered by the mocked refresh sequence |
| TC_DB_002 comparison with "live DB user counts" | No database access; the API is the source. Total = sum of cohorts is checked on the API values |
| TC_DB_004 real 50-84.9% and >= 85% on QA data | QA is at 0%; tiers are covered with mocked values |
| TC_DB_005 real 6/406 policy | Not in QA data (6/2509 exists, 0.2%). Covered mocked: bar 1.48, text 1.5% |
| TC_DB_006 exact denominators against the database (active users per cohort) | The API's cohorts (students + employees = 2509, employees = 549) are cross-checked with the dashboard tiles, not with the database |
| TC_DB_007 with a policy due in under 7 days and < 80% on real data | Only one such policy exists (an AUTOTEST one, deadline today); the rule is checked over whatever real data exists plus mocked pills |
| BR-DB-06 exact boundary dates computed by the backend (today, +6 / +7 days, 79 / 80%) | The status is computed by the backend, the screen only renders it; needs policies with chosen deadlines (writes data) |
| Student / auditor view of the dashboard, access control of `/admin/dashboard` | No such accounts; see login-sso.md |
| Mobile layout of the dashboard | Out of scope of the story (admin portal) |

## Notes for maintainers
- All figures come from the captured API response; QA numbers change with other test runs (the AUTOTEST policy appears and disappears).
- The cross-module tests navigate to `/compliance`, `/policies` and `/acknowledgements` after reading the dashboard; they only read.
- The bar fill is a `scaleX` transform of a full-width element (an animated value ends within about 0.0001 of the exact value), so bar checks use small tolerances.
- When the app is fixed a `test.fail()` turns red ("expected to fail but passed"): remove the `test.fail` line and update the table.

## Run summary
2026-11-20, chromium, `--workers=2`: `tests/e2e/dashboard` ran 3 times; last full run 128 passed with 4 timing failures in my own checks, which were fixed (body read inside the listener, logo decode wait, 1-2 duplicate dashboard calls tolerated) and the affected tests re-run green. About 14 passing tests are known deviations (`test.fail`). 0 skipped, 0 failed at the end.
