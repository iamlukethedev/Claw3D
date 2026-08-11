# Rapport de validation

Date: 2026-08-11

Branche: `codex/jarvis-visual-ui`

Environnement local: macOS arm64, Node.js 26.5.0, npm 11.17.0

Version recommandée/CI: Node.js 24.19.0, npm 11.17.0

## Résumé

| Porte | Commande | Résultat |
|---|---|---|
| Confinement | `./scripts/verify-containment.sh` | Réussi avant installation, après build/tests, pendant exécution et après nettoyage |
| Frontières | `npm run visual:boundaries` | Réussi |
| Lint | `npm run visual:lint` | Réussi, zéro erreur |
| Typecheck | `npm run visual:typecheck` | Réussi |
| Unitaires | `npm run visual:test` | Réussi — 6 fichiers, 23 tests |
| Production | `npm run visual:build` | Réussi — 9 routes Next.js produites |
| E2E | `npm run visual:e2e` | Réussi — 8/8 desktop/mobile, 6,3 s lors de la passe finale |
| Office | `scripts/wait-for-server.mjs .../office` | Réussi |
| Builder | `scripts/wait-for-server.mjs .../office/builder` | Réussi |

Les tests E2E couvrent le shell visuel historique, le blocage du trafic privé en mock, tous les scénarios déterministes, la navigation clavier, les contrôles en lecture seule, le responsive desktop/mobile et le builder sans fausse action save/publish.

## Installation propre et idempotence

1. `./scripts/uninstall.sh --dry-run` a énuméré six artefacts existants sous la racine.
2. `./scripts/uninstall.sh` a retiré uniquement ces artefacts générés.
3. `./scripts/install.sh` a créé un `.env` non secret car aucun fichier n'existait, installé 643 packages avec le cache `.claw3d/npm-cache`, puis validé frontières, lint, typecheck, 23 tests et build.
4. Une seconde exécution a conservé `.env`, détecté le même digest de `package-lock.json`, ignoré `npm ci`, puis rejoué les validations et le build avec succès.

`npm ci` a signalé cinq scripts d'installation non encore approuvés par le mécanisme npm 11 `allow-scripts`; aucune approbation globale ou modification système n'a été effectuée. Le build reste vert.

## Démarrage et arrêt

- Premier `scripts/start.sh`: `/office` et `/office/builder` disponibles sur l'interface locale configurable.
- Démarrage répété pendant l'exécution: même PID retourné.
- `scripts/stop.sh`: arrêt par SIGTERM sans escalade.
- Second arrêt: résultat idempotent « déjà arrêté ».
- Après E2E/arrêt: fichiers PID absents, ports 3000 et 3210 libres.

## Copie indépendante avec espaces

Une copie contrôlée nommée `Claw3D path with spaces` a été créée sans reprendre `node_modules`, `.env`, `.next` ou `.claw3d`.

Résultats:

- confinement avant install: réussi;
- install complète avec cache propre à la copie: réussi;
- lint/typecheck/23 tests/build: réussis;
- seconde install: dépendances réutilisées;
- mock `/office` et builder: réussis;
- double start/double stop: réussis;
- uninstall dry-run: trois cibles explicites;
- uninstall réel: trois artefacts supprimés, code et `.env` conservés;
- confinement post-nettoyage: réussi;
- aucun PID/processus/port résiduel;
- copie retirée manuellement après validation canonique, sans tester `--remove-source`.

## Playwright et navigateur

Deux tentatives de téléchargement local Playwright ont reçu 100 % des archives mais sont restées bloquées à la fermeture de connexion CDN sous Node.js 26. Elles ont été interrompues et leurs répertoires partiels supprimés.

La suite a ensuite été exécutée avec un Chrome système préexistant, sélectionné par la variable de test `CLAW3D_PLAYWRIGHT_EXECUTABLE_PATH`; tous les temporaires et résultats Claw3D restaient dans `.claw3d`. La CI épinglée sur Node.js 24.19.0 utilise `chromium-headless-shell` téléchargé dans le dépôt, mais aucun run GitHub n'a été exécuté faute d'autorisation de push.

## Non exécuté

- `shellcheck`: binaire absent de la machine; `bash -n` est réussi sur tous les scripts.
- suppression complète `scripts/uninstall.sh --remove-source`: interdite sans autorisation explicite et donc non exécutée.
- workflow GitHub Actions: non exécuté sur GitHub, car aucun push/PR n'est autorisé.
- nettoyage des chemins `REMOVE_MANIFEST.md`: checkpoint toujours en attente d'approbation explicite.
