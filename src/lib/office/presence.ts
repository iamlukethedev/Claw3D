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

type GatewaySession = {
  key: string;
  agentId?: string | null;
  status: string;
  kind?: string;
  [key: string]: unknown;
};

type GatewaySessionsResponse = {
  count: number;
  sessions: GatewaySession[];
};

/**
 * Extract agent ID from session key
 * Session keys follow pattern: "agent:{agentId}:{sessionType}"
 */
const extractAgentIdFromSessionKey = (sessionKey: string): string | null => {
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : null;
};

/**
 * Map gateway session status to office agent state
 */
const mapSessionStatusToAgentState = (status: string): OfficeAgentState => {
  switch (status) {
    case "running":
      return "working";
    case "error":
    case "failed":
      return "error";
    case "done":
    case "idle":
      return "idle";
    default:
      // For unknown status, check if session exists (implies some activity)
      return "idle";
  }
};

/**
 * Get active sessions from the OpenClaw gateway
 */
const getActiveSessionsFromGateway = async (gatewayUrl: string, token: string): Promise<GatewaySession[]> => {
  try {
    const response = await fetch(`${gatewayUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'sessions_list',
        args: { activeMinutes: 120, messageLimit: 0 }
      }),
    });

    if (!response.ok) {
      console.warn(`Gateway sessions API returned ${response.status}: ${response.statusText}`);
      return [];
    }

    const envelope = await response.json() as { ok: boolean; result?: { content?: Array<{ text?: string }> } };
    
    if (!envelope.ok || !envelope.result?.content?.[0]?.text) {
      console.warn('Gateway sessions API returned unexpected format or failed');
      return [];
    }

    // The gateway returns session data as a JSON string inside result.content[0].text
    const parsed = JSON.parse(envelope.result.content[0].text) as GatewaySessionsResponse;
    
    if (!parsed.sessions) {
      return [];
    }

    return parsed.sessions.map(session => ({
      ...session,
      agentId: session.agentId ?? extractAgentIdFromSessionKey(session.key),
    }));
  } catch (error) {
    console.warn('Failed to fetch sessions from gateway:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
};

export const loadOfficePresenceSnapshot = async (workspaceId: string): Promise<OfficePresenceSnapshot> => {
  const configPath = path.join(resolveStateDir(), OPENCLAW_CONFIG_FILENAME);
  const timestamp = new Date().toISOString();
  
  if (!fs.existsSync(configPath)) {
    return {
      workspaceId,
      timestamp,
      agents: [],
    };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const config =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : undefined;

    const agentList = readConfigAgentList(config);
    
    // Get gateway configuration for API access
    const gateway = config?.gateway as Record<string, unknown> | undefined;
    const gatewayPort = (gateway?.port as number) || 18789;
    const gatewayAuth = gateway?.auth as Record<string, unknown> | undefined;
    const gatewayToken = gatewayAuth?.token as string | undefined;
    
    const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;

    // Create a map of agent states - default to idle
    const agentStatesMap = new Map<string, OfficeAgentState>();
    agentList.forEach(agent => {
      agentStatesMap.set(agent.id, "idle");
    });

    // If we have gateway token, fetch real session data
    if (gatewayToken) {
      try {
        const sessions = await getActiveSessionsFromGateway(gatewayUrl, gatewayToken);
        
        // Count child sessions per agent (subagent activity implies "meeting"/collaboration)
        const childCountByAgent = new Map<string, number>();
        sessions.forEach(session => {
          if (session.agentId && session.kind === "subagent") {
            const parent = extractAgentIdFromSessionKey(session.key);
            if (parent) {
              childCountByAgent.set(parent, (childCountByAgent.get(parent) ?? 0) + 1);
            }
          }
        });

        // Update agent states based on active sessions
        sessions.forEach(session => {
          if (session.agentId && agentStatesMap.has(session.agentId)) {
            const state = mapSessionStatusToAgentState(session.status);
            // Agents with active child sessions are "meeting" (collaborating)
            if (state === "working" && (childCountByAgent.get(session.agentId) ?? 0) > 0) {
              agentStatesMap.set(session.agentId, "meeting");
            } else {
              agentStatesMap.set(session.agentId, state);
            }
          }
        });
      } catch (error) {
        console.warn('Failed to fetch gateway sessions, falling back to idle state:', error);
      }
    } else {
      console.warn('No gateway token configured, all agents will show as idle');
    }

    // Build the presence array
    const agents: OfficeAgentPresence[] = agentList.map((entry) => {
      const id = entry.id.trim();
      const nameRaw = typeof entry.name === "string" ? entry.name : id;
      const state = agentStatesMap.get(id) || "idle";
      
      return {
        agentId: id,
        name: nameRaw,
        state,
        preferredDeskId: `desk-${id}`,
      };
    });

    return {
      workspaceId,
      timestamp,
      agents,
    };
  } catch (error) {
    console.error('Error loading office presence snapshot:', error);
    return {
      workspaceId,
      timestamp,
      agents: [],
    };
  }
};
