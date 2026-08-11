import { mapPrivateEvent, mapPrivateStatus, readSseMessages } from "@claw3d/adapter-jarvis-readonly";
import type { VisualSnapshot } from "@claw3d/visual-contract";

const ALLOWED_GET_PATHS = new Set([
  "/api/status",
  "/api/events/stream",
] as const);
const SNAPSHOT_TIMEOUT_MS = 5_000;
const STREAM_CONNECT_TIMEOUT_MS = 8_000;

export class VisualConnectorError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "VisualConnectorError";
  }
}

function readPrivateOrigin(): URL {
  if (process.env.JARVIS_CONNECTOR_ENABLED !== "true") {
    throw new VisualConnectorError("Visual connector disabled", 503);
  }
  const configured = process.env.JARVIS_ORIGIN;
  if (!configured) throw new VisualConnectorError("Private visual origin is not configured", 503);
  let origin: URL;
  try {
    origin = new URL(configured);
  } catch {
    throw new VisualConnectorError("Private visual origin is invalid", 503);
  }
  if (
    !["http:", "https:"].includes(origin.protocol)
    || origin.username
    || origin.password
    || origin.pathname !== "/"
    || origin.search
    || origin.hash
  ) {
    throw new VisualConnectorError("Private visual origin must be an HTTP(S) origin", 503);
  }
  return origin;
}

function privateUrl(path: string): URL {
  if (!ALLOWED_GET_PATHS.has(path as typeof ALLOWED_GET_PATHS extends Set<infer T> ? T : never)) {
    throw new VisualConnectorError("Private visual route is not allowed", 404);
  }
  return new URL(path, readPrivateOrigin());
}

async function privateGet(
  path: "/api/status" | "/api/events/stream",
  accept: "application/json" | "text/event-stream",
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
  lastEventId?: string,
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  const headers: Record<string, string> = { accept };
  if (lastEventId && /^[0-9]{1,20}$/.test(lastEventId)) headers["last-event-id"] = lastEventId;
  try {
    const response = await fetch(privateUrl(path), {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      throw new VisualConnectorError("Private visual source redirected unexpectedly", 502);
    }
    return response;
  } catch (error) {
    if (error instanceof VisualConnectorError) throw error;
    if (parentSignal?.aborted) throw new VisualConnectorError("Visual request cancelled", 499);
    throw new VisualConnectorError("Private visual source unavailable", 502);
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abort);
  }
}

function exposedStatus(status: number): number {
  if ([401, 403, 429].includes(status)) return status;
  return status >= 500 ? 502 : 502;
}

export async function getVisualSnapshot(signal?: AbortSignal): Promise<VisualSnapshot> {
  const response = await privateGet(
    "/api/status",
    "application/json",
    signal,
    SNAPSHOT_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw new VisualConnectorError("Private visual snapshot rejected", exposedStatus(response.status));
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new VisualConnectorError("Private visual snapshot was malformed", 502);
  }
  try {
    return mapPrivateStatus(raw);
  } catch {
    throw new VisualConnectorError("Private visual snapshot did not match the allowlist", 502);
  }
}

export interface OpenVisualStreamResult {
  status: number;
  retryAfter?: string;
  stream?: ReadableStream<Uint8Array>;
}

export async function openVisualEventStream(
  signal: AbortSignal,
  lastEventId?: string,
): Promise<OpenVisualStreamResult> {
  const response = await privateGet(
    "/api/events/stream",
    "text/event-stream",
    signal,
    STREAM_CONNECT_TIMEOUT_MS,
    lastEventId,
  );
  if (!response.ok || !response.body) {
    return {
      status: exposedStatus(response.status),
      retryAfter: response.status === 429 ? response.headers.get("retry-after") ?? undefined : undefined,
    };
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const message of readSseMessages(response.body!)) {
          if (signal.aborted) break;
          let raw: unknown;
          try {
            raw = JSON.parse(message.data);
          } catch {
            continue;
          }
          if (message.event === "stream.reset" && typeof raw === "object" && raw !== null) {
            raw = {
              ...raw,
              type: "stream.reset",
              event_id: `stream-reset-${message.id ?? "unknown"}`,
              timestamp: Date.now() / 1_000,
            };
          }
          const event = mapPrivateEvent(raw);
          if (!event) continue;
          const id = message.id && /^[0-9]{1,20}$/.test(message.id) ? `id: ${message.id}\n` : "";
          controller.enqueue(encoder.encode(`${id}event: visual\ndata: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      } catch {
        if (!signal.aborted) controller.error(new Error("Visual stream interrupted"));
        else controller.close();
      }
    },
    cancel() {
      void response.body?.cancel();
    },
  });
  return { status: 200, stream };
}
