import { Suspense } from "react";
import { AgentStoreProvider } from "@/features/agents/state/store";
import { OfficeScreen } from "@/features/office/screens/OfficeScreen";

const ENABLED_RE = /^(1|true|yes|on)$/i;

const readDebugFlag = (value: string | undefined): boolean => {
  const normalized = (value ?? "").trim();
  if (!normalized) return true;
  return ENABLED_RE.test(normalized);
};

function OfficeLoadingFallback() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-background"
      aria-label="Loading office"
      role="status"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
          Loading…
        </p>
      </div>
    </div>
  );
}

export default function OfficePage() {
  const showOpenClawConsole = readDebugFlag(process.env.DEBUG);

  return (
    <AgentStoreProvider>
      <Suspense fallback={<OfficeLoadingFallback />}>
        <OfficeScreen showOpenClawConsole={showOpenClawConsole} />
      </Suspense>
    </AgentStoreProvider>
  );
}
