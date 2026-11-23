# Starts an Android emulator and waits until it has fully booted.
#   .\scripts\android\start-emulator.ps1                       # default AVD
#   .\scripts\android\start-emulator.ps1 -Avd Pixel_7_API_34
#   .\scripts\android\start-emulator.ps1 -Headless             # no window (CI)
param(
  [string]$Avd = 'Medium_Phone_API_36',
  [switch]$Headless,
  [int]$TimeoutSeconds = 240
)
$ErrorActionPreference = 'Stop'

$sdk = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $sdk) { throw 'Android SDK not found. Set ANDROID_HOME.' }
$adb = Join-Path $sdk 'platform-tools\adb.exe'
$emu = Join-Path $sdk 'emulator\emulator.exe'

$known = & $emu -list-avds
if ($known -notcontains $Avd) { throw "AVD '$Avd' not found. Available: $($known -join ', ')" }

# Already running?
$running = (& $adb devices) | Select-String -Pattern '^emulator-\d+\s+device'
if ($running) { Write-Host "An emulator is already running: $($running[0])"; exit 0 }

$args = @('-avd', $Avd, '-no-snapshot-save', '-no-boot-anim', '-gpu', 'auto')
if ($Headless) { $args += @('-no-window', '-no-audio') }
Write-Host "Starting $Avd ..."
Start-Process -FilePath $emu -ArgumentList $args -WindowStyle Hidden

& $adb wait-for-device
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
  Start-Sleep -Seconds 3
  $booted = (& $adb shell getprop sys.boot_completed 2>$null).Trim()
} while ($booted -ne '1' -and (Get-Date) -lt $deadline)

if ($booted -ne '1') { throw "Emulator did not finish booting within $TimeoutSeconds s." }

# Stable test conditions: no animations, screen stays on.
& $adb shell settings put global window_animation_scale 0
& $adb shell settings put global transition_animation_scale 0
& $adb shell settings put global animator_duration_scale 0
& $adb shell svc power stayon true
Write-Host 'Emulator is ready.' -ForegroundColor Green
& $adb devices -l
