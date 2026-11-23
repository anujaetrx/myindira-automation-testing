# Test cases: Faculty Timetable & Lecture Attendance Marking

**Screen:** `/timetable` (FACULTY surface) on QA, `https://app-test.k.indiraiscm.com`
**Story:** IUN-3241 (rules BR-TT-01 to BR-TT-04), Jira status **QA FAILED**. The story has no comments and no field that says why it failed.
**Automation:** `tests/e2e/IUN3241-FacultyTimetable/IUN3241-faculty-timetable.spec.ts` (availability guard only, 3 tests). No page object yet: there is no screen to model.
**Last run:** 2026-11-20, chromium, QA. 3 passed, 0 failed, 0 skipped.

Run: `npx playwright test tests/e2e/faculty-timetable --project=chromium`
Nothing here changes data.

## STATUS: BLOCKED (cannot be executed with the current QA login)

What was checked on QA with the only available login (ADMIN, "Isha Kanta Walia"):
- The admin sidebar has only Dashboard, Social Feed, Admin Posts, Bulk Upload, Master Data, Notifications, Policies, Acknowledgements, Compliance, Reported Posts, Communities. There is **no Timetable** entry.
- `/timetable`, `/attendance`, `/schedule`, `/faculty`, `/adjustments` all show the Admin Dashboard (an unknown route such as `/this-route-does-not-exist-xyz` behaves the same). No faculty content ("No classes today", "Mark Attendance") is rendered.
- The avatar menu has only the profile card (name, role "Admin", e-mail, school) and Logout. There is no role switcher.
- `GET /api/auth/me` returns a profile with `role: "ADMIN"` and the fields `isTeaching`, `empId`, `designation`, `department` (so a teaching employee is a role-based variant of the same app). The admin app makes no timetable, lecture or attendance API call.
- Master Data has a department named "BBA Timetable (BBA_TIMETABLE)". It is only a department value, not the timetable module.

The 3 automated tests (TT-BLOCK-01..03) assert this state. They are green today and turn red when the admin app starts exposing the module (the signal to automate the cases below).

### What is needed to run or automate the cases
1. A QA **Faculty (teaching employee)** account: profile `role` EMPLOYEE with `isTeaching = true`, and a second Faculty account (for BR-TT-01 scoping).
2. For Faculty A, **lectures allocated in the master timetable** with controllable times: one running now, one ended ~10 h ago, one ended ~12 h ago, one ended 23 h 59 m ago, one ended 24 h 01 m ago / 25 h ago, one tomorrow, and a day with zero lectures. Fixed seed data cannot do this (time-relative), so either a seeding API / DB script, or a way to set the server clock, or a timetable whose slots can be created on demand.
3. A student roster mapped to each lecture's batch/division (so the attendance register has students).
4. A route for the Faculty login in Playwright (`userPage` fixture / a faculty entry in `config/env`), and the mobile/web decision: the story says "left-hand navigation sidebar under Timetable", so it is expected on the web app after faculty login.
5. An **Academic Admin** account for the override in BR-TT-02 (see open questions).

## Test cases

Type is Positive or Negative. Priority: P1 core, P2 important, P3 minor. Time-based cases use the faculty's lecture L (start S, end E) and the server/browser clock in IST unless noted. The story's own examples are dated 5 Nov 2026 (Thu), range "Nov 2 — Nov 8, 2026".

### TS_TT_01 Landing, weekly navigation and day strip (BR-TT-04)

| Test Case ID | Scenario ID | Title | Type | Priority | Preconditions | Steps | Test Data | Expected Result | Story Reference |
|---|---|---|---|---|---|---|---|---|---|
| TT-001 | TS_TT_01 | Timetable entry is in the faculty sidebar and opens /timetable | Positive | P1 | Logged in as Faculty A | 1) Look at the left sidebar. 2) Click "Timetable". | Faculty A | A "Timetable" item exists; clicking it opens `/timetable` and the schedule screen renders. | What it does: Timetable Route Access |
| TT-002 | TS_TT_01 | Default anchor is today, week range is Monday to Sunday | Positive | P1 | Faculty A, today = Thu 5 Nov 2026 | 1) Open `/timetable`. | Today 5 Nov 2026 | Range label "Nov 2 — Nov 8, 2026". Subheader "Today, 5 Nov 2026". | BR-TT-04, Scenario 1 |
| TT-003 | TS_TT_01 | Day strip shows 7 tiles Mon 2 to Sun 8 | Positive | P1 | As TT-002 | 1) Read the strip. | - | Seven tiles in order Mon 2, Tue 3, Wed 4, Thu 5, Fri 6, Sat 7, Sun 8. | Weekly strip; BR-TT-04 |
| TT-004 | TS_TT_01 | Active day style: navy pill, white text, indicator dot | Positive | P2 | As TT-002 | 1) Inspect tile "Thu 5". 2) Inspect other tiles. | - | Only the active tile has the solid navy background, white text and the dot under the number. | 7-Day Day Selector Strip; Scenario 1 |
| TT-005 | TS_TT_01 | Next chevron moves one week forward | Positive | P1 | As TT-002 | 1) Click ">". | - | Range becomes "Nov 9 — Nov 15, 2026"; strip shows Mon 9 to Sun 15; subheader and counter match the selected day. | BR-TT-04 |
| TT-006 | TS_TT_01 | Previous chevron moves one week back | Positive | P1 | As TT-002 | 1) Click "<". | - | Range "Oct 26 — Nov 1, 2026"; strip Mon 26 to Sun 1 (crosses month). | BR-TT-04 |
| TT-007 | TS_TT_01 | Week range across a year boundary | Positive | P3 | Navigate to the week of 28 Dec 2026 | 1) Click ">" until the range contains 1 Jan 2027. | - | Range label shows both months (and year) correctly, e.g. "Dec 28 — Jan 3, 2027"; no wrong year on either side. | BR-TT-04 |
| TT-008 | TS_TT_01 | Selecting another day updates highlight, subheader and counter | Positive | P1 | As TT-002 | 1) Click tile "Sat 7". | - | Sat 7 gets the navy pill and dot, Thu 5 loses it; subheader shows the selected date; counter shows the classes of that day. | Dynamic Subheader & Counter |
| TT-009 | TS_TT_01 | Navigating back to the current week and today | Positive | P2 | As TT-002 | 1) Click ">" twice. 2) Click "<" twice. | - | The current week range returns; the state is consistent (see open question 4 about which day is selected). | BR-TT-04 |
| TT-010 | TS_TT_01 | Many fast chevron clicks keep the screen consistent | Negative | P3 | As TT-002 | 1) Click ">" 10 times quickly. 2) Click "<" 10 times quickly. | - | Range label, strip and counter always agree; no blank screen; returns to the original week. | BR-TT-04 |

### TS_TT_02 Empty state (Scenario 1, TC_TT_001)

| Test Case ID | Scenario ID | Title | Type | Priority | Preconditions | Steps | Test Data | Expected Result | Story Reference |
|---|---|---|---|---|---|---|---|---|---|
| TT-011 | TS_TT_02 | Empty state content when the day has 0 classes | Positive | P1 | Faculty A has no lecture today | 1) Open `/timetable`. | Counter "0 classes" | Teacup icon, heading "No classes today", subtext "Enjoy your free time!", button "View Tomorrow's Schedule →", counter "0 classes". (TC_TT_001) | Scenario 1; Empty State Presentation |
| TT-012 | TS_TT_02 | "View Tomorrow's Schedule →" selects the next day | Positive | P1 | As TT-011 | 1) Click "View Tomorrow's Schedule →". | - | Selection moves to the next calendar day (Fri 6): navy pill and dot move, subheader and counter update. (TC_TT_001) | Quick Navigation CTA |
| TT-013 | TS_TT_02 | Tomorrow shortcut on Sunday crosses into the next week | Positive | P2 | Faculty A, selected day = Sunday with 0 classes | 1) Click "View Tomorrow's Schedule →". | Sun 8 Nov 2026 | Selected day becomes Mon 9; the range label and strip move to "Nov 9 — Nov 15, 2026" (open question 5). | Quick Navigation CTA; BR-TT-04 |
| TT-014 | TS_TT_02 | Empty state is not shown when the day has classes | Negative | P1 | Faculty A has at least 1 lecture on the selected day | 1) Select that day. | - | No teacup, no "No classes today", no tomorrow button; lecture cards are shown. | Schedule State Management |
| TT-015 | TS_TT_02 | Empty state returns after moving from a busy day to a free day | Positive | P2 | Busy day and free day in the same week | 1) Select the busy day. 2) Select the free day. | - | Cards disappear, empty state appears, counter "0 classes". | Schedule State Management |
| TT-016 | TS_TT_02 | Empty state wording on a day that is not today | Positive | P3 | Selected day is not today and has 0 classes | 1) Select a future free day. | - | Story literal text is "No classes today". Verify and record the wording on non-today days (open question 6). | Empty State Presentation |

### TS_TT_03 Class counter and lecture cards (BR-TT-01)

| Test Case ID | Scenario ID | Title | Type | Priority | Preconditions | Steps | Test Data | Expected Result | Story Reference |
|---|---|---|---|---|---|---|---|---|---|
| TT-017 | TS_TT_03 | Counter equals the number of lecture cards | Positive | P1 | A day with 3 lectures | 1) Select the day. 2) Count cards. | 3 lectures | Counter "3 classes" and exactly 3 cards. | Class Counter Accuracy |
| TT-018 | TS_TT_03 | Counter accuracy on several days of the week | Positive | P2 | Days with 0, 1 and 3 lectures | 1) Select each day. | 0 / 1 / 3 | Counter equals the card count each time (singular wording for 1 is open question 7). | Class Counter Accuracy |
| TT-019 | TS_TT_03 | Counter equals the timetable data returned by the API | Positive | P2 | API/network capture available | 1) Open a busy day. 2) Compare counter with the lectures in the response. | - | Same number; no lecture of another faculty is counted. | Class Counter Accuracy; BR-TT-01 |
| TT-020 | TS_TT_03 | Lecture card shows the required fields | Positive | P1 | A day with a lecture | 1) Read the card. | Lecture: subject, course/batch, hall, time | Card shows Subject Name, Course/Subject code and Batch, Classroom/Hall (or Lab) number, Time slot and the attendance status (Marked / Unmarked). | Class Schedule Cards; Description point 2 |
| TT-021 | TS_TT_03 | Only the logged-in faculty's lectures are shown | Positive | P1 | Faculty A and Faculty B have different lectures the same day | 1) Log in as A, note cards. 2) Log in as B. | A and B | A sees only A's lectures, B only B's; no overlap unless the same lecture is shared. | BR-TT-01 |
| TT-022 | TS_TT_03 | Faculty cannot read another faculty's timetable by changing the request | Negative | P1 | Faculty A logged in, B's user id known | 1) Replay the timetable API call with B's id/identifier. | B's id | Request rejected (403) or returns only A's data; B's lectures are never shown. | BR-TT-01 |
| TT-023 | TS_TT_03 | Two lectures in the same day are shown in a stable, readable order | Positive | P3 | A day with 2+ lectures | 1) Select the day. | - | Cards are consistent between reloads (ordering rule is not stated: open question 8). | Class Schedule Cards |
| TT-024 | TS_TT_03 | Attendance status label Marked vs Unmarked | Positive | P2 | One lecture with attendance saved, one without | 1) View both cards. | - | Saved one shows "Marked", the other "Unmarked". | Class Schedule Cards: Attendance Status |
| TT-025 | TS_TT_03 | Timetable data load failure | Negative | P3 | Timetable API forced to fail (mock) | 1) Open `/timetable`. | HTTP 500 | The screen does not crash and does not show the false empty state "Enjoy your free time!" as if there were no classes (expected behaviour is not defined in the story: report as a question). | Not specified |

### TS_TT_04 Marking attendance (Scenario 2, TC_TT_002 to TC_TT_005, BR-TT-02, BR-TT-03)

| Test Case ID | Scenario ID | Title | Type | Priority | Preconditions | Steps | Test Data | Expected Result | Story Reference |
|---|---|---|---|---|---|---|---|---|---|
| TT-026 | TS_TT_04 | Mark Attendance during the active lecture opens the register | Positive | P1 | Lecture running now (S <= now <= E) | 1) Open the card. 2) Click "Mark Attendance". | Running lecture | Opens the attendance register for that lecture with its student roster loaded. (TC_TT_002) | Attendance Trigger; Scenario 2 |
| TT-027 | TS_TT_04 | Button enabled exactly from the scheduled start time | Positive | P1 | Lecture with S = 10:00 | 1) At 10:00:00 open the card. | now = S | "Mark Attendance" is enabled. | BR-TT-03 |
| TT-028 | TS_TT_04 | Button disabled one minute before start | Negative | P1 | Lecture with S = 10:00 | 1) At 09:59 open the card. 2) Click the button. | now = S - 1 min | Status "Upcoming", button disabled, nothing opens. | BR-TT-03; Future Date Guard |
| TT-029 | TS_TT_04 | Tomorrow's lecture is Upcoming and its button is disabled | Negative | P1 | A lecture scheduled for tomorrow | 1) Select tomorrow. 2) Inspect the card. 3) Click the button. | Tomorrow's lecture | "Upcoming" shown, attendance button disabled, no navigation. (TC_TT_005) | Scenario 3; Future Date Guard |
| TT-030 | TS_TT_04 | Disabled button becomes enabled when the start time arrives | Positive | P2 | Lecture starting in the next few minutes | 1) Keep the screen open until S. | - | Button enables at S (after refresh at the latest; note whether it updates live). | BR-TT-03 |
| TT-031 | TS_TT_04 | Attendance can be marked after the lecture, within the window | Positive | P1 | Lecture ended 10 h ago, unmarked | 1) Click "Mark Attendance". 2) Mark students and save. | E + 10 h | Register opens and saves; card becomes "Marked". | Scenario 2; BR-TT-02 |
| TT-032 | TS_TT_04 | Saved attendance can be edited 12 hours later | Positive | P1 | Lecture marked, now = E + 12 h | 1) Click "Edit Attendance". 2) Change one student. 3) Save. | E + 12 h | Editing allowed and the change is saved. (TC_TT_003) | Scenario 2; BR-TT-02 |
| TT-033 | TS_TT_04 | Button label changes from Mark to Edit after saving | Positive | P2 | Unmarked lecture inside the window | 1) Mark and save. 2) Return to the card. | - | Card shows "Marked" and the button reads "Edit Attendance". | Validations: Mark/Edit Attendance |
| TT-034 | TS_TT_04 | Last minute of the window still editable | Positive | P1 | Lecture marked, now = E + 23 h 59 m | 1) Open the card. 2) Edit and save. | E + 23:59 | Editing allowed and saved. | BR-TT-02 (boundary) |
| TT-035 | TS_TT_04 | Attendance locks at 24 hours after the end time | Negative | P1 | Lecture, now = E + 24 h 01 m | 1) Open the card. | E + 24:01 | "Locked" badge instead of Mark/Edit, button disabled or absent. (TC_TT_004) | BR-TT-02; Grace Period Lock Enforcement |
| TT-036 | TS_TT_04 | Lecture 25 hours after end is read-only | Negative | P1 | Lecture ended 25 h ago (marked and unmarked variants) | 1) Open the card. 2) Try to open the register (button, direct URL). | E + 25 h | Locked: register is read-only or not editable for Faculty; no save possible. | Scenario 2; BR-TT-02 |
| TT-037 | TS_TT_04 | Server rejects a late save even when the UI is bypassed | Negative | P1 | Lecture at E + 25 h; attendance save request captured earlier | 1) Replay the save request. | E + 25 h | Rejected (4xx); stored attendance unchanged. | BR-TT-02 |
| TT-038 | TS_TT_04 | Server rejects attendance for a future lecture | Negative | P1 | Lecture tomorrow | 1) Send the attendance save request for it. | S + 1 day | Rejected (4xx); nothing stored. | BR-TT-03 |
| TT-039 | TS_TT_04 | The 24 hours are counted from the END time, not the start | Positive | P2 | Lecture 10:00 to 11:00 | 1) Check at 10:30 next day (S + 24.5 h = E + 23.5 h). | next day 10:30 | Still editable; locks at 11:00 next day. | BR-TT-02 |
| TT-040 | TS_TT_04 | Lecture that ends after midnight | Positive | P3 | Lecture 23:00 to 00:30 | 1) Check status at several times. | - | Window runs from 00:30 + 24 h; card stays on the day it starts. | BR-TT-02 |
| TT-041 | TS_TT_04 | Locked state for an unmarked old lecture | Negative | P2 | Lecture ended 3 days ago, never marked | 1) Open the card. | - | "Locked" badge, no way for the faculty to mark. | Grace Period Lock Enforcement |
| TT-042 | TS_TT_04 | Faculty cannot open the register of another faculty's lecture | Negative | P1 | Lecture of Faculty B; Faculty A logged in | 1) Open the register URL/API of B's lecture. | B's lecture id | Denied (403/404); no roster shown. | BR-TT-01 |
| TT-043 | TS_TT_04 | Locked register after Academic Admin override | Positive | P2 | Lecture locked; Academic Admin account | 1) As Academic Admin, modify the locked register. 2) As Faculty, reopen it. | E + 25 h | Admin can modify (override); Faculty sees the updated data, still locked. The admin screen is not described: BLOCKED until defined (open question 2). | BR-TT-02 |
| TT-044 | TS_TT_04 | Time zone and clock source for the window | Negative | P3 | Browser clock set 1 day ahead / different time zone | 1) Open the card. | Wrong client clock | The lock/upcoming status follows the server (or university) time, not the browser clock. | BR-TT-02, BR-TT-03 |
| TT-045 | TS_TT_04 | Session expired while marking attendance | Negative | P3 | Open register, expire the session | 1) Save. | Expired token | Sign-in is requested and entered data is not silently lost or saved as another user. | Not specified |

## Where the story is unclear (questions for the team)

| # | Question | Why it matters |
|---|---|---|
| 1 | Where does the "Timetable" entry live and which roles see it? The story says "left-hand navigation sidebar" but the admin portal has none. | Decides how the faculty login is set up and whether admin should also see it. |
| 2 | BR-TT-02 says edits after 24 h "require Academic Admin override". Where does the Academic Admin do this (which screen, which API)? | TT-043 cannot be written. |
| 3 | Button names: description says "Mark Attendance", validations say "Mark/Edit Attendance", TC_TT_003 says "Edit Attendance". Badge names: Marked/Unmarked (card) vs Upcoming/Locked (validations). Is there a final list of card states? | Exact text for assertions. |
| 4 | After paging weeks, which day is selected (same weekday, Monday, or none)? | TT-005, TT-009. |
| 5 | "Tomorrow" from Sunday: does the strip jump to the next week? | TT-013. |
| 6 | Is "No classes today" shown for non-today days, or a different text? Subheader for non-today days (the story only shows "Today, 5 Nov 2026")? | TT-016, TT-008. |
| 7 | Counter wording for exactly one lecture ("1 classes" or "1 class")? | TT-018. |
| 8 | Ordering of lecture cards and behaviour for overlapping lectures. | TT-023. |
| 9 | Behaviour on data load error (no text defined). | TT-025. |
| 10 | QA FAILED: no comment or field says what failed. The team should state which scenario failed so it can be prioritised first. | Risk-based order of execution. |

## Notes for maintainers
- Run order for manual execution: TT-001 to TT-004, TT-011/012, TT-026, TT-029, TT-032, TT-035 (the five story TCs TC_TT_001..005 map to TT-011/012, TT-026, TT-032, TT-035, TT-029).
- Time-relative cases (TT-027 to TT-041) are best automated with seeded lectures created relative to "now" or a controllable server clock; hard-coded dates will go stale.
- When automated: page object `src/pages/TimetablePage.ts`, spec in this folder, API reads compared with the screen, mocks only for TT-016/TT-025. Attendance saves must run behind `guardWrites`, and any real save is gated by `ALLOW_TIMETABLE_WRITES=true` with clean-up (restore the original attendance).
- Remove the three TT-BLOCK tests (or invert them) once the module is reachable.
