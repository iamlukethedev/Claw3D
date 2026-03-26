"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GatewayBrowserClient,
  clearGatewayBrowserSessionStorage,
  type GatewayHelloOk,
} from "./openclaw/GatewayBrowserClient";
import type {
  StudioGatewaySettings,
  StudioSettings,
  StudioSettingsPatch,
  StudioSettingsPublic,
} from "@/lib/studio/settings";
import type {
  StudioSettingsLoadOptions,
  StudioSettingsResponse,
} from "@/lib/studio/coordinator";
import { resolveStudioProxyGatewayUrl } from "@/lib/gateway/proxy-url";
import { ensureGatewayReloadModeHotForLocalStudio } from "@/lib/gateway/gatewayReloadMode";
import { GatewayResponseError } from "@/lib/gateway/errors";

export type ReqFrame = {
  type: "req";
  id: string;
  method: string;
  params: unknown;
};

export type ResFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
};

export type GatewayStateVersion = {
  presence: number;
  health: number;
};

export type EventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: GatewayStateVersion;
};

export type GatewayFrame = ReqFrame | ResFrame | EventFrame;

export const parseGatewayFrame = (raw: string): GatewayFrame | null => {
  try {
    return JSON.parse(raw) as GatewayFrame;
  } catch {
    return null;
  }
};

export const buildAgentMainSessionKey = (agentId: string, mainKey: string) => {
  const trimmedAgent = agentId.trim();
  const trimmedKey = mainKey.trim() || "main";
  return `agent:${trimmedAgent}:${trimmedKey}`;
};

export const parseAgentIdFromSessionKey = (sessionKey: string): string | null => {
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : null;
};

export const isSameSessionKey = (a: string, b: string) => {
  const left = a.trim();
  const right = b.trim();
  return left.length > 0 && left === right;
};

const CONNECT_FAILED_CLOSE_CODE = 4008;
const GATEWAY_CONNECT_TIMEOUT_MS = 8_000;

const parseConnectFailedCloseReason = (
  reason: string
): { code: string; message: string } | null => {
  const trimmed = reason.trim();
  if (!trimmed.toLowerCase().startsWith("connect failed:")) return null;
  const remainder = trimmed.slice("connect failed:".length).trim();
  if (!remainder) return null;
  const idx = remainder.indexOf(" ");
  const code = (idx === -1 ? remainder : remainder.slice(0, idx)).trim();
  if (!code) return null;
  const message = (idx === -1 ? "" : remainder.slice(idx + 1)).trim();
  return { code, message: message || "connect failed" };
};

const DEFAULT_UPSTREAM_GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || "ws://localhost:18789";

const normalizeLocalGatewayDefaults = (value: unknown): StudioGatewaySettings | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as { url?: unknown; token?: unknown; tokenConfigured?: unknown };
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!url) return null;
  // Accept both full settings ({ url, token }) and the sanitized public
  // form ({ url, tokenConfigured }) returned by /api/studio.  When only
  // tokenConfigured is present the actual token isn't available on the
  // client — leave it empty so the connection dialog can prompt if needed.
  const token = typeof raw.token === "string" ? raw.token.trim() : "";
  return { url, token };
};

type StatusHandler = (status: GatewayStatus) => void;

type EventHandler = (event: EventFrame) => void;

export type GatewayGapInfo = { expected: number; received: number };

type GapHandler = (info: GatewayGapInfo) => void;

export type GatewayStatus = "disconnected" | "connecting" | "connected";

export type GatewayConnectOptions = {
  gatewayUrl: string;
  token?: string;
  authScopeKey?: string;
  clientName?: string;
  disableDeviceAuth?: boolean;
};

export { GatewayResponseError } from "@/lib/gateway/errors";
export type { GatewayErrorPayload } from "@/lib/gateway/errors";

export class GatewayClient {
  private client: GatewayBrowserClient | null = null;
  private statusHandlers = new Set<StatusHandler>();
  private eventHandlers = new Set<EventHandler>();
  private gapHandlers = new Set<GapHandler>();
  private status: GatewayStatus = "disconnected";
  private pendingConnect: Promise<void> | null = null;
  private resolveConnect: (() => void) | null = null;
  private rejectConnect: ((error: Error) => void) | null = null;
  private manualDisconnect = false;
  private lastHello: GatewayHelloOk | null = null;

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  onEvent(handler: EventHandler) {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  onGap(handler: GapHandler) {
    this.gapHandlers.add(handler);
    return () => {
      this.gapHandlers.delete(handler);
    };
  }

  async connect(options: GatewayConnectOptions) {
    if (!options.gatewayUrl.trim()) {
      throw new Error("Gateway URL is required.");
    }
    if (this.client) {
      throw new Error("Gateway is already connected or connecting.");
    }

    this.manualDisconnect = false;
    this.updateStatus("connecting");

    this.pendingConnect = new Promise<void>((resolve, reject) => {
      this.resolveConnect = resolve;
      this.rejectConnect = reject;
    });

    const nextClient = new GatewayBrowserClient({
      url: options.gatewayUrl,
      token: options.token,
      authScopeKey: options.authScopeKey,
      clientName: options.clientName,
      disableDeviceAuth: options.disableDeviceAuth,
      onHello: (hello) => {
        if (this.client !== nextClient) return;
        this.lastHello = hello;
        this.updateStatus("connected");
        this.resolveConnect?.();
        this.clearConnectPromise();
      },
      onEvent: (event) => {
        if (this.client !== nextClient) return;
        this.eventHandlers.forEach((handler) => handler(event));
      },
      onClose: ({ code, reason }) => {
        if (this.client !== nextClient) return;
        const connectFailed =
          code === CONNECT_FAILED_CLOSE_CODE ? parseConnectFailedCloseReason(reason) : null;
        const err = connectFailed
          ? new GatewayResponseError({
              code: connectFailed.code,
              message: connectFailed.message,
            })
          : new Error(`Gateway closed (${code}): ${reason}`);
        if (this.rejectConnect) {
          this.rejectConnect(err);
          this.clearConnectPromise();
        }
        if (!this.manualDisconnect) {
          nextClient.stop();
        }
        if (this.client === nextClient) {
          this.client = null;
        }
        this.updateStatus("disconnected");
        if (this.manualDisconnect) {
          console.info("Gateway disconnected.");
        }
      },
      onGap: ({ expected, received }) => {
        if (this.client !== nextClient) return;
        this.gapHandlers.forEach((handler) => handler({ expected, received }));
      },
    });

    this.client = nextClient;
    nextClient.start();

    let connectTimeoutId: number | null = null;
    try {
      await Promise.race([
        this.pendingConnect,
        new Promise<never>((_, reject) => {
          connectTimeoutId = window.setTimeout(() => {
            reject(
              new Error(
                "Timed out connecting to the gateway. Check that it is running, or change the gateway address and try again."
              )
            );
          }, GATEWAY_CONNECT_TIMEOUT_MS);
        }),
      ]);
    } catch (err) {
      const activeClient = this.client;
      this.clearConnectPromise();
      activeClient?.stop();
      if (this.client === activeClient) {
        this.client = null;
      }
      this.updateStatus("disconnected");
      throw err;
    } finally {
      if (connectTimeoutId !== null) {
        window.clearTimeout(connectTimeoutId);
      }
    }
  }

  disconnect() {
    if (!this.client) {
      return;
    }

    this.manualDisconnect = true;
    this.client.stop();
    this.client = null;
    this.clearConnectPromise();
    this.updateStatus("disconnected");
    console.info("Gateway disconnected.");
  }

  async call<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!method.trim()) {
      throw new Error("Gateway method is required.");
    }
    if (!this.client || !this.client.connected) {
      throw new Error("Gateway is not connected.");
    }

    const payload = await this.client.request<T>(method, params);
    return payload as T;
  }

  getLastHello() {
    return this.lastHello;
  }

  private updateStatus(status: GatewayStatus) {
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private clearConnectPromise() {
    this.pendingConnect = null;
    this.resolveConnect = null;
    this.rejectConnect = null;
  }
}

export const isGatewayDisconnectLikeError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (!msg) return false;
  if (
    msg.includes("gateway not connected") ||
    msg.includes("gateway is not connected") ||
    msg.includes("gateway client stopped")
  ) {
    return true;
  }

  const match = msg.match(/gateway closed \\((\\d+)\\)/);
  if (!match) return false;
  const code = Number(match[1]);
  return Number.isFinite(code) && code === 1012;
};

const WEBCHAT_SESSION_MUTATION_BLOCKED_RE = /webchat clients cannot (patch|delete) sessions/i;
const WEBCHAT_SESSION_MUTATION_HINT_RE = /use chat\.send for session-scoped updates/i;

export const isWebchatSessionMutationBlockedError = (error: unknown): boolean => {
  if (!(error instanceof GatewayResponseError)) return false;
  if (error.code.trim().toUpperCase() !== "INVALID_REQUEST") return false;
  const message = error.message.trim();
  if (!message) return false;
  return (
    WEBCHAT_SESSION_MUTATION_BLOCKED_RE.test(message) &&
    WEBCHAT_SESSION_MUTATION_HINT_RE.test(message)
  );
};

type SessionSettingsPatchPayload = {
  key: string;
  model?: string | null;
  thinkingLevel?: string | null;
  execHost?: "sandbox" | "gateway" | "node" | null;
  execSecurity?: "deny" | "allowlist" | "full" | null;
  execAsk?: "off" | "on-miss" | "always" | null;
};

export type GatewaySessionsPatchResult = {
  ok: true;
  key: string;
  entry?: {
    thinkingLevel?: string;
  };
  resolved?: {
    modelProvider?: string;
    model?: string;
  };
};

export type SyncGatewaySessionSettingsParams = {
  client: GatewayClient;
  sessionKey: string;
  model?: string | null;
  thinkingLevel?: string | null;
  execHost?: "sandbox" | "gateway" | "node" | null;
  execSecurity?: "deny" | "allowlist" | "full" | null;
  execAsk?: "off" | "on-miss" | "always" | null;
};

export const syncGatewaySessionSettings = async ({
  client,
  sessionKey,
  model,
  thinkingLevel,
  execHost,
  execSecurity,
  execAsk,
}: SyncGatewaySessionSettingsParams) => {
  const key = sessionKey.trim();
  if (!key) {
    throw new Error("Session key is required.");
  }
  const includeModel = model !== undefined;
  const includeThinkingLevel = thinkingLevel !== undefined;
  const includeExecHost = execHost !== undefined;
  const includeExecSecurity = execSecurity !== undefined;
  const includeExecAsk = execAsk !== undefined;
  if (
    !includeModel &&
    !includeThinkingLevel &&
    !includeExecHost &&
    !includeExecSecurity &&
    !includeExecAsk
  ) {
    throw new Error("At least one session setting must be provided.");
  }
  const payload: SessionSettingsPatchPayload = { key };
  if (includeModel) {
    payload.model = model ?? null;
  }
  if (includeThinkingLevel) {
    payload.thinkingLevel = thinkingLevel ?? null;
  }
  if (includeExecHost) {
    payload.execHost = execHost ?? null;
  }
  if (includeExecSecurity) {
    payload.execSecurity = execSecurity ?? null;
  }
  if (includeExecAsk) {
    payload.execAsk = execAsk ?? null;
  }
  return await client.call<GatewaySessionsPatchResult>("sessions.patch", payload);
};

const doctorFixHint =
  "Run `npx openclaw doctor --fix` on the gateway host (or `pnpm openclaw doctor --fix` in a source checkout).";

const formatGatewayError = (error: unknown) => {
  if (error instanceof GatewayResponseError) {
    if (error.code === "INVALID_REQUEST" && /invalid config/i.test(error.message)) {
      return `Gateway error (${error.code}): ${error.message}. ${doctorFixHint}`;
    }
    return `Gateway error (${error.code}): ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown gateway error.";
};

export type GatewayConnectionState = {
  client: GatewayClient;
  status: GatewayStatus;
  gatewayUrl: string;
  token: string;
  localGatewayDefaults: StudioGatewaySettings | null;
  error: string | null;
  connectPromptReady: boolean;
  shouldPromptForConnect: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  useLocalGatewayDefaults: () => void;
  setGatewayUrl: (value: string) => void;
  setToken: (value: string) => void;
  clearError: () => void;
};

type StudioSettingsCoordinatorLike = {
  loadSettings: (
    options?: StudioSettingsLoadOptions,
  ) => Promise<StudioSettings | StudioSettingsPublic | null>;
  loadSettingsEnvelope?: (
    options?: StudioSettingsLoadOptions,
  ) => Promise<StudioSettingsResponse>;
  schedulePatch: (patch: StudioSettingsPatch, debounceMs?: number) => void;
  flushPending: () => Promise<void>;
};

const isAuthError = (errorMessage: string | null): boolean => {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("auth") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("invalid token") ||
    lower.includes("token required") ||
    (lower.includes("token") && lower.includes("not configured")) ||
    lower.includes("gateway_token_missing")
  );
};

const MAX_AUTO_RETRY_ATTEMPTS = 20;
const INITIAL_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_DELAY_MS = 30_000;

const NON_RETRYABLE_CONNECT_ERROR_CODES = new Set([
  "studio.gateway_url_missing",
  "studio.gateway_token_missing",
  "studio.gateway_url_invalid",
  "studio.settings_load_failed",
  "studio.upstream_error",
]);

const isNonRetryableConnectErrorCode = (code: string | null): boolean => {
  const normalized = code?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  return NON_RETRYABLE_CONNECT_ERROR_CODES.has(normalized);
};

export const resolveGatewayAutoRetryDelayMs = (params: {
  status: GatewayStatus;
  didAutoConnect: boolean;
  hasConnectedOnce: boolean;
  wasManualDisconnect: boolean;
  gatewayUrl: string;
  errorMessage: string | null;
  connectErrorCode: string | null;
  attempt: number;
}): number | null => {
  if (params.status !== "disconnected") return null;
  if (!params.didAutoConnect) return null;
  if (!params.hasConnectedOnce) return null;
  if (params.wasManualDisconnect) return null;
  if (!params.gatewayUrl.trim()) return null;
  if (params.attempt >= MAX_AUTO_RETRY_ATTEMPTS) return null;
  if (isNonRetryableConnectErrorCode(params.connectErrorCode)) return null;
  if (params.connectErrorCode === null && isAuthError(params.errorMessage)) return null;

  return Math.min(
    INITIAL_RETRY_DELAY_MS * Math.pow(1.5, params.attempt),
    MAX_RETRY_DELAY_MS
  );
};

export const useGatewayConnection = (
  settingsCoordinator: StudioSettingsCoordinatorLike
): GatewayConnectionState => {
  const [client] = useState(() => new GatewayClient());
  const didAutoConnect = useRef(false);
  const hasConnectedOnceRef = useRef(false);
  const loadedGatewaySettings = useRef<{ gatewayUrl: string; token: string } | null>(null);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasManualDisconnectRef = useRef(false);

  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_UPSTREAM_GATEWAY_URL);
  const [token, setToken] = useState("");
  const [localGatewayDefaults, setLocalGatewayDefaults] = useState<StudioGatewaySettings | null>(
    null
  );
  const [status, setStatus] = useState<GatewayStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [connectErrorCode, setConnectErrorCode] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const envelope =
          typeof settingsCoordinator.loadSettingsEnvelope === "function"
            ? await settingsCoordinator.loadSettingsEnvelope({ force: true })
            : {
                settings: await settingsCoordinator.loadSettings({ force: true }),
                localGatewayDefaults: null,
              };
        const settings = envelope.settings ?? null;
        const gateway = settings?.gateway ?? null;
        if (cancelled) return;
        const normalizedDefaults = normalizeLocalGatewayDefaults(envelope.localGatewayDefaults);
        setLocalGatewayDefaults(normalizedDefaults);
        // When the user has no saved gateway URL, prefer the runtime
        // localGatewayDefaults (from openclaw.json / CLAW3D_GATEWAY_URL)
        // over the build-time NEXT_PUBLIC_GATEWAY_URL which may be stale
        // or empty if the operator forgot to rebuild after .env changes.
        const hasSavedUrl = Boolean(gateway?.url?.trim());
        const resolvedUrl = hasSavedUrl
          ? gateway!.url
          : normalizedDefaults?.url || DEFAULT_UPSTREAM_GATEWAY_URL;
        const nextGatewayUrl = resolvedUrl;
        const nextToken = hasSavedUrl
          ? (gateway && "token" in gateway && typeof gateway.token === "string"
              ? gateway.token
              : "")
          : normalizedDefaults?.token ?? "";
        loadedGatewaySettings.current = {
          gatewayUrl: nextGatewayUrl.trim(),
          token: nextToken,
        };
        setGatewayUrl(nextGatewayUrl);
        setToken(nextToken);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load gateway settings.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          if (!loadedGatewaySettings.current) {
            loadedGatewaySettings.current = {
              gatewayUrl: DEFAULT_UPSTREAM_GATEWAY_URL.trim(),
              token: "",
            };
          }
          setSettingsLoaded(true);
        }
      }
    };
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [settingsCoordinator]);

  useEffect(() => {
    return client.onStatus((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus !== "connecting") {
        setError(null);
        if (nextStatus === "connected") {
          setConnectErrorCode(null);
        }
      }
    });
  }, [client]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      client.disconnect();
    };
  }, [client]);

  const connect = useCallback(async () => {
    setError(null);
    setConnectErrorCode(null);
    wasManualDisconnectRef.current = false;
    try {
      await settingsCoordinator.flushPending();
      await client.connect({
        gatewayUrl: resolveStudioProxyGatewayUrl(),
        token,
        authScopeKey: gatewayUrl,
        clientName: "openclaw-control-ui",
      });
      await ensureGatewayReloadModeHotForLocalStudio({
        client,
        upstreamGatewayUrl: gatewayUrl,
      });
      retryAttemptRef.current = 0;
    } catch (err) {
      setConnectErrorCode(err instanceof GatewayResponseError ? err.code : null);
      setError(formatGatewayError(err));
    }
  }, [client, gatewayUrl, settingsCoordinator, token]);

  useEffect(() => {
    if (didAutoConnect.current) return;
    if (!settingsLoaded) return;
    if (!gatewayUrl.trim()) return;
    didAutoConnect.current = true;
    void connect();
  }, [connect, gatewayUrl, settingsLoaded]);

  // Auto-retry on disconnect (gateway busy, network blip, etc.)
  useEffect(() => {
    const attempt = retryAttemptRef.current;
    const delay = resolveGatewayAutoRetryDelayMs({
      status,
      didAutoConnect: didAutoConnect.current,
      hasConnectedOnce: hasConnectedOnceRef.current,
      wasManualDisconnect: wasManualDisconnectRef.current,
      gatewayUrl,
      errorMessage: error,
      connectErrorCode,
      attempt,
    });
    if (delay === null) return;
    retryTimerRef.current = setTimeout(() => {
      retryAttemptRef.current = attempt + 1;
      void connect();
    }, delay);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [connect, connectErrorCode, error, gatewayUrl, status]);

  // Reset retry count on successful connection
  useEffect(() => {
    if (status === "connected") {
      hasConnectedOnceRef.current = true;
      retryAttemptRef.current = 0;
    }
  }, [status]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const baseline = loadedGatewaySettings.current;
    if (!baseline) return;
    const nextGatewayUrl = gatewayUrl.trim();
    if (nextGatewayUrl === baseline.gatewayUrl && token === baseline.token) {
      return;
    }
    settingsCoordinator.schedulePatch(
      {
        gateway: {
          url: nextGatewayUrl,
          token,
        },
      },
      400
    );
  }, [gatewayUrl, settingsCoordinator, settingsLoaded, token]);

  const useLocalGatewayDefaults = useCallback(() => {
    if (!localGatewayDefaults) {
      return;
    }
    setGatewayUrl(localGatewayDefaults.url);
    setToken(localGatewayDefaults.token);
    setError(null);
    setConnectErrorCode(null);
  }, [localGatewayDefaults]);

  const disconnect = useCallback(() => {
    setError(null);
    setConnectErrorCode(null);
    wasManualDisconnectRef.current = true;
    client.disconnect();
    clearGatewayBrowserSessionStorage();
  }, [client]);

  const clearError = useCallback(() => {
    setError(null);
    setConnectErrorCode(null);
  }, []);

  const connectPromptReady = settingsLoaded;
  const shouldPromptForConnect =
    settingsLoaded &&
    status !== "connected" &&
    (!gatewayUrl.trim() || !token.trim() || wasManualDisconnectRef.current || Boolean(error));

  return {
    client,
    status,
    gatewayUrl,
    token,
    localGatewayDefaults,
    error,
    connectPromptReady,
    shouldPromptForConnect,
    connect,
    disconnect,
    useLocalGatewayDefaults,
    setGatewayUrl,
    setToken,
    clearError,
  };
};
