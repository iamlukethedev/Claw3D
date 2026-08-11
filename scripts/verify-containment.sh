#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH=${BASH_SOURCE[0]}
SCRIPT_DIR=$(CDPATH= cd -P -- "$(dirname -- "$SCRIPT_PATH")" && pwd)
# shellcheck source=scripts/lib/project-root.sh
. "$SCRIPT_DIR/lib/project-root.sh"

claw3d_initialize_root "$SCRIPT_PATH"
claw3d_resolve_home
claw3d_require_toolchain

node "$CLAW3D_ROOT/scripts/verify-containment.mjs" "$CLAW3D_ROOT" "$CLAW3D_STATE_ROOT"
