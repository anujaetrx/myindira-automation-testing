# IUN-3229 Admin Dashboard & Compliance Overview: test case catalogue

| Item | Value |
|---|---|
| Story | IUN-3229 "Admin Dashboard & Compliance Overview" |
| Module | Admin Dashboard (`/dashboard`: KPI tiles, Overall Compliance card, At-Risk Policies feed) |
| QA environment | `https://app-test.k.indiraiscm.com` (chromium) |
| Spec file | `tests/e2e/IUN3229-Dashboard/IUN3229-dashboard.spec.ts` (65 tests) |
| Summary doc | `docs/test-cases/dashboard.md` |
| Catalogue date | 2026-11-20 |
| Last run | 2026-11-20: all passed (known defects are marked `test.fail`, so they pass while the defect exists and turn red when it is fixed) |
| Total tests | 65 |

**Test case IDs.** The ID already written in the test title is used (TC_DB_00x = QA case of the story, BR-DB-0x = business rule). Several tests share one ID, so every row also carries its row number `(row n)`. Tests whose title has no ID got `DASH-nnn` in file order. Test titles are grouped by the spec's own blocks TS_DB_01 to TS_DB_07.

**Type.** Positive = expected behaviour works (real QA data). Negative = invalid / error input handled. Boundary = tier edge values. Known defect = `test.fail`: the app deviates from the story and the test records the gap. Mocked API = the data situation is simulated by answering `GET /admin/dashboard` with hand-built JSON (the screen is tested on how it RENDERS the data it is given). Gated = real write, not run (none in this story).

**Result.** `Pass` = passed in the last full run. `Known defect (expected fail)` = `test.fail`, green while the defect exists. `Skipped (<reason>)` = skipped in code with a reason (none in this file).

**Preconditions common to all tests.** Signed in as ADMIN (stored session of the framework setup project). Nothing is written: the other modules (Policies, Acknowledgements, Compliance) are only READ. Three kinds of checks:
- REAL DATA: `GET /admin/dashboard` is captured and the screen is compared with it. QA numbers change with other runs, nothing is hard-coded (the story's 416 / 303 / 103 are illustrative; QA today: 2519 users, 10 policies, 3 ack requests, 0% compliance, 10 at-risk policies).
- MOCKED API: the dashboard call is answered with hand-built JSON (never fetched from the server). Used for tiers, boundaries, empty and error situations, 6/406 and 40 cards. Rows marked "Mocked API" or with "(mocked)" in the title belong to this group.
- KNOWN DEFECT: `test.fail()`.
Mock default payload (when only some fields are changed): 10 users (6 students, 3 employees, 1 admin), 2 policies, 1 ack request, 0% compliance, no at-risk policy. Tier colours: red rgb(229,57,53), amber rgb(255,198,5), green rgb(46,125,50). Tier rule of the story: Low below 50, Moderate 50 to 84.9, Compliant from 85.

## Story scenarios and business rules covered

| Story scenario / rule | Test case IDs (rows) |
|---|---|
| Scenario 1 / TC_DB_001 header, sections, six tiles, side menu | rows 1-4 |
| Dashboard Initialization (async load of GET /admin/dashboard) | row 5 |
| Scenario 1 / TC_DB_002 user counts | rows 6-8 |
| BR-DB-01 Total = Students + Employees + Admins | rows 7-8 |
| TC_DB_003 Policies / Acknowledgement tiles, refresh | rows 9, 11-12 |
| BR-DB-02 Acknowledgement KPI = completed sign-offs | row 10 |
| Validation "Live Database Verification" | rows 11-13 |
| Scenario 2 / TC_DB_004 overall compliance, tier badge | rows 14-26 |
| BR-DB-05 tier thresholds and label | rows 21-26 |
| Scenario 2 / Macro Compliance Calculation, one decimal | rows 27-28, 31-32 |
| Validation "Zero Division Guard" | rows 29-30 |
| Scenario 3 / TC_DB_005 progress bar, rounded text | rows 39-42, 31 |
| BR-DB-04 rounded percentage on the card | row 41 |
| TC_DB_006 / BR-DB-03 at-risk cards and audience denominators | rows 33-35 |
| Scenario 4 / TC_DB_007 OVERDUE / AT_RISK pills | rows 36-37 |
| BR-DB-06 at-risk rule and sorting | rows 37-38 |
| Validation "Drill-Down Navigation" | row 43 |
| Empty / long / many cards | rows 44-45 |
| Loading, empty and error states | rows 46-54 |
| Navigation | rows 55-59 |
| Consistency with Policies / Acknowledgements / Compliance | rows 60-65 |

## Test cases

### TS_DB_01 Page load

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| DASH-001<br>(row 1) | Signed-in admin sees the dashboard and admin menu (@smoke) | Positive | Admin session | 1. Open `/dashboard`.<br>2. Check the dashboard heading.<br>3. Check the menu items Social Feed, Admin Posts, Bulk Upload, Master Data, Notifications, Policies, Compliance. | Dashboard heading visible; all seven menu items visible | Pass | - |
| DASH-002<br>(row 2) | A saved session survives a reload (@regression) | Positive | Admin session | 1. Open `/dashboard`.<br>2. Reload.<br>3. Check the dashboard heading. | Dashboard still loaded after the reload | Pass | - |
| TC_DB_001<br>(row 3) | Header "Admin Dashboard" with "Indira University Overview", all four sections and six tiles render | Positive | Admin session, real data | 1. Open `/dashboard`.<br>2. Check heading and subtitle.<br>3. Check sections User Statistics, Content, Overall Compliance, At-Risk Policies.<br>4. List the tile labels. | Heading, subtitle and the four sections visible; tiles are exactly Acknowledgement, Admins, Employees, Policies, Students, Total | Pass | - |
| TC_DB_001<br>(row 4) | Side menu lists Dashboard, Policies, Acknowledgements and Compliance, with Dashboard first | Positive | Admin session | 1. Open `/dashboard`.<br>2. Check the menu items Dashboard, Policies, Acknowledgements, Compliance, Reported Posts, Communities. | All six items visible (the test checks visibility only; the order "Dashboard first" is not asserted) | Pass | - |
| DASH-003<br>(row 5) | Dashboard Initialization: the KPIs load asynchronously from GET /admin/dashboard (1 call, sometimes 2) | Positive | Admin session, real data | 1. Count `GET /admin/dashboard` requests.<br>2. Open `/dashboard` and wait for the tiles to show the API figures.<br>3. Wait 1.5 s. | One or two calls (observed: sometimes the screen asks twice on load, harmless) | Pass | - |

### TS_DB_02 KPI cards (Scenario 1, BR-DB-01, BR-DB-02)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_DB_002<br>(row 6) | Total / Students / Employees / Admins tiles equal the API counts | Positive | Admin session, real data (captured API response) | 1. Open `/dashboard` and capture the API response.<br>2. Read the four tiles. | Each tile equals totalUsers / totalStudents / totalEmployees / totalAdmins | Pass | - |
| TC_DB_002<br>(row 7) | BR-DB-01 Total Users = Students + Employees + Admins (on screen and in the API) | Positive | Admin session, real data | 1. Open `/dashboard`, capture the API response.<br>2. Check the sum in the API and on the tiles. | totalUsers equals students + employees + admins in the API and Total equals the sum of the three tiles | Pass | - |
| TC_DB_002<br>(row 8) | BR-DB-01 mismatch case (mocked): the screen shows the figures it is given, it does not recompute | Mocked API | Mocked: totalUsers 100, students 60, employees 30, admins 5 | 1. Open `/dashboard`.<br>2. Read the four tiles. | Tiles show 100, 60, 30, 5 exactly as given (no recomputation) | Pass | - |
| TC_DB_003<br>(row 9) | Content tiles: "Policies" shows policiesPublished and "Acknowledgement" shows ackRequestsPublished | Positive | Admin session, real data | 1. Open `/dashboard`, capture the API response.<br>2. Read the Policies and Acknowledgement tiles. | Policies = policiesPublished; Acknowledgement = ackRequestsPublished | Pass | - |
| BR-DB-02<br>(row 10) | The Acknowledgement KPI is the total of completed individual sign-offs across all policies | Known defect | Admin session, real data; Compliance report read (GET only) | 1. Open `/dashboard`, read the Acknowledgement tile.<br>2. Open `/compliance` and sum totalAcknowledged over all report rows. | Expected: tile = sum of completed sign-offs (17 on QA).<br>Actual (defect): the tile shows the number of ack requests published (ackRequestsPublished, 3 on QA) | Known defect (expected fail) | IUN-3372 |
| TC_DB_003<br>(row 11) | After the data changes, a refresh shows the new Acknowledgement / Policies figures (mocked sequence) | Mocked API | Mocked sequence: 1st call policies 5 / ack 7, later calls policies 6 / ack 8 | 1. Open `/dashboard`; check 5 and 7.<br>2. Reload; wait. | After the reload the tiles show Policies 6 and Acknowledgement 8 | Pass | - |
| TC_DB_003<br>(row 12) | Coming back to the dashboard from another screen re-reads the data (no stale cache) | Known defect | Admin session, real data | 1. Open `/dashboard`.<br>2. Click "Policies" in the menu; check `/policies`.<br>3. Click "Dashboard" in the menu; wait for a new `GET /admin/dashboard` (5 s). | Expected: a new request is sent and fresh figures are shown.<br>Actual (defect, low / medium): in-app navigation back shows cached figures without a new request; only a browser reload refreshes them | Known defect (expected fail) | IUN-3384 |
| DASH-004<br>(row 13) | Validation "Live Database Verification": there is no refresh button, refresh = reload of the page | Positive | Admin session | 1. Open `/dashboard`.<br>2. Look for a button named refresh / reload. | No such button exists (documents the behaviour) | Pass | - |

### TS_DB_03 Overall compliance (Scenario 2, BR-DB-05, zero-division guard)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_DB_004<br>(row 14) | Real data: the score is shown and the tier badge matches it | Positive | Admin session, real data (QA is at about 0%) | 1. Open `/dashboard`, capture the API response.<br>2. Read the compliance card (text, badge). | Score text equals overallCompliance (1 decimal tolerance); badge equals the story tier of that value (Low below 50, Moderate below 85, Compliant from 85) | Pass | - |
| TC_DB_004<br>(row 15) | 0% shows the "Low" tier with a red badge (mocked) | Boundary | Mocked overallCompliance 0 | 1. Open `/dashboard`.<br>2. Read badge, badge colour and bar colour. | Badge "Low"; badge and bar red | Pass | - |
| TC_DB_004<br>(row 16) | 0.1% shows the "Low" tier with a red badge (mocked) | Boundary | Mocked overallCompliance 0.1 | Same steps as row 15 | Same as row 15 | Pass | - |
| TC_DB_004<br>(row 17) | 49.9% shows the "Low" tier with a red badge (mocked) | Boundary | Mocked overallCompliance 49.9 | Same steps as row 15 | Same as row 15 | Pass | - |
| TC_DB_004<br>(row 18) | 50% shows the "Moderate" tier with an amber badge (mocked) | Boundary | Mocked overallCompliance 50 | 1. Open `/dashboard`.<br>2. Read badge and badge colour. | Badge "Moderate"; badge amber | Pass | - |
| TC_DB_004<br>(row 19) | 60% shows the "Moderate" tier with an amber badge (mocked) | Positive | Mocked overallCompliance 60 | Same steps as row 18 | Same as row 18 | Pass | - |
| TC_DB_004<br>(row 20) | 74.9% shows the "Moderate" tier with an amber badge (mocked) | Boundary | Mocked overallCompliance 74.9 | Same steps as row 18 | Same as row 18 | Pass | - |
| TC_DB_004 / BR-DB-05<br>(row 21) | 75% is still "Moderate" (amber): the Compliant tier starts at 85.0% | Known defect | Mocked overallCompliance 75 | 1. Open `/dashboard`.<br>2. Read badge and colour. | Expected: "Moderate", amber.<br>Actual (defect): the badge turns green "Healthy" from 75.0% (observed with 75, 79.9, 80, 84.9) | Known defect (expected fail) | IUN-3373 |
| TC_DB_004 / BR-DB-05<br>(row 22) | 80% is still "Moderate" (amber): the Compliant tier starts at 85.0% | Known defect | Mocked overallCompliance 80 | Same steps as row 21 | Same as row 21 | Known defect (expected fail) | IUN-3373 |
| TC_DB_004 / BR-DB-05<br>(row 23) | 84.9% is still "Moderate" (amber): the Compliant tier starts at 85.0% | Known defect | Mocked overallCompliance 84.9 | Same steps as row 21 | Same as row 21 | Known defect (expected fail) | IUN-3373 |
| TC_DB_004<br>(row 24) | 85% is the top tier with a green badge (mocked) | Boundary | Mocked overallCompliance 85 | 1. Open `/dashboard`.<br>2. Read badge colour and bar colour. | Badge and bar are green (the label is not asserted here) | Pass | - |
| TC_DB_004<br>(row 25) | 100% is the top tier with a green badge (mocked) | Boundary | Mocked overallCompliance 100 | Same steps as row 24 | Same as row 24 | Pass | - |
| TC_DB_004 / BR-DB-05<br>(row 26) | The top tier is labelled "Compliant" | Known defect | Mocked overallCompliance 90 | 1. Open `/dashboard`.<br>2. Read the badge text. | Expected: "Compliant".<br>Actual (defect, low): the label is "Healthy" | Known defect (expected fail) | IUN-3373 |
| DASH-005<br>(row 27) | Scenario 2 / Macro Compliance Calculation: the score is shown to 1 decimal place | Known defect | Mocked overallCompliance 50 | 1. Open `/dashboard`.<br>2. Read the score text. | Expected: "50.0%".<br>Actual (defect): whole numbers are shown without decimal ("0%", "50%", "100%") | Known defect (expected fail) | IUN-3379 |
| DASH-006<br>(row 28) | Scenario 2: a value with one decimal is shown as given (mocked 37.5) | Mocked API | Mocked overallCompliance 37.5 | 1. Open `/dashboard`.<br>2. Read the score text. | "37.5%" | Pass | - |
| DASH-007<br>(row 29) | Validation "Zero Division Guard": nothing assigned shows 0 / 0 acknowledged and no NaN anywhere (mocked) | Negative | Mocked: one OVERDUE policy with totalAssigned 0, totalAcknowledged 0, percentage 0; overallCompliance 0 | 1. Open `/dashboard`.<br>2. Read the first at-risk card counter.<br>3. Read the page text and the compliance bar scale. | Counter "0/0 acknowledged"; no NaN / undefined / Infinity in the page; bar scale is a finite number | Pass | - |
| DASH-008<br>(row 30) | Validation "Zero Division Guard": Overall Compliance defaults to "0.0%" with no obligations (mocked) | Known defect | Mocked overallCompliance 0, no at-risk policies | 1. Open `/dashboard`.<br>2. Read the score text. | Expected: "0.0%".<br>Actual (defect, low): shows "0%" (same cause as row 27) | Known defect (expected fail) | IUN-3379 |
| DASH-009<br>(row 31) | Scenario 2: progress bar of the compliance card follows the score (mocked 49.9 -> 0.499) | Mocked API | Mocked overallCompliance 49.9 | 1. Open `/dashboard`.<br>2. Read the bar fill scale. | Bar scale is about 0.499 (2 decimals) | Pass | - |
| DASH-010<br>(row 32) | Macro Compliance Calculation: the score agrees with completed / required obligations from the Compliance report | Positive | Admin session, real data; Compliance report read (GET only) | 1. Open `/dashboard`, capture the API response.<br>2. Open `/compliance`, read the report rows.<br>3. Compute completed / assigned over all rows and over policy rows only (1 decimal). | The dashboard score is within 0.1 of one of the two computed values (weak check: both are about 0% on QA today) | Pass | - |

### TS_DB_04 At-risk policies (Scenarios 3 and 4, BR-DB-03, BR-DB-04, BR-DB-06)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_DB_006<br>(row 33) | Real data: one card per at-risk policy with title, "X/Y acknowledged" and status pill from the API, in API order | Positive | Admin session, real data | 1. Open `/dashboard`, capture the API response.<br>2. Read all at-risk cards. | Card count equals the API list; each card title, counter "acknowledged/assigned acknowledged" and status equal the API item at the same position | Pass | - |
| TC_DB_006 / BR-DB-03<br>(row 34) | Real data: every denominator is an active target cohort (students + employees, employees only, students only or everybody) | Positive | Admin session, real data | 1. Open `/dashboard`, capture the API response.<br>2. Check each totalAssigned against the cohorts built from the tile figures.<br>3. Check the counter format on each card. | Every totalAssigned is one of students + employees, employees, students, total users; counters match `N/M acknowledged` | Pass | - |
| TC_DB_006 / BR-DB-03<br>(row 35) | Campus-wide and employee-only policies show their own denominators (mocked) | Mocked API | Mocked: "Campus wide" 10/2509 and "Employees only" 10/549 | 1. Open `/dashboard`.<br>2. Read the card counters. | "10/2509 acknowledged" and "10/549 acknowledged" | Pass | - |
| TC_DB_007<br>(row 36) | Scenario 4: OVERDUE shows a red pill and AT_RISK an amber pill (mocked) | Mocked API | Mocked: one OVERDUE policy (deadline 2020-01-01, 40%) and one AT_RISK (due in 3 days, 40%) | 1. Open `/dashboard`.<br>2. Read status text and pill colour of both cards. | OVERDUE pill red; AT_RISK pill amber | Pass | - |
| TC_DB_007 / BR-DB-06<br>(row 37) | Real data: every listed policy meets the OVERDUE / AT_RISK rule for its deadline and completion | Positive | Admin session, real data | 1. Open `/dashboard`, capture the API response.<br>2. For each policy compare deadline with today and today + 7 days. | Deadline in the past: status OVERDUE and below 100%. Otherwise: AT_RISK, due within 7 days and below 80% | Pass | - |
| BR-DB-06<br>(row 38) | The feed is sorted OVERDUE first, then by lowest completion | Known defect | Admin session, real data | 1. Open `/dashboard`, capture the API list.<br>2. Sort a copy by OVERDUE first, then lowest percentage.<br>3. Compare policy id order. | Expected: the API order equals the sorted order.<br>Actual (defect): the feed follows policy id order (a 0.2% policy listed before several 0% policies on QA) | Known defect (expected fail) | IUN-3374 |
| TC_DB_005<br>(row 39) | Scenario 3: progress bar width follows the exact (unrounded) percentage: 1.48% -> scale 0.0148 (mocked) | Mocked API | Mocked: one policy 6/406, compliancePercentage 1.48 | 1. Open `/dashboard`.<br>2. Read the bar fill scale of the card. | Scale between 0.0143 and 0.0153 | Pass | - |
| TC_DB_005<br>(row 40) | Scenario 3: progress bar of a half-complete policy is half full (mocked 50%) | Mocked API | Mocked: one policy 5/10, 50% | 1. Open `/dashboard`.<br>2. Read the bar fill scale. | Scale is about 0.5 | Pass | - |
| BR-DB-04<br>(row 41) | Scenario 3: the card shows the rounded percentage text "1.5%" for 6 of 406 | Known defect | Mocked: one policy 6/406, compliancePercentage 1.5 | 1. Open `/dashboard`.<br>2. Read the full text of the card. | Expected: the card text contains "1.5%".<br>Actual (defect): at-risk cards show no percentage text at all (only "6/406 acknowledged" and the bar) | Known defect (expected fail) | IUN-3377 |
| TC_DB_005<br>(row 42) | Real data: bar scale agrees with the API percentage of every card | Positive | Admin session, real data | 1. Open `/dashboard`, capture the API response.<br>2. Compare every card bar scale with percentage / 100. | Each bar scale is within 0.002 of the API percentage / 100 | Pass | - |
| DASH-011<br>(row 43) | Validation "Drill-Down Navigation": clicking an at-risk card opens /acknowledgements filtered by that policy id | Known defect | Admin session, real data | 1. Open `/dashboard`.<br>2. Click the first at-risk card.<br>3. Wait up to 5 s for the URL. | Expected: URL contains `/acknowledgements` and the policy id.<br>Actual (defect): cards are not clickable; the URL stays `/dashboard` | Known defect (expected fail) | IUN-3375 |
| DASH-012<br>(row 44) | At-Risk feed with no at-risk policy (mocked): no cards, no errors, the rest of the dashboard still shows | Mocked API | Mocked atRiskPolicies = [] | 1. Open `/dashboard`.<br>2. Count the at-risk cards, tiles; check the Overall Compliance section. | No cards; six tiles; Overall Compliance section visible | Pass | - |
| DASH-013<br>(row 45) | At-Risk feed with a very long title and 40 policies (mocked): the page still renders every card | Mocked API | Mocked: 40 OVERDUE policies, the first with a 150-character title | 1. Open `/dashboard`.<br>2. Count the cards.<br>3. Check horizontal overflow. | 40 cards rendered; no horizontal scroll | Pass | - |

### TS_DB_05 Loading, empty and error states

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| DASH-014<br>(row 46) | Loading state: a spinner shows while the call is slow, no stale numbers, then the data replaces it | Positive | Admin session; the real API call is delayed by 3 s (simulated slow network, real data afterwards) | 1. Open `/dashboard` (without waiting for the heading).<br>2. Check the spinner (progressbar) and that no card is shown.<br>3. Wait for the heading (up to 20 s) and the first card. | Spinner visible with 0 cards; then the heading and cards appear | Pass | - |
| DASH-015<br>(row 47) | Empty state (mocked, every figure 0): six tiles show 0, no NaN / undefined | Mocked API | Mocked: all counts 0, compliance 0, no at-risk | 1. Open `/dashboard`.<br>2. Read the six tiles and the page text. | All six tiles "0"; no NaN / undefined / null in the page | Pass | - |
| DASH-016<br>(row 48) | Empty state (mocked): "Low" badge for 0% with no obligations | Mocked API | Mocked: compliance 0, no at-risk | 1. Open `/dashboard`.<br>2. Read the badge. | Badge "Low" | Pass | - |
| DASH-017<br>(row 49) | Missing fields in the payload (mocked data = {}) do not break the page (no NaN, no crash) | Negative | Mocked: `data` is an empty object | 1. Open `/dashboard`.<br>2. Read the page text; collect uncaught script errors. | No NaN / undefined in the page; no uncaught errors | Pass | - |
| DASH-018<br>(row 50) | Error state: GET /admin/dashboard answers 500 server error (mocked) - the user is told the data could not be loaded | Known defect | Mocked: dashboard call answered 500 | 1. Open `/dashboard`.<br>2. Look for an error / failed / try again message (5 s). | Expected: a visible message that the data could not be loaded.<br>Actual (defect, mocked): no message; the dashboard silently shows zeros and a red "Low" badge as if real | Known defect (expected fail) | IUN-3371 |
| DASH-019<br>(row 51) | Error state: GET /admin/dashboard answers 403 forbidden (mocked) - the user is told the data could not be loaded | Known defect | Mocked: dashboard call answered 403 | Same steps as row 50 | Same as row 50 | Known defect (expected fail) | IUN-3371 |
| DASH-020<br>(row 52) | Error state: a network failure on the dashboard call (mocked) - the user is told the data could not be loaded | Known defect | Mocked: dashboard request aborted | 1. Open `/dashboard`.<br>2. Look for an error / offline message (5 s). | Expected: a visible message.<br>Actual (defect, mocked): silent zeros, as for HTTP errors | Known defect (expected fail) | IUN-3371 |
| DASH-021<br>(row 53) | Error state: the page does not crash on a failed call (mocked 500): header and menu stay usable | Negative | Mocked: dashboard call answered 500 | 1. Open `/dashboard`.<br>2. Check the "Policies" menu item and uncaught errors. | Menu item visible; no uncaught script errors | Pass | - |
| DASH-022<br>(row 54) | Error state: no retry control after a failed call (mocked 500), a reload recovers once the API is back | Mocked API | Mocked: first call 500, later calls return a payload with 42 users | 1. Open `/dashboard` (500).<br>2. Switch the mock to success and reload.<br>3. Read the Total tile. | Total tile shows 42 after the reload (no retry button is asserted or required) | Pass | - |

### TS_DB_06 Navigation

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| DASH-023<br>(row 55) | Side menu "Policies" opens its screen from the dashboard | Positive | Admin session | 1. Open `/dashboard`.<br>2. Click "Policies" in the menu. | URL matches `/policies` | Pass | - |
| DASH-024<br>(row 56) | Side menu "Acknowledgements" opens its screen from the dashboard | Positive | Admin session | 1. Open `/dashboard`.<br>2. Click "Acknowledgements". | URL matches `/acknowledgements` | Pass | - |
| DASH-025<br>(row 57) | Side menu "Compliance" opens its screen from the dashboard | Positive | Admin session | 1. Open `/dashboard`.<br>2. Click "Compliance". | URL matches `/compliance` | Pass | - |
| DASH-026<br>(row 58) | KPI tiles are static: clicking one stays on /dashboard and sends no write | Negative | Admin session; any non-GET API call is recorded and answered locally | 1. Open `/dashboard`.<br>2. Click the first card.<br>3. Wait 0.8 s; check URL and recorded writes. | URL still ends `/dashboard`; no write request | Pass | - |
| DASH-027<br>(row 59) | The Social Feed / Notifications / Master Data menu items stay reachable from the dashboard | Positive | Admin session | 1. Open `/dashboard`.<br>2. Check the three menu items. | All three visible | Pass | - |

### TS_DB_07 Consistency with Policies / Acknowledgements / Compliance (read-only)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| DASH-028<br>(row 60) | "Acknowledgement" tile equals the number of requests listed on the Acknowledgements screen | Positive | Admin session, real data; Acknowledgements list read (GET only) | 1. Open `/dashboard`, capture the API response.<br>2. Open `/acknowledgements`, read totalElements of the list response. | totalElements equals ackRequestsPublished | Pass | - |
| DASH-029<br>(row 61) | "Policies" tile equals the number of policies listed on the Policies screen | Known defect | Admin session, real data; Policies list read (GET only) | 1. Open `/dashboard`, capture the API response.<br>2. Open `/policies`, read totalElements. | Expected: equal.<br>Actual (defect, QA data): the dashboard counts 10 published policies (the Compliance report also lists 10), the Policies screen lists 8 (ids 2 and 10 missing) | Known defect (expected fail) | IUN-3382 |
| DASH-030<br>(row 62) | "Policies" and "Acknowledgement" tiles equal the POLICY and ACK_REQUEST rows of the Compliance report | Positive | Admin session, real data; Compliance report read (GET only) | 1. Open `/dashboard`, capture the API response.<br>2. Open `/compliance`; count POLICY and ACK_REQUEST rows. | POLICY row count equals policiesPublished; ACK_REQUEST row count equals ackRequestsPublished | Pass | - |
| DASH-031<br>(row 63) | Every at-risk card shows the same assigned / acknowledged / status as the Compliance report row of that policy | Positive | Admin session, real data; Compliance report read (GET only) | 1. Open `/dashboard`, capture the API response.<br>2. Open `/compliance`.<br>3. For each at-risk policy find its POLICY row by id. | Row exists; assigned, acknowledged and status are equal; percentage equal within 1 decimal | Pass | - |
| DASH-032<br>(row 64) | Every OVERDUE / AT_RISK policy of the Compliance report appears in the dashboard feed (nothing at risk is hidden) | Positive | Admin session, real data; Compliance report read (GET only) | 1. Open `/dashboard`, capture the API response.<br>2. Open `/compliance`; collect POLICY ids with status OVERDUE or AT_RISK.<br>3. Compare id sets. | The dashboard feed ids equal the flagged report ids | Pass | - |
| DASH-033<br>(row 65) | Total Users agrees with the number of users the Compliance report targets (everybody but admins) | Positive | Admin session, real data; Compliance report read (GET only) | 1. Open `/dashboard`, capture the API response.<br>2. Open `/compliance`; take the largest totalAssigned. | Largest totalAssigned equals totalStudents + totalEmployees | Pass | - |

Row count: TS_DB_01 5 + TS_DB_02 8 + TS_DB_03 19 + TS_DB_04 13 + TS_DB_05 9 + TS_DB_06 5 + TS_DB_07 6 = 65 rows.

## Not automated

| Case | Reason |
|---|---|
| TC_DB_003 "have a user sign a policy, refresh, KPI +1" | Needs a student / employee account to sign; acknowledgements cannot be undone. Covered by the mocked refresh sequence (row 11) |
| TC_DB_002 comparison with "live DB user counts" | No database access; the API is the source. Total = sum of cohorts is checked on the API values |
| TC_DB_004 real 50-84.9% and >= 85% on QA data | QA is at 0%; tiers are covered with mocked values |
| TC_DB_005 real 6/406 policy | Not in QA data (6/2509 exists, 0.2%). Covered mocked: bar 1.48, text 1.5% |
| TC_DB_006 exact denominators against the database (active users per cohort) | The API cohorts (students + employees = 2509, employees = 549) are cross-checked with the dashboard tiles, not with the database |
| TC_DB_007 with a policy due in under 7 days and < 80% on real data | Only one such policy exists (an AUTOTEST one, deadline today); the rule is checked over whatever real data exists plus mocked pills |
| BR-DB-06 exact boundary dates computed by the backend (today, +6 / +7 days, 79 / 80%) | The status is computed by the backend, the screen only renders it; needs policies with chosen deadlines (writes data) |
| Student / auditor view of the dashboard, access control of `/admin/dashboard` | No such accounts; see the Login / SSO catalogue (IUN-3224) |
| Mobile layout of the dashboard | Out of scope of this automated suite (admin portal); mobile findings are listed below as "mobile review, no automated test" |

Note: `tests/e2e/profile/profile.spec.ts` contains two skipped placeholder tests (update name, change country / upload avatar). They do not belong to a story, are not part of the 65 rows, and are skipped because there is no student / employee account and no editable profile form in the admin portal.

## Counts

65 tests: 50 Pass, 15 Known defect (expected fail), 0 Gated, 0 Skipped. Rows with a bug key: 15 (every known-defect row).

## Bugs raised for this story

| Bug key | Title | Priority | Covering test rows |
|---|---|---|---|
| IUN-3371 | API errors show no message; zeros are shown as real figures (found with mocked errors) | High (needs confirmation) | 50, 51, 52 |
| IUN-3372 | Acknowledgement card shows 3 instead of 17 completed sign-offs (BR-DB-02) | High | 10 |
| IUN-3373 | Compliance badge turns green from 75% instead of 85%, label "Healthy" instead of "Compliant" (BR-DB-05, found with mocked values) | High (needs confirmation) | 21, 22, 23, 26 |
| IUN-3374 | At-risk feed is not sorted OVERDUE first, then lowest completion (BR-DB-06) | Not stated | 38 |
| IUN-3375 | At-risk cards are not clickable (no drill-down) | Not stated | 43 |
| IUN-3377 | At-risk cards show no percentage text (BR-DB-04) | Not stated | 41 |
| IUN-3379 | Compliance score shows "0%" instead of "0.0%" (one decimal) | Low | 27, 30 |
| IUN-3382 | Dashboard counts 10 policies, the Policies screen lists 8 | Needs confirmation | 61 |
| IUN-3384 | Cached figures are shown when returning to the dashboard from another screen | Low | 12 |
| IUN-3408 | Tap targets below 48dp / 44pt (mobile review, no automated test) | Not stated | none (linked to IUN-3229) |
| IUN-3409 | Tiny text (mobile review, no automated test) | Not stated | none (linked to IUN-3229) |
| IUN-3410 | "Alerts" vs "Notifications" naming (mobile review, no automated test) | Not stated | none (linked to IUN-3229) |
| IUN-3411 | "More Options" sheet has no close cue (mobile review, no automated test) | Not stated | none (linked to IUN-3229) |
