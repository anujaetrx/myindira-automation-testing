# Test cases: Admin > Compliance Report

**Screen:** `/compliance` (admin) on QA, `https://app-test.k.indiraiscm.com`
**Story:** IUN-3237 (rules BR-CR-01 to BR-CR-04)
**Automation:** `tests/e2e/IUN3237-Compliance/IUN3237-compliance.spec.ts`, page object `src/pages/CompliancePage.ts`, Excel reader `src/utils/helpers/xlsx.helper.ts`
**Source:** the team's sheet, TC_CR_001 to TC_CR_034 (scenarios TS_CR_01 to TS_CR_08).
**Last run:** 2026-11-20, chromium, QA. 37 passed (incl. 9 known deviations), 0 failed, 0 skipped.

Run: `npx playwright test tests/e2e/compliance --project=chromium`
Nothing here changes data (Export only reads).

## How the checks work
- **Real data:** QA returns 2509 users for campus-wide policies and 549 for employee-only, not the sheet's 406 / 303 / 103. Counts are compared with the API, not with fixed numbers.
- **Mocked API:** situations that cannot be created safely (0 users, 100%, more acknowledged than assigned, API errors) are produced by replacing the list call. These tests check how the screen *renders* what it is given.
- **Known deviation:** `test.fail()`, green in the run, turns red when the app is fixed.

## Coverage

| Sheet case | Test | Result |
|---|---|---|
| TC_CR_001 page loads | title, Export, cards | Pass |
| TC_CR_002 loading state | loader shows, then cards | Pass (loader is a progress bar, no text) |
| TC_CR_003 card fields | type pill, title, status, M/D/YYYY deadline | Pass |
| TC_CR_004/005/006 audience tags | employee only, both, student only (mocked) | Pass |
| TC_CR_007 | tags match API (real) | Pass |
| TC_CR_007 archived policy not shown | | **Deviation** |
| TC_CR_008 | "X / Y acknowledged" equals API for every card | Pass |
| TC_CR_009/010 denominators | shared per audience; student-only (mocked) | Pass |
| TC_CR_011/012/013 | 0 signed, 0 users (no NaN), 100% | Pass |
| TC_CR_014 | percentage = ack/total, one decimal (real) | Pass |
| TC_CR_015 1.477 shows 1.5% | | **Deviation** |
| TC_CR_016/017 | 0%, progress bar width | Pass |
| TC_CR_018 never above 100 | | **Deviation** |
| TC_CR_019/020/021 OVERDUE | red pill; backend rule on real data; future and today not OVERDUE | Pass |
| TC_CR_022 default sort by risk | | **Deviation** |
| TC_CR_023/024/025 export | downloads; has key columns; data matches the screen | Pass |
| TC_CR_023 file extension | | **Deviation** |
| TC_CR_024 BR-CR-04 columns | | **Deviation** |
| TC_CR_026 Exporting state, no duplicate | | **Deviation** |
| TC_CR_027 no policies | empty message (mocked) | Pass |
| TC_CR_028 export failure handling | | **Deviation** |
| TC_CR_033 no session | sign-in screen | Pass |
| TC_CR_034 API error | page does not crash | Pass |
| TC_CR_034 API error shown as error | | **Deviation** |

## Where the app differs from the sheet and the story

| # | Expected | Actual | Severity guess |
|---|---|---|---|
| 1 | Archived policy not displayed (TC_CR_007) | Archived policies are in the report, e.g. "New Test policy" and "AUTOTEST policy ..." (archived on 2026-11-20) with their own cards and export rows | **High**: wrong compliance figures |
| 2 | Cards sorted by risk, lowest completion first (story, Sorting Default) | Order is by ID: a 0.2% card is listed before the 0% cards | Medium |
| 3 | Percentage text has at most 1 decimal (BR-CR-02) | The screen prints the API value unchanged: a value of 1.477 shows "1.477%". Today the backend pre-rounds, so real data looks right | Low |
| 4 | Percentage never above 100 or negative (TC_CR_018) | 9 acknowledged of 5 shows "180%" and the bar is drawn past 100% | Medium |
| 5 | Export button shows "Exporting..." and blocks duplicate clicks (story) | Label stays "Export", button not disabled, two clicks send two export requests | Medium |
| 6 | Export file is .xlsx or .csv (story) | File is named `compliance-report.csv` but is an Excel workbook (zip) | Medium: opens as garbage in a text editor |
| 7 | Export has Issuing Department and Non-Compliant Count (BR-CR-04) | Columns are Type, ID, Title, Deadline, Target Roles, Assigned, Acknowledged, Compliance %, Status | Medium |
| 8 | A failed export is reported (TC_CR_028) | A 500 from the export call shows nothing | Medium |
| 9 | An API error is reported as an error (TC_CR_034) | A 500 from the list call shows "No items to report on", the same as an empty report | Medium |
| 10 | Only policies (sheet) | Report also lists acknowledgement requests ("Ack Request" pill) | Info: confirm intended |
| 11 | Status values OVERDUE / pending | Backend also returns AT_RISK (deadline today) and shown as "AT RISK" | Info |

## Not automated

| Case | Why |
|---|---|
| TC_CR_030 new acknowledgement recalculates; TC_CR_031 new policy appears | Needs a student/employee account to sign, and publishing is irreversible for acknowledgements |
| TC_CR_032 student cannot open /compliance | No Student account configured |
| TC_CR_027 export with no policies | The export is built on the server and cannot be forced empty |
| TC_CR_029 export with comma / quote / unicode in a title | Needs a policy with such a title (writes data) |
| TC_CR_001 as Auditor | No Auditor account |

## Gap review against story IUN-3237 (2026-11-20)
Extra spec: `tests/e2e/IUN3237-Compliance/IUN3237-compliance.gap.spec.ts` (3 tests). All four story scenarios, BR-CR-01 to BR-CR-04 and the five story QA cases were already covered by the sheet-based spec; the one thing no case asked about is **paging**.

| Check | Result |
|---|---|
| The report requests `page=0&size=20` | Pass |
| A report with exactly 20 items shows 20 cards | Pass |
| With 25 items the last 5 are reachable (page 2 requested) | **Deviation** (`test.fail`): only the first 20 are shown and page 2 is never requested, so policies 21 and up cannot be seen (observed with a mocked list; QA has 13 items today, so it is not visible yet). Medium |
