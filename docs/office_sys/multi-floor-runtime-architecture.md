# Multi-Floor Runtime Architecture

> Architecture seed for evolving Claw3D from single-runtime office switching into a persistent multi-runtime building.

## Goal

Claw3D should grow from:

- one selected runtime at a time

into:

- one building
- multiple floors
- one or more runtimes loaded into that building at once
- persistent rosters per floor
- controlled cross-floor interaction

This is the clean path from today's provider seam toward Office Systems.

## Core Model

Each runtime gets its own floor.

Examples:

- OpenClaw floor
- Hermes floor
- Custom floor
- Demo lobby or onboarding floor

The building shell stays shared:

- shared navigation
- shared player identity
- shared office memory
- shared building-level systems

Each floor owns:

- runtime connection state
- roster hydration
- session state
- floor-specific props and signage
- floor-specific policy and permissions

## Why Floors

Floors solve several problems at once:

- they preserve backend neutrality
- they stop multi-runtime support from collapsing into one flat roster
- they let users understand "where" an agent comes from
- they make room for real cross-runtime interactions later
- they fit the existing office metaphor naturally

Instead of "choose one provider", the user can think:

- OpenClaw is on the ground floor
- Hermes is on the first floor
- Custom is upstairs
- Demo is the lobby or reception desk

## Building Layers

### 1. Building Shell

Persistent across all runtimes:

- sidebar and navigation
- profile / player identity
- top-level settings
- common event feed
- building-wide bulletin board
- progression / unlocks

### 2. Floor Runtime Surface

Per-floor:

- provider binding
- connection overlay
- floor roster
- local runtime metadata
- floor-specific loading and failure state

### 3. Shared Building Systems

Not tied to one runtime:

- bulletin board
- whiteboard / planning rooms
- meeting rooms
- QA workflows
- watercooler / commons
- building announcements

### 4. Cross-Floor Coordination

Later-phase:

- cross-floor messaging
- shared supervision chains
- agent handoff tables
- event-driven encounters
- explicit "talk to agent on another floor" workflows

## Candidate Floors

### Lobby

Use for:

- onboarding
- demo entry
- visitor mode
- building map
- announcements

### OpenClaw Floor

Use for:

- primary upstream runtime
- default engineering floor
- broadest compatibility baseline

### Hermes Floor

Use for:

- orchestration
- supervisor roles
- managed multi-agent control
- approval-heavy workflows

### Custom Floor

Use for:

- downstream orchestrators
- experimental runtimes
- local stacks such as Vera

### Training Floor

Use for:

- classrooms
- auditorium
- evals
- teaching
- distillation labs
- onboarding drills

This is a strong place for:

- training runs
- benchmark comparisons
- prompt coaching
- replay systems

### Trader's Floor

Use for:

- event streams
- finance / market dashboards
- alert pits
- strategy desks
- analyst pods

This is useful when real-time signals matter and the environment should feel kinetic.

### Outside / Campus

Use for:

- stadium
- events
- celebrations
- unlockable public spaces
- seasonal or sponsor-driven scenes

This fits the idea that not every "level" needs to be inside the main office tower.

## Cross-Floor Agent Interaction

The important shift is:

- do not force everything through `config.json`
- once runtimes are inside the building, create building-native interaction primitives

Examples:

- shared roster table
- handoff board
- supervisor desk that dispatches across floors
- watercooler proximity chats
- meeting room invites that can pull agents from multiple floors

This makes "Hermes supervising OpenClaw" a first-class building behavior instead of a config hack.

## Progression / Unlock Ideas

Possible unlock structure:

- first login: lobby only
- after setup: OpenClaw floor
- after multi-runtime setup: Hermes floor
- after usage thresholds: Training floor
- after milestones: Trader's floor or stadium

Other progression hooks:

- jersey / floor colors
- signage themes
- badges and trophies
- room upgrades
- unlockable props and departments

## Implementation Order

Recommended sequence:

1. Persist "last known good" runtime state per provider
2. Introduce floor registry model
3. Load one roster per floor
4. Add building map / floor switcher
5. Add shared building systems
6. Add cross-floor coordination tables
7. Add unlockable floors and outside scenes

## Data Model Direction

Minimal shape:

```ts
type BuildingState = {
  activeFloorId: string | null;
  floors: Record<string, FloorState>;
};

type FloorState = {
  id: string;
  label: string;
  provider: "openclaw" | "hermes" | "custom" | "demo";
  runtimeUrl: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  lastKnownGood: boolean;
  roster: Array<{ id: string; name: string; role?: string | null }>;
};
```

This should remain generic enough for future providers.

## Summary

The provider seam should now evolve into a building model:

- one runtime per floor
- one building shell above them
- shared office systems between them
- cross-floor coordination as a building-native capability

That gives Claw3D a clean path from provider support to real Office Systems.
