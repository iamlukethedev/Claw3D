import { describe, expect, it } from "vitest";
import { createDefaultAgentAvatarProfile } from "@/lib/avatars/profile";

import {
  defaultStudioSettings,
  defaultStudioFloorRuntimeState,
  mergeStudioSettings,
  normalizeStudioSettings,
  resolveDefaultStudioGatewayProfile,
  resolveStudioGatewayProfiles,
  resolveStudioActiveFloorId,
  resolveStudioFloorRuntimeState,
} from "@/lib/studio/settings";

describe("studio settings normalization", () => {
  it("returns defaults for empty input", () => {
    const normalized = normalizeStudioSettings(null);
    expect(normalized.version).toBe(1);
    expect(normalized.gateway).toBeNull();
    expect(normalized.activeFloorId).toBe("lobby");
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

  it("creates default per-floor runtime state", () => {
    const normalized = normalizeStudioSettings(null);

    expect(normalized.officeFloors["openclaw-ground"]).toEqual(
      expect.objectContaining({
        floorId: "openclaw-ground",
        provider: "openclaw",
        runtimeProfileId: "openclaw-default",
        gatewayUrl: null,
        status: "disconnected",
      }),
    );
  });

  it("normalizes and merges per-floor runtime state", () => {
    const normalized = normalizeStudioSettings({
      officeFloors: {
        "hermes-first": {
          runtimeProfileId: " hermes-pi ",
          gatewayUrl: " ws://127.0.0.1:18789 ",
          status: "connected",
          lastKnownGoodAt: 1234,
          lastErrorCode: " ignored ",
          lastErrorMessage: " ignored ",
        },
      },
    });

    expect(normalized.officeFloors["hermes-first"]).toEqual(
      expect.objectContaining({
        floorId: "hermes-first",
        provider: "hermes",
        runtimeProfileId: "hermes-pi",
        gatewayUrl: "ws://localhost:18789",
        status: "connected",
        lastKnownGoodAt: 1234,
        lastErrorCode: "ignored",
        lastErrorMessage: "ignored",
      }),
    );

    const merged = mergeStudioSettings(normalized, {
      officeFloors: {
        "hermes-first": {
          status: "error",
          lastErrorCode: "connect_timeout",
          lastErrorMessage: "Timed out connecting",
        },
      },
    });

    expect(merged.officeFloors["hermes-first"]).toEqual(
      expect.objectContaining({
        runtimeProfileId: "hermes-pi",
        gatewayUrl: "ws://localhost:18789",
        status: "error",
        lastErrorCode: "connect_timeout",
        lastErrorMessage: "Timed out connecting",
      }),
    );
  });

  it("resolves floor runtime state with fallback", () => {
    const normalized = normalizeStudioSettings(null);

    expect(resolveStudioFloorRuntimeState(normalized, "training")).toEqual(
      defaultStudioFloorRuntimeState("training"),
    );
  });

  it("normalizes and merges active floor selection", () => {
    const normalized = normalizeStudioSettings({
      activeFloorId: "hermes-first",
    });
    expect(resolveStudioActiveFloorId(normalized)).toBe("hermes-first");

    const merged = mergeStudioSettings(normalized, {
      activeFloorId: "training",
    });
    expect(resolveStudioActiveFloorId(merged)).toBe("lobby");
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

  it("resolves simultaneous runtime profiles without collapsing them to one active url", () => {
    const resolved = resolveStudioGatewayProfiles({
      gateway: normalizeStudioSettings({
        gateway: {
          url: "ws://localhost:28789",
          token: "",
          adapterType: "hermes",
          profiles: {
            openclaw: { url: "ws://localhost:18789", token: "open-token" },
            demo: { url: "ws://localhost:38789", token: "" },
          },
        },
      }).gateway,
      localDefaults: null,
    });

    expect(resolved.selectedAdapterType).toBe("hermes");
    expect(resolved.activeProfile).toEqual({
      url: "ws://localhost:28789",
      token: "",
    });
    expect(resolved.profiles).toEqual(
      expect.objectContaining({
        openclaw: { url: "ws://localhost:18789", token: "open-token" },
        hermes: { url: "ws://localhost:28789", token: "" },
        demo: { url: "ws://localhost:38789", token: "" },
      }),
    );
  });

  it("resolves adapter-specific defaults for dormant profiles", () => {
    expect(resolveDefaultStudioGatewayProfile("local", null)).toEqual({
      url: "http://localhost:7770",
      token: "",
    });
    expect(resolveDefaultStudioGatewayProfile("claw3d", null)).toEqual({
      url: "http://localhost:3000/api/runtime/custom",
      token: "",
    });
    expect(resolveDefaultStudioGatewayProfile("custom", null)).toEqual({
      url: "http://localhost:7770",
      token: "",
    });
    expect(resolveDefaultStudioGatewayProfile("demo", null)).toEqual({
      url: "ws://localhost:18789",
      token: "",
    });
  });

  it("merging lastKnownGood with an empty-string token does not overwrite a stored token", () => {
    const current = normalizeStudioSettings({
      gateway: {
        url: "ws://localhost:18789",
        token: "stored-token",
        lastKnownGood: {
          url: "ws://localhost:18789",
          token: "stored-token",
          adapterType: "openclaw",
        },
      },
    });

    const merged = mergeStudioSettings(current, {
      gateway: {
        lastKnownGood: {
          url: "ws://localhost:18789",
          token: "",
          adapterType: "openclaw",
        },
      },
    });

    expect(merged.gateway?.lastKnownGood?.token).toBe("stored-token");
  });

  it("merging lastKnownGood with a real token overwrites the stored token", () => {
    const current = normalizeStudioSettings({
      gateway: {
        url: "ws://localhost:18789",
        token: "old-token",
        lastKnownGood: {
          url: "ws://localhost:18789",
          token: "old-token",
          adapterType: "openclaw",
        },
      },
    });

    const merged = mergeStudioSettings(current, {
      gateway: {
        lastKnownGood: {
          url: "ws://localhost:18789",
          token: "new-token",
          adapterType: "openclaw",
        },
      },
    });

    expect(merged.gateway?.lastKnownGood?.token).toBe("new-token");
  });

  it("merging lastKnownGood with undefined token leaves the stored token unchanged", () => {
    const current = normalizeStudioSettings({
      gateway: {
        url: "ws://localhost:18789",
        token: "stored-token",
        lastKnownGood: {
          url: "ws://localhost:18789",
          token: "stored-token",
          adapterType: "openclaw",
        },
      },
    });

    const merged = mergeStudioSettings(current, {
      gateway: {
        lastKnownGood: {
          url: "ws://localhost:18789",
          adapterType: "openclaw",
        },
      },
    });

    expect(merged.gateway?.lastKnownGood?.token).toBe("stored-token");
  });
});
