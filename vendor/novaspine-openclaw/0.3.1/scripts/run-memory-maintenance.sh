#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_PATH="${NOVASPINE_REPO:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
PYTHON_PATH="${NOVASPINE_PYTHON:-$REPO_PATH/.venv/bin/python}"
DATA_DIR="${NOVASPINE_DATA_DIR:-$HOME/.local/share/novaspine}"
PROFILE_ROOT="${NOVASPINE_PROFILE_ROOT:-${OPENCLAW_PROFILE_ROOT:-$HOME/.openclaw}}"
STATUS_DIR="${NOVASPINE_STATUS_DIR:-$PROFILE_ROOT/status}"
STATUS_PATH="${NOVASPINE_STATUS_PATH:-$STATUS_DIR/novaspine-status.json}"
SEED_SCRIPT="${NOVASPINE_SEED_SCRIPT:-$SCRIPT_DIR/seed-memory.py}"
GUARDRAILS_SCRIPT="${NOVASPINE_GUARDRAILS_SCRIPT:-$SCRIPT_DIR/guardrails.py}"
LOCK_DIR="$DATA_DIR/.maintenance.lock"
LOCK_PID_FILE="$LOCK_DIR/pid"

usage() {
  echo "Usage: $0 {prune-noise|sync-action-memory|consolidate|promote-fixes|writeback-lessons|dream}" >&2
}

if [[ -z "$ACTION" ]]; then
  usage
  exit 2
fi

if [[ ! -x "$PYTHON_PATH" ]]; then
  echo "NovaSpine python runtime not found at: $PYTHON_PATH" >&2
  exit 1
fi

export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
export C3AE_DATA_DIR="$DATA_DIR"
export PYTHONPATH="$REPO_PATH/src${PYTHONPATH:+:$PYTHONPATH}"
export C3AE_RECALL_AUDIT="${C3AE_RECALL_AUDIT:-1}"
export C3AE_RECALL_AUDIT_MAX_EVENTS="${C3AE_RECALL_AUDIT_MAX_EVENTS:-${NOVASPINE_RECALL_AUDIT_MAX_EVENTS:-8}}"
export C3AE_SOURCE_WEIGHT_PROFILE="${C3AE_SOURCE_WEIGHT_PROFILE:-${NOVASPINE_SOURCE_WEIGHT_PROFILE:-default}}"
export NOVASPINE_NOISE_PROFILE="${NOVASPINE_NOISE_PROFILE:-${NOVASPINE_PROFILE:-default}}"
export NOVASPINE_SANITIZE_PROFILE="${NOVASPINE_SANITIZE_PROFILE:-${NOVASPINE_PROFILE:-default}}"
export NOVASPINE_PROFILE_ROOT="$PROFILE_ROOT"
export NOVASPINE_STATUS_DIR="$STATUS_DIR"
export NOVASPINE_STATUS_PATH="$STATUS_PATH"
export NOVASPINE_DB_PATH="${NOVASPINE_DB_PATH:-$DATA_DIR/db/c3ae.db}"
export NOVASPINE_REPO="$REPO_PATH"
export NOVASPINE_PYTHON="$PYTHON_PATH"

mkdir -p "$DATA_DIR" "$STATUS_DIR"

release_lock() {
  rm -rf "$LOCK_DIR"
}

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$LOCK_PID_FILE"
    trap release_lock EXIT INT TERM
    return 0
  fi

  if [[ -f "$LOCK_PID_FILE" ]]; then
    local holder_pid
    holder_pid="$(tr -dc '0-9' < "$LOCK_PID_FILE" 2>/dev/null || true)"
    if [[ -n "$holder_pid" ]] && ! kill -0 "$holder_pid" 2>/dev/null; then
      rm -rf "$LOCK_DIR"
      if mkdir "$LOCK_DIR" 2>/dev/null; then
        printf '%s\n' "$$" > "$LOCK_PID_FILE"
        trap release_lock EXIT INT TERM
        return 0
      fi
    fi
  fi

  printf '{"status":"skipped","reason":"maintenance-lock-held"}\n'
  exit 0
}

acquire_lock

run_guardrails_prune() {
  if [[ ! -f "$GUARDRAILS_SCRIPT" ]]; then
    return 0
  fi
  "$PYTHON_PATH" "$GUARDRAILS_SCRIPT" prune \
    --min-free-bytes "${NOVASPINE_MIN_FREE_BYTES:-12884901888}" \
    --max-backup-bytes "${NOVASPINE_MAX_BACKUP_BYTES:-6442450944}" \
    --max-backup-count "${NOVASPINE_MAX_BACKUP_COUNT:-6}" \
    --min-keep "${NOVASPINE_MIN_BACKUP_KEEP:-3}" >/dev/null
}

run_guardrails_report() {
  if [[ ! -f "$GUARDRAILS_SCRIPT" ]]; then
    return 0
  fi
  "$PYTHON_PATH" "$GUARDRAILS_SCRIPT" report >/dev/null
}

run_seed() {
  if [[ ! -f "$SEED_SCRIPT" ]]; then
    return 0
  fi
  "$PYTHON_PATH" "$SEED_SCRIPT" >/dev/null
}

run_optional_backfill() {
  if "$PYTHON_PATH" -m c3ae.cli --help 2>&1 | grep -q 'backfill-facts'; then
    "$PYTHON_PATH" -m c3ae.cli backfill-facts --limit 4000 >/dev/null || true
  fi
}

sync_action_memory() {
  "$PYTHON_PATH" "$SCRIPT_DIR/novaspine-prune-noise.py"
  "$PYTHON_PATH" "$SCRIPT_DIR/novaspine-sync-action-memory.py"
  "$PYTHON_PATH" -m c3ae.cli consolidate --max-chunks 1000
}

status=0
run_guardrails_prune || status=$?
run_seed || status=$?

case "$ACTION" in
  prune-noise)
    "$PYTHON_PATH" "$SCRIPT_DIR/novaspine-prune-noise.py" || status=$?
    ;;
  sync-action-memory)
    sync_action_memory || status=$?
    ;;
  consolidate)
    "$PYTHON_PATH" -m c3ae.cli consolidate --max-chunks 1000 || status=$?
    ;;
  promote-fixes)
    sync_action_memory || status=$?
    if [[ "$status" -eq 0 ]]; then
      "$PYTHON_PATH" "$SCRIPT_DIR/novaspine-promote-fixes.py" || status=$?
    fi
    ;;
  writeback-lessons)
    sync_action_memory || status=$?
    if [[ "$status" -eq 0 ]]; then
      "$PYTHON_PATH" "$SCRIPT_DIR/novaspine-writeback-lessons.py" || status=$?
    fi
    ;;
  dream)
    "$PYTHON_PATH" "$SCRIPT_DIR/novaspine-dream-report.py" || status=$?
    ;;
  *)
    usage
    exit 2
    ;;
esac

if [[ "$status" -eq 0 ]]; then
  case "$ACTION" in
    sync-action-memory|consolidate|promote-fixes|writeback-lessons|dream)
      run_seed || status=$?
      run_optional_backfill
      ;;
  esac
fi

"$PYTHON_PATH" "$SCRIPT_DIR/novaspine-prune-noise.py" >/dev/null || true
run_guardrails_prune || status=$?
run_guardrails_report || true
exit "$status"
