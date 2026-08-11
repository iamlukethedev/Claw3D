#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH=${BASH_SOURCE[0]}
SCRIPT_DIR=$(CDPATH= cd -P -- "$(dirname -- "$SCRIPT_PATH")" && pwd)
# shellcheck source=scripts/lib/project-root.sh
. "$SCRIPT_DIR/lib/project-root.sh"

claw3d_initialize_root "$SCRIPT_PATH"
claw3d_prepare_state_root
claw3d_require_toolchain

skip_build=false
case "${1:-}" in
  '') ;;
  --skip-build) skip_build=true ;;
  *) claw3d_die "option inconnue: ${1:-}" ;;
esac
[ "$#" -le 1 ] || claw3d_die "une seule option est acceptée: --skip-build"

mkdir -p -- \
  "$CLAW3D_STATE_ROOT/npm-cache" \
  "$CLAW3D_STATE_ROOT/tmp" \
  "$CLAW3D_STATE_ROOT/logs" \
  "$CLAW3D_STATE_ROOT/run" \
  "$CLAW3D_STATE_ROOT/playwright-browsers" \
  "$CLAW3D_STATE_ROOT/test-results"

if [ ! -e "$CLAW3D_ROOT/.env" ]; then
  cp -- "$CLAW3D_ROOT/.env.example" "$CLAW3D_ROOT/.env"
  printf 'Configuration locale créée: %s\n' "$CLAW3D_ROOT/.env"
elif [ -f "$CLAW3D_ROOT/.env" ] && [ ! -L "$CLAW3D_ROOT/.env" ]; then
  printf 'Configuration existante conservée sans modification: %s\n' "$CLAW3D_ROOT/.env"
else
  claw3d_die ".env doit être un fichier régulier, jamais un lien symbolique"
fi

lock_digest=$(node -e '
  const crypto = require("node:crypto");
  const fs = require("node:fs");
  process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"));
' "$CLAW3D_ROOT/package-lock.json")
install_stamp=$CLAW3D_STATE_ROOT/install-lock.sha256

export npm_config_cache=$CLAW3D_STATE_ROOT/npm-cache
export npm_config_audit=false
export npm_config_fund=false
export npm_config_update_notifier=false
export TMPDIR=$CLAW3D_STATE_ROOT/tmp
export PLAYWRIGHT_BROWSERS_PATH=$CLAW3D_STATE_ROOT/playwright-browsers
export NEXT_TELEMETRY_DISABLED=1

if [ -d "$CLAW3D_ROOT/node_modules" ] \
  && [ -x "$CLAW3D_ROOT/node_modules/.bin/next" ] \
  && [ -f "$install_stamp" ] \
  && [ "$(sed -n '1p' "$install_stamp")" = "$lock_digest" ]; then
  printf 'Dépendances déjà alignées sur package-lock.json; installation npm ignorée.\n'
else
  printf 'Installation figée des dépendances dans %s\n' "$CLAW3D_ROOT"
  (CDPATH= cd -- "$CLAW3D_ROOT" && npm ci --prefer-offline)
  printf '%s\n' "$lock_digest" > "$install_stamp"
fi

(CDPATH= cd -- "$CLAW3D_ROOT" \
  && npm run visual:boundaries \
  && npm run visual:lint \
  && npm run visual:typecheck \
  && npm run visual:test)

if [ "$skip_build" = false ]; then
  (CDPATH= cd -- "$CLAW3D_ROOT" && npm run visual:build)
else
  printf 'Build ignoré à la demande (--skip-build).\n'
fi

"$CLAW3D_ROOT/scripts/verify-containment.sh"
printf 'Installation Claw3D prête. Démarrage: %s/scripts/start.sh\n' "$CLAW3D_ROOT"
