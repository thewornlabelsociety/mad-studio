# Loads repo-root .env into Process environment (safe for nested PowerShell -Command).
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$envFile = Join-Path $Root ".env"
if (-not (Test-Path $envFile)) {
    return
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $parts = $line.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if ($key) {
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}
