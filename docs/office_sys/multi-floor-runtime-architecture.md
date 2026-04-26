# Multi-Floor Runtime Architecture

> Architecture note for evolving Claw3D from single-runtime switching into one persistent building with multiple runtime-backed floors.

## Goal

Claw3D should move from:

- one selected runtime at a time

to:

- one building shell
- multiple floors
- one runtime binding per floor
- one or more floors active in the same session
- persistent roster/state per floor
- controlled cross-floor interaction

This is the bridge from the merged runtime seam work into Office Systems.

## Product Model

The user should think in places, not provider toggles.

Examples:

- `Lobby`
  - onboarding, demo, reception, visitor flow
- `OpenClaw Floor`
  - default upstream team
- `Hermes Floor`
  - supervisor / orchestration team
- `Custom Floor`
  - downstream/orchestrator/runtime experiments
- `Training Floor`
  - classrooms, auditorium, distillation labs, evals, coaching, simulations
- `Trader's Floor`
  - event streams, signals, analyst desks, execution pits
- `Outside / Campus`
  - stadium, events, unlockables, public scenes

Additional future departments:

- `War Room`
  - incident response, debugging, approvals, ops escalation
- `R&D Lab`
  - prompt experiments, model comparisons, benchmarks
- `Legal / Compliance`
  - permissions, policies, audit trails
- `Studio / Broadcast Room`
  - demos, presentations, voice/video outputs
- `Watercooler / Commons`
  - intentional cross-agent cross-talk space

## Core Principles

- One runtime per floor.
- One shared building shell above all floors.
- Floor state is persistent and local to that floor.
- Building systems are shared and runtime-neutral.
- Cross-floor coordination is explicit, not accidental.
- The gateway/runtime remains the source of truth for runtime-owned data.
- Floor switching owns the connection lifecycle for that floor.

## Why Floors

Floors solve several problems at once:

- they preserve backend neutrality
- they prevent multi-runtime support from flattening into one undifferentiated roster
- they make agent origin legible to the user
- they let Office Systems map naturally onto place
- they create a clean future path for cross-runtime coordination

Instead of "choose one provider", the user can think:

- OpenClaw is downstairs
- Hermes is on the first floor
- Custom is upstairs
- Demo starts in the lobby

## Building Layers

### 1. Building Shell

Persistent across the whole app:

- top-level navigation
- player identity
- building map / floor switcher
- building-wide settings
- shared event feed
- shared progression/unlocks
- common Office Systems surfaces

This layer should not depend on one runtime being selected.

### 2. Floor Runtime Surface

Owned per floor:

- provider binding
- runtime profile and connection settings
- connection status and error state
- hydrated roster for that floor
- floor-local room state
- floor signage / presentation metadata

### 3. Shared Building Systems

Runtime-neutral systems that can reference one or many floors:

- bulletin board
- whiteboard
- meeting rooms
- QA systems
- approvals
- shared announcements
- watercooler / commons

### 4. Cross-Floor Coordination

Later-phase systems:

- cross-floor messaging
- supervisor handoff chains
- dispatch boards
- agent encounter rules
- multi-floor meetings

## Runtime Rules

Each floor has exactly one runtime binding at a time.

Examples:

- `openclaw-ground`
  - provider: `openclaw`
- `hermes-first`
  - provider: `hermes`
- `custom-second`
  - provider: `custom`
- `demo-lobby`
  - provider: `demo`

A floor can be:

- configured but disconnected
- connecting
- connected
- errored

Multiple floors may be loaded in the same session, but they should not share runtime connection state.

When the user switches to another runtime-backed floor:

- the shell should keep the building mounted
- the current runtime should disconnect if the target floor uses a different transport
- the next floor should connect using that floor's saved runtime profile
- the floor label should not get ahead of the actual runtime handoff
- reconnect churn should collapse into one transition state instead of flashing through multiple disconnected/connecting states

## State Ownership

### Runtime-owned

Still owned by the runtime/gateway:

- agent records
- sessions
- approvals
- runtime files
- runtime event streams

### Studio-owned

Local Claw3D state should own:

- floor registry
- active floor
- saved runtime profile per floor
- last-known-good profile per floor
- floor-local presentation preferences
- building-level Office Systems state

This follows the existing architecture boundary in [ARCHITECTURE.md](/c:/Users/G/Desktop/Builds/sigilnet/isolation/Claw3D/ARCHITECTURE.md): Claw3D should not become the system of record for runtime agent state.

## Floor Registry

The first concrete implementation step should be a floor registry.

Required fields:

- floor id
- label
- provider
- zone / level kind
- connection profile key
- whether the floor is enabled

Suggested shape:

```ts
type FloorProvider = "openclaw" | "hermes" | "custom" | "demo";

type FloorId =
  | "lobby"
  | "openclaw-ground"
  | "hermes-first"
  | "custom-second"
  | "training"
  | "traders-floor"
  | "campus";

type FloorDefinition = {
  id: FloorId;
  label: string;
  provider: FloorProvider;
  kind: "core" | "support" | "simulation" | "outside";
  enabled: boolean;
  runtimeProfileId: string | null;
};
```

## Persistent Per-Floor Runtime State

This should be the first real implementation slice after the doc.

Each floor needs persistent local state for:

- selected runtime profile
- last-known-good connection profile
- connection status
- recent connect error
- last successful roster snapshot metadata

Suggested shape:

```ts
type FloorRuntimeState = {
  floorId: FloorId;
  provider: FloorProvider;
  runtimeProfileId: string | null;
  gatewayUrl: string | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  lastKnownGoodAt: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};
```

Important rule:

- floor-local runtime state should not be overwritten by switching to another floor
- switching floors should not leave the previous runtime active under the next floor's label

## PR Breakdown

Office Systems should ship as a sequence of narrow PRs, not one long-running mega branch.

Recommended slices:

1. `office: add floor registry and canonical floor definitions`
   - floor ids
   - provider/kind definitions
   - registry helpers

2. `office: persist per-floor runtime state`
   - floor-local runtime profile binding
   - connection status
   - recent error
   - last-known-good metadata

3. `office: add per-floor roster hydration`
   - one roster cache per floor
   - runtime-neutral hydration entry points

4. `office: add building shell floor switcher`
   - active floor selection
   - shell navigation
   - floor-local presentation handoff

5. `office: add cross-floor messaging primitives`
   - explicit inter-floor message model
   - supervisor handoff
   - shared commons channels

6. `office: add higher-level Office Systems features`
   - training
   - trader's floor
   - war room
   - bulletin/meeting systems

7. `office: integrate campus and specialized environments`
   - stadium / outside campus
   - specialized booths and labs

## Current Implementation Status

Implemented in the current Office Systems foundation slice:

- `1. floor registry and canonical floor definitions`
  - canonical floor ids
  - provider/kind definitions
  - enabled-floor helpers
- `2. persistent per-floor runtime state`
  - persisted floor-local runtime profile binding
  - connection status
  - recent error state
  - last-known-good metadata
- `3. per-floor roster hydration`
  - one roster cache per floor
  - runtime-neutral hydration/state builders
  - preserved runtime/identity/session display-name provenance
- `4. building shell floor switcher`
  - persisted `activeFloorId`
  - enabled-floor switching helpers
  - shell-level floor picker in OfficeScreen
  - floor-local roster status surfaced in the shell

Explicitly deferred from this slice:

- cross-floor messaging
- supervisor handoff chains
- shared commons/watercooler traffic
- specialized floor systems like Training, Trader's Floor, and Campus gameplay

Reason for deferral:

- cross-agent messaging primitives should be tightened first
- then cross-floor messaging can build on a cleaner interaction model

## Multi-Provider Roster Loading

Today Claw3D mostly thinks in one active roster.

The next model should be:

- one roster per floor
- one hydration pipeline per floor
- one selected active floor in the UI

Suggested shape:

```ts
type FloorRosterEntry = {
  id: string;
  displayName: string;
  runtimeName: string | null;
  identityName: string | null;
  sessionDisplayName: string | null;
  role?: string | null;
  status: "idle" | "running" | "error";
};

type FloorRosterState = {
  floorId: FloorId;
  loadedAt: number | null;
  entries: FloorRosterEntry[];
};
```

This matches recent runtime work:

- preserve useful runtime and identity metadata
- do not throw away `runtimeName`, `identityName`, or `sessionDisplayName`

## Building Shell vs Floor Scene

The office should split into:

### Building shell

- navigation
- floor switcher
- global overlays
- building systems surfaces

### Floor scene

- runtime-backed roster
- room layout for that floor
- floor-local devices and props
- floor-local agent simulation

That prevents reconnecting or swapping floors from feeling like the whole app is remounting.

## Cross-Floor Messaging Model

Cross-floor coordination should be explicit.

Do not infer it from raw runtime adjacency.

Recommended primitives:

- handoff board
- floor inbox
- supervisor dispatch
- meeting invite
- commons encounter

Minimal event shape:

```ts
type CrossFloorMessage = {
  id: string;
  fromFloorId: FloorId;
  fromAgentId: string;
  toFloorId: FloorId;
  toAgentId: string | null;
  kind: "handoff" | "request" | "broadcast" | "meeting-invite";
  subject: string;
  body: string;
  createdAt: number;
};
```

Important rule:

- cross-floor messaging is a building system
- it should not require editing runtime config files directly

## Office Systems Fit

This architecture is meant to support the Office Systems roadmap, not compete with it.

Good examples:

- `Lobby`
  - onboarding, demo, reception
- `Training Floor`
  - classrooms, evals, replay, distillation
- `Trader's Floor`
  - feeds, signals, alerts, analyst desks
- `Outside / Campus`
  - stadium and event spaces

The pending stadium PR [#88](https://github.com/iamlukethedev/Claw3D/pull/88) should be treated as a future `Outside / Campus` scene, not as a blocker for the core floor/runtime model.

## Progression / Unlocks

Possible progression model:

- first login
  - lobby only
- after first runtime setup
  - OpenClaw floor
- after multi-runtime setup
  - Hermes floor
- after usage thresholds
  - Training floor
- later milestones
  - Trader's floor
  - Campus / stadium

Possible unlock outputs:

- floor access
- room access
- signage themes
- team/floor colors
- props and trophies

## Recommended Implementation Order

1. Finalize multi-floor architecture doc
2. Add floor registry model
3. Add persistent per-floor runtime state
4. Add multi-provider roster loading
5. Add building shell + floor switcher
6. Add cross-floor messaging primitives
7. Build Office Systems on top

This keeps floors foundational, and avoids building bulletin boards / meetings / QA on top of a single-runtime assumption that will just need to be broken later.

## Concrete Delivery Plan

### Phase 1: Floor Registry

Deliverables:

- define canonical `FloorId` and `FloorProvider` types
- add a floor definition registry in Studio-owned state
- mark which floors are enabled, core, support, simulation, or outside
- add runtime profile linkage per floor

Acceptance criteria:

- Claw3D can enumerate all known floors without connecting to any runtime
- floor definitions are runtime-neutral and local-state only
- the building shell can reference floor labels and kinds without depending on roster data

### Phase 2: Persistent Per-Floor Runtime State

Deliverables:

- store connection/runtime profile state per floor
- persist `lastKnownGood` per floor
- persist per-floor gateway URL/token profile linkage
- preserve connection errors per floor instead of one global connection slot

Acceptance criteria:

- switching floors does not wipe another floor’s runtime state
- reconnecting one floor does not reset another floor
- Claw3D can show disconnected/configured/connected/errored state per floor
- moving from one runtime floor to another reconnects against the target runtime before the floor is treated as live

### Phase 3: Per-Floor Roster Hydration

Deliverables:

- hydrate one roster per floor
- preserve `runtimeName`, `identityName`, and `sessionDisplayName` in roster entries
- cache roster load metadata per floor
- add floor-local selected agent state

Acceptance criteria:

- multiple floors can have rosters loaded in the same session
- roster entries remain associated with their owning floor
- the UI can distinguish local-floor vs other-floor agent origin cleanly

### Phase 4: Building Shell + Floor Switcher

Deliverables:

- add building map / floor switcher UI
- keep shell mounted while changing floors
- render active floor scene without remounting global app state
- make lobby and campus valid destinations even before all rooms are implemented

Acceptance criteria:

- floor switching is UI-stateful, not route-destructive
- the shell remains stable while floor scenes swap
- disconnected floors remain visible as places, not absent data
- runtime-backed floors enter through a transition/arrival flow, not by silently reusing the previous floor's live runtime

### Phase 5: Cross-Floor Coordination Primitives

Deliverables:

- define handoff board / floor inbox / supervisor dispatch primitives
- add message/event records with source floor and target floor
- support explicit cross-floor meeting invites or requests

Acceptance criteria:

- cross-floor actions are visible building events
- routing is explicit, not inferred from hidden runtime config
- Hermes supervising OpenClaw can be modeled as a building behavior

### Phase 6: Office Systems on Top

Deliverables:

- lobby onboarding
- training rooms
- trader floor / specialized rooms
- QA / meetings / bulletin systems
- outside campus and stadium integration

Acceptance criteria:

- Office Systems are built against the building/floor model
- room features do not assume single-runtime global state
- specialized rooms remain optional extensions, not core architecture blockers

## Immediate Implementation Checklist

### Floor Registry Slice

- add `FloorId`, `FloorProvider`, and `FloorDefinition` types
- create a canonical floor registry module
- include at least:
  - `lobby`
  - `openclaw-ground`
  - `hermes-first`
  - `custom-second`
  - `training`
  - `traders-floor`
  - `campus`
- decide where floor registry state lives inside Studio settings/local state

### Per-Floor Runtime State Slice

- define `FloorRuntimeState`
- store runtime profile key per floor
- store connection status per floor
- store last-known-good timestamp per floor
- store last error code/message per floor

### Roster Slice

- define `FloorRosterEntry`
- define `FloorRosterState`
- preserve runtime/identity/session naming metadata
- keep floor-local selected agent state

### UI Shell Slice

- add a floor switcher stub in the building shell
- keep current office scene as one floor implementation first
- do not attempt full cross-floor scene rendering in the first pass

## Reference Branches

Use these as references, not merge targets for the foundational slice:

- `upstream/soccer-stadium-outside-office`
  - reference for `Outside / Campus`
  - useful for environment/scene ideas
- `upstream/feature/crypto-booth`
  - reference for specialized room/department patterns
  - useful later for `Trader's Floor` or a market/crypto room

The foundational multi-floor work should still be built from current `upstream/main`, not from either feature branch.

## Immediate Non-Goals

Not for the first slice:

- full cross-floor conversation simulation
- automatic agent movement across floors
- deep unlock/economy system
- multi-user tenancy
- replacing the runtime as system of record

## Summary

Claw3D should evolve into:

- one building shell
- multiple runtime-backed floors
- one roster per floor
- persistent floor-local state
- shared building-native Office Systems

That gives the project a clean path from merged runtime support into real Office Systems without collapsing everything back into one flat provider toggle.
