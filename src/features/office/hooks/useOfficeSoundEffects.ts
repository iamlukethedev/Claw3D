"use client";

import { useEffect, useMemo, useRef } from "react";
import type { OfficeExternalEvent } from "@/lib/office/externalEventsStore";
import type { RunRecord } from "@/features/office/hooks/useRunLog";
import {
  playOfficeSoundCue,
  resolveOfficeSoundCueForExternalEvent,
} from "@/features/office/sound/officeSound";

type UseOfficeSoundEffectsParams = {
  enabled: boolean;
  volume: number;
  latestExternalEvent: OfficeExternalEvent | null;
  runLog: RunRecord[];
  playCue?: typeof playOfficeSoundCue;
};

export const useOfficeSoundEffects = ({
  enabled,
  volume,
  latestExternalEvent,
  runLog,
  playCue = playOfficeSoundCue,
}: UseOfficeSoundEffectsParams) => {
  const lastExternalEventIdRef = useRef<string | null>(null);
  const runSignature = useMemo(
    () =>
      runLog
        .slice(0, 8)
        .map((run) => `${run.runId}:${run.endedAt ?? "running"}:${run.outcome ?? "pending"}`)
        .join("|"),
    [runLog],
  );
  const lastRunSignatureRef = useRef(runSignature);

  useEffect(() => {
    if (!enabled || !latestExternalEvent) return;
    if (lastExternalEventIdRef.current === latestExternalEvent.id) return;
    lastExternalEventIdRef.current = latestExternalEvent.id;
    const cueId = resolveOfficeSoundCueForExternalEvent({
      effect: latestExternalEvent.effect,
    });
    if (!cueId) return;
    void playCue({ cue: cueId, volume });
  }, [enabled, latestExternalEvent, playCue, volume]);

  useEffect(() => {
    if (!enabled) {
      lastRunSignatureRef.current = runSignature;
      return;
    }
    if (lastRunSignatureRef.current === runSignature) return;
    const previous = lastRunSignatureRef.current;
    lastRunSignatureRef.current = runSignature;
    if (!previous) return;
    const latestRun = runLog[0] ?? null;
    if (!latestRun) return;
    if (latestRun.endedAt === null) {
      void playCue({ cue: "task-start", volume });
      return;
    }
    void playCue({
      cue: latestRun.outcome === "error" ? "alarm" : "task-complete",
      volume,
    });
  }, [enabled, playCue, runLog, runSignature, volume]);
};
