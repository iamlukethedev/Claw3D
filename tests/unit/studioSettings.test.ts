import { describe, expect, it } from "vitest";
import { createDefaultAgentAvatarProfile } from "@/lib/avatars/profile";

import {
  mergeStudioSettings,
  normalizeStudioSettings,
} from "@/lib/studio/settings";

describe("studio settings normalization", () => {
  it("returns defaults for empty input", () => {
    const normalized = normalizeStudioSettings(null);
    expect(normalized.version).toBe(1);
    expect(normalized.gateway).toBeNull();
    expect(normalized.focused).toEqual({});
    expect(normalized.avatars).toEqual({});
    expect(normalized.office).toEqual({});
  });

  it("normalizes gateway entries", () => {
    const normalized = normalizeStudioSettings({
      gateway: { url: " ws://localhost:18789 ", token: " token " },
    });

    expect(normalized.gateway?.url).toBe("ws://localhost:18789");
    expect(normalized.gateway?.token).toBe("token");
  });

  it("normalizes loopback ip gateway urls to localhost", () => {
    const normalized = normalizeStudioSettings({
      gateway: { url: "ws://127.0.0.1:18789", token: "token" },
    });

    expect(normalized.gateway?.url).toBe("ws://localhost:18789");
  });

  it("preserves paperclip adapter profiles", () => {
    const normalized = normalizeStudioSettings({
      gateway: {
        url: "ws://localhost:18791",
        token: "",
        adapterType: "paperclip",
        profiles: {
          paperclip: { url: "ws://localhost:18791", token: "" },
        },
      },
    });

    expect(normalized.gateway?.adapterType).toBe("paperclip");
    expect(normalized.gateway?.profiles?.paperclip).toEqual({
      url: "ws://localhost:18791",
      token: "",
    });
  });

  it("normalizes_dual_mode_preferences", () => {
    const normalized = normalizeStudioSettings({
      focused: {
        " ws://localhost:18789 ": {
          mode: "focused",
          selectedAgentId: " agent-2 ",
          filter: "running",
        },
        bad: {
          mode: "nope",
          selectedAgentId: 12,
          filter: "bad-filter",
        },
      },
    });

    expect(normalized.focused["ws://localhost:18789"]).toEqual({
      mode: "focused",
      selectedAgentId: "agent-2",
      filter: "running",
    });
    expect(normalized.focused.bad).toEqual({
      mode: "focused",
      selectedAgentId: null,
      filter: "all",
    });
  });

  it("normalizes_legacy_idle_filter_to_approvals", () => {
    const normalized = normalizeStudioSettings({
      focused: {
        "ws://localhost:18789": {
          mode: "focused",
          selectedAgentId: "agent-1",
          filter: "idle",
        },
      },
    });

    expect(normalized.focused["ws://localhost:18789"]).toEqual({
      mode: "focused",
      selectedAgentId: "agent-1",
      filter: "approvals",
    });
  });

  it("merges_dual_mode_preferences", () => {
    const current = normalizeStudioSettings({
      focused: {
        "ws://localhost:18789": {
          mode: "focused",
          selectedAgentId: "main",
          filter: "all",
        },
      },
    });

    const merged = mergeStudioSettings(current, {
      focused: {
        "ws://localhost:18789": {
          filter: "approvals",
        },
      },
    });

    expect(merged.focused["ws://localhost:18789"]).toEqual({
      mode: "focused",
      selectedAgentId: "main",
      filter: "approvals",
    });
  });

  it("normalizes avatar seeds per gateway", () => {
    const normalized = normalizeStudioSettings({
      avatars: {
        " ws://localhost:18789 ": {
          " agent-1 ": " seed-1 ",
          " agent-2 ": " ",
        },
        bad: "nope",
      },
    });

    expect(normalized.avatars["ws://localhost:18789"]?.["agent-1"]?.seed).toBe("seed-1");
  });

  it("merges avatar patches", () => {
    const firstProfile = createDefaultAgentAvatarProfile("seed-1");
    const replacementProfile = createDefaultAgentAvatarProfile("seed-2");
    const secondProfile = createDefaultAgentAvatarProfile("seed-3");
    const current = normalizeStudioSettings({
      avatars: {
        "ws://localhost:18789": {
          "agent-1": firstProfile,
        },
      },
    });

    const merged = mergeStudioSettings(current, {
      avatars: {
        "ws://localhost:18789": {
          "agent-1": replacementProfile,
          "agent-2": secondProfile,
        },
      },
    });

    expect(merged.avatars["ws://localhost:18789"]?.["agent-1"]?.seed).toBe("seed-2");
    expect(merged.avatars["ws://localhost:18789"]?.["agent-2"]?.seed).toBe("seed-3");
  });

  it("normalizes office title preferences per gateway", () => {
    const normalized = normalizeStudioSettings({
      office: {
        " ws://localhost:18789 ": {
          title: "  Team Orbit  ",
        },
        bad: {
          title: "",
        },
      },
    });

    expect(normalized.office["ws://localhost:18789"]).toEqual(
      expect.objectContaining({
        title: "Team Orbit",
      }),
    );
    expect(normalized.office.bad).toEqual(
      expect.objectContaining({
        title: "Luke Headquarters",
      }),
    );
  });

  it("merges office title patches", () => {
    const current = normalizeStudioSettings({
      office: {
        "ws://localhost:18789": {
          title: "Luke Headquarters",
        },
      },
    });

    const merged = mergeStudioSettings(current, {
      office: {
        "ws://localhost:18789": {
          title: "Orbit Control",
        },
      },
    });

    expect(merged.office["ws://localhost:18789"]).toEqual(
      expect.objectContaining({
        title: "Orbit Control",
      }),
    );
  });

  it("normalizes task board cards per gateway", () => {
    const normalized = normalizeStudioSettings({
      taskBoard: {
        " ws://localhost:18789 ": {
          cards: [
            {
              id: " task-1 ",
              title: "  Review kanban interaction  ",
              status: "review",
              source: "openclaw_event",
              assignedAgentId: " agent-1 ",
              createdAt: "2026-03-29T10:00:00.000Z",
              updatedAt: "2026-03-29T10:05:00.000Z",
              notes: [" note one ", " ", "note two"],
            },
          ],
          selectedCardId: " task-1 ",
        },
      },
    });

    expect(normalized.taskBoard?.["ws://localhost:18789"]).toEqual(
      expect.objectContaining({
        selectedCardId: "task-1",
        cards: [
          expect.objectContaining({
            id: "task-1",
            title: "Review kanban interaction",
            assignedAgentId: "agent-1",
            notes: ["note one", "note two"],
          }),
        ],
      }),
    );
  });

  it("merges task board patches", () => {
    const current = normalizeStudioSettings({
      taskBoard: {
        "ws://localhost:18789": {
          cards: [
            {
              id: "task-1",
              title: "Initial task",
              description: "",
              status: "todo",
              source: "claw3d_manual",
              sourceEventId: null,
              assignedAgentId: null,
              createdAt: "2026-03-29T10:00:00.000Z",
              updatedAt: "2026-03-29T10:00:00.000Z",
              playbookJobId: null,
              runId: null,
              channel: null,
              externalThreadId: null,
              lastActivityAt: null,
              notes: [],
              isArchived: false,
              isInferred: false,
            },
          ],
          selectedCardId: "task-1",
        },
      },
    });

    const merged = mergeStudioSettings(current, {
      taskBoard: {
        "ws://localhost:18789": {
          cards: [
            {
              id: "task-2",
              title: "Replacement task",
              description: "",
              status: "in_progress",
              source: "claw3d_manual",
              sourceEventId: null,
              assignedAgentId: null,
              createdAt: "2026-03-29T10:10:00.000Z",
              updatedAt: "2026-03-29T10:10:00.000Z",
              playbookJobId: null,
              runId: null,
              channel: null,
              externalThreadId: null,
              lastActivityAt: null,
              notes: [],
              isArchived: false,
              isInferred: false,
            },
          ],
          selectedCardId: "task-2",
        },
      },
    });

    expect(merged.taskBoard?.["ws://localhost:18789"]).toEqual(
      expect.objectContaining({
        selectedCardId: "task-2",
        cards: [
          expect.objectContaining({
            id: "task-2",
            title: "Replacement task",
            status: "in_progress",
          }),
        ],
      }),
    );
  });
});
