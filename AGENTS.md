# Agent Instructions

Keep repository instructions generic, safe for open source, and aligned with the standalone visual product.

## Product boundary

Claw3D is an autonomous Next.js visual UI. Preserve the historical isometric office, pixel actors, amber/cyan HUD, and Phaser builder. `visual-core` means visual state only: it must never become an agent engine, orchestration layer, or business backend.

JarvisAPI is strictly external and read-only from this repository's perspective. Never modify it, import its source, mount its data, add a local path dependency, copy secrets, or couple either repository's lifecycle to the other.

The only allowed backend integration is the server-side, fail-closed connector documented in `docs/JARVIS_INTEGRATION.md`. Browser code receives neutral visual contracts only.

## Repository lifecycle

- Install with `./scripts/install.sh`.
- Start with `./scripts/start.sh` and stop with `./scripts/stop.sh`.
- Validate with `./scripts/verify-containment.sh` and the `visual:*` npm scripts.
- Clean generated artifacts with `./scripts/uninstall.sh`; never exercise `--remove-source` without explicit user authorization.
- Never use sudo, global package installs, system services, or persistent paths outside this repository.
- Never overwrite an existing `.env`.

## Quality gates

Run the targeted checks first, then the complete visual validation appropriate to the change:

```bash
npm run visual:boundaries
npm run visual:lint
npm run visual:typecheck
npm run visual:test
npm run visual:build
npm run visual:e2e
```

All Playwright downloads and output must use repository-local paths under `.claw3d/`.

## Destructive cleanup checkpoint

Do not delete paths covered by `REMOVE_MANIFEST.md` until the user explicitly approves the checkpoint in `CHECKPOINT_REPORT.md`. This approval does not authorize push, PR creation, JarvisAPI changes, or full source deletion.
