# Meeting Room Workflow Spec

> Third concrete office-system feature for Claw3D, building on existing standup support and extending it into a generalized meeting workflow model.

## Goal

Turn the meeting room from a visual location into an operational workflow surface.

The meeting room should become the place where agents:

- gather
- present updates
- coordinate plans
- resolve blockers
- record decisions
- create follow-up actions

## Product Position

The meeting room is not just a room.

It is a workflow type.

That means the system should support:

- visible in-world gathering
- structured meeting phases
- meeting outputs that affect the rest of the office

It should connect naturally to:

- standup
- whiteboard
- bulletin board
- task board
- QA/review systems later

## Existing Foundation

Claw3D already has meaningful meeting-related pieces:

- a meeting room in the office layout
- standup meeting state and API routes
- participant arrival handling
- immersive standup board UI
- agent movement into the meeting area

This spec should treat standup as the first implemented meeting type, not as a special one-off.

## Core Principle

Meetings should generate office state, not just temporary visuals.

Every meeting should be able to produce:

- summaries
- decisions
- blockers
- next actions
- linked whiteboard notes
- linked bulletin board items

That is what makes the office feel alive and useful.

## Meeting Types

Recommended initial types:

- `standup`
- `planning`
- `review`
- `incident`
- `sync`

### Standup

Purpose:

- what each agent is working on
- blockers
- immediate next step visibility

### Planning

Purpose:

- define approach
- compare options
- assign next actions

### Review

Purpose:

- assess work completed
- gather feedback
- approve or reject next move

### Incident

Purpose:

- coordinate under failure or urgency
- assign responsibilities
- capture current status and recovery path

### Sync

Purpose:

- lightweight multi-agent coordination
- brief handoffs
- cross-team visibility

## Workflow Model

Each meeting should have explicit phases.

Suggested phases:

- `scheduled`
- `gathering`
- `in_progress`
- `decision`
- `complete`
- `archived`

### Scheduled

Meeting exists but has not started.

### Gathering

Agents are walking to the meeting room or otherwise being assembled.

### In Progress

Updates are being presented, questions asked, and information collected.

### Decision

The meeting is converging:

- decisions recorded
- unresolved blockers identified
- next actions prepared

### Complete

The outputs are finalized and written back into office systems.

### Archived

Meeting is preserved in history but no longer active.

## Suggested Data Model

V1 generalized meeting shape:

```ts
type MeetingType =
  | "standup"
  | "planning"
  | "review"
  | "incident"
  | "sync";

type MeetingPhase =
  | "scheduled"
  | "gathering"
  | "in_progress"
  | "decision"
  | "complete"
  | "archived";

type MeetingActionItem = {
  id: string;
  text: string;
  assignedAgentId?: string | null;
  linkedTaskId?: string | null;
  status: "open" | "done" | "dropped";
};

type MeetingDecision = {
  id: string;
  text: string;
  authorType: "human" | "agent" | "system";
  authorId?: string | null;
};

type OfficeMeeting = {
  id: string;
  type: MeetingType;
  phase: MeetingPhase;
  title: string;
  startedAt?: string | null;
  updatedAt: string;
  participantAgentIds: string[];
  arrivedAgentIds: string[];
  currentSpeakerAgentId?: string | null;
  summary?: string | null;
  blockers: string[];
  decisions: MeetingDecision[];
  actionItems: MeetingActionItem[];
  whiteboardDocumentId?: string | null;
  bulletinCardIds?: string[];
};
```

## Relationship To Standup

The current standup system should become the first meeting implementation under this model.

That means:

- keep standup behavior working
- preserve arrival and speaker sequencing
- treat standup as a specialized meeting workflow
- reuse the immersive standup screen as the first meeting immersive view

In practice:

- standup = `MeetingType: standup`
- existing standup cards become structured meeting inputs
- standup completion should emit durable outputs into whiteboard and bulletin board systems

## Whiteboard Integration

Every meaningful meeting should have a whiteboard relationship.

Possible behaviors:

- auto-create whiteboard document when meeting starts
- write summary sections as the meeting progresses
- capture blockers, decisions, and next actions into whiteboard blocks

Suggested mapping:

- meeting discussion -> whiteboard notes
- decisions -> whiteboard decision blocks
- next actions -> whiteboard action blocks

The whiteboard is the drafting surface during the meeting.

## Bulletin Board Integration

The bulletin board is the public output surface after the meeting.

Suggested mapping:

- important decision -> announcement card
- blocker -> blocker card
- action item with office-wide significance -> handoff card
- meeting completion -> meeting note card

The meeting room should feed the bulletin board, not bypass it.

## Task Board Integration

Meetings should be able to seed or update tasks.

Examples:

- planning meeting creates task candidates
- review meeting marks work ready for QA
- incident meeting creates urgent recovery tasks

The task board remains the detailed execution layer.

The meeting room creates and updates intent.

## Human Interaction Model

The human should be able to:

- start a meeting
- pick meeting type
- pick participants
- follow progress
- intervene during the meeting
- edit outcomes
- confirm or reject generated next steps

The user should not lose control over the outputs just because the meeting is agent-driven.

## Agent Interaction Model

Agents should be able to:

- gather into the meeting room
- take speaking turns
- surface blockers
- suggest next steps
- add whiteboard content
- create meeting-derived outputs when allowed

Longer term, hierarchy may affect who can:

- call meetings
- approve decisions
- assign action items

## Visual / Spatial Behavior

The meeting room should visibly change state during active meetings.

Possible signals:

- agents walk to seats
- current speaker highlighting
- board auto-opens or highlights
- room status banner
- meeting timer / phase indicator

The office should make it obvious that something coordinated is happening.

## V1 Scope

V1 should focus on turning standup into the first generalized meeting flow.

Recommended V1 scope:

- meeting type abstraction for standup
- whiteboard output on meeting completion
- bulletin board output on meeting completion
- simple action-item capture
- immersive meeting screen improvements

Do not try to build all meeting types at once.

## Out of Scope For V1

- voice/video simulation
- arbitrary meeting transcripts
- real-time collaborative editing by many actors at once
- department-specific meeting policies
- advanced approval chains
- multiplayer human facilitation

## Implementation Strategy

Recommended order:

1. Generalize standup data model into a broader meeting model.
2. Keep standup UI working on top of that generalized model.
3. Add whiteboard document creation/output for completed meetings.
4. Add bulletin board output for decisions and blockers.
5. Add action item seeding into task workflows.
6. Introduce second meeting type, likely `planning`.

## Existing Code Seams

This work should likely align with:

- `src/features/office/hooks/useOfficeStandupController.ts`
- `src/features/office/screens/StandupImmersiveScreen.tsx`
- `src/app/api/office/standup/*`
- retro office meeting-room positioning and agent movement
- office state persistence

This is important because Claw3D already has the skeleton of a meeting system.

The right path is to extend it, not replace it.

## Success Criteria

V1 is successful if:

- standup remains functional
- standup now behaves like the first generalized meeting workflow
- meeting completion can write useful results into whiteboard and bulletin board systems
- users can see meeting outcomes affect the rest of the office
- the system remains backend-neutral

## Future Extensions

Once the workflow model is stable, follow-up work can add:

- planning meetings
- review meetings
- incident rooms
- hierarchy-aware meeting permissions
- department-specific meeting rituals
- richer meeting summaries and archives

## Summary

The meeting room should become the office’s coordination engine.

Standup is the starting point, but the real goal is a general workflow where meetings create durable plans, blockers, decisions, and next actions that shape the whole office.
