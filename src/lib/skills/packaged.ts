type PackagedSkillFile = {
  relativePath: string;
  content: string;
};

// Keep this string synchronized with assets/skills/todo-board/SKILL.md.
const TODO_BOARD_SKILL_MD = `---
name: todo
description: Maintain a shared workspace TODO list with blocked tasks.
metadata: {"openclaw":{"skillKey":"todo-board"}}
---

# TODO Board

Use this skill when the user wants to manage a shared task list for the current workspace.

## Trigger

\`\`\`json
{
  "activation": {
    "anyPhrases": [
      "todo",
      "todo list",
      "blocked task",
      "blocked tasks",
      "add to my todo",
      "show my todo"
    ]
  },
  "movement": {
    "target": "desk",
    "skipIfAlreadyThere": true
  }
}
\`\`\`

When this skill is activated, the agent should return to its assigned desk before handling the request.

- If the user asks from Telegram or any other external surface to add, block, unblock, remove, or read TODO items, treat that as a trigger for this skill.
- The physical behavior for this skill is: go sit at the assigned desk, then perform the TODO board workflow.
- If the agent is already at the desk, continue without adding extra movement narration.

## Storage location

The authoritative task file is \`todo-skill/todo-list.json\` in the workspace root.

- Always treat that file as the source of truth.
- Never rely on chat memory alone for the latest task state.
- Create the \`todo-skill\` directory and \`todo-list.json\` file if they do not exist.

## Required workflow

1. Read \`todo-skill/todo-list.json\` before answering any task-management request.
2. If the file does not exist, create it with the schema in this document before continuing.
3. After every add, remove, block, or unblock action, write the full updated JSON back to disk.
4. If the file exists but is invalid JSON or does not match the schema, repair it into a valid structure, preserve any recoverable items, and mention that repair in your response.
5. If the user request is ambiguous, ask a clarifying question instead of guessing.

## Supported actions

- Add a task.
  Create a new item unless an equivalent active item already exists.
- Block a task.
  Change the matching item to \`status: "blocked"\`. If the task does not exist and the request is clear, create it directly as blocked.
- Unblock a task.
  Change the matching item back to \`status: "todo"\` and clear \`blockReason\`.
- Remove a task.
  Delete only the matching item. If multiple items could match, ask for clarification.
- Read the list.
  Summarize tasks grouped into \`TODO\` and \`BLOCKED\`.

## File format

Use this JSON shape:

\`\`\`json
{
  "version": 1,
  "updatedAt": "2026-03-22T00:00:00.000Z",
  "items": [
    {
      "id": "task-1",
      "title": "Example task",
      "status": "todo",
      "createdAt": "2026-03-22T00:00:00.000Z",
      "updatedAt": "2026-03-22T00:00:00.000Z",
      "blockReason": null
    }
  ]
}
\`\`\`

## Field rules

- Keep \`version\` at \`1\`.
- Generate stable, human-readable IDs such as \`prepare-demo\` or \`task-2\`.
- Keep titles concise and preserve the user's intent.
- Use only \`todo\` or \`blocked\` for \`status\`.
- Use ISO timestamps for \`createdAt\`, item \`updatedAt\`, and top-level \`updatedAt\`.
- Keep \`blockReason\` as \`null\` unless the user gave a reason or a short precise reason is clearly implied.

## Mutation rules

- Avoid duplicate active items that describe the same work.
- Preserve existing IDs and \`createdAt\` values for unchanged items.
- Update the touched item's \`updatedAt\` whenever you modify it.
- Update the top-level \`updatedAt\` on every write.
- Keep untouched items in their original order unless there is a strong reason to reorder them.

## Response style

- After each mutation, say what changed.
- When showing the list, group tasks into \`TODO\` and \`BLOCKED\`.
- Include each blocked task's reason when one exists.
`;

// Keep this string synchronized with assets/skills/todo-board/todo-list.example.json.
const TODO_BOARD_EXAMPLE_JSON = `{
  "version": 1,
  "updatedAt": "2026-03-22T00:00:00.000Z",
  "items": [
    {
      "id": "draft-roadmap",
      "title": "Draft the TODO skill roadmap",
      "status": "todo",
      "createdAt": "2026-03-22T00:00:00.000Z",
      "updatedAt": "2026-03-22T00:00:00.000Z",
      "blockReason": null
    },
    {
      "id": "gateway-access",
      "title": "Confirm gateway install access",
      "status": "blocked",
      "createdAt": "2026-03-22T00:00:00.000Z",
      "updatedAt": "2026-03-22T00:00:00.000Z",
      "blockReason": "Waiting for gateway credentials"
    }
  ]
}
`;

// Keep this string synchronized with assets/skills/task-manager/SKILL.md.
const TASK_MANAGER_SKILL_MD = `---
name: task-manager
description: Capture actionable user requests as persistent tasks, update task status as work progresses, and keep a shared task store in sync. Use when a user asks an agent to do work, check progress, block a task, complete a task, or manage the Kanban board.
metadata: {"openclaw":{"skillKey":"task-manager"}}
---

# Task Manager

Use this skill for task capture and task lifecycle updates.

## Trigger

\`\`\`json
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
\`\`\`

Also use this skill even when those exact phrases are absent if the latest user message is an actionable work request. If the user asks the agent to do something, that request must become a task before the agent proceeds.

## Storage location

The authoritative task file is:

- \`\${OPENCLAW_STATE_DIR}/claw3d/task-manager/tasks.json\` when \`OPENCLAW_STATE_DIR\` is set.
- \`~/.openclaw/claw3d/task-manager/tasks.json\` otherwise.

Always treat that file as the shared source of truth for the Kanban board.

## Required workflow

1. Read the task file before handling an actionable request.
2. If the file does not exist, create it with the schema in this document.
3. If the latest user message is actionable and no matching active task exists, create one immediately.
4. Before starting execution, ensure the task is \`todo\` or move it to \`in_progress\`.
5. If work cannot continue, set the task to \`blocked\` and record a short reason in \`notes\`.
6. When work is finished, set the task to \`done\`.
7. When work needs user review or confirmation, set the task to \`review\`.
8. After every mutation, write the full updated JSON back to disk.

## Matching rules

- Match first by \`externalThreadId\` when the request comes from a stable thread or conversation.
- Otherwise match by a concise normalized title that preserves user intent.
- Avoid creating duplicate active tasks for the same request.

## Task fields

Each task must include:

- \`id\`
- \`title\`
- \`description\`
- \`status\`
- \`source\`
- \`sourceEventId\`
- \`assignedAgentId\`
- \`createdAt\`
- \`updatedAt\`
- \`playbookJobId\`
- \`runId\`
- \`channel\`
- \`externalThreadId\`
- \`lastActivityAt\`
- \`notes\`
- \`isArchived\`
- \`isInferred\`
- \`history\`

## Status rules

- New actionable requests start as \`todo\` unless work has already begun.
- Move to \`in_progress\` when the agent is actively working.
- Move to \`blocked\` when progress depends on missing input, credentials, approvals, or failures.
- Move to \`review\` when the work is ready for inspection or handoff.
- Move to \`done\` only when the requested work is complete.

## File format

\`\`\`json
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
\`\`\`

## Response rules

- Briefly confirm which task was created or updated.
- If the request is ambiguous, ask a clarifying question instead of guessing.
- Do not claim work is complete without updating the task status.
`;

// Keep this string synchronized with assets/skills/task-manager/tasks.example.json.
const TASK_MANAGER_EXAMPLE_JSON = `{
  "schemaVersion": 1,
  "updatedAt": "2026-03-30T00:10:00.000Z",
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
`;

// Keep this string synchronized with assets/skills/soundclaw/SKILL.md.
const SOUNDCLAW_SKILL_MD = `---
name: soundclaw
description: Control Spotify playback, search music, and return shareable music links.
metadata: {"openclaw":{"skillKey":"soundclaw"}}
---

# SOUNDCLAW

Use this skill when the user wants an agent to search for music, play a song or playlist, control Spotify playback, or send back a shareable Spotify link on the same channel the request came from.

## Trigger

\`\`\`json
{
  "activation": {
    "anyPhrases": [
      "spotify",
      "play a song",
      "play this song",
      "play music",
      "play a playlist",
      "find a song",
      "queue this song",
      "music link"
    ]
  },
  "movement": {
    "target": "jukebox",
    "skipIfAlreadyThere": true
  }
}
\`\`\`

When this skill is activated, the agent should walk to the office jukebox before handling the request.

- Treat requests from Telegram or any other external surface as valid triggers when they ask for Spotify playback, search, queueing, or music-link sharing.
- The physical behavior for this skill is: go to the jukebox, perform the music-selection workflow, then report the result.
- If the agent is already at the jukebox, continue without adding extra movement narration.

## Channel behavior

- Reply on the same active channel or session that received the request.
- If playback cannot start but a matching track, album, or playlist is found, send back the best Spotify link instead of failing silently.
- If multiple matches are plausible, ask a clarifying question instead of guessing.

---

## OpenClaw Gateway Skill Contract

> This section is for developers implementing the backend skill handler in OpenClaw.
> The Claw3D UI handles authentication via Spotify PKCE OAuth in the browser.
> The gateway skill handles agent-driven requests via the \`soundclaw.*\` RPC namespace.

### Authentication model

The user authenticates directly in the browser (PKCE, no secret required).
The access token is stored in browser \`localStorage\` under the key \`soundclaw_token\`.

For **agent-driven** playback (e.g. "play Jazz for me"), the gateway skill should either:
- Use a server-side Spotify app token (Client Credentials) for search-only actions, or
- Instruct the agent to tell the user to use the jukebox panel for actual playback

### RPC methods the gateway skill should expose

\`\`\`ts
// Search for tracks. Returns a list of { name, artist, album, uri, spotifyUrl }.
soundclaw.search({ query: string }): SpotifySearchResult[]

// Get a shareable Spotify link for a query (for Telegram/chat replies).
soundclaw.getLink({ query: string }): { url: string; title: string }

// Report current playback state (reads from Spotify API).
soundclaw.playerStatus(): PlayerStatus | null

// Request playback of a URI (requires user to be authenticated in browser).
soundclaw.play({ uri: string }): { ok: boolean; message?: string }

// Pause / resume / skip.
soundclaw.pause(): void
soundclaw.resume(): void
soundclaw.next(): void
soundclaw.previous(): void
\`\`\`

### Agent workflow

1. Agent receives a music request ("play some jazz", "find this song", etc.)
2. Agent walks to the jukebox (\`movement.target: "jukebox"\`)
3. Agent calls \`soundclaw.search\` to find the best match
4. If the request came from a chat channel (Telegram, etc.): call \`soundclaw.getLink\` and reply with the link
5. If the request came from the office UI: call \`soundclaw.play\` to start playback
6. Agent reports back what was played or linked
`;

const PACKAGED_SKILL_FILES: Record<string, PackagedSkillFile[]> = {
  "todo-board": [
    {
      relativePath: "SKILL.md",
      content: TODO_BOARD_SKILL_MD,
    },
    {
      relativePath: "todo-list.example.json",
      content: TODO_BOARD_EXAMPLE_JSON,
    },
  ],
  "task-manager": [
    {
      relativePath: "SKILL.md",
      content: TASK_MANAGER_SKILL_MD,
    },
    {
      relativePath: "tasks.example.json",
      content: TASK_MANAGER_EXAMPLE_JSON,
    },
  ],
  soundclaw: [
    {
      relativePath: "SKILL.md",
      content: SOUNDCLAW_SKILL_MD,
    },
  ],
};

export const readPackagedSkillFiles = (
  packageId: string,
): PackagedSkillFile[] => {
  const files = PACKAGED_SKILL_FILES[packageId];
  if (!files || files.length === 0) {
    throw new Error(`Packaged skill assets are missing: ${packageId}`);
  }
  if (!files.some((file) => file.relativePath === "SKILL.md")) {
    throw new Error(`Packaged skill is missing SKILL.md: ${packageId}`);
  }
  return files.map((file) => ({ ...file }));
};
