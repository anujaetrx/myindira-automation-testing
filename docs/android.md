# Android PWA automation

Three layers, from cheapest to most realistic:

| Layer | What runs | Where | Command |
|---|---|---|---|
| **Emulation** | Desktop Chromium pretending to be an Android phone (viewport, touch, UA, DPR) | Any machine, CI | `npm run test:android` |
| **Android emulator** | Real Android + real Chrome in an AVD, driven over ADB | Dev machine / CI with KVM | `npm run test:android:device` |
| **Physical device** | Same code, real hardware over USB | Lab / dev machine | `npm run test:android:device` |

## What each layer can and cannot prove

| Scenario | Emulation | Emulator / real device |
|---|:-:|:-:|
| Responsive layout at Android widths, rotation | yes | yes |
| Touch events (tap, swipe, long press, pinch) | yes (synthetic, via CDP) | yes (real input) |
| Mobile user agent, DPR, `pointer: coarse`, `hover: none` | yes | yes |
| Offline / slow network / service worker caching | yes | yes |
| Geolocation, permissions, dark mode, reduced motion | yes | yes |
| Manifest valid, service worker active, installable criteria | yes | yes |
| `beforeinstallprompt` event fires | yes | yes |
| **Real Chrome for Android behaviour** (rendering, memory limits, quirks) | no | **yes** |
| **Install via Chrome menu, WebAPK created** | no | **yes** (Google Play image or device) |
| **Home-screen icon, launching the installed app** | no | **yes** |
| **Standalone window: no URL bar, own task in recents** | no | **yes** |
| `display-mode: standalone` true in the real app | no | **yes** |
| **Hardware Back button, background/resume, process death** | no | **yes** |
| Real keyboard (IME), soft keyboard resizing the viewport | no | **yes** |
| Real push notifications, notification permission prompt | no | **yes** |
| Real network switching (Wi-Fi to mobile data), battery saver | no | **yes** |
| Biometric / passkey / camera / file picker | no | **yes** |
| Real-world performance (CPU throttling is only approximate) | partial | **yes** |

Rule of thumb: if a user would see it **inside the page**, emulation covers it. If it involves the
**Android OS around the page** (install, launcher, task switcher, back stack, system dialogs), you need a device.

## Setup (Windows PowerShell)

```powershell
# 1. Toolchain: Node, Java 17+, Android Studio (provides the SDK, adb, emulator)
winget install OpenJS.NodeJS.LTS
winget install Google.AndroidStudio            # then run it once to install the SDK
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
# add %ANDROID_HOME%\platform-tools and %ANDROID_HOME%\emulator to PATH, then reopen the terminal

# 2. Verify everything (lists AVDs and devices, flags missing Chrome / Google Play)
npm run android:check

# 3a. EMULATOR: create a Play-enabled AVD once (needs SDK Command-line Tools), then start it
npm run android:avd -- -Name Pixel7_API34 -Api 34
npm run android:emulator -- -Avd Pixel7_API34          # add -Headless for CI

# 3b. PHYSICAL DEVICE: Settings > About phone > tap Build number 7x
#     Settings > Developer options > USB debugging ON; plug in USB; accept the RSA prompt on the phone
adb devices                                             # must say "device", not "unauthorized"
```

On the device's Chrome, open `chrome://flags`, enable **"Enable command line on non-rooted devices"**,
and restart Chrome (Playwright needs it to attach).

### Reaching your app from the device

| App location | BASE_URL |
|---|---|
| Public / staging HTTPS URL | use it directly (best: PWA install needs HTTPS) |
| Dev server on your PC, physical device | `adb reverse tcp:3000 tcp:3000` then `http://localhost:3000` (localhost counts as secure, so service workers work) |
| Dev server on your PC, emulator | `http://10.0.2.2:3000` (service workers will NOT register: not a secure context; prefer `adb reverse` + localhost) |

### Running

```powershell
$env:TEST_ENV = 'staging'
npm run test:android                       # emulation, 4 Android profiles, no device needed
npm run test:android:device                # real Chrome + installed-PWA tests on the attached device

$env:ANDROID_SERIAL = 'emulator-5554'      # when several devices are attached
$env:ANDROID_PWA_PACKAGE = 'org.chromium.webapk.xxxx'   # skip install, test an already-installed app
$env:ANDROID_RECORD = 'true'               # record the device screen for every test
```

## Debugging

- **On failure** the device fixture attaches a full-device screenshot, the UI hierarchy XML
  (`uiautomator dump`: exact Android view ids for new selectors) and the last 300 logcat lines to the HTML report.
- **Page-only screenshot** (`page.screenshot()`) shows web content; **`device.screenshot()`** shows the whole
  screen including status bar, Chrome UI and system dialogs. The device tests attach both.
- **Inspect live in Chrome DevTools:** open `chrome://inspect/#devices` on your PC while the device is attached.
- **Trace:** emulation projects support `trace: 'on-first-retry'` as usual. The device project cannot trace Android UI.
- **Selectors for native UI** (Chrome menu, dialogs) come from the hierarchy dump:
  `device.tap({ res: 'com.android.chrome:id/menu_button' })`, `device.tap({ text: /Install/ })`.

## Known limits

- Playwright's Android support is **experimental**: APIs can change between releases.
- Installing from Chrome's menu creates a real **WebAPK only with Google Play services**; plain AOSP images create a shortcut.
- Chrome's menu/dialog texts and resource ids change between Chrome versions; adjust `src/android/PwaInstaller.ts`.
- Attaching to the installed app uses Chrome's DevTools socket (`adb forward` + `connectOverCDP`). It works for
  standard WebAPKs; verify on your Chrome version.
- One device = one test at a time. Always use `--workers=1` for the device project.
