# Test cases: Admin > Master Data

**Module:** Manage Master Data (`/master-data`), admin only
**Environments:** QA and Staging (`https://app-test.k.indiraiscm.com`)
**Role:** ADMIN
**API used by the screen:** `GET /myindiranew/api/admin/master-data/list`, `GET /myindiranew/api/admin/master-data/template/{TYPE}`

## What the screen contains

1. **Lists:** Departments (64 on QA), Campuses (32), Roles (3). Each item is a chip: `Name (CODE)`.
2. **Select Type** dropdown: Department, Campus, Role. Choosing one retitles the form ("Add Department Manually") and the buttons ("Add Department", "Download Department Template").
3. **Add Record Manually:** Name *, Code *, Add button (disabled until valid).
4. **Or Upload via CSV:** Download Template, file chooser (.csv, .xlsx, max 10 MB), Upload CSV (disabled until a file is chosen), Reset, and a Validation Summary (Total, Success, Failed, Duplicates, Invalid).

Note: the screen has **no edit or delete**. Anything saved stays, so write tests are opt-in.

**Legend.** Auto = automated and passing. Gated = automated but only runs with `ALLOW_MASTER_DATA_WRITES=true`. Manual = needs a person or an account we do not have. Defect = known issue.

---

## A. Access and navigation

| ID | Title | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| MD-001 | Admin opens Master Data from the menu | Sign in as admin, open Dashboard, click **Master Data** in the left menu | URL is `/master-data`, title "Manage Master Data" and the lists are visible | High | Auto |
| MD-002 | Visitor without a session cannot open Master Data | Open `/master-data` with no session | The "Sign in with Microsoft" screen is shown, no data | High | Auto |
| MD-003 | Non-admin cannot open Master Data | Sign in as Employee, then as Student; open `/master-data` and call the list API | Access denied or redirect; API returns 401/403 | High | Manual (no Employee/Student test account) |
| MD-004 | Session expiry on the page | Open Master Data, clear the token, reload | Returns to the sign-in screen | Medium | Manual |

## B. Lists

| ID | Title | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| MD-010 | Three lists with counts | Open Master Data | Departments, Campuses and Roles are shown, each with a count above 0 | High | Auto |
| MD-011 | Heading counts match items shown | Compare each "(N)" with the chips under it | N equals the number of chips for all three lists | High | Auto |
| MD-012 | Roles are exactly three | Read the Roles list | Administrator (ADMIN), Employee (EMPLOYEE), Student (STUDENT) and nothing else | High | Auto |
| MD-013 | Codes are unique per list | Read all codes in each list | No code appears twice in the same list | High | Auto |
| MD-014 | Screen matches the API | Compare chips with `GET .../master-data/list` | Same set of codes in each list | High | Auto |
| MD-015 | Load time | Open the page | Lists render within 5 seconds | Medium | Auto |
| MD-016 | Long names and codes | Check the longest chips (for example "Master of Science in Computer Applicatio...") | Text is readable, not clipped or overlapping | Low | Manual |
| MD-017 | Code is cut off in one record | Look at `MASTER_OF_SCIENCE_IN_COMPUTER_APPLICATIO` | Code should read APPLICATION; it appears truncated (likely a stored 40-character limit) | Medium | Manual, possible defect |

## C. Add record (nothing is saved by these)

| ID | Title | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| MD-020 | Type options | Open the type dropdown | Department, Campus and Role are offered | High | Auto |
| MD-021 | Disabled before a type is chosen | Open the page, do not choose a type | Add and Download Template are disabled | High | Auto |
| MD-022 | Add needs type, name and code | Choose a type; fill only name; then only code | Add stays disabled each time | High | Auto |
| MD-023 | Add enables when complete | Choose a type, fill name and code | Add becomes enabled (do not click) | High | Auto |
| MD-024 | Whitespace-only values | Choose a type, enter spaces in name and code | Add stays disabled | Medium | Auto |
| MD-025 | Inputs have accessible names | Inspect Name and Code with a screen reader / accessibility tree | Each input has an accessible name | Medium | **Defect** (inputs are unlabeled; tracked as an expected failure) |
| MD-026 | Changing the type keeps or clears the form | Fill the form, then change the type | Behaviour is consistent and documented | Low | Manual |
| MD-027 | Special characters, very long values, leading/trailing spaces, lowercase codes | Try them in Name and Code | Clear validation or sensible normalisation; no server error | Medium | Manual (exploratory; would save data if accepted) |

## D. Save record (writes data, gated)

Run with `ALLOW_MASTER_DATA_WRITES=true`. Test data is prefixed `AUTO_` and cannot be deleted from the UI, so use only on an environment you are allowed to fill.

| ID | Title | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| MD-031 | Add a Department | Choose Department, enter unique name and code, click Add Department | Success feedback; record appears in the list; heading count is +1 | High | Gated |
| MD-032 | Add a Campus | Same, with Campus | Same | High | Gated |
| MD-033 | Add a Role | Same, with Role | Same | High | Gated |
| MD-034 | Duplicate code is rejected | Add a Department with the existing code `CSE` | Rejected with a clear message; list does not grow | High | Gated |
| MD-035 | Same code in a different type | Add a Campus using an existing Department code | Allowed or rejected per business rule; confirm with the product owner | Medium | Manual |
| MD-036 | New record is usable elsewhere | After MD-031, create a user or policy that selects the new department | The new value is offered | Medium | Manual |

## E. CSV / XLSX upload

| ID | Title | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| MD-040 | Sample template per type | Choose each type, click Download | File `department-template.csv` / `campus-template.csv` / `role-template.csv` with header `name,code` | High | Auto (3 cases) |
| MD-041 | Summary starts at zero | Open the page | Total 0, Success 0, Failed 0, Duplicates 0, Invalid 0 | Medium | Auto |
| MD-042 | Reset clears the file | Choose a file, click Reset | "No file selected" and summary back to zero | Medium | Auto |
| MD-043 | Upload CSV needs a file | Choose a type, observe Upload CSV, choose a file | Disabled first, enabled after choosing (do not click) | High | Auto |
| MD-044 | Valid file | Upload a CSV with new, valid rows | Summary shows Total = Success = rows; records appear | High | Manual (saves data) |
| MD-045 | Duplicate rows | Upload rows whose codes already exist | Duplicates counted, nothing duplicated | High | Manual (saves data) |
| MD-046 | Invalid rows | Upload a file with empty name or code | Invalid counted with a reason | High | Manual |
| MD-047 | Wrong file type | Choose a `.txt` or `.pdf` | Rejected with a clear message | Medium | Manual |
| MD-048 | File over 10 MB | Choose an 11 MB file | Rejected with a size message | Medium | Manual |
| MD-049 | Empty file / header only | Upload a file with no rows | Clear message, no error | Medium | Manual |
| MD-04A | `.xlsx` upload | Upload a valid Excel file | Same result as CSV | Medium | Manual |

## F. API

| ID | Title | Expected | Status |
|---|---|---|---|
| MD-A01 | `GET /admin/master-data/list` returns the documented shape | 200; `success`, `data.departments`, `data.campuses`, `data.roles`; items have `id`, `code`, `name` | Auto |
| MD-A02 | Codes and ids are unique in each list | No duplicates | Auto |
| MD-A03 | Role codes | ADMIN, EMPLOYEE, STUDENT | Auto |
| MD-A04 | No credentials | 401 or 403 | Auto |
| MD-A05 | Employee/Student token | 403 | Manual (no account) |

## G. Mobile, tablet and PWA

| ID | Title | Expected | Status |
|---|---|---|---|
| MD-050 | Layout on phones | No horizontal scroll; the form is reachable (Pixel 7 and iPhone 14 profiles) | Auto |
| MD-051 | Reaching Master Data on a phone | The side menu becomes a bottom tab bar; Master Data is expected under "More" | Manual |
| MD-052 | Type dropdown on a real touch device | Popup opens in view and options are tappable | Manual (real Android and iPhone) |
| MD-053 | Offline | Opening Master Data offline shows a clear offline message, not a blank page | Manual (the app has no service worker, see the framework report) |

---

## H. Gap review of Jira IUN-3238

A second review compared the story (scope, BR-MD-01..04, validations, Scenarios 1-3, QA cases TC_MD_001..005) with all existing tests. Full item-by-item table, findings and open questions: `master-data-traceability.md`, section "Gap review of Jira IUN-3238".

**New files.** `tests/e2e/IUN3238-MasterData/IUN3238-master-data.gap.spec.ts` (80 default tests plus 13 gated), `tests/api/master-data.gap.api.spec.ts` (13 tests, run with `--project=api`), helper `src/utils/helpers/master-data-files.helper.ts` (real minimal .xlsx, BOM CSV, raw files). Small additions: `MasterDataPage` (Remove File, toast, section heading, title-only wait) and `MasterDataApiClient.template()`.

**How the new tests stay safe.** Every click that writes runs behind `guardWrites` plus a local answer (`mockWrites`), and the test asserts the request the screen sent (method, path, query, multipart file name). Server answers (duplicate message, summary numbers, errors, empty or failing list) are hand-built, so those tests prove what the SCREEN does with an answer, not what the server says. Tests that need the real server are the gated group `GAP_MD_G01..G13` (`ALLOW_MASTER_DATA_WRITES=true`, **not run**).

| ID range | What it covers | Type |
|---|---|---|
| GAP_MD_001..004 | Code upper-casing and trimming, Add enabled only for valid Name (2-150) and Code (2-50, A-Z 0-9 _) | Default; 10 expected failures (deviations) |
| GAP_MD_005..011 | Add request (type, trimmed name and code, encoding), server error display, double click, BR-MD-04 live update | Default, mocked answers |
| GAP_MD_020..024 | Retained form state after a type switch, new type used by Add and Upload, Reset of a filled summary, Remove File, Upload needs a type | Default |
| GAP_MD_030..039 | Extensions (upper case, double extension, no extension), unified error message, replacing files, size boundaries 5, 6, 10 and 11 MB | Default; 4 expected failures |
| GAP_MD_040..042 | Ten edge-case files (empty, header only, wrong or swapped headers, semicolon, CRLF, quoted, BOM...) and real .xlsx forwarded as is; one request on double click | Default, mocked answers |
| GAP_MD_050..057 | Validation Summary rendering (Scenario 3 numbers, success, more than 20 errors, empty answer, failure, stale counters, list refetch) | Default, mocked answers |
| GAP_MD_060..062 | Template per type: message, one header line, header case, round trip | Default (reads only) |
| GAP_MD_070..074 | Empty list, no records, failing list, HTML in names | Default, mocked lists |
| GAP_MD_080..081 | Policies department filter and Create Policy pills versus Master Data (name and count) | Default (reads only) |
| GAP_MD_A01..A11 | List contract (exact fields), code rule, names, idempotent reads, invalid token, template endpoint | API, reads only; 1 expected failure |
| GAP_MD_G01..G13 | Real wording of duplicate and header errors, case-insensitive duplicates, Scenario 3 exact numbers, empty, BOM, real .xlsx, invalid values | Gated, not run |

**Expected failures (known deviations)**, details in the traceability doc: code not upper-cased or trimmed in the field or request (G-1), Add not blocked for invalid name or code (G-2), 5 MB limit enforced instead of 10 MB (G-3), unified file error message missing (G-4), empty section hidden (G-5, mocked), no error when the list fails (G-6, mocked), stale counters after a failed upload (G-7, mocked), two 59-character legacy department codes (G-8), template header case (G-10).

**Last run (QA).** Whole `tests/e2e/master-data` folder: 120 passed, 45 skipped (gated and blocked), 1 failed (`TC_MD_025`, an existing test: the type dropdown did not open under load, passed on re-run). The new e2e file was run in full once and its failing cases re-run after fixing the tests (all green), and the API file once. Runs take about 10 minutes because 10 expected-failure checks wait for a timeout and large files are generated.

---

## Observations from exploring the app

| # | Observation | Impact |
|---|---|---|
| OBS-1 | The type dropdown's options sit under an overlay wrapper, so ordinary clicks are refused by Playwright's safety check. The automation clicks the position instead (`UiActions.clickThrough`). Worth confirming it behaves for keyboard and screen-reader users. | Accessibility, testability |
| OBS-2 | Name and Code inputs have no label, `aria-label` or placeholder (MD-025). | Accessibility defect |
| OBS-3 | The popup moves while it opens; in one automated run clicking too early selected a different type than intended. Automation waits for it to settle and then checks the form title to prove the right type was selected. | Test stability |
| OBS-4 | One department code looks truncated (MD-017). | Data quality |
| OBS-5 | No edit or delete for existing records. | Data cleanup on shared environments is not possible from the UI |

## Running

```powershell
npm run test:qa -- tests/e2e/master-data tests/api/master-data.api.spec.ts        # everything that is safe
$env:ALLOW_MASTER_DATA_WRITES = 'true'; npm run test:qa -- --grep "@writes"        # saves data
npx playwright test tests/e2e/IUN3238-MasterData/IUN3238-master-data.mobile.spec.ts --project=mobile-chrome --project=mobile-safari
```
