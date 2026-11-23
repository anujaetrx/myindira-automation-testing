# Test case catalogue: IUN-3232 Communities & Clubs Administration, Moderation & Lifecycle

- **Story:** IUN-3232 "Communities & Clubs Administration, Moderation & Lifecycle" (rules BR-COM-01 to BR-COM-04, QA cases TC_COM_001 to TC_COM_005)
- **Module / screen:** Admin > Communities (`/communities`), not the Communities tab of Social Feed (`/feed`)
- **Environment:** QA, `https://app-test.k.indiraiscm.com`, signed in as ADMIN
- **Spec:** `tests/e2e/IUN3232-Communities/IUN3232-communities.spec.ts` (page object `src/pages/CommunitiesPage.ts`)
- **Summary doc:** `docs/test-cases/communities.md`
- **Date:** 2026-11-20
- **Last run:** chromium, QA, 3 consecutive runs: all green. 75 tests in the spec: 62 pass, 12 known defects (expected fail), 1 gated (not run), 0 failed.
- **Test case IDs:** taken from the test title. Many tests share one story id (e.g. TC_COM_001), so a ` #n` suffix (file order within the id) is added here to make each row unique. Tests with no id in the title are numbered `COM-001` .. `COM-004` (the four Logo tests, in file order).

**Type:** Positive / Negative / Boundary / Known defect (`test.fail`, green while the app is wrong) / Gated (real write, not run) / Mocked API (the list, stats or write answer is replaced by hand-built JSON, so the test proves how the screen renders it).
**Result:** `Pass`; `Known defect (expected fail)`; `Gated, not run`; `Skipped`.
**Safety:** every Archive / Activate / Create click runs behind `guardWrites` (answered locally, recorded, asserted). Logo tests also block writes to the file-storage host. Nothing changes real clubs.

## Story scenarios and business rules covered

| Story scenario / rule | Test ids |
|---|---|
| TC_COM_001 hub, tiles, banner, sidebar | TC_COM_001 #1 to #9, TC_COM_001 #10 (sidebar click) |
| TC_COM_002 / Scenario 1 directory cards, empty and error states, New community modal | TC_COM_002 #1 to #16 |
| TC_COM_003 / BR-COM-02 duplicate name | BR-COM-02 #1 to #3, TC_COM_003 #1 (gated) |
| TC_COM_004 / BR-COM-04 Archive / Activate lifecycle | TC_COM_004 #1 to #12 |
| TC_COM_005 status and type filters | TC_COM_005 #1 to #14 |
| BR-COM-01 name and description validation | BR-COM-01 #1 to #11, TC_COM_001/BR-COM-01 |
| BR-COM-03 type and visibility payload | BR-COM-03 #1 to #3 |
| Logo rules (PNG, JPG, JPEG, WEBP, max 5 MB) | COM-001 to COM-004 |

## Test cases

### TS_COM_01 Hub, tiles, banner (TC_COM_001)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_COM_001 #1 | Page loads with six tiles, flagged-posts banner, both filter rows, cards and the + button | Positive | ADMIN; real QA data | 1. Open `/communities`, wait for list and stats calls.<br>2. Read the six tiles.<br>3. Look for the status chips and type chips. | Path is `/communities`; each of the six tiles shows a number; chips All, Active, Pending, Archived, Suspended and All types, Clubs, Groups are visible; at least one card is visible. | Pass | - |
| TC_COM_001 #2 | The sidebar item "Communities" is the active one and the page is not the Social Feed tab | Negative | ADMIN | 1. Open `/communities`.<br>2. Look for Social Feed texts. | "What's on your mind?" and "Birthdays" are not on the page. | Pass | - |
| TC_COM_001 #3 | The six tiles equal GET /admin/communities/stats (real data) | Positive | ADMIN; real stats response | 1. Open the screen, capture the stats response.<br>2. Read all tiles. | Clubs = totalClubs, Groups = totalGroups, Pending = pendingApproval, Archived = archived, Open flags = openFlags, Review = postsUnderReview. | Pass | - (informational: the Clubs/Groups tiles count active only and the meaning of "Review" is unclear; none raised) |
| TC_COM_001 #4 | Tiles render any values the API returns (mocked, non-zero, multi-digit) | Mocked API | Stats mocked: 12 / 7 / 3 / 120 / 5 / 4 | 1. Open the screen.<br>2. Read the tiles. | Tiles show 12, 7, 3, 120, 5, 4. | Pass | - |
| TC_COM_001 #5 | Tile figures agree with the card list: Archived tile = archived rows, Groups tile = active groups (real data) | Positive | Real list (first page); skipped if 20 or more rows | 1. Open the screen, capture list and stats.<br>2. Compare counts. | Archived tile = archived rows; Clubs tile = ACTIVE CLUB rows; Groups tile = ACTIVE GROUP rows. | Pass | - |
| TC_COM_001 #6 | The list is requested with page=0&size=20 and no filter on open | Positive | ADMIN | 1. Open the screen, capture the list request. | `page=0`, `size=20`, no `status`, no `type` parameter. | Pass | - |
| TC_COM_001 #7 | "Review flagged posts" banner opens the Flagged posts screen (Open / Resolved / All) | Positive | ADMIN | 1. Open the screen.<br>2. Click the banner. | A "Flagged posts" title shows with the filters Open, Resolved, All. | Pass | - |
| TC_COM_001 #8 | Banner redirects to /reported-posts (story) | Known defect | ADMIN | 1. Open the screen.<br>2. Click the banner.<br>3. Read the address. | Expected: address becomes `/reported-posts`. Actual (defect): the Flagged posts screen opens but the address stays `/communities`. | Known defect (expected fail) | IUN-3391 |
| TC_COM_001 #9 | Flagged-posts screen: back arrow returns to the communities hub | Positive | ADMIN | 1. Open the banner screen.<br>2. Click the back arrow. | Flagged posts title is hidden; "Review flagged posts" banner is visible again. | Pass | - |
| TC_COM_001 #10 | The sidebar item "Communities" opens /communities (TS_COM_06 access) | Positive | ADMIN, starting on `/policies` | 1. Click the sidebar item "Communities". | "Review flagged posts" is visible and the path is `/communities`. | Pass | - |

### TS_COM_02 Community cards (TC_COM_002)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_COM_002 #1 | Every card shows name, "Type · N Members · Status" and the lifecycle button; all match the API (real data) | Positive | ADMIN; real list | 1. Open the screen, capture the list.<br>2. Read every card. | Per card: name, type (Club/Group), member count and status word equal the API; button is "Activate" for ARCHIVED, otherwise "Archive". | Pass | - |
| TC_COM_002 #2 | Active card has a green dot and "Archive"; archived card has a grey dot and "Activate" (mocked) | Mocked API | List mocked: one ACTIVE, one ARCHIVED club | 1. Open the screen.<br>2. Read cards and dot colours. | Live club: Active, Archive, green dot. Old club: Archived, Activate, grey dot. | Pass | - |
| TC_COM_002 #3 | The member count and type are written as "1 Members" / "Group" (singular count keeps the plural word) | Mocked API | List mocked: club with 1 member, group with 0 | 1. Open the screen.<br>2. Read both cards. | Card 1: Club, 1 member; card 2: Group, 0 members. Documents the wording "1 Members". | Pass | - (informational "1 Members" wording; none raised) |
| TC_COM_002 #4 | Pending and suspended cards show their status text (mocked) | Mocked API | List mocked: PENDING_APPROVAL and SUSPENDED | 1. Open the screen.<br>2. Read status and dot colours. | "Pending" and "Suspended"; the two dots differ and neither is green. | Pass | - |
| TC_COM_002 #5 | A long community name does not break the card or hide the lifecycle button (mocked) | Boundary | One club with a name of about 150 characters (mocked) | 1. Open the screen.<br>2. Check the button position and the name. | Button visible and inside 1280 px; name shown in full. | Pass | - |
| TC_COM_002 #6 | Empty list shows "No communities" (mocked) | Mocked API | List mocked empty | 1. Open the screen. | "No communities" visible, zero cards. | Pass | - |
| TC_COM_002 #7 | Empty list keeps tiles, banner, filters and the + button usable (mocked) | Mocked API | List mocked empty | 1. Open the screen.<br>2. Click +. | "New community" modal opens. | Pass | - |
| TC_COM_002 #8 | List API error: the screen does not crash and shows no cards (mocked 500) | Mocked API | List returns 500 | 1. Open the screen. | Zero cards; "Review flagged posts" banner still visible. | Pass | - |
| TC_COM_002 #9 | List API error is reported as an error, not as an empty directory (mocked 500) | Known defect | List returns 500 | 1. Open the screen.<br>2. Look for "No communities". | Expected: an error message, not the empty-directory text. Actual (defect): a failed list call shows "No communities" (no error, no retry). | Known defect (expected fail) | IUN-3392 |
| TC_COM_002 #10 | Stats API error: tiles do not crash the page and the cards still load (mocked 500) | Mocked API | Stats returns 500 | 1. Open the screen. | First card still visible. | Pass | - |
| TC_COM_002 #11 | The + button opens "New community" with Club and Public preselected and a 0/300 counter | Positive | ADMIN | 1. Open the screen, click +. | Modal title and Create button visible; pills Club, Group, Public, Restricted, Private visible; "0/300"; Club and Public filled differently from the others; label "Upload logo"; Name and Description empty. | Pass | - |
| TC_COM_002 #12 | The type pills switch Club / Group and the visibility pills switch Public / Restricted / Private | Positive | ADMIN | 1. Open the modal.<br>2. Click Group, then Restricted, then Private. | Selected pill takes the selected fill and the previous one loses it. | Pass | - |
| TC_COM_002 #13 | The character counter follows the description live and stops at 300 | Boundary | ADMIN | 1. Type "Hello": counter.<br>2. Type 350 characters. | "5/300", then "300/300"; value length 300; `maxlength` is 300. | Pass | - |
| TC_COM_002 #14 | After a successful Create the modal closes and the list and tiles are reloaded (write blocked) | Positive | Write guarded | 1. Fill valid name and description.<br>2. Click Create. | One write sent; list and stats are requested again; modal closed. | Pass | - |
| TC_COM_002 #15 | The X closes the modal without sending anything and the form is empty on reopening | Positive | ADMIN | 1. Fill name and description.<br>2. Click X.<br>3. Reopen. | Modal closes; Name and Description empty on reopening. | Pass | - |
| TC_COM_002 #16 | Closing the modal sends no write call | Negative | Write guarded | 1. Fill the form.<br>2. Click X, wait. | No write recorded. | Pass | - |


The TC_COM_002 rows #11 to #16 are the "New community" modal tests that carry the TC_COM_002 id (they sit in the TS_COM_05 describe block of the spec).

### TS_COM_03 Filters (TC_COM_005)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_COM_005 #1 | Default selection is "All" statuses and "All types", filled differently from the other chips | Positive | ADMIN | 1. Open the screen.<br>2. Compare chip backgrounds. | "All" differs from "Active"; "All types" differs from "Clubs". | Pass | - |
| TC_COM_005 #2 | Status chip "Active" requests status=ACTIVE and shows only matching cards (real data) | Positive | Real data | 1. Click the Active chip, capture the request.<br>2. Read the cards. | `status=ACTIVE`, no `type`; every card is Active (or "No communities"); chip highlighted. | Pass | - |
| TC_COM_005 #3 | Status chip "Pending" requests status=PENDING_APPROVAL and shows only matching cards (real data) | Positive | Real data | As #2 with Pending. | `status=PENDING_APPROVAL`, no `type`; only Pending cards or "No communities". | Pass | - |
| TC_COM_005 #4 | Status chip "Archived" requests status=ARCHIVED and shows only matching cards (real data) | Positive | Real data | As #2 with Archived. | `status=ARCHIVED`; only Archived cards. | Pass | - |
| TC_COM_005 #5 | Status chip "Suspended" requests status=SUSPENDED and shows only matching cards (real data) | Positive | Real data | As #2 with Suspended. | `status=SUSPENDED`; only Suspended cards or "No communities". | Pass | - |
| TC_COM_005 #6 | Type chip "Clubs" requests type=CLUB and shows only Club cards (real data) | Positive | Real data | 1. Click Clubs, capture the request.<br>2. Read cards. | `type=CLUB`, no `status`; only Club cards. | Pass | - |
| TC_COM_005 #7 | Type chip "Groups" requests type=GROUP and shows only Group cards (real data) | Positive | Real data (QA has no groups) | As #6 with Groups. | `type=GROUP`, no `status`; only Group cards or "No communities". | Pass | - |
| TC_COM_005 #8 | "Archived" + "Groups" combine: both params sent, only archived groups shown (real data) | Positive | Real data | 1. Click Archived, then Groups. | `status=ARCHIVED` and `type=GROUP`; any card is Group, Archived, Activate. | Pass | - |
| TC_COM_005 #9 | "Archived" + "Clubs" shows only archived clubs (real data) | Positive | Real data | 1. Click Archived, then Clubs. | `type=CLUB`; at least one card; all Club, Archived, Activate. | Pass | - |
| TC_COM_005 #10 | "All" and "All types" remove the filters again and the full directory is back | Positive | Real data | 1. Filter Archived + Clubs.<br>2. Click All and All types. | Fewer cards while filtered; then the same names, in the same order, as the unfiltered list. | Pass | - |
| TC_COM_005 #11 | A filter with no match shows "No communities" (Suspended) | Mocked API | List mocked empty | 1. Open, click Suspended. | "No communities" visible. | Pass | - |
| TC_COM_005 #12 | Only one status chip is selected at a time | Positive | ADMIN | 1. Click Active.<br>2. Compare chip fills. | All and Archived differ from the selected Active chip. | Pass | - |
| TC_COM_005 #13 | The Archived chip lists exactly as many cards as the Archived tile says (real data) | Positive | Real data | 1. Read the Archived tile.<br>2. Click Archived, count cards. | Card count = tile value. | Pass | - |
| TC_COM_005 #14 | There is no search box on this screen | Negative | ADMIN | 1. Open the screen.<br>2. Look for inputs. | No visible input and no search placeholder (documents the absence). | Pass | - |

### TS_COM_04 Lifecycle Archive / Activate (TC_COM_004, BR-COM-04)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_COM_004 #1 | Archive on an active club sends POST /admin/communities/{id}/archive with an empty body (real card, write blocked) | Positive | Real list; write guarded; skipped if no active community | 1. Click Archive on the first active card. | One write: `POST /admin/communities/{id}/archive`, body `{}`. | Pass | - |
| TC_COM_004 #2 | Activate on an archived club sends POST /admin/communities/{id}/activate (real card, write blocked) | Positive | Real list; write guarded; skipped if no archived community | 1. Click Activate on the first archived card. | One write: `POST .../activate`, body `{}`. | Pass | - |
| TC_COM_004 #3 | Archive acts on the clicked card only (second card of a mocked list) | Mocked API | Two clubs, ids 11 and 22; write guarded | 1. Click the button of card 2. | One write to `/admin/communities/22/archive`. | Pass | - |
| TC_COM_004 #4 | Archive and Activate run at once: no native confirmation dialog is shown | Mocked API | One active, one archived card; write guarded; dialog listener | 1. Click the action of card 1, then card 2. | Two writes are sent; no dialog appeared. Documents the missing confirmation. | Pass | - |
| TC_COM_004 #5 | After Archive the screen reloads the list and the stats (write blocked) | Positive | One mocked card; write guarded | 1. Click Archive. | List and stats are requested again; one write. | Pass | - |
| TC_COM_004 #6 | After Archive the card turns Archived (grey dot, "Activate") and the Archived tile goes up by one (server state mocked) | Mocked API | List and stats change after the click (3 to 4 archived) | 1. Click Archive.<br>2. Read card and tiles. | Card Archived with Activate and grey dot; Archived tile 4; Clubs tile 0. | Pass | - |
| TC_COM_004 #7 | After Activate the card turns Active again (green dot, "Archive") and the Archived tile goes down (server state mocked) | Mocked API | Server state mocked (1 to 0 archived) | 1. Click Activate. | Card Active with Archive and green dot; Archived tile 0. | Pass | - |
| TC_COM_004 #8 | A failed Archive (mocked 500) does not crash the screen and keeps the card as it was | Mocked API | Archive call returns 500 | 1. Click Archive, wait. | One card remains, still "Stay", Active. | Pass | - |
| TC_COM_004 #9 | Archive asks for confirmation before changing a real club | Known defect | Mocked card; write guarded; dialog listener | 1. Click Archive.<br>2. Dismiss any dialog. | Expected: a confirmation appears and nothing is sent when dismissed. Actual (defect): the request fires on the first click with no confirmation. | Known defect (expected fail) | IUN-3393 |
| TC_COM_004 #10 | Pending and suspended communities offer "Archive" and send the archive call (mocked) | Mocked API | PENDING_APPROVAL (id 31) and SUSPENDED (id 32); write guarded | 1. Read the buttons.<br>2. Click both. | Both buttons say Archive; writes to `/admin/communities/31/archive` and `/32/archive`. | Pass | - |
| TC_COM_004 #11 | Approve / Reject (pending) and Suspend / Restore controls | Known defect | Pending and active cards (mocked) | 1. Open the screen.<br>2. Look for Approve, Reject, Suspend. | Expected: Approve and Reject on a Pending card, Suspend / Restore available. Actual (defect): none of these controls exist; only Archive / Activate. | Known defect (expected fail) | IUN-3394 (needs confirmation) |
| TC_COM_004 #12 | A community with an unknown status shows an empty status word (mocked DRAFT) | Mocked API | One card with status DRAFT | 1. Open the screen.<br>2. Read the card. | Name "Odd", empty status word, button Archive. Documents behaviour. | Pass | - (informational; none raised) |

### TS_COM_05 "New community" modal (TC_COM_002, BR-COM-01, BR-COM-02, BR-COM-03, logo)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_COM_001/BR-COM-01 | Create stays disabled while Name < 3 or Description < 10 (story scenario 1) | Known defect | ADMIN | 1. Open the modal.<br>2. Type name "AI" and description "Hello". | Expected: Create button disabled. Actual (defect): Create is always enabled; validation runs when pressed. | Known defect (expected fail) | IUN-3395 |
| BR-COM-01 #1 | Create becomes enabled once Name >= 3 and Description >= 10 (story scenario 1) | Positive | ADMIN | 1. Type "AIC" and "0123456789". | Create is enabled. | Pass | - |
| BR-COM-01 #2 | Empty form: Create sends nothing and both fields show "This field is required." | Negative | Write guarded | 1. Click Create on the empty form. | No write; "This field is required." shown twice; modal stays open. | Pass | - |
| BR-COM-01 #3 | Name of 2 characters ("AI") is refused with "Name must be at least 3 characters." and nothing is sent | Negative | Write guarded | 1. Name "AI", valid description.<br>2. Click Create. | No write; modal text contains "Name must be at least 3 characters." | Pass | - |
| BR-COM-01 #4 | The hint appears as soon as 1-2 characters are typed in Name | Positive | ADMIN | 1. Type "A" in Name.<br>2. Focus the Description. | "Name must be at least 3 characters." appears. | Pass | - |
| BR-COM-01 #5 | Hint wording is "Minimum 3 characters required" / "Minimum 10 characters required" (story) | Known defect | ADMIN | 1. Name "AI", description "Hello".<br>2. Focus Category. | Expected: both story hints shown. Actual (defect): wording is "Name must be at least 3 characters." and there is no hint for a short Description. | Known defect (expected fail) | IUN-3396 |
| BR-COM-01 #6 | Description of 9 characters is refused and nothing is sent (TC_COM_002: 8 chars) | Known defect | Write guarded | 1. Name "Valid name", description "123456789".<br>2. Click Create. | Expected: refused, no write. Actual (defect): a 9-character description is accepted and `POST /admin/communities` is sent. | Known defect (expected fail) | IUN-3397 |
| BR-COM-01 #7 | Description of 5 characters ("Hello", story scenario 1) is refused and nothing is sent | Known defect | Write guarded | 1. Name "Hello club", description "Hello".<br>2. Click Create. | Expected: refused, no write. Actual (defect): the short description is accepted and the request is sent. | Known defect (expected fail) | IUN-3397 |
| BR-COM-01 #8 | Boundary: Name of exactly 3 and Description of exactly 10 characters are accepted | Boundary | Write guarded | 1. Name "ABC", description "0123456789".<br>2. Click Create. | One write whose body has name "ABC" and description "0123456789". | Pass | - |
| BR-COM-01 #9 | Name of only spaces and Description of only spaces are refused as required | Negative | Write guarded | 1. Enter spaces in both.<br>2. Click Create. | No write; "This field is required." twice. | Pass | - |
| BR-COM-01 #10 | Name is limited to 100 characters (story) | Known defect | ADMIN | 1. Type 130 characters in Name. | Expected: at most 100 characters kept. Actual (defect): the field accepts 120 (`maxlength=120`). | Known defect (expected fail) | IUN-3398 |
| BR-COM-01 #11 | Name of 120 characters is accepted up to the field limit and sent whole | Boundary | Write guarded | 1. Type 130 characters, valid description.<br>2. Create. | Field holds 120; the body's name has 120 characters. Documents the current limit. | Pass | IUN-3398 (documents the same limit; the defect test is BR-COM-01 #10) |
| BR-COM-03 #1 | Default payload: Club, Public, no category (write blocked) | Positive | Write guarded | 1. Name "Robotics Club", description "Builds and programs robots".<br>2. Create. | Body equals `{type:CLUB, name, description, visibility:PUBLIC}` (no category). | Pass | - |
| BR-COM-03 #2 | Group + Restricted + category: payload carries type GROUP, visibility RESTRICTED and the category (write blocked) | Positive | Write guarded | 1. Pick Group and Restricted.<br>2. Fill name, description, category "Sports".<br>3. Create. | Body has type GROUP, visibility RESTRICTED, category "Sports". | Pass | - |
| BR-COM-03 #3 | Group + Private + category: payload carries type GROUP, visibility PRIVATE and the category (write blocked) | Positive | Write guarded | As above with Private. | Body has type GROUP, visibility PRIVATE, category "Sports". | Pass | - |
| BR-COM-02 #1 | Duplicate name: the server error "A community with this name already exists." is shown and the modal stays open (mocked 409) | Mocked API | POST returns 409 with that message | 1. Name "robotics club", valid description.<br>2. Create. | Message visible; modal still open; Name keeps "robotics club". | Pass | - |
| BR-COM-02 #2 | The duplicate message can be dismissed (mocked 409) | Mocked API | POST returns 409 | 1. Create.<br>2. Click Dismiss. | Message disappears. | Pass | - |
| BR-COM-02 #3 | Any other create failure (mocked 500) keeps the modal open with the typed values and shows the error text | Mocked API | POST returns 500 "Server exploded" | 1. Create, wait. | Modal still open; Name keeps "Keep me". (The test checks the modal and value; error text itself is not asserted.) | Pass | - |
| TC_COM_003 #1 | The duplicate name check is case-insensitive and also covers archived communities (real server) | Gated | `ALLOW_COMMUNITIES_WRITES=true` needed; if the server accepted the name a real club would be created and cannot be deleted | 1. Open modal.<br>2. Enter the first listed club name in upper case plus a description.<br>3. Create. | "A community with this name already exists." is visible. | Gated, not run | - |
| COM-001 | Logo: a PNG is accepted (label turns to "Change logo") and its storage key travels with Create (writes blocked, file storage blocked) | Positive | 1x1 PNG; all non-GET calls to other hosts and API writes blocked | 1. Upload logo.png.<br>2. Fill name and description, Create. | Label "Change logo"; the create body has `coverImageKey` matching `communities/....(png\|jpg\|jpeg\|webp)`. | Pass | - |
| COM-002 | Logo: a text file is rejected (PNG, JPG, JPEG, WEBP only) | Known defect | notes.txt (text/plain) | 1. Upload the .txt.<br>2. Read the label. | Expected: rejected, label stays "Upload logo". Actual (defect): any file is accepted; label turns to "Change logo", no message. | Known defect (expected fail) | IUN-3399 |
| COM-003 | Logo: a file over 5 MB is rejected | Known defect | big.png of about 6 MB | 1. Upload it.<br>2. Read the label. | Expected: rejected. Actual (defect): a 6 MB image is accepted without a message. | Known defect (expected fail) | IUN-3399 |
| COM-004 | Logo: a GIF is rejected | Known defect | anim.gif | 1. Upload it.<br>2. Read the label. | Expected: rejected. Actual (defect): a GIF is accepted as a logo. | Known defect (expected fail) | IUN-3399 |

## Not automated

| Case | Reason |
|---|---|
| TC_COM_003 real duplicate (e.g. "robotics club" when "Robotics Club" exists), case-insensitive and across archived clubs (BR-COM-02) | If the server accepted it a real club would be created and the admin screen has no delete. Gated test exists (`ALLOW_COMMUNITIES_WRITES=true`), not run. Only the screen's reaction to the server message is proved (mocked 409). |
| Real Archive then Activate round trip (TC_COM_004 end to end) | Would change a real club on shared QA; covered by exact request assertions plus mocked follow-up state. |
| Real Create (club appears, KPI updates, logo upload to storage) | Creates data that cannot be deleted from the admin; covered by payload assertions. |
| Archived community hidden from discovery, posting disabled (BR-COM-04) | Needs a student / employee account. |
| BR-COM-03 meaning of Public / Restricted / Private for joiners | Needs a student account; only the payload is verified. |
| Pending approval, reject, suspend flows, owner approval | No such controls on the screen (IUN-3394). |
| Moderation depth (resolving flags, Open flags after a flag is raised) | Needs flagged posts raised by a user account; only the Flagged posts screen opening and mocked tile values are checked. |
| Pagination beyond 20 communities | QA has about 13; no page control exists. |
| Access by roles other than Admin | No other accounts. |

## Row count

The spec has 75 tests (`--list` prints 77 lines because it also counts the two setup / teardown projects). The tables above contain one row per test, (10 + 16 + 14 + 12 + 23 = 75 rows; 62 Pass, 12 Known defect, 1 Gated).

## Bugs raised for this story

| Bug key | Title | Priority | Covering test id(s) |
|---|---|---|---|
| IUN-3391 | Communities: "Review flagged posts" banner opens Flagged posts screen but URL stays /communities, not /reported-posts | Medium | TC_COM_001 #8 |
| IUN-3392 | Communities: a failed list call (HTTP 500) shows "No communities", same as an empty directory; no error or retry | Medium | TC_COM_002 #9 |
| IUN-3393 | Communities: Archive / Activate fire on first click with no confirmation and no undo | Medium | TC_COM_004 #9 |
| IUN-3394 | Communities: no Approve, Reject, Suspend or Restore control; a Pending card only offers "Archive" (needs confirmation) | Medium | TC_COM_004 #11 |
| IUN-3395 | Communities: "New community" Create button is never disabled for invalid input (BR-COM-01) | Low | TC_COM_001/BR-COM-01 |
| IUN-3396 | Communities: validation hint wording differs from story and no hint for a Description of 1-9 characters | Low | BR-COM-01 #5 |
| IUN-3397 | Communities: Description of 5 or 9 characters is sent by the screen; minimum 10 (BR-COM-01) not enforced in the UI | Medium | BR-COM-01 #6, BR-COM-01 #7 |
| IUN-3398 | Communities: Name field accepts 120 characters (maxlength=120); story says max 100 | Low | BR-COM-01 #10 (and BR-COM-01 #11 documents the limit) |
| IUN-3399 | Communities: logo picker accepts .txt, .gif and a 6 MB PNG with no message (story: PNG/JPG/JPEG/WEBP up to 5 MB) | Medium | COM-002, COM-003, COM-004 |
| IUN-3400 | Communities: [Android, iOS] round "+" button covers the Archive button of the club behind it | High | mobile review, no automated test |
| IUN-3408 | Dashboard / all screens: [Android, iOS] tap targets below platform minimums (48 dp Android, 44 pt iOS) on phones | Medium | mobile review, no automated test |
| IUN-3409 | Dashboard / all screens: [Android, iOS] tiny text on phones (9-11 px labels, pills, timestamps) | Medium | mobile review, no automated test |

Informational deviations with no bug raised: tiles count active communities only, "1 Members" wording, unknown status shows an empty status word, unclear meaning of the "Review" tile.
