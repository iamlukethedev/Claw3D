# Bulletin Board Spec

> First concrete office-system feature for Claw3D.

## Goal

Add a shared bulletin board inside the office that acts as the visible coordination surface for:

- goals
- announcements
- blockers
- handoff notes
- standup outcomes
- lightweight task cards

This should be the first step toward making Claw3D a real agent operations environment instead of only a gateway visualizer.

## Product Position

The bulletin board is not a replacement for the existing task board or Kanban views.

It is the office-native layer above them.

Think of it as:

- the most important things the office should see right now
- the shared memory wall
- the in-world coordination surface

## Why This Feature First

This is the best first office-system feature because it is:

- easy to understand
- visually natural in the office
- useful even before deeper simulation systems exist
- compatible with all backends
- able to reuse existing task and standup signals

It also creates a clean landing zone for future systems:

- whiteboards
- meeting summaries
- QA queues
- hierarchy / department routing
- shared office memory

## Primary Use Cases

### Shared Goals

Examples:

- "Ship Hermes adapter support"
- "Fix production bug in standup flow"
- "Prepare Friday release review"

### Announcements

Examples:

- "Hermes provider smoke test passed"
- "Build is blocked on QA"
- "Meeting starts in 5 minutes"

### Blockers

Examples:

- "Gateway auth broken on staging"
- "Agent Alice waiting on review"
- "No provider token configured"

### Handoffs

Examples:

- "Backend done, hand off to QA"
- "Needs design signoff"
- "Waiting for owner approval"

### Meeting Output

Examples:

- standup summary
- decisions made
- next actions
- active speaker queue

## V1 Scope

V1 should stay intentionally small.

The board should support a few card types and simple interactions, not a full project-management suite.

### Card Types

Initial types:

- `goal`
- `announcement`
- `blocker`
- `handoff`
- `meeting_note`

### Card Fields

Minimum shape:

```ts
type BulletinBoardCardType =
  | "goal"
  | "announcement"
  | "blocker"
  | "handoff"
  | "meeting_note";

type BulletinBoardCard = {
  id: string;
  type: BulletinBoardCardType;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorType: "human" | "agent" | "system";
  authorId?: string | null;
  authorName?: string | null;
  agentId?: string | null;
  sessionKey?: string | null;
  taskId?: string | null;
  pinned: boolean;
  archived: boolean;
  priority?: "low" | "normal" | "high";
  tags?: string[];
};
```

### Basic Interactions

V1 interactions:

- create card
- edit card
- pin/unpin card
- archive/unarchive card
- filter by type
- filter by author
- open linked session or linked agent

No drag-and-drop lane system is required for V1.

## Visual Design

The bulletin board should feel like a wall-mounted coordination surface inside the office.

Possible visual forms:

- cork board
- notice board
- sprint wall
- pinboard with index cards / sticky notes

The in-world object should have:

- a visible prop in the retro office
- a click target
- an immersive detail panel when opened

It should feel distinct from the existing Kanban board.

Suggested difference:

- Kanban = detailed task workflow
- Bulletin board = office-wide signal surface

## Information Hierarchy

At a glance, the board should answer:

1. What is the office trying to do?
2. What is blocked?
3. What changed recently?
4. What needs a human to notice?

Recommended layout:

- pinned cards first
- blockers prominently visible
- recent announcements grouped together
- meeting notes grouped separately

## Integration Points

The feature should hook into systems Claw3D already has.

### Task Board / Kanban

Use the bulletin board as a summary layer over the task board, not a duplicate.

Examples:

- show a pinned goal card that links into Kanban
- create blocker cards when a task enters a blocked state
- create handoff cards when work moves between agents or departments

### Standup System

The standup system already exists.

Use it to populate:

- current meeting announcement
- summary card after standup completes
- follow-up note cards for unresolved blockers

### Agent Sessions

Cards should be linkable to:

- an agent
- a session key
- a run or task where applicable

That lets the user jump from "office signal" to "underlying conversation or task".

### Runtime-Neutral Backends

The board must not depend on OpenClaw-specific methods.

It should operate off:

- Claw3D state
- local persisted office data
- optional provider metadata when available

That keeps it usable with:

- OpenClaw
- Hermes
- Vera
- Demo mode

## Storage Model

V1 storage should be local office data persisted through the same Studio settings path used by other office preferences.

Suggested storage location:

- studio office settings keyed by gateway URL

Example shape:

```ts
type OfficePreference = {
  bulletinBoard?: {
    cards: BulletinBoardCard[];
    updatedAt?: string;
  };
};
```

Why:

- matches existing office preference patterns
- backend-neutral
- fast to implement
- easy to migrate later

## Authoring Rules

Cards may be created by:

- human user
- agent action
- system automation

Recommended rules:

- human cards should always be editable
- system cards can be archived but not freely mutated
- agent cards should show authorship clearly

That keeps provenance visible without overcomplicating the model.

## V1 Automation

Useful automations to add early:

- create a meeting note card after standup
- create a blocker card from explicit blocked-state flows
- create announcement cards for major office events

Keep automation conservative.

The board should not flood itself with noise.

## UI Surfaces

### In-World Object

Add a dedicated bulletin board prop to the office layout.

It should:

- be visible from the main office floor
- support hover/click affordance
- open an immersive board panel

### Sidebar / Panel Access

Also add a panel entry for cases where the user wants quick access without camera movement.

Possible placement:

- HQ sidebar tab
- office control panel

### Agent Interaction

Optional for V1:

- agents can approach the board during meetings or handoffs
- pinned cards can be reflected in ambient office behavior

This is useful but not required for first delivery.

## Out of Scope For V1

Do not include these initially:

- full Kanban replacement
- freehand drawing
- multiplayer collaborative editing
- complicated permission lattice
- department-specific boards
- heavy simulation logic
- arbitrary external integrations

Those belong in later systems.

## Implementation Strategy

Recommended order:

1. Define board card types and storage schema.
2. Add persisted board data to office settings.
3. Add a simple board panel UI.
4. Add in-world bulletin board prop and open interaction.
5. Connect standup summary output.
6. Add simple blocker / announcement automation.

## Existing Code Seams

This feature should likely align with:

- task board state and controller logic in `src/features/office/tasks`
- standup flows in `src/features/office/hooks/useOfficeStandupController.ts`
- office settings persistence
- retro office object interaction in `src/features/retro-office/RetroOffice3D.tsx`
- furniture/object definitions in `src/features/retro-office/objects`

This is intentional.

The bulletin board should reuse existing office mechanics where possible.

## Success Criteria

V1 is successful if:

- the user can open the board from inside the office
- the board shows office-relevant cards, not just generic notes
- standup or blocker information can appear on the board
- cards can link back into agents/sessions/tasks
- the system works with Hermes, OpenClaw, and demo mode

## Future Extensions

Once V1 is stable, this can grow into:

- department boards
- QA wall
- release wall
- meeting room whiteboard handoff
- agent-authored summaries
- office-wide historical archive
- team-specific bulletin surfaces

## Summary

The bulletin board should become the first shared memory surface inside Claw3D.

It is the clearest next step toward making the office itself the product.
