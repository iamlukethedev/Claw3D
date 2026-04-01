// Adapted from `openclaw/openclaw` `ui/src/ui/gateway.ts`.
// Source license: MIT. Last verified against OpenClaw 2026.2.12
// (`f9e444dd56ccfc2271e8ae1729b7a14a55e1c11e`).
// Update this file via `npm run sync:gateway-client -- /path/to/gateway.ts` and record
// provenance changes in `THIRD_PARTY_CODE.md` whenever the upstream source changes.
import { getPublicKeyAsync, signAsync, utils } from "@noble/ed25519";
import { GatewayResponseError } from "@/lib/gateway/errors";

const gatewayBrowserDebugEnabled =
  process.env.NODE_ENV !== "production";

const gatewayBrowserDebugLog = (
  message: string,
  details?: Record<string, unknown>
) => {
  if (!gatewayBrowserDebugEnabled) return;
  if (details) {
    console.info("[gateway-browser]", message, details);
    return;
  }
  console.info("[gateway-browser]", message);
};

const GATEWAY_CLIENT_NAMES = {
  CONTROL_UI: "openclaw-control-ui",
} as const;

const GATEWAY_CLIENT_MODES = {
  WEBCHAT: "webchat",
} as const;

type CryptoLike = {
  randomUUID?: (() => string) | undefined;
  getRandomValues?: ((array: Uint8Array) => Uint8Array) | undefined;
};

let warnedWeakCrypto = false;

function uuidFromBytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1

  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

function weakRandomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  const now = Date.now();
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[0] ^= now & 0xff;
  bytes[1] ^= (now >>> 8) & 0xff;
  bytes[2] ^= (now >>> 16) & 0xff;
  bytes[3] ^= (now >>> 24) & 0xff;
  return bytes;
}

function warnWeakCryptoOnce() {
  if (warnedWeakCrypto) return;
  warnedWeakCrypto = true;
  console.warn("[uuid] crypto API missing; falling back to weak randomness");
}

function generateUUID(cryptoLike: CryptoLike | null = globalThis.crypto): string {
  if (cryptoLike && typeof cryptoLike.randomUUID === "function") return cryptoLike.randomUUID();

  if (cryptoLike && typeof cryptoLike.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoLike.getRandomValues(bytes);
    return uuidFromBytes(bytes);
  }

  warnWeakCryptoOnce();
  return uuidFromBytes(weakRandomBytes());
}

type DeviceAuthPayloadParams = {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce?: string | null;
  version?: "v1" | "v2";
};

function buildDeviceAuthPayload(params: DeviceAuthPayloadParams): string {
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
}

type DeviceAuthEntry = {
  token: string;
  role: string;
  scopes: string[];
  updatedAtMs: number;
};

type DeviceAuthStore = {
  version: 1;
  deviceId: string;
  tokens: Record<string, DeviceAuthEntry>;
};

const DEVICE_AUTH_STORAGE_KEY = "openclaw.device.auth.v1";

function normalizeAuthScope(scope: string | undefined): string {
  const trimmed = scope?.trim();
  if (!trimmed) return "default";
  return trimmed.toLowerCase();
}

function buildScopedTokenKey(scope: string, role: string): string {
  return `${scope}::${role}`;
}

function normalizeRole(role: string): string {
  return role.trim();
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  if (!Array.isArray(scopes)) return [];
  const out = new Set<string>();
  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (trimmed) out.add(trimmed);
  }
  return [...out].sort();
}

function readDeviceAuthStore(): DeviceAuthStore | null {
  try {
    const raw = window.localStorage.getItem(DEVICE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceAuthStore;
    if (!parsed || parsed.version !== 1) return null;
    if (!parsed.deviceId || typeof parsed.deviceId !== "string") return null;
    if (!parsed.tokens || typeof parsed.tokens !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDeviceAuthStore(store: DeviceAuthStore) {
  try {
    window.localStorage.setItem(DEVICE_AUTH_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // best-effort
  }
}

function loadDeviceAuthToken(params: { deviceId: string; role: string; scope: string }): DeviceAuthEntry | null {
  const store = readDeviceAuthStore();
  if (!store || store.deviceId !== params.deviceId) return null;
  const role = normalizeRole(params.role);
  const scope = normalizeAuthScope(params.scope);
  const key = buildScopedTokenKey(scope, role);
  const entry = store.tokens[key];
  if (!entry || typeof entry.token !== "string") return null;
  return entry;
}

function storeDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  scope: string;
  token: string;
  scopes?: string[];
}): DeviceAuthEntry {
  const role = normalizeRole(params.role);
  const scope = normalizeAuthScope(params.scope);
  const key = buildScopedTokenKey(scope, role);
  const next: DeviceAuthStore = {
    version: 1,
    deviceId: params.deviceId,
    tokens: {},
  };
  const existing = readDeviceAuthStore();
  if (existing && existing.deviceId === params.deviceId) {
    next.tokens = { ...existing.tokens };
  }
  const entry: DeviceAuthEntry = {
    token: params.token,
    role,
    scopes: normalizeScopes(params.scopes),
    updatedAtMs: Date.now(),
  };
  next.tokens[key] = entry;
  writeDeviceAuthStore(next);
  return entry;
}

function clearDeviceAuthToken(params: { deviceId: string; role: string; scope: string }) {
  const store = readDeviceAuthStore();
  if (!store || store.deviceId !== params.deviceId) return;
  const role = normalizeRole(params.role);
  const scope = normalizeAuthScope(params.scope);
  const key = buildScopedTokenKey(scope, role);
  const hasScoped = Boolean(store.tokens[key]);
  const hasLegacy = Boolean(store.tokens[role]);
  if (!hasScoped && !hasLegacy) return;
  const next = { ...store, tokens: { ...store.tokens } };
  delete next.tokens[key];
  delete next.tokens[role];
  writeDeviceAuthStore(next);
}

type StoredIdentity = {
  version: 1;
  deviceId: string;
  publicKey: string;
  privateKey: string;
  createdAtMs: number;
};

type DeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKey: string;
};

const DEVICE_IDENTITY_STORAGE_KEY = "openclaw-device-identity-v1";

export function clearGatewayBrowserSessionStorage() {
  try {
    localStorage.removeItem(DEVICE_AUTH_STORAGE_KEY);
    localStorage.removeItem(DEVICE_IDENTITY_STORAGE_KEY);
  } catch {
    // best-effort
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fingerprintPublicKey(publicKey: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(publicKey));
  return bytesToHex(new Uint8Array(hash));
}

async function generateIdentity(): Promise<DeviceIdentity> {
  const privateKey = utils.randomSecretKey();
  const publicKey = await getPublicKeyAsync(privateKey);
  const deviceId = await fingerprintPublicKey(publicKey);
  return {
    deviceId,
    publicKey: base64UrlEncode(publicKey),
    privateKey: base64UrlEncode(privateKey),
  };
}

async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  try {
    const raw = localStorage.getItem(DEVICE_IDENTITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredIdentity;
      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === "string" &&
        typeof parsed.publicKey === "string" &&
        typeof parsed.privateKey === "string"
      ) {
        const derivedId = await fingerprintPublicKey(base64UrlDecode(parsed.publicKey));
        if (derivedId !== parsed.deviceId) {
          const updated: StoredIdentity = {
            ...parsed,
            deviceId: derivedId,
          };
          localStorage.setItem(DEVICE_IDENTITY_STORAGE_KEY, JSON.stringify(updated));
          return {
            deviceId: derivedId,
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
          };
        }
        return {
          deviceId: parsed.deviceId,
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey,
        };
      }
    }
  } catch {
    // fall through to regenerate
  }

  const identity = await generateIdentity();
  const stored: StoredIdentity = {
    version: 1,
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    createdAtMs: Date.now(),
  };
  localStorage.setItem(DEVICE_IDENTITY_STORAGE_KEY, JSON.stringify(stored));
  return identity;
}

async function signDevicePayload(privateKeyBase64Url: string, payload: string) {
  const key = base64UrlDecode(privateKeyBase64Url);
  const data = new TextEncoder().encode(payload);
  const sig = await signAsync(data, key);
  return base64UrlEncode(sig);
}

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  adapterType?: "openclaw" | "hermes" | "demo" | "custom";
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: { tickIntervalMs?: number };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

export type GatewayBrowserClientOptions = {
  url: string;
  token?: string;
  password?: string;
  authScopeKey?: string;
  disableDeviceAuth?: boolean;
  clientName?: string;
  clientVersion?: string;
  platform?: string;
  mode?: string;
  instanceId?: string;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string }) => void;
  onGap?: (info: { expected: number; received: number }) => void;
};

const CONNECT_FAILED_CLOSE_CODE = 4008;
const WS_CLOSE_REASON_MAX_BYTES = 123;

function truncateWsCloseReason(reason: string, maxBytes = WS_CLOSE_REASON_MAX_BYTES): string {
  const trimmed = reason.trim();
  if (!trimmed) return "connect failed";
  const encoder = new TextEncoder();
  if (encoder.encode(trimmed).byteLength <= maxBytes) return trimmed;

  let out = "";
  for (const char of trimmed) {
    const next = out + char;
    if (encoder.encode(next).byteLength > maxBytes) break;
    out = next;
  }
  return out.trimEnd() || "connect failed";
}

export class GatewayBrowserClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: number | null = null;
  private backoffMs = 800;

  constructor(private opts: GatewayBrowserClientOptions) {}

  start() {
    this.closed = false;
    gatewayBrowserDebugLog("start", {
      url: this.opts.url,
      authScopeKey: this.opts.authScopeKey ?? null,
      disableDeviceAuth: Boolean(this.opts.disableDeviceAuth),
      clientName: this.opts.clientName ?? null,
      mode: this.opts.mode ?? null,
    });
    this.connect();
  }

  stop() {
    this.closed = true;
    gatewayBrowserDebugLog("stop");
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error("gateway client stopped"));
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private connect() {
    if (this.closed) return;
    gatewayBrowserDebugLog("connect:open-socket", { url: this.opts.url });
    this.ws = new WebSocket(this.opts.url);
    this.ws.onopen = () => {
      gatewayBrowserDebugLog("socket:open");
      this.queueConnect();
    };
    this.ws.onmessage = (ev) => this.handleMessage(String(ev.data ?? ""));
    this.ws.onclose = (ev) => {
      const reason = String(ev.reason ?? "");
      gatewayBrowserDebugLog("socket:close", { code: ev.code, reason });
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${ev.code}): ${reason}`));
      this.opts.onClose?.({ code: ev.code, reason });
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      gatewayBrowserDebugLog("socket:error");
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    gatewayBrowserDebugLog("schedule-reconnect", { delay });
    window.setTimeout(() => this.connect(), delay);
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  private async sendConnect() {
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const isSecureContext =
      !this.opts.disableDeviceAuth && typeof crypto !== "undefined" && !!crypto.subtle;
    gatewayBrowserDebugLog("send-connect", {
      url: this.opts.url,
      disableDeviceAuth: Boolean(this.opts.disableDeviceAuth),
      hasNonce: Boolean(this.connectNonce),
      isSecureContext,
    });

    const scopes = ["operator.admin", "operator.approvals", "operator.pairing"];
    const role = "operator";
    const authScopeKey = normalizeAuthScope(this.opts.authScopeKey ?? this.opts.url);
    let deviceIdentity: Awaited<ReturnType<typeof loadOrCreateDeviceIdentity>> | null = null;
    let canFallbackToShared = false;
    let authToken = this.opts.token;

    if (isSecureContext) {
      deviceIdentity = await loadOrCreateDeviceIdentity();
      const storedToken = loadDeviceAuthToken({
        deviceId: deviceIdentity.deviceId,
        role,
        scope: authScopeKey,
      })?.token;
      authToken = storedToken ?? this.opts.token;
      canFallbackToShared = Boolean(storedToken && this.opts.token);
    }
    const auth =
      authToken || this.opts.password
        ? {
            token: authToken,
            password: this.opts.password,
          }
        : undefined;

    let device:
      | {
          id: string;
          publicKey: string;
          signature: string;
          signedAt: number;
          nonce: string | undefined;
        }
      | undefined;

    if (isSecureContext && deviceIdentity) {
      const signedAtMs = Date.now();
      const nonce = this.connectNonce ?? undefined;
      const payload = buildDeviceAuthPayload({
        deviceId: deviceIdentity.deviceId,
        clientId: this.opts.clientName ?? GATEWAY_CLIENT_NAMES.CONTROL_UI,
        clientMode: this.opts.mode ?? GATEWAY_CLIENT_MODES.WEBCHAT,
        role,
        scopes,
        signedAtMs,
        token: authToken ?? null,
        nonce,
      });
      const signature = await signDevicePayload(deviceIdentity.privateKey, payload);
      device = {
        id: deviceIdentity.deviceId,
        publicKey: deviceIdentity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    }
    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.opts.clientName ?? GATEWAY_CLIENT_NAMES.CONTROL_UI,
        version: this.opts.clientVersion ?? "dev",
        platform: this.opts.platform ?? navigator.platform ?? "web",
        mode: this.opts.mode ?? GATEWAY_CLIENT_MODES.WEBCHAT,
        instanceId: this.opts.instanceId,
      },
      role,
      scopes,
      device,
      caps: [],
      auth,
      userAgent: navigator.userAgent,
      locale: navigator.language,
    };

    void this.request<GatewayHelloOk>("connect", params)
      .then((hello) => {
        gatewayBrowserDebugLog("hello-ok", {
          protocol: hello?.protocol ?? null,
          hasAuthToken: Boolean(hello?.auth?.deviceToken),
        });
        if (hello?.auth?.deviceToken && deviceIdentity) {
          storeDeviceAuthToken({
            deviceId: deviceIdentity.deviceId,
            role: hello.auth.role ?? role,
            scope: authScopeKey,
            token: hello.auth.deviceToken,
            scopes: hello.auth.scopes ?? [],
          });
        }
        this.backoffMs = 800;
        this.opts.onHello?.(hello);
      })
      .catch((err) => {
        gatewayBrowserDebugLog("connect-failed", {
          message: err instanceof Error ? err.message : String(err),
        });
        if (canFallbackToShared && deviceIdentity) {
          clearDeviceAuthToken({ deviceId: deviceIdentity.deviceId, role, scope: authScopeKey });
        }
        const rawReason =
          err instanceof GatewayResponseError
            ? `connect failed: ${err.code} ${err.message}`
            : "connect failed";
        const reason = truncateWsCloseReason(rawReason);
        if (reason !== rawReason) {
          console.warn("[gateway] connect close reason truncated to 123 UTF-8 bytes");
        }
        this.ws?.close(CONNECT_FAILED_CLOSE_CODE, reason);
      });
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };
    if (frame.type === "event") {
      const evt = parsed as GatewayEventFrame;
      if (evt.event === "connect.challenge") {
        gatewayBrowserDebugLog("connect-challenge");
        const payload = evt.payload as { nonce?: unknown } | undefined;
        const nonce = payload && typeof payload.nonce === "string" ? payload.nonce : null;
        if (nonce) {
          this.connectNonce = nonce;
          void this.sendConnect();
        }
        return;
      }
      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          this.opts.onGap?.({ expected: this.lastSeq + 1, received: seq });
        }
        this.lastSeq = seq;
      }
      try {
        this.opts.onEvent?.(evt);
      } catch (err) {
        console.error("[gateway] event handler error:", err);
      }
      return;
    }

    if (frame.type === "res") {
      const res = parsed as GatewayResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) return;
      this.pending.delete(res.id);
      if (res.ok) pending.resolve(res.payload);
      else {
        if (res.error && typeof res.error.code === "string") {
          pending.reject(
            new GatewayResponseError({
              code: res.error.code,
              message: res.error.message ?? "request failed",
              details: res.error.details,
            })
          );
          return;
        }
        pending.reject(new Error(res.error?.message ?? "request failed"));
      }
      return;
    }
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = generateUUID();
    const frame = { type: "req", id, method, params };
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });
    this.ws.send(JSON.stringify(frame));
    return p;
  }

  private queueConnect() {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer !== null) window.clearTimeout(this.connectTimer);
    gatewayBrowserDebugLog("queue-connect", { delayMs: 750 });
    this.connectTimer = window.setTimeout(() => {
      void this.sendConnect();
    }, 750);
  }
}
