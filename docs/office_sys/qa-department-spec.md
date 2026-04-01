# QA Department Spec

> Fourth concrete office-system feature for Claw3D, completing the first real office loop: plan, coordinate, execute, review.

## Goal

Add a QA department workflow to Claw3D so the office can visibly review, test, triage, and sign off on work before it is treated as complete.

The QA department should make review state legible in-world.

It is where the office asks:

- does this actually work?
- what failed?
- what is blocked?
- what is safe to ship?

## Product Position

QA should not be just flavor.

It should be an operational system that connects:

- tasks
- agent work output
- reviews
- approvals
- regressions
- release-readiness

The QA department is the office’s verification layer.

## Why This Feature Matters

Without a QA layer, the office can generate and coordinate work but not convincingly validate it.

QA adds:

- visible review state
- feedback loops
- bug triage
- approval pressure where needed
- a clearer path from "done writing" to "done safely"

It also pairs naturally with:

- bulletin board blockers
- meeting room review workflows
- task board status
- approval systems

## Core Responsibilities

The QA department should handle:

- review intake
- test/result tracking
- bug triage
- regression visibility
- release gate / readiness signal

## Primary Use Cases

### Review Queue

Examples:

- a task is ready for QA
- an agent requests review
- a release candidate needs signoff

### Bug Triage

Examples:

- classify failures
- route issues to the right owner
- mark severity
- surface blockers to the office

### Regression Detection

Examples:

- recent change broke existing behavior
- previously passing workflow now fails
- approval flow or adapter integration regressed

### Approval-Aware Review

Examples:

- code/run needs human approval before release-like action
- QA can recommend approval but not finalize it
- owners or leads can override or sign off

### Release Readiness

Examples:

- green / yellow / red office-level signal
- unresolved blockers prevent completion
- review summary appears on bulletin board

## V1 Scope

V1 should focus on clear office-level QA workflows, not a full CI system.

Recommended V1 scope:

- QA queue
- QA status per task or work item
- bug / blocker recording
- review outcome states
- office-visible readiness signal

## Suggested Workflow Model

Recommended QA states:

- `queued`
- `in_review`
- `changes_requested`
- `blocked`
- `approved`
- `failed`
- `verified`

### Queued

Work has entered QA but has not been actively reviewed yet.

### In Review

A QA agent or human reviewer is assessing the work.

### Changes Requested

Work is not acceptable yet and must be revised.

### Blocked

QA cannot proceed because a dependency, approval, or missing artifact prevents review.

### Approved

Review is positive, but final release/ship behavior may still depend on a higher-level approval model.

### Failed

Verification found concrete failure.

### Verified

The work passed the required QA checks and is complete from the department’s perspective.

## Suggested Data Model

V1 shape:

```ts
type QaStatus =
  | "queued"
  | "in_review"
  | "changes_requested"
  | "blocked"
  | "approved"
  | "failed"
  | "verified";

type QaSeverity = "low" | "medium" | "high" | "critical";

type QaIssue = {
  id: string;
  title: string;
  body: string;
  severity: QaSeverity;
  createdAt: string;
  updatedAt: string;
  authorType: "human" | "agent" | "system";
  authorId?: string | null;
  linkedTaskId?: string | null;
  linkedAgentId?: string | null;
  linkedSessionKey?: string | null;
  resolved: boolean;
};

type QaReviewItem = {
  id: string;
  title: string;
  status: QaStatus;
  createdAt: string;
  updatedAt: string;
  assignedReviewerAgentId?: string | null;
  linkedTaskId?: string | null;
  linkedAgentId?: string | null;
  linkedSessionKey?: string | null;
  summary?: string | null;
  issues: QaIssue[];
};

type QaDepartmentState = {
  items: QaReviewItem[];
  readiness: "green" | "yellow" | "red";
  updatedAt?: string;
};
```

## Relationship To Existing Systems

The QA department should plug into systems Claw3D already has.

### Task Board / Kanban

The QA department should consume work from the task board.

Examples:

- task moves into a review-ready state
- QA item is created or updated
- blocked QA creates blocker visibility back on the bulletin board

Suggested relationship:

- task board = execution status
- QA department = verification status

### Bulletin Board

The bulletin board should show the important QA outcomes.

Examples:

- "Build blocked on QA"
- "Regression found in Hermes adapter flow"
- "Release candidate verified"

Suggested card mapping:

- critical QA issue -> blocker card
- release-ready signal -> announcement card
- changes requested -> handoff card

### Meeting Room

Review meetings should naturally feed into QA.

Examples:

- planning meeting creates work
- execution completes
- review meeting sends selected items into QA
- QA findings can be discussed in a follow-up review meeting

This makes the meeting room and QA department part of one loop instead of separate ideas.

### Approvals

Claw3D already has approval-related surfaces.

The QA department should integrate with them conceptually, even if V1 is mostly local office state.

Important distinction:

- QA approval = "this looks good from verification"
- release approval = "a human or higher authority allows the next action"

Those are related but not identical.

### GitHub / Review Surfaces

Claw3D already has review-adjacent UI, including GitHub-oriented immersive screens.

The QA department should be able to:

- reflect review outcomes
- ingest review summaries
- show whether work is waiting for review or returned with changes requested

## In-World UX

The QA department should feel like a place in the office.

Possible visual forms:

- QA lab
- testing bullpen
- release desk
- audit wall

Behavior:

- queue visible in-world
- blocked items stand out clearly
- verified items visibly clear from the queue
- readiness state visible at a glance

The room should communicate office health, not just hold another panel.

## Secondary UI

Also provide a non-spatial UI surface.

Good options:

- HQ sidebar panel
- immersive QA screen
- release/readiness panel

Users should be able to inspect:

- queued reviews
- open issues
- who owns each item
- overall readiness state

## V1 Automation

Useful automations:

- create a QA item when a task enters review-ready state
- create blocker cards for high-severity QA issues
- update readiness color based on unresolved critical/high issues
- generate a short QA summary when an item leaves review

Keep automation conservative.

Avoid flooding the system with low-value noise.

## Storage Model

V1 can be stored in office preferences, similar to bulletin board and whiteboard systems.

Suggested shape:

```ts
type OfficePreference = {
  qaDepartment?: QaDepartmentState;
};
```

This keeps the feature:

- backend-neutral
- easy to persist
- easy to evolve later

## Human Interaction Model

The human should be able to:

- open the QA queue
- inspect a review item
- mark status changes
- add issues
- resolve issues
- promote or reject readiness

Humans should remain the final arbiter when needed, especially for ship/release-style outcomes.

## Agent Interaction Model

QA agents should be able to:

- review work items
- generate findings
- summarize likely regressions
- mark items as changes requested or verified
- surface blockers

Longer term:

- specialized QA agents may exist by area
- adapter QA
- UI QA
- release QA
- regression QA

## Readiness Signal

The department should publish an office-level readiness state:

- `green`
- `yellow`
- `red`

Suggested meaning:

- green = no blocking QA issues
- yellow = warnings / pending review / moderate unresolved issues
- red = blocking failures or critical unresolved issues

This signal should be visible outside the QA room as well.

For example:

- bulletin board card
- office status banner
- release desk indicator

## Out of Scope For V1

Do not include these initially:

- full CI orchestration
- external test runner infrastructure
- rich flake analytics
- cross-repo release orchestration
- advanced approval hierarchies
- fully automated release pipelines

V1 should be office workflow first.

## Implementation Strategy

Recommended order:

1. Define QA review item and issue schema.
2. Add local persisted QA department state.
3. Build a simple QA queue panel.
4. Add readiness signal.
5. Connect task board / review-ready states to QA queue creation.
6. Emit bulletin board blockers or announcements from QA outcomes.

## Existing Code Seams

This work should likely align with:

- task board state and transitions
- approval/review UI surfaces
- GitHub immersive review screens
- office performance / approvals analytics
- bulletin board and meeting room outputs from the new docs

The key is to avoid building QA as an isolated toy feature.

It should be another operational loop in the same office system.

## Success Criteria

V1 is successful if:

- the office can visibly route work into QA
- QA findings can block or clear work in a legible way
- users can inspect review items and issues
- readiness state is visible at the office level
- QA outcomes can feed the bulletin board

## Future Extensions

Once V1 is stable, follow-up work can add:

- QA meeting rituals
- release room / release wall
- specialized QA subteams
- automated regression summaries
- richer review analytics
- policy-aware signoff chains

## Summary

The QA department should make verification a first-class part of office life.

It closes the loop between planning, execution, and trustworthy completion.
