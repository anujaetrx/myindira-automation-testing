# Test cases: Faculty Lecture Adjustment Request & Academic Admin Approval

**Screens:** `/lecture-adjust` (FACULTY request screen, "Lecture Adjust" module) and an ACADEMIC ADMIN / HOD approval surface (location not named in the story) on QA, `https://app-test.k.indiraiscm.com`
**Story:** IUN-3242 (rules BR-LA-01 to BR-LA-04), Jira status **QA FAILED**. The story has no comments and no field that says why it failed.
**Automation:** `tests/e2e/IUN3242-LectureAdjustment/IUN3242-lecture-adjustment.spec.ts` (availability guard only, 2 tests). No page object yet.
**Last run:** 2026-11-20, chromium, QA. 2 passed, 0 failed, 0 skipped.

Run: `npx playwright test tests/e2e/lecture-adjustment --project=chromium`
Nothing here changes data.

## STATUS: BLOCKED (cannot be executed with the current QA login)

What was checked on QA with the only available login (ADMIN):
- The admin sidebar has no Lecture Adjust, Adjustments or Approvals item. `/lecture-adjust`, `/lecture-adjustment`, `/adjustments` show the Admin Dashboard (an unknown route behaves the same). "No division selected" / "Send for Approval" never render.
- No role switcher and no approvals entry in the avatar menu (profile card and Logout only). Notifications and Master Data show nothing about adjustments.
- The admin role in this app is the "MyIndira Admin" portal (policies, posts, compliance). An "Academic Admin" / HOD role and its approval screen were not found, so the approval half of the story is also not reachable.
- No timetable or adjustment API call is made by the admin app.

The 2 automated tests (LA-BLOCK-01/02) assert this state; they turn red when the module appears.

### What is needed to run or automate the cases
1. A **Faculty** account (teaching employee) with allocated lectures, and a second faculty to act as the substitute and to test double-booking.
2. An **Academic Admin / HOD** account and the location of the approval screen (or API), including what it shows for a Pending request.
3. Master data and timetable templates for at least one full chain School > Program > Batch Year > Semester > Division with lecture slots (and a second chain, to prove the reset), plus a division that has no templates.
4. Rooms and a substitute faculty set up so that both a free slot and a clashing slot (room busy, faculty busy) exist.
5. A way to read the result: the Faculty and Student timetable (IUN-3241 `/timetable`) and the in-app notification list of the faculty, and a Student account.
6. A reset path: every submit, approve and reject changes shared data. Real runs need a disposable cohort or a clean-up API. Until then, every write must go behind `guardWrites` and a gate `ALLOW_ADJUSTMENT_WRITES=true`.

## Test cases

Type is Positive or Negative. Priority: P1 core, P2 important, P3 minor. Reason limits come from the Validations field: 10 to 300 characters. "Approver" is the Academic Admin / HOD.

### TS_LA_01 Cascading filters and empty state (BR-LA-01, TC_LA_001)

| Test Case ID | Scenario ID | Title | Type | Priority | Preconditions | Steps | Test Data | Expected Result | Story Reference |
|---|---|---|---|---|---|---|---|---|---|
| LA-001 | TS_LA_01 | Lecture Adjust screen opens with the five mandatory filters | Positive | P1 | Logged in as Faculty A | 1) Open `/lecture-adjust`. | Faculty A | Dropdowns "School *", "Program *", "Batch Year *", "Semester / Year *", "Division *" are shown, all unselected. | Description point 1; What it does |
| LA-002 | TS_LA_01 | Empty state until a division is selected | Positive | P1 | As LA-001 | 1) Look at the area below the filters. | - | Stacked layers icon, heading "No division selected", text "Complete the selection above to load templates." | Description point 2; Cascading Filter Selection |
| LA-003 | TS_LA_01 | Filters are filled in sequence | Positive | P1 | As LA-001 | 1) Try to open Program before School. 2) Select School, then Program, Batch Year, Semester / Year, Division. | One valid chain | Each child dropdown only becomes usable after its parent is chosen; order is School, Program, Batch, Semester, Division. | BR-LA-01 |
| LA-004 | TS_LA_01 | Child options depend on the parent | Positive | P2 | Two Schools with different Programs | 1) Select School 1, read Programs. 2) Select School 2, read Programs. | 2 schools | Programs list matches the selected School; same for each following level. | BR-LA-01 |
| LA-005 | TS_LA_01 | Templates load once Division is selected | Positive | P1 | Complete chain with templates | 1) Select all five filters. | Valid chain | The empty state is replaced by the timetable templates and lecture slots of that division. | Description point 3; Scenario 1 |
| LA-006 | TS_LA_01 | Changing School resets every downstream filter | Negative | P1 | All five filters selected | 1) Change School to another value. | School 2 | Program, Batch Year, Semester / Year and Division are cleared, the empty state "No division selected" returns, templates disappear. (TC_LA_001) | BR-LA-01 |
| LA-007 | TS_LA_01 | Changing Program resets Batch, Semester and Division | Negative | P1 | All five selected | 1) Change Program. | Program 2 | School stays; Batch, Semester, Division cleared; empty state returns. | BR-LA-01 |
| LA-008 | TS_LA_01 | Changing Batch Year resets Semester and Division | Negative | P2 | All five selected | 1) Change Batch Year. | Batch 2 | School and Program stay; Semester and Division cleared; empty state returns. | BR-LA-01 |
| LA-009 | TS_LA_01 | Changing Semester resets Division | Negative | P2 | All five selected | 1) Change Semester / Year. | Semester 2 | Only Division cleared; empty state returns. | BR-LA-01 |
| LA-010 | TS_LA_01 | Re-selecting the same value keeps the selection | Positive | P3 | All five selected | 1) Select the same School again. | Same value | Children are not cleared (or, if they are, record it): not defined in the story. | BR-LA-01 (edge) |
| LA-011 | TS_LA_01 | Reloading the page clears the selection | Positive | P3 | All five selected | 1) Reload. | - | Back to empty filters and the empty state (persistence is not specified). | Not specified |
| LA-012 | TS_LA_01 | Division without templates | Negative | P2 | A division with no templates | 1) Select that chain. | Division with no template | No crash, no stale templates of the previous division; message is not defined (question 4). | Not specified |
| LA-013 | TS_LA_01 | Template call fails | Negative | P3 | Templates API forced to fail (mock) | 1) Select Division. | HTTP 500 | No crash; error is communicated (wording not defined, question 4). | Not specified |

### TS_LA_02 Request an adjustment and submit (BR-LA-02, TC_LA_002, Scenario 1)

| Test Case ID | Scenario ID | Title | Type | Priority | Preconditions | Steps | Test Data | Expected Result | Story Reference |
|---|---|---|---|---|---|---|---|---|---|
| LA-014 | TS_LA_02 | "Request Adjustment" opens the adjustment modal on an assigned class | Positive | P1 | Templates loaded; Faculty A has an assigned class | 1) Click "Request Adjustment" on Faculty A's class. | Class of A | Adjustment modal opens with substitute faculty / new slot selection and a reason field. | Scenario 1; Template Loading & Adjustment Submission |
| LA-015 | TS_LA_02 | Request Adjustment is offered only for the faculty's own classes | Negative | P1 | Templates contain classes of other faculty | 1) Look at classes of another faculty. | Class of B | No "Request Adjustment" on B's classes (story says "an assigned class"; confirm, question 5). | Scenario 1; BR-TT-01 style scoping |
| LA-016 | TS_LA_02 | Primary button label is exactly "Send for Approval" | Positive | P1 | Modal open | 1) Read the primary button. | - | Label "Send for Approval"; not "Submit", "Send Request" or "Request". (TC_LA_002) | BR-LA-02 |
| LA-017 | TS_LA_02 | Button is disabled when the modal opens | Negative | P1 | Modal open, nothing filled | 1) Look at the button. 2) Click it. | Empty form | Disabled; click does nothing; no request is sent. | Submit CTA Enablement; TC_LA_002 |
| LA-018 | TS_LA_02 | Disabled with a reason but no substitute or slot | Negative | P1 | Modal open | 1) Enter a valid reason only. | Reason 20 chars | Button stays disabled. | Submit CTA Enablement |
| LA-019 | TS_LA_02 | Disabled with a substitute/slot but no reason | Negative | P1 | Modal open | 1) Choose substitute or slot only. 2) Leave reason blank. | No reason | Button stays disabled. (TC_LA_002) | Submit CTA Enablement |
| LA-020 | TS_LA_02 | Reason of 9 characters is not enough | Negative | P1 | Substitute chosen | 1) Type a 9-character reason. | "Fever now" (9) | Button disabled. | Validations: reason 10-300 |
| LA-021 | TS_LA_02 | Reason of exactly 10 characters enables the button | Positive | P1 | Substitute chosen | 1) Type a 10-character reason. | "Sick leave" (10) | Button enabled. | Validations: reason 10-300 |
| LA-022 | TS_LA_02 | Reason of exactly 300 characters is accepted | Positive | P2 | Substitute chosen | 1) Paste 300 characters. | 300 x "a" | Button enabled; text not truncated. | Validations: reason 10-300 |
| LA-023 | TS_LA_02 | Reason of 301 characters is blocked | Negative | P2 | Substitute chosen | 1) Paste 301 characters. | 301 x "a" | Input stops at 300 or the button is disabled with a message; 301 is never sent. | Validations: reason 10-300 |
| LA-024 | TS_LA_02 | Whitespace-only reason is not valid | Negative | P2 | Substitute chosen | 1) Type 12 spaces. | 12 spaces | Button disabled (spaces do not count). | Validations: reason 10-300 |
| LA-025 | TS_LA_02 | Button turns off again when the reason is deleted | Negative | P2 | Valid form, button enabled | 1) Clear the reason. | - | Button disabled again. | Submit CTA Enablement |
| LA-026 | TS_LA_02 | Valid request is sent with status "Pending Approval" | Positive | P1 | Valid substitute and reason | 1) Click "Send for Approval". | Substitute faculty C, reason "Medical appointment" | Request submitted; status "Pending Approval" is shown; modal closes; the request carries the class, the substitute/slot and the reason. | Scenario 1 |
| LA-027 | TS_LA_02 | Academic Admin is notified of a new request | Positive | P1 | LA-026 done | 1) Check the Approver's notifications / queue. | - | The request is visible to the Approver with Pending Approval (mechanism not defined, question 2). | Scenario 1 |
| LA-028 | TS_LA_02 | Double click on "Send for Approval" creates one request | Negative | P2 | Valid form | 1) Double-click the button. | - | Exactly one request is created. | Scenario 1 |
| LA-029 | TS_LA_02 | Room double-booking is prevented | Negative | P1 | Chosen new slot has the room already used | 1) Pick that slot and a valid reason. 2) Send. | Slot with a clash | Not sent: a clash message is shown or the slot is not selectable. | Conflict Prevention |
| LA-030 | TS_LA_02 | Faculty double-booking is prevented | Negative | P1 | Substitute faculty busy at the slot | 1) Pick that substitute. 2) Send. | Busy substitute | Not sent: a clash message is shown or the faculty is not selectable. | Conflict Prevention |
| LA-031 | TS_LA_02 | Faculty can see the status of the request they sent | Positive | P2 | LA-026 done | 1) Look for the request in the faculty screen. | - | Status Pending Approval visible (where it is shown is not stated, question 3). | Scenario 1 |
| LA-032 | TS_LA_02 | Closing the modal discards the data | Positive | P3 | Modal partly filled | 1) Close the modal. 2) Reopen it. | - | Form empty again; nothing is sent. | Not specified |

### TS_LA_03 Academic Admin approval (BR-LA-03, TC_LA_003, Scenario 2)

| Test Case ID | Scenario ID | Title | Type | Priority | Preconditions | Steps | Test Data | Expected Result | Story Reference |
|---|---|---|---|---|---|---|---|---|---|
| LA-033 | TS_LA_03 | Approver sees the pending request | Positive | P1 | A "Pending Approval" request | 1) Open the approval screen as Academic Admin. | - | The request is listed with faculty, class, proposed change, reason and status Pending Approval. | Scenario 2; Description point 4 |
| LA-034 | TS_LA_03 | Approve changes the status to Approved | Positive | P1 | Pending request | 1) Click Approve. | - | Status becomes "Approved". (TC_LA_003) | BR-LA-03; Scenario 2 |
| LA-035 | TS_LA_03 | Master timetable is updated on approval | Positive | P1 | LA-034 done | 1) Read the master timetable / template for that slot. | - | Allocation reflects the substitute or new slot. | BR-LA-03 |
| LA-036 | TS_LA_03 | Approved adjustment shows on the Faculty timetable | Positive | P1 | LA-034 done | 1) Log in as the faculty (or substitute). 2) Open `/timetable` on the affected date. | Affected date | New slot/substitute appears on the right day and old slot is gone; counter updates. (TC_LA_003) | BR-LA-03; IUN-3241 |
| LA-037 | TS_LA_03 | Approved adjustment shows on the Student timetable | Positive | P1 | LA-034 done; Student account | 1) Log in as a student of the division. | - | Student sees the revised lecture. | BR-LA-03; Why: Synchronized Calendar |
| LA-038 | TS_LA_03 | A non-approver cannot approve | Negative | P1 | Faculty account | 1) Call the approve action as Faculty (UI or API). | Faculty token | Not available in UI; API rejects (403). | Description point 4 (governance) |
| LA-039 | TS_LA_03 | Approving twice does not double-apply | Negative | P2 | Already approved request | 1) Approve again (second tab). | - | No second change; clear message or no action. | BR-LA-03 |
| LA-040 | TS_LA_03 | Approval is rejected if a clash appeared after the request was sent | Negative | P2 | Slot got occupied after submission | 1) Approve. | Slot now busy | Approval blocked with a clash message; timetable unchanged. | Conflict Prevention |

### TS_LA_04 Academic Admin rejection (BR-LA-04, TC_LA_004, Scenario 3)

| Test Case ID | Scenario ID | Title | Type | Priority | Preconditions | Steps | Test Data | Expected Result | Story Reference |
|---|---|---|---|---|---|---|---|---|---|
| LA-041 | TS_LA_04 | Reject asks for a mandatory reason | Positive | P1 | Pending request | 1) Click Reject. | - | A rejection reason input is shown. | BR-LA-04; Scenario 3 |
| LA-042 | TS_LA_04 | Rejection without a reason is blocked | Negative | P1 | Reject dialog open | 1) Leave the reason empty. 2) Confirm. | Empty | Not accepted (control disabled or error); status stays Pending Approval. | Rejection Reason Requirement |
| LA-043 | TS_LA_04 | Rejection reason of 9 characters is blocked | Negative | P1 | Reject dialog open | 1) Type 9 characters. | "Too short" (9) | Not accepted. | BR-LA-04 (min 10) |
| LA-044 | TS_LA_04 | Rejection reason of exactly 10 characters is accepted | Positive | P1 | Reject dialog open | 1) Type 10 characters. | "Room busy!" (10) | Accepted. | BR-LA-04 |
| LA-045 | TS_LA_04 | Rejection reason of 300 accepted, 301 blocked | Negative | P2 | Reject dialog open | 1) Enter 300 chars. 2) Enter 301 chars. | 300 / 301 x "a" | 300 accepted; 301 stopped or blocked. | Rejection Reason Requirement |
| LA-046 | TS_LA_04 | Reject with the story's reason updates the status | Positive | P1 | Pending request | 1) Reject with the reason. | "Substitute faculty has lab clash" | Status "Rejected". | Scenario 3 |
| LA-047 | TS_LA_04 | Faculty is notified with the rejection reason | Positive | P1 | LA-046 or reject with "Room unavailable" | 1) Log in as the requesting faculty. 2) Open in-app notifications. | "Room unavailable" | In-app notification shows the full rejection reason. (TC_LA_004) | BR-LA-04; Scenario 3 |
| LA-048 | TS_LA_04 | Original timetable is unchanged after rejection | Positive | P1 | Request rejected | 1) Check the master timetable, Faculty `/timetable` and Student timetable. | - | The original slot and faculty are exactly as before; nothing moved. (TC_LA_004) | BR-LA-04; Scenario 3 |
| LA-049 | TS_LA_04 | Faculty may submit a new request after a rejection | Positive | P1 | Request rejected | 1) Open the same class again. 2) Send a new request. | New reason | A new request is created with Pending Approval; the rejected one stays as history. | BR-LA-04 |

## Where the story is unclear (questions for the team)

| # | Question | Why it matters |
|---|---|---|
| 1 | Where is the module in the app (sidebar name "Lecture Adjust", visible to which roles)? It is not in the admin portal. | Faculty login setup. |
| 2 | Where does the Academic Admin / HOD approve and reject ("console" in TC_LA_003)? Which role name, which screen, which notification on submit? | LA-027, LA-033 to LA-049 cannot be scripted. |
| 3 | Where does the faculty see own requests and their status (list / history)? | LA-031. |
| 4 | Messages for a division without templates and for load errors. | LA-012, LA-013. |
| 5 | Can Faculty request adjustment only on own classes? Can the Faculty also pick any slot in the division? | LA-015. |
| 6 | The modal fields are described loosely: "substitute faculty / alternate slot" (validation says either one is enough, description says "substitute faculty/new slot"). Is it either/or or both? Is the lecture date chosen? | LA-017 to LA-019. |
| 7 | Does the requester get a notification on approval (only rejection is specified)? | Possible gap. |
| 8 | Can a second request be raised for a lecture that already has a Pending request? | Not specified. |
| 9 | TC_LA_002 says the button waits only for the reason, the Validations field says substitute/slot AND reason. Which is right? | Story inconsistency. |
| 10 | QA FAILED: no comment or field says what failed. The team should say which scenario failed. | Prioritisation. |

## Notes for maintainers
- The four story TCs map to: TC_LA_001 = LA-005/LA-006, TC_LA_002 = LA-016 to LA-021, TC_LA_003 = LA-034 to LA-036, TC_LA_004 = LA-046 to LA-048.
- When automated: page object `src/pages/LectureAdjustPage.ts`, spec in this folder. The cascade and form validation (LA-001 to LA-025) need only read access and guardWrites for the submit, so they can run as soon as a Faculty login exists. Submit, approve and reject (LA-026 and up) must be behind `guardWrites` (assert the method, path and body sent) and any real run gated by `ALLOW_ADJUSTMENT_WRITES=true` with clean-up (reject or delete the request, restore the timetable).
- LA-036/037 depend on the Timetable module (IUN-3241, `docs/test-cases/faculty-timetable.md`).
- Remove the two LA-BLOCK tests (or invert them) once the module is reachable.
