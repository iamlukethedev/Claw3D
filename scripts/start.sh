#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH=${BASH_SOURCE[0]}
SCRIPT_DIR=$(CDPATH= cd -P -- "$(dirname -- "$SCRIPT_PATH")" && pwd)
# shellcheck source=scripts/lib/project-root.sh
. "$SCRIPT_DIR/lib/project-root.sh"

claw3d_initialize_root "$SCRIPT_PATH"
claw3d_prepare_state_root
claw3d_require_toolchain

mkdir -p -- "$CLAW3D_STATE_ROOT/logs" "$CLAW3D_STATE_ROOT/run" "$CLAW3D_STATE_ROOT/tmp"

state_file=$CLAW3D_STATE_ROOT/run/claw3d.state
log_file=$CLAW3D_STATE_ROOT/logs/claw3d.log
app_root=$CLAW3D_ROOT/apps/claw3d-ui

if [ -e "$state_file" ]; then
  [ -f "$state_file" ] && [ ! -L "$state_file" ] || claw3d_die "fichier PID ambigu: $state_file"
  existing_pid=$(awk -F= '$1 == "pid" { print substr($0, 5); exit }' "$state_file")
  case "$existing_pid" in *[!0-9]*|'') existing_pid=0 ;; esac
  if [ "$existing_pid" -gt 0 ] && kill -0 "$existing_pid" 2>/dev/null; then
    printf 'Claw3D est déjà démarré (PID %s).\n' "$existing_pid"
    exit 0
  fi
  rm -f -- "$state_file"
fi

[ -f "$app_root/.next/BUILD_ID" ] \
  || claw3d_die "build absent; exécutez d'abord $CLAW3D_ROOT/scripts/install.sh"
[ -x "$CLAW3D_ROOT/node_modules/.bin/next" ] \
  || claw3d_die "dépendances absentes; exécutez d'abord $CLAW3D_ROOT/scripts/install.sh"

env_visual_adapter=$(claw3d_read_env_value VISUAL_ADAPTER || true)
env_connector_enabled=$(claw3d_read_env_value JARVIS_CONNECTOR_ENABLED || true)
env_jarvis_origin=$(claw3d_read_env_value JARVIS_ORIGIN || true)
env_persistence=$(claw3d_read_env_value VISUAL_BROWSER_PERSISTENCE || true)
env_host=$(claw3d_read_env_value CLAW3D_HOST || true)
env_port=$(claw3d_read_env_value CLAW3D_PORT || true)

visual_adapter=${VISUAL_ADAPTER:-${env_visual_adapter:-mock}}
connector_enabled=${JARVIS_CONNECTOR_ENABLED:-${env_connector_enabled:-false}}
jarvis_origin=${JARVIS_ORIGIN:-${env_jarvis_origin:-}}
browser_persistence=${VISUAL_BROWSER_PERSISTENCE:-${env_persistence:-false}}
host=${CLAW3D_HOST:-${env_host:-127.0.0.1}}
port=${CLAW3D_PORT:-${env_port:-3000}}

case "$host" in
  *[!A-Za-z0-9:._-]*|'') claw3d_die "CLAW3D_HOST invalide" ;;
esac
case "$port" in *[!0-9]*|'') claw3d_die "CLAW3D_PORT doit être numérique" ;; esac
[ "$port" -ge 1024 ] && [ "$port" -le 65535 ] || claw3d_die "CLAW3D_PORT doit être compris entre 1024 et 65535"

export VISUAL_ADAPTER=$visual_adapter
export JARVIS_CONNECTOR_ENABLED=$connector_enabled
export JARVIS_ORIGIN=$jarvis_origin
export VISUAL_BROWSER_PERSISTENCE=$browser_persistence
export npm_config_cache=$CLAW3D_STATE_ROOT/npm-cache
export npm_config_update_notifier=false
export TMPDIR=$CLAW3D_STATE_ROOT/tmp
export PLAYWRIGHT_BROWSERS_PATH=$CLAW3D_STATE_ROOT/playwright-browsers
export NEXT_TELEMETRY_DISABLED=1

: > "$log_file"
(
  CDPATH= cd -- "$app_root"
  nohup "$CLAW3D_ROOT/node_modules/.bin/next" start --hostname "$host" --port "$port" \
    >> "$log_file" 2>&1 &
  printf '%s\n' "$!" > "$CLAW3D_STATE_ROOT/run/claw3d.pid.tmp"
)
pid=$(sed -n '1p' "$CLAW3D_STATE_ROOT/run/claw3d.pid.tmp")
rm -f -- "$CLAW3D_STATE_ROOT/run/claw3d.pid.tmp"
case "$pid" in *[!0-9]*|'') claw3d_die "PID de démarrage invalide" ;; esac

started_at=$(ps -p "$pid" -o lstart= | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
{
  printf 'pid=%s\n' "$pid"
  printf 'root=%s\n' "$CLAW3D_ROOT"
  printf 'port=%s\n' "$port"
  printf 'started=%s\n' "$started_at"
} > "$state_file"

probe_host=$host
case "$probe_host" in 0.0.0.0|'::') probe_host=127.0.0.1 ;; esac
if ! node "$CLAW3D_ROOT/scripts/wait-for-server.mjs" "http://$probe_host:$port/office" 30000; then
  kill "$pid" 2>/dev/null || true
  rm -f -- "$state_file"
  claw3d_die "démarrage échoué; consultez $log_file"
fi

printf 'Claw3D démarré: http://%s:%s/office (PID %s)\n' "$probe_host" "$port" "$pid"
printf 'Builder: http://%s:%s/office/builder\n' "$probe_host" "$port"
printf 'Logs confinés: %s\n' "$log_file"
