# Intégration JARVIS en lecture seule

## Préconditions

Claw3D et JarvisAPI restent deux dépôts, processus et cycles de vie indépendants. Aucun checkout voisin, package `file:`, workspace partagé, sous-module, symlink, volume ou accès à la base de données JARVIS n'est autorisé.

Claw3D ne modifie aucune route JARVIS. Il consomme uniquement les routes déjà présentes:

- `GET /api/status` pour le snapshot visuel;
- `GET /api/events/stream` pour le flux d'activité.

Le WebSocket opérateur `/ws`, le canal `/ws/tv/events`, les routes de tâches et toutes les routes de commande sont exclus.

## Configuration

Créer `.env` depuis `.env.example`, puis renseigner uniquement une origine HTTP(S), sans chemin, query string ni fragment:

```dotenv
VISUAL_ADAPTER=jarvis-readonly
JARVIS_CONNECTOR_ENABLED=true
JARVIS_ORIGIN=https://jarvis.example.internal
VISUAL_BROWSER_PERSISTENCE=false
```

`JARVIS_ORIGIN` est lu côté serveur seulement. Il n'est pas intégré au bundle navigateur. Ne placer aucun token ou cookie dans `.env`.

Installer et démarrer:

```bash
./scripts/install.sh
./scripts/start.sh
```

## Contrat exposé au navigateur

Le navigateur communique uniquement avec les routes Claw3D same-origin:

- `GET /api/visual-runtime/v1/meta`
- `GET /api/visual-runtime/v1/snapshot`
- `GET /api/visual-runtime/v1/events`
- `GET /api/visual-runtime/v1/auth/status`

Les DTO JARVIS sont validés, mappés vers `VisualSnapshot`/`VisualEvent`, filtrés et dédupliqués avant leur émission. Aucun payload brut n'est persisté ou journalisé.

## Échec fermé

Les cas suivants sélectionnent l'adaptateur `null` sans requête JARVIS:

- `JARVIS_CONNECTOR_ENABLED` absent, invalide ou différent de `true`;
- `VISUAL_ADAPTER` absent ou différent de `jarvis-readonly` pour le connecteur;
- `JARVIS_ORIGIN` absent, invalide, avec credentials, chemin, query string ou fragment;
- connecteur explicitement désactivé.

Les timeouts et réponses 401, 403, 429 ou 5xx sont représentés comme états de connexion, sans boucle infinie. La reconnexion utilise un backoff borné avec jitter et respecte `Last-Event-ID`.

## Limite d'authentification

Le relais `session-auth` est désactivé. Le cookie de session JARVIS `SameSite=Strict` reste opaque et attaché à son origine; Claw3D ne le reçoit pas, ne le réécrit pas et ne le transmet pas. Il n'existe aucun endpoint `unlock` ou `logout` actif dans Claw3D.

Si JARVIS exige une session non relayable, l'UI reste verrouillée explicitement. Il ne faut ni assouplir les attributs du cookie, ni exposer un secret au navigateur, ni modifier JARVIS pour contourner cette limite.

## Désactivation immédiate

Une seule procédure, entièrement côté Claw3D:

1. mettre `JARVIS_CONNECTOR_ENABLED=false` et `VISUAL_ADAPTER=null` dans `.env`;
2. exécuter `./scripts/stop.sh`;
3. exécuter `./scripts/start.sh`;
4. vérifier l'état hors ligne dans `/office`.

JARVIS ne doit être ni redémarré ni reconfiguré.
