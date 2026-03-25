"use client";

import { useEffect, useMemo, useState } from "react";
import type { OfficeLayoutSnapshot } from "@/lib/office/layoutSnapshot";

type UseRemoteOfficeLayoutParams = {
  enabled: boolean;
  presenceUrl: string;
  pollIntervalMs?: number;
};

type UseRemoteOfficeLayoutResult = {
  loaded: boolean;
  error: string | null;
  snapshot: OfficeLayoutSnapshot | null;
};

export const useRemoteOfficeLayout = ({
  enabled,
  presenceUrl,
  pollIntervalMs = 10_000,
}: UseRemoteOfficeLayoutParams): UseRemoteOfficeLayoutResult => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<OfficeLayoutSnapshot | null>(null);
  const active = enabled && presenceUrl.trim().length > 0;
  const requestUrl = useMemo(() => {
    if (!active) return "";
    const searchParams = new URLSearchParams({ source: "remote" });
    return `/api/office/layout?${searchParams.toString()}`;
  }, [active]);

  useEffect(() => {
    if (!active || !requestUrl) return;
    let cancelled = false;
    let intervalId: number | null = null;
    const loadSnapshot = async () => {
      try {
        const response = await fetch(requestUrl, { cache: "no-store" });
        const payload = (await response.json()) as
          | { snapshot: OfficeLayoutSnapshot | null }
          | { error?: string };
        if (!response.ok) {
          const errorMessage =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : "Failed to load remote office layout.";
          throw new Error(errorMessage);
        }
        if (cancelled) return;
        if (
          typeof payload === "object" &&
          payload !== null &&
          "snapshot" in payload
        ) {
          setSnapshot(payload.snapshot ?? null);
        }
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load remote office layout.",
        );
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };
    void loadSnapshot();
    intervalId = window.setInterval(() => {
      void loadSnapshot();
    }, Math.max(2_500, pollIntervalMs));
    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [active, pollIntervalMs, requestUrl]);

  return {
    loaded: active ? loaded : false,
    error: active ? error : null,
    snapshot: active ? snapshot : null,
  };
};
