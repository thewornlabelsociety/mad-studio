#!/usr/bin/env bash
# Start MAD Studio UI + API on Replit (no Workflows panel required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_PORT="${MAD_API_PORT:-8080}"
UI_PORT="${PORT:-24726}"

port_open() {
  local port="$1"
  (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
}

api_health_ok() {
  curl -sf "http://127.0.0.1:${API_PORT}/api/healthz" >/dev/null 2>&1
}

echo "[mad] Installing workspace dependencies..."
CI=true pnpm install --frozen-lockfile

STARTED_API=0
API_PID=""

stop_started_api() {
  if [[ "$STARTED_API" == "1" && -n "$API_PID" ]]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap stop_started_api INT TERM

if api_health_ok; then
  echo "[mad] API already healthy on :${API_PORT} — skipping API start."
else
  echo "[mad] Building API server..."
  pnpm --filter @workspace/api-server run build

  echo "[mad] Starting API on :${API_PORT} (background)..."
  PORT="$API_PORT" NODE_ENV=production pnpm --filter @workspace/api-server run start &
  API_PID=$!
  STARTED_API=1

  sleep 2
  if api_health_ok; then
    echo "[mad] API healthz OK"
  else
    echo "[mad] WARNING: API not responding on :${API_PORT} — check Secrets and logs above"
  fi
fi

if port_open "$UI_PORT"; then
  echo "[mad] Port ${UI_PORT} is already in use (Replit mad-studio workflow may be running)."
  echo "[mad] Use the existing Preview tab — API is ready for /api/*."
  if [[ "$STARTED_API" == "1" ]]; then
    echo "[mad] API PID ${API_PID}. Press Ctrl+C here to stop only this API process."
    wait "$API_PID"
  fi
  exit 0
fi

echo "[mad] Starting Vite on :${UI_PORT} (foreground)..."
export PORT="$UI_PORT"
export BASE_PATH="${BASE_PATH:-/}"
exec pnpm --filter @workspace/mad-studio run dev
