import { NextResponse } from "next/server";

import { restoreAgentStateLocally, trashAgentStateLocally } from "@/lib/agent-state/local";
import { isLikelyLocalGatewayUrl } from "@/lib/gateway/local-gateway";
import {
  resolveConfiguredSshTarget,
  resolveGatewaySshTargetFromGatewayUrl,
} from "@/lib/ssh/gateway-host";
import {
  restoreAgentStateOverSsh,
  trashAgentStateOverSsh,
} from "@/lib/ssh/agent-state";
import { loadStudioSettings } from "@/lib/studio/settings-store";

export const runtime = "nodejs";

type TrashAgentStateRequest = {
  agentId: string;
};

type RestoreAgentStateRequest = {
  agentId: string;
  trashDir: string;
};

const isSafeAgentId = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);

const resolveAgentStateSshTarget = (): string | null => {
  const configured = resolveConfiguredSshTarget(process.env);
  if (configured) return configured;
  const settings = loadStudioSettings();
  const gatewayUrl = settings.gateway?.url ?? "";
  if (isLikelyLocalGatewayUrl(gatewayUrl)) return null;
  return resolveGatewaySshTargetFromGatewayUrl(gatewayUrl, process.env);
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }
    const { agentId } = body as Partial<TrashAgentStateRequest>;
    const trimmed = typeof agentId === "string" ? agentId.trim() : "";
    if (!trimmed) {
      return NextResponse.json({ error: "agentId is required." }, { status: 400 });
    }
    if (!isSafeAgentId(trimmed)) {
      return NextResponse.json({ error: `Invalid agentId: ${trimmed}` }, { status: 400 });
    }

    const sshTarget = resolveAgentStateSshTarget();
    const result = sshTarget
      ? trashAgentStateOverSsh({ sshTarget, agentId: trimmed })
      : trashAgentStateLocally({ agentId: trimmed });
    return NextResponse.json({ result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to trash agent workspace/state.";
    console.error(message);
    const status =
      message.includes("Invalid request payload") ||
      message.includes("agentId is required") ||
      message.includes("trashDir is required") ||
      message.includes("Invalid agentId") ||
      message.includes("trashDir does not exist") ||
      message.includes("trashDir is not under") ||
      message.includes("Refusing to restore over existing path") ||
      message.includes("Gateway URL is missing") ||
      message.includes("Invalid gateway URL") ||
      message.includes("require OPENCLAW_GATEWAY_SSH_TARGET")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }
    const { agentId, trashDir } = body as Partial<RestoreAgentStateRequest>;
    const trimmedAgent = typeof agentId === "string" ? agentId.trim() : "";
    const trimmedTrash = typeof trashDir === "string" ? trashDir.trim() : "";
    if (!trimmedAgent) {
      return NextResponse.json({ error: "agentId is required." }, { status: 400 });
    }
    if (!trimmedTrash) {
      return NextResponse.json({ error: "trashDir is required." }, { status: 400 });
    }
    const SAFE_TRASH_DIR_RE = /^[a-zA-Z0-9_.~\/-]+$/;
    if (!SAFE_TRASH_DIR_RE.test(trimmedTrash)) {
      return NextResponse.json({ error: "trashDir contains invalid characters." }, { status: 400 });
    }
    if (!isSafeAgentId(trimmedAgent)) {
      return NextResponse.json({ error: `Invalid agentId: ${trimmedAgent}` }, { status: 400 });
    }

    const sshTarget = resolveAgentStateSshTarget();
    const result = sshTarget
      ? restoreAgentStateOverSsh({
          sshTarget,
          agentId: trimmedAgent,
          trashDir: trimmedTrash,
        })
      : restoreAgentStateLocally({
          agentId: trimmedAgent,
          trashDir: trimmedTrash,
        });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to restore agent state.";
    console.error(message);
    const status =
      message.includes("Invalid request payload") ||
      message.includes("agentId is required") ||
      message.includes("trashDir is required") ||
      message.includes("Invalid agentId") ||
      message.includes("Gateway URL is missing") ||
      message.includes("Invalid gateway URL") ||
      message.includes("require OPENCLAW_GATEWAY_SSH_TARGET")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
