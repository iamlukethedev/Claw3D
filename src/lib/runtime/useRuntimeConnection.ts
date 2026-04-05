"use client";

import { useMemo } from "react";

import { type GatewayConnectionState, useGatewayConnection } from "@/lib/gateway/GatewayClient";
import { createRuntimeProvider } from "@/lib/runtime/createRuntimeProvider";
import {
  hasRuntimeCapability,
  type RuntimeCapability,
  type RuntimeProvider,
} from "@/lib/runtime/types";
import type { StudioSettingsCoordinator } from "@/lib/studio/coordinator";

export type RuntimeConnectionState = GatewayConnectionState & {
  provider: RuntimeProvider;
  providerId: RuntimeProvider["id"];
  providerLabel: string;
  providerMetadata: RuntimeProvider["metadata"];
  capabilities: ReadonlySet<RuntimeCapability>;
  supportsCapability: (capability: RuntimeCapability) => boolean;
};

export const useRuntimeConnection = (
  settingsCoordinator: StudioSettingsCoordinator
): RuntimeConnectionState => {
  const gateway = useGatewayConnection(settingsCoordinator);
  const provider = useMemo(
    () => createRuntimeProvider(gateway.activeAdapterType, gateway.client, gateway.gatewayUrl),
    [gateway.activeAdapterType, gateway.client, gateway.gatewayUrl]
  );
  const capabilities = provider.capabilities;

  return {
    ...gateway,
    provider,
    providerId: provider.id,
    providerLabel: provider.label,
    providerMetadata: provider.metadata,
    capabilities,
    supportsCapability: (capability) => hasRuntimeCapability(capabilities, capability),
  };
};
