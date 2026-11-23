# Mobile UI review: Android and iOS views of the admin portal

**Date:** 2026-11-20, QA `https://app-test.k.indiraiscm.com`, signed in as ADMIN.
**Method:** every admin screen was loaded on five emulated devices and screenshotted, with automatic measurements (horizontal overflow, tap-target size, tiny text, sidebar behaviour). The create modals, the "More" menu and landscape were captured on three phones, then reviewed by eye.
**Evidence:** screenshots in `docs/mobile-ui/`, raw measurements in `docs/mobile-ui/sweep-results.json`, repeatable sweep in `scripts/mobile-ui-sweep.js` (`node scripts/mobile-ui-sweep.js <outputDir>`).

| Device | Engine | Viewport | Rule used for tap targets |
|---|---|---|---|
| Pixel 7 | Chromium (Android) | 412 x 839 | 48 dp |
| Galaxy S9+ | Chromium (Android) | 320 x 658 (narrowest) | 48 dp |
| iPhone SE (3rd gen) | WebKit (iOS) | 375 x 667 | 44 pt |
| iPhone 14 | WebKit (iOS) | 390 x 664 | 44 pt |
| iPad Pro 11 | WebKit (iOS) | 834 x 1194 | 44 pt |

**Limits of this review:** these are Playwright emulations (Chrome and WebKit dressed as the device), not real phones. Real-device things (software keyboard, notch and home indicator, browser toolbars, Safari quirks) are not covered. Results for iPhone SE and iPhone 14 were the same in every screen, as were Pixel 7 and Galaxy S9+ except where noted.

## What works
- **No horizontal page scroll** on any screen at any width, including 320 px.
- Phones switch to a **bottom tab bar** (Dashboard, Feed, Policies, Alerts, More) with a "More Options" sheet; tablets keep the 240 px sidebar (content gets 71% of an iPad's width). Landscape on a phone switches to the sidebar layout.
- The sign-in page is clean on every device (no small tap targets, no tiny text).
- Dashboard, Bulk Upload, Reported Posts and the create-policy modal are laid out well.

## Issues found (most serious first)

| # | Screen | Devices | Issue | Severity guess | Evidence |
|---|---|---|---|---|---|
| 1 | Communities | all phones | The round **"+" button covers the Archive button** of the club behind it (visible on the second club card), so Archive cannot be tapped there | High | `GalaxyS9_communities.png` |
| 2 | Feed | all phones | The **"+" button covers the Share button** and the end of the reactions row of a post | High | `GalaxyS9_feed.png`, `Pixel7_feed.png` |
| 3 | Policies | all phones | The "+" button covers the date / content area of a policy card | Medium | `GalaxyS9_policies.png` |
| 4 | Master Data | Android and iOS phones | Long department and campus chips **run off the right edge** without wrapping or an ellipsis ("Master Business Administration Data (MASTER_BUSINESS_ADMI..." is cut). The code part, which identifies the record, is the part that disappears | High | `Pixel7_master-data.png` |
| 5 | Create Acknowledgement modal | iPhone SE (and narrow Android) | The title **"Create Acknowledgeme..." is cut off and touches the Publish button**; no ellipsis | Medium | `iPhoneSE3rdgen_ack-modal.png` |
| 6 | Feed | Galaxy S9+ (320 px) | The tab row does not fit: the fourth tab **"Communities" is cut off** at the screen edge; the filter row is cut off too ("Batch" half visible, "Semester" hidden) with no scroll hint | Medium | `GalaxyS9_feed.png` |
| 7 | Feed | Galaxy S9+ | "What's on your mind?" wraps onto two lines inside the compose box; the author line is truncated ("School of Bu...") | Low | `GalaxyS9_feed.png` |
| 8 | Feed (Pixel 7) | Pixel 7 | The last filter chip "Semester" is cut off at the right edge | Low | `Pixel7_feed.png` |
| 9 | Compliance | all phones | "Deadline: 3/19/2026" wraps onto two lines; the EMPLOYEE / STUDENT pills have their text sitting low (not vertically centred); the progress bar is nearly invisible for low values (0.2% shows as a tiny red dot) | Low | `GalaxyS9_compliance.png` |
| 10 | Every screen with the bottom bar | all phones | The tab labels are **10 px** and the tabs are **82 x 42** (below 48 dp and 44 pt) | Medium | `Pixel7_dashboard.png` |
| 11 | Feed, Policies, Communities, Compliance, Posts | all phones | **Tap targets below the minimum**: filter chips 31 px high, reaction pills 39 px, delete icon 30x32, round compose icons 36x36, "Archive" 90x29, status chips 28 px high, audience pills 22 px high, Master Data chips 32 px high (70 of them on one screen) | Medium | `sweep-results.json` |
| 12 | Many screens | all phones | **Tiny text**: status pills (OVERDUE, Low, AT_RISK, EVENT) 10 px, "Policy" pill 9 px, card department badges, tab labels and timestamps 11 px; Compliance has 54 elements under 12 px | Medium | `sweep-results.json` |
| 13 | Bottom bar | all phones | The bottom bar calls the screen **"Alerts"**, the sidebar and the page call it **"Notifications"** | Low | `Pixel7_more.png` |
| 14 | "More Options" sheet | Pixel 7 | The sheet opens over the content with no visible close control or backdrop cue, and "Notifications" is not in it (it is the "Alerts" tab) | Low | `Pixel7_more.png` |
| 15 | Create modals (Policy) | Galaxy S9+ | The modal stops above the bottom bar, which shows dimmed beneath it, and the Publish button is small and light grey; the form needs scrolling to reach Issuing Department and Target Audience | Info | `GalaxyS9_policy-modal.png` |

Notes:
- Issues 1 to 3 are one root cause: the floating "+" button is positioned over the scrolling content with no bottom padding. A fix is extra bottom padding on the lists and placing the button clear of row actions.
- Issues 10 to 12 are the same finding as the one the existing iOS tests already ask for (44 pt tap targets, `tests/ios/responsive.spec.ts`), measured on the signed-in screens, which those tests only partly cover.
- iPad: no layout defects found; some screens still show 22 to 30 px pills and the same small text.

## Suggested follow-ups
- Decide whether to raise these as Jira bugs (suggest one per root cause: the "+" overlap, Master Data chips, modal title, tab and filter rows, tap targets, tiny text, naming). No bugs have been created.
- Add the sweep to the regression suite for each release, with a threshold on small tap targets per screen.
- Test on one real Android phone and one real iPhone (keyboard, safe areas, Safari toolbar behaviour).
