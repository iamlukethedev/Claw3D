import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { sanitizeStudioSettings, defaultStudioSettings } from "@/lib/studio/settings";
import { StudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { useOfficeFloorRuntimePersistence } from "@/features/office/hooks/useOfficeFloorRuntimePersistence";
import type { FloorId } from "@/lib/office/floors";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";

type HookParams = {
  activeFloorId: FloorId;
  gatewayUrl: string;
  status: GatewayStatus;
  gatewayError: string | null;
  settingsCoordinator: StudioSettingsCoordinator;
};

function makeCoordinator() {
  const createResponse = () => ({
    settings: sanitizeStudioSettings(defaultStudioSettings()),
  });
  const updateSettings = vi.fn(async () => createResponse());
  const fetchSettings = vi.fn(async () => createResponse());
  const coordinator = new StudioSettingsCoordinator({ fetchSettings, updateSettings }, 0);
  return { coordinator, updateSettings };
}

describe("useOfficeFloorRuntimePersistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the connecting status to the floor that was active when gatewayUrl was set", async () => {
    const { coordinator, updateSettings } = makeCoordinator();

    const { rerender } = renderHook<void, HookParams>(
      (props) => useOfficeFloorRuntimePersistence(props),
      {
        initialProps: {
          activeFloorId: "openclaw-ground" as FloorId,
          gatewayUrl: "ws://openclaw:18789",
          status: "connecting" as GatewayStatus,
          gatewayError: null,
          settingsCoordinator: coordinator,
        },
      },
    );

    await act(() => vi.runAllTimersAsync());
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        officeFloors: expect.objectContaining({
          "openclaw-ground": expect.objectContaining({ status: "connecting" }),
        }),
      }),
    );
  });

  it("does NOT misattribute the gateway to the new floor when the user switches floors mid-connection", async () => {
    // Regression: previously switching floors caused the old gateway URL / status
    // to be stamped onto the newly-selected floor because activeFloorId was in deps.
    const { coordinator, updateSettings } = makeCoordinator();

    const { rerender } = renderHook<void, HookParams>(
      (props) => useOfficeFloorRuntimePersistence(props),
      {
        initialProps: {
          activeFloorId: "openclaw-ground" as FloorId,
          gatewayUrl: "ws://openclaw:18789",
          status: "connected" as GatewayStatus,
          gatewayError: null,
          settingsCoordinator: coordinator,
        },
      },
    );

    await act(() => vi.runAllTimersAsync());
    updateSettings.mockClear();

    // User navigates to Hermes floor — gatewayUrl and status have NOT changed.
    rerender({
      activeFloorId: "hermes-first" as const,
      gatewayUrl: "ws://openclaw:18789",
      status: "connected" as const,
      gatewayError: null,
      settingsCoordinator: coordinator,
    });

    await act(() => vi.runAllTimersAsync());

    // The persistence effect must NOT have fired again — no runtime change occurred.
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("updates the new floor only when the gateway URL itself changes after a floor switch", async () => {
    const { coordinator, updateSettings } = makeCoordinator();

    const { rerender } = renderHook<void, HookParams>(
      (props) => useOfficeFloorRuntimePersistence(props),
      {
        initialProps: {
          activeFloorId: "openclaw-ground" as FloorId,
          gatewayUrl: "ws://openclaw:18789",
          status: "connected" as GatewayStatus,
          gatewayError: null,
          settingsCoordinator: coordinator,
        },
      },
    );

    await act(() => vi.runAllTimersAsync());
    updateSettings.mockClear();

    // User switches to Hermes floor and then connects to the Hermes gateway.
    rerender({
      activeFloorId: "hermes-first" as const,
      gatewayUrl: "ws://hermes:7770",
      status: "connecting" as const,
      gatewayError: null,
      settingsCoordinator: coordinator,
    });

    await act(() => vi.runAllTimersAsync());

    // The patch should target hermes-first, not openclaw-ground.
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        officeFloors: expect.objectContaining({
          "hermes-first": expect.objectContaining({ status: "connecting" }),
        }),
      }),
    );
    expect(updateSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({
        officeFloors: expect.objectContaining({
          "openclaw-ground": expect.anything(),
        }),
      }),
    );
  });

  it("writes error state to the gateway-owning floor, not the current active floor", async () => {
    const { coordinator, updateSettings } = makeCoordinator();

    const { rerender } = renderHook<void, HookParams>(
      (props) => useOfficeFloorRuntimePersistence(props),
      {
        initialProps: {
          activeFloorId: "openclaw-ground" as FloorId,
          gatewayUrl: "ws://openclaw:18789",
          status: "connecting" as GatewayStatus,
          gatewayError: null,
          settingsCoordinator: coordinator,
        },
      },
    );

    await act(() => vi.runAllTimersAsync());
    updateSettings.mockClear();

    // User switches floors while the connection is still in flight.
    rerender({
      activeFloorId: "hermes-first" as const,
      gatewayUrl: "ws://openclaw:18789",
      status: "connecting" as const,
      gatewayError: null,
      settingsCoordinator: coordinator,
    });

    // Connection attempt fails — status + error update, but URL is unchanged.
    rerender({
      activeFloorId: "hermes-first" as const,
      gatewayUrl: "ws://openclaw:18789",
      status: "disconnected" as const,
      gatewayError: "ECONNREFUSED",
      settingsCoordinator: coordinator,
    });

    await act(() => vi.runAllTimersAsync());

    // Error must be stamped on openclaw-ground (which owns the URL), not hermes-first.
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        officeFloors: expect.objectContaining({
          "openclaw-ground": expect.objectContaining({
            status: "error",
            lastErrorMessage: "ECONNREFUSED",
          }),
        }),
      }),
    );
    expect(updateSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({
        officeFloors: expect.objectContaining({
          "hermes-first": expect.anything(),
        }),
      }),
    );
  });

  it("skips the patch entirely when gatewayUrl is empty", async () => {
    const { coordinator, updateSettings } = makeCoordinator();

    renderHook(() =>
      useOfficeFloorRuntimePersistence({
        activeFloorId: "lobby",
        gatewayUrl: "   ",
        status: "disconnected",
        gatewayError: null,
        settingsCoordinator: coordinator,
      }),
    );

    await act(() => vi.runAllTimersAsync());
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
