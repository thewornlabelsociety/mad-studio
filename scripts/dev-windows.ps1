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
$apiCmd = "Set-Location '$rootEsc'; & '$loadEnvEsc' -Root '$rootEsc'; `$env:PORT='8080'; `$env:MAD_API_BUILD_ID='$buildId'; Set-Location '$rootEsc\artifacts\api-server'; node ./build.mjs; if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }; node --enable-source-maps ./dist/index.mjs"
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $apiCmd)

Write-Host "[ui] Starting Vite http://localhost:5173..." -ForegroundColor Green
$uiCmd = "Set-Location '$rootEsc'; & '$loadEnvEsc' -Root '$rootEsc'; `$env:PORT='5173'; `$env:BASE_PATH='/'; pnpm --filter @workspace/mad-studio run dev"
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $uiCmd)

Write-Host ""
Write-Host "Open http://localhost:5173" -ForegroundColor Green
Write-Host "Verify API build: curl http://127.0.0.1:8080/api/healthz  (look for madApiBuildId)" -ForegroundColor DarkGray
Write-Host "If programs 404 persists, run: powershell -File scripts/restart-api.ps1" -ForegroundColor DarkGray
