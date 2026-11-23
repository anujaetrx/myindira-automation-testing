# IUN-3239 Institutional Policies Management & Targeted Distribution: test case catalogue

| Item | Value |
|---|---|
| Story | IUN-3239 "Institutional Policies Management & Targeted Distribution" |
| Module | Admin > Policies (`/policies`) |
| Environment | QA, `https://app-test.k.indiraiscm.com`, signed in as ADMIN |
| Spec files | `tests/e2e/IUN3239-Policies/IUN3239-policies.spec.ts` (39 tests, team sheet TS_POL_01 .. 09)<br>`tests/e2e/IUN3239-Policies/IUN3239-policies.gap.spec.ts` (16 tests, story gap review) |
| Summary doc | `docs/test-cases/policies.md` |
| Catalogue date | 2026-11-20 |
| Last run | 2026-11-20, chromium: all passed (known-defect tests are expected-fail and count as passed); the gated lifecycle test was not run |

Test case IDs are the ids in the test titles. Titles of the gap spec that carry no id of their own (the list / filter / details group) get a generated id `POL-nnn` in file order.

**Type:** Positive, Negative, Boundary, Known defect (`test.fail`, turns red when the app is fixed), Gated (real write, not run), Mocked API (data situation simulated).
**Result:** `Pass`; `Known defect (expected fail)`; `Gated, not run` (skipped without `ALLOW_POLICY_WRITES=true`); `Skipped`.

## Story scenarios and business rules covered

| Story scenario / BR | Test ids |
|---|---|
| Scenario 1, list, filter, detail (TS_POL_01, TS_POL_02) | TS_POL_01 (x4), TS_POL_02 (x6), POL-001 .. POL-005 |
| Scenario 1, create modal tracker (TS_POL_03 .. 05) | TS_POL_03 (x5), TS_POL_04 (x4), TS_POL_05 (x2) |
| BR-POL-01 tracker rule (title >= 5, content >= 20) | BR-POL-01 (x4), TC_POL_002, TS_POL_07 (x6) |
| BR-POL-02 Publish only at 4/4 | BR-POL-02, TS_POL_03 |
| Attachment (TS_POL_06) | TS_POL_06 (x9) |
| Publish (TC_POL_004 / TS_POL_08) | TC_POL_008 (x5), TS_POL_08 (x2) |
| Scenario 2 / TC_POL_005 Archive (TS_POL_09) | TC_POL_005, TS_POL_09 (x2, one gated) |
| BR-POL-04 soft-archive audit trail, student/employee visibility | Not automated (see below) |

## Test cases

### List and count (TS_POL_01)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_POL_01 | policies list renders cards with title, department, author, date and Archive | Positive | ADMIN, existing policies | 1. Open `/policies`.<br>2. Read every card. | Each card has a non-empty title and department badge, a date like `12 Nov 2026`, and an Archive action. | Pass | - |
| TS_POL_01 | policy count header matches the number of cards | Positive | ADMIN | 1. Open `/policies`.<br>2. Count the cards. | Header reads `<n> policy` / `<n> policies` for n cards. | Pass | - |
| TS_POL_01 | drill-down opens the policy details with full content | Positive | ADMIN | 1. Open `/policies`.<br>2. Click the first policy. | Detail screen shows the Back arrow, "Policy Information", "Policy Content", the policy title and the Download button. | Pass | - |
| TS_POL_01 | no policies: empty state, "0 policies", no errors | Mocked API | ADMIN; list API `/admin/policies?` mocked to return 0 items | 1. Open `/policies`. | Header reads `0 policies`, no cards, no page errors. | Pass | - |

### Department filter (TS_POL_02)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_POL_02 | filter opens with search box and department list | Positive | ADMIN | 1. Open `/policies`.<br>2. Open the department filter. | Search box visible; list contains "All" and more than one department. | Pass | - |
| TS_POL_02 | search narrows the list in real time | Positive | ADMIN | 1. Open the filter.<br>2. Type "Computer". | Fewer options than before, "Computer Science" present, every option contains "computer". | Pass | - |
| TS_POL_02 | search with no match shows a message and does not crash | Negative | ADMIN | 1. Open the filter.<br>2. Type "zzzz". | A "no match" message is shown; no page errors. | Pass | - |
| TS_POL_02 | selecting a department closes the flyout and lists only its policies | Positive | ADMIN | 1. Open the filter.<br>2. Choose "Computer Science". | Flyout closes; filter name reads "Department filter, currently Computer Science"; header `<n> policies in Computer Science`; all cards are Computer Science; at least one card. | Pass | - |
| TS_POL_02 | reset the filter to All shows every policy again | Positive | ADMIN | 1. Note total cards.<br>2. Filter to Computer Science.<br>3. Reopen filter, choose "All". | Filter reads "currently All"; card count equals the original total. | Pass | - |
| TS_POL_02 | filter list is sourced from Master Data | Positive | ADMIN; Master Data list read through the API | 1. Read departments from Master Data API.<br>2. Open the filter and read options. | Every option (except "All") exists in Master Data. | Pass | - |

### Create modal: tracker (TS_POL_03)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_POL_03 | modal opens at 0/4 with Publish disabled | Positive | ADMIN | 1. Open the create modal. | Tracker `0/4 completed`; Publish disabled. | Pass | - |
| TS_POL_03 | tracker goes 1/4 -> 2/4 -> 3/4 -> 4/4 and Publish enables at 4/4 | Positive | ADMIN | 1. Fill title, then content, then department "Administration", then audience Students. | Tracker 1/4, 2/4, 3/4 (Publish still disabled), 4/4 (Publish enabled). Nothing is saved. | Pass | - |
| TS_POL_03 | clearing a field decrements the tracker and disables Publish | Positive | ADMIN | 1. Fill all four.<br>2. Clear the title. | Tracker 4/4 then 3/4; Publish disabled. | Pass | - |
| TS_POL_03 | Publish stays disabled at 3/4 when the audience is missing | Negative | ADMIN | 1. Fill title, content, department; no audience. | Tracker 3/4; Publish disabled. | Pass | - |
| TS_POL_03 | whitespace-only title/content does not count as a step | Negative | ADMIN | 1. Enter 5 spaces in title and in content. | Tracker stays `0/4 completed`. | Pass | - |

### Department selection (TS_POL_04)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_POL_04 | selecting a department marks it selected (+1) | Positive | ADMIN | 1. Open the modal.<br>2. Pick "Administration". | Pill is selected; tracker `1/4 completed`. | Pass | - |
| TS_POL_04 | switching department deselects the previous one (single select) | Positive | ADMIN | 1. Pick "Administration".<br>2. Pick "Human Resources". | Human Resources selected, Administration not selected. | Pass | - |
| TS_POL_04 | department pills come from Master Data | Positive | ADMIN; Master Data read through the API | 1. Read Master Data departments.<br>2. Open the modal and read the pills. | Set of pills equals the set of Master Data departments. | Pass | - |
| TS_POL_04 | no department selected keeps Publish disabled | Negative | ADMIN | 1. Fill title, content, audience; no department. | Tracker 3/4; Publish disabled. | Pass | - |

### Target audience (TS_POL_05)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_POL_05 | Students, Employees and both toggle independently | Positive | ADMIN | 1. Fill title, content, department.<br>2. Tick Students, then also Employees, then untick Students. | Tracker is 4/4 in all three states. | Pass | - |
| TS_POL_05 | unchecking every audience loses the 4th step and disables Publish | Negative | ADMIN | 1. Fill all four.<br>2. Untick Students (the only audience). | Tracker 3/4; Publish disabled. | Pass | - |

### Attachment (TS_POL_06)

Files are generated by the test (zero-filled bytes) in the test output folder.

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_POL_06 | valid PDF under 10MB shows file name and size | Positive | ADMIN; generated 8 MB `policy-8mb.pdf` | 1. Open the modal.<br>2. Attach the file. | File name and size `8.0 MB` are shown. | Pass | - |
| TS_POL_06 | .doc is accepted | Positive | Generated 20 KB `sample.doc` | 1. Open the modal.<br>2. Attach the file. | File name shown as attached. | Pass | - |
| TS_POL_06 | .docx is accepted | Positive | Generated 20 KB `sample.docx` | As above. | File name shown as attached. | Pass | - |
| TS_POL_06 | .jpg is accepted | Positive | Generated 20 KB `sample.jpg` | As above. | File name shown as attached. | Pass | - |
| TS_POL_06 | .png is accepted | Positive | Generated 20 KB `sample.png` | As above. | File name shown as attached. | Pass | - |
| TS_POL_06 | remove attachment | Positive | Generated 20 KB `to-remove.pdf` | 1. Attach the file.<br>2. Click remove. | File no longer shown; the attach prompt is visible again. | Pass | - |
| TS_POL_06 | file over 10MB is rejected and not attached | Negative | Generated 15 MB `too-big.pdf` | 1. Attach the file. | Toast "Document must be 10 MB or smaller"; file not attached. (The sheet wording "File exceeds 10MB limit or invalid format" differs; the test asserts the real text.) | Pass | - |
| TS_POL_06 | unsupported .exe is rejected and not attached | Negative | Generated 1 KB `setup.exe` | 1. Attach the file. | Toast "Only PDF, DOC, DOCX, JPG and PNG files are allowed"; file not attached. | Pass | - |
| TS_POL_06 | exactly 10MB is accepted (boundary) | Boundary | Generated 10 MB `exactly-10mb.pdf` | 1. Attach the file. | File shown as attached. | Pass | - |

### Length boundaries (TS_POL_07)

Each test opens the modal, enters `t` x title length and `c` x content length, picks "Administration" and Students, then checks Publish. Nothing is published.

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_POL_07 | title of 5 and content of 20 are accepted | Boundary | Title 5 chars, content 20 chars | Fill the form as described. | Publish enabled. | Pass | - |
| TS_POL_07 | title of 150 and content of 10000 are accepted | Boundary | Title 150 chars, content 10000 chars | Fill the form as described. | Publish enabled. | Pass | - |
| TS_POL_07 | title shorter than 5 is rejected (4 chars) | Known defect | Title 4 chars, content 20 | Fill the form as described. | Expected: Publish disabled. Actual (defect): UI enforces no length limits, Publish is enabled. | Known defect (expected fail) | IUN-3313 |
| TS_POL_07 | title longer than 150 is rejected (151 chars) | Known defect | Title 151 chars, content 20 | Fill the form as described. | Expected: Publish disabled. Actual (defect): UI enforces no length limits. | Known defect (expected fail) | IUN-3313 |
| TS_POL_07 | content shorter than 20 is rejected (19 chars) | Known defect | Title 5 chars, content 19 | Fill the form as described. | Expected: Publish disabled. Actual (defect): UI enforces no length limits. | Known defect (expected fail) | IUN-3313 |
| TS_POL_07 | content over 10000 is rejected (10001 chars) | Known defect | Title 5 chars, content 10001 | Fill the form as described. | Expected: Publish disabled. Actual (defect): UI enforces no length limits. | Known defect (expected fail) | IUN-3313 |

### Close without saving, archive confirmation (TS_POL_08 / 09)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_POL_08 | closing the modal without saving creates no policy | Negative | ADMIN; write requests to `/api/` are recorded | 1. Note the card count.<br>2. Open the modal, fill all four fields.<br>3. Close the modal. | Card count unchanged; no non-GET API request was sent. | Pass | - |
| TS_POL_09 | Archive asks for confirmation; cancelling keeps the policy active | Negative | ADMIN; native confirm is dismissed (Cancel); write requests recorded | 1. Click Archive on the first card.<br>2. Cancel the confirm. | Confirm text is `Archive policy "<title>"?` (sheet wording differs); card count and header unchanged; no write request sent. | Pass | - |
| TS_POL_08 | publish valid policy, then TS_POL_09 archive it (count +1, then -1) | Gated | ADMIN; needs `ALLOW_POLICY_WRITES=true`; creates policy `AUTOTEST policy <time>` and archives it (the screen has no un-archive) | 1. Note card count.<br>2. Create the policy (Administration, Employees) and Publish.<br>3. Archive it and confirm.<br>4. Reload. | Publish status below 300, modal closes, card appears (count +1); archive confirm text `Archive policy "<title>"?`; card gone (count back); still hidden after reload. | Gated, not run | - |

### Publish and archive requests (gap spec, TC_POL_008 / TC_POL_005)

All gap-spec writes go through `guardWrites`; the tests assert what was sent.

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_POL_008 | Publish sends the title, content, department id and audience (students only) | Positive | ADMIN; write guarded; department id from Master Data | 1. Fill title, content, Administration, Students.<br>2. Publish. | Exactly one `POST /admin/policies` with the title, content, `issuingDepartmentId` equal to the Master Data id and `targets` = `[{role: STUDENT, departmentId: null}]`. | Pass | - |
| TC_POL_008 | both audiences are sent as two targets, employees only as one | Positive | ADMIN; write guarded | 1. Publish with Students + Employees.<br>2. Reopen the modal, Publish with Employees only. | First body has targets EMPLOYEE and STUDENT; second has only EMPLOYEE. | Pass | - |
| TC_POL_008 | the effective date and deadline default to today (the form has no date field) | Positive | ADMIN; write guarded | 1. Publish a policy. | `effectiveDate` and `deadline` are `YYYY-MM-DD`; effectiveDate is today (local or UTC date). | Pass | - |
| TC_POL_008 | after Publish the modal closes and a success message is shown | Positive | ADMIN; write guarded | 1. Publish a policy. | Modal closes; a message matching "Policy created/published successfully" is visible. | Pass | - |
| TC_POL_008 | the success message reads "Policy published successfully" (sheet wording) | Known defect | ADMIN; write guarded | 1. Publish a policy. | Expected: message "Policy published successfully". Actual (defect): the app says "Policy created successfully". | Known defect (expected fail) | IUN-3356 |
| TC_POL_005 | confirming Archive sends the archive for exactly that policy | Positive | ADMIN; write guarded; list API response read to get the policy id | 1. Archive the first card and confirm. | Confirm text `Archive policy "<title>"?`; exactly one write: `POST /admin/policies/<id>/archive` for that policy. | Pass | - |

### Tracker rule BR-POL-01 / BR-POL-02 (gap spec)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| BR-POL-01 | a title of 5 and content of 20 characters each tick their step | Boundary | ADMIN | 1. Open the modal.<br>2. Enter a 5-char title, then 20-char content. | Tracker 1/4, then 2/4. | Pass | - |
| BR-POL-01 | a title shorter than 5 characters does not tick its step | Known defect | ADMIN | 1. Enter title `abcd`. | Expected: tracker stays 0/4. Actual (defect): any non-empty title (even 2 characters) already counts as a step. | Known defect (expected fail) | IUN-3313 |
| BR-POL-01 | content shorter than 20 characters does not tick its step | Known defect | ADMIN | 1. Enter 15-char content. | Expected: tracker stays 0/4. Actual (defect): any non-empty content (even 5 characters) already counts as a step. | Known defect (expected fail) | IUN-3313 |
| TC_POL_002 | title 4 + content 15 keeps the tracker at 0/4 (story QA case) | Known defect | ADMIN | 1. Enter title `abcd` and 15-char content. | Expected: tracker 0/4. Actual (defect): the tracker shows 2/4. | Known defect (expected fail) | IUN-3313 |
| BR-POL-02 | Publish enables exactly at 4/4 and not before | Positive | ADMIN | 1. Fill title, content, Administration (3/4).<br>2. Tick Employees. | At 3/4 Publish disabled; at 4/4 Publish enabled. | Pass | - |

### List, filter and detail (gap spec)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| POL-001 (generated) | the filtered header count equals the number of cards shown | Positive | ADMIN | 1. Filter to Computer Science.<br>2. Count cards. | Header `<n> policy/policies in Computer Science` with n equal to the card count. | Pass | - |
| POL-002 (generated) | the header count equals the total the API reports | Positive | ADMIN; list API response read | 1. Open `/policies` and read `totalElements`. | Header shows that total. | Pass | - |
| POL-003 (generated) | the detail screen shows Department, Effective Date, Published By, Published On and the content | Positive | ADMIN | 1. Open the first policy. | Labels Policy Information, Department, Effective Date, Published By, Published On, Policy Content are visible. | Pass | - |
| POL-004 (generated) | Download PDF on the detail screen opens a window with the policy | Positive | ADMIN | 1. Open the first policy.<br>2. Click Download. | A new window (popup, not a file download) opens and its body contains the policy title. | Pass | - |
| POL-005 (generated) | the Back arrow of the detail screen returns to the list | Positive | ADMIN | 1. Open a policy.<br>2. Click Back. | URL ends `/policies` and the card count equals the earlier count. | Pass | - |

## Not automated

| Case | Reason |
|---|---|
| Student-targeted policy visible to students, not employees; both audiences visible to both | No Student/Employee test account (only ADMIN is configured) |
| Archived policy kept in DB / audit log (BR-POL-04); dashboard count decrements | Needs DB or audit-log access; dashboard tile not mapped |
| Double click on Publish creates one policy | Writes data; to be added to the gated group once the publish test has been run once |
| Publish toast text and card at top (sheet) | Part of the gated test; toast wording covered by the gap test above |

## Bugs raised for this story

| Bug | Title | Priority | Covering test id(s) |
|---|---|---|---|
| IUN-3313 | Create Policy form enforces no title/content length limits (BR-POL-01) | High | TS_POL_07 (title 4, title 151, content 19, content 10001), BR-POL-01 (title < 5), BR-POL-01 (content < 20), TC_POL_002 |
| IUN-3356 | Publish success message reads "Policy created successfully" instead of "Policy published successfully" | Low | TC_POL_008 (success message wording) |
| IUN-3402 | "+" button covers the policy card on phones | Medium | Mobile review, no automated test |
| IUN-3408 | Tap targets too small (cross-screen) | Not stated | Mobile review, no automated test |
| IUN-3409 | Tiny text (cross-screen) | Not stated | Mobile review, no automated test |
