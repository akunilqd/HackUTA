# Starts the whole PharmaSee system on Windows, each part in its own PowerShell window:
#   1. web        Next.js site + dashboard        http://localhost:3000
#   2. agent      LiveKit/Gemini voice agent       (my-agent: npm start)
#   3. scheduler  reminder calls every minute      (my-agent: npm run scheduler)
#   4. chert dev  only with -Inbound: lets the patient call IN on the FaceTime line
#
# Usage (from the repo root):
#   powershell -ExecutionPolicy Bypass -File .\run-all.ps1
#   powershell -ExecutionPolicy Bypass -File .\run-all.ps1 -Inbound     # also take inbound calls
#   powershell -ExecutionPolicy Bypass -File .\run-all.ps1 -NoWeb       # backend only
# Close a window (or press Ctrl+C in it) to stop that part. Stop chert dev with Ctrl+C, never by killing it.

param(
  [switch]$Inbound,
  [switch]$NoWeb
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$agentDir = Join-Path $root "my-agent"
$webDir = Join-Path $root "web"

function Fail($msg) { Write-Host "x $msg" -ForegroundColor Red; exit 1 }
function Ok($msg) { Write-Host "ok $msg" -ForegroundColor Green }

# --- checks -------------------------------------------------------------------
$nodeVersion = (node --version) 2>$null
if (-not $nodeVersion) { Fail "Node.js is not installed (need 22.23+, 24 or 26)." }
Ok "Node $nodeVersion"

if (-not (Test-Path (Join-Path $agentDir ".env.local"))) { Fail "my-agent\.env.local is missing (LiveKit, Gemini, Chert, Supabase keys)." }
if (-not $NoWeb -and -not (Test-Path (Join-Path $webDir ".env.local"))) {
  Fail "web\.env.local is missing. Copy web\.env.example and fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
}
Ok "env files found"

foreach ($dir in @($agentDir) + $(if ($NoWeb) { @() } else { @($webDir) })) {
  if (-not (Test-Path (Join-Path $dir "node_modules"))) {
    Write-Host "-> npm install in $dir"
    Push-Location $dir; npm install; $code = $LASTEXITCODE; Pop-Location
    if ($code -ne 0) { Fail "npm install failed in $dir" }
  }
}
Ok "dependencies installed"

if (-not $NoWeb) {
  $busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($busy) { Write-Host "! Port 3000 is already in use (another dev server?). The web window will say so; close the old one first." -ForegroundColor Yellow }
}

# --- start each part in its own window -----------------------------------------
function Start-Part($title, $dir, $command) {
  $script = "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location -LiteralPath '$dir'; Write-Host '== $title ==' -ForegroundColor Cyan; $command"
  Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $script) | Out-Null
  Ok "started $title"
}

if (-not $NoWeb) { Start-Part "PharmaSee web" $webDir "npm run dev" }
Start-Part "PharmaSee agent" $agentDir "npm start"
Start-Sleep -Seconds 3   # let the agent register with LiveKit before the first reminder can dispatch it
Start-Part "PharmaSee scheduler" $agentDir "npm run scheduler"

if ($Inbound) {
  if (-not (Get-Command chert -ErrorAction SilentlyContinue)) {
    Write-Host "! chert CLI not found; inbound calls skipped. Install it, run 'chert login' once, then rerun with -Inbound." -ForegroundColor Yellow
  } else {
    Start-Part "PharmaSee chert dev" $agentDir "chert dev"
  }
}

Write-Host ""
if (-not $NoWeb) { Write-Host "Website:   http://localhost:3000   (dashboard: http://localhost:3000/dashboard)" }
Write-Host "Reminders: the scheduler calls each patient at their reminder times (users.timezone)."
