import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { AgentState } from "@/features/agents/state/store";
import { AgentBrainPanel } from "@/features/agents/components/AgentInspectPanels";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

const createAgent = (agentId: string, name: string, sessionKey: string): AgentState => ({
  agentId,
  name,
  sessionKey,
  status: "idle",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: [],
  lastResult: null,
  lastDiff: null,
  runId: null,
  runStartedAt: null,
  streamText: null,
  thinkingTrace: null,
  latestOverride: null,
  latestOverrideKind: null,
  lastAssistantMessageAt: null,
  lastActivityAt: null,
  latestPreview: null,
  lastUserMessage: null,
  draft: "",
  sessionSettingsSynced: true,
  historyLoadedAt: null,
  historyFetchLimit: null,
  historyFetchedCount: null,
  historyMaybeTruncated: false,
  toolCallingEnabled: true,
  showThinkingTraces: true,
  model: null,
  thinkingLevel: null,
  avatarSeed: `seed-${agentId}`,
  avatarUrl: null,
});

const createMockClient = () => {
  const filesByAgent: Record<string, Record<string, string>> = {
    "agent-1": {
      "AGENTS.md": "alpha agents",
      "SOUL.md": "# SOUL.md - Who You Are\n\n## Core Truths\n\nBe useful.",
      "IDENTITY.md": "# IDENTITY.md - Who Am I?\n\n- Name: Alpha\n- Creature: droid\n- Vibe: calm\n- Emoji: 🤖\n",
      "USER.md": "# USER.md - About Your Human\n\n- Name: George\n- What to call them: GP\n\n## Context\n\nBuilding Claw3D.",
      "TOOLS.md": "tool notes",
      "HEARTBEAT.md": "heartbeat notes",
      "MEMORY.md": "durable memory",
    },
    "agent-2": {
      "AGENTS.md": "beta agents",
    },
  };

  const calls: Array<{ method: string; params: unknown }> = [];

  const client = {
    call: vi.fn(async (method: string, params: unknown) => {
      calls.push({ method, params });
      if (method === "agents.files.get") {
        const record = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
        const agentId = typeof record.agentId === "string" ? record.agentId : "";
        const name = typeof record.name === "string" ? record.name : "";
        const content = filesByAgent[agentId]?.[name];
        const workspace = `/workspace/${agentId}`;
        const path = `${workspace}/${name}`;
        if (typeof content !== "string") {
          return { workspace, file: { name, path, missing: true } };
        }
        return { workspace, file: { name, path, missing: false, content } };
      }
      if (method === "agents.files.set") {
        const record = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
        const agentId = typeof record.agentId === "string" ? record.agentId : "";
        const name = typeof record.name === "string" ? record.name : "";
        const content = typeof record.content === "string" ? record.content : "";
        if (!filesByAgent[agentId]) {
          filesByAgent[agentId] = {};
        }
        filesByAgent[agentId][name] = content;
        return { ok: true };
      }
      return {};
    }),
  } as unknown as GatewayClient;

  return { client, calls, filesByAgent };
};

describe("AgentBrainPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders_behavior_sections_and_loads_agent_files", async () => {
    const { client } = createMockClient();
    const agents = [
      createAgent("agent-1", "Alpha", "session-1"),
      createAgent("agent-2", "Beta", "session-2"),
    ];

    render(
      createElement(AgentBrainPanel, {
        client,
        agents,
        selectedAgentId: "agent-1",
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "SOUL.md" })).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "AGENTS.md" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "USER.md" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "IDENTITY.md" })).toBeInTheDocument();
    expect(screen.getAllByText("Workspace:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("/workspace/agent-1").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("AGENTS.md")).toHaveValue("alpha agents");
    expect(screen.getByLabelText("SOUL.md")).toHaveValue(
      "# SOUL.md - Who You Are\n\n## Core Truths\n\nBe useful."
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Alpha");
  });

  it("shows_actionable_message_when_session_key_missing", async () => {
    const { client } = createMockClient();
    const agents = [createAgent("", "Alpha", "session-1")];

    render(
      createElement(AgentBrainPanel, {
        client,
        agents,
        selectedAgentId: "",
      })
    );

    await waitFor(() => {
      expect(screen.getByText("Agent ID is missing for this agent.")).toBeInTheDocument();
    });
  });

  it("saves_updated_behavior_files", async () => {
    const { client, calls, filesByAgent } = createMockClient();
    const agents = [createAgent("agent-1", "Alpha", "session-1")];

    render(
      createElement(AgentBrainPanel, {
        client,
        agents,
        selectedAgentId: "agent-1",
      })
    );

    await waitFor(() => {
      expect(screen.getByLabelText("AGENTS.md")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("AGENTS.md"), {
      target: { value: "alpha directives updated" },
    });

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(calls.some((entry) => entry.method === "agents.files.set")).toBe(true);
    });
    expect(filesByAgent["agent-1"]["AGENTS.md"]).toBe("alpha directives updated");
  });

  it("calls_cancel_without_writing_files", async () => {
    const { client, calls } = createMockClient();
    const agents = [createAgent("agent-1", "Alpha", "session-1")];
    const onCancel = vi.fn();

    render(
      createElement(AgentBrainPanel, {
        client,
        agents,
        selectedAgentId: "agent-1",
        onCancel,
      })
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Alpha Prime" },
    });
    expect(screen.getByLabelText("Name")).toHaveValue("Alpha Prime");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(calls.some((entry) => entry.method === "agents.files.set")).toBe(false);
  });

  it("does_not_render_legacy_name_editor_controls", async () => {
    const { client } = createMockClient();
    const agents = [createAgent("agent-1", "Alpha", "session-1")];

    render(
      createElement(AgentBrainPanel, {
        client,
        agents,
        selectedAgentId: "agent-1",
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "SOUL.md" })).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Agent name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update Name" })).not.toBeInTheDocument();
  });

  it("shows_missing_file_state_instead_of_generic_placeholder_content", async () => {
    const { client } = createMockClient();
    const agents = [createAgent("agent-2", "Beta", "session-2")];

    render(
      createElement(AgentBrainPanel, {
        client,
        agents,
        selectedAgentId: "agent-2",
        activeSection: "SOUL.md",
      })
    );

    await waitFor(() => {
      expect(screen.getByText("This agent does not have a custom SOUL.md yet. Saving here will create the real workspace file.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("SOUL.md")).toHaveValue("");
    expect(screen.getByLabelText("SOUL.md")).toHaveAttribute("placeholder", "No SOUL.md yet.");
    expect(screen.getByText("/workspace/agent-2/SOUL.md")).toBeInTheDocument();
  });

  it("can_initialize_missing_personality_files_for_an_agent", async () => {
    const { client, filesByAgent } = createMockClient();
    const agents = [createAgent("agent-2", "Beta", "session-2")];

    render(
      createElement(AgentBrainPanel, {
        client,
        agents,
        selectedAgentId: "agent-2",
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Initialize missing files" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Initialize missing files" }));

    await waitFor(() => {
      expect(filesByAgent["agent-2"]["SOUL.md"]).toContain("# SOUL.md - Who You Are");
    });

    expect(filesByAgent["agent-2"]["IDENTITY.md"]).toContain("- Name: Beta");
    expect(filesByAgent["agent-2"]["USER.md"]).toContain("# USER.md - About Your Human");
  });
});
