import { GatewayResponseError } from "@/lib/gateway/errors";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isLocalGatewayUrl } from "@/lib/gateway/local-gateway";

type GatewayConfigSnapshot = {
  config?: Record<string, unknown>;
  hash?: string;
  exists?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const shouldRetryConfigWrite = (err: unknown) => {
  if (!(err instanceof GatewayResponseError)) return false;
  return /re-run config\.get|config changed since last load/i.test(err.message);
};

const resolveReloadModeFromConfig = (config: unknown): string | null => {
  if (!isRecord(config)) return null;
  const gateway = isRecord(config.gateway) ? config.gateway : null;
  const reload = gateway && isRecord(gateway.reload) ? gateway.reload : null;
  if (!reload || typeof reload.mode !== "string") return "hybrid";
  const mode = reload.mode.trim().toLowerCase();
  return mode.length > 0 ? mode : "hybrid";
};

export const shouldAwaitDisconnectRestartForReloadMode = (mode: string | null): boolean =>
  mode !== "hot" && mode !== "off" && mode !== "hybrid";

export async function shouldAwaitDisconnectRestartForRemoteMutation(params: {
  client: GatewayClient;
  cachedConfigSnapshot: { config?: unknown } | null;
  logError?: (message: string, error: unknown) => void;
}): Promise<boolean> {
  const cachedMode = resolveReloadModeFromConfig(params.cachedConfigSnapshot?.config);
  if (cachedMode) {
    return shouldAwaitDisconnectRestartForReloadMode(cachedMode);
  }
  try {
    const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
    const mode = resolveReloadModeFromConfig(snapshot.config);
    return shouldAwaitDisconnectRestartForReloadMode(mode);
  } catch (err) {
    params.logError?.(
      "Failed to determine gateway reload mode; defaulting to restart wait.",
      err
    );
    return true;
  }
}

export async function ensureGatewayReloadModeHotForLocalStudio(params: {
  client: GatewayClient;
  upstreamGatewayUrl: string;
}): Promise<void> {
  if (!isLocalGatewayUrl(params.upstreamGatewayUrl)) {
    return;
  }

  const attemptWrite = async (attempt: number): Promise<void> => {
    const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
    const exists = snapshot.exists !== false;
    const baseHash = exists ? snapshot.hash?.trim() : undefined;
    if (exists && !baseHash) {
      throw new Error("Gateway config hash unavailable; re-run config.get.");
    }

    const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
    const gateway = isRecord(baseConfig.gateway) ? baseConfig.gateway : {};
    const reload = isRecord(gateway.reload) ? gateway.reload : {};
    const mode = typeof reload.mode === "string" ? reload.mode.trim() : "";

    if (mode === "hot" || mode === "off") {
      return;
    }

    const nextConfig: Record<string, unknown> = {
      ...baseConfig,
      gateway: {
        ...gateway,
        reload: {
          ...reload,
          mode: "hot",
        },
      },
    };

    const payload: Record<string, unknown> = {
      raw: JSON.stringify(nextConfig, null, 2),
    };
    if (baseHash) {
      payload.baseHash = baseHash;
    }

    try {
      await params.client.call("config.set", payload);
    } catch (err) {
      if (attempt < 1 && shouldRetryConfigWrite(err)) {
        await attemptWrite(attempt + 1);
        return;
      }
      throw err;
    }
  };

  await attemptWrite(0);
}
