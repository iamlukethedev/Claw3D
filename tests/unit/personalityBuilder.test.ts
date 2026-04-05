import { describe, expect, it } from "vitest";

import { createAgentFilesState } from "@/lib/agents/agentFiles";
import {
  parsePersonalityFiles,
  serializePersonalityFiles,
  type PersonalityBuilderDraft,
} from "@/lib/agents/personalityBuilder";

const createFiles = () => createAgentFilesState();

describe("personalityBuilder", () => {
  it("parseIdentityMarkdown_extracts_fields_from_template_style_list", () => {
    const files = createFiles();
    files["IDENTITY.md"] = {
      exists: true,
      content:
        "# IDENTITY.md - Who Am I?\n\n- **Name:** Nova\n- **Creature:** fox spirit\n- **Vibe:** calm + direct\n- **Emoji:** fox\n- **Avatar:** avatars/nova.png\n",
      path: null,
      workspace: null,
    };

    const draft = parsePersonalityFiles(files);

    expect(draft.identity).toEqual({
      name: "Nova",
      creature: "fox spirit",
      vibe: "calm + direct",
      emoji: "fox",
      avatar: "avatars/nova.png",
    });
  });

  it("parseUserMarkdown_extracts_context_block_and_profile_fields", () => {
    const files = createFiles();
    files["USER.md"] = {
      exists: true,
      content:
        "# USER.md - About Your Human\n\n- **Name:** George\n- **What to call them:** GP\n- **Pronouns:** he/him\n- **Timezone:** America/Chicago\n- **Notes:** Building Claw3D.\n\n## Context\n\nWants concise technical answers.\nPrefers implementation over discussion.\n",
      path: null,
      workspace: null,
    };

    const draft = parsePersonalityFiles(files);

    expect(draft.user).toEqual({
      name: "George",
      callThem: "GP",
      pronouns: "he/him",
      timezone: "America/Chicago",
      notes: "Building Claw3D.",
      context: "Wants concise technical answers.\nPrefers implementation over discussion.",
    });
  });

  it("parseSoulMarkdown_extracts_core_sections", () => {
    const files = createFiles();
    files["SOUL.md"] = {
      exists: true,
      content:
        "# SOUL.md - Who You Are\n\n## Core Truths\n\nBe direct.\nAvoid filler.\n\n## Boundaries\n\n- Keep user data private.\n\n## Vibe\n\nPragmatic and calm.\n\n## Continuity\n\nUpdate files when behavior changes.\n",
      path: null,
      workspace: null,
    };

    const draft = parsePersonalityFiles(files);

    expect(draft.soul).toEqual({
      coreTruths: "Be direct.\nAvoid filler.",
      boundaries: "- Keep user data private.",
      vibe: "Pragmatic and calm.",
      continuity: "Update files when behavior changes.",
    });
  });

  it("ignores_template_placeholders_for_identity_and_user", () => {
    const files = createFiles();
    files["IDENTITY.md"] = {
      exists: true,
      content:
        "# IDENTITY.md - Who Am I?\n\n- **Name:** _(pick something you like)_\n- **Creature:** _(AI? robot? familiar? ghost in the machine? something weirder?)_\n- **Vibe:** _(how do you come across? sharp? warm? chaotic? calm?)_\n- **Emoji:** _(your signature - pick one that feels right)_\n- **Avatar:** _(workspace-relative path, http(s) URL, or data URI)_\n",
      path: null,
      workspace: null,
    };
    files["USER.md"] = {
      exists: true,
      content:
        "# USER.md - About Your Human\n\n- **Name:**\n- **What to call them:**\n- **Pronouns:** _(optional)_\n- **Timezone:**\n- **Notes:**\n\n## Context\n\n_(What do they care about? What projects are they working on? What annoys them? What makes them laugh? Build this over time.)_\n",
      path: null,
      workspace: null,
    };

    const draft = parsePersonalityFiles(files);

    expect(draft.identity).toEqual({
      name: "",
      creature: "",
      vibe: "",
      emoji: "",
      avatar: "",
    });
    expect(draft.user).toEqual({
      name: "",
      callThem: "",
      pronouns: "",
      timezone: "",
      notes: "",
      context: "",
    });
  });

  it("serializePersonalityFiles_emits_stable_markdown_for_identity_user_soul", () => {
    const draft: PersonalityBuilderDraft = {
      identity: {
        name: "Nova",
        creature: "fox spirit",
        vibe: "calm + direct",
        emoji: "fox",
        avatar: "avatars/nova.png",
      },
      user: {
        name: "George",
        callThem: "GP",
        pronouns: "he/him",
        timezone: "America/Chicago",
        notes: "Building Claw3D.",
        context: "Wants concise technical answers.\nPrefers implementation over discussion.",
      },
      soul: {
        coreTruths: "Be direct.\nAvoid filler.",
        boundaries: "- Keep user data private.",
        vibe: "Pragmatic and calm.",
        continuity: "Update files when behavior changes.",
      },
      agents: "Top-level operating rules.",
      tools: "Tool conventions.",
      heartbeat: "Heartbeat notes.",
      memory: "Durable memory.",
    };

    const files = serializePersonalityFiles(draft);

    expect(files["IDENTITY.md"]).toBe(
      [
        "# IDENTITY.md - Who Am I?",
        "",
        "- Name: Nova",
        "- Creature: fox spirit",
        "- Vibe: calm + direct",
        "- Emoji: fox",
        "- Avatar: avatars/nova.png",
        "",
      ].join("\n")
    );

    expect(files["USER.md"]).toBe(
      [
        "# USER.md - About Your Human",
        "",
        "- Name: George",
        "- What to call them: GP",
        "- Pronouns: he/him",
        "- Timezone: America/Chicago",
        "- Notes: Building Claw3D.",
        "",
        "## Context",
        "",
        "Wants concise technical answers.",
        "Prefers implementation over discussion.",
        "",
      ].join("\n")
    );

    expect(files["SOUL.md"]).toBe(
      [
        "# SOUL.md - Who You Are",
        "",
        "## Core Truths",
        "",
        "Be direct.",
        "Avoid filler.",
        "",
        "## Boundaries",
        "",
        "- Keep user data private.",
        "",
        "## Vibe",
        "",
        "Pragmatic and calm.",
        "",
        "## Continuity",
        "",
        "Update files when behavior changes.",
        "",
      ].join("\n")
    );

    expect(files["AGENTS.md"]).toBe("Top-level operating rules.");
    expect(files["TOOLS.md"]).toBe("Tool conventions.");
    expect(files["HEARTBEAT.md"]).toBe("Heartbeat notes.");
    expect(files["MEMORY.md"]).toBe("Durable memory.");
  });
});
