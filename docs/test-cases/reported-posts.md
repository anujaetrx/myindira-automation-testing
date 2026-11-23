# Test cases: Admin > Reported Posts

**Screen:** `/reported-posts` (admin) on QA, `https://app-test.k.indiraiscm.com`
**Story:** IUN-3240 "Reported Posts Moderation Queue & Content Governance" (BR-RP-01 to BR-RP-04)
**Automation:** `tests/e2e/IUN3240-ReportedPosts/IUN3240-reported-posts.spec.ts`, page object `src/pages/ReportedPostsPage.ts`
**Last run (by the agent that wrote it):** chromium, QA, 43 tests passed (incl. 10 known deviations), 1 skipped (gated), 0 failed on the final run. One earlier run had a single transient failure ("cards are listed in API order" got 0 cards once).

Run: `npx playwright test tests/e2e/reported-posts --project=chromium`
Gated test TC_RP_900 (creates a post, reports it through the API, deletes it through the UI, cleans up): `ALLOW_REPORTED_WRITES=true`. **Written but never run.**

## How the screen works
- QA currently has **zero** reports, so every card test uses a hand-built mocked list. The field names (`id`, `title`, `body`, `createdByName`, `createdAt`, `reportCount`) and the page envelope (`data.content`) come from the app's own code and the empty response; the real card JSON could differ slightly.
- List call: `GET /admin/reported-posts?page=0&size=50`.
- Card: red "N report(s)" badge, author, relative time (a date after 7 days), title, body, trash icon.
- Delete: native `confirm("Delete this post by {name}? This action cannot be undone.")`, then `DELETE /posts/{id}` (no body).
- Empty state: teal checkmark, "All clear!" and "0 posts". Error state: one red line, "Failed to load reported posts".
- The delete icon is a `div[aria-label="Delete post"]` without a role.

## Coverage

| Area | What is checked | Result |
|---|---|---|
| TC_RP_001 navigation / header | sidebar click, deep link, request params, red flag icon, counter equals API | Pass |
| TC_RP_002 / 003 empty state | exact texts, heading, "0 posts", no leftover cards or badges, nothing shown while loading, real-data counter | Pass |
| TC_RP_004 / 104-110 cards | author, title, snippet, order, report-count plurals, relative times, no title, markdown, HTML not executed, unicode and long names | Pass |
| Reload / revisit | a post flagged after the first visit appears after reload and after leaving and returning | Pass |
| TC_RP_005-007 delete | confirm text names the author; cancel sends nothing; OK sends one `DELETE /posts/{id}` and only that card leaves; first and last card; deleting the last shows the empty state with no reload | Pass |
| Delete failures | 500 and 404 | Pass for the safe behaviour (card stays), see deviation 6 |
| BR-RP-02 | no Warn or Suspend control | Pass |
| TC_RP_114 / 008 errors | 500, dropped connection (about 9 s before the error shows), recovery after reload, 403 shows no data | Pass |

## Where the app differs from the story

| # | Expected | Actual | Severity guess |
|---|---|---|---|
| 1 | **Dismiss Report** action on each card (scenario 3, BR-RP-02, TC_RP_005) | Only Delete exists, so a wrongly reported post can only be deleted or left in the queue (2 `test.fail`) | **High** |
| 2 | Every Dismiss / Delete is audit-logged (BR-RP-04) | `/audit-log` shows "No audit logs found" because `GET /admin/audit-logs` returns **500** on QA ("could not initialize proxy [User#11] - no Session"). Seen live, not mocked. Audit content could not be verified | **High (backend)** |
| 3 | Error banner with a Retry action | One red line; header and counter disappear; no Retry | Medium |
| 4 | Reporter details and the violation reason on each card | Cards show only the post author, a report count and a relative time; the API returns neither field | Medium |
| 5 | Counter shows the real number of pending reports | The counter is the number of rows loaded, capped at 50 with no paging: 120 pending shows "50 posts" (mocked) | Medium |
| 6 | A failed delete is reported | A 500 on `DELETE /posts/{id}` leaves the card and shows no message (mocked) | Medium |
| 7 | Access denied wording for non-admins | A 403 shows the generic "Failed to load reported posts" (mocked; real non-admin access unverified) | Low |
| 8 | Long body clamped | The body shows in full (9 lines for 60 words); the code asks for 4 lines but it is not applied on web (mocked) | Low |
| 9 | Counter "1 posts" (story and TC_RP_004 wording) | App says "1 post", which is correct; the sheet is wrong (kept as `test.fail` with the story's literal text) | Info |
| 10 | "Green" checkmark in the empty state | Checkmark is teal | Info |
| 11 | Delete confirmation modal | Native `confirm()` | Info |

**Unverified, possibly High: BR-RP-01.** The queue is fed by `POST /posts/{id}/report`. Flags raised from Communities go to `POST /community-posts/{id}/flag` and `/communities/feed` carries `flagCount`. It could not be proven that a community flag reaches this queue: QA has no flagged community post and flagging would write data. Please ask the team which table the queue reads.

## Not automated

| Case | Why |
|---|---|
| BR-RP-01 end to end (flag in Communities or Social Feed, then see it in the queue) | Writes data; community flags may use a different table |
| Deleted post disappears from public feeds | Needs a real delete (only the gated test deletes its own AUTOTEST post) |
| Audit record content | The audit screen is broken (deviation 2) |
| TC_RP_008 real non-admin redirect / 403 | Only an admin login exists; the 403 is mocked |
| Dismiss keeps the post in the feed | The action does not exist |
| Scenario 2 "0 posts to 1 posts" with real data | QA has no reports; shown with mocked lists |

## Notes for maintainers
- The agent that wrote this spec was not allowed to write the repo doc; this document was written from its report.
- TC_RP_900 (gated) assumes `POST /social-feed` with `{body}` creates a post, that the admin can report their own post, and that an auth header can be captured from the app's own requests. It never logs the token. It has never been run.
- The "dismiss is sent" test only checks that some report/dismiss write is sent, because the real endpoint is unknown; refine it when the feature exists.
- Mocked lists are stateful, so the list refresh after a delete is checked.
