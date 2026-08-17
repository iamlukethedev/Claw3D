# Code Documentation

This file is the practical code map for Hermes3D contributors.

Use it alongside `README.md` for setup and `ARCHITECTURE.md` for system boundaries. This document is intentionally more hands-on: where code lives, which files matter first, and how to extend the main systems without fighting the current structure.

## Repo Mental Model

Hermes3D is the UI and local Studio/proxy layer around an existing OpenClaw Gateway.

- OpenClaw owns agent execution, sessions, tools, config, and runtime events.
- Hermes3D owns visualization, local Studio settings, UI workflows, office rendering, and the same-origin WebSocket/API bridge.
- When a feature needs authoritative runtime state, prefer Gateway data over local UI state.
- When a feature is only a local preference, it usually belongs in Studio settings.
- Before publishing new bundled assets or vendored code, also update `THIRD_PARTY_ASSETS.md` or `THIRD_PARTY_CODE.md`.

## Top-Level Code Map

### `src/app`

Next.js App Router entry points and API routes.

- Route pages such as `src/app/office/page.tsx` and `src/app/office/builder/page.tsx` are composition roots.
- `src/app/api/*` contains server-side boundaries for Studio settings, gateway-backed helpers, office flows, and path suggestions.
- Keep heavy feature logic out of route files when possible. Route files should mostly compose feature modules and server boundaries.

### `src/features`

Vertical slices for UI and feature-specific state.

- `src/features/agents`: fleet UI, chat, approvals, runtime event workflows, hydration, history sync, and settings-related operations.
- `src/features/office`: office screens, panels, builder surfaces, standup/GitHub/voice flows, and office-facing hooks.
- `src/features/retro-office`: the immersive React Three Fiber office runtime, including 3D objects, navigation, persistence, scene systems, and actor behavior.

When you are changing a user-facing workflow, start in `src/features` before reaching for `src/lib`.

### `src/lib`

Shared domain logic, adapters, and pure helpers.

- `src/lib/gateway`: the browser gateway client and session-key helpers.
- `src/lib/office`: office intent parsing, animation trigger derivation, desk monitor helpers, janitor reset logic, builder schema, and related office domain code.
- `src/lib/studio`: local Studio settings persistence and the client coordinator.
- Other areas such as `text`, `cron`, `skills`, `ssh`, and `avatars` hold reusable cross-feature logic.

If a module is reused by more than one feature or represents a stable domain contract, it probably belongs in `src/lib`.

### `server`

Custom Studio server and WebSocket proxy.

- `server/index.js` boots the app.
- `server/gateway-proxy.js` bridges browser WebSocket traffic to the upstream OpenClaw Gateway.
- `server/studio-settings.js` loads the local Studio gateway settings on the server side.

This layer exists so gateway credentials stay server-side and browser traffic can always target the same-origin Studio server.

### `tests`

Automated coverage.

- `tests/unit`: the main source of regression coverage.
- Playwright covers end-to-end behavior from the app boundary.

For architecture-sensitive changes, read the nearest unit tests before editing the implementation.

### `scripts`

Repository utilities and generated-asset workflows.

- `scripts/sync-openclaw-gateway-client.ts` updates the vendored gateway client helpers.
- `scripts/studio-setup.js` prepares common local Studio prerequisites.

## Read These First

If you are new to the codebase, this order gives the fastest payoff:

1. `README.md`.
2. `ARCHITECTURE.md`.
3. `src/app/office/page.tsx`.
4. `src/features/office/screens/OfficeScreen.tsx`.
5. `src/features/agents/state/gatewayRuntimeEventHandler.ts`.
6. `src/features/agents/state/runtimeEventCoordinatorWorkflow.ts`.
7. `src/lib/office/eventTriggers.ts`.
8. `src/lib/office/deskDirectives.ts`.
9. `src/features/retro-office/RetroOffice3D.tsx`.
10. `src/features/retro-office/core/navigation.ts`.

## Main Runtime Flow

At a high level:

1. The browser connects to Studio at `/api/gateway/ws`.
2. Studio proxies that connection to the upstream OpenClaw Gateway.
3. `GatewayClient` receives runtime events.
4. `src/app/office/page.tsx` installs the main runtime subscription.
5. `gatewayRuntimeEventHandler.ts` classifies and routes runtime events.
6. Runtime workflow modules plan state updates and effect commands.
7. History sync pulls canonical `chat.history` when live streams are incomplete or transport-specific.
8. Agent UI and office UI both consume the resulting agent/session state.

Important runtime files:

- `src/lib/gateway/GatewayClient.ts`: transport contract and session-key helpers.
- `src/features/agents/state/gatewayRuntimeEventHandler.ts`: runtime event orchestrator.
- `src/features/agents/state/runtimeChatEventWorkflow.ts`: chat stream planning.
- `src/features/agents/state/runtimeAgentEventWorkflow.ts`: agent/lifecycle stream planning.
- `src/features/agents/state/runtimeTerminalWorkflow.ts`: terminal and closed-run handling.
- `src/features/agents/state/runtimeEventCoordinatorWorkflow.ts`: reducer/effect bridge for runtime commands.
- `src/features/agents/operations/historySyncOperation.ts`: canonical history reconciliation.
- `src/features/agents/state/transcript.ts`: transcript entry model and history merge logic.

## Office Architecture

There are two office-related stacks in this repository:

- The immersive live office at `/office`, powered by React Three Fiber and `src/features/retro-office`.
- The builder/editor stack at `/office/builder`, powered by Phaser and `src/features/office`.

These systems are related, but they are not the same runtime.

### Immersive Office Stack

Key files:

- `src/features/office/screens/OfficeScreen.tsx`: office composition root. It connects gateway state, debug/export tools, standup state, desk assignment persistence, and the 3D scene.
- `src/lib/office/eventTriggers.ts`: derives office animation/interaction holds from runtime events and agent transcript state.
- `src/lib/office/deskDirectives.ts`: parses user text into a unified office intent snapshot.
- `src/features/retro-office/RetroOffice3D.tsx`: renders the 3D world and consumes the derived animation state.
- `src/features/retro-office/core/navigation.ts`: builds nav grids, resolves destinations, and exports specialized route helpers.
- `src/features/retro-office/core/furnitureDefaults.ts`: default room/object layout plus migration-style ensure helpers.

### Builder Stack

Key files:

- `src/features/office/components/OfficeBuilderPanel.tsx`.
- `src/features/office/components/OfficePhaserCanvas.tsx`.
- `src/features/office/phaser/OfficeBuilderScene.ts`.
- `src/features/office/phaser/OfficeViewerScene.ts`.
- `src/lib/office/schema.ts`.

The builder uses the `OfficeMap` schema. The immersive retro office still has its own furniture/defaults/persistence pipeline. When touching office code, confirm which stack you are actually changing.

## Office Intent Layer

`src/lib/office/deskDirectives.ts` is the single entry point for natural-language office directives.

This is one of the most important conventions in the repo:

- New room or behavior triggers should be parsed here first.
- Runtime events from Telegram, WhatsApp, UI chat, or other transport-specific sessions should not require separate directive parsers.
- Consumers should prefer `resolveOfficeIntentSnapshot()` over adding one-off regex checks elsewhere.

Current intent categories include:

- Desk holds and releases.
- GitHub or server-room review holds.
- Gym commands and skill-building gym intents.
- QA lab holds and releases.
- Standup meeting requests.

If you add another room or action, first ask: can it be expressed as another field in `OfficeIntentSnapshot`?

## How Office Motion Works

Office motion is derived, not pushed directly into the scene.

1. Runtime events arrive from the gateway.
2. `reduceOfficeAnimationTriggerEvent()` records immediate latches such as working, streaming, thinking, and fresh user directives.
3. `reconcileOfficeAnimationTriggerState()` re-derives durable holds from current agent state and transcript history.
4. `buildOfficeAnimationState()` collapses the trigger state into the smaller shape consumed by the scene.
5. `RetroOffice3D` turns that state into concrete destinations, paths, overlays, and temporary actors.

This separation is important because it keeps transport-specific runtime details out of the 3D scene.

## How To Add A New 3D Object

For a new static or interactive object:

1. Add geometry and footprint rules in `src/features/retro-office/core/geometry.ts` if the object needs sizing, bounds, snapping, or rotation support.
2. Add default placement in `src/features/retro-office/core/furnitureDefaults.ts` if the object should exist in the default office.
3. Add rendering support in one of:
   - `src/features/retro-office/objects/furniture.tsx`.
   - `src/features/retro-office/objects/primitives.tsx`.
   - `src/features/retro-office/objects/machines.tsx`.
   - Another focused object file if the object family deserves its own module.
4. Wire the item type into the `RetroOffice3D.tsx` render switch if needed.
5. If the object affects navigation, add its type to the blocking/target logic in `src/features/retro-office/core/navigation.ts`.

Good examples:

- Server-room objects in `src/features/retro-office/objects/machines.tsx`.
- Environment primitives in `src/features/retro-office/objects/primitives.tsx`.

## How To Add A New Room Or Activity

For a new room that agents can intentionally visit:

1. Add room objects and defaults in `src/features/retro-office/core/furnitureDefaults.ts`.
2. Add navigation targets in `src/features/retro-office/core/navigation.ts`.
3. If the room needs staged entry behavior, add a dedicated helper under `src/features/retro-office/core/navigation/`.
4. Extend `OfficeIntentSnapshot` in `src/lib/office/deskDirectives.ts`.
5. Update `src/lib/office/eventTriggers.ts` so the new intent becomes a derived hold or request.
6. Update `RetroOffice3D.tsx` so `useAgentTick()` maps that hold to a real target and interaction state.
7. Add or update unit tests around the new intent and trigger behavior.

Current examples to follow:

- `navigation/gymRoute.ts`.
- `navigation/serverRoomRoute.ts`.
- `navigation/qaLabRoute.ts`.
- `tests/unit/deskDirectives.test.ts`.
- `tests/unit/officeEventTriggers.test.ts`.

## How Desk Assignment Works

Desk ownership is explicit now.

- Desk assignments are stored in Studio settings, not inferred sequentially.
- `OfficeScreen.tsx` loads and persists `deskAssignmentByDeskUid`.
- `RetroOffice3D.tsx` resolves assigned desk indexes from those persisted mappings.
- Unassigned agents are intentionally safe and should not wander to random desks.

If you change desk semantics, make sure the Studio settings contract and the retro-office consumer stay aligned.

## API Route Inventory

Current `src/app/api` routes:

- `studio/route.ts`: load and patch local Studio settings.
- `path-suggestions/route.ts`: local filesystem path suggestions.
- `office/route.ts`: office layout/builder persistence.
- `office/publish/route.ts`: publish office maps.
- `office/github/route.ts`: GitHub-related office flow helpers.
- `office/browser-preview/route.ts`: browser preview helpers for office experiences.
- `office/presence/route.ts`: office presence/state helpers.
- `office/voice/transcribe/route.ts`: voice transcription.
- `office/voice/reply/route.ts`: voice reply generation.
- `office/standup/config/route.ts`: standup config persistence.
- `office/standup/meeting/route.ts`: standup meeting state helpers.
- `office/standup/run/route.ts`: standup run execution.
- `gateway/media/route.ts`: gateway-backed media access.
- `gateway/agent-state/route.ts`: gateway-backed agent state operations.
- `gateway/skills/remove/route.ts`: gateway-backed skill removal flow.

When adding a new API route, keep it narrow and put shared business logic in `src/lib` or a feature operation module instead of the route handler itself.

## Scripts Worth Knowing

- `npm run dev`: starts the Studio dev server.
- `npm run build`: production build.
- `npm run start`: production server.
- `npm run lint`: ESLint.
- `npm run typecheck`: TypeScript without emit.
- `npm run test`: Vitest.
- `npm run e2e`: Playwright.
- `npm run studio:setup`: local Studio prerequisites.
- `npm run sync:gateway-client`: sync the vendored gateway browser client.
- `npm run smoke:dev-server`: basic dev-server smoke check.

## Testing Map

Start with the tests closest to the subsystem you are touching.

Useful examples:

- `tests/unit/deskDirectives.test.ts`: office intent parsing.
- `tests/unit/officeEventTriggers.test.ts`: office trigger derivation.
- `tests/unit/janitorActors.test.ts` and `tests/unit/janitorReset.test.ts`: janitor and reset cues.
- `tests/unit/gatewayRuntimeEventHandler.chat.test.ts`.
- `tests/unit/gatewayRuntimeEventHandler.agent.test.ts`.
- `tests/unit/runtimeEventCoordinatorWorkflow.test.ts`.
- `tests/unit/runtimeTerminalWorkflow.test.ts`.
- `tests/unit/historySyncOperation.test.ts`.
- `tests/unit/transcript.test.ts`.
- `tests/unit/studioDeskAssignments.test.ts`.

If you introduce a new intent, route, or runtime reduction rule, add unit coverage in the same area before relying on manual testing.

## Folder Structure Conventions

A few patterns are used repeatedly in the repo:

- Route files in `src/app/*` compose feature modules but should not become the main home for business logic.
- `src/features/<area>/operations` usually contains orchestration logic with side effects.
- `src/features/<area>/state` usually contains reducers, workflow planners, and state models.
- `src/lib/<domain>` usually contains pure helpers, adapters, contracts, and persistence helpers shared across features.
- In `src/features/retro-office/core/navigation/`, each route helper gets its own file when the path logic becomes room-specific.

## Contributor Footguns

- The immersive retro office and the Phaser builder are separate systems. Verify which one you need before editing.
- The Gateway is the source of truth for runtime state. Avoid inventing local parallel state for sessions, runs, or transcripts.
- Studio settings are local and per-workspace/gateway. Use them for UI preferences, desk assignments, and connection details only.
- Transport-specific session keys such as Telegram sessions still need to map back to the correct agent. Reuse session-key helpers instead of writing ad-hoc parsing.
- The immersive retro office now uses procedural furniture geometry instead of bundled third-party model assets.
- This repo is not the OpenClaw runtime. Do not modify upstream OpenClaw source code from here.

## When You Need Upstream OpenClaw Context

Sometimes Hermes3D behavior depends on the upstream event contract or session behavior. In those cases:

1. Inspect the relevant client or gateway contract in `src/lib/gateway`.
2. If the answer is not in this repo, inspect your separate local OpenClaw checkout.
3. Apply changes in Hermes3D unless the user explicitly asked for upstream OpenClaw work.

## Documentation Philosophy

Keep these docs useful by preferring:

- File paths over vague descriptions.
- Extension points over exhaustive inventories of every component.
- Stable contracts over temporary implementation details.
- Focused inline comments in hard-to-read architecture hotspots instead of comment-heavy code everywhere.
