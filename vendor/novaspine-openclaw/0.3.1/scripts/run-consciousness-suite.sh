#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SUITE_REPO="${NOVASPINE_CONSCIOUSNESS_REPO:-${CONSCIOUSNESS_REPO:-$HOME/nova-consciousness-suite}}"
PORT="${NOVASPINE_CONSCIOUSNESS_PORT:-${CONSCIOUSNESS_PORT:-4111}}"
STATE_ROOT="${NOVASPINE_CONSCIOUSNESS_STATE_ROOT:-${CONSCIOUSNESS_STATE_ROOT:-$HOME/.local/share/novaspine-consciousness}}"
SEMANTIC_BASE_URL="${NOVASPINE_CONSCIOUSNESS_SEMANTIC_BASE_URL:-${CONSCIOUSNESS_SEMANTIC_BASE_URL:-http://127.0.0.1:8420}}"
STORE_BACKEND="${NOVASPINE_CONSCIOUSNESS_STORE_BACKEND:-${CONSCIOUSNESS_STORE_BACKEND:-sqlite}}"
SQLITE_PATH="${NOVASPINE_CONSCIOUSNESS_SQLITE_PATH:-${CONSCIOUSNESS_SQLITE_PATH:-$STATE_ROOT/novaspine-consciousness.sqlite}}"
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
NPM_BIN="${NPM_BIN:-$(command -v npm || true)}"

mkdir -p "$ROOT_DIR/logs" "$STATE_ROOT"

if [[ ! -f "$SUITE_REPO/package.json" ]]; then
  echo "Consciousness Suite package.json not found under: $SUITE_REPO" >&2
  exit 1
fi

if [[ -z "$NPM_BIN" ]]; then
  echo "npm not found in PATH while starting the Consciousness Suite." >&2
  exit 1
fi

if [[ ! -d "$SUITE_REPO/node_modules" ]]; then
  (cd "$SUITE_REPO" && "$NPM_BIN" install --no-fund --no-audit >/dev/null)
fi

exec env \
  NODE_ENV=production \
  CONSCIOUSNESS_ORCHESTRATOR_HOST=127.0.0.1 \
  CONSCIOUSNESS_ORCHESTRATOR_PORT="$PORT" \
  CONSCIOUSNESS_ORCHESTRATOR_STATE_ROOT="$STATE_ROOT" \
  CONSCIOUSNESS_ORCHESTRATOR_DISABLE_INTERVALS=true \
  CONSCIOUSNESS_ORCHESTRATOR_SEMANTIC_MODE=remote \
  CONSCIOUSNESS_ORCHESTRATOR_SEMANTIC_BASE_URL="$SEMANTIC_BASE_URL" \
  NOVA_RUNTIME_STORE_BACKEND="$STORE_BACKEND" \
  NOVA_RUNTIME_SQLITE_PATH="$SQLITE_PATH" \
  "$NPM_BIN" --prefix "$SUITE_REPO" run start:suite
