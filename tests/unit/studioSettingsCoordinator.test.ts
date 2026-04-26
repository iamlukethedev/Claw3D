import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultStudioSettings, sanitizeStudioSettings } from "@/lib/studio/settings";
import { StudioSettingsCoordinator } from "@/lib/studio/coordinator";

describe("StudioSettingsCoordinator", () => {
  const createResponse = () => ({
    settings: sanitizeStudioSettings(defaultStudioSettings()),
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces multiple scheduled patches into one update", async () => {
    const fetchSettings = vi.fn(async () => createResponse());
    const updateSettings = vi.fn(async () => createResponse());
    const coordinator = new StudioSettingsCoordinator({ fetchSettings, updateSettings }, 300);

    coordinator.schedulePatch({
      gateway: { url: "ws://localhost:18789", token: "abc" },
    });
    coordinator.schedulePatch({
      focused: {
        "ws://localhost:18789": {
          mode: "focused",
          filter: "running",
          selectedAgentId: null,
        },
      },
    });

    await vi.advanceTimersByTimeAsync(300);

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      gateway: { url: "ws://localhost:18789", token: "abc" },
      focused: {
        "ws://localhost:18789": {
          mode: "focused",
          filter: "running",
          selectedAgentId: null,
        },
      },
    });

    coordinator.dispose();
  });

  it("merges queued gateway patches field-by-field before flushing", async () => {
    const fetchSettings = vi.fn(async () => createResponse());
    const updateSettings = vi.fn(async () => createResponse());
    const coordinator = new StudioSettingsCoordinator({ fetchSettings, updateSettings }, 300);

    coordinator.schedulePatch(
      {
        gateway: {
          lastKnownGood: {
            url: "ws://localhost:18789",
            token: undefined,
            adapterType: "openclaw",
          },
        },
      },
      300,
    );
    coordinator.schedulePatch(
      {
        gateway: {
          url: "http://localhost:7770",
          adapterType: "local",
          profiles: {
            local: {
              url: "http://localhost:7770",
              token: undefined,
            },
          },
        },
      },
      300,
    );

    await vi.advanceTimersByTimeAsync(300);

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      gateway: {
        url: "http://localhost:7770",
        adapterType: "local",
        profiles: {
          local: {
            url: "http://localhost:7770",
            token: undefined,
          },
        },
        lastKnownGood: {
          url: "ws://localhost:18789",
          token: undefined,
          adapterType: "openclaw",
        },
      },
    });

    coordinator.dispose();
  });

  it("merges queued gateway profile and last-known-good subpatches", async () => {
    const fetchSettings = vi.fn(async () => createResponse());
    const updateSettings = vi.fn(async () => createResponse());
    const coordinator = new StudioSettingsCoordinator({ fetchSettings, updateSettings }, 300);

    coordinator.schedulePatch({
      gateway: {
        profiles: {
          hermes: {
            url: "ws://localhost:18888",
            token: undefined,
          },
        },
        lastKnownGood: {
          url: "ws://localhost:18789",
          token: "stored-token",
        },
      },
    });
    coordinator.schedulePatch({
      gateway: {
        profiles: {
          hermes: {
            token: "new-token",
          },
        },
        lastKnownGood: {
          adapterType: "openclaw",
        },
      },
    });

    await vi.advanceTimersByTimeAsync(300);

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      gateway: {
        profiles: {
          hermes: {
            url: "ws://localhost:18888",
            token: "new-token",
          },
        },
        lastKnownGood: {
          url: "ws://localhost:18789",
          token: "stored-token",
          adapterType: "openclaw",
        },
      },
    });

    coordinator.dispose();
  });

  it("flushPending persists queued patch immediately", async () => {
    const fetchSettings = vi.fn(async () => createResponse());
    const updateSettings = vi.fn(async () => createResponse());
    const coordinator = new StudioSettingsCoordinator({ fetchSettings, updateSettings }, 1000);

    coordinator.schedulePatch({
      gateway: { url: "ws://localhost:18789", token: "session-a" },
    });

    await coordinator.flushPending();

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      gateway: { url: "ws://localhost:18789", token: "session-a" },
    });

    await vi.advanceTimersByTimeAsync(2000);
    expect(updateSettings).toHaveBeenCalledTimes(1);

    coordinator.dispose();
  });

  it("dispose clears pending timer without writing", async () => {
    const fetchSettings = vi.fn(async () => createResponse());
    const updateSettings = vi.fn(async () => createResponse());
    const coordinator = new StudioSettingsCoordinator({ fetchSettings, updateSettings }, 200);

    coordinator.schedulePatch({
      focused: {
        "ws://localhost:18789": {
          mode: "focused",
          filter: "approvals",
          selectedAgentId: null,
        },
      },
    });
    coordinator.dispose();

    await vi.advanceTimersByTimeAsync(500);

    expect(updateSettings).not.toHaveBeenCalled();
  });
});
