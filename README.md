# Claw3D Visual UI

[![Visual UI CI](https://github.com/iamlukethedev/Claw3D/actions/workflows/visual-ui.yml/badge.svg)](https://github.com/iamlukethedev/Claw3D/actions/workflows/visual-ui.yml)

Claw3D est une interface visuelle autonome pour JARVIS. Elle conserve le bureau isométrique historique, les acteurs pixel, les panneaux d'activité et le builder Phaser, tout en isolant le rendu de tout moteur d'agents ou backend métier.

Le mode `mock` fonctionne sans JARVIS et sans requête réseau. L'intégration facultative `jarvis-readonly` passe uniquement par un connecteur serveur Claw3D à liste blanche; aucun token, cookie JARVIS ou payload brut n'entre dans le JavaScript navigateur.

Source préservée: dépôt MIT de Luke The Dev, SHA `70ba84c1b13322eb660a6f7f5c53e36e7067c412`. Voir [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) et [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Installation rapide

Prérequis: Git, Node.js `24.19.0` et npm `11.17.0`. Les versions sont épinglées dans `.nvmrc`, `.node-version` et `package.json`.

```bash
git clone https://github.com/iamlukethedev/Claw3D.git
cd Claw3D
cp .env.example .env
./scripts/install.sh
./scripts/start.sh
```

Ouvrir ensuite:

- bureau: `http://127.0.0.1:3000/office`
- builder: `http://127.0.0.1:3000/office/builder`

`install.sh` ne remplace jamais un `.env` existant. S'il est absent, le script crée une copie non secrète de `.env.example`. Une seconde exécution réutilise les dépendances lorsque `package-lock.json` n'a pas changé, puis rejoue les validations et le build.

Tout l'état propre au projet reste sous la racine clonée:

- dépendances: `node_modules/`
- build: `apps/claw3d-ui/.next/`
- cache npm, temporaires, logs, PID et navigateurs de test: `.claw3d/`
- configuration locale: `.env`

Aucune installation globale, élévation de privilèges ou création de service système n'est utilisée.

## Modes d'exécution

### Démonstration autonome

Configuration par défaut:

```dotenv
VISUAL_ADAPTER=mock
JARVIS_CONNECTOR_ENABLED=false
VISUAL_BROWSER_PERSISTENCE=false
```

Le scénario mock couvre chargement, vide, hors ligne, acteurs inactifs/actifs/en erreur, tâches, notifications, reconnexion et reset du flux.

### Hors ligne strict

```dotenv
VISUAL_ADAPTER=null
JARVIS_CONNECTOR_ENABLED=false
```

L'UI affiche un état hors ligne propre et n'émet aucune requête vers JARVIS.

### JARVIS en lecture seule

```dotenv
VISUAL_ADAPTER=jarvis-readonly
JARVIS_CONNECTOR_ENABLED=true
JARVIS_ORIGIN=https://votre-origine-jarvis.example
```

Puis redémarrer Claw3D:

```bash
./scripts/stop.sh
./scripts/start.sh
```

Le connecteur utilise uniquement `GET /api/status` et `GET /api/events/stream` côté JARVIS. Les routes same-origin servies au navigateur sont sous `/api/visual-runtime/v1/`. Le relais d'authentification est volontairement désactivé: le cookie `SameSite=Strict` de JARVIS n'est ni copié, ni réécrit, ni exposé.

Si `JARVIS_CONNECTOR_ENABLED` est absent, invalide ou différent de `true`, le mode JARVIS échoue fermé vers l'adaptateur `null` et n'envoie aucune requête. La procédure complète est dans [docs/JARVIS_INTEGRATION.md](docs/JARVIS_INTEGRATION.md).

## Arrêt, nettoyage et suppression

```bash
# arrêt idempotent
./scripts/stop.sh

# voir exactement ce qui serait nettoyé
./scripts/uninstall.sh --dry-run

# supprimer uniquement les artefacts régénérables confinés
./scripts/uninstall.sh
```

Le nettoyage conserve le dépôt Git, le code source et `.env`. La suppression complète est une option distincte, interactive, refusée sans confirmation exacte et disponible uniquement si une commande de corbeille `trash` existe:

```bash
./scripts/uninstall.sh --remove-source
```

Cette dernière option ne doit jamais être automatisée. Avant de retirer le répertoire, utiliser dans l'UI l'action d'effacement des préférences navigateur si la persistance a été activée. Aucun script shell ne peut effacer à distance les caches génériques du navigateur, du système, de GitHub ou des outils; Claw3D garantit seulement qu'aucun composant actif ni état nécessaire à son fonctionnement n'est créé hors de sa racine.

Voir [UNPLUG_RUNBOOK.md](UNPLUG_RUNBOOK.md) pour le débranchement immédiat et le rollback.

## Validation locale

```bash
./scripts/verify-containment.sh
npm run visual:boundaries
npm run visual:lint
npm run visual:typecheck
npm run visual:test
npm run visual:build
npx --no-install playwright install chromium-headless-shell
PLAYWRIGHT_BROWSERS_PATH="$PWD/.claw3d/playwright-browsers" npm run visual:e2e
./scripts/verify-containment.sh
```

Les résultats vérifiés, y compris les essais dans un chemin contenant des espaces et le nettoyage simulé d'une copie contrôlée, sont consignés dans [TEST_REPORT.md](TEST_REPORT.md) et [REMOVAL_PROOF.md](REMOVAL_PROOF.md).

## Architecture

```text
apps/claw3d-ui
  ├── visual-react ──> visual-core ──> visual-contract
  ├── adapter-mock ─────────────────> visual-contract
  ├── adapter-null ─────────────────> visual-contract
  └── adapter-jarvis-readonly ──────> visual-contract
```

La composition Next.js est le seul endroit qui choisit l'adaptateur. `visual-core` est sans I/O; `visual-react` ne connaît ni réseau, ni environnement serveur, ni backend. Détails dans [docs/architecture/visual-ui.md](docs/architecture/visual-ui.md).

## État de migration et réversibilité Git

La branche d'extraction conserve un checkpoint vérifiable avant le nettoyage destructif, décrit dans [CHECKPOINT_REPORT.md](CHECKPOINT_REPORT.md), [KEEP_MANIFEST.md](KEEP_MANIFEST.md), [REFACTOR_MANIFEST.md](REFACTOR_MANIFEST.md) et [REMOVE_MANIFEST.md](REMOVE_MANIFEST.md). Les fichiers historiques marqués `REMOVE` restent inertes tant que ce checkpoint n'a pas reçu l'approbation explicite requise.

Le tag local non poussé `claw3d-upstream-70ba84c` pointe exactement sur le SHA source. Pour recréer une branche propre depuis l'amont d'origine:

```bash
git switch -c claw3d-upstream-clean claw3d-upstream-70ba84c
```

Le remote `upstream` doit rester configuré; aucune branche, modification, dépendance locale ou sous-module n'est nécessaire dans JarvisAPI.
