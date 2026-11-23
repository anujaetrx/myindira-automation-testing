# Test cases: Admin > Acknowledgements

**Screen:** `/acknowledgements` (admin) on QA, `https://app-test.k.indiraiscm.com`
**Automation:** `tests/e2e/IUN3231-Acknowledgements/IUN3231-acknowledgements.spec.ts`, page object `src/pages/AcknowledgementsPage.ts`
**Source:** the team's sheet, scenarios TS_ACK_01 to TS_ACK_08 (rows visible in the screenshot only).
**Last run:** 2026-11-20, chromium, QA. 29 passed (incl. 8 known deviations), 1 skipped (gated), 0 failed.

Run: `npx playwright test tests/e2e/acknowledgements --project=chromium`
Gated publish test: `ALLOW_ACK_WRITES=true`. **Do not run casually**: there is no archive or delete for acknowledgements, and publishing creates an obligation for every user in the chosen audience.

## Coverage by sheet scenario

| Scenario | Sheet cases | Automated | Result |
|---|---|---|---|
| TS_ACK_01 list | default Pending + badge, card fields, deadline format, Completed empty state, zero pending | 6 | 5 pass, 1 known deviation. Completed *with* records not automated (no data). |
| TS_ACK_02 modal | "+" opens modal, Publish disabled | 1 | Pass |
| TS_ACK_03 Publish enablement | empty, missing title, missing description, whitespace, all valid | 5 | Pass |
| TS_ACK_03 | missing deadline, missing assign-to | 2 | **Known deviations** |
| TS_ACK_04 deadline | future, today, picker min, invalid text, leap day | 5 | Pass |
| TS_ACK_04 | manually typed past date rejected | 1 | **Known deviation** |
| TS_ACK_05 assign to | students / employees / both | 1 | Pass |
| TS_ACK_05 | uncheck all disables Publish | 1 | **Known deviation** |
| TS_ACK_06 lengths | 120 and 5000 accepted | 1 | Pass |
| TS_ACK_06 | 121 and 5001 blocked | 2 | **Known deviations** |
| TS_ACK_08 close | X discards draft, re-open is empty, nothing saved | 1 | Pass |
| TS_ACK_08 | backdrop dismisses modal | 1 | **Known deviation** |
| TS_ACK_07 publish | publish, card on top, badge +1 | 1 gated | **Not run** |

## Where the app differs from the sheet

| # | Sheet says | App does | Treated as |
|---|---|---|---|
| 1 | Missing Deadline: Publish disabled (BR-ACK-01) | Publish **enabled** with only Title + Description | **Defect**, `test.fail()` |
| 2 | Missing Assign To: Publish disabled | Publish enabled with nobody selected | **Defect** (same root cause as 1) |
| 3 | Uncheck all audiences: Publish disabled | Publish stays enabled | **Defect** (same root cause) |
| 4 | Manually typed past date rejected (BR-ACK-02) | Only the picker blocks past dates (`min` = today). A typed `2020-01-01` is accepted and Publish enables | **Defect** |
| 5 | Title 121 and description 5001 blocked or truncated | Both fully accepted | **Defect** |
| 6 | Backdrop click dismisses the modal | Modal stays open | **Defect** or design change, confirm |
| 7 | Zero pending shows badge "0 pending" | Badge hidden, text "No pending acknowledgement requests" shown | Deviation, confirm intended |
| 8 | Deadline shown "3/28/2026" | Same on cards. Inside the modal the field shows ISO `2027-12-30` | Info |

Whether the server rejects the cases in 1 to 5 is not verified, because that needs a real publish.

## Not automated

| Case | Why |
|---|---|
| Completed tab with records; request moves to Completed after 100% sign-off; stays Pending at 99% | Needs a user to acknowledge (student/employee account) or seeded completed data |
| Obligations generated per user (103 students / 406 total); dashboard counters | Needs DB access and the dashboard tile mapped |
| Double click on Publish creates one request | Writes data that cannot be removed |
| Toast "Acknowledgement request published" | Part of the gated test, text not yet captured |

## Notes for maintainers

- Deadline is a native `<input type="date">`: set it with ISO `yyyy-mm-dd`. Its `min` is today.
- Assign To checkboxes have `role=checkbox` but no `aria-checked`. A checked box renders icon glyph U+F0132; the page object reads that.
- The modal slides in over ~2 seconds, so the close X is clicked only after its position settles.
- The test browser window is 1280x720 (the `test.use` viewport does not reach the custom context), so coordinates are never hard-coded.

## Gap review against story IUN-3231 (2026-11-20)
Extra spec: `tests/e2e/IUN3231-Acknowledgements/IUN3231-acknowledgements.gap.spec.ts` (12 tests).

| Story item | Added | Result |
|---|---|---|
| Scenario 3 publish request | `POST /admin/acknowledgement-requests` body is exactly `{title, description, deadline (yyyy-mm-dd), targets}`; students only, employees only and both map to STUDENT / EMPLOYEE targets (`departmentId: null`) | Pass |
| Scenario 3 confirmation | modal closes and a toast shows; story wording "Acknowledgement request published successfully" | Toast says **"Acknowledgement request created successfully"**: wording deviation (low) |
| Scenario 3 list refresh | new request prepended to Pending and the counter goes up by one (list mocked before and after the publish) | Pass |
| Re-opening the modal after Publish | empty form, Publish disabled | Pass |
| BR-ACK-02 deadline | a future deadline is published as picked | Pass |
| BR-ACK-02 deadline of **today** must be allowed | Publish with today shows "Deadline must be a future date" and **sends nothing** | **Defect** (`test.fail`): the picker's own minimum is today, the story says today is valid |
| BR-ACK-04 Completed tab | requests with `acknowledgedByCurrentUser` move to Completed with a "Done" pill and "Acknowledged: M/D/YYYY"; the badge counts Pending only; empty Completed message returns | Pass (list mocked; shape taken from the real API) |
| Overdue request | a past deadline without sign-off stays Pending with its date | Pass |

Still not automated: BR-ACK-03 obligations generated per user and BR-ACK-04 "moves to Completed at 100% sign-off" (server-side, needs users who sign).
