import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";
import { readConfigAgentList } from "@/lib/gateway/agentConfig";
import type { OfficeAgentState } from "@/lib/office/schema";

export type OfficeAgentPresence = {
  agentId: string;
  name: string;
  state: OfficeAgentState;
  preferredDeskId?: string;
};

export type OfficePresenceSnapshot = {
  workspaceId: string;
  timestamp: string;
  agents: OfficeAgentPresence[];
};

const OPENCLAW_CONFIG_FILENAME = "openclaw.json";

const stableHash = (input: string): number => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const resolveStateFromSeed = (seed: number): OfficeAgentState => {
  const mod = seed % 20;
  if (mod <= 9) return "working";
  if (mod <= 14) return "idle";
  if (mod <= 17) return "meeting";
  return "error";
};

const asRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeOfficeAgentState = (value: unknown): OfficeAgentState => {
  if (value === "working" || value === "idle" || value === "meeting" || value === "error") {
    return value;
  }
  return "idle";
};

export const normalizeOfficePresenceSnapshot = (
  value: unknown,
  fallbackWorkspaceId = "default"
): OfficePresenceSnapshot => {
  if (!asRecord(value)) {
    return {
      workspaceId: fallbackWorkspaceId,
      timestamp: new Date().toISOString(),
      agents: [],
    };
  }
  const workspaceId =
    typeof value.workspaceId === "string" && value.workspaceId.trim().length > 0
      ? value.workspaceId.trim()
      : fallbackWorkspaceId;
  const timestamp =
    typeof value.timestamp === "string" && value.timestamp.trim().length > 0
      ? value.timestamp
      : new Date().toISOString();
  const rawAgents = Array.isArray(value.agents) ? value.agents : [];
  const agents: OfficeAgentPresence[] = rawAgents.flatMap((entry) => {
    if (!asRecord(entry)) return [];
    const agentId = typeof entry.agentId === "string" ? entry.agentId.trim() : "";
    if (!agentId) return [];
    const name = typeof entry.name === "string" && entry.name.trim().length > 0
      ? entry.name.trim()
      : agentId;
    const preferredDeskId =
      typeof entry.preferredDeskId === "string" && entry.preferredDeskId.trim().length > 0
        ? entry.preferredDeskId.trim()
        : undefined;
    return [
      {
        agentId,
        name,
        state: normalizeOfficeAgentState(entry.state),
        ...(preferredDeskId ? { preferredDeskId } : {}),
      },
    ];
  });
  return {
    workspaceId,
    timestamp,
    agents,
  };
};

export const fetchRemoteOfficePresenceSnapshot = async (params: {
  presenceUrl: string;
  token?: string | null;
  timeoutMs?: number;
}): Promise<OfficePresenceSnapshot> => {
  const presenceUrl = params.presenceUrl.trim();
  if (!presenceUrl) {
    throw new Error("Remote office presence URL is not configured.");
  }
  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, params.timeoutMs ?? 15_000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const token = params.token?.trim() ?? "";
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers["X-Claw3D-Office-Token"] = token;
    }
    const response = await fetch(presenceUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Remote office presence request failed with status ${response.status}.`);
    }
    const payload = (await response.json()) as unknown;
    return normalizeOfficePresenceSnapshot(payload, "remote");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Remote office presence request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const loadOfficePresenceSnapshot = (workspaceId: string): OfficePresenceSnapshot => {
  const configPath = path.join(resolveStateDir(), OPENCLAW_CONFIG_FILENAME);
  const timestamp = new Date().toISOString();
  if (!fs.existsSync(configPath)) {
    return {
      workspaceId,
      timestamp,
      agents: [],
    };
  }
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const config =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  const agentList = readConfigAgentList(config);
  const bucket = Math.floor(Date.now() / 2000);
  const agents: OfficeAgentPresence[] = agentList.map((entry) => {
    const id = entry.id.trim();
    const nameRaw = typeof entry.name === "string" ? entry.name : id;
    const seed = stableHash(`${id}:${bucket}`);
    return {
      agentId: id,
      name: nameRaw,
      state: resolveStateFromSeed(seed),
      preferredDeskId: `desk-${id}`,
    };
  });
  return {
    workspaceId,
    timestamp,
    agents,
  };
};
