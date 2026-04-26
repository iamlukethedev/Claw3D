# Changelog

## [0.1.4] - 2026-04-23

Runtime Profiles, Multi-Floor Offices, Remote Collaboration, and Diagnostics.

This release converges the runtime-profiles, office-systems, claw3doctor, and selective `vera_lane` work into one branch. Backends become named profiles, the office becomes a multi-floor building, remote offices gain server-backed messaging and handoffs, and a new diagnostics CLI makes setup and troubleshooting first-class.

### Added

- Named runtime profiles for `openclaw`, `hermes`, `demo`, `local`, `claw3d`, and `custom` backends, each storing its own URL and token in Studio settings instead of a single global pair (`docs/runtime-profiles.md`, `src/lib/runtime/*`).
- Multi-floor office runtime model with one runtime binding per floor and persistent per-floor state, including `lobby`, `openclaw-ground`, `hermes-first`, `local-runtime`, `claw3d-runtime`, `custom-second`, `training`, `traders-floor`, and `campus` (`src/lib/office/floors.ts`, `docs/office_sys/multi-floor-runtime-architecture.md`).
- Floor roster persistence and a floor navigation HUD for moving between runtime-backed floors in a single session (`src/lib/office/floorRoster.ts`, `src/features/office/components/OfficeFloorNav.tsx`, `src/features/office/hooks/useOfficeFloorRuntimePersistence.ts`).
- Remote office messaging API for cross-office direct messages with structured assistant-history reply resolution (`src/app/api/office/remote-message/route.ts`).
- Remote office handoff API for sending task / context / deliverables / acceptance criteria to a remote agent through the runtime layer (`src/app/api/office/remote-handoff/route.ts`, `src/lib/runtime/agentMessaging.ts`).
- Local file upload route for chat attachments with allowlisted MIME types and a 10 MB upload cap (`src/app/api/files/upload/route.ts`).
- `claw3doctor` diagnostics CLI with profile-scoped and `--all-profiles` runs, OpenClaw / Hermes / demo / custom-runtime probes, gateway failure classification, JSON output, and a `npm run doctor` script (`scripts/claw3doctor.mjs`, `scripts/lib/claw3doctor-core.mjs`, `package.json`).
- New product and architecture docs covering runtime profiles, multi-floor architecture, the claw3doctor spec, runtime profile architecture, the refreshed roadmap, multi-agent beta, and the bulletin-board, desk-progression, hierarchy-and-teams, meeting-room-workflow, QA-department, and whiteboard specs (`docs/`).

### Changed

- Runtime provider selection is now profile-aware across `openclaw`, `hermes`, `demo`, `local`, `claw3d`, and `custom` instead of collapsing into one generic path (`src/lib/runtime/createRuntimeProvider.ts`, `src/lib/runtime/{openclaw,hermes,demo,custom}/provider.ts`).
- Studio settings now persist per-profile URL/token entries and an active profile selection, with coordinated bootstrap and hydration paths (`src/lib/studio/settings.ts`, `src/lib/studio/settings-store.ts`, `src/lib/studio/coordinator.ts`).
- Remote agent chat panel and remote office presence flows updated for the new server-backed delivery and reply behavior (`src/features/office/components/RemoteAgentChatPanel.tsx`, `src/features/office/hooks/useRemoteOfficePresence.ts`).
- Hardened production security headers: strict CSP with `'unsafe-eval'` only in dev, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, restrictive `Permissions-Policy`, `Cross-Origin-Resource-Policy: same-origin`, and HSTS in production (`next.config.ts`).
- Access gate rewritten with constant-time token comparison, a per-IP rate limiter (10 attempts / 60s), and `TRUSTED_PROXY=1`-gated `X-Forwarded-For` handling to prevent IP spoofing (`server/access-gate.js`).
- Custom runtime provider and proxy URL handling tightened around runtime boundaries and allowlists (`src/lib/runtime/custom/provider.ts`, `src/lib/gateway/proxy-url.ts`).

### Fixed

- Repaired merge-corrupted files and removed tracked merge artifacts left over from the earlier overlapping branch stack.
- Resolved a UTF-8 / Turbopack parsing issue and cleaned up Turbopack root and optional `openclaw` resolution warnings (`next.config.ts`).
- Office navigation and pathfinding behavior tightened around floor-aware routing and runtime persistence (`src/features/office/screens/OfficeScreen.tsx`, `src/features/retro-office/RetroOffice3D.tsx`).

### Tests

- Added unit coverage for `claw3doctor`, office floors, floor roster, runtime connection, gateway connection, office floor runtime persistence, agent fleet hydration derivation, and studio settings coordinator behavior (`tests/unit/`).

### Docs

- Replaced top-level `MULTI_AGENT_BETA.md` and `ROADMAP.md` with stubs that point to canonical docs under `docs/`, and added a runtime profiles reference from `README.md`.
- Expanded `README.md` to describe `Local` and `Claw3D` runtime modes and persistent backend profile configuration, including the additional `local` and `claw3d` values for `CLAW3D_GATEWAY_ADAPTER_TYPE`.

### Notes

- This release bumps the in-repo app version to `0.1.4`. After merging, cut the GitHub release/tag as `v0.1.4`.
- This is still an early-stage release. Remote office workflows, runtime profiles, multi-floor offices, and the diagnostics CLI will continue to iterate quickly in upcoming versions.

## [0.1.3] - 2026-03-28

Remote Offices, Skills Marketplace, and Company Builder.

This release expands Claw3D from a single-office viewer into a more complete AI workplace, with guided setup, richer agent operations, remote office support, and stronger security hardening.

### Added

- New onboarding wizard for first-time setup, including gateway connection, prerequisites, company details, and initial agent configuration.
- New packaged skills marketplace with trigger-driven office routing, including starter skills like Todo Board and SOUNDCLAW.
- New office agent management wizard for creating and managing agents directly from the office experience.
- New multi-agent beta support for remote office layouts, presence sync, and remote messaging.
- New company builder wizard with AI-assisted organization generation and bootstrap planning.
- Runtime gateway URL fallback through `/api/studio` for more reliable environment-specific setup.

### Changed

- Improved UI polish, responsiveness, and accessibility across the main app and office surfaces.
- Hardened access control so gating applies across all routes, not only `/api`.
- Enforced voice upload size limits before buffering.

### Fixed

- Closed multiple path traversal and file-path validation gaps in local file operations.
- Resolved symlink handling issues in path suggestions.
- Improved office navigation and pathfinding by fixing diagonal corner-cutting, metadata-driven blockers, collision-aware routing, and A* failure behavior.
- Removed a TypeScript TS2367 build blocker in `skillGymDirective`.

### Docs

- Added an Agent Bus integration guide for visualizing AI sessions in Claw3D.
- Refreshed the public roadmap.

### Notes

- This is still an early-stage release. The platform is moving quickly, especially around remote office workflows, skills, and guided setup, so expect rapid iteration in upcoming versions.

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
