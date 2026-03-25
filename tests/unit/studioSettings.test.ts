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
});
