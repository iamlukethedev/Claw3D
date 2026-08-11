import type {
  EventPort,
  QueryPort,
  VisualConnectionState,
  VisualEvent,
  VisualRuntimeAdapter,
  VisualSnapshot,
} from "@claw3d/visual-contract";
import { readSseMessages } from "./sse";

const SNAPSHOT_PATH = "/api/visual-runtime/v1/snapshot";
const EVENTS_PATH = "/api/visual-runtime/v1/events";
const MAX_RECONNECT_DELAY_MS = 15_000;

export interface JarvisReadonlyBrowserAdapterOptions {
  fetch?: typeof globalThis.fetch;
  random?: () => number;
  baseDelayMs?: number;
}

function isVisualEvent(value: unknown): value is VisualEvent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<VisualEvent>;
  return candidate.schemaVersion === 1
    && typeof candidate.eventId === "string"
    && typeof candidate.type === "string"
    && typeof candidate.occurredAt === "string"
    && typeof candidate.metadata === "object"
    && candidate.metadata !== null;
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function connectionForStatus(status: number, attempt: number): VisualConnectionState {
  if (status === 401 || status === 403) {
    return { phase: "locked", attempt, label: "Private visual source locked" };
  }
  if (status === 429) {
    return { phase: "rate-limited", attempt, label: "Visual source rate limited" };
  }
  return { phase: "reconnecting", attempt, label: `Visual source unavailable (${status})` };
}

export function createJarvisReadonlyBrowserAdapter(
  options: JarvisReadonlyBrowserAdapterOptions = {},
): VisualRuntimeAdapter {
  const request = options.fetch ?? globalThis.fetch.bind(globalThis);
  const random = options.random ?? Math.random;
  const baseDelayMs = Math.max(100, options.baseDelayMs ?? 750);

  const query: QueryPort = {
    async getSnapshot(signal) {
      const response = await request(SNAPSHOT_PATH, {
        method: "GET",
        headers: { accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error(`Visual snapshot unavailable (${response.status})`);
      const value: unknown = await response.json();
      return value as VisualSnapshot;
    },
  };

  const events: EventPort = {
    subscribe(subscription, onEvent, onConnectionChange) {
      const controller = new AbortController();
      const stop = () => controller.abort();
      subscription.signal?.addEventListener("abort", stop, { once: true });
      let cursor = /^\d+$/.test(subscription.lastEventId ?? "") ? subscription.lastEventId : undefined;

      void (async () => {
        let attempt = 0;
        while (!controller.signal.aborted) {
          try {
            const headers: Record<string, string> = { accept: "text/event-stream" };
            if (cursor) headers["last-event-id"] = cursor;
            const response = await request(EVENTS_PATH, {
              method: "GET",
              headers,
              credentials: "same-origin",
              cache: "no-store",
              signal: controller.signal,
            });
            if (!response.ok || !response.body) {
              attempt += 1;
              onConnectionChange?.(connectionForStatus(response.status, attempt));
              if (response.status === 401 || response.status === 403) return;
              const retryAfter = Number(response.headers.get("retry-after"));
              const wait = Number.isFinite(retryAfter) && retryAfter > 0
                ? Math.min(retryAfter * 1_000, MAX_RECONNECT_DELAY_MS)
                : Math.min(baseDelayMs * 2 ** (attempt - 1), MAX_RECONNECT_DELAY_MS) + random() * 250;
              await delay(wait, controller.signal);
              continue;
            }
            attempt = 0;
            onConnectionChange?.({ phase: "online", attempt: 0, label: "Read-only visual stream online" });
            for await (const message of readSseMessages(response.body)) {
              if (controller.signal.aborted) return;
              if (message.id && /^\d+$/.test(message.id)) cursor = message.id;
              let decoded: unknown;
              try {
                decoded = JSON.parse(message.data);
              } catch {
                continue;
              }
              if (isVisualEvent(decoded)) onEvent(decoded);
            }
            if (controller.signal.aborted) return;
            attempt += 1;
            onConnectionChange?.({ phase: "reconnecting", attempt, label: "Visual stream ended" });
          } catch {
            if (controller.signal.aborted) return;
            attempt += 1;
            onConnectionChange?.({ phase: "reconnecting", attempt, label: "Visual stream interrupted" });
          }
          try {
            const wait = Math.min(baseDelayMs * 2 ** Math.max(0, attempt - 1), MAX_RECONNECT_DELAY_MS) + random() * 250;
            await delay(wait, controller.signal);
          } catch {
            return;
          }
        }
      })();

      return stop;
    },
  };

  return { id: "jarvis-readonly", query, events };
}
