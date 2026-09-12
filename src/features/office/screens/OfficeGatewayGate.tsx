"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { RunningAvatarLoader } from "@/features/agents/components/RunningAvatarLoader";
import { useRuntimeConnection } from "@/lib/runtime/useRuntimeConnection";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";

const OfficeScreen = dynamic(
  () =>
    import("@/features/office/screens/OfficeScreen").then((mod) => ({
      default: mod.OfficeScreen,
    })),
  { ssr: false },
);

type OfficeGatewayGateProps = {
  showOpenClawConsole?: boolean;
};

export function OfficeGatewayGate({
  showOpenClawConsole = true,
}: OfficeGatewayGateProps) {
  const [settingsCoordinator] = useState(() =>
    createStudioSettingsCoordinator(),
  );
  const runtime = useRuntimeConnection(settingsCoordinator);
  const {
    status,
    connectPromptReady,
    shouldPromptForConnect,
    gatewayUrl,
    token,
    selectedAdapterType,
    activeAdapterType,
    localGatewayDefaults,
    error: gatewayError,
    connect,
    useLocalGatewayDefaults,
    setGatewayUrl,
    setToken,
    setSelectedAdapterType,
  } = runtime;

  if (status !== "connected") {
    return (
      <main className="relative h-full w-full overflow-hidden bg-black">
        <div
          className="flex h-full w-full items-center justify-center bg-[#120a05]/76 px-4 py-10"
          aria-label={
            shouldPromptForConnect
              ? "Connect to runtime"
              : "Connecting to runtime"
          }
          role="status"
        >
          {connectPromptReady && shouldPromptForConnect ? (
            <div className="w-full max-w-[860px] rounded-2xl border border-amber-900/55 bg-[#120a05]/98 p-3 shadow-2xl">
              <GatewayConnectScreen
                gatewayUrl={gatewayUrl}
                token={token}
                selectedAdapterType={selectedAdapterType}
                activeAdapterType={activeAdapterType}
                localGatewayDefaults={localGatewayDefaults}
                status={status}
                error={gatewayError}
                showApprovalHint={Boolean(gatewayError)}
                onGatewayUrlChange={setGatewayUrl}
                onTokenChange={setToken}
                onAdapterTypeChange={setSelectedAdapterType}
                onUseLocalDefaults={useLocalGatewayDefaults}
                onConnect={() => void connect()}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-amber-700/45 bg-[#1a1008] px-8 py-6 shadow-2xl">
              <RunningAvatarLoader
                size={28}
                trackWidth={76}
                label="Connecting to your runtime..."
                labelClassName="text-amber-100/80"
              />
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <OfficeScreen
      showOpenClawConsole={showOpenClawConsole}
      settingsCoordinator={settingsCoordinator}
      runtime={runtime}
    />
  );
}
