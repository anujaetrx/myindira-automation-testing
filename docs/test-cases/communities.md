# Test cases: Admin > Communities (clubs and groups)

**Screen:** `/communities` (admin sidebar item "Communities") on QA, `https://app-test.k.indiraiscm.com`. Not the "Communities" tab inside Social Feed (`/feed`, see `social-feed.md`).
**Story:** IUN-3232 "Communities & Clubs Administration, Moderation & Lifecycle" (rules BR-COM-01 to BR-COM-04, scenarios 1 to 3, QA cases TC_COM_001 to TC_COM_005)
**Automation:** `tests/e2e/IUN3232-Communities/IUN3232-communities.spec.ts`, page object `src/pages/CommunitiesPage.ts`
**APIs seen:** `GET /admin/communities?page=0&size=20[&status=..][&type=..]`, `GET /admin/communities/stats`, `POST /admin/communities`, `POST /admin/communities/{id}/archive`, `POST /admin/communities/{id}/activate`
**Last run:** 2026-11-20, chromium, QA, 3 consecutive runs. 76 passed (incl. 12 known deviations), 0 failed, 1 skipped (gated real-server duplicate test, not run).

Run: `npx playwright test tests/e2e/communities --project=chromium --workers=2`
Nothing here changes data: every Archive / Activate / Create click runs behind `guardWrites` (answered locally) and the test asserts what the screen sent. Logo tests also block writes to the file-storage host.

## How the checks work
- **Real data:** QA returns 10 clubs, 0 groups, 3 archived (matches the story's example by chance). Tiles and cards are compared with the API, not with fixed numbers.
- **Mocked API:** pending / suspended cards, an empty list, 500 errors, a duplicate-name answer and counters that move after a write cannot be created safely on QA, so the list / stats / create calls are replaced by hand-built JSON. These tests check how the screen *renders* what it is given.
- **Known deviation:** `test.fail()`, green in the run, turns red when the app is fixed.

## Coverage

| Story item | Test(s) | Result |
|---|---|---|
| TC_COM_001 hub loads, six tiles | page loads; tiles equal `/stats` (real); any values (mocked); tiles agree with card list | Pass |
| TC_COM_001 banner "Review flagged posts" | opens the "Flagged posts" screen (Open / Resolved / All); back arrow returns | Pass |
| TC_COM_001 banner redirects to /reported-posts | | **Deviation** (1) |
| Sidebar item opens /communities, is not the Social Feed tab | sidebar click; no feed compose box on the page | Pass |
| Scenario / card directory | name, "Type · N Members · Status", button per card equal the API (real); green dot / grey dot; pending and suspended text; long name; unknown status | Pass |
| Empty and error states | empty list "No communities"; empty keeps tiles/filters/+ usable; list 500 and stats 500 do not crash | Pass |
| List 500 reported as an error | | **Deviation** (2) |
| TC_COM_005 status filter | Active, Pending, Archived, Suspended send `status=ACTIVE / PENDING_APPROVAL / ARCHIVED / SUSPENDED` and show only that status (real); one chip selected at a time; "All" resets | Pass |
| TC_COM_005 type filter | Clubs / Groups send `type=CLUB / GROUP`, only that type (real); "All types" resets | Pass |
| TC_COM_005 combined | Archived + Groups, Archived + Clubs send both params and show only archived of that type (real); Archived chip count = Archived tile | Pass |
| TC_COM_005 search | no search box exists on the screen | Pass (documents the absence) |
| TC_COM_004 / BR-COM-04 Archive | `POST /admin/communities/{id}/archive` body `{}` on the clicked card; list and stats reload; card turns Archived with grey dot and "Activate", Archived tile +1 (server answer mocked) | Pass |
| TC_COM_004 / BR-COM-04 Activate | `POST .../activate`; card turns Active (green dot, "Archive"), Archived tile down (mocked) | Pass |
| Archive/Activate failure | 500 on archive keeps the card as it was, no crash | Pass |
| Archive asks for confirmation (brief: native confirm) | no dialog fires; request is sent on the first click | **Deviation** (3) |
| Archive on pending / suspended cards | button is "Archive", sends the archive call (mocked) | Pass |
| Approve / Reject / Suspend / Restore actions | no such controls | **Deviation** (4) |
| Scenario 1 / TC_COM_002 modal | `+` opens "New community": Club and Public preselected, 0/300, Upload logo; pills switch; counter live, stops at 300 | Pass |
| Scenario 1 Create disabled when invalid | | **Deviation** (5) |
| Scenario 1 Create enabled when Name >= 3 and Description >= 10 | boundary 3 / 10 sends the request | Pass |
| BR-COM-01 Name < 3 | "AI" blocked, message "Name must be at least 3 characters.", nothing sent | Pass |
| BR-COM-01 empty form, spaces only | "This field is required." twice, nothing sent | Pass |
| BR-COM-01 hint wording "Minimum 3 characters required" / "Minimum 10 ..." | | **Deviation** (6) |
| BR-COM-01 Description < 10 ("Hello", 9 chars) | | **Deviation** (7) |
| BR-COM-01 Name max 100 | | **Deviation** (8) |
| BR-COM-03 visibility / type payload | default CLUB + PUBLIC without category; GROUP + RESTRICTED / PRIVATE + category | Pass |
| Create refresh | modal closes, list and stats reload | Pass |
| Scenario 2 / TC_COM_003 / BR-COM-02 duplicate | server answer "A community with this name already exists." (mocked 409) shown with Dismiss, modal stays open with the typed values; Dismiss hides it; other 500 keeps the modal open | Pass (mocked) |
| TC_COM_003 real server duplicate, case-insensitive | gated, see "Not automated" | Not run |
| Close X | closes without a write, form is empty when reopened | Pass |
| Logo PNG | label turns "Change logo", Create carries `coverImageKey` | Pass |
| Logo rules (PNG/JPG/JPEG/WEBP, max 5 MB) | .txt, .gif and 6 MB files are accepted | **Deviation** (9) |

## Where the app differs from the story

| # | Expected | Actual | Severity guess |
|---|---|---|---|
| 1 | Banner "Review flagged posts" redirects to `/reported-posts` (TC_COM_001, functional scope) | It opens a "Flagged posts" screen (Open / Resolved / All, back arrow) but the address stays `/communities`; the sidebar "Reported Posts" is a different screen | Low to medium: confirm which screen is intended; the deep link does not work |
| 2 | A failed list call is an error | A 500 on the list shows "No communities", the same as an empty directory (seen with a mocked 500) | Medium |
| 3 | Archive / Activate are deliberate state changes (brief: confirmation by native confirm; the story only says "clicking Archive") | First click sends the request, no confirmation, no undo | Medium: one mis-click archives a club and hides it from discovery |
| 4 | Lifecycle covers create / approve / reject / suspend / archive / restore (QA brief). The story only defines Archive / Activate | Pending cards offer only "Archive"; no Approve, Reject or Suspend anywhere, so "Pending" and "Suspended" communities cannot be processed from this screen. Pending / Suspended filters and tiles exist | Medium: confirm scope; story gap |
| 5 | Create stays disabled until Name >= 3 and Description >= 10 (BR-COM-01) | Create is always enabled; pressing it validates and shows messages | Low |
| 6 | Hints "Minimum 3 characters required" (Name) and "Minimum 10 characters required" (Description) | Name: "Name must be at least 3 characters."; Description: only "This field is required." when empty, no hint for 1-9 characters | Low |
| 7 | Description needs at least 10 characters | A 9-character ("too short") and a 5-character description are sent and accepted by the screen (the request was seen being sent; the server reply was mocked in the run) | Medium: BR-COM-01 not enforced, at least not in the UI |
| 8 | Name max 100 characters | Field accepts 120 (`maxlength=120`) and sends them | Low |
| 9 | Logo accepts PNG, JPG, JPEG, WEBP up to 5 MB | A .txt, a .gif and a 6 MB PNG all turn the label to "Change logo" with no message | Medium: no client check (the server may still refuse on Create; not tested with writes) |
| 10 | KPI "Review" / "Open flags" (story: Review (0)) | Tile "Review" = `postsUnderReview`. The story does not say what it counts | Info |
| 11 | Clubs tile counts all clubs? | Tile "Clubs" = 10 equals the ACTIVE clubs only (12 clubs exist incl. 2 archived); "Groups" likewise counts active groups | Info: confirm intended |
| 12 | Cards 'Club · 1 Members' | "1 Members" (plural word for one member) | Low (cosmetic) |
| 13 | Status "Pending" etc. | A community whose status is not one of ACTIVE / ARCHIVED / PENDING_APPROVAL / SUSPENDED shows an empty status word (mocked DRAFT / REJECTED) | Info |

## Not automated

| Case | Why |
|---|---|
| TC_COM_003 real duplicate (creating "robotics club" when "Robotics Club" exists), case-insensitive and across archived clubs (BR-COM-02) | If the server accepted it, a real club would be created and the admin screen has no delete (only Archive). A gated test exists (`ALLOW_COMMUNITIES_WRITES=true`), uses the first listed club name in upper case, and is **not run**. Without it only the screen's reaction to the server message is proved (mocked 409) |
| Real Archive then Activate round trip (TC_COM_004 end to end, KPI really increments) | Would change a real club on a shared QA environment. Covered by asserting the exact requests plus mocked follow-up state |
| Real Create (new club appears in the directory, KPI updates, logo uploaded to storage) | Creates data that cannot be deleted from the admin; covered by payload assertions |
| Archived community hidden from public discovery and posting disabled (BR-COM-04) | Needs a student / employee account (only admin exists) |
| BR-COM-03 meaning of Public / Restricted / Private for joiners (open / owner approval / invite-only) | Needs a student account; only the payload `visibility` is verified. Seen in API data: PRIVATE -> INVITE_ONLY, RESTRICTED -> REQUEST_TO_JOIN |
| Pending approval / reject / suspend flows, owner approval | No such controls on the screen (deviation 4) |
| Moderation depth (resolving flags, Open flags tile after a flag is raised) | Needs flagged posts, i.e. a user account that flags content; the Flagged posts screen is opened and its filters checked only. Open flags / Review tiles are checked with mocked non-zero values |
| Pagination beyond 20 communities | QA has 13 communities; the screen sends `size=20` and no page control exists. Not tested |
| Access by roles other than Admin | No other accounts |

## Notes for maintainers
- Card text is lower-case in the DOM and capitalised by CSS ("members" in `textContent`, "Members" in `innerText`). Locators use case-insensitive regexes.
- Cards, chips and buttons are `div[tabindex="0"]`. The Archive / Activate button of card N is the Nth button on the screen (one per card, in order).
- The archived dot is slate grey rgb(95,122,142), active green rgb(46,125,50), pending amber, suspended red.
- The "Flagged posts" screen is drawn over the hub (the hub stays in the DOM, hidden): use `.filter({ visible: true })`.
- The create modal's Name input is the first `input`, Category the second, Description the only `textarea`.
- No non-GET call was seen when a logo was chosen (the storage key is sent with Create); the logo tests still block every non-GET call to hosts other than the app's own, so a real upload cannot happen.
- The machine is shared with other agents: runs can be slow; re-run on a timeout.
