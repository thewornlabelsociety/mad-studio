# Kill port 8080, rebuild api-server, start with root .env (single window).
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

& (Join-Path $PSScriptRoot "load-root-env.ps1") -Root $root

function Stop-Port8080 {
    $ids = @()
    try {
        $ids = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object { $_.OwningProcess } | Where-Object { $_ -gt 0 } | Select-Object -Unique
    } catch {}
    if (-not $ids) {
        netstat -ano | Select-String "LISTENING" | Select-String ":8080\s" | ForEach-Object {
            if ($_.Line -match '\s(\d+)\s*$') { $ids += [int]$Matches[1] }
        }
    }
    foreach ($id in ($ids | Select-Object -Unique)) {
        Write-Host "Stopping PID $id on :8080"
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

Stop-Port8080

$env:PORT = "8080"
$env:MAD_API_BUILD_ID = "manual-" + (Get-Date -Format "yyyyMMdd-HHmmss")

Set-Location "$root\artifacts\api-server"
Write-Host "Building api-server..."
node ./build.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Starting API on http://localhost:8080 (MAD_API_BUILD_ID=$env:MAD_API_BUILD_ID)"
node --enable-source-maps ./dist/index.mjs
