# Pre-deletion checkpoint

Status: ready for user review; destructive cleanup has not started.

## Git and provenance

- Source tag: `claw3d-upstream-70ba84c` ->
  `70ba84c1b13322eb660a6f7f5c53e36e7067c412`.
- Branch: `codex/jarvis-visual-ui`.
- Baseline commit: `37944e0` (`chore: capture upstream baseline and manifests`).
- Visual-core commit: `c02abe7` (`feat: extract neutral visual core`).
- Claw3D source remote is retained as `upstream`.
- Rollback branch command:
  `git branch restore/claw3d-upstream claw3d-upstream-70ba84c`.

## Baseline evidence

- Upstream tracked files: 608; 8,013,013 bytes; 153,478 text lines.
- Baseline lint: exit 1, 9 errors and 26 warnings.
- Baseline typecheck: exit 0.
- Baseline unit tests: exit 1, 5 failed and 1,073 passed.
- Baseline production build: exit 0.
- Baseline E2E: unable to launch the confined browser after the CDN failed to
  close a fully downloaded archive; Playwright failed closed instead of using a
  machine-level browser cache.
- Detailed evidence: `BASELINE_REPORT.md`.

## Additive extraction delivered before deletion

- Neutral contract v1, fixtures and required ports in `packages/visual-contract`.
- Pure reducer, stale-event defense, deduplication, reset handling, geometry,
  navigation and view-models in `packages/visual-core`.
- Props/callback-driven React Three Fiber/Drei office and Phaser builder in
  `packages/visual-react`.
- Deterministic `mock` and zero-network `null` adapters.
- Minimal Next composition shell in `apps/claw3d-ui` with explicit adapter
  configuration and default-closed behavior.
- Injected, optional browser preferences using the neutral namespace
  `claw3d.visual.v1.` plus an explicit UI erase action.
- Code-native geometry; no unverified GLB or vendored avatar is used by the new UI.

## Checkpoint validation

- New-code ESLint: exit 0, no findings.
- Visual boundary rule: clean; forbidden transport/server/backend tokens absent
  from `visual-core` and `visual-react`.
- Visual typecheck: exit 0.
- Visual tests: exit 0, 11 passed across 3 files.
- Next production build: exit 0; `/office` and `/office/builder` are dynamic
  runtime-configured routes.
- Browser validation: all nine mock scenarios passed (`loading`, `empty`,
  `offline`, `inactive`, `active`, `error`, `multiple`, `reconnect`, `reset`).
- `null` browser validation: offline state rendered, zero actors, retry affordance,
  no scenario or mutation controls.
- Responsive validation: 390x844 DOM remained complete and usable.
- JarvisAPI HEAD remains at `991c8e1a7f6a8e359fa76ade0e8f61876b7346b3`.

### External JarvisAPI worktree change observed

JarvisAPI was on `main` and clean at startup and remained clean after the Claw3D
baseline. During the checkpoint validation, another concurrent workflow switched
that checkout to `codex/chore-offline-first` and created frontend/web changes with
file modification times between 2026-08-11 01:48:39Z and 01:52:18Z. The affected
paths are `frontend/src/lib/api.ts`, `frontend/src/test-setup.ts`,
`frontend/src/lib/api-offline.test.ts`, `frontend/src/lib/http.ts`,
`frontend/src/lib/offline/**`, `web/src/App.tsx`,
`web/src/app/components/views/TasksView.tsx`, `web/src/lib/offline/**`, and
`web/src/app/components/pwa/OfflineStatus.tsx`.

This Claw3D work used only read-only Git commands against JarvisAPI and did not
create that branch or those files. They are preserved untouched. Consequently,
the final `git diff --exit-code` reversibility proof is blocked by external work
until that workflow finishes or its owner restores a clean JarvisAPI checkout.

## Screenshots

- `artifacts/checkpoint/screenshots/office-mock.jpg`
- `artifacts/checkpoint/screenshots/builder-mock.jpg`
- `artifacts/checkpoint/screenshots/office-mock-mobile.jpg`

## Manifests and deletion gate

The manifests are generated from exact repository paths and verify unique full
coverage: 669 files total, with 18 KEEP, 161 REFACTOR and 490 REMOVE paths.
`DELETION_PLAN.md` defines the ordered post-approval procedure. The
`REMOVE_MANIFEST.md` path set has not been applied.

Approval of this checkpoint authorizes only the exact cleanup in the Claw3D
branch. It does not authorize a push, pull request, deployment, JarvisAPI change,
or full-source deletion test.
