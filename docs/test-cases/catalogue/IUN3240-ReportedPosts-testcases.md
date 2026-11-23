# Test case catalogue: IUN-3240 Reported Posts Moderation Queue & Content Governance

- **Story:** IUN-3240 "Reported Posts Moderation Queue & Content Governance" (rules BR-RP-01 to BR-RP-04, scenarios 1 to 5, QA cases TC_RP_001 to TC_RP_008)
- **Module / screen:** Admin > Reported Posts (`/reported-posts`)
- **Environment:** QA, `https://app-test.k.indiraiscm.com`, signed in as ADMIN
- **Spec:** `tests/e2e/IUN3240-ReportedPosts/IUN3240-reported-posts.spec.ts` (page object `src/pages/ReportedPostsPage.ts`)
- **Summary doc:** `docs/test-cases/reported-posts.md`
- **Date:** 2026-11-20
- **Last run:** chromium, QA: all green. 43 tests in the spec: 32 pass, 10 known defects (expected fail), 1 gated (TC_RP_900, not run), 0 failed. (The summary doc says "12 known deviations" for its run total; the code has 10 `test.fail` markers, which is what is counted here.)
- **Test case IDs:** taken from the test title (TC_RP_001 to TC_RP_008 are the story's; TC_RP_1xx are extra ids added by this suite; TC_RP_900 is the gated real-write test). Several tests share one id, so a ` #n` suffix (file order within the id) is added to make each row unique. BR-RP-02 and BR-RP-04 are used as written in their titles.

**Important data note:** QA currently has **zero reported posts**. Every test that needs cards uses a **mocked list** (`GET /admin/reported-posts` answered with hand-built JSON shaped like the real API: id, title, body, createdByName, createdAt, reportCount). Those tests prove how the screen renders what it is given, not real moderation data. Only tests marked "real QA data" read the live API.

**Type:** Positive / Negative / Boundary / Known defect (`test.fail`, green while the app is wrong) / Gated (real write, not run) / Mocked API.
**Result:** `Pass`; `Known defect (expected fail)`; `Gated, not run`; `Skipped`.
**Safety:** every Delete click runs behind `guardWrites` (answered locally, recorded, asserted). Nothing changes data on QA.

## Story scenarios and business rules covered

| Story scenario / rule | Test ids |
|---|---|
| Scenario 1 / TC_RP_001 navigation, header, counter | TC_RP_001 #1 to #3 |
| TC_RP_002 / TC_RP_003 empty state and zero counter | TC_RP_002 #1, #2; TC_RP_003 #1 to #4; TC_RP_103 |
| Scenario 2 / TC_RP_004 / BR-RP-01 queue cards | TC_RP_004 #1 to #7; TC_RP_104 to TC_RP_110 |
| Scenario 3 / TC_RP_005 / BR-RP-02 Dismiss Report | TC_RP_005 #1, #2; BR-RP-02 |
| Scenario 4 / TC_RP_006 / TC_RP_007 Delete post | TC_RP_006 #1 to #5; TC_RP_007; TC_RP_111 to TC_RP_113 |
| BR-RP-04 audit log | BR-RP-04 |
| Data fetch error fallback, TC_RP_008 access | TC_RP_114 #1 to #4; TC_RP_008 #1, #2 |
| BR-RP-01 end to end with real writes | TC_RP_900 (gated); BR-RP-01 community flag: analysis only, no test (IUN-3364) |

## Test cases

### TS_RP_01 Navigation, header and empty state (Scenario 1)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_RP_001 #1 | The sidebar item opens /reported-posts with the flag icon, title and counter | Positive | ADMIN; real QA data (currently empty) | 1. Open `/dashboard`.<br>2. Click the "Reported Posts" sidebar item, capture the list response.<br>3. Read heading, counter, icon colour. | URL ends `/reported-posts`; heading and counter visible; flag icon is red; counter text is `N post(s)` where N = number of API rows ("1 post" singular). | Pass | - |
| TC_RP_001 #2 | Opening the URL directly also shows the screen (deep link) | Positive | ADMIN | 1. Go to `/reported-posts`. | URL stays; heading and counter visible. | Pass | - |
| TC_RP_001 #3 | The list is requested for page 0 with 50 rows | Mocked API | List mocked empty (used to read the request URL) | 1. Open the screen.<br>2. Read the first list request. | URL matches `/admin/reported-posts?page=0&size=50`. | Pass | - |
| TC_RP_002 #1 | Empty queue shows the checkmark icon, "No reported posts" and the "All clear!" subtext | Mocked API | List mocked empty | 1. Open the screen. | Empty title and subtitle visible; a checkmark glyph is drawn; heading font weight >= 600. | Pass | - |
| TC_RP_002 #2 | The checkmark icon is drawn in the theme colour (teal, not red) | Mocked API | List mocked empty | 1. Open the screen.<br>2. Read the icon colour. | Green channel clearly above red (teal). The story says "green"; teal is accepted. | Pass | - (informational: teal vs "green" wording; none raised) |
| TC_RP_003 #1 | Counter reads exactly "0 posts" when the queue is empty | Mocked API | List mocked empty | 1. Open the screen. | Counter text "0 posts". | Pass | - |
| TC_RP_003 #2 | The empty state has no cards, report badges or delete buttons left over (zero count handling) | Mocked API | List mocked empty | 1. Open the screen. | Empty title visible; 0 delete buttons; 0 report badges; no error text. | Pass | - |
| TC_RP_003 #3 | Counter equals the number of entries the API returns (real QA data) | Positive | Real QA data (zero reports today) | 1. Open the screen, capture the response.<br>2. Compare counter, delete buttons and empty state. | Counter = rows returned; delete buttons = rows; empty state visible only when 0 rows. | Pass | - |
| TC_RP_103 | No "All clear!" text and no counter while the list is still loading | Mocked API | List response held back by a gate, then released with one post | 1. Open the screen with the response delayed.<br>2. Check texts.<br>3. Release. | While loading: no "Loading" text, no empty title/subtitle, no counter. After release: counter "1 post". | Pass | - |

### TS_RP_02 Queue cards (Scenario 2, BR-RP-01)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_RP_004 #1 | Flagged posts appear as cards with author, time, title and body snippet; counter matches | Mocked API | List mocked with 3 posts (report counts 2, 1, 7; ages 5 min, 3 h, 3 days) | 1. Open the screen.<br>2. Read counter and card texts. | Counter "3 posts"; 3 delete buttons; each author, title and body text visible; no empty state. | Pass | - |
| TC_RP_004 #2 | Cards are listed in the order the API returns them | Mocked API | 3 posts: Zed Last, Amy First, Mid Person | 1. Open the screen.<br>2. Read the vertical position of each author. | Positions ascend in API order. | Pass | - |
| TC_RP_104 | Each card shows its report count, "1 report" singular and "N reports" plural | Mocked API | reportCount 1, 2, 12 | 1. Open the screen.<br>2. Read the badges. | Badges read "1 report", "2 reports", "12 reports". | Pass | - |
| TC_RP_105 | Time since posting is shown as Just now / Xm / Xh / Xd ago and as a date after a week | Mocked API | 5 posts aged 0, 45 min, 5 h, 2 d, 20 d | 1. Open the screen.<br>2. Read the times. | "Just now", "45m ago", "5h ago", "2d ago", and a short date such as "Nov 1, 2026" for the 20-day-old post. | Pass | - |
| TC_RP_106 | A post without a title renders body and author only | Mocked API | title null | 1. Open the screen. | Body and author visible; no "null" or "undefined" text. | Pass | - |
| TC_RP_107 | A long body is clamped to a short snippet (4 lines) instead of stretching the card | Known defect | One post with a 60-word body (mocked) | 1. Open the screen.<br>2. Measure the body height. | Expected: body at most 4 lines (90 px). Actual (defect): the body is shown in full (about 9 lines); the 4-line clamp is not applied on the web build. | Known defect (expected fail) | IUN-3361 |
| TC_RP_108 | Markdown in the body is rendered, not shown as raw symbols | Mocked API | body "Some **bold words** here" | 1. Open the screen. | "bold words" visible; the raw `**` is not shown. | Pass | - |
| TC_RP_109 | HTML in a reported post is shown as text and never executed | Mocked API | title `<b>Title</b>`, body with an `<img onerror>` and a `<script>` | 1. Open the screen.<br>2. Read `window.__xss`. | One card rendered; no script ran (`__xss` undefined). | Pass | - |
| TC_RP_110 | Unicode, emoji and very long author names render without breaking the card | Mocked API | Author with emoji, Hindi body, 144-character author name | 1. Open the screen. | Texts visible; 2 cards; no horizontal page scroll. | Pass | - |
| TC_RP_004 #3 | A post flagged after the page was first opened shows up on the next visit (reload) | Mocked API | List empty first, then one post | 1. Open: "0 posts".<br>2. Change mock data, reload. | Counter "1 post" and the new author visible. | Pass | - |
| TC_RP_004 #4 | Coming back to the screen from another page picks up a newly flagged post | Mocked API | List empty first, then one post | 1. Open: "0 posts".<br>2. Go to `/dashboard`, change data, click the sidebar item. | Counter "1 post". | Pass | - |
| TC_RP_004 #5 | The counter says "1 posts" for one post, as the story and the sheet write it | Known defect | One mocked post | 1. Open the screen.<br>2. Read the counter. | Story wording: "1 posts". Actual: the app says "1 post", which is grammatically correct; the story and sheet wording is the odd one. | Known defect (expected fail) | none raised (informational: app is correct, story wording is wrong) |
| TC_RP_004 #6 | Each card shows who reported it and the violation reason | Known defect | One mocked post | 1. Open the screen.<br>2. Look for "reported by", "reporter" or "reason". | Expected: reporter and reason on each card. Actual (defect): cards only show the author and a report count (the list API has neither). | Known defect (expected fail) | IUN-3351 |
| TC_RP_003 #4 | Counter equals the total of pending reports when more than one page exists | Known defect | 50 rows returned, `totalElements` mocked as 120 | 1. Open the screen.<br>2. Read the counter. | Expected: "120 posts". Actual (defect): the counter counts rows loaded (50 max, no paging), so it shows "50 posts". | Known defect (expected fail) | IUN-3353 |

### TS_RP_03 Moderation actions (Scenarios 3 and 4, BR-RP-02, BR-RP-04)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_RP_005 #1 | Each card has a "Dismiss Report" action | Known defect | One mocked post | 1. Open the screen.<br>2. Look for "Dismiss Report". | Expected: a Dismiss Report action on the card. Actual (defect): none exists; the only card action is the trash icon (Delete post). | Known defect (expected fail) | IUN-3342 |
| TC_RP_005 #2 | Dismissing a report sends the dismiss call and removes the card | Known defect | One mocked post; write guarded | 1. Open the screen.<br>2. Click "Dismiss Report".<br>3. Look for a report/dismiss write. | Expected: one dismiss request and the card leaves. Actual (defect): there is no Dismiss action, so nothing can be sent. | Known defect (expected fail) | IUN-3342 |
| BR-RP-02 | Only Dismiss and Delete exist: there is no Warn User / Suspend action | Negative | One mocked post | 1. Open the screen.<br>2. Count delete buttons and Warn/Suspend controls. | One delete button; no Warn or Suspend control. | Pass | - |
| TC_RP_006 #1 | Delete post asks for confirmation naming the author | Mocked API | One post by "Rohan Gupta"; write guarded | 1. Click the trash icon; read the native dialog; cancel. | Dialog text "Delete this post by Rohan Gupta? This action cannot be undone." | Pass | - |
| TC_RP_006 #2 | Cancelling the confirmation keeps the post and sends nothing | Mocked API | Two posts; write guarded | 1. Click delete on card 1, cancel. | 2 cards, counter "2 posts", no write. | Pass | - |
| TC_RP_006 #3 | Confirming sends DELETE /posts/{id} (no body) and the card leaves the queue | Mocked API | Three posts (ids 321 to 323); the mocked list drops deleted ids | 1. Delete card 2 (confirm OK). | Counter "2 posts"; "Remove Two" gone, others stay; exactly one write `DELETE /posts/322` with empty body. | Pass | - |
| TC_RP_006 #4 | Deleting the first and then the last card each removes exactly that card | Mocked API | Three posts (ids 331 to 333) | 1. Delete card 1 (OK).<br>2. Delete the last card (OK). | Counter "2 posts" then "1 post"; "Person B" remains; writes `DELETE /posts/331` and `/posts/333`. | Pass | - |
| TC_RP_006 #5 | The delete call is a normal post delete, so the post leaves the feeds (queue only reads, never edits) | Mocked API | One post (id 341) | 1. Delete it (OK). | Empty state visible; the only write is `DELETE /posts/341`; no PUT/POST/PATCH. | Pass | - |
| TC_RP_007 | Resolving the last post switches to the empty state without a page reload | Mocked API | One post (id 351); a window marker set before the click | 1. Delete the post (OK). | Counter "0 posts", empty title and subtitle, no cards, no error, window marker survived (no reload), URL unchanged. | Pass | - |
| TC_RP_111 | A failed delete (500) leaves the post in the queue and the counter unchanged | Mocked API | One post; `DELETE /posts/361` returns 500 | 1. Delete it (OK).<br>2. Read the screen. | One delete call; counter "1 post"; post still visible; no empty state. | Pass | - |
| TC_RP_112 | A failed delete tells the admin that it failed | Known defect | As TC_RP_111 for post 362 | 1. Delete (OK), wait.<br>2. Look for "failed / error / could not / try again". | Expected: an error message. Actual (defect): a failed delete is silent. | Known defect (expected fail) | IUN-3355 |
| TC_RP_113 | Deleting a post that is already gone (404) refreshes the queue without crashing | Mocked API | Two posts; `DELETE /posts/363` returns 404 | 1. Delete post 363 (OK). | "Still Here" visible; heading visible; no error text. | Pass | - |
| BR-RP-04 | Deleting a reported post is recorded in the audit log (Admin ID, Post ID, resolution, timestamp) | Known defect | Real QA | 1. Open `/audit-log`, wait for `GET /admin/audit-logs`. | Expected: status 200 and audit entries (no "No audit logs found"). Actual (defect): `GET /admin/audit-logs` returns 500 ("could not initialize proxy ... no Session"), so no entry can be seen. | Known defect (expected fail) | IUN-3346 |

### TS_RP_04 Error and access handling

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_RP_114 #1 | A failing list call shows an error and never the false "All clear!" | Negative | List returns 500 | 1. Open the screen. | Error text visible; no empty title or subtitle; no counter. | Pass | - |
| TC_RP_114 #2 | A network failure also shows the error and not "All clear!" | Negative | List request aborted (the app retries first, up to 40 s wait) | 1. Open the screen. | Error text visible; no empty title; no counter. | Pass | - |
| TC_RP_114 #3 | The error banner offers a "Retry" action | Known defect | List returns 500 | 1. Open the screen.<br>2. Look for a Retry control. | Expected: error banner with Retry. Actual (defect): plain red text "Failed to load reported posts", no Retry; header and counter disappear. | Known defect (expected fail) | IUN-3349 |
| TC_RP_114 #4 | After an error, reloading with a working API shows the queue again | Negative | List fails once, then returns one post | 1. Open: error.<br>2. Fix the mock, reload. | Counter "1 post", author visible, error gone. | Pass | - |
| TC_RP_008 #1 | A rejected request (403 Forbidden) shows no queue data and no counter | Negative | List returns 403 | 1. Open the screen. | Error text visible; no counter, no delete buttons, no empty state. | Pass | - |
| TC_RP_008 #2 | A rejected request (403) is reported as access denied | Known defect | List returns 403 (a real non-admin cannot be tried: no student account) | 1. Open the screen.<br>2. Look for "access denied / forbidden / not authorised / 403". | Expected: an access-denied message. Actual (defect): generic "Failed to load reported posts". | Known defect (expected fail) | IUN-3358 (needs confirmation) |

### TS_RP_05 Real flag and delete (gated)

| Test case ID | Title | Type | Preconditions / data | Steps | Expected result | Result | Bug |
|---|---|---|---|---|---|---|---|
| TC_RP_900 | A post reported through the API shows in the queue and is removed by Delete post (real writes) | Gated | `ALLOW_REPORTED_WRITES=true` needed; creates one post, reports it, deletes it, cleans up. Never run. | 1. Open the screen and capture the app's authorised request.<br>2. Create a post via `POST /social-feed`, report it via `POST /posts/{id}/report`.<br>3. Reload, find the marker text and a report badge.<br>4. Delete through the UI (OK).<br>5. Cleanup in `finally` if not deleted. | The marker post shows with a report badge, then disappears after Delete. | Gated, not run | - |

## Not automated

| Case | Reason |
|---|---|
| BR-RP-01 end to end (flag in Communities or Social Feed, then see it in the queue) | Writes data; community flags (`POST /community-posts/{id}/flag`) may use a different table. Analysis only: IUN-3364 (needs confirmation), no test. |
| Deleted post disappears from public feeds | Needs a real delete (only the gated TC_RP_900 deletes its own AUTOTEST post). |
| Audit record content | The audit screen is broken (IUN-3346). |
| TC_RP_008 real non-admin redirect / 403 | Only an admin login exists; the 403 is mocked. |
| Dismiss keeps the post in the feed | The Dismiss action does not exist (IUN-3342). |
| Scenario 2 "0 posts to 1 posts" with real data | QA has no reports; shown with mocked lists. |

## Row count

The spec has 43 tests: TS_RP_01 9, TS_RP_02 14, TS_RP_03 13, TS_RP_04 6, TS_RP_05 1. 32 Pass, 10 Known defect, 1 Gated, 0 Skipped. (`--list` prints 45 lines because it also counts the two setup / teardown entries.)

## Bugs raised for this story

| Bug key | Title | Priority | Covering test id(s) |
|---|---|---|---|
| IUN-3342 | Reported Posts: no "Dismiss Report" action on a card, only Delete post | High | TC_RP_005 #1, TC_RP_005 #2 |
| IUN-3346 | Reported Posts (backend): GET /admin/audit-logs returns HTTP 500, Audit Log unusable, moderation cannot be audited | High | BR-RP-04 |
| IUN-3349 | Reported Posts: load error is one red line with no Retry action and the header and counter disappear | Medium | TC_RP_114 #3 |
| IUN-3351 | Reported Posts: cards show no reporter and no violation reason | Medium | TC_RP_004 #6 |
| IUN-3353 | Reported Posts: counter shows rows loaded (max 50, no paging) instead of total pending reports | Medium | TC_RP_003 #4 |
| IUN-3355 | Reported Posts: a failed delete (HTTP 500) leaves the card and shows no message | Medium | TC_RP_112 |
| IUN-3358 | Reported Posts: a 403 shows the generic "Failed to load reported posts" instead of an access-denied message (needs confirmation) | Low | TC_RP_008 #2 |
| IUN-3361 | Reported Posts: long post body is shown in full, the 4-line clamp is not applied on web | Low | TC_RP_107 |
| IUN-3364 | Reported Posts: unverified that community post flags (POST /community-posts/{id}/flag) reach the moderation queue (needs confirmation, BR-RP-01) | Medium | analysis only, no automated test |

Informational deviations with no bug raised: the story's "1 posts" wording (TC_RP_004 #5; the app's "1 post" is correct) and the teal (not green) checkmark (TC_RP_002 #2). No mobile-review bugs apply to this story.
