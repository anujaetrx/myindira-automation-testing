# Test cases: Admin > Bulk Upload

**Screen:** `/bulk-upload` (sidebar "Bulk Upload", admin) on QA, `https://app-test.k.indiraiscm.com`
**Story:** IUN-3267 "UMS & MyIndira User Synchronization, Bulk Onboarding (INS & Chanakya Campus) & Microsoft SSO" (BR-SYNC-01 to 05, scenarios 1 to 4, TC_SYNC_001 to 007)
**Automation:** `tests/e2e/IUN3267-BulkUpload/IUN3267-bulk-upload.spec.ts`, page object `src/pages/BulkUploadPage.ts`, helper `src/utils/helpers/bulk-upload.helper.ts` (CSV / XLSX writers and the upload spy)
**Last run:** 2026-11-20, chromium, QA. 58 tests green (incl. 7 known deviations), 1 skipped (gated), 0 failed. Run 3 times.

Run: `npx playwright test tests/e2e/bulk-upload --project=chromium --workers=2`
Gated real upload: `ALLOW_BULKUPLOAD_WRITES=true`. **Do not run casually**: it creates a real user that cannot be removed from the UI.

## What the screen really is

One page of cards: Upload Type Selector (STUDENT, EMPLOYEE, ADMIN, BIRTHDAY, TITLE), Template Download, File Upload (.csv / .xlsx), Upload / Reset, Validation Summary (Total, Success, Failed, Duplicates, Invalid), Row-wise Error Preview, Upload History, and a text-only "Error Report Download" card. `POST /admin/users/bulk-upload?type=<TYPE>` (multipart field `file`), `GET /admin/users/template/<TYPE>`, `GET /admin/users/upload-history`. The campus (INS / Chanakya Campus) is a CSV column, not a screen control. There is no UMS / sync status anywhere.

## Safety

Every test that presses Upload runs behind `guardWrites()` plus `installUploadSpy()`: the POST is answered locally, no user is created, and the test asserts what was sent (method, path, `type` query, content type, and the file name, size, MIME and text as the browser put it in the FormData, read inside the page because Chromium hides blob bodies from Playwright). Validation results (counters, duplicates, invalid, error rows) are **mocked server answers**: they prove how the screen displays a result, not that the server enforces the rule.

## Coverage

| Group | Cases | Automated | Result |
|---|---|---|---|
| BU_01 screen | opens from sidebar with all cards and nothing enabled; type menu has exactly the 5 types; choosing a type enables the template button | 3 | Pass |
| BU_02 template (read) | 5 types: file name + exact columns; officialEmail + campus + fullName present for STUDENT/EMPLOYEE/ADMIN (BR-SYNC-02, BR-SYNC-05); "template downloaded" message; failed request message | 10 | Pass |
| BU_03 file selection | .csv / .xlsx / .CSV accepted; .txt .pdf .xls .csv.exe and no extension rejected with message; Remove File; Upload needs type AND file; empty file attachable | 10 | Pass |
| BU_04 size | exactly 5 MB sent; 5 MB + 1 byte blocked, nothing sent | 2 | Pass |
| BU_04 | 7 MB accepted because the label says Max 10MB | 1 | **Known deviation** |
| BU_05 request | one multipart POST with the right `type` for each of 5 types; INS and Chanakya Campus rows reach the server byte for byte (TC_SYNC_003/004); .xlsx MIME; in-flight disables Upload and Reset (no double send); history reloads after upload | 9 | Pass |
| BU_06 results (mocked) | all success; partial with duplicates + invalid + row errors (TC_SYNC_006); all failed; 20 errors cap with "+N more errors"; singular "+1 more error"; file-level error without "Row" prefix; HTTP 400 message; 500 fallback; Reset; second upload replaces first | 10 | Pass |
| BU_07 history | screen equals API (same rows, order, format); newest first; success + failed = total and status matches counts; GET only, row click writes nothing; empty list; failing list request; long uploader name | 7 | Pass |
| BU_08 deviations | campus selector; Role column in template; upload date in history; error report download control; empty-history message; sync status | 6 | **Known deviations** |
| BU_09 real upload | one synthetic INS user (TC_SYNC_003) | 1 gated | **Not run** |

## Where the app differs from the story / label

| # | Story or screen says | App does | Severity guess |
|---|---|---|---|
| 1 | Bulk upload lets the admin choose Campus = INS or Chanakya Campus (scope, BR-SYNC-05) | No campus control. Type menu is STUDENT / EMPLOYEE / ADMIN / BIRTHDAY / TITLE; campus is only a column in the file. The screen does not check the value before sending | Medium (confirm with the team whether a column is the intended design) |
| 2 | Upload needs Campus, Microsoft email, Full Name and **Role** (BR-SYNC-05) | Templates have no `role` column (STUDENT has studentCode/course, EMPLOYEE has designation, ADMIN has none) | Medium |
| 3 | File upload says "Max 10MB" | Code rejects any file over 5 MB ("File size must be under 5 MB") | Medium, label and limit disagree |
| 4 | History of uploads | API returns `uploadedOn` but the row shows only id, type, uploader, total/success/failed, status; no campus, no date; no filter or paging | Low |
| 5 | Validation summary and error report | The "Error Report Download" card is text only ("Use backend endpoints..."), no button; only the first 20 errors are listed ("download the error report for the full list" points to nothing) | Medium |
| 6 | Empty history | Nothing is shown (no "no uploads yet") | Low |
| 7 | Story title "User Synchronization" | No UMS / sync status, last sync time or webhook information on this screen | Info, probably a back-end feature |
| 8 | Official ID must be a valid institutional email, blank rows are `Invalid`, duplicates flagged `Duplicates`, re-upload upserts | Cannot be checked without a real upload: the screen sends the file untouched and shows whatever the server returns | Not verified |

## Not automated

| Case | Why |
|---|---|
| TC_SYNC_001, TC_SYNC_002 UMS auto-provisioning and JIT fallback | No UMS access and no screen; needs UMS plus a paused webhook |
| TC_SYNC_003, TC_SYNC_004 real upload then Microsoft SSO login of that user | A real upload creates users the UI cannot delete; no second Microsoft account in the test setup. The request side is covered by mocked uploads (BU_05) and a gated test (BU_09, not run) |
| TC_SYNC_005 login blocked with "Your Microsoft account is not registered in UMS or MyIndira..." (BR-SYNC-03) | Needs a Microsoft account that is in neither system; SSO login belongs to IUN-3224 (auth specs) |
| TC_SYNC_006 server-side rejection of blank / malformed Official ID, duplicate IDs in a file | Needs a real upload; only the display of such a result is tested (mocked) |
| TC_SYNC_007 profile and role updates (UMS update, bulk re-upload upsert), no duplicate account on re-upload | Needs real uploads and a way to read the user back (no user list screen in this app) |
| BR-SYNC-01, -04 dual-source authorisation, UMS precedence | Back-end and SSO rules, no screen |
| Role landing pages after SSO (Admin dashboard, Faculty timetable, Student feed) | Needs faculty and student accounts |
| Row-level values of a real batch (which rows failed) | History has no detail view; error report has no UI |
| Non-admin access to `/bulk-upload` | Only an admin login exists |

## Notes for maintainers

- Menu items have `role=menuitem`; the menu slides in, so the page object waits for it to stop moving. The selector button's text changes to the chosen type.
- Chromium does not expose blob (file) content through `request.postData()`; the spy patches `XMLHttpRequest.send` to read the FormData file inside the page.
- Generated files: `buildCsv`, `buildXlsx` (real zip with inline strings, readable with `xlsx.helper`), `writeCsvOfSize` for the size boundary. Test e-mails use the reserved `.invalid` domain.
- Error preview and summary are read from the page text between headings, because the cards have no test ids.
- When a defect above is fixed its `test.fail()` test goes red: remove the marker and adjust the expectation (for example the 5 MB tests if the limit becomes 10 MB).
