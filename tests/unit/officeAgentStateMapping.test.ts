import { describe, expect, it } from "vitest";
import {
  DEFAULT_OFFICE_AGENT_STATE_MAPPING,
  mergeOfficeAgentStateMapping,
  normalizeOfficeAgentStateMapping,
  resolveLocalOfficeRenderableStatus,
  resolveLocalOfficeStateSignal,
  resolveRemoteOfficeRenderableStatus,
} from "@/lib/office/agentStateMapping";

describe("office agent state mapping", () => {
  it("keeps the default mapping stable", () => {
    expect(DEFAULT_OFFICE_AGENT_STATE_MAPPING.local.running).toBe("working");
    expect(DEFAULT_OFFICE_AGENT_STATE_MAPPING.remote.meeting).toBe("working");
  });

  it("normalizes partial mappings against defaults", () => {
    const normalized = normalizeOfficeAgentStateMapping({
      local: {
        running: "idle",
      },
      remote: {
        meeting: "error",
      },
    });

    expect(normalized.local).toEqual({
      idle: "idle",
      running: "idle",
      error: "error",
    });
    expect(normalized.remote).toEqual({
      idle: "idle",
      working: "working",
      meeting: "error",
      error: "error",
    });
  });

  it("merges patch values without discarding untouched signals", () => {
    const merged = mergeOfficeAgentStateMapping(
      DEFAULT_OFFICE_AGENT_STATE_MAPPING,
      {
        local: { running: "idle" },
        remote: { working: "error" },
      },
    );

    expect(merged.local.idle).toBe("idle");
    expect(merged.local.running).toBe("idle");
    expect(merged.remote.working).toBe("error");
    expect(merged.remote.meeting).toBe("working");
  });

  it("resolves local signals from runtime status and run ids", () => {
    expect(
      resolveLocalOfficeStateSignal({
        status: "idle",
        runId: "run-1",
      }),
    ).toBe("running");
    expect(
      resolveLocalOfficeStateSignal({
        status: "error",
        runId: null,
      }),
    ).toBe("error");
  });

  it("uses the configured renderable status for local and remote states", () => {
    const mapping = mergeOfficeAgentStateMapping(
      DEFAULT_OFFICE_AGENT_STATE_MAPPING,
      {
        local: { running: "idle" },
        remote: { meeting: "error" },
      },
    );

    expect(
      resolveLocalOfficeRenderableStatus(
        {
          status: "running",
          runId: "run-2",
        },
        mapping,
      ),
    ).toBe("idle");
    expect(resolveRemoteOfficeRenderableStatus("meeting", mapping)).toBe("error");
  });
});
