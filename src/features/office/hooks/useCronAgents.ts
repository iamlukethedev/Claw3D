"use client";

import { useEffect, useRef, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { CronJobSummary } from "@/lib/cron/types";
import type { OfficeAgent } from "@/features/retro-office/core/types";

const POLL_INTERVAL_MS = 8000;

const ITEMS = [
  "globe", "books", "coffee", "palette", "camera",
  "waveform", "shield", "fire", "plant", "laptop",
];

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
}

function getDeterministicItem(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ITEMS[Math.abs(hash) % ITEMS.length];
}

function cronJobToOfficeAgent(job: CronJobSummary): OfficeAgent {
  const isRunning = Boolean(job.state?.runningAtMs);
  const isError = job.state?.lastStatus === "error" && !isRunning;
  return {
    id: `cron:${job.id}`,
    name: `⏰ ${job.name}`,
    status: isError ? "error" : isRunning ? "working" : "idle",
    color: stringToColor(job.id),
    item: getDeterministicItem(job.id),
  };
}

type CronJobsResult = { jobs: CronJobSummary[] };

export function useCronAgents(params: {
  client: GatewayClient | null;
  status: string;
}): OfficeAgent[] {
  const { client, status } = params;
  const [agents, setAgents] = useState<OfficeAgent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== "connected" || !client) {
      setAgents([]);
      return;
    }

    let cancelled = false;

    const fetchJobs = async () => {
      try {
        const result = await client.call<CronJobsResult>("cron.list", {
          includeDisabled: true,
        });
        if (!cancelled) {
          setAgents((result.jobs ?? []).map(cronJobToOfficeAgent));
        }
      } catch {
        // gateway doesn't support cron.list — just leave empty
      }
    };

    fetchJobs();
    timerRef.current = setInterval(fetchJobs, POLL_INTERVAL_MS);

    // Also update immediately on cron events
    const unsub = client.onEvent((event) => {
      if (event.event === "cron") {
        fetchJobs();
      }
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      unsub();
    };
  }, [client, status]);

  return agents;
}
