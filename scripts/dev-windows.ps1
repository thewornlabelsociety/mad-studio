# ==============================================================================
# MAD STUDIO - Windows Local Dev Launcher (API + Vite)
# ==============================================================================
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$loadEnvScript = Join-Path $PSScriptRoot "load-root-env.ps1"

if (Test-Path "$root\.env") {
    Write-Host "[env] Loading root .env..." -ForegroundColor Cyan
    & $loadEnvScript -Root $root
} else {
    Write-Warning "[env] No .env file found at root!"
}

if (Test-Path "$root\.next") {
    Write-Host "[clean] Removing legacy .next folder..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "$root\.next" -ErrorAction SilentlyContinue
}

function Get-ListenerProcessIds([int]$Port) {
    $ids = [System.Collections.Generic.HashSet[int]]::new()
    try {
        Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object { if ($_.OwningProcess -gt 0) { [void]$ids.Add($_.OwningProcess) } }
    } catch {}

    if ($ids.Count -eq 0) {
        netstat -ano | Select-String "LISTENING" | Select-String ":$Port\s" | ForEach-Object {
            if ($_.Line -match '\s(\d+)\s*$') {
                [void]$ids.Add([int]$Matches[1])
            }
        }
    }
    return @($ids)
}

function Stop-ListenerOnPort([int]$Port) {
    foreach ($procId in Get-ListenerProcessIds -Port $Port) {
        Write-Host "[clean] Stopping PID $procId on port $Port..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 400
}

Stop-ListenerOnPort -Port 8080
Stop-ListenerOnPort -Port 5173

$rootEsc = $root -replace "'", "''"
$loadEnvEsc = $loadEnvScript -replace "'", "''"
$buildId = "campaign-programs-" + (Get-Date -Format "yyyyMMdd-HHmm")

Write-Host "[api] Building + starting http://localhost:8080 (build $buildId)..." -ForegroundColor Green
$apiCmd = @"
Set-Location '$rootEsc'
& '$loadEnvEsc' -Root '$rootEsc'
Set-Item -Path env:PORT -Value '8080'
Set-Item -Path env:MAD_API_BUILD_ID -Value '$buildId'
Set-Location '$rootEsc\artifacts\api-server'
node ./build.mjs
if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }
node --enable-source-maps ./dist/index.mjs
"@
Start-Process powershell -ArgumentList @("-NoExit", "-NoProfile", "-Command", $apiCmd)

Write-Host "[ui] Starting Vite http://127.0.0.1:5173..." -ForegroundColor Green
$viteBin = Join-Path $root "artifacts\mad-studio\node_modules\vite\bin\vite.js"
$uiCmd = @"
Set-Location '$rootEsc'
& '$loadEnvEsc' -Root '$rootEsc'
Set-Item -Path env:PORT -Value '5173'
Set-Item -Path env:BASE_PATH -Value '/'
Set-Location '$rootEsc\artifacts\mad-studio'
node '$viteBin' --config vite.config.ts --host 127.0.0.1
"@
Start-Process powershell -ArgumentList @("-NoExit", "-NoProfile", "-Command", $uiCmd)

Write-Host ""
Write-Host "Open http://127.0.0.1:5173 (Cursor Simple Browser / Chrome)" -ForegroundColor Green
Write-Host "Or run: powershell -File scripts/open-browser-preview.ps1" -ForegroundColor DarkGray
Write-Host "Verify API build: curl http://127.0.0.1:8080/api/healthz  (look for madApiBuildId)" -ForegroundColor DarkGray
Write-Host "If programs 404 persists, run: powershell -File scripts/restart-api.ps1" -ForegroundColor DarkGray
