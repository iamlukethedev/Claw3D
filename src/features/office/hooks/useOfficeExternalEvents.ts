"use client";

import { useEffect, useRef, useState } from "react";
import type { OfficeExternalEvent } from "@/lib/office/externalEventsStore";
import type { OperationsCenterFeedEvent } from "@/features/office/components/panels/OperationsCenterPanel";

type UseOfficeExternalEventsResult = {
  events: OfficeExternalEvent[];
  feedEvents: OperationsCenterFeedEvent[];
  latestNewEvent: OfficeExternalEvent | null;
};

const toFeedEvent = (event: OfficeExternalEvent): OperationsCenterFeedEvent => ({
  id: event.agentId ?? `external:${event.id}`,
  name: event.source,
  text: event.message ? `${event.title}: ${event.message}` : event.title,
  ts: event.receivedAt,
  kind: "external",
  effect: event.effect,
});

export const useOfficeExternalEvents = (
  pollIntervalMs = 5_000,
): UseOfficeExternalEventsResult => {
  const [events, setEvents] = useState<OfficeExternalEvent[]>([]);
  const [latestNewEvent, setLatestNewEvent] = useState<OfficeExternalEvent | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const load = async () => {
      try {
        const response = await fetch("/api/office/events", { cache: "no-store" });
        const payload = (await response.json()) as
          | { events?: OfficeExternalEvent[] }
          | { error?: string };
        if (!response.ok || !("events" in payload) || !Array.isArray(payload.events)) {
          return;
        }
        if (cancelled) return;
        const nextEvents = payload.events;
        const previousSeen = seenIdsRef.current;
        const newEvents = nextEvents.filter((event) => !previousSeen.has(event.id));
        seenIdsRef.current = new Set(nextEvents.map((event) => event.id));
        setEvents(nextEvents);
        if (newEvents.length > 0) {
          setLatestNewEvent(newEvents[0] ?? null);
        }
        initializedRef.current = true;
      } catch {
        // External event polling is best-effort; the office should keep rendering.
      }
    };

    void load();
    intervalId = window.setInterval(() => {
      void load();
    }, Math.max(1_000, pollIntervalMs));

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [pollIntervalMs]);

  return { events, feedEvents: events.map(toFeedEvent), latestNewEvent };
};
