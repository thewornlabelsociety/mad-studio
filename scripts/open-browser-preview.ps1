# Opens MAD Studio in the default browser (or use Cursor: Simple Browser: Show → http://127.0.0.1:5173)
param(
  [string]$Path = "/login",
  [int]$Port = 5173
)

$url = "http://127.0.0.1:$Port$Path"
Write-Host "Opening $url" -ForegroundColor Cyan
Start-Process $url
