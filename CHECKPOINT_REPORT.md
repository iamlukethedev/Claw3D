# Pre-deletion checkpoint

Status: ready for explicit user review. The destructive cleanup described by
`REMOVE_MANIFEST.md` has **not** started.

## Git and reversibility

- Claw3D source SHA: `70ba84c1b13322eb660a6f7f5c53e36e7067c412`.
- JarvisAPI source `main` SHA: `991c8e1a7f6a8e359fa76ade0e8f61876b7346b3`.
- Working branch: `codex/jarvis-visual-ui`.
- Source tag: `claw3d-upstream-70ba84c` -> exact source SHA.
- Preserved first minimal prototype tag: `claw3d-minimal-prototype-49157b0` ->
  `49157b0e111e951c7f3b5b75e0742a9c1c61b4c8`.
- Claw3D source remote remains named `upstream`.
- Exact clean rollback branch command:
  `git branch restore/claw3d-upstream claw3d-upstream-70ba84c`.

Local commits at this checkpoint:

1. `37944e0` — baseline and manifests.
2. `c02abe7` — neutral visual contract and core.
3. `49157b0` — deterministic mock/null adapters and preserved minimal prototype.
4. `46678f0` — faithful historical office and builder restoration.
5. `c7066e2` — isolated read-only private connector.
6. `deadee8` — network-free faithful scene and licensed assets.
7. `517c290` — connector/cookie boundary tests.
8. `c4d73a2` — confined desktop/mobile Playwright coverage.

## Baseline evidence

- Upstream tracked files: 608; 8,013,013 bytes; 153,478 text lines.
- Baseline lint: exit 1, 9 errors and 26 warnings.
- Baseline typecheck: exit 0.
- Baseline unit tests: exit 1, 5 failed and 1,073 passed.
- Baseline production build: exit 0.
- The first repository-local Chromium download reached 100% but its CDN stream
  did not close. The complete archive was retained inside `.claw3d/tmp`, passed
  `unzip -t`, and was extracted only into
  `.claw3d/playwright-browsers/chromium-1208`. No global browser was used.
- Detailed evidence: `BASELINE_REPORT.md`.

## Additive implementation delivered before deletion

- Neutral visual contract v1 and fixtures in `packages/visual-contract`.
- Pure reducer, stale-event defense, deduplication, reset handling, geometry,
  navigation and view-models in `packages/visual-core`.
- Faithful React Three Fiber/Drei office and Phaser builder in
  `packages/visual-react`, controlled by props/callbacks.
- Historical light isometric room, furniture, pixel actors, amber/cyan HUD,
  building directory and camera controls restored after the first prototype was
  rejected visually.
- The rejected minimal treatment remains recoverable through its dedicated tag;
  it is not the active UI.
- Deterministic `mock`, zero-request `null`, and read-only private-source
  adapters.
- Minimal Next composition in `apps/claw3d-ui`, with exact fail-closed runtime
  selection.
- Server connector allowlist limited to `GET /api/status` and
  `GET /api/events/stream`; the browser only receives neutral same-origin
  snapshots and SSE events.
- No business command endpoints. Session authentication is explicitly disabled:
  `SameSite=Strict` source cookies are not copied, rewritten, forwarded or
  exposed. All request/response cookie-header allowlists are empty.
- Optional browser preferences under `claw3d.visual.v1.` and an explicit UI
  erase action.
- No runtime font/HDR CDN. Scene text uses local canvas textures and lighting is
  code-native.
- `AssetResolver` selects the same-origin asset route. All 17 retained GLB files
  are exact Kenney Furniture Kit 1.0 binaries under CC0; provenance is recorded
  in `ASSET_AUDIT.md` and `THIRD_PARTY_NOTICES.md`.

## Checkpoint validation

| Command | Exit | Exact result |
| --- | ---: | --- |
| `npm run visual:typecheck` | 0 | TypeScript completed without diagnostics. |
| `npm run visual:boundaries` | 0 | Visual boundary verification passed. |
| `npm run visual:test` | 0 | 6 files passed; 23 tests passed. |
| `npx eslint apps/claw3d-ui/src packages tests/visual tests/e2e-visual playwright.visual.config.ts` | 0 | No lint findings. |
| `npm run visual:build` | 0 | Next production build completed; all retained routes compiled. |
| `npx playwright test --config playwright.visual.config.ts` with repository-local browser/temp paths | 0 | 8 tests passed on desktop and mobile Chromium in 37.8 seconds. |

Playwright covers the nine mock scenarios (`loading`, `empty`, `offline`,
`inactive`, `active`, `error`, `multiple`, `reconnect`, `reset`), keyboard panel
access, responsive rendering, the Phaser builder, absence of fake save/publish
actions, and a hard block on private connector routes and non-Claw3D origins in
mock mode. No failed asset response or client exception is accepted.

The unit suite additionally covers duplicate, unknown, stale, reset, malformed,
401/403, 429/5xx retry classification, bounded reconnect, numeric
`Last-Event-ID`, exact request/header allowlists, raw payload redaction and the
closed cookie/session boundary.

## JarvisAPI read-only proof at checkpoint

- JarvisAPI `main` still resolves exactly to
  `991c8e1a7f6a8e359fa76ade0e8f61876b7346b3`.
- Its worktree is clean at inspection time.
- Another workflow has placed that checkout on clean branch
  `codex/chore-roadmap-audit` at
  `5a1c0a0ef20f4116d1df610421a96bddf658e711`; therefore a diff between the
  current checkout and the source SHA is non-empty by definition.
- This implementation issued only read-only Git/source inspections in
  JarvisAPI. It created no JarvisAPI branch, commit, tag, file, runtime state or
  configuration.
- The final proof will compare the preserved `main` ref/tree and a clean
  worktree without switching or modifying the externally owned branch.

## Screenshots

- Historical references:
  `artifacts/reference/screenshots/office-original-unobscured.jpg` and
  `artifacts/reference/screenshots/builder-original.jpg`.
- Active faithful mock UI:
  `artifacts/checkpoint/screenshots/office-faithful-mock.jpg` and
  `artifacts/checkpoint/screenshots/builder-faithful-mock.jpg`.
- The earlier minimal mock screenshots remain only as audit evidence and are
  recoverable with the preserved prototype tag.

## Manifests and deletion gate

The generated manifests currently cover 697 repository paths exactly once:
37 KEEP, 184 REFACTOR and 476 REMOVE. `DELETION_PLAN.md` defines the ordered
post-approval process. No path from `REMOVE_MANIFEST.md` has been deleted.

Explicit approval of this checkpoint authorizes only those validated Claw3D
deletions on `codex/jarvis-visual-ui`. It does not authorize a push, PR,
deployment, JarvisAPI modification or full-source removal test.
