#!/usr/bin/env bash
# S1.4 integration run — starts the 3 mock workers + supervisor, runs the
# integration test that seeds a job and verifies completion, then cleans up.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

# Load env (DATABASE_URL, REDIS_URL)
set -a
# shellcheck disable=SC1091
source .env
set +a

echo "=== Building supervisor ==="
(cd services/supervisor && npx tsc)

echo "=== Starting workers (research, script, voice) ==="
node workers/research/dist/index.js &
RESEARCH_PID=$!
node workers/script/dist/index.js &
SCRIPT_PID=$!
node workers/voice/dist/index.js &
VOICE_PID=$!

cleanup() {
  kill "$RESEARCH_PID" "$SCRIPT_PID" "$VOICE_PID" 2>/dev/null || true
  wait "$RESEARCH_PID" "$SCRIPT_PID" "$VOICE_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Give workers time to connect to Redis.
sleep 3

echo "=== Running integration test ==="
(cd services/supervisor && npx tsx itest/run-integration.ts)
