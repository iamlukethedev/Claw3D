#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH=${BASH_SOURCE[0]}
SCRIPT_DIR=$(CDPATH= cd -P -- "$(dirname -- "$SCRIPT_PATH")" && pwd)
# shellcheck source=scripts/lib/project-root.sh
. "$SCRIPT_DIR/lib/project-root.sh"

claw3d_initialize_root "$SCRIPT_PATH"
claw3d_resolve_home

state_file=$CLAW3D_STATE_ROOT/run/claw3d.state
if [ ! -e "$state_file" ]; then
  printf 'Claw3D est déjà arrêté.\n'
  exit 0
fi
[ -f "$state_file" ] && [ ! -L "$state_file" ] || claw3d_die "fichier PID ambigu: $state_file"

pid=$(awk -F= '$1 == "pid" { print substr($0, 5); exit }' "$state_file")
stored_root=$(awk -F= '$1 == "root" { print substr($0, 6); exit }' "$state_file")
stored_start=$(awk -F= '$1 == "started" { print substr($0, 9); exit }' "$state_file")
case "$pid" in *[!0-9]*|'') claw3d_die "PID invalide dans $state_file" ;; esac
[ "$stored_root" = "$CLAW3D_ROOT" ] || claw3d_die "la racine enregistrée ne correspond pas au dépôt courant"

if ! kill -0 "$pid" 2>/dev/null; then
  rm -f -- "$state_file"
  printf 'Claw3D était déjà arrêté; état PID périmé retiré.\n'
  exit 0
fi

current_start=$(ps -p "$pid" -o lstart= | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
command_line=$(ps -p "$pid" -o command=)
[ -n "$stored_start" ] && [ "$stored_start" = "$current_start" ] \
  || claw3d_die "le PID $pid a été réutilisé; arrêt refusé"
case "$command_line" in
  *next*start*|*next-server*) ;;
  *) claw3d_die "le PID $pid n'appartient pas à un serveur Next.js Claw3D; arrêt refusé" ;;
esac

kill -TERM "$pid"
remaining=20
while kill -0 "$pid" 2>/dev/null && [ "$remaining" -gt 0 ]; do
  sleep 1
  remaining=$((remaining - 1))
done

if kill -0 "$pid" 2>/dev/null; then
  claw3d_die "le processus $pid n'a pas répondu à SIGTERM; aucun signal destructif supplémentaire n'a été envoyé"
fi

rm -f -- "$state_file"
printf 'Claw3D arrêté proprement (PID %s).\n' "$pid"
