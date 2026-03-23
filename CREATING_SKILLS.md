# Creating Skills

This repository ships developer-created marketplace skills as packaged assets that Claw3D can install into an OpenClaw workspace through the gateway.

Use the existing `todo-board` skill as the reference implementation.

## Mental model

- `assets/skills/<package-id>/` is the human-friendly source layout for each packaged skill.
- `src/lib/skills/packaged.ts` contains the client-safe embedded copy of those files used by the marketplace install flow.
- `src/lib/skills/catalog.ts` registers the skill so it appears in the marketplace.
- `src/lib/skills/install-gateway.ts` installs the packaged files into the selected workspace by creating a temporary gateway agent and asking it to write the files.

## Folder structure

Follow this structure for every packaged skill:

```text
assets/
  skills/
    <package-id>/
      SKILL.md
      <optional companion files>
```

Current example:

```text
assets/
  skills/
    todo-board/
      SKILL.md
      todo-list.example.json
```

## 1. Create the skill files

Create a new folder under `assets/skills/<package-id>/`.

Required file:

- `SKILL.md`

Optional files:

- Example JSON files.
- Templates.
- Any additional files the installed skill should include.

### `SKILL.md` requirements

Your `SKILL.md` should include frontmatter, a trigger section, and clear operating instructions for the agent.

Use this pattern:

```md
---
name: my-skill
description: Short description of what the skill does.
metadata: {"openclaw":{"skillKey":"my-skill-key"}}
---

# My Skill

Explain when the skill should be used, where it stores state, how it reads and writes files, and the exact workflow rules the agent must follow.
```

Notes:

- `name` is the user-facing skill name.
- `metadata.openclaw.skillKey` must stay stable and should match the installed folder name.
- Every skill must define a `## Trigger` section that explains what activates the skill and what the agent should physically do in Claw3D when it activates.
- Write instructions as if the model will follow them directly.
- If the skill stores state, define the exact file path and schema.
- Be explicit about read-before-write, validation, ambiguity handling, and response behavior.

### Trigger requirements

Every skill must contain a trigger.

At minimum, the trigger section should define:

- What kind of user request or external event activates the skill.
- What physical behavior the agent should perform in the office when the skill starts.
- Whether that movement should be skipped when the agent is already at the right location.

Example:

````md
## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "todo",
      "todo list",
      "blocked task"
    ]
  },
  "movement": {
    "target": "desk",
    "skipIfAlreadyThere": true
  }
}
```

When this skill is activated, the agent should go to its assigned desk before handling the request.

- Treat requests from Telegram or other external channels as valid triggers when they match this skill.
- If the agent is already at the desk, continue immediately.
````

Current runtime support for `movement.target` values:

- Defined in one source of truth: `src/lib/office/places.ts`.
- Current values:
- `desk`
- `github`
- `gym`
- `qa_lab`

Important:

- The JSON block is what Claw3D parses at runtime.
- Keep the prose explanation too, but do not rely on prose alone for the trigger behavior.
- `activation.anyPhrases` should contain short, stable phrases that are likely to appear in the user request.
- If a skill has no trigger block, Claw3D can fall back to the central default trigger registry in `src/lib/office/places.ts`.

## 2. Mirror the files into `src/lib/skills/packaged.ts`

Claw3D installs packaged skills from client-safe embedded strings, not by reading `assets/skills/...` directly at runtime.

That means every new packaged skill must also be added to `src/lib/skills/packaged.ts`.

For each file in `assets/skills/<package-id>/`, add a matching entry in the packaged file map:

```ts
const PACKAGED_SKILL_FILES: Record<string, PackagedSkillFile[]> = {
  "my-package-id": [
    {
      relativePath: "SKILL.md",
      content: MY_SKILL_MD,
    },
    {
      relativePath: "example.json",
      content: MY_EXAMPLE_JSON,
    },
  ],
};
```

Important:

- Keep the embedded strings exactly synchronized with the asset files.
- Do not change spacing, frontmatter, or filenames between the asset copy and packaged copy.
- `tests/unit/packagedSkills.test.ts` exists to catch drift for the current example. Extend it when you add more packaged skills.

## 3. Register the skill in `src/lib/skills/catalog.ts`

Add a `PackagedSkillDefinition` entry:

```ts
{
  packageId: "my-package-id",
  skillKey: "my-skill-key",
  name: "my-skill",
  description: "Short description.",
  installSource: "openclaw-workspace",
  creatorName: "your-handle",
  creatorUrl: "https://x.com/your-handle/",
}
```

Field meanings:

- `packageId`: internal packaged asset ID, usually the folder name under `assets/skills/`.
- `skillKey`: the OpenClaw skill key and installed folder name.
- `name`: the human-facing skill name shown in the UI.
- `installSource`: where the skill is installed. For current packaged skills this should be `"openclaw-workspace"`.
- `creatorName` and `creatorUrl`: shown as `Powered by ...` in the marketplace.

## 4. Add marketplace presentation metadata

If you want custom category, tagline, badges, or capability labels, add an override in `src/lib/skills/marketplace.ts`.

Example fields:

- `category`
- `tagline`
- `capabilities`
- `editorBadge`
- `hideStats`

For packaged skills, creator attribution normally comes from `src/lib/skills/catalog.ts`.

For developer-created packaged skills, prefer real attribution over fake popularity numbers.

## 5. Understand where the files get installed

The current packaged install flow writes files into the selected workspace here:

```text
<workspace>/skills/<skillKey>/
```

For the TODO example, that becomes:

```text
<workspace>/skills/todo-board/
  SKILL.md
  todo-list.example.json
```

The skill itself can then manage additional workspace files such as:

```text
<workspace>/todo-skill/todo-list.json
```

That state file is runtime data created by the skill instructions. It is separate from the installed skill package.

## 6. Keep the example production-ready

Use the `todo-board` example as the quality bar:

- The skill must define a clear trigger and physical office behavior.
- The instructions should be explicit and deterministic.
- State storage should be file-backed and documented.
- Ambiguous requests should force clarification instead of guessing.
- The installed package should contain only the files needed by the skill.
- Marketplace metadata should be honest and attributed.

## 7. Verify your changes

After creating or editing a packaged skill, run:

```bash
npm test -- tests/unit/packagedSkills.test.ts tests/unit/skillsInstallGateway.test.ts
npm run lint
npm run typecheck
```

If you add new packaged skills, update or extend the packaged skill tests so asset files, embedded copies, and marketplace metadata stay aligned.
