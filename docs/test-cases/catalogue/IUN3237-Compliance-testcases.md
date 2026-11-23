# IUN-3237 Compliance Report Generation, Tracking & Data Export: test case catalogue

| Item | Value |
|---|---|
| Story | IUN-3237 "Compliance Report Generation, Tracking & Data Export" |
| Module | Admin > Compliance Report (`/compliance`) |
| Environment | QA, `https://app-test.k.indiraiscm.com`, signed in as ADMIN (except TC_CR_033, no session) |
| Spec files | `tests/e2e/IUN3237-Compliance/IUN3237-compliance.spec.ts` (35 tests, team sheet TC_CR_001 .. 034)<br>`tests/e2e/IUN3237-Compliance/IUN3237-compliance.gap.spec.ts` (3 tests, paging) |
| Summary doc | `docs/test-cases/compliance.md` |
| Catalogue date | 2026-11-20 |
| Last run | 2026-11-20, chromium: all passed (known-defect tests are expected-fail and count as passed). No gated tests: Export only reads. |

Test case IDs are the TC_CR ids in the test titles (several ids have two tests, a positive one and a known-defect one). The three gap-spec tests have no id and get generated ids `CR-001 .. CR-003` in file order.

**Type:** Positive, Negative, Boundary, Known defect (`test.fail`, turns red when the app is fixed), Mocked API (the list call is replaced to force a situation; tests how the screen renders it), Real data (compares the screen with what QA returns; counted as Positive).
**Result:** `Pass`; `Known defect (expected fail)`; `Gated, not run`; `Skipped`.

## Story scenarios and business rules covered

| Story scenario / BR | Test ids |
|---|---|
| Page load (TS_CR_01) | TC_CR_001, TC_CR_002 |
| Card content and audience tags (TS_CR_02) | TC_CR_003 .. TC_CR_007 (x2) |
| Acknowledgement counters / denominators (TS_CR_03) | TC_CR_008 .. TC_CR_013 |
| Percentage and progress bar (TS_CR_04) | TC_CR_014 .. TC_CR_018 |
| OVERDUE rule and default order (TS_CR_05) | TC_CR_019 (x2), TC_CR_020 .. TC_CR_022 |
| Export, BR-CR-04 columns (TS_CR_06) | TC_CR_023 (x2), TC_CR_024 (x2), TC_CR_025, TC_CR_026, TC_CR_028 |
| Access and errors (TS_CR_08) | TC_CR_027, TC_CR_033, TC_CR_034 (x2) |
| Paging (story gap, list API `page=0&size=20`) | CR-001 .. CR-003 |
| TC_CR_029 .. 032, Auditor access | Not automated (see below) |

## Test cases

### Page load (TS_CR_01)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_CR_001 | page loads with title, Export button and cards | Positive | ADMIN, real data | 1. Open `/compliance`. | Report title, Export button and at least one card are visible. | Pass | - |
| TC_CR_002 | loading state: a loader shows, then the cards replace it | Positive | List API delayed 2.5 s (request continued to the real server) | 1. Open `/compliance` directly. | Loader visible and no cards at first; cards appear within 15 s. | Pass | - |

### Card content and audience tags (TS_CR_02)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_CR_003 | every card shows the type pill, title, status and a M/D/YYYY deadline | Positive | ADMIN, real data | 1. Open the report.<br>2. Read every card. | Type pill is `Policy` or `Ack Request`; non-empty title and status; deadline like `Deadline: 3/28/2026`. | Pass | - |
| TC_CR_004 | an employee-only policy shows only the EMPLOYEE tag | Mocked API | List mocked: one policy, targetRoles EMPLOYEE, 0 / 303 | 1. Open the report. | Audience tags equal `[EMPLOYEE]`. | Pass | - |
| TC_CR_005 | a campus-wide policy shows both tags | Mocked API | Mocked: targetRoles EMPLOYEE and STUDENT | 1. Open the report. | Tags EMPLOYEE and STUDENT. | Pass | - |
| TC_CR_006 | a student-only policy shows only the STUDENT tag | Mocked API | Mocked: targetRoles STUDENT, 0 / 103 | 1. Open the report. | Tags equal `[STUDENT]`. | Pass | - |
| TC_CR_007 | audience tags on the screen match the API for real data | Positive | ADMIN; real list API response captured | 1. Open the report and read the API rows and cards. | Same number of cards as rows; each card's tags equal that row's `targetRoles`. | Pass | - |
| TC_CR_007 | an archived policy is not displayed | Known defect | ADMIN; active policies read from the Policies screen API; real report rows | 1. Load `/policies` and collect ids of non-archived policies.<br>2. Open the report.<br>3. Compare policy rows with the active ids. | Expected: no policy in the report that is not active. Actual (defect): archived policies still appear in the Compliance Report. | Known defect (expected fail) | IUN-3315 |

### Acknowledgement counters (TS_CR_03)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_CR_008 | the "X / Y acknowledged" text matches the API for every card | Positive | ADMIN; real data | 1. Open the report; compare each card counter with its API row. | Each card reads `<totalAcknowledged> / <totalAssigned> acknowledged`. | Pass | - |
| TC_CR_009 | campus-wide policies share one denominator, employee-only policies a smaller one | Positive | ADMIN; real data | 1. Group real policy rows by audience. | Exactly one denominator for campus-wide, one for employee-only, and the employee-only one is smaller. | Pass | - |
| TC_CR_010 | a student-only policy shows the student denominator | Mocked API | Mocked: STUDENT, 0 / 103 | 1. Open the report. | Counter `0 / 103 acknowledged`. | Pass | - |
| TC_CR_011 | zero acknowledgements shows "0 / Y" and 0% | Mocked API | Mocked: 0 of 406, 0% | 1. Open the report. | Counter `0 / 406 acknowledged`, percent `0%`. | Pass | - |
| TC_CR_012 | a target audience with 0 users shows "0 / 0", 0% and no NaN | Mocked API | Mocked: 0 of 0, 0% | 1. Open the report. | Counter `0 / 0 acknowledged`, `0%`, no text matching NaN or Infinity, no page errors. | Pass | - |
| TC_CR_013 | all users acknowledged shows 100% | Mocked API | Mocked: 103 of 103, 100, COMPLIANT | 1. Open the report. | Counter `103 / 103 acknowledged`, percent `100%`. | Pass | - |

### Percentage and progress bar (TS_CR_04)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_CR_014 | percentage is ack/total*100 to one decimal (real data) | Positive | ADMIN; real data | 1. Compare each card's percent with ack/total*100. | Difference at most 0.05 per card (0 when total is 0). | Pass | - |
| TC_CR_015 | a ratio of 1.477 is displayed as 1.5% | Known defect | Mocked: 6 of 406, `compliancePercentage` 1.477 | 1. Open the report. | Expected: `1.5%`. Actual (defect): the screen prints the API value unchanged (`1.477%`); it only looks right today because the backend pre-rounds. | Known defect (expected fail) | IUN-3323 |
| TC_CR_016 | exactly 0% is displayed as "0%" | Mocked API | Mocked: 0 of 406, 0 | 1. Open the report. | Percent `0%`. | Pass | - |
| TC_CR_017 | progress bar width matches the percentage (1.48% for 6/406) | Mocked API | Mocked: 6 of 406, 1.477 | 1. Open the report; read the first card's bar width. | Bar width between 1.4% and 1.56%. | Pass | - |
| TC_CR_018 | percentage never exceeds 100 or goes negative (more acknowledged than assigned) | Known defect | Mocked: 9 of 5, 180 | 1. Open the report. | Expected: percent between 0 and 100 and bar width at most 100%. Actual (defect): the screen shows 180% and draws the bar past 100%. | Known defect (expected fail) | IUN-3317 |

### OVERDUE and order (TS_CR_05)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_CR_019 | past deadline with less than 100% shows the red OVERDUE pill | Mocked API | Mocked: deadline 2026-03-19, status OVERDUE | 1. Open the report. | Status `OVERDUE`; pill background is red. | Pass | - |
| TC_CR_019 | backend rule: OVERDUE exactly when the deadline has passed and completion is below 100% (real data) | Positive | ADMIN; real data; today's local date | 1. For each API row compute deadline < today and acknowledged < assigned. | `status === OVERDUE` equals that rule for every row. | Pass | - |
| TC_CR_020 | a future deadline is not shown as OVERDUE | Mocked API | Mocked: deadline 2099-01-01, PENDING | 1. Open the report. | Status is not OVERDUE; no OVERDUE text on the page. | Pass | - |
| TC_CR_021 | a deadline of today is not shown as OVERDUE | Boundary | Mocked: deadline today, AT_RISK | 1. Open the report. | Status is not OVERDUE. | Pass | - |
| TC_CR_022 | default sort: OVERDUE with the lowest completion first, then the rest | Known defect | ADMIN; real data | 1. Read cards and API percentages.<br>2. Compare the order with OVERDUE first, then AT_RISK, then rest, ascending completion. | Expected: cards in that risk order. Actual (defect): cards come back in ID order, not by risk (a 0.2% card is listed before 0% cards). | Known defect (expected fail) | IUN-3316 |

### Export (TS_CR_06)

Export tests download the real file from QA and read it (xlsx helper); nothing is changed.

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_CR_023 | Export downloads a file | Positive | ADMIN; real data | 1. Open the report.<br>2. Click Export; save the download. | A file is downloaded, named `compliance-report.xlsx` or `.csv`, not empty. | Pass | - |
| TC_CR_023 | the file name extension matches the real format | Known defect | Same download | 1. Download the file.<br>2. Check whether the content is a zip (xlsx) and compare with the extension. | Expected: `.xlsx` for a workbook, `.csv` for plain text. Actual (defect): file is named .csv but is an Excel (.xlsx) workbook. | Known defect (expected fail) | IUN-3319 |
| TC_CR_024 | the file has columns for title, deadline, audience, counts, rate and status | Positive | Same download | 1. Read the header row. | Header contains title, deadline, target, assigned, acknowledged, compliance and status. | Pass | - |
| TC_CR_024 | the file has every column listed in BR-CR-04 | Known defect | Same download | 1. Read the header row. | Expected columns: Policy Title, Issuing Department, Deadline, Target Audience, Total Assigned, Total Acknowledged, Non-Compliant, Compliance Rate, Status. Actual (defect): Issuing Department and Non-Compliant Count columns are missing. | Known defect (expected fail) | IUN-3320 |
| TC_CR_025 | exported data matches the screen | Positive | Same download | 1. Compare each file row with its card. | One file row per card; title, assigned, acknowledged, compliance rate (1 decimal) and status (underscores as spaces) equal the card. | Pass | - |
| TC_CR_026 | Export shows "Exporting..." and ignores a second click while running | Known defect | Export API delayed 2.5 s; requests counted | 1. Click Export, click again.<br>2. Look for "Exporting...".<br>3. Wait 3 s and count requests. | Expected: label "Exporting..." and exactly one export request. Actual (defect): the button keeps the label "Export" and a second click starts a second export. | Known defect (expected fail) | IUN-3318 |
| TC_CR_028 | a failed export tells the user | Known defect | Export API mocked to return HTTP 500 | 1. Click Export. | Expected: a message such as fail / error / try again is shown. Actual (defect): a failing export call shows no message at all. | Known defect (expected fail) | IUN-3321 |

### Access and errors (TS_CR_08)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_CR_033 | a visitor without a session cannot open /compliance | Negative | New browser context, no login | 1. Open `/compliance`. | "Sign in with Microsoft" is shown; no "Compliance Report" title. | Pass | - |
| TC_CR_034 | an API error is reported as an error, not as an empty report | Known defect | List API mocked to return HTTP 500 | 1. Open the report. | Expected: no cards and the empty message hidden (an error is shown instead). Actual (defect): a 500 shows "No items to report on", the same as an empty report. | Known defect (expected fail) | IUN-3322 |
| TC_CR_034 | an API error does not crash the page | Negative | List API mocked to return HTTP 500 | 1. Open the report. | Report title and Export button still visible; no page errors. | Pass | - |
| TC_CR_027 | with no policies the report shows an empty message | Mocked API | List mocked to return no rows | 1. Open the report. | Empty message visible; no cards. | Pass | - |

### Paging (gap spec)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| CR-001 (generated) | the report asks the API for the first page of 20 | Positive | ADMIN | 1. Open the report; capture the list request. | URL contains `page=0&size=20`. | Pass | - |
| CR-002 (generated) | a report with exactly 20 items shows all 20 cards | Mocked API | Mocked: 20 rows | 1. Open the report. | 20 cards. | Pass | - |
| CR-003 (generated) | items beyond the first 20 are reachable (second page is requested) | Known defect | Mocked: 25 items over 2 pages (20 + 5) | 1. Open the report, scroll to the last card, wait 2 s. | Expected: page 2 requested and 25 cards shown. Actual (defect): only the first 20 are shown and page 2 is never requested, so the last 5 policies cannot be seen. | Known defect (expected fail) | IUN-3369 |

## Not automated

| Case | Reason |
|---|---|
| TC_CR_030 new acknowledgement recalculates; TC_CR_031 new policy appears | Needs a student/employee account to sign, and publishing is irreversible for acknowledgements |
| TC_CR_032 student cannot open /compliance | No Student account configured (only the no-session case TC_CR_033 is covered) |
| Export with no policies | The export is built on the server and cannot be forced empty |
| TC_CR_029 export with comma / quote / unicode in a title | Needs a policy with such a title (writes data) |
| TC_CR_001 as Auditor | No Auditor account |

## Bugs raised for this story

| Bug | Title | Priority | Covering test id(s) |
|---|---|---|---|
| IUN-3315 | Archived policy still displayed in the Compliance Report | High | TC_CR_007 (archived policy) |
| IUN-3316 | Default sort is by ID, not OVERDUE / lowest completion first | Not stated | TC_CR_022 |
| IUN-3317 | Percentage and bar exceed 100% when acknowledged > assigned | Not stated | TC_CR_018 |
| IUN-3318 | Export button has no "Exporting..." state and allows a second click | Not stated | TC_CR_026 |
| IUN-3319 | Exported file named .csv but is an .xlsx workbook | Not stated | TC_CR_023 (file extension) |
| IUN-3320 | Export misses Issuing Department and Non-Compliant columns (BR-CR-04) | Not stated | TC_CR_024 (BR-CR-04 columns) |
| IUN-3321 | Failed export shows no message | Not stated | TC_CR_028 |
| IUN-3322 | API error shown as an empty report | Not stated | TC_CR_034 (API error reported as error) |
| IUN-3323 | Percentage 1.477 shown unrounded (`1.477%`) | Low | TC_CR_015 |
| IUN-3369 | Items beyond the first 20 cannot be reached (no paging; needs confirmation) | Medium | CR-003 |
| IUN-3407 | Deadline wraps, pills and progress bar break on phones | Low | Mobile review, no automated test |
