import { describe, expect, it, vi } from "vitest";
import { runCompanyBootstrapOperation } from "@/features/company-builder/operations/companyBootstrapOperation";
import { parseCompanyPlanFromAssistantText } from "@/features/company-builder/planning";

describe("runCompanyBootstrapOperation", () => {
  it("creates agents, reloads the fleet, applies permissions, and persists the snapshot", async () => {
    const plan = parseCompanyPlanFromAssistantText(
      JSON.stringify({
        companyName: "Launch Lab",
        summary: "A product org with engineering and QA.",
        sharedRules: [],
        plannerNotes: [],
        roles: [
          {
            title: "Engineer",
            purpose: "Builds features.",
            soul: "Fast but careful.",
            responsibilities: ["Ship features"],
            collaborators: ["QA Lead"],
            tools: ["repo"],
            heartbeat: ["Check PRs"],
            emoji: "🛠",
            creature: "otter",
            vibe: "focused",
            userContext: "",
            commandMode: "auto",
          },
          {
            title: "QA Lead",
            purpose: "Protects quality.",
            soul: "Detail-oriented.",
            responsibilities: ["Review releases"],
            collaborators: ["Engineer"],
            tools: ["test plans"],
            heartbeat: ["Review regressions"],
            emoji: "🧪",
            creature: "owl",
            vibe: "precise",
            userContext: "",
            commandMode: "ask",
          },
        ],
      }),
    );

    const createAgent = vi
      .fn<(name: string) => Promise<{ id: string }>>()
      .mockResolvedValueOnce({ id: "engineer" })
      .mockResolvedValueOnce({ id: "qa-lead" });
    const writeAgentFiles = vi.fn<(agentId: string, files: Record<string, string>) => Promise<void>>()
      .mockResolvedValue(undefined);
    const saveAvatar = vi.fn<(agentId: string) => void>();
    const loadAgents = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const findAgentById = vi.fn((agentId: string) => ({
      agentId,
      sessionKey: `agent:${agentId}:main`,
    }));
    const applyPermissions = vi
      .fn<(agentId: string, sessionKey: string, commandMode: "off" | "ask" | "auto") => Promise<void>>()
      .mockResolvedValue(undefined);
    const resetAgentSession = vi
      .fn<(agentId: string, sessionKey: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    const persistSnapshot = vi.fn<(input: { businessDescription: string; improvedBrief: string }, planArg: typeof plan) => void>();
    const setOfficeTitle = vi.fn<(title: string) => void>();
    const selectAgent = vi.fn<(agentId: string) => void>();
    const setStatusLine = vi.fn<(value: string | null) => void>();

    const createdIds = await runCompanyBootstrapOperation({
      input: {
        businessDescription: "Build a launch team.",
        improvedBrief: "Build a launch team with engineering and QA.",
      },
      plan,
      existingAgentIds: [],
      createAgent,
      writeAgentFiles,
      saveAvatar,
      loadAgents,
      findAgentById,
      resetAgentSession,
      applyPermissions,
      persistSnapshot,
      setOfficeTitle,
      selectAgent,
      setStatusLine,
    });

    expect(createdIds).toEqual(["engineer", "qa-lead"]);
    expect(createAgent).toHaveBeenCalledTimes(2);
    expect(writeAgentFiles).toHaveBeenCalledTimes(2);
    expect(saveAvatar).toHaveBeenCalledTimes(2);
    expect(loadAgents).toHaveBeenCalledTimes(1);
    expect(applyPermissions).toHaveBeenNthCalledWith(
      1,
      "engineer",
      "agent:engineer:main",
      "auto",
    );
    expect(applyPermissions).toHaveBeenNthCalledWith(
      2,
      "qa-lead",
      "agent:qa-lead:main",
      "ask",
    );
    expect(setOfficeTitle).toHaveBeenCalledWith("Launch Lab HQ");
    expect(selectAgent).toHaveBeenCalledWith("engineer");
    expect(persistSnapshot).toHaveBeenCalledOnce();
    expect(resetAgentSession).not.toHaveBeenCalled();
    expect(setStatusLine).toHaveBeenLastCalledWith(null);
  });

  it("deletes existing agents before creating the new company", async () => {
    const plan = parseCompanyPlanFromAssistantText(
      JSON.stringify({
        companyName: "Fresh Start Studio",
        summary: "A brand new company plan.",
        sharedRules: [],
        plannerNotes: [],
        roles: [
          {
            title: "Creative Lead",
            purpose: "Leads delivery.",
            soul: "Bold.",
            responsibilities: ["Direct projects"],
            collaborators: [],
            tools: [],
            heartbeat: [],
            emoji: "🎨",
            creature: "fox",
            vibe: "sharp",
            userContext: "",
            commandMode: "ask",
          },
        ],
      }),
    );

    const order: string[] = [];
    await runCompanyBootstrapOperation({
      input: {
        businessDescription: "Replace my current team.",
        improvedBrief: "Replace my current team with a new creative studio.",
      },
      plan,
      existingAgentIds: ["old-a", "old-b"],
      deleteExistingAgent: async (agentId) => {
        order.push(`delete:${agentId}`);
      },
      clearReusedAgentState: async () => {
        order.push("clear-reused");
      },
      onExistingAgentDeleted: (agentId) => {
        order.push(`deleted:${agentId}`);
      },
      createAgent: async (name) => {
        order.push(`create:${name}`);
        return { id: "creative-lead" };
      },
      writeAgentFiles: async () => {
        order.push("write");
      },
      saveAvatar: () => {
        order.push("avatar");
      },
      loadAgents: async () => {
        order.push("load");
      },
      findAgentById: () => ({
        agentId: "creative-lead",
        sessionKey: "agent:creative-lead:main",
      }),
      resetAgentSession: async () => {
        order.push("reset");
      },
      applyPermissions: async () => {
        order.push("permissions");
      },
      persistSnapshot: () => {
        order.push("persist");
      },
      setOfficeTitle: () => {
        order.push("title");
      },
      selectAgent: () => {
        order.push("select");
      },
      setStatusLine: () => {},
    });

    expect(order.slice(0, 4)).toEqual([
      "delete:old-a",
      "deleted:old-a",
      "delete:old-b",
      "deleted:old-b",
    ]);
    expect(order).not.toContain("clear-reused");
    expect(order).toContain("create:CreativeLead");
    expect(order).not.toContain("reset");
  });

  it("reuses main as the first company role instead of deleting it", async () => {
    const plan = parseCompanyPlanFromAssistantText(
      JSON.stringify({
        companyName: "Fresh Start Studio",
        summary: "A brand new company plan.",
        sharedRules: [],
        plannerNotes: [],
        roles: [
          {
            title: "Creative Lead",
            purpose: "Leads delivery.",
            soul: "Bold.",
            responsibilities: ["Direct projects"],
            collaborators: [],
            tools: [],
            heartbeat: [],
            emoji: "🎨",
            creature: "fox",
            vibe: "sharp",
            userContext: "",
            commandMode: "ask",
          },
          {
            title: "Operator",
            purpose: "Runs operations.",
            soul: "Calm.",
            responsibilities: ["Keep work moving"],
            collaborators: [],
            tools: [],
            heartbeat: [],
            emoji: "⚙️",
            creature: "owl",
            vibe: "steady",
            userContext: "",
            commandMode: "auto",
          },
        ],
      }),
    );

    const order: string[] = [];
    const createdIds = await runCompanyBootstrapOperation({
      input: {
        businessDescription: "Replace my current team.",
        improvedBrief: "Replace my current team with a new creative studio.",
      },
      plan,
      existingAgentIds: ["main", "old-b"],
      deleteExistingAgent: async (agentId) => {
        order.push(`delete:${agentId}`);
      },
      clearReusedAgentState: async (agentId) => {
        order.push(`clear-reused:${agentId}`);
      },
      renameAgent: async (agentId, name) => {
        order.push(`rename:${agentId}:${name}`);
      },
      onExistingAgentDeleted: (agentId) => {
        order.push(`deleted:${agentId}`);
      },
      createAgent: async (name) => {
        order.push(`create:${name}`);
        return { id: "operator" };
      },
      writeAgentFiles: async (agentId) => {
        order.push(`write:${agentId}`);
      },
      saveAvatar: (agentId) => {
        order.push(`avatar:${agentId}`);
      },
      loadAgents: async () => {
        order.push("load");
      },
      findAgentById: (agentId) => ({
        agentId,
        sessionKey: `agent:${agentId}:main`,
      }),
      resetAgentSession: async (agentId, sessionKey) => {
        order.push(`reset:${agentId}:${sessionKey}`);
      },
      applyPermissions: async (agentId, _sessionKey, commandMode) => {
        order.push(`permissions:${agentId}:${commandMode}`);
      },
      persistSnapshot: () => {
        order.push("persist");
      },
      setOfficeTitle: () => {
        order.push("title");
      },
      selectAgent: (agentId) => {
        order.push(`select:${agentId}`);
      },
      setStatusLine: () => {},
    });

    expect(order).not.toContain("delete:main");
    expect(order.slice(0, 2)).toEqual(["delete:old-b", "deleted:old-b"]);
    expect(order).toContain("clear-reused:main");
    expect(order).toContain("rename:main:CreativeLead");
    expect(order).toContain("write:main");
    expect(order).toContain("avatar:main");
    expect(order).toContain("create:Operator");
    expect(order).toContain("permissions:main:ask");
    expect(order).toContain("permissions:operator:auto");
    expect(order).toContain("reset:main:agent:main:main");
    expect(order).toContain("select:main");
    expect(createdIds).toEqual(["main", "operator"]);
  });
});
