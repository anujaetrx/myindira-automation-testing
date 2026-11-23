# Test case catalogue: IUN-3267 UMS & MyIndira User Synchronization, Bulk Onboarding (INS & Chanakya Campus) & Microsoft SSO

- **Story:** IUN-3267 "UMS & MyIndira User Synchronization, Bulk Onboarding (INS & Chanakya Campus) & Microsoft SSO" (rules BR-SYNC-01 to BR-SYNC-05, scenarios 1 to 4, QA cases TC_SYNC_001 to TC_SYNC_007). Only the part that lives on the Bulk Upload screen is automated.
- **Module / screen:** Admin > Bulk Upload (`/bulk-upload`)
- **Environment:** QA, `https://app-test.k.indiraiscm.com`, signed in as ADMIN
- **Spec:** `tests/e2e/IUN3267-BulkUpload/IUN3267-bulk-upload.spec.ts` (page object `src/pages/BulkUploadPage.ts`, helper `src/utils/helpers/bulk-upload.helper.ts`)
- **Summary doc:** `docs/test-cases/bulk-upload.md`
- **Date:** 2026-11-20
- **Last run:** chromium, QA, 3 runs: all green. 59 tests in the spec: 51 pass, 7 known defects (expected fail), 1 gated (BU_09, not run), 0 failed.
- **Test case IDs:** taken from the test title (BU_01 to BU_09 are the spec's group ids; the story's TC_SYNC ids are named in some titles). Many tests share a group id, so a ` #n` suffix (file order within the group) is added to make each row unique.

**Safety:** an upload creates real users on shared QA and cannot be undone from the UI. **Uploads are never really sent**: every test that presses Upload runs behind `guardWrites` plus an upload spy that intercepts and answers the POST locally; the test asserts what the screen sent (method, path, `type`, content type, file name, size, MIME, text). Validation results (counters, duplicates, invalid, row errors) are **mocked server answers**: they prove how the screen displays a result, not that the server enforces the rule.

**Type:** Positive / Negative / Boundary / Known defect (`test.fail`, green while the app is wrong) / Gated (real write, not run) / Mocked API.
**Result:** `Pass`; `Known defect (expected fail)`; `Gated, not run`; `Skipped`.
Generated test files (CSV and XLSX) are written to a temporary folder; e-mails use the reserved `.invalid` domain.

## Story scenarios and business rules covered

| Story scenario / rule | Test ids |
|---|---|
| Bulk onboarding screen, upload types | BU_01 #1 to #3 |
| BR-SYNC-02 Microsoft ID (officialEmail), BR-SYNC-05 campus / full name columns in templates | BU_02 #1 to #10 |
| BR-SYNC-05 Role column | BU_08 #2 (known defect) |
| BR-SYNC-05 campus INS / Chanakya Campus choice | BU_05 #6 (file content), BU_08 #1 (known defect) |
| File rules (.csv / .xlsx, 5 MB limit) | BU_03 #1 to #10, BU_04 #1 to #3 |
| TC_SYNC_003 / TC_SYNC_004 what the screen sends for INS and Chanakya rows | BU_05 #1 to #9, BU_06 #1 |
| TC_SYNC_006 duplicate and invalid Official ID display | BU_06 #2 to #10 |
| Upload history | BU_07 #1 to #7, BU_08 #3, BU_08 #5 |
| Error report download | BU_08 #4 |
| UMS / sync status (story title) | BU_08 #6 |
| TC_SYNC_003 real upload | BU_09 (gated) |
| TC_SYNC_001/002/004/005/007, BR-SYNC-01/03/04, SSO login | Not automated (see below) |

## Test cases

### BU_01 Screen and BU_02 template download

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| BU_01 #1 | Bulk Upload opens from the sidebar with every card and nothing enabled | Positive | ADMIN | 1. Open `/dashboard`, click "Bulk Upload".<br>2. Read the cards, label, buttons and summary. | Path `/bulk-upload`; headings Upload Type Selector, Template Download, File Upload, Upload Actions, Validation Summary, Row-wise Error Preview, Upload History, Error Report Download; "No file" text; label "Accepted: .csv, .xlsx \| Max 10MB"; Upload and template buttons disabled; summary all 0; empty error preview. | Pass | - (the "Max 10MB" label is the subject of IUN-3335, see BU_04 #3) |
| BU_01 #2 | The upload type menu offers exactly STUDENT, EMPLOYEE, ADMIN, BIRTHDAY, TITLE | Positive | ADMIN | 1. Open the type menu. | Menu items equal STUDENT, EMPLOYEE, ADMIN, BIRTHDAY, TITLE. | Pass | - |
| BU_01 #3 | Choosing a type shows it on the selector and enables the template button | Positive | ADMIN | 1. Choose EMPLOYEE. | Selector shows EMPLOYEE; "Download EMPLOYEE Template" enabled; Upload still disabled (no file). | Pass | - |
| BU_02 #1 | STUDENT template downloads as student-template.csv with the expected columns | Positive | ADMIN | 1. Choose STUDENT, click download; capture `GET /admin/users/template/STUDENT`.<br>2. Save and read line 1. | GET request; file name `student-template.csv`; header fullName, officialEmail, email, mobile, department, campus, status, studentCode, year, semester, course, division, title. | Pass | - |
| BU_02 #2 | EMPLOYEE template downloads as employee-template.csv with the expected columns | Positive | ADMIN | As above for EMPLOYEE. | File `employee-template.csv`; header fullName, officialEmail, email, mobile, department, campus, status, employeeCode, designation, title. | Pass | - |
| BU_02 #3 | ADMIN template downloads as admin-template.csv with the expected columns | Positive | ADMIN | As above for ADMIN. | File `admin-template.csv`; header fullName, officialEmail, email, mobile, department, campus, status. | Pass | - |
| BU_02 #4 | BIRTHDAY template downloads as birthday-template.csv with the expected columns | Positive | ADMIN | As above for BIRTHDAY. | File `birthday-template.csv`; header email, birthDate. | Pass | - |
| BU_02 #5 | TITLE template downloads as title-template.csv with the expected columns | Positive | ADMIN | As above for TITLE. | File `title-template.csv`; header email, title. | Pass | - |
| BU_02 #6 | STUDENT template carries the officialEmail (Microsoft ID) and campus columns (BR-SYNC-02, BR-SYNC-05) | Positive | ADMIN | 1. Download the STUDENT template, read the header. | Header contains officialEmail, campus, fullName. | Pass | - |
| BU_02 #7 | EMPLOYEE template carries the officialEmail (Microsoft ID) and campus columns (BR-SYNC-02, BR-SYNC-05) | Positive | ADMIN | As above for EMPLOYEE. | Header contains officialEmail, campus, fullName. | Pass | - |
| BU_02 #8 | ADMIN template carries the officialEmail (Microsoft ID) and campus columns (BR-SYNC-02, BR-SYNC-05) | Positive | ADMIN | As above for ADMIN. | Header contains officialEmail, campus, fullName. | Pass | - |
| BU_02 #9 | Downloading shows the "template downloaded" message | Positive | ADMIN | 1. Choose STUDENT, download. | Snackbar "STUDENT template downloaded". | Pass | - |
| BU_02 #10 | A failing template request shows "Failed to download template" and no file | Negative | Template request mocked as 500 | 1. Choose STUDENT, click download. | Snackbar "Failed to download template"; no download event. | Pass | - |

### BU_03 File selection and BU_04 size limit

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| BU_03 #1 | A .csv is shown by name and can be removed | Positive | Generated `ins-users.csv` (INS and Chanakya rows) | 1. Choose the file.<br>2. Click Remove File. | File name shown and Remove visible; after Remove the "no file" text returns and Remove hides. | Pass | - |
| BU_03 #2 | A real .xlsx is accepted (and our generated workbook reads back) | Positive | Generated `ins-users.xlsx` | 1. Read the generated workbook (campus cell = INS).<br>2. Choose the file. | Workbook reads back; file name shown; Remove visible. | Pass | - |
| BU_03 #3 | An upper-case extension (.CSV) is accepted | Positive | Generated `USERS.CSV` | 1. Choose the file. | Attached, name "USERS.CSV". | Pass | - |
| BU_03 #4 | "users.txt" is rejected with "Only .csv and .xlsx are allowed" and not attached | Negative | Type STUDENT; file users.txt | 1. Choose the file. | Snackbar "Only .csv and .xlsx are allowed"; "no file" text; Upload disabled. | Pass | - |
| BU_03 #5 | "users.pdf" is rejected with "Only .csv and .xlsx are allowed" and not attached | Negative | As above, users.pdf | As above. | As above. | Pass | - |
| BU_03 #6 | "users.xls" is rejected with "Only .csv and .xlsx are allowed" and not attached | Negative | As above, users.xls | As above. | As above. | Pass | - |
| BU_03 #7 | "users.csv.exe" is rejected with "Only .csv and .xlsx are allowed" and not attached | Negative | As above, users.csv.exe | As above. | As above. | Pass | - |
| BU_03 #8 | "users" (no extension) is rejected with "Only .csv and .xlsx are allowed" and not attached | Negative | As above, file "users" | As above. | As above. | Pass | - |
| BU_03 #9 | Upload needs BOTH a type and a file | Positive | Generated a.csv | 1. Choose file only: Upload state.<br>2. Select STUDENT.<br>3. Remove the file. | File without type: disabled; type and file: enabled; type without file: disabled. | Pass | - |
| BU_03 #10 | An empty (0 byte) .csv can be attached; the server must reject it | Boundary | Generated empty.csv | 1. Choose the file. | File attached, name "empty.csv" (the screen does not refuse it; server rejection is not tested). | Pass | - |
| BU_04 #1 | A file of exactly 5 MB is sent (boundary) | Boundary | Generated 5 MB csv; upload intercepted | 1. Select STUDENT, choose file, click Upload. | "All N users uploaded successfully" (mocked answer); exactly one upload request. | Pass | - |
| BU_04 #2 | A file 1 byte over 5 MB is blocked with "File size must be under 5 MB" and nothing is sent | Boundary | Generated 5 MB + 1 byte csv; upload intercepted | 1. Select STUDENT, choose file, click Upload. | Snackbar "File size must be under 5 MB"; zero upload requests. | Pass | - |
| BU_04 #3 | A 7 MB file is accepted because the screen says "Max 10MB" | Known defect | Generated 7 MB csv; upload intercepted | 1. Select STUDENT, choose file, click Upload. | Expected (per the label "Max 10MB"): the file is sent. Actual (defect): the code rejects anything over 5 MB. | Known defect (expected fail) | IUN-3335 |

### BU_05 What Upload sends (intercepted, never reaches the server)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| BU_05 #1 | STUDENT: Upload sends one multipart POST to /admin/users/bulk-upload?type=STUDENT | Positive | Generated INS + Chanakya csv; writes and upload intercepted | 1. Select the type, choose file, click Upload. | "All N users uploaded successfully"; one call, POST `/myindiranew/api/admin/users/bulk-upload`, query type STUDENT, content type `multipart/form-data; boundary=`; no other write. | Pass | - |
| BU_05 #2 | EMPLOYEE: Upload sends one multipart POST to /admin/users/bulk-upload?type=EMPLOYEE | Positive | As above | As above with EMPLOYEE. | As above with type EMPLOYEE. | Pass | - |
| BU_05 #3 | ADMIN: Upload sends one multipart POST to /admin/users/bulk-upload?type=ADMIN | Positive | As above | As above with ADMIN. | As above with type ADMIN. | Pass | - |
| BU_05 #4 | BIRTHDAY: Upload sends one multipart POST to /admin/users/bulk-upload?type=BIRTHDAY | Positive | As above | As above with BIRTHDAY. | As above with type BIRTHDAY. | Pass | - |
| BU_05 #5 | TITLE: Upload sends one multipart POST to /admin/users/bulk-upload?type=TITLE | Positive | As above | As above with TITLE. | As above with type TITLE. | Pass | - |
| BU_05 #6 | The INS and Chanakya Campus rows reach the server untouched (TC_SYNC_003, TC_SYNC_004, BR-SYNC-05) | Positive | CSV with an INS row and a Chanakya Campus row; upload intercepted | 1. Select STUDENT, choose `ins-chanakya.csv`, click Upload.<br>2. Read the file as put in the FormData. | One call; file name and size equal the generated file; text identical to the CSV and contains ",INS," and ",Chanakya Campus,". | Pass | - |
| BU_05 #7 | An .xlsx is sent with the spreadsheet content type | Positive | Generated staff.xlsx; type EMPLOYEE | 1. Choose file, click Upload. | File name `staff.xlsx`; MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; type EMPLOYEE. | Pass | - |
| BU_05 #8 | While the request is in flight Upload is disabled, so a double click sends it once | Positive | Upload answer held back | 1. Click Upload.<br>2. Check buttons.<br>3. Force-click Upload again.<br>4. Release the answer. | Upload and Reset disabled while loading; one call only; success message after release. | Pass | - |
| BU_05 #9 | A successful upload reloads the history list | Positive | Upload intercepted | 1. Click Upload. | A `GET /admin/users/upload-history` request is sent after the upload. | Pass | - |

### BU_06 Validation summary and errors (mocked server answers)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| BU_06 #1 | All rows succeed: summary counters and the "uploaded successfully" message (TC_SYNC_003) | Mocked API | Answer: total 4, success 4, no errors | 1. STUDENT, choose file, Upload. | Snackbar "All 4 users uploaded successfully"; summary 4/4/0/0/0; empty error preview. | Pass | - |
| BU_06 #2 | Partial success: counters, duplicates, invalid and the row-wise errors (TC_SYNC_006, duplicate Official ID) | Mocked API | Answer: total 5, success 2, failed 3, duplicates 1, invalid 2, three row errors | As above. | Snackbar "2 succeeded, 3 failed - review errors below"; summary 5/2/3/1/2; three lines "Row 3 - officialEmail: Duplicate Official ID in file", "Row 4 - ...: Invalid email format", "Row 5 - ...: Official ID is required". | Pass | - |
| BU_06 #3 | Every row fails: "All N rows failed" message | Mocked API | Answer: 2 rows, both failed, campus error | As above. | Snackbar "All 2 rows failed - review errors below"; summary total 2, failed 2, invalid 2; line "Row 2 - campus: Campus must be INS or Chanakya Campus". | Pass | - |
| BU_06 #4 | Only the first 20 errors are listed, with a "+N more errors" hint | Mocked API | Answer with 25 errors | As above. | 21 lines: rows 2 to 21 then "+5 more errors - download the error report for the full list". | Pass | - (the hint points to a missing download, see IUN-3340) |
| BU_06 #5 | 21 errors: singular "+1 more error" | Boundary | Answer with 21 errors | As above. | Last line "+1 more error - download the error report for the full list". | Pass | - |
| BU_06 #6 | A file-level error (rowNumber 0) is shown without the "Row" prefix | Mocked API | Answer: one error, row 0, field header | As above. | One line "header: Missing column: officialEmail". | Pass | - |
| BU_06 #7 | A rejected request (HTTP 400) shows the server message as an error row and in the message bar | Negative | Answer: 400 "Unsupported file content" | As above. | Snackbar "Unsupported file content"; line "file: Unsupported file content"; summary all 0. | Pass | - |
| BU_06 #8 | A server failure without a message falls back to a generic error | Negative | Answer: 500, empty body | As above. | One line starting "file: " with a generic text. | Pass | - |
| BU_06 #9 | Reset clears the file, the summary and the errors but keeps the chosen type | Positive | Answer with 2 failed rows | 1. Upload.<br>2. Click Reset. | "No file" text; empty error preview; summary all 0; selector still STUDENT; Upload disabled. | Pass | - |
| BU_06 #10 | A second upload replaces the previous result | Mocked API | First answer 3/3, then 1 failed with one row error | 1. Upload (summary total 3).<br>2. Change the mocked answer, click Upload again. | Summary total 1 and the single error line "Row 2 - officialEmail: Invalid email format". | Pass | - |

### BU_07 Upload history

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| BU_07 #1 | The screen lists every batch the API returns, in the same order, as "#id \| TYPE \| user \| total/success/failed \| STATUS" | Positive | Real QA history | 1. Open the screen, capture `GET /admin/users/upload-history`.<br>2. Read the rows. | Same number of rows, same order; each row text equals `#id \| type \| uploadedBy \| total/success/failed \| status`. | Pass | - |
| BU_07 #2 | Newest batch is first (ids descending) | Positive | Real QA history | 1. Read the batch ids. | Ids are in descending order. | Pass | - |
| BU_07 #3 | Every batch is consistent: success + failed = total, and the status matches the counts | Positive | Real QA history | 1. Read each row. | success + failed = total; status is SUCCESS (no failures), FAILED (no successes) or PARTIAL_SUCCESS; type is one of the five types. | Pass | - |
| BU_07 #4 | The history request is a read (GET) and the list is not editable | Positive | Real history; writes guarded | 1. Open the screen.<br>2. Click the first row. | No write recorded; path stays `/bulk-upload`. | Pass | - |
| BU_07 #5 | An empty history renders no rows and no errors | Mocked API | History mocked empty | 1. Open the screen. | 0 rows, heading visible, no page error. | Pass | - (missing empty-state message: BU_08 #5) |
| BU_07 #6 | A failing history request leaves the rest of the screen usable | Negative | History mocked 500 | 1. Open the screen.<br>2. Select STUDENT. | 0 rows; "Download STUDENT Template" enabled. | Pass | - |
| BU_07 #7 | A campus batch with a long uploader name still renders on one line | Mocked API | One mocked batch #900 (long uploader name, 10/9/1, PARTIAL_SUCCESS) | 1. Open the screen.<br>2. Read the row. | Row text `#900 \| STUDENT \| Chanakya Campus Administrator With A Very Long Display Name \| 10/9/1 \| PARTIAL_SUCCESS`. | Pass | - |

### BU_08 Known deviations from the story

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| BU_08 #1 | The screen lets the admin pick the campus (INS / Chanakya Campus) (scope, BR-SYNC-05) | Known defect | ADMIN | 1. Open the screen, choose STUDENT.<br>2. Look for INS / Chanakya text. | Expected: a campus choice on the screen. Actual (defect): no campus selector; the type menu only has STUDENT, EMPLOYEE, ADMIN, BIRTHDAY, TITLE; campus is only a CSV column. | Known defect (expected fail) | IUN-3332 (needs confirmation) |
| BU_08 #2 | The template has a Role column (BR-SYNC-05: Campus, Microsoft ID, Full Name, Role) | Known defect | ADMIN | 1. Choose ADMIN, download the template.<br>2. Read the header. | Expected: a `role` column. Actual (defect): STUDENT / EMPLOYEE / ADMIN templates have no role column (only designation / studentCode). | Known defect (expected fail) | IUN-3333 (needs confirmation) |
| BU_08 #3 | The history shows the upload date and time of each batch | Known defect | Real QA history | 1. Read the first history row. | Expected: a date in the row. Actual (defect): the API returns `uploadedOn` but the row shows only id, type, user, counts and status (no date, no campus). | Known defect (expected fail) | IUN-3338 |
| BU_08 #4 | The error report can be downloaded from the screen | Known defect | ADMIN | 1. Open the screen.<br>2. Look for a download error/report button. | Expected: a button. Actual (defect): the "Error Report Download" card is only a text ("Use backend endpoints...") with no button or link. | Known defect (expected fail) | IUN-3340 |
| BU_08 #5 | An empty history shows an empty-state message | Known defect | History mocked empty | 1. Open the screen.<br>2. Look for "no uploads / history / batches". | Expected: an empty-state message. Actual (defect): the Upload History heading is followed by nothing. | Known defect (expected fail) | IUN-3343 |
| BU_08 #6 | There is a place to see UMS / bulk sync status (story title: User Synchronization) | Known defect | ADMIN | 1. Open the screen.<br>2. Search the page text for "sync" or "UMS". | Expected: sync / UMS status information. Actual (defect): no sync status, last-sync time or UMS information anywhere on the screen. | Known defect (expected fail) | IUN-3332 (needs confirmation; the ticket also notes the missing UMS / sync status) |

### BU_09 Real upload (gated)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| BU_09 #1 | A real upload of one synthetic INS user returns a summary (TC_SYNC_003) [no cleanup possible] | Gated | `ALLOW_BULKUPLOAD_WRITES=true` needed; would create a real user that the UI cannot delete. Never run. | 1. Select ADMIN, choose a one-row csv (campus INS, synthetic `.invalid` e-mail).<br>2. Click Upload. | A summary line "Total: n" with n >= 1 is shown. | Gated, not run | - |

## Not automated

| Case | Reason |
|---|---|
| TC_SYNC_001, TC_SYNC_002 UMS auto-provisioning and JIT fallback | No UMS access and no screen; needs UMS plus a paused webhook. |
| TC_SYNC_003, TC_SYNC_004 real upload then Microsoft SSO login of that user | A real upload creates users the UI cannot delete; no second Microsoft account. The request side is covered by intercepted uploads (BU_05) and the gated BU_09 (not run). |
| TC_SYNC_005 login blocked with "Your Microsoft account is not registered in UMS or MyIndira..." (BR-SYNC-03) | Needs a Microsoft account in neither system; SSO login belongs to IUN-3224 (auth specs). |
| TC_SYNC_006 server-side rejection of blank / malformed Official ID, duplicate IDs in a file | Needs a real upload; only the display of such a result is tested (mocked). |
| TC_SYNC_007 profile and role updates, no duplicate account on re-upload | Needs real uploads and a way to read users back (no user list screen). |
| BR-SYNC-01, BR-SYNC-04 dual-source authorisation, UMS precedence | Back-end and SSO rules, no screen. |
| Role landing pages after SSO | Needs faculty and student accounts. |
| Row-level values of a real batch | History has no detail view; the error report has no UI. |
| Non-admin access to `/bulk-upload` | Only an admin login exists. |

## Row count

The spec has 59 tests: BU_01 3, BU_02 10, BU_03 10, BU_04 3, BU_05 9, BU_06 10, BU_07 7, BU_08 6, BU_09 1. 51 Pass, 7 Known defect, 1 Gated, 0 Skipped. (`--list` prints 61 lines because it also counts the two setup / teardown entries.)

## Bugs raised for this story

| Bug key | Title | Priority | Covering test id(s) |
|---|---|---|---|
| IUN-3332 | Bulk Upload: no Campus selector (INS / Chanakya Campus); campus exists only as a file column (needs confirmation; also notes no UMS / sync status on the screen) | Medium | BU_08 #1, BU_08 #6 |
| IUN-3333 | Bulk Upload: downloadable templates have no Role column (BR-SYNC-05) (needs confirmation) | Medium | BU_08 #2 |
| IUN-3335 | Bulk Upload: screen says "Max 10MB" but files over 5 MB are rejected | Medium | BU_04 #3 (label also seen in BU_01 #1) |
| IUN-3338 | Bulk Upload: Upload History shows no upload date and no campus | Low | BU_08 #3 |
| IUN-3340 | Bulk Upload: "Error Report Download" card has no button; "download the error report" hint points to nothing | Medium | BU_08 #4 (hint seen in BU_06 #4) |
| IUN-3343 | Bulk Upload: empty Upload History shows no empty-state message | Low | BU_08 #5 (BU_07 #5 shows the empty list) |
