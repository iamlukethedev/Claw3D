# Architecture Boundaries

- `visual-core`: pure reducers, navigation, geometry, animation state, and view-models; no I/O, framework server APIs, environment reads, backend names, or routes.
- `visual-react`: props/callback-driven React, Three.js/React Three Fiber/Drei, and Phaser UI; no fetch/WebSocket/EventSource/filesystem/env access.
- Network DTO validation and translation belong in adapter-specific anti-corruption layers.
- Browser talks only to same-origin Claw3D endpoints and receives neutral visual contract data; no secrets or raw backend payloads.
- JARVIS integration is server-only, exact-route allowlisted, disabled closed unless explicitly enabled, and has no business-command capability.
- Session authentication is disabled: the source `SameSite=Strict` cookie is never copied, rewritten, forwarded, or exposed between origins.
- The active product preserves the historical Claw3D isometric office, pixel actors, amber/cyan HUD, building directory, and Phaser builder. The rejected minimal prototype is preserved only by local tag `claw3d-minimal-prototype-49157b0`.
- Runtime visual assets are selected through `AssetResolver`; the retained 17 GLBs are exact Kenney Furniture Kit 1.0 CC0 binaries.
- Lifecycle entrypoints are `scripts/install.sh`, `start.sh`, `stop.sh`, `uninstall.sh`, and `verify-containment.sh`. They derive the canonical root from their own location and keep npm cache, Playwright downloads, temp files, logs, PID, builds, and persistent state inside the repository; external `CLAW3D_HOME` values are rejected.
- The supported toolchain is pinned to Node.js 24.19.0 and npm 11.17.0. Production installation does not download a test browser; CI downloads `chromium-headless-shell` into `.claw3d/playwright-browsers`.
- Full source removal is a separate interactive trash-only path and must never be tested without explicit authorization. Browser preferences must be cleared through the UI because shell cleanup cannot erase browser storage remotely.
- No destructive cleanup of `REMOVE_MANIFEST.md` paths may begin until the user explicitly approves the checkpoint documented in `CHECKPOINT_REPORT.md`.
