#!/usr/bin/env bash

# Shared safety primitives for repository-local lifecycle scripts.
# The caller must enable strict mode before sourcing this file.

claw3d_error() {
  printf 'Claw3D: %s\n' "$*" >&2
}

claw3d_die() {
  claw3d_error "$*"
  exit 1
}

claw3d_initialize_root() {
  local entry_path script_dir candidate_root

  entry_path=${1:-}
  [ -n "$entry_path" ] || claw3d_die "chemin du script introuvable"
  [ ! -L "$entry_path" ] || claw3d_die "refus d'exécuter un script via un lien symbolique: $entry_path"

  script_dir=$(CDPATH= cd -P -- "$(dirname -- "$entry_path")" && pwd) \
    || claw3d_die "impossible de résoudre le répertoire du script"
  candidate_root=$(CDPATH= cd -P -- "$script_dir/.." && pwd) \
    || claw3d_die "impossible de résoudre la racine Claw3D"

  [ "$candidate_root" != "/" ] || claw3d_die "la racine du système ne peut pas être une racine Claw3D"
  [ -f "$candidate_root/.claw3d-root" ] \
    || claw3d_die "marqueur .claw3d-root absent dans $candidate_root"
  [ ! -L "$candidate_root/.claw3d-root" ] \
    || claw3d_die "le marqueur .claw3d-root ne peut pas être un lien symbolique"
  [ "$(sed -n '1p' "$candidate_root/.claw3d-root")" = "claw3d.visual-ui.root.v1" ] \
    || claw3d_die "marqueur .claw3d-root invalide"
  [ -f "$candidate_root/package.json" ] \
    || claw3d_die "package.json absent dans $candidate_root"
  [ ! -L "$candidate_root/package.json" ] \
    || claw3d_die "package.json ne peut pas être un lien symbolique"
  grep -Eq '"name"[[:space:]]*:[[:space:]]*"claw3d"' "$candidate_root/package.json" \
    || claw3d_die "identité package.json inattendue dans $candidate_root"

  CLAW3D_ROOT=$candidate_root
  export CLAW3D_ROOT
}

claw3d_assert_inside_root() {
  local target
  target=${1:-}
  [ -n "$target" ] || claw3d_die "cible vide refusée"
  [ "$target" != "$CLAW3D_ROOT" ] || claw3d_die "la racine du dépôt ne peut pas être une cible d'artefact"
  case "$target" in
    "$CLAW3D_ROOT"/*) ;;
    *) claw3d_die "cible extérieure à la racine refusée: $target" ;;
  esac
}

claw3d_resolve_home() {
  local requested parent leaf resolved_parent resolved

  requested=${CLAW3D_HOME:-$CLAW3D_ROOT/.claw3d}
  [ -n "$requested" ] || claw3d_die "CLAW3D_HOME ne peut pas être vide"

  case "$requested" in
    /*) ;;
    *) requested=$CLAW3D_ROOT/$requested ;;
  esac

  case "$requested" in
    *'/../'*|*'/..'|*'/./'*|*'/.'|*'//'*)
      claw3d_die "CLAW3D_HOME contient un chemin ambigu: $requested"
      ;;
  esac

  parent=$(dirname -- "$requested")
  leaf=$(basename -- "$requested")
  [ -d "$parent" ] || claw3d_die "le parent de CLAW3D_HOME doit déjà exister: $parent"
  [ ! -L "$parent" ] || claw3d_die "le parent de CLAW3D_HOME ne peut pas être un lien symbolique"
  resolved_parent=$(CDPATH= cd -P -- "$parent" && pwd) \
    || claw3d_die "impossible de résoudre le parent de CLAW3D_HOME"
  resolved=$resolved_parent/$leaf
  claw3d_assert_inside_root "$resolved"
  [ ! -L "$resolved" ] || claw3d_die "CLAW3D_HOME ne peut pas être un lien symbolique"

  CLAW3D_STATE_ROOT=$resolved
  export CLAW3D_STATE_ROOT
}

claw3d_prepare_state_root() {
  claw3d_resolve_home
  if [ -e "$CLAW3D_STATE_ROOT" ]; then
    [ -d "$CLAW3D_STATE_ROOT" ] || claw3d_die "CLAW3D_HOME existe mais n'est pas un répertoire"
  else
    mkdir -- "$CLAW3D_STATE_ROOT"
  fi
}

claw3d_read_env_value() {
  local key env_file line value first last

  key=${1:?}
  env_file=$CLAW3D_ROOT/.env
  [ -f "$env_file" ] || return 1
  [ ! -L "$env_file" ] || claw3d_die ".env ne peut pas être un lien symbolique"

  line=$(awk -v wanted="$key" '
    /^[[:space:]]*#/ { next }
    {
      candidate=$0
      sub(/^[[:space:]]*export[[:space:]]+/, "", candidate)
      split(candidate, parts, "=")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", parts[1])
      if (parts[1] == wanted) found=candidate
    }
    END { if (found != "") print found }
  ' "$env_file")
  [ -n "$line" ] || return 1

  value=${line#*=}
  value=$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [ ${#value} -ge 2 ]; then
    first=${value%"${value#?}"}
    last=${value#"${value%?}"}
    if { [ "$first" = '"' ] && [ "$last" = '"' ]; } \
      || { [ "$first" = "'" ] && [ "$last" = "'" ]; }; then
      value=${value#?}
      value=${value%?}
    fi
  fi
  printf '%s' "$value"
}

claw3d_require_toolchain() {
  local node_major npm_major

  command -v node >/dev/null 2>&1 || claw3d_die "Node.js est requis (version recommandée: 24.19.0)"
  command -v npm >/dev/null 2>&1 || claw3d_die "npm est requis (version recommandée: 11.17.0)"
  node_major=$(node -p 'Number(process.versions.node.split(".")[0])')
  npm_major=$(npm --version | sed 's/\..*//')
  [ "$node_major" -ge 24 ] || claw3d_die "Node.js 24 ou plus récent est requis"
  [ "$npm_major" -ge 11 ] || claw3d_die "npm 11 ou plus récent est requis"
}
