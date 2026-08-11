# Preuve de confinement et de réversibilité

Date de référence: 2026-08-11.

Ce document distingue les preuves exécutées des validations encore interdites ou en attente. Il ne revendique pas un effacement forensique des caches génériques du navigateur, du système, de GitHub ou des outils.

## Identité Git

| Élément | Valeur vérifiée |
|---|---|
| Claw3D source | `70ba84c1b13322eb660a6f7f5c53e36e7067c412` |
| Tag de rollback | `claw3d-upstream-70ba84c` |
| Branche de travail | `codex/jarvis-visual-ui` |
| JarvisAPI source de référence | `991c8e1a7f6a8e359fa76ade0e8f61876b7346b3` |

## Résultats avant la vérification lifecycle

| Contrôle | Résultat |
|---|---|
| Frontières `visual-core` / `visual-react` | Réussi |
| Typecheck visuel | Réussi |
| Tests unitaires visuels | Réussi — 6 fichiers, 23 tests |
| Build production visuel | Réussi |
| Playwright desktop/mobile | Réussi — 8/8 |
| Ports de validation arrêtés | Réussi — 3100, 3200, 3201, 3210 et 18789 libres |
| JarvisAPI modifié | Non — worktree propre au contrôle |

## Validation du cycle de vie

| Contrôle | Résultat exact |
|---|---|
| `scripts/verify-containment.sh` avant install | Réussi |
| installation figée sans ancien `node_modules` | Réussi — 643 packages, cache npm sous `.claw3d/npm-cache`, puis lint/typecheck/tests/build verts |
| deuxième installation idempotente | Réussi — `.env` conservé, `npm ci` ignoré car lockfile identique, validations et build rejoués |
| démarrage mock sans JARVIS | Réussi sur `127.0.0.1:3000` |
| `/office` et `/office/builder` | Réussi |
| second démarrage | Réussi — même PID signalé, aucun deuxième serveur |
| arrêt puis second arrêt | Réussi — SIGTERM propre puis état « déjà arrêté » |
| adaptateur `null` / fail-closed | Réussi par tests de configuration/adaptateurs; aucune requête JARVIS autorisée en mock/null |
| copie dans un chemin contenant des espaces | Réussi dans `Claw3D path with spaces` |
| install autonome de la copie | Réussi — cache, `.env`, build, logs et PID internes à la copie |
| deuxième install de la copie | Réussi — dépendances réutilisées; build explicitement ignoré après un premier build vert |
| uninstall `--dry-run` sur copie contrôlée | Réussi — trois cibles explicites, aucune suppression |
| uninstall des artefacts de la copie | Réussi — `node_modules`, build app et `.claw3d` uniquement; code et `.env` conservés |
| absence de processus/PID après arrêt | Réussi — PID absent et ports 3000/3210 libres |
| retrait manuel de la copie contrôlée | Réussi après contrôle du marqueur, de `package.json`, du chemin canonique et de l'absence de symlink |
| confinement après build/test/run | Réussi; les symlinks du dépôt, des dépendances et de l'état généré ont été résolus et contrôlés |

La copie de test a été créée sous l'état local du checkout principal, arrêtée, nettoyée puis supprimée manuellement. L'option `--remove-source` n'a pas été utilisée.

## Playwright

Les 8 tests desktop/mobile ont réussi lors de la passe finale en 6,3 s avec un Chrome système déjà présent, tandis que `TMPDIR`, résultats et profils de test restaient sous `.claw3d`.

Deux téléchargements Playwright vers le stockage local du dépôt ont atteint 100 % mais leur processus n'a pas fermé la connexion CDN sous Node.js 26. Les processus ont été interrompus proprement et tous les téléchargements partiels ont été supprimés. La CI utilise Node.js 24.19.0 et télécharge `chromium-headless-shell` dans `.claw3d/playwright-browsers`; cette exécution GitHub n'est pas revendiquée puisqu'aucun push n'a été autorisé.

## Suppression complète

L'option `scripts/uninstall.sh --remove-source` n'a pas été exécutée. Son test est explicitement interdit sans autorisation utilisateur. Le nettoyage d'artefacts et le retrait manuel de la copie temporaire contrôlée ne constituent pas un test de cette option sur le dépôt source.

## Nettoyage destructif du dépôt

Les suppressions listées dans `REMOVE_MANIFEST.md` n'ont pas commencé. Elles exigent l'approbation explicite du checkpoint `CHECKPOINT_REPORT.md`. Cette preuve lifecycle ne vaut pas approbation de ces suppressions.
