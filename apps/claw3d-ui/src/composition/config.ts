export type ConfiguredVisualAdapter = "mock" | "null" | "jarvis-readonly";

export interface VisualRuntimeConfig {
  requestedAdapter: string | undefined;
  adapter: ConfiguredVisualAdapter;
  connectorEnabled: boolean;
  persistenceEnabled: boolean;
  reason?: string;
}

function enabled(value: string | undefined): boolean {
  return value === "true";
}

function isServerOrigin(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const origin = new URL(value);
    return ["http:", "https:"].includes(origin.protocol)
      && !origin.username
      && !origin.password
      && origin.pathname === "/"
      && !origin.search
      && !origin.hash;
  } catch {
    return false;
  }
}

export function readVisualRuntimeConfig(environment: Record<string, string | undefined>): VisualRuntimeConfig {
  const requestedAdapter = environment.VISUAL_ADAPTER;
  const connectorEnabled = enabled(environment.JARVIS_CONNECTOR_ENABLED);
  const persistenceEnabled = enabled(environment.VISUAL_BROWSER_PERSISTENCE);

  if (requestedAdapter === "mock") {
    return { requestedAdapter, adapter: "mock", connectorEnabled, persistenceEnabled };
  }
  if (requestedAdapter === "null") {
    return { requestedAdapter, adapter: "null", connectorEnabled, persistenceEnabled };
  }
  if (requestedAdapter === "jarvis-readonly" && connectorEnabled && isServerOrigin(environment.JARVIS_ORIGIN)) {
    return { requestedAdapter, adapter: "jarvis-readonly", connectorEnabled, persistenceEnabled };
  }
  return {
    requestedAdapter,
    adapter: "null",
    connectorEnabled: false,
    persistenceEnabled,
    reason: requestedAdapter === "jarvis-readonly"
      ? connectorEnabled
        ? "Missing or invalid JARVIS_ORIGIN"
        : "Visual connector disabled by JARVIS_CONNECTOR_ENABLED"
      : "Missing or invalid VISUAL_ADAPTER",
  };
}
