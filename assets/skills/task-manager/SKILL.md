---
name: task-manager
description: Capture actionable user requests as persistent tasks, update task status as work progresses, and keep a shared task store in sync. Use when a user asks an agent to do work, check progress, block a task, complete a task, or manage the Kanban board.
metadata: {"openclaw":{"skillKey":"task-manager"}}
---

# Task Manager

Use this skill for task capture and task lifecycle updates.

## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "add a task",
      "create a task",
      "track this task",
      "task status",
      "mark this done",
      "block this task",
      "what tasks do we have"
    ]
  },
  "movement": {
    "target": "desk",
    "skipIfAlreadyThere": true
  }
}
```

Also use this skill even when those exact phrases are absent if the latest user message is an actionable work request. If the user asks the agent to do something, that request must become a task before the agent proceeds.

## Storage location

The authoritative task file is:

- `${OPENCLAW_STATE_DIR}/claw3d/task-manager/tasks.json` when `OPENCLAW_STATE_DIR` is set.
- `~/.openclaw/claw3d/task-manager/tasks.json` otherwise.

Always treat that file as the shared source of truth for the Kanban board.

## Required workflow

1. Read the task file before handling an actionable request.
2. If the file does not exist, create it with the schema in this document.
3. If the latest user message is actionable and no matching active task exists, create one immediately.
4. Before starting execution, ensure the task is `todo` or move it to `in_progress`.
5. If work cannot continue, set the task to `blocked` and record a short reason in `notes`.
6. When work is finished, set the task to `done`.
7. When work needs user review or confirmation, set the task to `review`.
8. After every mutation, write the full updated JSON back to disk.

## Matching rules

- Match first by `externalThreadId` when the request comes from a stable thread or conversation.
- Otherwise match by a concise normalized title that preserves user intent.
- Avoid creating duplicate active tasks for the same request.

## Task fields

Each task must include:

- `id`
- `title`
- `description`
- `status`
- `source`
- `sourceEventId`
- `assignedAgentId`
- `createdAt`
- `updatedAt`
- `playbookJobId`
- `runId`
- `channel`
- `externalThreadId`
- `lastActivityAt`
- `notes`
- `isArchived`
- `isInferred`
- `history`

## Status rules

- New actionable requests start as `todo` unless work has already begun.
- Move to `in_progress` when the agent is actively working.
- Move to `blocked` when progress depends on missing input, credentials, approvals, or failures.
- Move to `review` when the work is ready for inspection or handoff.
- Move to `done` only when the requested work is complete.

## File format

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-03-30T00:00:00.000Z",
  "tasks": [
    {
      "id": "research-mtulsa-com",
      "title": "Research mtulsa.com",
      "description": "Review mtulsa.com and summarize the site, positioning, and improvement opportunities.",
      "status": "in_progress",
      "source": "claw3d_manual",
      "sourceEventId": null,
      "assignedAgentId": "main",
      "createdAt": "2026-03-30T00:00:00.000Z",
      "updatedAt": "2026-03-30T00:10:00.000Z",
      "playbookJobId": null,
      "runId": null,
      "channel": "telegram",
      "externalThreadId": "telegram:direct:6866695577",
      "lastActivityAt": "2026-03-30T00:10:00.000Z",
      "notes": [],
      "isArchived": false,
      "isInferred": false,
      "history": [
        {
          "at": "2026-03-30T00:00:00.000Z",
          "type": "created",
          "note": "Task created.",
          "fromStatus": null,
          "toStatus": "todo"
        },
        {
          "at": "2026-03-30T00:10:00.000Z",
          "type": "status_changed",
          "note": null,
          "fromStatus": "todo",
          "toStatus": "in_progress"
        }
      ]
    }
  ]
}
```

## Response rules

- Briefly confirm which task was created or updated.
- If the request is ambiguous, ask a clarifying question instead of guessing.
- Do not claim work is complete without updating the task status.
