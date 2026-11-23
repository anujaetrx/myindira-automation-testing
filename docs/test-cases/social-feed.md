# Test cases: Admin > Social Feed

**Screen:** `/feed` (admin) on QA, `https://app-test.k.indiraiscm.com`
**Story:** IUN-3225 (rules BR-01 to BR-05)
**Automation:** `tests/e2e/IUN3225-SocialFeed/IUN3225-social-feed.spec.ts`, page object `src/pages/SocialFeedPage.ts`
**Source:** the team's sheet, TC_SF_001 to TC_SF_043 (scenarios TS_SF_01 to TS_SF_08), the rows visible in the screenshot.
**Last run:** 2026-11-20, chromium, QA, three runs in a row: 47 passed (incl. 10 known deviations), 1 skipped (gated), 0 failed, 0 flaky.

Run: `npx playwright test tests/e2e/social-feed --project=chromium`
Gated lifecycle test (publishes a real post, then deletes it): `ALLOW_FEED_WRITES=true`.

## Safety: nothing changes data on QA
Posting, reacting, commenting, flagging and deleting are real actions on shared QA. Every test that clicks one first calls `guardWrites()`: the call is answered locally and recorded, and the test asserts **what the screen sent** (path and body). Reads pass through to the real server. Opening a tab also sends a `POST /feed/<tab>/mark-viewed`, which is blocked the same way.

## Coverage

| Scenario | Sheet cases | Automated | Result |
|---|---|---|---|
| TS_SF_01 tabs | 001 switch tabs, 002 highlight | 2 | Pass |
| TS_SF_02 create post | 003, 005, 006, 007, 008, 009, 010, 015, 017 | 9 | Pass |
| | 004 icons open the modal | 1 | **Deviation** |
| | 011 media only, 012 >10MB photo, 013 >50MB video, 014 bad file type (x2), 016 >2000 chars | 6 | **Deviations** |
| TS_SF_03 reactions | 018 five reactions, 020 comment, 021 blank comment, 022 share | 4 | Pass |
| TS_SF_04 filters | 023 cascade, 024 disabled children, 025 reset (x2), 026 request params, 027 empty states (x2) | 7 | Pass |
| TS_SF_05 University | 028 categories, 029 empty message | 2 | Pass |
| TS_SF_06 birthdays | 031 badge, 032 none today, 033 card | 3 | Pass (mocked data) |
| | 033 quick wishes, 035 custom wish and send icon | 2 | **Deviations** |
| TS_SF_07 communities | 037 post card, 038 flag, 039 cancel, 040 flag twice | 4 | Pass |
| | 037 "Owner" badge and privacy label (BR-04) | 1 | **Deviation** |
| TS_SF_08 delete | 041 confirm and delete, 042 cancel, 043 icon on every post | 3 | Pass |
| Lifecycle | 007 + 041 publish then delete | 1 gated | **Not run** |

## Where the app differs from the sheet and the story

| # | Expected | Actual | Severity guess |
|---|---|---|---|
| 1 | Post enabled with media only; only "both empty" disables it (story) | Post stays disabled when only a photo is attached (TC_SF_011) | Medium |
| 2 | Photo max 10MB (story) | A 12MB JPG is accepted and previewed (TC_SF_012) | Medium |
| 3 | Video max 50MB (story) | A 60MB MP4 is accepted (TC_SF_013) | Medium |
| 4 | Unsupported file rejected with a format error (TC_SF_014) | A PDF chosen as a photo is silently ignored (no message). A PDF chosen through the Video button is accepted and shown as a video | Medium |
| 5 | Text capped at 2000 characters (story) | 2001 characters accepted, Post enabled (TC_SF_016) | Medium |
| 6 | Photo and video icons next to the compose box open Create Post (TC_SF_004) | They do nothing (no modal, no file picker) | Low |
| 7 | Birthday card has quick-wish chips and a custom wish box with a send icon (story scenario 4, TC_SF_033/035/036) | Admin card only says "Wish them when you see them!" | Medium: confirm whether wishing is user-app only |
| 8 | Community posts show an "Owner" badge and "Private club" / "Public" (BR-04, TC_SF_037) | Posts show the author's own title ("President", "CEO") and the club name; no Owner badge and no privacy label | Medium |
| 9 | Communities tab is a feed with Flag | Matches: Communities tab is a "Clubs & Groups" feed. Not to be confused with the sidebar **Communities** item, which is a club management screen | Info |

## Behaviour confirmed (matches the sheet)
- Tabs switch without a page reload; the active tab label has its own colour.
- Post modal: Post disabled for empty and whitespace text; text-only post sends `POST /social-feed` with `{"body": ...}`; a photo post is multipart with `"mediaType":"IMAGE"`; closing discards the draft and sends nothing.
- Five reactions send `POST /posts/{id}/react` with five different `reactionType` values (first is `LIKE`).
- Comment: send icon disabled for blank text; `POST /posts/{id}/comments` with `{"content": ...}`.
- Share calls the device share sheet with the post text.
- Filters: School, then Programme; Batch and Semester stay disabled until their parent is chosen; choosing a school re-queries `GET /social-feed?...&schoolId=1`; changing the School resets Programme; **Clear all** resets everything. Empty states: "No posts yet. Be the first to share!" and, with a filter, "No posts match this filter".
- University: categories All, Announcement, Leadership, News, Event, General; empty text "No university posts in this category".
- Birthdays: badge shows the count of today's birthdays; "No birthdays today" with no badge.
- Flag: confirm "Flag this post for a moderator to review?", `POST /community-posts/{id}/flag` with `{"reason":"INAPPROPRIATE_CONTENT"}`, toast "Post flagged for review."; an already flagged post shows "Flagged" and no Flag button.
- Delete: confirm "Are you sure you want to delete this post?", then `DELETE /posts/{id}`; cancel sends nothing; every post has a delete icon for an admin.

## Not automated

| Case | Why |
|---|---|
| TC_SF_019 change / remove a reaction; reaction counts update | Needs server state; blocked writes do not persist |
| TC_SF_030 admin-published post appears in University under its category | Needs a real post published from Admin Posts |
| Birthday cards with real data, TC_SF_034 all four chips, TC_SF_036 send icon | No birthday today on QA; chips and send icon do not exist in the admin app (deviation 7) |
| Batch and Semester levels of the cascade, TC_SF_026 "only matching posts listed" | Needs posts targeted to specific cohorts |
| TC_SF_041 soft-delete audit entry, BR-05 Reported Posts entry | Needs database or Reported Posts access |
| TC_SF_043 non-admin has no delete icon | No Student/Employee account configured |
| Sheet rows after TC_SF_043 | Not visible in the screenshot |

## Notes for maintainers
- The test browser window is **1280x720**, not the 1440x900 the specs request (`test.use` does not reach the custom context). All locators are therefore size- or text-based, never fixed coordinates.
- React Native Web: tabs (72x87), filter chips, the comment send icon (34x34) and the modal close X (32x34) are plain `div`s. Disabled chips and the disabled send icon are **not focusable**, which is how the tests tell enabled from disabled.
- The filter pickers slide in and can be closed by a re-render when feed data arrives. `openFilter` confirms the picker is still open after it settles, and the filter group allows 2 retries.
- Test media is generated in the test (valid tiny PNG / JPG / WEBP / MP4 padded to size) so the app can render a preview.

## Gap review against story IUN-3225 (2026-11-20)
Extra spec: `tests/e2e/IUN3225-SocialFeed/IUN3225-social-feed.gap.spec.ts` (8 tests; post data is cloned from a real QA post and overridden, because the app treats some post types differently).

| Story item | Added | Result |
|---|---|---|
| Social interactions: reactions, comments | total reactions and "N comments" / "1 comment" shown on a post; each reaction pill shows its own count; the viewer's own reaction is drawn highlighted | Pass |
| Reaction request | tapping a reaction sends `POST /posts/{id}/react` for that post | Pass |
| BR-02 admin deletes any post | delete icon on posts by other authors and by the admin | Pass |
| Paging | the feed requests `page=0&size=20` | Pass |
| Posts beyond the first 20 reachable | **Suspected deviation** (`test.fail`): with 25 posts only 20 show and page 2 is not requested after scrolling to the end. Needs confirmation by the team (the scroll container may need a real user gesture). Medium |

Real post fields worth knowing: `reactions`, `totalReactions`, `currentUserReaction`, `commentsCount`, `reportCount`, `reportedByCurrentUser`. The admin feed ignores `reportCount` (see BR-05 in the not-automated table: reports reach the Reported Posts screen, covered by the IUN-3240 tests).
