# IUN-3238 Master Data Management (Departments, Campuses, Roles): test-case catalogue

- **Story:** IUN-3238 "Master Data Management (Departments, Campuses, Roles)"
- **Module:** Admin > Manage Master Data (`/master-data`), admin only
- **QA environment:** `https://app-test.k.indiraiscm.com`
- **Spec files (e2e):** `tests/e2e/IUN3238-MasterData/IUN3238-master-data.spec.ts` (MD-xxx), `IUN3238-master-data.tc.spec.ts` (team sheet TC_MD_001..043), `IUN3238-master-data.mobile.spec.ts` (MD-050), `IUN3238-master-data.gap.spec.ts` (GAP_MD_xxx and gated GAP_MD_G01..G13)
- **Spec files (API, `--project=api`):** `tests/api/master-data.api.spec.ts` (MD-A01..A04), `tests/api/master-data.gap.api.spec.ts` (GAP_MD_A01..A11)
- **Summary docs:** `docs/test-cases/master-data.md`, `docs/test-cases/master-data-traceability.md`
- **Date:** 2026-11-20
- **Last run (2026-11-20):** the e2e folder all passed (known defects are expected failures; one flaky type-dropdown case under load). API gap file passed (GAP_MD_A02 is an expected failure). Gated tests (`ALLOW_MASTER_DATA_WRITES=true`) were **not run**.

**Conventions**
- Default precondition: signed in as ADMIN, desktop window 1440x900, QA data (Departments 64, Campuses 32, Roles 3 at the time of writing). Nothing is saved unless the row says Gated.
- The title ID is used as the test case ID. The team's sheet ID `TC_MD_026` appears on two tests; the second (message wording) is written here as `TC_MD_026-W`. The story's own QA table also uses TC_MD_001..005 with different meanings; those are written "Jira TC_MD_00x" in the traceability doc.
- `test.fail(...)` tests are expected failures: they state the correct behaviour and pass the run while the app is wrong, then turn red when the app is fixed.
- Mocked API tests answer the add, upload or list call locally (hand-built server answer). They prove what the SCREEN does with an answer, not what the server says. Add and upload clicks are always behind a write guard.
- Loops are shown as one row per generated test, with the value in brackets.

**Type values:** Positive / Negative / Boundary / Known defect / Gated (real write, not run) / Mocked API (data situation simulated).
**Result values:** `Pass` (passed in the last full run), `Known defect (expected fail)` (test.fail), `Gated, not run` (skipped without `ALLOW_MASTER_DATA_WRITES=true`), `Skipped` (reason given).

## Story scenarios and business rules covered

| Story scenario / BR | Requirement | Test ids |
|---|---|---|
| Scope 1 | Inventory pills, counts, Name and (CODE) | MD-010..014, TC_MD_001, GAP_MD_074, GAP_MD_080, GAP_MD_081, MD-A01..A03, GAP_MD_A01 |
| Scope 1 (sheet TC_MD_002) | Entity type with no records shows 0 and empty message | TC_MD_002, GAP_MD_070, GAP_MD_071, GAP_MD_072, GAP_MD_073 |
| Scope 2 | Select Type offers three choices | MD-020, TC_MD_003 |
| Scope 3 | Form retitles with the type | TC_MD_004, GAP_MD_020, GAP_MD_021 |
| Scope 4 | Download Template, columns Name, Code | MD-040 (x3), TC_MD_023, GAP_MD_060 (x3), GAP_MD_061, GAP_MD_062, GAP_MD_A07..A11 |
| Scope 5 | .csv and .xlsx up to 10 MB, file status, Upload CSV | MD-043, TC_MD_024..029, TC_MD_033, GAP_MD_024, GAP_MD_030..042 |
| Scope 6 | Validation Summary | MD-041, GAP_MD_050..053, GAP_MD_055, GAP_MD_056, GAP_MD_057, gated TC_MD_034, 035, GAP_MD_G06, G07, G13 |
| Scope 7 | Reset clears upload pipeline and form | MD-042, TC_MD_040, GAP_MD_022, GAP_MD_023 |
| BR-MD-01 | Code upper-cased and trimmed on input/blur | GAP_MD_001, GAP_MD_002, GAP_MD_005, GAP_MD_006, gated TC_MD_012, TC_MD_013, GAP_MD_G05 |
| BR-MD-01 | Format `^[A-Z0-9_]{2,50}$`, special characters rejected | GAP_MD_003 (x8), GAP_MD_004 (x3), GAP_MD_A02, GAP_MD_A03, gated TC_MD_014..019, GAP_MD_G13 |
| BR-MD-02 | Name and code unique, case-insensitive | GAP_MD_A04, gated TC_MD_020..022, MD-033, GAP_MD_G01..G04, G07 |
| BR-MD-03 | Non-fatal bulk ingestion | gated TC_MD_034..038, GAP_MD_G06, G07, G13; GAP_MD_050, GAP_MD_052 (screen shows failure list) |
| BR-MD-04 | Count and pills update without reload | GAP_MD_011 (add, mocked), GAP_MD_057 (upload, mocked), gated TC_MD_041 |
| Validation 1 | Add disabled until Name 2-150 and Code 2-50 valid | MD-022..024, TC_MD_005..009, GAP_MD_003, GAP_MD_004 |
| Validation 2 | Duplicate message "Entity Name or Code already exists in this category." | GAP_MD_008 (mocked), gated GAP_MD_G01, G02 |
| Validation 3 | File error "Invalid file. Accepted formats: .csv, .xlsx (Max 10MB)." | TC_MD_026-W, GAP_MD_031, GAP_MD_032, GAP_MD_038, GAP_MD_039 |
| Validation 4 | Header error "Invalid template structure. Required headers: Name, Code." | GAP_MD_054 (mocked), GAP_MD_055, gated TC_MD_030, 031, GAP_MD_G08..G12 |
| Scenario 1 | lab_tech to LAB_TECH; existing name or code blocked | GAP_MD_001, GAP_MD_006, GAP_MD_008, gated GAP_MD_G01..G05 |
| Scenario 2 | .pdf or over 10 MB rejected with the unified message | GAP_MD_031, GAP_MD_032, GAP_MD_035..039 |
| Scenario 3 | 10 rows (7 valid, 2 duplicates, 1 invalid): Total 10, Success 7, Failed 3, Duplicates 2, Invalid 1 | GAP_MD_050 (rendering, mocked), gated GAP_MD_G06 |
| Access | Admin only | MD-001, MD-002, MD-A04, GAP_MD_A06, GAP_MD_A11, TC_MD_043 (skipped, no Student account) |
| Cross-module | New department offered on Policies | GAP_MD_080, GAP_MD_081, TC_MD_042 (skipped) |
| Mobile | Layout on phones | MD-050 |

Columns below: `Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug`.

## A. Access and navigation

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| MD-001 | Admin opens Master Data from the side menu @smoke | Positive | ADMIN | 1. Open Dashboard.<br>2. Click Master Data in the side menu. | Master Data page is ready and the URL matches `/master-data`. | Pass | - |
| MD-002 | A visitor without a session cannot open Master Data | Negative | No session (plain page) | 1. Open `/master-data` with no login. | The "Sign in with Microsoft" screen is shown. | Pass | - |
| TC_MD_043 | A non-admin (Student) is denied access to /master-data | Negative | Needs a Student or Employee account (none available) | Test body only calls skip. | Non-admin is denied access (not checked). | Skipped (blocked: no Student or Employee test account) | - |

## B. Lists (inventory, empty and failing lists, cross-screen)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| MD-010 | Shows Departments, Campuses and Roles, each with a count | Positive | ADMIN | 1. Open Master Data.<br>2. Read the three sections. | Each heading count is greater than 0. | Pass | - |
| MD-011 | Every heading count equals the number of items shown | Positive | ADMIN | 1. Open Master Data.<br>2. Compare each heading count with the chips under it. | Items shown equals heading count for all three sections. | Pass | - |
| MD-012 | Roles contains exactly Administrator, Employee and Student | Positive | ADMIN | 1. Open Master Data.<br>2. Read Roles. | Roles are Administrator (ADMIN), Employee (EMPLOYEE), Student (STUDENT) and exactly 3 items. | Pass | - |
| MD-013 | Codes are unique within each list | Positive | ADMIN | 1. Open Master Data.<br>2. Collect codes per section. | No duplicate code inside a list. | Pass | - |
| MD-014 | The screen shows the same records the API returns | Positive | ADMIN; reads `GET /admin/master-data/list` | 1. Open Master Data and wait for the list call.<br>2. Call the list API.<br>3. Compare sorted codes per section. | Codes on screen equal codes from the API for Departments, Campuses and Roles. | Pass | - |
| MD-015 | The page is usable within 5 seconds | Positive | ADMIN | 1. Time opening the page and reading the sections. | Under 5 seconds. | Pass | - |
| TC_MD_001 | Inventory sections and counts | Positive | ADMIN | 1. Open Master Data.<br>2. Read sections. | Each count is above 0 and equals the pills shown (counts are not hard-coded; sheet says 57/26/3, QA shows 64/32/3). | Pass | - |
| TC_MD_002 | An entity with no records shows a count of 0 and an empty message | Negative | Needs a type with 0 records; none on QA | 1. Open Master Data.<br>2. Find sections with count 0.<br>3. Skip if none. | Any section with count 0 shows no items. | Skipped (every list has records on this environment) | - |
| GAP_MD_070 | An entity type with no records shows "(0)" and an empty message (TC_MD_002) | Known defect | Mocked list: no departments, 1 campus, 1 role | 1. Mock the list answer.<br>2. Open `/master-data`.<br>3. Look for "Departments (0)". | "Departments (0)" is shown (with an empty message). Actual (defect): sections with no records are not rendered at all (no heading, no count 0, no message). | Known defect (expected fail) | IUN-3383 |
| GAP_MD_071 | With no records at all the page still opens with the form | Mocked API | Mocked list: all three empty | 1. Mock an empty list.<br>2. Open `/master-data`, scroll to the form. | The type dropdown is visible and no Departments heading exists. | Pass | - |
| GAP_MD_072 | When the list call fails the page does not crash and shows no invented counts | Mocked API | Mocked list call returns 500 | 1. Mock a 500 on the list call.<br>2. Open `/master-data`, scroll to the form. | No Departments heading and no uncaught page errors. | Pass | - |
| GAP_MD_073 | When the list call fails an error message is shown | Known defect | Mocked list call returns 500 | 1. Mock a 500 on the list call.<br>2. Open `/master-data`.<br>3. Look for an error or retry text. | An error or retry message is shown. Actual (defect): the screen is silently empty; no error or retry is offered. | Known defect (expected fail) | IUN-3385 |
| GAP_MD_074 | Names with HTML and brackets are shown as text (no injection) and keep their code | Mocked API | Mocked list with a name containing an img tag and a name "R&D (Labs)" | 1. Mock the list.<br>2. Open `/master-data`.<br>3. Check the page for an injected image and script flag. | Heading "Departments (2)", no img element, no script run; texts shown as `<img ...> Dept (XSS_TEST)` and `R&D (Labs) (RND)`. | Pass | - |
| GAP_MD_080 | The Policies department filter offers exactly the Master Data departments | Positive | ADMIN; read only | 1. Read Master Data departments.<br>2. Open Policies and its department filter.<br>3. Scroll the flyout and collect options. | Filter options (without "All") equal the Master Data departments by count and by name. | Pass | - |
| GAP_MD_081 | The Create Policy department pills equal the Master Data departments | Positive | ADMIN; read only, modal not submitted | 1. Read Master Data departments.<br>2. Open Policies, open the Create Policy modal.<br>3. Read department pills. | Pill count and names equal the Master Data departments. | Pass | - |
| TC_MD_042 | A new department appears in the Policies "create policy" dropdown | Positive | Needs a saved (gated) department and a mapped Create Policy screen | Test body only calls skip. | New department is offered (not checked). | Skipped (cross-module case, needs gated data) | - |

## C. Add form state and field rules (nothing is saved)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| MD-020 | The type dropdown offers Department, Campus and Role | Positive | ADMIN | 1. Open Master Data, scroll to the form.<br>2. Open the type dropdown. | Options Department, Campus and Role are visible. | Pass | - |
| TC_MD_003 | Select Type offers Department, Campus and Role | Positive | ADMIN | 1. Open the form.<br>2. Open the dropdown. | The three options are visible. | Pass | - |
| MD-021 | Add and Download Template are disabled until a type is chosen | Positive | ADMIN | 1. Open the form without choosing a type. | Add and Download Template are disabled. | Pass | - |
| TC_MD_004 | Form title and button adapt to the chosen type | Positive | ADMIN; a fresh page per type | For each of Department, Campus, Role: 1. Open the form and choose the type.<br>2. Check title, Add button and Download button. | Title "Add X Manually", button "Add X" and "Download X Template" are visible. | Pass | - |
| TC_MD_005 | Add is disabled initially | Positive | ADMIN | 1. Open the form. | Add is disabled. | Pass | - |
| MD-022 | Add stays disabled while the type, name or code is missing | Negative | ADMIN | 1. Choose Department: Add disabled.<br>2. Fill name only: disabled.<br>3. Clear, fill code only: disabled. | Add is disabled in each case. | Pass | - |
| TC_MD_006 | Name empty (code only): Add disabled | Negative | ADMIN, type Role | 1. Choose Role.<br>2. Fill code `LAB_TECH`. | Add is disabled. | Pass | - |
| TC_MD_007 | Code empty (name only): Add disabled | Negative | ADMIN, type Role | 1. Choose Role.<br>2. Fill name `Lab Technician`. | Add is disabled. | Pass | - |
| TC_MD_008 | Whitespace-only fields: Add disabled | Negative | ADMIN, type Role | 1. Choose Role.<br>2. Fill name and code with spaces. | Add is disabled. | Pass | - |
| TC_MD_009 | No type selected: Add disabled even with name and code | Negative | ADMIN | 1. Fill name and code, no type. | Add is disabled. | Pass | - |
| MD-023 | Add becomes enabled once type, name and code are filled | Positive | ADMIN | 1. Choose Campus.<br>2. Fill name and code (not clicked). | Add is enabled. | Pass | - |
| MD-024 | Whitespace-only name and code do not enable Add | Negative | ADMIN | 1. Choose Department.<br>2. Fill name and code with spaces. | Add is disabled. | Pass | - |
| MD-025 | Name and Code inputs have accessible names @a11y | Known defect | ADMIN | 1. Open the form.<br>2. Look for textboxes named "Name" and "Code" in the accessibility tree. | One textbox named Name and one named Code. Actual (defect): the inputs have no label, aria-label or placeholder, so screen readers cannot announce them. | Known defect (expected fail) | none raised (pre-existing deviation, see master-data-traceability.md) |
| GAP_MD_001 | A lowercase code is converted to UPPERCASE on input/blur (Scenario 1, Jira TC_MD_002) | Known defect | ADMIN, type Role | 1. Type `lab_tech` in Code.<br>2. Press Tab. | Code field shows `LAB_TECH` (BR-MD-01). Actual (defect): the screen keeps `lab_tech` (autoCapitalize only affects phone keyboards). | Known defect (expected fail) | IUN-3376 |
| GAP_MD_002 | Leading and trailing spaces in the code are trimmed on blur (BR-MD-01) | Known defect | ADMIN, type Role | 1. Type `  ACAD_HEAD  ` in Code.<br>2. Press Tab. | Code field shows `ACAD_HEAD`. Actual (defect): the field keeps the spaces (trimming happens only when the request is built). | Known defect (expected fail) | IUN-3376 |
| GAP_MD_003 [special character @ in the code] | Add stays disabled for special character @ in the code (Name `Valid Name`, Code `ACAD@HEAD`) | Known defect | ADMIN, type Role | 1. Fill name and code.<br>2. Check Add. | Add is disabled (Code must match `^[A-Z0-9_]{2,50}$`). Actual (defect): Add is enabled; the screen only checks "not empty". | Known defect (expected fail) | IUN-3378 |
| GAP_MD_003 [space inside code] | Add stays disabled for a space inside the code (`ACAD HEAD`) | Known defect | ADMIN, type Role | 1. Fill name and code.<br>2. Check Add. | Add is disabled. Actual (defect): Add is enabled. | Known defect (expected fail) | IUN-3378 |
| GAP_MD_003 [hyphen] | Add stays disabled for a hyphen in the code (`ACAD-HEAD`) | Known defect | ADMIN, type Role | 1. Fill name and code.<br>2. Check Add. | Add is disabled. Actual (defect): Add is enabled. | Known defect (expected fail) | IUN-3378 |
| GAP_MD_003 [non-ASCII] | Add stays disabled for a non-ASCII letter in the code (`ECOLE` with an accented first letter) | Known defect | ADMIN, type Role | 1. Fill name and code.<br>2. Check Add. | Add is disabled. Actual (defect): Add is enabled. | Known defect (expected fail) | IUN-3378 |
| GAP_MD_003 [code 1 char] | Add stays disabled for a code of 1 character (`Q`) | Known defect | ADMIN, type Role | 1. Fill name and code.<br>2. Check Add. | Add is disabled (code 2-50). Actual (defect): Add is enabled. | Known defect (expected fail) | IUN-3378 |
| GAP_MD_003 [code 51 chars] | Add stays disabled for a code of 51 characters | Known defect | ADMIN, type Role | 1. Fill name and a 51-character code.<br>2. Check Add. | Add is disabled. Actual (defect): Add is enabled. | Known defect (expected fail) | IUN-3378 |
| GAP_MD_003 [name 1 char] | Add stays disabled for a name of 1 character (`A`, code `VALID_CODE`) | Known defect | ADMIN, type Role | 1. Fill name and code.<br>2. Check Add. | Add is disabled (name 2-150). Actual (defect): Add is enabled. | Known defect (expected fail) | IUN-3378 |
| GAP_MD_003 [name 151 chars] | Add stays disabled for a name of 151 characters | Known defect | ADMIN, type Role | 1. Fill a 151-character name and code `VALID_CODE`.<br>2. Check Add. | Add is disabled. Actual (defect): Add is enabled. | Known defect (expected fail) | IUN-3378 |
| GAP_MD_004 [2 and 2] | Add is enabled for the shortest name and code (`Ab`, `AB`) | Boundary | ADMIN, type Role | 1. Fill name and code (not clicked). | Add is enabled. | Pass | - |
| GAP_MD_004 [150 and 50] | Add is enabled for the longest name and code (150 and 50 characters) | Boundary | ADMIN, type Role | 1. Fill 150-char name and 50-char code (not clicked). | Add is enabled. | Pass | - |
| GAP_MD_004 [digits and underscore] | Add is enabled for digits and underscore (`Role One`, `ROLE_01`) | Positive | ADMIN, type Role | 1. Fill name and code (not clicked). | Add is enabled. | Pass | - |
| GAP_MD_020 | Switching the type keeps Name, Code and the chosen file but retitles the form | Positive | ADMIN; generated `keep.csv` | 1. Choose Department, fill name `Keep this name` and code `KEEP_THIS`.<br>2. Choose file `keep.csv`.<br>3. Switch type to Campus. | Title, Add and Download buttons say Campus; name, code and file stay; Add is enabled. (Recorded behaviour, not defined by the story.) | Pass | - |
| GAP_MD_021 | After switching the type an upload and an add use the NEW type | Mocked API | ADMIN; add and upload answered locally | 1. Choose Department, fill name and code, choose a CSV.<br>2. Switch to Role.<br>3. Click Upload CSV, then Add. | Upload request is `POST /admin/master-data/bulk-upload?type=ROLE`; add request has `type=ROLE`. | Pass | - |
| GAP_MD_024 | Upload stays disabled when a file is chosen but no type is | Negative | ADMIN; generated `notype.csv` | 1. Choose a file without choosing a type. | File name shown; Upload is disabled. | Pass | - |

## D. Manual add: request and feedback (mocked answers, nothing saved)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| GAP_MD_005 [Department] | Adding a Department sends one POST with type, trimmed name and trimmed code | Mocked API | ADMIN; add answered locally (success) | 1. Choose Department.<br>2. Fill name `  Lab Technician  `, code `  LAB_TECH  `.<br>3. Click Add. | Toast "Department added successfully"; exactly one `POST /admin/master-data/add` with query `type=DEPARTMENT, name=Lab Technician, code=LAB_TECH`; form emptied and Add disabled. | Pass | - |
| GAP_MD_005 [Campus] | Adding a Campus sends one POST with type, trimmed name and trimmed code | Mocked API | As above | As above with Campus. | Toast "Campus added successfully"; one POST with `type=CAMPUS`, trimmed name and code; form emptied. | Pass | - |
| GAP_MD_005 [Role] | Adding a Role sends one POST with type, trimmed name and trimmed code | Mocked API | As above | As above with Role. | Toast "Role added successfully"; one POST with `type=ROLE`, trimmed name and code; form emptied. | Pass | - |
| GAP_MD_006 | A code typed in lowercase is sent in UPPERCASE (BR-MD-01, Scenario 1) | Known defect | Add answered locally | 1. Choose Role, fill name and code `lab_tech`.<br>2. Click Add.<br>3. Read the request query. | Request has `code=LAB_TECH`. Actual (defect): the screen sends the code as typed (`lab_tech`); only the server could normalise it. | Known defect (expected fail) | IUN-3376 |
| GAP_MD_007 | Special characters in the name cannot change the other parameters (query is encoded) | Mocked API | Add answered locally | 1. Choose Department.<br>2. Name `R&D / Ops + 100% &code=HACK&type=ROLE`, code `RND_OPS`.<br>3. Click Add. | Parsed query has the full name unchanged, `code=RND_OPS`, `type=DEPARTMENT`. | Pass | - |
| GAP_MD_008 | A duplicate rejected by the server shows the server message and keeps the form (Scenario 1) | Mocked API | Add answered with 400 and message "Entity Name or Code already exists in this category." | 1. Choose Role, name `Administrator`, code `ADMINISTRATION_ROLE`.<br>2. Click Add. | The server message is shown verbatim (appears twice: own snackbar plus global toast); name and code stay filled; no success toast. | Pass | IUN-3388 (two toasts observed) |
| GAP_MD_009 | A server error without a message shows a failure message and keeps the form | Mocked API | Add answered with 500 and empty body | 1. Choose Role, fill name and code.<br>2. Click Add. | Toasts "Failed to add" and "Server error. Please try again shortly." are shown (two toasts for one failure); no success toast; name stays filled. | Pass | IUN-3388 (two toasts observed) |
| GAP_MD_010 | A double click on Add sends only one request | Mocked API | Add answered locally after 1.5 s | 1. Choose Role, fill name and code.<br>2. Double-click Add. | Toast "Role added successfully"; exactly one add request. | Pass | - |
| GAP_MD_011 | BR-MD-04: after a successful add the list is refetched and the count and pill update without a reload | Mocked API | Hand-built lists: 2 departments, then 3 after the mocked add | 1. Open Master Data ("Departments (2)").<br>2. Choose Department, fill `Gamma New` / `GAMMA_NEW`, click Add. | Heading becomes "Departments (3)", pill "Gamma New (GAMMA_NEW)" shown, list was fetched again, 3 items. | Pass | - |

## E. Manual add with real writes (gated)

All rows in this section need `ALLOW_MASTER_DATA_WRITES=true`, create records that cannot be deleted from the UI, and were **not run**.

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| MD-03x [Department] | A new Department is saved and appears in the list | Gated (real write, not run) | ADMIN; unique `AUTO_DEPARTMENT_<id>` code | 1. Read list count via API.<br>2. Choose Department, fill name and code, Add.<br>3. Reload and read sections. | Code appears in Departments and heading count is before + 1. | Gated, not run | - |
| MD-03x [Campus] | A new Campus is saved and appears in the list | Gated (real write, not run) | As above | As above with Campus. | Code in Campuses; count + 1. | Gated, not run | - |
| MD-03x [Role] | A new Role is saved and appears in the list | Gated (real write, not run) | As above | As above with Role. | Code in Roles; count + 1. | Gated, not run | - |
| MD-033 | A duplicate code is rejected and the list does not grow | Gated (real write, not run) | Existing department code `CSE` | 1. Choose Department, name `AUTO Duplicate Attempt`, code `CSE`, Add.<br>2. Read count via API. | Department count unchanged. | Gated, not run | - |
| TC_MD_010 | Add a Role manually | Gated (real write, not run) | Unique `AUTO_LAB_TECH_<id>` | 1. Choose Role, fill, submit (captures feedback).<br>2. Compare lists via API. | Request sent; exactly the new code created; count + 1. Success wording captured, not asserted. | Gated, not run | - |
| TC_MD_011 | Add a Department and a Campus manually | Gated (real write, not run) | Unique codes | For Department then Campus: 1. Fill and submit. | Exactly the new code is created for each. | Gated, not run | - |
| TC_MD_012 | Lowercase code is rejected or stored in upper case | Gated (real write, not run) | Lowercase code `auto_lower_<id>` | 1. Choose Role, fill, submit. | Any created code equals its upper-case form. | Gated, not run | none raised (pre-existing deviation, see master-data-traceability.md) |
| TC_MD_013 | Code with spaces is rejected or trimmed | Gated (real write, not run) | Code `AUTO SPACE <id>` | 1. Choose Role, fill, submit. | Any stored code has no whitespace. | Gated, not run | - |
| TC_MD_014 | Code with special characters is rejected (only A-Z, 0-9, _) | Gated (real write, not run) | Code `AUTO-SPECIAL@<id>` | 1. Choose Role, fill, submit. | Nothing is saved. (Likely deviation: Add is enabled, so only the server can reject.) | Gated, not run | IUN-3378 |
| TC_MD_015 | Code lengths 2 and 50 are accepted | Gated (real write, not run) | Codes of 2 and 50 characters | 1. Add a Role with each code. | Each code is created. | Gated, not run | - |
| TC_MD_016 | Code lengths 1 and 51 are rejected | Gated (real write, not run) | Codes `Q` and 51 characters | 1. Add a Role with each code. | Nothing is saved for either. (Likely deviation: screen enforces no limit.) | Gated, not run | IUN-3378 |
| TC_MD_017 | Name lengths 2 and 150 are accepted | Gated (real write, not run) | Names `Ab` and 150 `N`s | 1. Add a Role for each name. | Each is created. | Gated, not run | - |
| TC_MD_018 | Name lengths 1 and 151 are rejected | Gated (real write, not run) | Names `A` and 151 `N`s | 1. Add a Role for each name. | Nothing is saved. (Likely deviation: Add stays enabled.) | Gated, not run | IUN-3378 |
| TC_MD_019 | Code with underscore and digits (ROLE_01) is accepted | Gated (real write, not run) | Skips itself if `ROLE_01` exists | 1. Add a Role with code `ROLE_01`. | `ROLE_01` is created. | Gated, not run | - |
| TC_MD_020 | Duplicate code in the same type is rejected | Gated (real write, not run) | First existing department code | 1. Add a Department with that code. | Nothing created; count unchanged. Error wording captured, not asserted. | Gated, not run | - |
| TC_MD_021 | The same code is allowed in a different type | Gated (real write, not run) | Existing department code not yet used by a Role | 1. Add a Role with the department's code. | The Role is created with that code. | Gated, not run | - |
| TC_MD_022 | Duplicate name with a different code: behaviour is recorded | Gated (real write, not run) | Existing department name, new code | 1. Add a Department with the existing name. | Records accepted or rejected (business rule to be confirmed); asserts only that the server status is below 500. | Gated, not run | - |
| TC_MD_041 | Count and pills update without a page refresh | Gated (real write, not run) | Unique `AUTO_LIVE_<id>` | 1. Read Roles count.<br>2. Add a Role.<br>3. Poll heading count (15 s). | Count becomes before + 1, pill `AUTO Live <id> (<code>)` visible, API contains the code. | Gated, not run | - |
| GAP_MD_G01 | Scenario 1: an existing Role NAME is blocked with the story message | Gated (real write, not run) | Name `Administrator`, new code | 1. Add the Role.<br>2. Capture feedback. | Feedback contains "Entity Name or Code already exists in this category."; nothing created. | Gated, not run | - |
| GAP_MD_G02 | Scenario 1: an existing Role CODE is blocked with the story message | Gated (real write, not run) | New name, code `ADMIN` | 1. Add the Role.<br>2. Capture feedback. | Same story message; nothing created. | Gated, not run | - |
| GAP_MD_G03 | BR-MD-02: duplicate names are matched case-insensitively and ignoring outer spaces | Gated (real write, not run) | Names `administrator`, `ADMINISTRATOR`, `  Administrator  ` | 1. Add a Role with each name and a new code. | Nothing is created for any variant. | Gated, not run | - |
| GAP_MD_G04 | BR-MD-02: a duplicate code typed in lowercase or with spaces is still a duplicate | Gated (real write, not run) | Codes `admin`, `  ADMIN  ` | 1. Add a Role with each code. | Nothing created. | Gated, not run | - |
| GAP_MD_G05 | BR-MD-01: a lowercase code with outer spaces is stored UPPERCASE and trimmed | Gated (real write, not run) | Code `  auto_gap_lower_<id>  ` | 1. Add a Role. | Stored code is `AUTO_GAP_LOWER_<ID>`. | Gated, not run | - |

## F. Download Template

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| MD-040 [Department] | The Department sample template is a CSV with name and code columns | Positive | ADMIN | 1. Choose Department.<br>2. Download the template. | File name `department-template.csv`; header (spaces removed, lower case) is `name,code`. | Pass | - |
| MD-040 [Campus] | The Campus sample template is a CSV with name and code columns | Positive | ADMIN | As above with Campus. | File `campus-template.csv`, header `name,code`. | Pass | - |
| MD-040 [Role] | The Role sample template is a CSV with name and code columns | Positive | ADMIN | As above with Role. | File `role-template.csv`, header `name,code`. | Pass | - |
| TC_MD_023 | Download Template returns master_data_template.csv with Name, Code and sample rows | Known defect | ADMIN, type Department | 1. Download the template.<br>2. Read name and lines. | Sheet: file `master_data_template.csv`, first line `Name,Code`, more than one line. Actual (defect): file `<type>-template.csv` with only lowercase `name,code`. | Known defect (expected fail) | none raised (pre-existing deviation, see master-data-traceability.md) |
| GAP_MD_060 [Department] | Downloading the Department template shows a confirmation and gives a CSV with exactly one header line | Positive | ADMIN | 1. Choose type.<br>2. Click Download (watch the toast).<br>3. Read the file. | Toast "Department template downloaded"; file ends in .csv; one line; header `name,code` (case ignored). | Pass | - |
| GAP_MD_060 [Campus] | Downloading the Campus template shows a confirmation and gives a CSV with exactly one header line | Positive | ADMIN | As above. | Toast "Campus template downloaded"; one header line. | Pass | - |
| GAP_MD_060 [Role] | Downloading the Role template shows a confirmation and gives a CSV with exactly one header line | Positive | ADMIN | As above. | Toast "Role template downloaded"; one header line. | Pass | - |
| GAP_MD_061 | The template header is written exactly as the story names it: Name, Code | Known defect | ADMIN, type Department | 1. Download the template.<br>2. Read the first line. | First line (spaces removed) is `Name,Code`. Actual (defect): app template is lowercase `name,code`. | Known defect (expected fail) | none raised (pre-existing deviation, see master-data-traceability.md) |
| GAP_MD_062 | The downloaded template can be chosen again as an upload file (round trip, nothing sent) | Mocked API | ADMIN; writes guarded | 1. Choose Role, download the template.<br>2. Save it as `role-template.csv` and choose it. | File is shown, Upload is enabled, no write request sent. | Pass | - |

## G. File selection rules (extension, size, replace, Reset, Remove File)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| MD-043 | Upload CSV is disabled until a file is chosen | Positive | ADMIN, type Department; `master-data-sample.csv` | 1. Check Upload disabled.<br>2. Choose the sample file (not uploaded). | Upload disabled first, then enabled. | Pass | - |
| TC_MD_033 | Upload is disabled when no file is chosen | Negative | ADMIN, type Department | 1. Check Upload. | Upload is disabled. | Pass | - |
| MD-041 | The validation summary starts at zero | Positive | ADMIN | 1. Open Master Data.<br>2. Read the summary. | Total 0, Success 0, Failed 0, Duplicates 0, Invalid 0. | Pass | - |
| MD-042 | Reset clears a chosen file | Positive | ADMIN, type Department | 1. Choose a sample file.<br>2. Click Reset. | "No file selected" shown again and summary at zero. | Pass | - |
| TC_MD_040 | Reset clears the file, the fields and the summary | Known defect | ADMIN; Name/Code filled; generated `valid.csv` | 1. Fill name and code, choose file.<br>2. Click Reset. | File, summary, Name and Code are all cleared. Actual (defect): Reset clears file and summary but leaves Name and Code filled. | Known defect (expected fail) | none raised (pre-existing deviation, see master-data-traceability.md) |
| TC_MD_024 | A valid .csv is accepted and Upload is enabled | Positive | Generated `valid.csv`, type Department | 1. Choose the file. | File name shown; Upload enabled (not clicked). | Pass | - |
| TC_MD_025 | A valid .xlsx is accepted | Positive | Generated placeholder `valid.xlsx` | 1. Choose the file. | File name shown; Upload enabled. | Pass | - |
| TC_MD_026 | A .pdf is rejected | Negative | Generated `document.pdf` | 1. Choose the file. | "No file selected" stays, Upload disabled, an invalid-file message is shown. | Pass | - |
| TC_MD_026-W | (message wording) The rejection message matches the sheet | Known defect | Generated `document.pdf` | 1. Choose the file.<br>2. Look for the sheet text. | Sheet: "Invalid file format. Please upload .csv or .xlsx under 10MB". Actual (defect): app shows "Only .csv and .xlsx are allowed" (three wordings exist: story, sheet, app). | Known defect (expected fail) | IUN-3381 |
| TC_MD_027 [notes.txt] | notes.txt is rejected | Negative | Generated file | 1. Choose the file. | No file selected, Upload disabled. | Pass | - |
| TC_MD_027 [legacy.xls] | legacy.xls is rejected | Negative | Generated file | 1. Choose the file. | No file selected, Upload disabled. | Pass | - |
| TC_MD_027 [program.exe] | program.exe is rejected | Negative | Generated file | 1. Choose the file. | No file selected, Upload disabled. | Pass | - |
| TC_MD_029 | A file of exactly 10 MB is accepted on selection | Boundary | Generated 10 MB `exactly-10mb.csv` | 1. Choose the file. | File shown and Upload enabled (upload itself not run; see GAP_MD_037). | Pass | - |
| GAP_MD_022 | Reset clears a filled Validation Summary, the error list and the file, but keeps the type (Jira TC_MD_005) | Mocked API | Upload answered with Total 10, Success 7, Failed 3, Duplicates 2, Invalid 1 and one row error | 1. Choose a CSV, click Upload.<br>2. See summary and row errors.<br>3. Click Reset. | "No file selected"; row error card hidden; summary all zero; Upload disabled; form title still "Department". | Pass | - |
| GAP_MD_023 | Remove File clears the file and disables Upload, but leaves an earlier summary on screen | Mocked API | Upload answered with Total 2 / Success 2 | 1. Choose a CSV, Upload.<br>2. Click Remove File. | No file selected, Upload disabled, summary total still 2 (recorded behaviour; Reset would clear it). | Pass | - |
| GAP_MD_030 [UPPER.CSV] | "UPPER.CSV" is accepted (extension check is case-insensitive) | Positive | Raw file with `name,code` | 1. Choose the file. | File shown and Upload enabled. | Pass | - |
| GAP_MD_030 [Data.XLSX] | "Data.XLSX" is accepted | Positive | Raw file | As above. | Accepted. | Pass | - |
| GAP_MD_030 [two.dots.csv] | "two.dots.csv" is accepted | Positive | Raw file | As above. | Accepted. | Pass | - |
| GAP_MD_030 [with space.csv] | "with space.csv" is accepted | Positive | Raw file | As above. | Accepted. | Pass | - |
| GAP_MD_030 [cafe.csv] | "caf" + accented e + ".csv" is accepted | Positive | Raw file | As above. | Accepted. | Pass | - |
| GAP_MD_031 [a.csv.pdf] | "a.csv.pdf" is rejected with a message and no file is selected | Negative | Raw file | 1. Choose the file. | Invalid-file message shown, no file selected, Upload disabled. | Pass | - |
| GAP_MD_031 [noextension] | "noextension" is rejected | Negative | Raw file | As above. | Rejected as above. | Pass | - |
| GAP_MD_031 [data.csv.exe] | "data.csv.exe" is rejected | Negative | Raw file | As above. | Rejected as above. | Pass | - |
| GAP_MD_031 [sheet.xlsm] | "sheet.xlsm" is rejected | Negative | Raw file | As above. | Rejected as above. | Pass | - |
| GAP_MD_031 [data.tsv] | "data.tsv" is rejected | Negative | Raw file | As above. | Rejected as above. | Pass | - |
| GAP_MD_031 [data.json] | "data.json" is rejected | Negative | Raw file | As above. | Rejected as above. | Pass | - |
| GAP_MD_032 | The rejection message is the unified story text (Scenario 2) | Known defect | Generated `document.pdf` | 1. Choose the file.<br>2. Wait up to 3 s for the toast. | Toast "Invalid file. Accepted formats: .csv, .xlsx (Max 10MB)." Actual (defect): story text not shown; app says "Only .csv and .xlsx are allowed". | Known defect (expected fail) | IUN-3381 |
| GAP_MD_033 | OBS: a rejected file does not clear an earlier valid choice | Positive | Generated `first.csv`, `second.pdf` | 1. Choose first.csv.<br>2. Choose second.pdf. | Error message shown, `first.csv` still selected, Upload enabled (recorded behaviour, not defined by the story). | Pass | - |
| GAP_MD_034 | Choosing a second valid file replaces the first | Positive | Generated `first.csv`, `second.csv` | 1. Choose both in turn. | `second.csv` shown, `first.csv` hidden. | Pass | - |
| GAP_MD_035 | A file of exactly 5 MB is sent to the server | Boundary | Generated 5 MB CSV; upload answered locally | 1. Choose the file, click Upload. | One `POST /admin/master-data/bulk-upload` is sent. | Pass | - |
| GAP_MD_036 | A 6 MB file (inside the documented 10 MB limit) is sent to the server | Known defect | Generated 6 MB CSV; upload answered locally | 1. Choose the file, click Upload. | Request sent (limit is 10 MB). Actual (defect): Upload refuses anything over 5 MB ("File size must be under 5 MB") and sends nothing. | Known defect (expected fail) | IUN-3380 |
| GAP_MD_037 | A file of exactly 10 MB is sent to the server (boundary) | Known defect | Generated 10 MB CSV; upload answered locally | 1. Choose the file, click Upload. | Request sent. Actual (defect): accepted on selection (TC_MD_029) but Upload refuses it as over 5 MB. | Known defect (expected fail) | IUN-3380 |
| GAP_MD_038 | A file over 10 MB never reaches the server (Scenario 2) | Negative | Generated 11 MB CSV; upload answered locally | 1. Choose the file, click Upload. | Toast matching "File size must be under"; no request sent. | Pass | - |
| GAP_MD_039 | A file over 10 MB shows the unified story message (Scenario 2) | Known defect | Generated 11 MB CSV | 1. Choose the file.<br>2. Wait for the toast. | On selection: toast "Invalid file. Accepted formats: .csv, .xlsx (Max 10MB)." and no file selected. Actual (defect): accepted on selection; "File size must be under 5 MB" only after Upload. | Known defect (expected fail) | IUN-3381 |

## H. Upload request and Validation Summary (mocked answers, nothing saved)

For GAP_MD_040 and GAP_MD_041 the upload is answered locally. Chromium streams the file part, so only the request line, query, content type and file name are asserted; the file content is verifiable only against the real server (gated GAP_MD_G08..G12).

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| GAP_MD_040 [empty file] | An empty file is sent as it is, in one multipart request | Mocked API | Type Department; `empty.csv` (0 bytes) | 1. Choose the file, click Upload. | One `POST /admin/master-data/bulk-upload?type=DEPARTMENT`, multipart, part `file` named `empty.csv`. | Pass | - |
| GAP_MD_040 [header-only] | A header-only file is sent as it is | Mocked API | `header-only.csv` (`Name,Code`) | As above. | One multipart POST with `filename="header-only.csv"`. | Pass | - |
| GAP_MD_040 [wrong headers] | A file with wrong headers is sent as it is | Mocked API | `wrong-header.csv` (`Foo,Bar`) | As above. | One multipart POST (no client-side header check). | Pass | - |
| GAP_MD_040 [swapped headers] | A file with swapped headers is sent as it is | Mocked API | `swapped.csv` (`Code,Name`) | As above. | One multipart POST. | Pass | - |
| GAP_MD_040 [lowercase header] | The app's own lowercase template header is sent as it is | Mocked API | `lower.csv` (`name,code`) | As above. | One multipart POST. | Pass | - |
| GAP_MD_040 [one column] | A file with only one column is sent as it is | Mocked API | `one-col.csv` | As above. | One multipart POST. | Pass | - |
| GAP_MD_040 [semicolon] | A semicolon-separated file is sent as it is | Mocked API | `semicolon.csv` | As above. | One multipart POST. | Pass | - |
| GAP_MD_040 [CRLF and blank lines] | A file with Windows line endings and blank lines is sent as it is | Mocked API | `crlf.csv` | As above. | One multipart POST. | Pass | - |
| GAP_MD_040 [quoted values] | A file with quoted values with commas and trailing spaces is sent as it is | Mocked API | `quoted.csv` | As above. | One multipart POST. | Pass | - |
| GAP_MD_040 [UTF-8 BOM] | A file with a UTF-8 byte-order mark is sent as it is | Mocked API | `bom.csv` | As above. | One multipart POST. | Pass | - |
| GAP_MD_041 [Department] | A real .xlsx for Department is sent with type=DEPARTMENT | Mocked API | Generated real `valid.xlsx` | 1. Choose Department, choose file, click Upload. | Query `type=DEPARTMENT`; body contains `filename="valid.xlsx"`. | Pass | - |
| GAP_MD_041 [Campus] | A real .xlsx for Campus is sent with type=CAMPUS | Mocked API | As above | As above. | Query `type=CAMPUS`. | Pass | - |
| GAP_MD_041 [Role] | A real .xlsx for Role is sent with type=ROLE | Mocked API | As above | As above. | Query `type=ROLE`. | Pass | - |
| GAP_MD_042 | Upload is blocked while a request is running (loading state) and a double click sends one request | Mocked API | Upload answered after 1.5 s | 1. Choose a CSV.<br>2. Double-click Upload. | Reset is disabled while uploading; toast "All records uploaded successfully"; one request; Reset enabled again. | Pass | - |
| GAP_MD_050 | Scenario 3: Total 10 / Success 7 / Failed 3 / Duplicates 2 / Invalid 1 is shown with the row errors | Mocked API | Answer: 10/7/3/2/1 and 3 row errors | 1. Choose a CSV, click Upload.<br>2. Read summary and errors. | Summary equals the answer and is consistent (Total = Success + Failed, Failed = Duplicates + Invalid); toast "Upload completed with errors"; error card and "Row 9 - code: Invalid characters" visible. | Pass | - |
| GAP_MD_051 | All rows succeed: success message, no error card | Mocked API | Answer: 3/3/0/0/0, type Role | 1. Upload a CSV. | Toast "All records uploaded successfully"; summary 3/3/0/0/0; error card hidden. | Pass | - |
| GAP_MD_052 | More than 20 errors: the first 20 rows are listed and the rest is summarised | Mocked API | Answer with 25 row errors | 1. Upload a CSV. | "Row 21 ..." visible, "Row 22 ..." hidden, text "+5 more errors..." shown (text points to a downloadable error report but the screen offers none). | Pass | IUN-3388 (report hint with no report) |
| GAP_MD_053 | An answer without counters shows zeros instead of breaking | Mocked API | Answer with empty `data` | 1. Upload a CSV. | Toast "All records uploaded successfully"; summary all zero. | Pass | - |
| GAP_MD_054 | The invalid-header rejection shows the story message (validations: Template Header Validation) | Mocked API | Upload answered 400 with "Invalid template structure. Required headers: Name, Code." | 1. Choose a file with headers Foo, Bar.<br>2. Click Upload. | The story message is visible in a toast (global error toast shows the server text). | Pass | - |
| GAP_MD_055 | A failed upload shows a failure message and leaves the counters at zero | Mocked API | Upload answered 500 | 1. Upload a CSV. | Toast "Upload failed. Please review file and retry."; summary zero; error card hidden. | Pass | - |
| GAP_MD_056 | A failed upload does not leave the previous file's counters on screen | Known defect | Mock: first upload succeeds with total 4, second returns 500 | 1. Upload `one.csv` (total 4).<br>2. Upload `two.csv` (fails). | After the failure the summary total is 0. Actual (defect): the previous summary stays displayed (stale counters). | Known defect (expected fail) | IUN-3386 |
| GAP_MD_057 | BR-MD-04: a successful upload refetches the list | Mocked API | Hand-built lists: 1 campus, then 2 after the mocked upload | 1. Open ("Campuses (1)").<br>2. Choose Campus, upload a CSV. | Heading becomes "Campuses (2)" and the list was fetched again. | Pass | - |

## I. Upload with real writes (gated)

All rows need `ALLOW_MASTER_DATA_WRITES=true`, save records that cannot be deleted, and were **not run**. Test data is prefixed `AUTO_`.

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_MD_028 | A 15 MB file is rejected with a size error | Gated (real write, not run) | Generated 15 MB CSV, Department | 1. Choose, Upload (captures feedback and status). | Nothing created; a size error is reported (status 400 or more, or a message). (Likely deviation: accepted on selection.) | Gated, not run | IUN-3381 |
| TC_MD_030 | A file without Name/Code headers is rejected | Gated (real write, not run) | CSV with headers Foo, Bar | 1. Upload. | Nothing created. | Gated, not run | - |
| TC_MD_031 | Swapped or extra columns are rejected as an invalid template | Gated (real write, not run) | CSV `Code,Name,Extra` | 1. Upload. | Nothing created. | Gated, not run | - |
| TC_MD_032 | An empty file is rejected and creates nothing | Gated (real write, not run) | Empty CSV | 1. Upload. | Nothing created. | Gated, not run | - |
| TC_MD_034 | 10 rows: 8 valid, 1 duplicate, 1 missing name | Gated (real write, not run) | CSV with 8 new rows, 1 existing code, 1 empty name | 1. Upload to Department. | Summary Total 10, Success 8, Failed 2, Duplicates 1, Invalid 1; 8 records created. | Gated, not run | - |
| TC_MD_035 | 50 rows: 45 new, 3 duplicates, 2 invalid | Gated (real write, not run) | CSV of 50 rows | 1. Upload to Department. | Summary Total 50, Success 45, Failed 5, Duplicates 3, Invalid 2; 45 created. | Gated, not run | - |
| TC_MD_036 | Duplicates are skipped and valid rows are kept (no rollback) | Gated (real write, not run) | 3 new rows plus 1 duplicate | 1. Upload. | 3 records created. | Gated, not run | - |
| TC_MD_037 | A file where every row is invalid adds nothing | Gated (real write, not run) | 3 invalid rows | 1. Upload. | Success 0; nothing created. | Gated, not run | - |
| TC_MD_038 | A code repeated inside the same file: the second occurrence is a duplicate | Gated (real write, not run) | Two rows with the same code | 1. Upload. | Only the code is created once; Duplicates = 1. | Gated, not run | - |
| TC_MD_039 | The upload applies to the selected type only | Gated (real write, not run) | 2 rows, type Campus | 1. Upload to Campus.<br>2. Read Departments. | 2 campuses created; Departments unchanged. | Gated, not run | - |
| GAP_MD_G06 | Scenario 3: 10 rows (7 valid, 2 duplicates, 1 invalid code) give Total 10 / Success 7 / Failed 3 / Duplicates 2 / Invalid 1 | Gated (real write, not run) | CSV: 7 new, 1 duplicate code, 1 duplicate name, 1 `BAD@CODE` | 1. Upload to Department. | Summary 10/7/3/2/1 and consistent; 7 created. | Gated, not run | - |
| GAP_MD_G07 | BR-MD-02: CSV duplicates are case-insensitive and ignore outer spaces (code, name) | Gated (real write, not run) | 3 rows duplicating existing code (lowercase), name (upper case), code (with spaces) | 1. Upload. | Nothing created; Duplicates = 3; summary consistent. | Gated, not run | - |
| GAP_MD_G08 | Validations: a file without Name, Code headers is rejected with the story message | Gated (real write, not run) | CSV headers Foo, Bar | 1. Upload; capture feedback. | Nothing created; feedback contains "Invalid template structure. Required headers: Name, Code." | Gated, not run | - |
| GAP_MD_G09 | An empty file and a header-only file add nothing and do not produce a server error | Gated (real write, not run) | `empty.csv`, `header-only.csv` | 1. Upload each. | Nothing created; feedback shows no 500 or internal server error. | Gated, not run | - |
| GAP_MD_G10 | A UTF-8 BOM CSV with one valid row is accepted | Gated (real write, not run) | BOM CSV, 1 row | 1. Upload to Department. | Success 1; the code is created. | Gated, not run | - |
| GAP_MD_G11 | The app's own lowercase template header (name,code) is accepted | Gated (real write, not run) | CSV `name,code` plus 1 row, Campus | 1. Upload. | Success 1; the code is created. | Gated, not run | - |
| GAP_MD_G12 | A real .xlsx with 2 valid rows is accepted like a CSV | Gated (real write, not run) | Real `valid.xlsx`, Campus | 1. Upload. | Summary 2/2/0/0/0; 2 created. | Gated, not run | - |
| GAP_MD_G13 | Validations: a code of 51 characters or with a space inside is counted as Invalid in a CSV | Gated (real write, not run) | 4 rows: 51-char code, code with spaces, 1-char code, 151-char name | 1. Upload to Department. | Nothing created; Invalid = 4; summary consistent. | Gated, not run | - |

## J. Mobile

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| MD-050 | Fits the screen and the form is reachable | Positive | ADMIN; mobile-chrome and mobile-safari projects only (skips elsewhere) | 1. Open Master Data.<br>2. Check for horizontal overflow.<br>3. Scroll to the form. | No horizontal overflow; type dropdown visible. Skipped on the desktop project (not mobile). The long-chip overflow seen in the manual mobile review is not covered by this test (see IUN-3403 below). | Pass (mobile projects; Skipped on desktop) | - |

## K. API (`--project=api`, read only)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| MD-A01 | GET /admin/master-data/list returns the documented shape | Positive | ADMIN token | 1. Call the list API.<br>2. Validate with the schema. | 200; `success` true; departments and campuses non-empty; exactly 3 roles. | Pass | - |
| MD-A02 | Codes are unique and ids are unique in every list | Positive | ADMIN token | 1. Call the list API.<br>2. Check codes and ids per list. | No duplicate codes or ids. | Pass | - |
| MD-A03 | Role codes are ADMIN, EMPLOYEE and STUDENT | Positive | ADMIN token | 1. Call the list API. | Sorted role codes `ADMIN, EMPLOYEE, STUDENT`. | Pass | - |
| MD-A04 | The list is not available without credentials | Negative | No credentials | 1. GET the list without auth. | 401 or 403. | Pass | - |
| GAP_MD_A01 | The list envelope and every item have exactly the documented fields | Positive | ADMIN token | 1. Call the list API.<br>2. Check keys and content type. | 200, JSON; keys `code, data, message, success, timestamp`; data keys `campuses, departments, roles`; items `code, id, name`. | Pass | - |
| GAP_MD_A02 | Stored codes follow the code rule (uppercase letters, digits, underscore, 2-50 characters) | Known defect | ADMIN token | 1. Call the list API.<br>2. Test every code against `^[A-Z0-9_]{2,50}$`. | No code outside the rule. Actual (defect): legacy data breaks it (two department codes are 59 characters, e.g. `DEPARTMENT_OF_ELECTRONICS_AND_TELECOMMUNICATION_ENGINEERING`; campus codes reach 40, see MD-017). | Known defect (expected fail) | IUN-3387 |
| GAP_MD_A03 | Stored codes are uppercase with no spaces (format part of BR-MD-01) | Positive | ADMIN token | 1. Call the list API.<br>2. Test codes against `^[A-Z0-9_]+$`. | No code with lowercase, spaces or symbols. | Pass | - |
| GAP_MD_A04 | Names are trimmed, 2-150 characters and unique ignoring case within each list (BR-MD-02) | Positive | ADMIN token | 1. Call the list API.<br>2. Check name trim and length, duplicate names and codes ignoring case. | All hold. | Pass | - |
| GAP_MD_A05 | Two reads return the same data (a GET does not change anything) | Positive | ADMIN token | 1. Call the list twice. | Identical data. | Pass | - |
| GAP_MD_A06 | The list is refused with an invalid token | Negative | Bearer `invalid.token.value` | 1. GET the list. | 401 or 403. | Pass | - |
| GAP_MD_A07 [DEPARTMENT] | template/DEPARTMENT is a CSV download with the header line only | Positive | ADMIN token | 1. GET `/template/DEPARTMENT`. | 200, `text/csv`, disposition filename `department-template.csv`, one line `name,code` (case ignored). | Pass | - |
| GAP_MD_A07 [CAMPUS] | template/CAMPUS is a CSV download with the header line only | Positive | ADMIN token | As above. | `campus-template.csv`, one header line. | Pass | - |
| GAP_MD_A07 [ROLE] | template/ROLE is a CSV download with the header line only | Positive | ADMIN token | As above. | `role-template.csv`, one header line. | Pass | - |
| GAP_MD_A08 | The three templates have the same header | Positive | ADMIN token | 1. GET all three templates. | One distinct body. | Pass | - |
| GAP_MD_A09 | The template type is not case-sensitive | Positive | ADMIN token | 1. GET `/template/role` and `/template/ROLE`. | 200 and identical text. | Pass | - |
| GAP_MD_A10 | An unknown template type is a 400 that names the accepted values | Negative | ADMIN token | 1. GET `/template/FOO`. | 400, `success` false, message contains "DEPARTMENT, CAMPUS, ROLE". | Pass | - |
| GAP_MD_A11 | The template is refused without credentials | Negative | No credentials | 1. GET `/template/ROLE` without auth. | 401 or 403. | Pass | - |

## Not automated

From `docs/test-cases/master-data.md` and `master-data-traceability.md`.

| Case | Reason |
|---|---|
| MD-003, MD-A05, TC_MD_043 (non-admin denied, API 403) | Manual: no Employee or Student test account (TC_MD_043 exists as a skipped placeholder) |
| MD-004 Session expiry on the page | Manual |
| MD-016 Long names and codes readable | Manual (visual); see IUN-3403 for phones |
| MD-017 Code cut off in one record | Manual, possible defect (stored 40-character limit); see IUN-3387 |
| MD-026 Changing type keeps or clears the form | Manual in the older catalogue (recorded behaviour now in GAP_MD_020) |
| MD-027 Special characters, long values, spaces, lowercase | Exploratory; would save data if accepted (covered by gated TC_MD_012..018) |
| MD-035 Same code in a different type | Manual (confirm rule with product owner); gated TC_MD_021 |
| MD-036 New record usable elsewhere (user or policy) | Manual; TC_MD_042 is a skipped placeholder |
| MD-044..MD-04A Real uploads (valid, duplicates, invalid, wrong type, over 10 MB, empty, .xlsx) | Manual or gated (saves data); covered by gated TC_MD_028..039 and GAP_MD_G06..G13 |
| MD-051 Reaching Master Data on a phone (bottom tab bar, More) | Manual |
| MD-052 Type dropdown on a real touch device | Manual (real Android and iPhone) |
| MD-053 Offline | Manual (the app has no service worker) |
| Real server wording for duplicates, headers, empty, BOM, .xlsx, Scenario 3 numbers | Needs real writes: gated GAP_MD_G01..G13, not run |
| `POST /add` and `/bulk-upload` without a token or with a Student or Employee token | Would create data if unprotected; no non-admin account |
| Maximum rows, very large files, UTF-16 or legacy code page, multi-sheet .xlsx, formulas or dates | The story defines no limits; each needs a real upload |
| Two admins adding the same code at once | Needs two sessions and real writes |
| Roles and Campuses used on other screens | Only the Policies department filter and pills were checked |
| Keyboard and screen reader use of the type dropdown (OBS-1, OBS-6) | Manual |

## Bugs raised for this story

| Bug key | Title | Priority | Covering test id(s) |
|---|---|---|---|
| IUN-3376 | Code is not upper-cased and trimmed on the screen (BR-MD-01) | - (not given) | GAP_MD_001, GAP_MD_002, GAP_MD_006 |
| IUN-3378 | Add is not blocked for invalid codes and names (code 1 or 51 characters, name 1 or 151, special characters) | - (not given) | GAP_MD_003 (x8), gated TC_MD_014, TC_MD_016, TC_MD_018 |
| IUN-3380 | Upload refuses files over 5 MB while the story and the file picker say 10 MB | High | GAP_MD_036, GAP_MD_037 |
| IUN-3381 | File error wording differs from the story; an oversize file is rejected only after clicking Upload | - (not given) | TC_MD_026-W, GAP_MD_032, GAP_MD_039, gated TC_MD_028 |
| IUN-3383 | An empty section disappears instead of showing count 0 (mocked list; needs confirmation) | - (not given) | GAP_MD_070 |
| IUN-3385 | A failing list call leaves the page silently empty (mocked) | - (not given) | GAP_MD_073 |
| IUN-3386 | Counters from a previous upload stay on screen after a failed upload (mocked) | - (not given) | GAP_MD_056 |
| IUN-3387 | Legacy department codes are 59 characters and campus codes 40 (needs confirmation) | - (not given) | GAP_MD_A02 |
| IUN-3388 | Two toasts for one failure; "download error report" hint with no report | - (not given) | GAP_MD_008, GAP_MD_009, GAP_MD_052 (passing tests that record the behaviour) |
| IUN-3403 | Long chips run off the right edge on phones (found in the mobile review) | High | No automated test (MD-050 checks page overflow only) |
| IUN-3408 | Cross-screen issue found in the mobile review | - (not given) | No automated test |
| IUN-3409 | Cross-screen issue found in the mobile review | - (not given) | No automated test |
