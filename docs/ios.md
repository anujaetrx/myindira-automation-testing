# iOS PWA testing: architecture and hybrid strategy

Playwright cannot drive a real iPhone. It drives **its own build of WebKit on your computer**, dressed up as an
iPhone (viewport, user agent, touch, pixel ratio). That is valuable and fast, but it is *not* iOS Safari.
Everything about the iOS *operating system around the page* (Add to Home Screen, the installed app, the keyboard,
storage rules) needs a real device, driven by Appium or by a person.

## Layer 1: what Playwright automates (this repo)

Run: `npm run test:ios` (4 profiles: iPhone SE, iPhone 14, iPhone 15 Pro Max, iPad Pro 11).

| Area | Covered by | Notes |
|---|---|---|
| WebKit engine behaviour (CSS, JS, layout quirks) | `ios-*` projects | Same engine family as Safari, not the same build |
| iPhone / iPad viewport, DPR, UA, touch flag | `devices['iPhone 14']` etc. | |
| Responsive layout, notch support, 44pt tap targets | `tests/ios/responsive.spec.ts` | Includes `viewport-fit=cover` |
| Tap | `IosTouch.tap` (real touch emulation) | |
| Scrolling | `IosTouch.scrollBy` (wheel) | |
| Auth and session reuse in WebKit | `adminPage` fixture + `SessionInjector` | localStorage + sessionStorage replay |
| Service worker, Cache API, offline reload | `tests/ios/offline.spec.ts` | Verified working in Playwright WebKit |
| Add to Home Screen **readiness** | `IosPwaReadiness` | icons, manifest, meta tags, HTTPS |
| "Installed app" code paths | `simulateInstalledStandalone` | **Simulation**, see below |
| Safari has no `beforeinstallprompt` | `add-to-home-screen.spec.ts` | App must not depend on it |

### Known gaps between emulation and a real iPhone

| Real iPhone | Playwright WebKit |
|---|---|
| `navigator.maxTouchPoints` = 5 | `0` (tested in `ios.unit.spec.ts`) |
| `navigator.standalone` = false in Safari, true when installed | `undefined`; we can only simulate `true` |
| Multi-touch, swipe, edge-swipe back, pinch, long-press callouts | Not available (CDP gestures are Chromium-only) |
| Software keyboard resizes the visual viewport | No keyboard |
| Dynamic toolbar / `100vh` / safe-area behaviour | Approximated |
| Memory pressure, process kills, cache eviction | Not reproduced |
| Intelligent Tracking Prevention (ITP) storage limits | Not enforced |
| Real push, Web Share, camera, file picker, biometrics | Not available |

## Layer 2: what only a real device (Appium or a person) can verify

| Scenario | Automatable? | How |
|---|---|---|
| Open the site in real Safari | Yes | Appium + XCUITest, `browserName: Safari` |
| **Share, Add to Home Screen, Add** | Yes, partly | Appium NATIVE_APP context, tap Share, then the sheet entries. Brittle across iOS versions |
| Launch the installed icon from the Home Screen | Yes, partly | Appium: tap the icon via Springboard |
| Inspect the installed app's web content | Sometimes | Needs Web Inspector; Appium may expose a WEBVIEW context. Verify per iOS version |
| **Microsoft SSO inside the installed app** | **Manual** | Redirect to `login.microsoftonline.com` leaves the app scope; iOS may open it in an in-app Safari sheet with separate cookies, and the return redirect may not come back to the standalone app. High risk for this app |
| Installed app has its **own storage**, so Safari's login is not shared | Manual (or Appium) | Log in again inside the installed app |
| Offline after force-quit and relaunch, cache eviction | Manual | Airplane mode, wait, relaunch |
| Push notifications (installed app only, iOS 16.4+) | Manual | Needs a real device and permission prompt |
| Status bar, notch, home indicator, keyboard, rotation | Manual / Appium screenshots | |
| App icon and splash screen appearance | Manual | |

**Playwright cannot do any of these** because there is no iOS driver: it has no way to attach to Mobile Safari,
the Share sheet, Springboard or an installed web app.

### Why SSO deserves special attention here

MyIndira signs in through Microsoft (Entra ID). On iOS, a standalone PWA that navigates to another origin can
hand off to an in-app Safari view, and cookies there are not the PWA's cookies. The browser-based tests prove the
login works in WebKit; only a physical iPhone can prove it works **inside the installed app**. Test it on every
release.

## Hybrid strategy

```
            fast, cheap, every commit                         slow, scarce, before release
 ┌────────────────────────────────────────┐      ┌───────────────────────────────────────────────┐
 │ 1. Playwright WebKit emulation (CI)     │      │ 3. Real-device cloud (BrowserStack / Sauce /   │
 │    npm run test:ios                     │      │    LambdaTest) + Appium: Safari smoke, install │
 │    - responsive, touch, session, SW     │      │    flow, launch, screenshots   (nightly/weekly)│
 │    - install READINESS, simulation      │      ├───────────────────────────────────────────────┤
 ├────────────────────────────────────────┤      │ 4. Manual on 2 owned iPhones (release gate)    │
 │ 2. Playwright Chromium emulation (CI)   │      │    docs checklist below: SSO in installed app, │
 │    shared logic, Android profiles       │      │    offline, push, keyboard, storage            │
 └────────────────────────────────────────┘      └───────────────────────────────────────────────┘
```

| Layer | Runs | Catches | Cost |
|---|---|---|---|
| 1 WebKit emulation | every PR | CSS/JS regressions on WebKit, layout, missing meta tags, SW/offline bugs | seconds |
| 3 Appium on real iOS | nightly or per release | Safari-only bugs, install-flow regressions, launch/standalone behaviour | device farm fees, maintenance |
| 4 Manual | every release | SSO in installed app, storage separation, push, feel | 30 to 45 minutes |

Rules of thumb:
1. Put every check that **can** run in Layer 1 there. Do not use a device for what emulation proves.
2. Keep Layer 3 to a handful of high-value flows (smoke, install, launch). Appium UI selectors break with iOS updates.
3. Keep Layer 4 as a written checklist with pass/fail and an iOS version column. Test the **oldest supported** and the **latest** iOS.
4. Report the iOS version and device on every manual result: PWA behaviour changes between iOS releases.

## Running

```powershell
npx playwright install webkit             # once
npm run test:ios                          # all 4 iOS profiles against the active environment
npx playwright test --project=ios-iphone-14 tests/ios/offline.spec.ts
npm run test:unit                         # includes the iOS helper tests (local server, no app needed)
```

## Physical iPhone (Appium) setup, when you add Layer 3

Requires a Mac with Xcode. There is no Windows route to a physical iPhone.
```
npm i -D webdriverio                      # or an Appium client of your choice
npm i -g appium && appium driver install xcuitest
iPhone: Settings > Privacy & Security > Developer Mode ON; Settings > Safari > Advanced > Web Inspector ON
Xcode: sign WebDriverAgent with your Apple developer team
```
Capabilities: `platformName: iOS`, `appium:automationName: XCUITest`, `appium:udid: <device>`,
`browserName: Safari`. For the Share sheet switch to the `NATIVE_APP` context and select by accessibility label.

## Manual release checklist (physical iPhone)

Record: device, iOS version, tester, date, build.

- [ ] Open the QA URL in Safari: sign-in screen renders, no horizontal scroll, safe areas respected
- [ ] Sign in with Microsoft in Safari: lands on the dashboard
- [ ] Share > Add to Home Screen: name and icon are correct (name "Indira Uni")
- [ ] Launch from the Home Screen: no Safari UI (standalone), status bar looks right
- [ ] Is the user signed in inside the installed app? If not, **sign in inside the installed app**: does SSO return to the app (not to Safari)?
- [ ] Kill the app, relaunch: session persists
- [ ] Airplane mode, relaunch: expected offline behaviour
- [ ] Bottom tab bar clear of the home indicator; keyboard does not hide inputs
- [ ] Rotate (if supported): layout holds
- [ ] Push notification arrives (if used), tap opens the right screen
- [ ] Log out, log in as a different user: no data from the previous user
