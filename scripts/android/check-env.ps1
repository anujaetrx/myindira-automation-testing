# Verifies the Android toolchain and lists devices/emulators. Safe to run any time.
#   .\scripts\android\check-env.ps1
$ErrorActionPreference = 'Continue'

function Resolve-Sdk {
  foreach ($c in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk")) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  return $null
}

$sdk = Resolve-Sdk
Write-Host "== Android toolchain ==" -ForegroundColor Cyan
Write-Host ("Node           : " + (node -v))
$java = & java -version 2>&1 | Select-Object -First 1
Write-Host ("Java           : " + $java)

if (-not $sdk) {
  Write-Host "Android SDK    : NOT FOUND. Install Android Studio, or set ANDROID_HOME." -ForegroundColor Red
  exit 1
}
Write-Host "Android SDK    : $sdk"

$adb = Join-Path $sdk 'platform-tools\adb.exe'
$emu = Join-Path $sdk 'emulator\emulator.exe'
if (-not (Test-Path $adb)) { Write-Host "adb            : MISSING ($adb)" -ForegroundColor Red; exit 1 }
Write-Host ("adb            : " + ((& $adb version | Select-Object -First 1)))

Write-Host "`n== Emulator images (AVDs) ==" -ForegroundColor Cyan
if (Test-Path $emu) { & $emu -list-avds } else { Write-Host "emulator not installed (SDK Manager > Android Emulator)" -ForegroundColor Yellow }

Write-Host "`n== Attached devices ==" -ForegroundColor Cyan
& $adb devices -l

$serials = (& $adb devices) | Select-String -Pattern '\sdevice$' | ForEach-Object { ($_ -split '\s+')[0] }
foreach ($s in $serials) {
  $model = (& $adb -s $s shell getprop ro.product.model).Trim()
  $rel   = (& $adb -s $s shell getprop ro.build.version.release).Trim()
  $api   = (& $adb -s $s shell getprop ro.build.version.sdk).Trim()
  $chrome = (& $adb -s $s shell dumpsys package com.android.chrome | Select-String -Pattern 'versionName=' | Select-Object -First 1)
  $play  = (& $adb -s $s shell pm list packages com.android.vending)
  Write-Host ("`n$s : $model, Android $rel (API $api)")
  Write-Host ("  Chrome        : " + $(if ($chrome) { $chrome.ToString().Trim() } else { 'NOT INSTALLED' }))
  Write-Host ("  Google Play   : " + $(if ($play) { 'yes (PWA install can mint a WebAPK)' } else { 'NO (installs become plain shortcuts, not WebAPKs)' }))
}
if (-not $serials) { Write-Host "`nNo ready device. Start an emulator: npm run android:emulator" -ForegroundColor Yellow }
