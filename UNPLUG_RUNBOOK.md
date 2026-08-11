# Runbook de débranchement Claw3D

Ce runbook retire Claw3D sans intervention dans JARVIS.

## 1. Couper immédiatement le connecteur

Dans le `.env` de Claw3D uniquement:

```dotenv
JARVIS_CONNECTOR_ENABLED=false
VISUAL_ADAPTER=null
```

Puis:

```bash
./scripts/stop.sh
./scripts/start.sh
```

Le connecteur échoue fermé et n'émet plus de requête vers JARVIS. Aucune route, configuration ou donnée JARVIS ne change.

## 2. Effacer les préférences navigateur

Si `VISUAL_BROWSER_PERSISTENCE=true` a été utilisé, ouvrir l'action « Effacer les préférences » dans l'UI avant l'arrêt définitif. Un script shell ne peut pas supprimer à distance le stockage du navigateur.

## 3. Arrêter et inspecter

```bash
./scripts/stop.sh
./scripts/stop.sh
./scripts/uninstall.sh --dry-run
```

Le second arrêt doit répondre que Claw3D est déjà arrêté. La simulation énumère seulement des cibles situées sous la racine canonique du dépôt.

## 4. Nettoyer les artefacts régénérables

```bash
./scripts/uninstall.sh
./scripts/verify-containment.sh
```

Le nettoyage conserve `.git`, le code source et `.env`. Il retire la liste explicite suivante lorsqu'elle existe: `node_modules`, builds Next.js, couverture, rapports Playwright, caches TypeScript et `.claw3d`.

Après la suppression de `node_modules`, la vérification de confinement requiert de nouveau Node.js mais aucune dépendance npm.

## 5. Retirer le dépôt complet, facultatif

La suppression complète est interactive, refusée par défaut et ne doit pas être automatisée:

```bash
./scripts/uninstall.sh --remove-source
```

Le script affiche la cible canonique exacte, refuse `/`, le home, un dépôt imbriqué et tout lien symbolique, puis exige une confirmation exacte. Sans commande `trash`, il refuse de supprimer et demande un déplacement manuel vers la corbeille.

Ne jamais lancer cette option en CI ou pendant les tests. Déplacer/supprimer le répertoire Claw3D suffit à retirer le produit et son état propre; les caches génériques du navigateur, du système, de GitHub et des outils peuvent subsister et ne constituent pas une garantie « zéro trace » forensique.

## 6. Rollback Git intégral

Le tag local non poussé `claw3d-upstream-70ba84c` pointe sur le SHA source exact `70ba84c1b13322eb660a6f7f5c53e36e7067c412`.

Créer une branche neuve sans réécrire l'historique:

```bash
git switch -c claw3d-upstream-clean claw3d-upstream-70ba84c
```

Le prototype visuel minimal écarté reste disponible séparément au tag local `claw3d-minimal-prototype-49157b0`.

## 7. Invariants JARVIS

Après arrêt ou suppression de Claw3D:

- démarrer JARVIS avec sa procédure habituelle, sans changement;
- confirmer que son SHA et son worktree sont inchangés;
- confirmer qu'aucun health-check, service ou configuration JARVIS ne référence Claw3D;
- ne supprimer aucun cache, fichier ou processus appartenant à JARVIS depuis ce runbook.
