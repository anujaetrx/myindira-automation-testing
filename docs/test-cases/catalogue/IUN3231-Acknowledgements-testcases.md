# IUN-3231 Acknowledgements Management & Mandatory Sign-Off Tracking: test case catalogue

| Item | Value |
|---|---|
| Story | IUN-3231 "Acknowledgements Management & Mandatory Sign-Off Tracking" |
| Module | Admin > Acknowledgements |
| Environment | QA, `https://app-test.k.indiraiscm.com`, signed in as ADMIN |
| Spec files | `tests/e2e/IUN3231-Acknowledgements/IUN3231-acknowledgements.spec.ts` (28 tests, team sheet TS_ACK_01 .. 08)<br>`tests/e2e/IUN3231-Acknowledgements/IUN3231-acknowledgements.gap.spec.ts` (12 tests, story gap review) |
| Summary doc | `docs/test-cases/acknowledgements.md` |
| Catalogue date | 2026-11-20 |
| Last run | 2026-11-20, chromium: all passed (known-defect tests are expected-fail and count as passed); the gated publish test (TS_ACK_07) was not run |

Test case IDs are the ids in the test titles. Gap-spec tests whose title has no id get a generated id `ACK-nnn` in file order.

**Type:** Positive, Negative, Boundary, Known defect (`test.fail`, turns red when the app is fixed), Gated (real write, not run), Mocked API (list data simulated).
**Result:** `Pass`; `Known defect (expected fail)`; `Gated, not run` (skipped without `ALLOW_ACK_WRITES=true`); `Skipped`.

## Story scenarios and business rules covered

| Story scenario / BR | Test ids |
|---|---|
| Scenario 1, list, tabs, badge (TS_ACK_01) | TS_ACK_01 (x6), BR-ACK-04 (Completed tab), ACK-001 .. ACK-003 |
| Scenario 2, create modal and Publish enablement (TS_ACK_02/03) | TS_ACK_02, TS_ACK_03 (x7) |
| BR-ACK-02 deadline | TS_ACK_04 (x6), BR-ACK-02 |
| Assign To (TS_ACK_05), lengths (TS_ACK_06) | TS_ACK_05 (x2), TS_ACK_06 (x3) |
| Scenario 3 publish (TS_ACK_07 / TS_ACK_08) | TS_ACK_07 (gated), TS_ACK_08 (x2), Scenario 3 (x5), ACK-004 |
| BR-ACK-01 audience targets and deadline sent | BR-ACK-01 (x2) |
| BR-ACK-04 Pending / Completed split | BR-ACK-04, ACK-001 .. ACK-003 |
| BR-ACK-03 obligations per user; 100% sign-off moves to Completed | Not automated (see below) |

## Test cases

### List, tabs and badge (TS_ACK_01)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_ACK_01 | Pending tab is selected by default, badge matches the cards | Positive | ADMIN, existing pending requests | 1. Open Acknowledgements.<br>2. Check tabs and count cards. | Pending tab selected, Completed not; badge reads `<n> pending` for n cards. | Pass | - |
| TS_ACK_01 | each card shows title, Pending pill, author and a red deadline | Positive | ADMIN | 1. Open the list.<br>2. Read every card; read the first deadline colour. | Non-empty title and author, status pill `Pending`, deadline like `Deadline: 3/28/2026`; deadline colour is red (r > 180, g and b < 90). | Pass | - |
| TS_ACK_01 | Completed tab with no records shows the empty message | Positive | ADMIN; QA has no completed items | 1. Open the Completed tab. | Empty message visible, Completed tab selected, no cards. | Pass | - |
| TS_ACK_01 | Pending tab with zero items shows the empty state and no errors | Mocked API | List API `/admin/acknowledgement-requests?` mocked to return 0 items | 1. Open the list. | Pending empty state visible, no cards, no page errors. | Pass | - |
| TS_ACK_01 | Pending tab with zero items shows a "0 pending" badge | Known defect | Same mock (0 items) | 1. Open the list. | Expected: badge `0 pending`. Actual (defect): with zero pending items the badge is hidden instead of showing "0 pending". | Known defect (expected fail) | IUN-3367 |
| TS_ACK_01 | deadline is shown as M/D/YYYY | Positive | ADMIN | 1. Read the first card's deadline. | Matches `Deadline: M/D/YYYY`, month first, no zero padding. | Pass | - |

### Create modal and Publish enablement (TS_ACK_02 / 03)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_ACK_02 | "+" opens the modal with Title, Description, Deadline, Assign To and Publish disabled | Positive | ADMIN | 1. Click "+". | Title, Description fields, "Select deadline date", Students and Employees options visible; Publish disabled. | Pass | - |
| TS_ACK_03 | Publish is disabled with empty fields | Negative | ADMIN | 1. Open the modal. | Publish disabled. | Pass | - |
| TS_ACK_03 | missing Title keeps Publish disabled | Negative | ADMIN | 1. Fill description, future deadline, Students; no title. | Publish disabled. | Pass | - |
| TS_ACK_03 | missing Description keeps Publish disabled | Negative | ADMIN | 1. Fill title, future deadline, Students; no description. | Publish disabled. | Pass | - |
| TS_ACK_03 | whitespace-only title/description keeps Publish disabled | Negative | ADMIN | 1. Enter 5 spaces in title and description; future deadline; Students. | Publish disabled. | Pass | - |
| TS_ACK_03 | all fields valid enables Publish | Positive | ADMIN | 1. Fill all fields with valid values (`fillValid`). | Publish enabled. Nothing saved. | Pass | - |
| TS_ACK_03 | missing Deadline keeps Publish disabled | Known defect | ADMIN | 1. Enter title `Z`, description `Z`, tick Employees; no deadline. | Expected (Deadline is marked required): Publish disabled. Actual (defect): Publish is enabled with Title + Description only. | Known defect (expected fail) | IUN-3314 |
| TS_ACK_03 | missing Assign To keeps Publish disabled | Known defect | ADMIN | 1. Enter title, description and a future deadline; no audience. | Expected (Assign To is marked required): Publish disabled. Actual (defect): Publish is enabled with Title + Description only. | Known defect (expected fail) | IUN-3314 |

### Deadline (TS_ACK_04)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_ACK_04 | a future date populates the field | Positive | ADMIN; date today + 30 days | 1. Open the modal.<br>2. Set the deadline. | Field value equals the ISO date and the date text is shown. | Pass | - |
| TS_ACK_04 | today is accepted | Boundary | ADMIN | 1. Set deadline to today (UTC date). | Field keeps today's date. | Pass | - |
| TS_ACK_04 | the date picker blocks past dates (min = today) | Boundary | ADMIN | 1. Read the date input `min` attribute. | `min` equals today. | Pass | - |
| TS_ACK_04 | invalid date text is not kept | Negative | ADMIN | 1. Assign `99/99/9999` to the date input value. | Native date input stays empty. | Pass | - |
| TS_ACK_04 | 29 Feb of a leap year is accepted and kept as ISO 8601 | Boundary | ADMIN | 1. Set deadline `2028-02-29`. | Field value `2028-02-29`. | Pass | - |
| TS_ACK_04 | a manually typed past date is rejected | Known defect | ADMIN | 1. Enter title, description, Students.<br>2. Type deadline `2020-01-01`. | Expected: Publish disabled. Actual (defect): only the picker restricts past dates; a typed past date is accepted and Publish enables. | Known defect (expected fail) | IUN-3362 |

### Assign To (TS_ACK_05)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_ACK_05 | Students only, Employees only and both toggle independently | Positive | ADMIN | 1. Open the modal (none ticked).<br>2. Tick Students, tick Employees, untick Students. | State follows each click: none, Students, both, Employees only. | Pass | - |
| TS_ACK_05 | unchecking all audiences disables Publish | Known defect | ADMIN | 1. Fill valid form (Publish enabled).<br>2. Untick the audience (Employees). | Expected: Publish disabled. Actual (defect): Assign To is not enforced, Publish stays enabled with nobody selected. | Known defect (expected fail) | IUN-3314 |

### Lengths (TS_ACK_06)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_ACK_06 | title of 120 and description of 5000 are accepted | Boundary | ADMIN | 1. Enter 120-char title and 5000-char description, future deadline, Students. | Values kept at 120 and 5000 chars; Publish enabled. | Pass | - |
| TS_ACK_06 | title of 121 is blocked or truncated | Known defect | ADMIN | 1. Enter a 121-char title. | Expected: length at most 120. Actual (defect): UI accepts 121 characters. | Known defect (expected fail) | IUN-3365 |
| TS_ACK_06 | description of 5001 is blocked or truncated | Known defect | ADMIN | 1. Enter a 5001-char description. | Expected: length at most 5000. Actual (defect): UI accepts 5001 characters. | Known defect (expected fail) | IUN-3365 |

### Closing the modal (TS_ACK_08) and gated publish (TS_ACK_07)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TS_ACK_08 | closing with X discards the draft, nothing is saved, re-opening shows an empty form | Negative | ADMIN; write requests to `/api/` recorded | 1. Note card count.<br>2. Open the modal, fill valid data, close with X.<br>3. Re-open the modal. | Card count unchanged; title, description, deadline empty; Employees unticked; no non-GET API request sent. | Pass | - |
| TS_ACK_08 | clicking the backdrop dismisses the modal without saving | Known defect | ADMIN | 1. Open the modal, type a title.<br>2. Click the dimmed backdrop. | Expected: modal closes. Actual (defect): clicking the dimmed area does not close the modal. | Known defect (expected fail) | IUN-3366 |
| TS_ACK_07 | publish acknowledgement: card on top of Pending, badge +1 | Gated | ADMIN; needs `ALLOW_ACK_WRITES=true`; publishes a real request `AUTOTEST ack <time>` to Employees (no delete exists) | 1. Note card count.<br>2. Fill title, description, deadline +7 days, Employees; Publish. | Status below 300, modal closes, new card first in Pending, badge `<before+1> pending`. | Gated, not run | - |

### Publish request and confirmation (gap spec)

Writes go through `guardWrites` (not sent to the server); tests assert what was sent.

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| Scenario 3 | Publish sends title, description, deadline and the chosen audience | Positive | ADMIN; write guarded | 1. Fill title `Gap review request`, description, deadline `2027-05-06`, Employees.<br>2. Publish. | Exactly one `POST /admin/acknowledgement-requests` with body `{title, description, deadline: 2027-05-06, targets: [{role: EMPLOYEE, departmentId: null}]}`. | Pass | - |
| BR-ACK-01 | students only, and both audiences, are sent as the matching targets | Positive | ADMIN; write guarded | 1. Publish with Students only.<br>2. Publish again with Students + Employees. | First body targets `[{STUDENT, null}]`; second has roles EMPLOYEE and STUDENT. | Pass | - |
| Scenario 3 | after Publish the modal closes and a success message is shown | Positive | ADMIN; write guarded | 1. Publish a valid request. | Modal closes; message matching "Acknowledgement request created/published successfully" visible. | Pass | - |
| Scenario 3 | the message reads "Acknowledgement request published successfully" (story wording) | Known defect | ADMIN; write guarded | 1. Publish a valid request. | Expected: message "Acknowledgement request published successfully". Actual (defect): the app says "Acknowledgement request created successfully". | Known defect (expected fail) | IUN-3368 |
| Scenario 3 | the new request is prepended to Pending and the counter goes up by one | Mocked API | List mocked: 2 items before publish, 3 (new one first) after the guarded POST | 1. Open the list (badge `2 pending`).<br>2. Publish a valid request. | Modal closes; badge `3 pending`; first card is `Gap review request`. | Pass | - |
| ACK-001 (generated) | re-opening the modal after Publish shows an empty form | Positive | ADMIN; write guarded | 1. Publish a valid request.<br>2. Re-open the modal. | Title, description and deadline empty; Publish disabled. | Pass | - |
| BR-ACK-01 | the deadline sent is the picked date (tomorrow) | Positive | ADMIN; write guarded; deadline tomorrow | 1. Fill the form with tomorrow's date, Employees; Publish. | Sent body `deadline` equals tomorrow's ISO date. | Pass | - |
| BR-ACK-02 | a deadline of today is allowed and published | Known defect | ADMIN; write guarded; deadline = the picker's minimum (today) | 1. Fill title, description, Employees, deadline today.<br>2. Click Publish. | Expected: the request is sent (today is a valid deadline per the story). Actual (defect): shows "Deadline must be a future date" and sends nothing. | Known defect (expected fail) | IUN-3359 |

### Completed tab and overdue (gap spec)

List API mocked with three rows (one pending, two with `acknowledgedByCurrentUser: true`, one of them with an acknowledged date).

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| BR-ACK-04 | only unacknowledged requests are Pending and counted; the rest move to Completed | Mocked API | Mock: `Still pending`, `Signed by me`, `Signed, no date` | 1. Open the list.<br>2. Open Completed. | Pending: badge `1 pending`, only `Still pending`. Completed: `Signed by me` and `Signed, no date`; badge still `1 pending`. | Pass | - |
| ACK-002 (generated) | Completed cards show the Done pill and the acknowledgement date | Mocked API | Same mock | 1. Open Completed. | 2 cards, status `Done`; first card text contains `Acknowledged: 3/20/2026`. | Pass | - |
| ACK-003 (generated) | the empty Completed state returns when nothing is acknowledged | Mocked API | Mock: one pending item only | 1. Open Completed, then Pending. | Completed empty message visible; Pending lists `Only pending`. | Pass | - |
| ACK-004 (generated) | a request with a past deadline and no sign-off is still Pending with a red deadline | Mocked API | Mock: deadline `2026-03-28`, not acknowledged | 1. Open the list. | First card shows `Deadline: 3/28/2026` and Pending tab is selected. (Colour is not asserted in code despite the title.) | Pass | - |

## Not automated

| Case | Reason |
|---|---|
| Completed tab with real records; request moves to Completed after 100% sign-off; stays Pending at 99% | Needs a user to acknowledge (student/employee account) or seeded completed data; Completed shape is covered with a mocked list |
| Obligations generated per user (103 students / 406 total); dashboard counters (BR-ACK-03) | Needs DB access and the dashboard tile mapped |
| Double click on Publish creates one request | Writes data that cannot be removed |
| Toast "Acknowledgement request published" in a real publish | Part of the gated test; wording covered by the guarded gap test |

## Bugs raised for this story

| Bug | Title | Priority | Covering test id(s) |
|---|---|---|---|
| IUN-3314 | Publish is enabled without Deadline or Assign To (both marked required) | High | TS_ACK_03 (missing Deadline), TS_ACK_03 (missing Assign To), TS_ACK_05 (unchecking all audiences) |
| IUN-3359 | Deadline of today is rejected ("Deadline must be a future date") although the picker allows it | High | BR-ACK-02 (deadline of today) |
| IUN-3362 | Manually typed past deadline is accepted | Medium | TS_ACK_04 (manually typed past date) |
| IUN-3365 | No length limits on title (121) and description (5001) | Medium | TS_ACK_06 (title 121, description 5001) |
| IUN-3366 | Clicking the modal backdrop does not close the Create modal | Low | TS_ACK_08 (backdrop) |
| IUN-3367 | "0 pending" badge hidden when there are no pending items (needs confirmation) | Low | TS_ACK_01 ("0 pending" badge) |
| IUN-3368 | Success message reads "created successfully" instead of "published successfully" | Low | Scenario 3 (message wording) |
| IUN-3404 | Create Acknowledgement modal title cut off on phones | Medium | Mobile review, no automated test |
