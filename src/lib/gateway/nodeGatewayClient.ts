import { createHash, randomUUID } from "node:crypto";
import { getPublicKeyAsync, signAsync, utils } from "@noble/ed25519";
import { GatewayResponseError } from "@/lib/gateway/errors";

type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
};

type GatewayEventFrame = {
  type: "event";
  event?: string;
  payload?: unknown;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const CONNECT_TIMEOUT_MS = 8_000;
const REQUEST_TIMEOUT_MS = 12_000;
const INITIAL_CONNECT_DELAY_MS = 750;
const GATEWAY_ROLE = "operator";
const GATEWAY_SCOPES = ["operator.admin", "operator.approvals", "operator.pairing"];
const GATEWAY_CLIENT_ID = "openclaw-control-ui";

const asRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const parseGatewayFrame = (raw: string): GatewayResponseFrame | GatewayEventFrame | null => {
  try {
    return JSON.parse(raw) as GatewayResponseFrame | GatewayEventFrame;
  } catch {
    return null;
  }
};

type DeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKey: Uint8Array;
};

const base64UrlEncode = (bytes: Uint8Array): string => {
  return Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
};

const fingerprintPublicKey = (publicKey: Uint8Array): string =>
  createHash("sha256").update(publicKey).digest("hex");

const buildDeviceAuthPayload = (params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce?: string | null;
  version?: "v1" | "v2";
}): string => {
  const version = params.version ?? (params.nonce ? "v2" : "v1");
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
  ];
  if (version === "v2") {
    base.push(params.nonce ?? "");
  }
  return base.join("|");
};

const createDeviceIdentity = async (): Promise<DeviceIdentity> => {
  const privateKey = utils.randomSecretKey();
  const publicKey = await getPublicKeyAsync(privateKey);
  return {
    deviceId: fingerprintPublicKey(publicKey),
    publicKey: base64UrlEncode(publicKey),
    privateKey,
  };
};

const buildConnectParams = async (params: {
  token: string;
  nonce: string | null;
  deviceIdentity: DeviceIdentity;
}) => {
  const signedAtMs = Date.now();
  const payload = buildDeviceAuthPayload({
    deviceId: params.deviceIdentity.deviceId,
    clientId: GATEWAY_CLIENT_ID,
    clientMode: "webchat",
    role: GATEWAY_ROLE,
    scopes: GATEWAY_SCOPES,
    signedAtMs,
    token: params.token || null,
    nonce: params.nonce,
  });
  const signature = await signAsync(new TextEncoder().encode(payload), params.deviceIdentity.privateKey);
  return {
  minProtocol: 3,
  maxProtocol: 3,
  client: {
    id: GATEWAY_CLIENT_ID,
    version: "dev",
    platform: process.platform,
    mode: "webchat",
  },
  role: GATEWAY_ROLE,
  scopes: GATEWAY_SCOPES,
  caps: [],
  device: {
    id: params.deviceIdentity.deviceId,
    publicKey: params.deviceIdentity.publicKey,
    signature: base64UrlEncode(signature),
    signedAt: signedAtMs,
    ...(params.nonce ? { nonce: params.nonce } : {}),
  },
  ...(params.token
    ? {
        auth: {
          token: params.token,
        },
      }
    : {}),
  userAgent: "node",
  locale: "en-US",
  };
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const buildAgentMainSessionKey = (agentId: string, mainKey: string) => {
  const trimmedAgent = agentId.trim();
  const trimmedKey = mainKey.trim() || "main";
  return `agent:${trimmedAgent}:${trimmedKey}`;
};

export class NodeGatewayClient {
  private socket: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private closed = false;
  private connectRequestIds = new Set<string>();
  private connectPromise: Promise<void> | null = null;
  private resolveConnect: (() => void) | null = null;
  private rejectConnect: ((error: Error) => void) | null = null;
  private connectNonce: string | null = null;
  private connectToken = "";
  private deviceIdentity: DeviceIdentity | null = null;
  private connectSent = false;
  private connectTimer: NodeJS.Timeout | null = null;

  async connect(params: { gatewayUrl: string; token?: string | null }) {
    const gatewayUrl = params.gatewayUrl.trim();
    if (!gatewayUrl) {
      throw new Error("Remote office gateway URL is not configured.");
    }
    if (this.socket) {
      throw new Error("Node gateway client is already connected.");
    }
    this.connectToken = params.token?.trim() ?? "";
    this.deviceIdentity = await createDeviceIdentity();

    const socket = new WebSocket(gatewayUrl);
    this.socket = socket;

    socket.addEventListener("message", (event) => {
      const raw =
        typeof event.data === "string"
          ? event.data
          : event.data instanceof ArrayBuffer
            ? new TextDecoder().decode(new Uint8Array(event.data))
            : String(event.data);
      const frame = parseGatewayFrame(raw);
      if (!frame) return;
      if (frame.type === "event") {
        if (frame.event === "connect.challenge") {
          const payload = asRecord(frame.payload) ? frame.payload : null;
          const nonce = typeof payload?.nonce === "string" ? payload.nonce.trim() : "";
          if (!nonce) {
            this.rejectConnectFlow(
              new Error("Remote gateway requested device authentication without a nonce."),
            );
            this.close();
            return;
          }
          this.connectNonce = nonce;
          if (this.connectTimer) {
            clearTimeout(this.connectTimer);
            this.connectTimer = null;
          }
          void this.sendConnectRequest();
        }
        return;
      }
      if (this.connectRequestIds.has(frame.id)) {
        this.connectRequestIds.delete(frame.id);
        if (frame.ok) {
          this.resolveConnect?.();
          this.clearConnectFlow();
          return;
        }
        if (asRecord(frame.error) && typeof frame.error.code === "string") {
          this.rejectConnectFlow(
            new GatewayResponseError({
              code: frame.error.code,
              message:
                typeof frame.error.message === "string"
                  ? frame.error.message
                  : "Gateway connect failed.",
              details: frame.error.details,
              retryable:
                typeof frame.error.retryable === "boolean" ? frame.error.retryable : undefined,
              retryAfterMs:
                typeof frame.error.retryAfterMs === "number"
                  ? frame.error.retryAfterMs
                  : undefined,
            }),
          );
          return;
        }
        this.rejectConnectFlow(new Error("Gateway connect failed."));
        return;
      }
      const pending = this.pending.get(frame.id);
      if (!pending) return;
      this.pending.delete(frame.id);
      if (frame.ok) {
        pending.resolve(frame.payload);
        return;
      }
      if (asRecord(frame.error) && typeof frame.error.code === "string") {
        pending.reject(
          new GatewayResponseError({
            code: frame.error.code,
            message:
              typeof frame.error.message === "string"
                ? frame.error.message
                : "Gateway request failed.",
            details: frame.error.details,
            retryable:
              typeof frame.error.retryable === "boolean" ? frame.error.retryable : undefined,
            retryAfterMs:
              typeof frame.error.retryAfterMs === "number"
                ? frame.error.retryAfterMs
                : undefined,
          }),
        );
        return;
      }
      pending.reject(new Error("Gateway request failed."));
    });

    socket.addEventListener("close", (event) => {
      this.closed = true;
      const reason = typeof event.reason === "string" ? event.reason : "";
      this.rejectAllPending(
        new Error(
          `Remote gateway connection closed${reason.trim() ? `: ${reason}` : "."}`,
        ),
      );
      if (this.socket === socket) {
        this.socket = null;
      }
      this.clearConnectFlow();
    });

    socket.addEventListener("error", () => {
      const error = new Error("Remote gateway connection failed.");
      this.rejectConnectFlow(error);
      this.rejectAllPending(error);
    });

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const handleOpen = () => {
          socket.removeEventListener("open", handleOpen);
          socket.removeEventListener("error", handleError);
          resolve();
        };
        const handleError = () => {
          socket.removeEventListener("open", handleOpen);
          socket.removeEventListener("error", handleError);
          reject(new Error("Remote gateway connection failed."));
        };
        socket.addEventListener("open", handleOpen, { once: true });
        socket.addEventListener("error", handleError, { once: true });
      }),
      CONNECT_TIMEOUT_MS,
      "Timed out connecting to the remote gateway.",
    );

    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.resolveConnect = resolve;
      this.rejectConnect = reject;
    });
    this.queueConnect();
    await withTimeout(
      this.connectPromise,
      REQUEST_TIMEOUT_MS,
      "Remote gateway connect handshake timed out.",
    );
  }

  async request<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.closed) {
      throw new Error("Remote gateway is not connected.");
    }
    const id = randomUUID();
    const response = withTimeout(
      new Promise<unknown>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        try {
          this.socket?.send(JSON.stringify({ type: "req", id, method, params }));
        } catch (error) {
          this.pending.delete(id);
          reject(error instanceof Error ? error : new Error("Failed to send gateway request."));
        }
      }),
      REQUEST_TIMEOUT_MS,
      `Remote gateway request timed out for ${method}.`,
    ) as Promise<T>;
    return response;
  }

  close() {
    this.closed = true;
    this.rejectAllPending(new Error("Remote gateway client closed."));
    if (this.socket) {
      try {
        this.socket.close();
      } finally {
        this.socket = null;
      }
    }
  }

  private rejectAllPending(error: Error) {
    const entries = [...this.pending.values()];
    this.pending.clear();
    for (const pending of entries) {
      pending.reject(error);
    }
  }

  private queueConnect() {
    this.connectSent = false;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
    }
    this.connectTimer = setTimeout(() => {
      void this.sendConnectRequest();
    }, INITIAL_CONNECT_DELAY_MS);
  }

  private async sendConnectRequest() {
    if (
      this.connectSent ||
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN ||
      !this.deviceIdentity
    ) {
      throw new Error("Remote gateway is not connected.");
    }
    this.connectSent = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    const id = randomUUID();
    this.connectRequestIds.add(id);
    const params = await buildConnectParams({
      token: this.connectToken,
      nonce: this.connectNonce,
      deviceIdentity: this.deviceIdentity,
    });
    this.socket.send(JSON.stringify({ type: "req", id, method: "connect", params }));
  }

  private rejectConnectFlow(error: Error) {
    this.rejectConnect?.(error);
    this.clearConnectFlow();
  }

  private clearConnectFlow() {
    this.connectRequestIds.clear();
    this.connectPromise = null;
    this.resolveConnect = null;
    this.rejectConnect = null;
    this.connectSent = false;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }
}
