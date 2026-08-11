"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { createMockAdapter, MOCK_SCENARIOS, type MockScenario } from "@claw3d/adapter-mock";
import { createNullAdapter } from "@claw3d/adapter-null";
import { createJarvisReadonlyBrowserAdapter } from "@claw3d/adapter-jarvis-readonly";
import type { VisualRuntimeAdapter } from "@claw3d/visual-contract";
import { INITIAL_VISUAL_STATE, visualReducer } from "@claw3d/visual-core";
import { createBrowserStoragePort } from "./browserStorage";
import { UpstreamOfficeBridge } from "./UpstreamOfficeBridge";

export interface VisualRuntimeControllerProps {
  configuredAdapter: "mock" | "null" | "jarvis-readonly";
  persistenceEnabled: boolean;
  configurationReason?: string;
}

export function VisualRuntimeController({
  configuredAdapter,
  persistenceEnabled,
  configurationReason,
}: VisualRuntimeControllerProps) {
  const storage = useMemo(() => createBrowserStoragePort(persistenceEnabled), [persistenceEnabled]);
  const savedScenario = storage.get("mock.scenario") as MockScenario | null;
  const [scenario, setScenario] = useState<MockScenario>(
    savedScenario && MOCK_SCENARIOS.includes(savedScenario) ? savedScenario : "multiple",
  );
  const [reload, setReload] = useState(0);
  const [state, dispatch] = useReducer(visualReducer, INITIAL_VISUAL_STATE);

  const adapter = useMemo<VisualRuntimeAdapter>(() => {
    void reload;
    if (configuredAdapter === "mock") return createMockAdapter(scenario);
    if (configuredAdapter === "jarvis-readonly") return createJarvisReadonlyBrowserAdapter();
    return createNullAdapter();
  }, [configuredAdapter, scenario, reload]);

  useEffect(() => {
    const controller = new AbortController();
    let stop: () => void = () => undefined;
    dispatch({ type: "load.started" });
    void adapter.query.getSnapshot(controller.signal).then(
      (snapshot) => {
        if (controller.signal.aborted) return;
        dispatch({ type: "snapshot.received", snapshot });
        stop = adapter.events.subscribe(
          { lastEventId: snapshot.history.at(-1)?.eventId, signal: controller.signal },
          (event) => dispatch({ type: "event.received", event }),
          (connection) => dispatch({ type: "connection.changed", connection }),
        );
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: "connection.changed",
          connection: { phase: "error", attempt: 0, label: error instanceof Error ? error.message : "Snapshot failed" },
        });
      },
    );
    return () => {
      controller.abort();
      stop();
    };
  }, [adapter]);

  const changeScenario = useCallback((value: string) => {
    if (!MOCK_SCENARIOS.includes(value as MockScenario)) return;
    const next = value as MockScenario;
    setScenario(next);
    storage.set("mock.scenario", next);
  }, [storage]);

  const clearPreferences = useCallback(() => {
    storage.clearNamespace();
    setScenario("multiple");
  }, [storage]);

  const adapterLabel = `${adapter.id}${configurationReason ? ` · ${configurationReason}` : ""}`;

  return (
    <UpstreamOfficeBridge
      snapshot={state.snapshot}
      connection={state.connection}
      adapterLabel={adapterLabel}
      scenarios={configuredAdapter === "mock" ? MOCK_SCENARIOS : []}
      selectedScenario={scenario}
      persistenceEnabled={persistenceEnabled}
      onRetry={() => setReload((value) => value + 1)}
      onScenarioChange={changeScenario}
      onClearBrowserPreferences={clearPreferences}
    />
  );
}
