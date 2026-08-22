"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchJson } from "@/lib/http";
import type {
  StandupAgentSnapshot,
  StandupMeeting,
} from "@/lib/office/standup/types";
import type {
  StudioStandupPreferencePatch,
  StudioStandupPreferencePublic,
} from "@/lib/studio/settings";

type StandupConfigResponse = {
  gatewayUrl: string;
  config: StudioStandupPreferencePublic;
};

type StandupMeetingResponse = {
  meeting: StandupMeeting | null;
};

const splitCronExpr = (expr: string) => expr.trim().split(/\s+/);

const expandRange = (segment: string): number[] => {
  if (segment.includes("-")) {
    const [startRaw, endRaw] = segment.split("-");
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
    const values: number[] = [];
    for (let value = start; value <= end; value += 1) values.push(value);
    return values;
  }
  const numeric = Number(segment);
  return Number.isFinite(numeric) ? [numeric] : [];
};

const matchesCronPart = (part: string, value: number) => {
  if (part === "*") return true;
  return part
    .split(",")
    .some((segment) => expandRange(segment.trim()).includes(value));
};

const getZonedParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    minute: "numeric",
    hour: "numeric",
    day: "numeric",
    month: "numeric",
    weekday: "short",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    minute: Number(get("minute")),
    hour: Number(get("hour")),
    day: Number(get("day")),
    month: Number(get("month")),
    weekday: weekdayMap[get("weekday")] ?? -1,
  };
};

const shouldRunNow = (config: StudioStandupPreferencePublic, now: Date) => {
  if (!config.schedule.enabled) return false;
  const parts = splitCronExpr(config.schedule.cronExpr);
  if (parts.length !== 5) return false;
  const zoned = getZonedParts(now, config.schedule.timezone || "UTC");
  return (
    matchesCronPart(parts[0] ?? "*", zoned.minute) &&
    matchesCronPart(parts[1] ?? "*", zoned.hour) &&
    matchesCronPart(parts[2] ?? "*", zoned.day) &&
    matchesCronPart(parts[3] ?? "*", zoned.month) &&
    matchesCronPart(parts[4] ?? "*", zoned.weekday)
  );
};

const sameScheduledMinute = (leftIso: string | null, right: Date, timeZone: string) => {
  if (!leftIso) return false;
  const leftDate = new Date(leftIso);
  if (Number.isNaN(leftDate.getTime())) return false;
  const left = getZonedParts(leftDate, timeZone || "UTC");
  const next = getZonedParts(right, timeZone || "UTC");
  return (
    left.minute === next.minute &&
    left.hour === next.hour &&
    left.day === next.day &&
    left.month === next.month
  );
};

const everyoneArrived = (meeting: StandupMeeting | null) => {
  if (!meeting) return false;
  return meeting.participantOrder.every((agentId) =>
    meeting.arrivedAgentIds.includes(agentId)
  );
};

const isMeetingActive = (meeting: StandupMeeting | null) =>
  meeting?.phase === "gathering" || meeting?.phase === "in_progress";

const hasSameJsonShape = <T,>(left: T, right: T) =>
  JSON.stringify(left) === JSON.stringify(right);

export type OfficeStandupController = {
  config: StudioStandupPreferencePublic | null;
  meeting: StandupMeeting | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveConfig: (patch: StudioStandupPreferencePatch) => Promise<void>;
  updateManualEntry: (
    agentId: string,
    patch: Partial<StudioStandupPreferencePublic["manualByAgentId"][string]>
  ) => Promise<void>;
  startMeeting: (trigger?: "manual" | "scheduled") => Promise<void>;
  reportArrivals: (arrivedAgentIds: string[]) => Promise<void>;
  openBoardByDefault: boolean;
  refreshMeeting: () => Promise<void>;
};

export const useOfficeStandupController = (params: {
  gatewayUrl: string;
  agents: StandupAgentSnapshot[];
}): OfficeStandupController => {
  const { gatewayUrl, agents } = params;
  const [config, setConfig] = useState<StudioStandupPreferencePublic | null>(null);
  const [meeting, setMeeting] = useState<StandupMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastArrivalsRef = useRef("");
  const meetingRef = useRef<StandupMeeting | null>(null);
  const configRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const meetingRefreshInFlightRef = useRef<Promise<void> | null>(null);

  const pageVisible = () =>
    typeof document === "undefined" || document.visibilityState === "visible";

  useEffect(() => {
    meetingRef.current = meeting;
  }, [meeting]);

  const refreshConfig = useCallback(async (options?: { allowHidden?: boolean }) => {
    if (!gatewayUrl.trim()) return;
    if (!options?.allowHidden && !pageVisible()) return;
    if (configRefreshInFlightRef.current) return configRefreshInFlightRef.current;
    const task = (async () => {
      const payload = await fetchJson<StandupConfigResponse>(
        `/api/office/standup/config?gatewayUrl=${encodeURIComponent(gatewayUrl)}`,
        { cache: "no-store" }
      );
      setConfig((current) =>
        current && hasSameJsonShape(current, payload.config) ? current : payload.config
      );
    })();
    configRefreshInFlightRef.current = task.finally(() => {
      configRefreshInFlightRef.current = null;
    });
    return configRefreshInFlightRef.current;
  }, [gatewayUrl]);

  const refreshMeeting = useCallback(async (options?: { allowHidden?: boolean }) => {
    if (!options?.allowHidden && !pageVisible()) return;
    if (meetingRefreshInFlightRef.current) return meetingRefreshInFlightRef.current;
    const task = (async () => {
      const payload = await fetchJson<StandupMeetingResponse>(
        "/api/office/standup/meeting",
        { cache: "no-store" }
      );
      setMeeting(payload.meeting);
    })();
    meetingRefreshInFlightRef.current = task.finally(() => {
      meetingRefreshInFlightRef.current = null;
    });
    return meetingRefreshInFlightRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([refreshConfig({ allowHidden: true }), refreshMeeting({ allowHidden: true })])
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load standup state."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshConfig, refreshMeeting]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!pageVisible()) return;
      void refreshMeeting().catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to refresh standup meeting."
        );
      });
    }, isMeetingActive(meeting) ? 8000 : 60000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [meeting, refreshMeeting]);

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (!pageVisible()) return;
      void Promise.all([refreshConfig(), refreshMeeting()]).catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to refresh standup state."
        );
      });
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [refreshConfig, refreshMeeting]);

  const saveConfig = useCallback(
    async (patch: StudioStandupPreferencePatch) => {
      if (!gatewayUrl.trim()) return;
      setSaving(true);
      try {
        const payload = await fetchJson<StandupConfigResponse>(
          "/api/office/standup/config",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gatewayUrl,
              config: patch,
            }),
          }
        );
        setConfig(payload.config);
      } finally {
        setSaving(false);
      }
    },
    [gatewayUrl]
  );

  const updateManualEntry = useCallback(
    async (
      agentId: string,
      patch: Partial<StudioStandupPreferencePublic["manualByAgentId"][string]>
    ) => {
      await saveConfig({
        manualByAgentId: {
          [agentId]: {
            ...patch,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    },
    [saveConfig]
  );

  const startMeeting = useCallback(
    async (trigger: "manual" | "scheduled" = "manual") => {
      if (!gatewayUrl.trim()) return;
      const payload = await fetchJson<StandupMeetingResponse>(
        "/api/office/standup/run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gatewayUrl,
            trigger,
            agents,
          }),
        }
      );
      setMeeting(payload.meeting);
      if (trigger === "scheduled") {
        setConfig((current) =>
          current
            ? {
                ...current,
                schedule: {
                  ...current.schedule,
                  lastAutoRunAt: new Date().toISOString(),
                },
              }
            : current
        );
      }
      lastArrivalsRef.current = "";
    },
    [agents, gatewayUrl]
  );

  const reportArrivals = useCallback(async (arrivedAgentIds: string[]) => {
    const deduped = Array.from(new Set(arrivedAgentIds)).sort();
    const nextKey = deduped.join("|");
    if (nextKey === lastArrivalsRef.current) return;
    lastArrivalsRef.current = nextKey;
    const payload = await fetchJson<StandupMeetingResponse>(
      "/api/office/standup/meeting",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "arrivals",
          arrivedAgentIds: deduped,
        }),
      }
    );
    setMeeting(payload.meeting);
  }, []);

  useEffect(() => {
    if (!config) return;
    const intervalId = window.setInterval(() => {
      if (!pageVisible()) return;
      const now = new Date();
      if (isMeetingActive(meetingRef.current)) return;
      if (!shouldRunNow(config, now)) return;
      if (
        sameScheduledMinute(
          config.schedule.lastAutoRunAt,
          now,
          config.schedule.timezone || "UTC"
        )
      ) {
        return;
      }
      void startMeeting("scheduled").catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to start the scheduled standup."
        );
      });
    }, 60000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [config, startMeeting]);

  useEffect(() => {
    if (!meeting || meeting.phase !== "gathering") return;
    if (!everyoneArrived(meeting)) return;
    const firstSpeaker = meeting.participantOrder[0] ?? null;
    if (!firstSpeaker) return;
    void fetchJson<StandupMeetingResponse>("/api/office/standup/meeting", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        speakerAgentId: firstSpeaker,
      }),
    })
      .then((payload) => setMeeting(payload.meeting))
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to start standup speaking."
        );
      });
  }, [meeting]);

  useEffect(() => {
    if (!meeting || meeting.phase !== "in_progress") return;
    const startedAt = meeting.speakerStartedAt
      ? Date.parse(meeting.speakerStartedAt)
      : Number.NaN;
    if (!Number.isFinite(startedAt)) return;
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, meeting.speakerDurationMs - elapsed);
    const timerId = window.setTimeout(() => {
      const currentIndex = meeting.currentSpeakerAgentId
        ? meeting.participantOrder.indexOf(meeting.currentSpeakerAgentId)
        : -1;
      const isLastSpeaker = currentIndex >= meeting.participantOrder.length - 1;
      const action = isLastSpeaker ? "complete" : "advance";
      void fetchJson<StandupMeetingResponse>("/api/office/standup/meeting", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
        .then((payload) => setMeeting(payload.meeting))
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Failed to advance standup progress."
          );
        });
    }, remaining + 50);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [meeting]);

  const openBoardByDefault = useMemo(
    () => Boolean(config?.schedule.autoOpenBoard),
    [config?.schedule.autoOpenBoard]
  );

  return {
    config,
    meeting,
    loading,
    saving,
    error,
    saveConfig,
    updateManualEntry,
    startMeeting,
    reportArrivals,
    openBoardByDefault,
    refreshMeeting,
  };
};
