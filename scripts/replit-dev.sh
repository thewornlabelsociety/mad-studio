#!/usr/bin/env bash
# Start MAD Studio UI + API on Replit (no Workflows panel required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[mad] Building API server..."
pnpm --filter @workspace/api-server run build

echo "[mad] Starting API on :8080 (background)..."
PORT=8080 NODE_ENV=production pnpm --filter @workspace/api-server run start &
API_PID=$!

cleanup() {
  kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 2
if curl -sf "http://127.0.0.1:8080/api/healthz" >/dev/null; then
  echo "[mad] API healthz OK"
else
  echo "[mad] WARNING: API not responding on :8080 — check Secrets and logs above"
fi

echo "[mad] Starting Vite on :24726 (foreground)..."
export PORT=24726
export BASE_PATH=/
exec pnpm --filter @workspace/mad-studio run dev
