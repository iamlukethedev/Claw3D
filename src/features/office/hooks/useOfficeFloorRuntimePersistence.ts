"use client";

import { useEffect, useRef } from "react";
import type { FloorId } from "@/lib/office/floors";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { StudioSettingsCoordinator } from "@/lib/studio/coordinator";

interface Params {
  activeFloorId: FloorId;
  gatewayUrl: string;
  status: GatewayStatus;
  gatewayError: string | null;
  settingsCoordinator: StudioSettingsCoordinator;
}

/**
 * Persists live gateway connection transitions into `officeFloors` settings.
 *
 * The key invariant: the patch is always written to the floor that *initiated*
 * the current gateway connection, not merely whichever floor happens to be
 * active at the time of the status update.  This prevents cross-floor
 * misattribution — e.g. switching from the OpenClaw floor to the Hermes floor
 * while still connected must NOT stamp the Hermes floor as connected to the
 * OpenClaw gateway URL.
 */
export function useOfficeFloorRuntimePersistence({
  activeFloorId,
  gatewayUrl,
  status,
  gatewayError,
  settingsCoordinator,
}: Params): void {
  // Captures which floor was active the moment this gateway URL was established.
  // Only refreshes when `gatewayUrl` itself changes, so in-flight status
  // transitions that arrive after the user has navigated to a different floor
  // still target the floor that owns the connection.
  const gatewayOwnerFloorIdRef = useRef<FloorId>(activeFloorId);
  useEffect(() => {
    gatewayOwnerFloorIdRef.current = activeFloorId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayUrl]); // intentionally excludes activeFloorId

  useEffect(() => {
    const key = gatewayUrl.trim();
    if (!key) return;

    const patch =
      status === "connected"
        ? {
            status: "connected" as const,
            gatewayUrl: key,
            lastKnownGoodAt: Date.now(),
            lastErrorCode: null,
            lastErrorMessage: null,
          }
        : status === "connecting"
          ? { status: "connecting" as const }
          : gatewayError
            ? {
                status: "error" as const,
                lastErrorCode: "GATEWAY_ERROR",
                lastErrorMessage: gatewayError,
              }
            : { status: "disconnected" as const };

    settingsCoordinator.schedulePatch(
      { officeFloors: { [gatewayOwnerFloorIdRef.current]: patch } },
      0,
    );
  }, [gatewayError, gatewayUrl, settingsCoordinator, status]);
}
