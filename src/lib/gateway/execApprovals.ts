import { GatewayResponseError } from "@/lib/gateway/errors";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

export type GatewayExecApprovalSecurity = "deny" | "allowlist" | "full";
export type GatewayExecApprovalAsk = "off" | "on-miss" | "always";

type ExecAllowlistEntry = {
  id?: string;
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
};

type ExecApprovalsAgent = {
  security?: GatewayExecApprovalSecurity;
  ask?: GatewayExecApprovalAsk;
  askFallback?: string;
  autoAllowSkills?: boolean;
  allowlist?: ExecAllowlistEntry[];
};

type ExecApprovalsFile = {
  version: 1;
  socket?: {
    path?: string;
    token?: string;
  };
  defaults?: {
    security?: string;
    ask?: string;
    askFallback?: string;
    autoAllowSkills?: boolean;
  };
  agents?: Record<string, ExecApprovalsAgent>;
};

type ExecApprovalsSnapshot = {
  path: string;
  exists: boolean;
  hash: string;
  file?: ExecApprovalsFile;
};

const shouldRetrySet = (err: unknown): boolean => {
  if (!(err instanceof GatewayResponseError)) return false;
  return /re-run exec\.approvals\.get|changed since last load/i.test(err.message);
};

const normalizeAllowlist = (patterns: Array<{ pattern: string }>): Array<{ pattern: string }> => {
  const next = patterns
    .map((entry) => entry.pattern.trim())
    .filter((pattern) => pattern.length > 0);
  return Array.from(new Set(next)).map((pattern) => ({ pattern }));
};

const setExecApprovalsWithRetry = async (params: {
  client: GatewayClient;
  file: ExecApprovalsFile;
  baseHash?: string | null;
  exists?: boolean;
  attempt?: number;
}): Promise<void> => {
  const attempt = params.attempt ?? 0;
  const requiresBaseHash = params.exists !== false;
  const baseHash = requiresBaseHash ? params.baseHash?.trim() : undefined;
  if (requiresBaseHash && !baseHash) {
    throw new Error("Exec approvals hash unavailable; re-run exec.approvals.get.");
  }
  const payload: Record<string, unknown> = { file: params.file };
  if (baseHash) payload.baseHash = baseHash;
  try {
    await params.client.call("exec.approvals.set", payload);
  } catch (err) {
    if (attempt < 1 && shouldRetrySet(err)) {
      const snapshot = await params.client.call<ExecApprovalsSnapshot>("exec.approvals.get", {});
      return setExecApprovalsWithRetry({
        ...params,
        baseHash: snapshot.hash ?? undefined,
        exists: snapshot.exists,
        attempt: attempt + 1,
      });
    }
    throw err;
  }
};

export async function upsertGatewayAgentExecApprovals(params: {
  client: GatewayClient;
  agentId: string;
  policy: {
    security: GatewayExecApprovalSecurity;
    ask: GatewayExecApprovalAsk;
    allowlist: Array<{ pattern: string }>;
  } | null;
}): Promise<void> {
  const agentId = params.agentId.trim();
  if (!agentId) {
    throw new Error("Agent id is required.");
  }

  const snapshot = await params.client.call<ExecApprovalsSnapshot>("exec.approvals.get", {});
  const baseFile: ExecApprovalsFile =
    snapshot.file && typeof snapshot.file === "object"
      ? {
          version: 1,
          socket: snapshot.file.socket,
          defaults: snapshot.file.defaults,
          agents: { ...(snapshot.file.agents ?? {}) },
        }
      : { version: 1, agents: {} };

  const nextAgents = { ...(baseFile.agents ?? {}) };
  if (!params.policy) {
    if (!(agentId in nextAgents)) {
      return;
    }
    delete nextAgents[agentId];
  } else {
    const existing = nextAgents[agentId] ?? {};
    nextAgents[agentId] = {
      ...existing,
      security: params.policy.security,
      ask: params.policy.ask,
      allowlist: normalizeAllowlist(params.policy.allowlist),
    };
  }

  const nextFile: ExecApprovalsFile = {
    ...baseFile,
    version: 1,
    agents: nextAgents,
  };

  await setExecApprovalsWithRetry({
    client: params.client,
    file: nextFile,
    baseHash: snapshot.hash,
    exists: snapshot.exists,
  });
}

export async function readGatewayAgentExecApprovals(params: {
  client: GatewayClient;
  agentId: string;
}): Promise<{
  security: GatewayExecApprovalSecurity | null;
  ask: GatewayExecApprovalAsk | null;
  allowlist: Array<{ pattern: string }>;
} | null> {
  const agentId = params.agentId.trim();
  if (!agentId) {
    throw new Error("Agent id is required.");
  }

  const snapshot = await params.client.call<ExecApprovalsSnapshot>("exec.approvals.get", {});
  const entry = snapshot.file?.agents?.[agentId];
  if (!entry) return null;

  const security =
    entry.security === "deny" || entry.security === "allowlist" || entry.security === "full"
      ? entry.security
      : null;
  const ask = entry.ask === "off" || entry.ask === "on-miss" || entry.ask === "always" ? entry.ask : null;
  const allowlist = Array.isArray(entry.allowlist)
    ? entry.allowlist
        .map((item) => (item && typeof item === "object" ? (item as ExecAllowlistEntry).pattern : ""))
        .filter((pattern): pattern is string => typeof pattern === "string")
        .map((pattern) => pattern.trim())
        .filter((pattern) => pattern.length > 0)
        .map((pattern) => ({ pattern }))
    : [];

  return {
    security,
    ask,
    allowlist,
  };
}
