# Whiteboard Spec

> Second concrete office-system feature for Claw3D, designed to work alongside the bulletin board.

## Goal

Add a whiteboard system inside the office for collaborative planning, meeting notes, and draft idea shaping.

The whiteboard is where the office thinks.

The bulletin board is where the office posts what matters.

## Product Position

The whiteboard should not duplicate the bulletin board.

Use the distinction:

- bulletin board = visible office signals
- whiteboard = active drafting and planning surface

The whiteboard is best for:

- brainstorming
- architecture outlines
- meeting notes
- draft task breakdowns
- org planning
- decision framing

It is not a Kanban replacement and not a polished document editor.

## Why This Feature Matters

The office already has:

- standup logic
- meeting room space
- whiteboard props in the retro office
- task board and planning-adjacent systems

What is missing is a shared in-world planning surface.

The whiteboard creates that surface.

## Primary Use Cases

### Meeting Notes

Examples:

- standup talking points
- decisions made during a meeting
- action items
- unresolved questions

### Brainstorming

Examples:

- possible approaches to a feature
- tradeoff comparisons
- rough implementation ideas
- product concept sketches in text form

### Architecture Planning

Examples:

- component breakdown
- adapter/provider mapping
- system boundaries
- workflow diagrams in structured text

### Org Planning

Examples:

- team structure drafts
- role definitions
- department responsibilities
- handoff chains

### Session-to-Plan Bridge

Examples:

- summarize an agent conversation into a board section
- turn standup outputs into grouped notes
- capture a working draft before turning it into bulletin board items or tasks

## V1 Scope

V1 should be structured, not freehand.

That means:

- text blocks
- sections
- cards / note clusters
- ordering
- lightweight templates

Do not start with arbitrary drawing tools.

## Whiteboard Model

Suggested V1 shape:

```ts
type WhiteboardBlockType =
  | "heading"
  | "note"
  | "decision"
  | "question"
  | "action"
  | "group";

type WhiteboardBlock = {
  id: string;
  type: WhiteboardBlockType;
  title?: string;
  body?: string;
  createdAt: string;
  updatedAt: string;
  authorType: "human" | "agent" | "system";
  authorId?: string | null;
  authorName?: string | null;
  linkedAgentId?: string | null;
  linkedSessionKey?: string | null;
  linkedTaskId?: string | null;
  color?: string | null;
  collapsed?: boolean;
};

type WhiteboardDocument = {
  id: string;
  title: string;
  mode: "planning" | "meeting" | "architecture" | "org" | "freeform";
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  blocks: WhiteboardBlock[];
};
```

## V1 Interaction Model

V1 interactions:

- create whiteboard
- rename whiteboard
- add/edit/delete blocks
- reorder blocks
- collapse/expand groups
- link a block to an agent, task, or session
- archive whiteboard
- duplicate whiteboard

Optional but useful:

- convert a block into a bulletin-board card
- convert a block into a task seed

## Templates

Templates are important because they make the feature useful immediately.

Recommended V1 templates:

- `Meeting Notes`
- `Standup Review`
- `Planning Session`
- `Architecture Draft`
- `Org Planning`

### Example: Meeting Notes Template

Sections:

- attendees
- current topic
- decisions
- blockers
- next actions

### Example: Planning Session Template

Sections:

- problem
- options
- risks
- chosen direction
- tasks

## Relationship To Existing Systems

The whiteboard should integrate with what Claw3D already has.

### Standup

The standup controller already exists.

The whiteboard should support:

- auto-creating a meeting notes board for an active standup
- writing participant summaries to blocks
- collecting blockers and next actions into dedicated sections

### Bulletin Board

The whiteboard should feed the bulletin board, not replace it.

Examples:

- convert a decision block into an announcement card
- convert a blocker block into a blocker card
- convert a next-action block into a handoff card

### Task Board / Kanban

The whiteboard is where a plan is shaped before it becomes a tracked workflow.

Examples:

- rough task breakdown on whiteboard
- selected action blocks converted into actual task records
- blocked tasks reflected back to the bulletin board

### Company Builder / Org Planning

The whiteboard is a natural fit for:

- team structure drafts
- department planning
- role relationship mapping

This is especially useful before company-builder output becomes actual agents.

## In-World UX

The whiteboard should exist as a real office surface.

Recommended forms:

- meeting-room whiteboard
- wall-mounted planning board
- design room / architecture board in future themes

Behavior:

- clicking the board opens an immersive planning surface
- active meetings can auto-focus or highlight the whiteboard
- whiteboard state should feel like part of the room, not a random modal

## Sidebar / Secondary Access

The user should also be able to open the whiteboard from a panel or shortcut.

Good options:

- HQ sidebar tab
- meeting controls
- standup panel

This is especially important when users want direct access without camera movement.

## Storage Model

Like the bulletin board, V1 should be persisted locally in office preferences.

Suggested shape:

```ts
type OfficePreference = {
  whiteboards?: {
    documents: WhiteboardDocument[];
    activeDocumentId?: string | null;
    updatedAt?: string;
  };
};
```

Storage should be keyed by gateway URL / office context so each connected office can keep its own working state.

## JSON Canvas Compatibility

JSON Canvas is a good interoperability target for the whiteboard, but it should not define the product by itself.

Recommended stance:

- use Claw3D's own whiteboard model as the primary domain model
- support export/import to JSON Canvas as a compatibility layer
- avoid turning the whiteboard into a generic infinite-canvas editor before the office workflow is proven

Why:

- Claw3D needs stronger links to meetings, bulletin board items, tasks, agents, and sessions
- the whiteboard is a workflow surface, not only a canvas
- structured planning is more important than unconstrained canvas freedom in V1

Good use of JSON Canvas:

- export planning boards
- import external draft canvases
- map blocks/groups into JSON Canvas nodes
- preserve links where practical

Bad use of JSON Canvas:

- letting a generic canvas model dictate the first product UX
- replacing office-native planning behavior with a broad but shallow editor

## Authoring Rules

Allowed authors:

- human
- agent
- system

Recommended behavior:

- human edits are fully editable
- system-generated sections should remain editable but visibly marked
- agent-authored blocks should show provenance

That balance keeps the board useful without feeling rigid.

## V1 Automation

Useful automations:

- create a whiteboard automatically when a standup meeting starts
- seed a whiteboard from a planning command or meeting ritual
- let an agent summarize a session into selected board blocks

Important:

- automation should create structure, not spam content
- the user should remain able to edit the board freely

## Visual Structure

V1 should look like a structured planning board, not a blank canvas.

Possible presentation:

- left column for sections
- center canvas for block editing
- right rail for linked agents/sessions/tasks

Or:

- grouped lanes by section with text cards inside them

The design should prioritize clarity over novelty.

## Out of Scope For V1

Do not include these initially:

- freehand drawing tools
- multiplayer cursor presence
- arbitrary shapes/connectors
- full diagramming toolkit
- external document sync
- rich media embedding
- advanced permissions by department

Those can come later if the structured board proves valuable.

## Implementation Strategy

Recommended order:

1. Define whiteboard document and block schema.
2. Add office preference persistence.
3. Build a simple whiteboard panel UI with templates.
4. Connect the in-world whiteboard object to open the panel.
5. Add standup seeding / meeting integration.
6. Add conversions into bulletin-board cards and task seeds.

## Existing Code Seams

This feature should align with:

- standup systems in `src/features/office/hooks/useOfficeStandupController.ts`
- standup API routes under `src/app/api/office/standup`
- retro office whiteboard objects and room interactions
- office settings persistence
- task board seeding concepts already present in office task flows

This reduces implementation risk and keeps the feature tied to real office mechanics.

## Success Criteria

V1 is successful if:

- the user can open a whiteboard from inside the office
- a meeting or planning session can write structured notes to it
- the board can link to agents, sessions, and tasks
- users can turn whiteboard outputs into bulletin board items or task seeds
- the system works independently of OpenClaw-specific behavior

## Future Extensions

Once V1 is working, the whiteboard can evolve into:

- diagram mode
- relationship mapping
- architecture views
- agent collaboration sessions
- department-specific whiteboards
- persistent planning archives
- richer visual theming by office skin

## Summary

The whiteboard should become Claw3D’s active planning surface.

It is where meetings, drafts, and rough plans take shape before they become tasks, bulletin items, or office decisions.
