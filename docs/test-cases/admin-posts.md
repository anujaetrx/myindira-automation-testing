# Test cases: Admin > Admin Posts

**Screen:** sidebar item "Admin Posts" on QA, `https://app-test.k.indiraiscm.com`. The real route is **`/posts`** (not `/admin-posts`); list API `GET /admin/posts?page=0&size=20`.
**Story:** IUN-3230 "Admin Posts Creation & Targeted Broadcasting" (rules BR-AP-01 to BR-AP-05, scenarios 1 to 5, QA cases TC_AP_001 to TC_AP_008)
**Automation:** `tests/e2e/IUN3230-AdminPosts/IUN3230-admin-posts.spec.ts`, page object `src/pages/AdminPostsPage.ts`
**Test ids:** TC_AP_001 to TC_AP_008 are the story's own cases; TC_AP_009 and up are extra cases (list, validation, limits, targeting, media, dismiss, delete).
**Last run:** 2026-11-20, chromium, QA. Two full runs in a row (plus an earlier one with fixes): 78 passed (including 15 known deviations marked `test.fail`), 1 skipped (gated), 0 failed, 0 flaky.

Run: `npx playwright test tests/e2e/admin-posts --project=chromium`
Gated lifecycle test (publishes a real post, then deletes it): `ALLOW_ADMINPOSTS_WRITES=true` (not run).

## Safety: nothing is published on QA
Publishing an admin post notifies real students and employees. Every test that clicks Publish, Delete or a reaction first calls `guardWrites()`: the call is answered locally and recorded, and the test asserts **what the screen sent** (method, path and the multipart `post` JSON, which shows `targets` and `category`). Photos and videos go straight from the browser to cloud storage (a `PUT` to a pre-signed URL) when Publish is pressed; that call is outside the API, so `guardMediaUpload()` blocks it. Empty list, error and five-category list are mocked (they cannot exist safely on QA). The one real publish is gated.

## Coverage

| Scenario / rule | Cases | Automated | Result |
|---|---|---|---|
| Scenario 1 access and empty state, BR-AP-05 | TC_AP_001 (x2: live page, mocked empty), 009 list API, 010 card contents and badges, 011 photo on card, 012 load error, 013 sidebar | 7 | Pass (empty, error, five-category list mocked) |
| | TC_AP_014 route `/admin-posts` | 1 | **Deviation** |
| Scenario 2 launch modal | TC_AP_002 (x2: quick box, +), 015 photo icon, 016 fields and disabled Publish, 017 clean start | 5 | Pass |
| BR-AP-01 mandatory fields | TC_AP_003, 018 partial forms, 019 spaces only, 020 enabled when complete, 024 / 025 / 026 press Publish with a missing part: message, nothing sent | 7 | Pass |
| | TC_AP_021 Publish disabled until Category, 022 until audience, 023 disabled again when both boxes cleared | 3 | **Deviations** |
| Scenario 3, BR-AP-02 category and audience | TC_AP_004, 027 cycle all five, 028 re-click, 005 independent checkboxes, 029 checkbox role | 5 | Pass |
| Scenario 4 publish, BR-AP-03 targeting | TC_AP_006 request and refresh, 030 success toast, 032 new post on top (list simulated), 033 Students / Employees / both, 034 switch audience, 035 each of five categories, 036 change category, 037 form resets, 038 special characters, 039 trimming, 040 server refuses, 041 double click | 17 | Pass |
| | TC_AP_031 toast text "Post published successfully" | 1 | **Deviation** |
| Input limits | TC_AP_042 exactly 120 / 3,000 accepted | 1 | Pass |
| | TC_AP_043 title cap 120, 044 body cap 3,000, 045 over-limit refused | 3 | **Deviations** |
| Media | TC_AP_046 JPEG / PNG / WEBP preview and remove, 047 MP4, 048 MOV, 049 photo then video replaces, 007 photo post (upload then media key, type IMAGE), 051 removed file not sent, 052 10 MB photo, 054 40 MB video, 060 media only | 9 | Pass |
| | TC_AP_050 video post sends VIDEO, 053 photo over 10 MB, 055 video over 50 MB, 056 PDF as photo, 057 error message for bad file, 058 PDF as video, 059 .exe as photo | 7 | **Deviations** |
| Scenario 5 dismiss | TC_AP_008, 061 draft not kept, 062 no confirm, 064 page usable after close | 4 | Pass |
| | TC_AP_063 click on the backdrop | 1 | **Deviation** |
| Card actions | TC_AP_065 delete confirm and `DELETE /posts/{id}`, 066 cancel, 067 delete and Share on every card, 068 reaction `POST /posts/{id}/react` | 4 | Pass |
| Lifecycle | TC_AP_006 + 007 real publish then delete | 1 gated | **Not run** |

## Where the app differs from the story

| # | Story expects | App does | Severity guess |
|---|---|---|---|
| 1 | BR-AP-01 / Publish CTA state: Publish stays disabled until Title, Body, a Category and at least one audience are set (TC_AP_021, 022, 023) | Publish is enabled as soon as Title and Body are filled. Pressing it with no Category or no audience shows the toast "Please fill all fields and select at least one target role" and sends nothing (TC_AP_024 to 026 pass). Un-ticking both audience boxes does not disable it | Medium (validation exists but the button state is wrong) |
| 2 | Title max 120 and Body max 3,000 characters (TC_AP_043 to 045) | No limit: 130 / 3,100 characters accepted and sent. Exactly 120 / 3,000 also fine | Medium |
| 3 | Photo max 10 MB, video max 50 MB (TC_AP_053, 055) | A 12 MB photo and a 60 MB video are accepted and previewed (the server may still refuse) | Medium |
| 4 | Only image formats for Photo, video formats for Video (TC_AP_056 to 059) | Any file is accepted: a PDF or an .exe through Photo gives an empty preview with a remove x, a PDF through Video shows a video box; no error message | Medium |
| 5 | A video can be published (TC_AP_050) | The pre-signed-URL request is built with the file's base64 data as `fileName` (`/media/presigned-upload-url?fileName=mp4;base64,AAAA...`). Nothing is sent, no message, the modal just stays open. Photos work (`fileName=image.jpg`) | **High** (only seen with generated MP4 files from the test; the request shape is the cause) |
| 6 | Success toast "Post published successfully" (scenario 4, TC_AP_031) | Toast says "Post created successfully" | Low |
| 7 | Clicking outside the modal (backdrop) dismisses it (scenario 5, TC_AP_063) | Backdrop click does nothing; only the X closes it | Low |
| 8 | Route "/admin-posts" (task brief) / dedicated module | Sidebar item opens `/posts`; typing `/admin-posts` shows the Dashboard (TC_AP_014) | Info |
| 9 | Story: "Be the first to share" empty state when filters match nothing | There are no filters on this screen; only the whole-list empty state exists | Info |
| 10 | Story title says targeted by "audience / department / campus" in the brief | The form has only Students and Employees; `departmentId` is always `null` in `targets` | Info |

Also noted: the success toast, validation toast and "Failed to load posts" are plain text at the bottom of the screen. The first exploratory runs of this module (before the S3 block was added) uploaded 3 to 4 tiny test files (`image.jpg` style keys under `posts/`) to the QA storage bucket; no post was created.

## Behaviour confirmed (matches the story)
- Empty state "No posts yet. Be the first to share!" with the quick box and the round + button (TC_AP_001, mocked list).
- Quick box, picture icon and + all open "Create Post" with Title *, Body *, Category * (Announcement, Leadership, News, Event, General), Media (Optional) Photo / Video, Target Audience * (Students, Employees) and Publish disabled.
- Category pills are single-select; audience boxes toggle independently.
- Publish sends `POST /admin/posts` as multipart; the `post` part is JSON: `{"title","body","targets":[{"role":"STUDENT"|"EMPLOYEE","departmentId":null}],"category":"ANNOUNCEMENT|LEADERSHIP|NEWS|EVENT|GENERAL"}` plus `mediaKey` and `mediaType` (`IMAGE`) when a photo is attached (the file itself is uploaded separately to cloud storage). Students and Employees both ticked sends both roles (BR-AP-03).
- After publishing the modal closes, a toast shows and the list is read again; a new post shows at the top (list simulated). The form is empty when reopened.
- Closing with X discards the draft with no request and no confirmation.
- Delete: native confirm "Are you sure you want to delete this post?", then `DELETE /posts/{id}`; cancel sends nothing. Reactions send `POST /posts/{id}/react` with `{"reactionType":"LIKE"}`.
- Title and Body are trimmed before sending.

## Cross-module expectation (not automated here)
BR-AP-04 / scenario 4: a post published here appears in the **University** tab of `/feed` (Social Feed) under its category chip (All, Announcement, Leadership, News, Event, General), only for the audience it targets (Students and / or Employees), and in the Admin Posts list. The Social Feed spec (`tests/e2e/social-feed`) covers the University tab with data already on QA (TC_SF_028 / 029); TC_SF_030 ("admin-published post appears in University under its category") is listed there as not automated. Checking it needs a real publish, so it belongs to the gated lifecycle test: after publishing, open `/feed`, University, the matching category chip, and look for the title; then delete the post.

## Not automated

| Case | Why |
|---|---|
| Real publish, post at the top of the live list, BR-AP-04 syndication to `/feed` University (scenario 4 last line), BR-AP-03 delivery to the student / employee portals | Notifies real users. A gated test exists (`ALLOW_ADMINPOSTS_WRITES=true`, publishes one Employees post and deletes it); not run |
| BR-AP-03 "Students see it, Employees see it" in the user apps | No student or employee account is configured |
| TC_AP_001 with a truly empty database | Cannot empty QA; covered with a mocked empty list |
| Server-side limits (10 MB / 50 MB / 120 / 3,000) | Would need a real publish with over-limit data |
| Pagination (size 20, load more) | Only one admin post on QA and the app showed no load-more request with a mocked 2-page list |
| Reaction counts, Share sheet, post detail | Need server state or the device share sheet; Social Feed spec covers the same card controls |
| Photo / video really arriving in storage and playing | Upload is blocked on purpose; only the request is asserted |
| Departments / campus targeting | Not in the form |

## Notes for maintainers
- The test browser window is 1280x720. Round + button (56x56), modal close X (32x34) and the media remove x (28x28) are plain `div`s found by size; audience rows are `role=checkbox` (ticked = icon glyph U+F0132 in their text).
- Selected category pill colour is `rgb(21, 86, 133)`.
- The modal slides in; `settleModal()` waits for the title to stop moving.
- Test media is generated into the OS temp folder (the shared `artifacts/test-output` folder is cleaned by other runs).
- `guardMediaUpload` blocks the PUT to amazonaws.com; if the storage host changes, update its pattern, or a media test would upload a real file.
- When a deviation is fixed, its `test.fail(...)` test turns red: remove the marker.
