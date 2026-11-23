# Test cases: Admin > Policies

**Screen:** `/policies` (admin) on QA, `https://app-test.k.indiraiscm.com`
**Automation:** `tests/e2e/IUN3239-Policies/IUN3239-policies.spec.ts`, page object `src/pages/PoliciesPage.ts`
**Source:** the team's sheet, scenarios TS_POL_01 to TS_POL_09 (rows visible in the screenshot only).
**Last run:** 2026-11-20, chromium, QA. 40 passed (incl. 4 known deviations), 1 skipped (gated), 0 failed.

Run: `npx playwright test tests/e2e/policies --project=chromium`
Gated publish/archive test: set `ALLOW_POLICY_WRITES=true` (publishes one `AUTOTEST policy <time>` and archives it again).

## Coverage by sheet scenario

| Scenario | Sheet cases | Automated | Result |
|---|---|---|---|
| TS_POL_01 list | cards, count, drill-down, empty state | 4 | Pass. Empty state is simulated by mocking the list API. |
| TS_POL_02 filter | open, search, no match, select, reset, source = Master Data | 6 | Pass |
| TS_POL_03 tracker | 0/4, 1/4..4/4, clear, 3/4, whitespace | 5 | Pass |
| TS_POL_04 department | single select, switch, Master Data pills, none selected | 4 | Pass |
| TS_POL_05 audience | toggles, uncheck all | 2 | Pass |
| TS_POL_06 attachment | 8MB PDF, DOC/DOCX/JPG/PNG, remove, 15MB, .exe, 10MB boundary | 9 | Pass (messages differ, see below) |
| TS_POL_07 lengths | 5/20 and 150/10000 accepted; 4, 151, 19, 10001 rejected | 6 | 2 pass, **4 known deviations** |
| TS_POL_08 publish | close without saving | 1 | Pass |
| TS_POL_08 publish | publish valid policy | 1 gated | Pass (run 2026-11-20). Attachment and double click not covered. |
| TS_POL_09 archive | confirmation prompt, cancel | 1 | Pass |
| TS_POL_09 archive | confirm, count -1, hidden after reload | in the gated test | Pass (run 2026-11-20) |

## Where the app differs from the sheet

| # | Sheet says | App does | Treated as |
|---|---|---|---|
| 1 | "7 policies" | Count follows the data (8 on QA today) | Test compares header with the number of cards, not a fixed number |
| 2 | "Detail **drawer** opens" | Full screen "Policy" with a back arrow, Policy Information, Policy Content, Download PDF | Test asserts the real screen. Confirm intended design. |
| 3 | Error "File exceeds 10MB limit or invalid format" | Two toasts: "Document must be 10 MB or smaller" and "Only PDF, DOC, DOCX, JPG and PNG files are allowed" | Test asserts the real texts. Update the sheet or the copy. |
| 4 | "Are you sure you want to archive this policy?" | Native browser confirm: `Archive policy "<title>"?` | Test asserts the real text |
| 5 | Title 5..150 and content 20..10000 enforced | **No limits.** 4 and 151 char titles and 19 and 10001 char content enable Publish | **Defect**, kept as `test.fail()` (turns red when fixed). The server may still reject; unverified because that needs a publish. |
| 6 | Tracker counts a step when valid | Counts a step as soon as the field is non-empty and not only spaces (title "ab" gives 1/4) | Same root cause as 5 |
| 7 | Search "Computer" lists one department | Search is substring: 4 departments match | Test asserts every result contains the text |
| 8 | Filter and modal lists come from Master Data | True, they show the full Master Data list (64 on QA) | Pass |

## Not automated (needs something we do not have)

| Case | Why |
|---|---|
| Student-targeted policy visible to students, not employees; both audiences visible to both | No Student/Employee test account (only ADMIN is configured) |
| Archived policy kept in DB/audit log; dashboard count decrements | Needs DB or audit-log access, and the dashboard tile is not yet mapped |
| Double click on Publish creates one policy | Writes data; add to the gated group once the publish test has been run once |
| Publish toast text and card at top | Part of the gated test; toast text not yet captured |

## Notes for maintainers

- The app is React Native Web. Several controls are plain `div`s without roles (round "+" button, modal close X, Archive, department pills, audience cards), so the page object clicks them by position/text with `clickThrough`.
- Archive uses a native `confirm()`: Playwright auto-dismisses it, so the helper registers a dialog handler before clicking.
- Icon-font glyphs count as text; `clean()` in the page object strips them when reading cards and lists.
- The screen has no un-archive, so every gated run leaves one archived `AUTOTEST` policy behind.

## Gap review against story IUN-3239 (2026-11-20)
Extra spec: `tests/e2e/IUN3239-Policies/IUN3239-policies.gap.spec.ts` (16 tests). The sheet-based spec follows the team's sheet; this one adds what the story requires and the sheet did not cover.

| Story item | Added | Result |
|---|---|---|
| Scenario 1 / BR-POL-01 tracker rule (title >= 5, content >= 20) | 5 tests, incl. story QA case TC_POL_002 (4 + 15 chars must stay 0/4) | 2 pass, **3 deviations** (any non-empty value ticks a step; same defect as IUN-3313) |
| BR-POL-02 Publish exactly at 4/4 | 1 | Pass |
| Publish request (TC_POL_004 / sheet TS_POL_08) | `POST /admin/policies` body: title, content, `issuingDepartmentId` (equals the Master Data id), `effectiveDate` and `deadline` (both default to today, the form has no date field), `targets` (STUDENT, EMPLOYEE, or both) | Pass |
| Publish confirmation | modal closes and a success toast shows; wording "Policy published successfully" (sheet) | Toast shows **"Policy created successfully"**: wording deviation (low) |
| TC_POL_005 Archive | confirm sends `POST /admin/policies/{id}/archive` for exactly that policy | Pass |
| List / filter | header count equals the API total; filtered count equals the cards shown | Pass |
| Detail screen | labels Department, Effective Date, Published By, Published On, Policy Content; Back arrow returns to the list | Pass |
| Download PDF | button opens a **new window** with the policy (it is not a file download) | Pass (behaviour documented) |

Still not automated: BR-POL-04 soft-archive audit trail (database), student/employee visibility of a published policy (no such accounts).
