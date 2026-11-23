# Creates a Pixel 7 emulator WITH Google Play (needed for PWA -> WebAPK installs).
# Requires the "Android SDK Command-line Tools" (Android Studio > SDK Manager > SDK Tools).
#   .\scripts\android\create-avd.ps1 -Name Pixel7_API34 -Api 34
param(
  [string]$Name = 'Pixel7_API34',
  [int]$Api = 34
)
$ErrorActionPreference = 'Stop'

$sdk = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $sdk) { throw 'Android SDK not found. Set ANDROID_HOME.' }

$bin = Join-Path $sdk 'cmdline-tools\latest\bin'
$sdkmanager = Join-Path $bin 'sdkmanager.bat'
$avdmanager = Join-Path $bin 'avdmanager.bat'
if (-not (Test-Path $avdmanager)) {
  throw "cmdline-tools not installed ($bin). Install 'Android SDK Command-line Tools (latest)' from Android Studio's SDK Manager."
}

$image = "system-images;android-$Api;google_apis_playstore;x86_64"
Write-Host "Installing $image (large download) ..."
& $sdkmanager --install "platform-tools" "emulator" "platforms;android-$Api" $image
'y' | & $sdkmanager --licenses | Out-Null

Write-Host "Creating AVD $Name ..."
'no' | & $avdmanager create avd --name $Name --package $image --device 'pixel_7' --force
Write-Host "Done. Start it with: npm run android:emulator -- -Avd $Name" -ForegroundColor Green
