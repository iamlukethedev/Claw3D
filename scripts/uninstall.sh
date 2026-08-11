#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH=${BASH_SOURCE[0]}
SCRIPT_DIR=$(CDPATH= cd -P -- "$(dirname -- "$SCRIPT_PATH")" && pwd)
# shellcheck source=scripts/lib/project-root.sh
. "$SCRIPT_DIR/lib/project-root.sh"

claw3d_initialize_root "$SCRIPT_PATH"
claw3d_resolve_home

dry_run=false
remove_source=false
for option in "$@"; do
  case "$option" in
    --dry-run) dry_run=true ;;
    --remove-source) remove_source=true ;;
    *) claw3d_die "option inconnue: $option" ;;
  esac
done
[ "$dry_run" = false ] || [ "$remove_source" = false ] \
  || claw3d_die "--dry-run et --remove-source ne peuvent pas être combinés"

targets=(
  "$CLAW3D_ROOT/node_modules"
  "$CLAW3D_ROOT/.next"
  "$CLAW3D_ROOT/apps/claw3d-ui/.next"
  "$CLAW3D_ROOT/coverage"
  "$CLAW3D_ROOT/playwright-report"
  "$CLAW3D_ROOT/test-results"
  "$CLAW3D_ROOT/output/playwright"
  "$CLAW3D_ROOT/.playwright-home"
  "$CLAW3D_ROOT/.playwright-cli"
  "$CLAW3D_ROOT/tsconfig.tsbuildinfo"
  "$CLAW3D_ROOT/apps/claw3d-ui/tsconfig.tsbuildinfo"
  "$CLAW3D_STATE_ROOT"
)

existing_targets=()
for target in "${targets[@]}"; do
  claw3d_assert_inside_root "$target"
  if [ -L "$target" ]; then
    claw3d_die "cible générée sous forme de lien symbolique; suppression refusée: $target"
  fi
  if [ -e "$target" ]; then
    if [ ! -d "$target" ] && [ ! -f "$target" ]; then
      claw3d_die "type de cible inattendu; suppression refusée: $target"
    fi
    existing_targets+=("$target")
  fi
done

if [ "$dry_run" = true ]; then
  printf 'Mode simulation: Claw3D ne sera pas arrêté et aucun fichier ne sera supprimé.\n'
else
  "$CLAW3D_ROOT/scripts/stop.sh"
fi

if [ "${#existing_targets[@]}" -eq 0 ]; then
  printf 'Aucun artefact généré à nettoyer.\n'
else
  printf 'Artefacts générés vérifiés (%s):\n' "${#existing_targets[@]}"
  printf '  %s\n' "${existing_targets[@]}"
  if [ "$dry_run" = false ]; then
    for target in "${existing_targets[@]}"; do
      if [ -d "$target" ]; then
        rm -r -- "$target"
      else
        rm -- "$target"
      fi
    done
    printf 'Artefacts supprimés. Le code source et .env ont été conservés.\n'
  fi
fi

if [ "$remove_source" = false ]; then
  exit 0
fi

[ -t 0 ] || claw3d_die "la suppression du dépôt complet exige un terminal interactif"
user_home=$(CDPATH= cd -P -- "${HOME:?}" && pwd)
[ "$CLAW3D_ROOT" != "$user_home" ] || claw3d_die "la racine Claw3D ne peut pas être le répertoire personnel"
[ "$CLAW3D_ROOT" != "/" ] || claw3d_die "la racine du système est refusée"
parent=$(dirname -- "$CLAW3D_ROOT")
if [ -e "$parent/.git" ]; then
  claw3d_die "Claw3D semble imbriqué dans un autre dépôt; suppression complète refusée"
fi
command -v trash >/dev/null 2>&1 \
  || claw3d_die "aucune commande 'trash' disponible; le dépôt n'a pas été supprimé. Déplacez-le manuellement vers la corbeille."

printf 'Cible canonique à déplacer vers la corbeille:\n  %s\n' "$CLAW3D_ROOT"
printf 'Cette action conserve les caches génériques du navigateur, du système et des outils.\n'
printf 'Saisissez exactement « REMOVE %s » pour continuer: ' "$CLAW3D_ROOT"
IFS= read -r confirmation
[ "$confirmation" = "REMOVE $CLAW3D_ROOT" ] || claw3d_die "confirmation incorrecte; dépôt conservé"

CDPATH= cd -P -- "$parent"
trash -- "$CLAW3D_ROOT"
printf 'Le répertoire Claw3D a été déplacé vers la corbeille.\n'
