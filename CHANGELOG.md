# Changelog

## [0.1.3] - 2026-03-21

### Added

- **SOUNDCLAW**: in-app music console powered by Spotify, embedded in the 3D office. Connects via OAuth, supports search, play/pause/skip/volume, device selection, and now-playing display. Requires Spotify Premium and an active playback device. Local auth redirect must use `http://127.0.0.1:3000/api/spotify/callback`.

## [0.1.2] - 2026-03-20

### Added

- An in-app avatar creator for agents with live 3D preview, appearance presets, and accessory controls for customizing office avatars.
- A unified agent editor modal in the office that lets you edit avatars alongside agent brain files such as `IDENTITY.md`, `SOUL.md`, `AGENTS.md`, `USER.md`, `TOOLS.md`, `MEMORY.md`, and `HEARTBEAT.md`.
- Structured avatar profile persistence and normalization so studio settings can store full avatar appearance data per gateway and agent instead of only avatar seeds.
- A `DEBUG` environment toggle for controlling the OpenClaw event console in the office UI.

### Changed

- Reworked office avatar rendering so 3D agents reflect saved appearance profiles, including hair, clothing, hats, glasses, headsets, backpacks, and other visual variations.
- Replaced avatar shuffle entry points in the chat and office surfaces with avatar customization flows that open the editor directly.
- Updated the office HUD with a compact agent roster, overflow handling, and direct shortcuts into per-agent editing from the 3D office view.
- Expanded the brain editor so `IDENTITY.md` fields are edited in structured form and agent renames can be applied to the live gateway agent after saving.
- Defaulted the OpenClaw event console to a collapsed state and made it optional from environment configuration.
- Updated hydration and store state to carry full avatar profiles through agent loading, persistence, and rendering.

### Fixed

- Fixed WebSocket gateway authentication during the upgrade handshake by wiring access control through the `ws` `verifyClient` flow.
- Fixed the gym release directive TypeScript error by adding explicit `"release"` support to office gym directives and aligning release-hold logic.
- Corrected studio settings merging and normalization for avatar data so saved office appearances survive reloads and patch updates.
- Kept skill gym hold state active for release directives during office animation trigger reconciliation.

### Tests

- Added unit coverage for avatar profile persistence, studio settings normalization, and fleet hydration with structured avatar data.
- Expanded end-to-end coverage for avatar settings fixtures, office header and sidebar flows, voice reply settings persistence, disconnected office settings surfaces, and office route expectations.

## [0.1.1] - 2026-03-19

### Added

- Uploaded entire repo

## [0.1.0] - 2026-03-16

### Added

- Initial public Claw3D project documentation, including `README.md`, `VISION.md`, and `ARCHITECTURE.md`.
- A gateway-first web UI for connecting to OpenClaw agents, monitoring runtime activity, and managing agent workflows.
- A retro-office 3D environment for visualizing agent activity, spatial interactions, and immersive operational surfaces.
- An office builder flow for editing and publishing office layouts.
