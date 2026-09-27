# ==============================================================================
# MAD STUDIO - Windows Local Dev Launcher (API + Vite)
# ==============================================================================
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 1. Load Root .env into Current Session
if (Test-Path "$root\.env") {
    Write-Host "[env] Loading root .env..." -ForegroundColor Cyan
    Get-Content "$root\.env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $key, $value = $line.Split("=", 2)
            [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
        }
    }
} else {
    Write-Warning "[env] No .env file found at root!"
}

# 2. Cleanup Old Next.js Leftovers If Present
if (Test-Path "$root\.next") {
    Write-Host "[clean] Removing legacy .next folder..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "$root\.next" -ErrorAction SilentlyContinue
}

# 3. Spawn API Server on Port 8080 (New Window)
Write-Host "[api] Starting API server on http://localhost:8080..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
    Set-Location '$root'
    `$env:PORT = '8080'
    pnpm --filter @workspace/api-server run build
    pnpm --filter @workspace/api-server run start
"@

# 4. Spawn Frontend on Port 5173 (New Window)
Write-Host "[ui] Starting Vite UI on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
    Set-Location '$root'
    `$env:PORT = '5173'
    `$env:BASE_PATH = '/'
    pnpm --filter @workspace/mad-studio run dev
"@

Write-Host "MAD STUDIO local processes initiated. Open http://localhost:5173" -ForegroundColor Green
