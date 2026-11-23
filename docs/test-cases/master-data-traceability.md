# Master Data: traceability of the team's test cases (TC_MD_001 to TC_MD_043)

Source: the team's Master Data test-case sheet. Automation: `tests/e2e/IUN3238-MasterData/IUN3238-master-data.tc.spec.ts`.
(The earlier `MD-xxx` catalog in `master-data.md` is supplementary and covers extra checks such as UI-to-API comparison and accessibility.)

**Status key**

| Status | Meaning |
|---|---|
| **Pass** | Automated, runs by default, passes. Nothing is saved. |
| **Deviation** | Automated against the sheet's expected result. The app behaves differently, so the test is marked as an expected failure. It turns red when the app is fixed. |
| **Gated** | Automated, but saves or uploads data. Runs only with `ALLOW_MASTER_DATA_WRITES=true`. **Written but not yet run against a live environment.** |
| **Blocked** | Cannot run yet. |

## Results (QA, `https://app-test.k.indiraiscm.com`)

Last run, 3 repeats: **131 passed, 0 failed, 96 skipped** (gated and blocked cases). After the gap review (below) the whole folder gives 120 passed, 45 skipped in one repeat, plus one flaky dropdown failure that passed on re-run.

| TC | Title | Status | Notes |
|---|---|---|---|
| TC_MD_001 | Inventory sections and counts | Pass | Counts differ from the sheet (QA shows Departments 64, Campuses 32, Roles 3; the sheet says 57, 26, 3). The test checks each count against the pills shown, not fixed numbers. |
| TC_MD_002 | Empty entity type | Blocked | Every list has records. Needs an entity with 0 records. |
| TC_MD_003 | Select Type options | Pass | |
| TC_MD_004 | Form title and button adapt to type | Pass | Title becomes "Add X Manually", buttons "Add X" and "Download X Template". |
| TC_MD_005 | Submit disabled initially | Pass | |
| TC_MD_006 | Name empty | Pass | |
| TC_MD_007 | Code empty | Pass | |
| TC_MD_008 | Whitespace-only fields | Pass | |
| TC_MD_009 | No type selected | Pass | |
| TC_MD_010 | Add Role manually | Gated | Checks the record via the API and the count +1. Success-notification wording is captured, not asserted. |
| TC_MD_011 | Add Department and Campus | Gated | |
| TC_MD_012 | Code lowercase | Gated | Asserts "rejected or stored in upper case" (the sheet says "clarify"). |
| TC_MD_013 | Code with spaces | Gated | Asserts "rejected or trimmed". |
| TC_MD_014 | Code with special characters | Gated | **Likely deviation:** Add is enabled for `AUTO-SPECIAL@1`, so rejection can only come from the server. |
| TC_MD_015 | Code length 2 and 50 | Gated | |
| TC_MD_016 | Code length 1 and 51 | Gated | **Likely deviation:** the screen enforces no length limit (Add stays enabled at 51 characters). |
| TC_MD_017 | Name length 2 and 150 | Gated | |
| TC_MD_018 | Name length 1 and 151 | Gated | **Likely deviation:** Add stays enabled at 151 characters. |
| TC_MD_019 | Code `ROLE_01` | Gated | Skips itself if `ROLE_01` already exists. |
| TC_MD_020 | Duplicate code, same type | Gated | Uses an existing department code. Error wording ("Code already exists in master records") is captured, not asserted. |
| TC_MD_021 | Same code, different type | Gated | |
| TC_MD_022 | Duplicate name, different code | Gated | Records whether it is accepted (the sheet says "behaviour per business rule"). |
| TC_MD_023 | Download Template | **Deviation** | App returns `department-template.csv` (per type) containing only `name,code`. Sheet expects `master_data_template.csv` with headers `Name, Code` and sample rows. |
| TC_MD_024 | Upload valid .csv | Pass | File name shown, Upload enabled (not clicked). |
| TC_MD_025 | Upload valid .xlsx | Pass | Selection only. |
| TC_MD_026 | Upload .pdf | Pass | Rejected: file not selected, Upload disabled. |
| TC_MD_026 (wording) | Rejection message | **Deviation** | App says "Only .csv and .xlsx are allowed". Sheet expects "Invalid file format. Please upload .csv or .xlsx under 10MB". |
| TC_MD_027 | Upload .txt / .xls / .exe | Pass | All three rejected on selection (3 cases). |
| TC_MD_028 | File 15 MB | Gated | **Likely deviation:** the screen accepts a 15 MB file on selection (Upload enabled); only the server could reject it. |
| TC_MD_029 | File exactly 10 MB | Pass | Accepted on selection. Full upload not run. |
| TC_MD_030 | Missing header Name/Code | Gated | |
| TC_MD_031 | Swapped or extra columns | Gated | |
| TC_MD_032 | Empty file | Gated | **Note:** the screen accepts an empty file on selection. |
| TC_MD_033 | Upload without a file | Pass | Upload is disabled. |
| TC_MD_034 | 10 rows: 8 valid, 1 duplicate, 1 missing name | Gated | Expects Total 10, Success 8, Failed 2, Duplicates 1, Invalid 1. |
| TC_MD_035 | 50 rows summary | Gated | Expects Total 50, Success 45, Failed 5, Duplicates 3, Invalid 2. Adds 45 records. |
| TC_MD_036 | Duplicates skipped without rollback | Gated | |
| TC_MD_037 | All rows invalid | Gated | |
| TC_MD_038 | Duplicate codes within one file | Gated | |
| TC_MD_039 | Upload applies to selected type | Gated | |
| TC_MD_040 | Reset clears upload and form | **Deviation** | Reset clears the file and the summary but **not** the Name and Code fields. |
| TC_MD_041 | Counter and pills update without refresh | Gated | |
| TC_MD_042 | New department in Policies dropdown | Blocked | Cross-module: needs the Create Policy screen mapped and a saved department. |
| TC_MD_043 | Non-admin access | Blocked | No Student or Employee test account. |

Totals: Pass 17 (counting each file type), Deviation 3, Gated 24, Blocked 3.

## Gap review of Jira IUN-3238 (story versus tests)

Second review, done against the Jira story itself (scope, BR-MD-01..04, validations, Scenarios 1-3 and the story's own five QA cases). New tests: `tests/e2e/IUN3238-MasterData/IUN3238-master-data.gap.spec.ts` (`GAP_MD_xxx`) and `tests/api/master-data.gap.api.spec.ts` (`GAP_MD_Axx`).

**ID clash to be aware of.** The story's own QA table uses `TC_MD_001..005` with different meanings from the sheet's `TC_MD_001..043` above (for example the story's `TC_MD_002` is "code auto-uppercasing", the sheet's `TC_MD_002` is "empty entity type"). In this document the story's cases are always written "Jira TC_MD_00x".

**How the screen was inspected.** Besides the live screen, the shipped JavaScript bundle was read to learn what the client does (request shapes, client-side checks). Findings from it are marked "(client code)".

**Rules used for "Total / Success / Failed / Duplicates / Invalid".** The story's example is `Total 10 = Success 7 + Failed 3` and `Failed 3 = Duplicates 2 + Invalid 1`. A formula of the form "Total = Success + Failed + Duplicates + Invalid" would give 13, so the tests use the story's example: **Total = Success + Failed, Failed = Duplicates + Invalid**. Confirm with the product owner.

**Status key for this section.** Covered = an existing test already checks it. Partial = checked only in part. New = added by this review (default run, nothing saved). New-mock = new, answered by a hand-built server reply, so it proves what the screen does with an answer. New-gated = new, real write, needs `ALLOW_MASTER_DATA_WRITES=true`, **not run**. Deviation = expected failure (`test.fail`), the app differs from the story.

| Story item | Requirement | Before | Now |
|---|---|---|---|
| Scope 1 | Inventory pills, counts, Name and (CODE) | Covered (MD-010..014, TC_MD_001) | Plus GAP_MD_074 (HTML in names is shown as text), GAP_MD_080/081 (counts versus Policies) |
| Scope 1 | Empty entity type (sheet TC_MD_002) | Blocked | **Deviation** GAP_MD_070: a type with no records shows no section at all (seen with a mocked list). GAP_MD_071 no records at all, GAP_MD_072/073 list call fails |
| Scope 2 | Select Type offers three choices | Covered | |
| Scope 3 | Form retitles with the type | Covered (TC_MD_004) | GAP_MD_020 name, code and file are kept after switching type; GAP_MD_021 the new type is used by Add and Upload |
| Scope 4 | Download Template, columns Name, Code | Partial (MD-040, TC_MD_023 deviation) | GAP_MD_060 one header line per type plus "template downloaded" message; **Deviation** GAP_MD_061 header case (`name,code` versus `Name, Code`); GAP_MD_062 round trip; GAP_MD_A07..A11 template endpoint contract |
| Scope 5 | .csv and .xlsx up to 10 MB, file status, Upload CSV | Partial (selection only; 10 MB only on selection) | GAP_MD_030..039 (extensions, upper case, replace file, size boundaries, wording), GAP_MD_040/041 (what is sent for ten edge files and for real .xlsx), GAP_MD_042 (one request on double click), GAP_MD_024 (Upload needs a type). **Deviations** GAP_MD_036/037/039 (see below) |
| Scope 6 | Validation Summary | Partial (zero state only; real arithmetic gated) | GAP_MD_050..053, 055..057 (screen rendering with mocked answers); gated G06, G07, G13 (real arithmetic) |
| Scope 7 | Reset clears upload pipeline and form | Partial (TC_MD_040 deviation, Reset of an empty summary) | GAP_MD_022 Reset of a filled summary, error list and file; GAP_MD_023 Remove File |
| BR-MD-01 | Code upper-cased and trimmed on input/blur | Gated, weak ("rejected or upper case") | **Deviation** GAP_MD_001, GAP_MD_002 (field), GAP_MD_006 (request); GAP_MD_005 (request is trimmed); gated G05 (stored upper case) |
| BR-MD-01 | Format `^[A-Z0-9_]{2,50}$`, special characters rejected | Gated only (TC_MD_014/016) | **Deviation** GAP_MD_003 (six code cases); GAP_MD_004 (valid boundaries); GAP_MD_A02 (**existing data breaks the rule**); GAP_MD_A03; gated G13 |
| BR-MD-02 | Name and code unique, case-insensitive | Gated, code only (TC_MD_020/022) | New-gated G01..G04, G07; New GAP_MD_A04 (existing data has no case-insensitive duplicates) |
| BR-MD-03 | Non-fatal bulk ingestion | Gated (TC_MD_034..038) | Gated G06, G07, G13; GAP_MD_050/052 (screen shows a failure list) |
| BR-MD-04 | Count and pill update without reload | Gated (TC_MD_041) | **New-mock** GAP_MD_011 (add) and GAP_MD_057 (upload): the list is refetched and count and pill change; no real record is needed |
| Validation 1 | Add disabled until Name 2-150 and Code 2-50 valid | Partial (empty and whitespace only) | **Deviation** GAP_MD_003 (code 1 and 51, name 1 and 151, characters); GAP_MD_004 |
| Validation 2 | Duplicate message "Entity Name or Code already exists in this category." | Not asserted (wording only "captured") | GAP_MD_008 (screen shows the server's message, mocked); gated G01/G02 (real wording) |
| Validation 3 | File error message "Invalid file. Accepted formats: .csv, .xlsx (Max 10MB)." | Covered for the sheet's wording only | **Deviation** GAP_MD_032 (pdf), GAP_MD_039 (over 10 MB); GAP_MD_038 (over 10 MB is not sent) |
| Validation 4 | Header error "Invalid template structure. Required headers: Name, Code." | Gated, no wording (TC_MD_030/031) | GAP_MD_054 (a server message reaches the user, mocked); GAP_MD_055 (generic text); gated G08 (real wording), G09 (empty, header only), G10 (BOM), G11 (lowercase header), G12 (real .xlsx) |
| Scenario 1 | lab_tech to LAB_TECH; existing name Administrator or code ADMINISTRATION_ROLE blocked | Not covered | GAP_MD_001/006 (**Deviation**), GAP_MD_008, gated G01..G05. On QA the Administrator role code is `ADMIN`, not `ADMINISTRATION_ROLE` |
| Scenario 2 | .pdf or > 10 MB rejected with the unified message | Partial (sheet wording) | GAP_MD_031/032/038/039 |
| Scenario 3 | 10 rows (7, 2, 1): Total 10, Success 7, Failed 3, Duplicates 2, Invalid 1 | Not covered (the sheet's 8/1/1 and 45/3/2 cases are gated) | GAP_MD_050 (rendering, mocked) and gated G06 (real server, exact numbers) |
| Jira TC_MD_001 | Inventory and dynamic form switch | Covered | GAP_MD_020 |
| Jira TC_MD_002 | Auto-uppercase, `@` rejected | Not covered | **Deviation** GAP_MD_001, GAP_MD_003 |
| Jira TC_MD_003 | Duplicate name / code blocked | Gated, partial | GAP_MD_008, gated G01..G04 |
| Jira TC_MD_004 | .pdf or > 10 MB: unified error | Partial | GAP_MD_032, GAP_MD_039 (**Deviation**), GAP_MD_038 |
| Jira TC_MD_005 | Mixed upload, summary, Reset to 0 | Partial (Reset of a zero summary) | GAP_MD_050, GAP_MD_022 (Reset of a filled summary), gated G06 |

### Findings from this review (what the app does versus the story)

| # | Story or sheet says | App does | Severity guess | How it was seen |
|---|---|---|---|---|
| G-1 | BR-MD-01 / Scenario 1: code is converted to UPPER CASE and trimmed on input or blur | The field keeps `lab_tech` and the spaces. The request trims name and code but sends the case as typed (`code=lab_tech`). Only a phone keyboard hint (`autoCapitalize`) exists | Medium (the server may normalise; gated G05 tells) | Live screen and request (GAP_MD_001, 002, 006) |
| G-2 | Add is disabled until Name is 2-150 and Code 2-50 valid, special characters rejected | Add is enabled for 1 and 51 character codes, 1 and 151 character names, `@`, `-`, spaces, accented letters. No message on screen | Medium | Live screen (GAP_MD_003) |
| G-3 | Files up to 10 MB are accepted | The picker says "Max 10MB", but the Upload click refuses anything over 5 MB with "File size must be under 5 MB" and sends nothing. A 6 MB file and a file of exactly 10 MB cannot be uploaded | High (valid files cannot be uploaded) | Live screen with request capture (GAP_MD_036, 037) and client code |
| G-4 | A file over 10 MB shows "Invalid file. Accepted formats: .csv, .xlsx (Max 10MB)." | It is accepted when chosen and the text "File size must be under 5 MB" appears only after clicking Upload. A .pdf shows "Only .csv and .xlsx are allowed". Three different wordings now exist (story, sheet, app) | Low to medium | Live screen (GAP_MD_032, 039) |
| G-5 | Sheet TC_MD_002: an entity type with no records shows count 0 and an empty message | The whole section disappears | Low | **Mocked list only** (GAP_MD_070) |
| G-6 | Not in the story: behaviour when the list call fails | The page is silently empty; no error, no retry | Medium | **Mocked 500 only** (GAP_MD_073) |
| G-7 | Not in the story | After a failed upload the counters of the previous successful upload stay on screen | Low | **Mocked answers only** (GAP_MD_056) |
| G-8 | BR-MD-01: codes are 2-50 characters of A-Z 0-9 _ | Two existing departments have 59 character codes (`DEPARTMENT_OF_ELECTRONICS_AND_TELECOMMUNICATION_ENGINEERING`, `DEPARTMENT_OF_ARTIFICIAL_INTELLIGENCE_AND_DATA_SCIENCE`). Campus codes top out at 40 characters (see MD-017, possibly truncated) | Low to medium (legacy data) | Live API (GAP_MD_A02) |
| G-9 | n/a | A failure is announced twice (the screen's own snackbar and a global toast, for example "Failed to add" and "Server error. Please try again shortly."). When 50 or more errors exist the text says "download the error report" although this screen has no download | Low | Mocked answers (GAP_MD_008, 009, 052) |
| G-10 | Template headers "Name, Code" | Template is `name,code` (already raised as TC_MD_023). The error text names "Name, Code" while the app's own template is lowercase: whether header matching is case-insensitive is unknown | Low | Live API (GAP_MD_A07), gated G11 |

Passing results worth knowing: the Policies department filter and the Create Policy pills list exactly the Master Data departments (GAP_MD_080/081, compared by name and by count); the add request encodes special characters safely (GAP_MD_007); a double click sends one request (GAP_MD_010, 042); extension checks are case-insensitive (`UPPER.CSV`, `Data.XLSX` accepted; `a.csv.pdf`, `noextension`, `.xlsm`, `.tsv`, `.json` rejected); the list endpoint refuses an invalid token and the template endpoint refuses no token (GAP_MD_A06, A11); the same code may exist in two types (4 department/campus pairs exist on QA, which matches sheet TC_MD_021).

### Not automated in this review

| Item | Reason |
|---|---|
| Real server wording and behaviour for duplicates, headers, empty and header-only files, BOM, real .xlsx, Scenario 3 numbers, case-insensitive duplicates | Needs a real upload or add. Written as gated tests G01..G13, **not run**. The file bytes of an upload are not visible to request interception (Chromium streams the file part), so content-level checks can only be made against the real server |
| `POST /admin/master-data/add` and `/bulk-upload` called without a token or with a Student or Employee token | Would create data if the endpoint were unprotected. Also no Student or Employee account (same as MD-003, MD-A05, TC_MD_043) |
| Maximum number of rows, very large files (over 100 MB), UTF-16 or legacy code page CSV, .xlsx with several sheets, formulas or date cells | The story defines no row limit or encoding rules, and each case would need a real upload. Ask the product owner for the limits first |
| Two admins adding the same code at the same time | Needs two sessions and real writes |
| Roles and Campuses used on other screens | Only the Policies screen (departments) was checked; no other consumer of campuses or roles was looked for. Bulk Upload Users probably validates department and role values, but proving it needs a real upload |
| Keyboard and screen reader use of the type dropdown (OBS-1, OBS-6) | Needs a manual check |

## Open questions for the sheet owner

1. **Counts (TC_MD_001):** are 57 / 26 / 3 from a different environment? The tests do not hard-code counts.
2. **Template (TC_MD_023):** which is correct, the sheet or the app? File name, header case, and whether sample rows are expected.
3. **Wrong-file message (TC_MD_026):** which wording is correct?
4. **Reset (TC_MD_040):** should Reset also clear Name and Code (the sheet says yes)?
5. **Validation rules (TC_MD_012 to 018):** the screen applies none. Is the server expected to enforce the code format (A-Z, 0-9, _), code length 2 to 50 and name length 2 to 150? If neither side enforces them, those cases will fail and become defects.
6. **File size (TC_MD_028):** the screen does not block a 15 MB file on selection. Is the error expected only after clicking Upload?
7. **TC_MD_020 precondition:** the sheet uses code `ADMINISTRATION`, which is not a department code on QA. The test uses an existing department code instead.

## Observations while automating

| # | Observation |
|---|---|
| OBS-1 | The type dropdown options sit under an overlay wrapper; ordinary clicks are refused by Playwright's safety check. Automation clicks the position (`UiActions.clickThrough`). Check it also works by keyboard and screen reader. |
| OBS-2 | Name and Code inputs have no accessible name (tracked as MD-025). |
| OBS-5 | There is no edit or delete, so saved test data cannot be removed from the UI. |
| OBS-6 | After a type is chosen, reopening the dropdown did not show its options in automation, even after several retries. Needs a manual check on a real browser to see whether users can switch type without reloading. |

## Running

```powershell
npm run test:qa -- tests/e2e/master-data                         # safe cases (nothing is saved)
$env:ALLOW_MASTER_DATA_WRITES = 'true'; npm run test:qa -- tests/e2e/master-data --grep "@writes"   # saves data
```
Use the gated run only on an environment you are allowed to fill. Test data is prefixed `AUTO_` / `AUTO ` and cannot be deleted from the UI.
