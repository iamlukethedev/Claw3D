import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { NodeGatewayClient, buildAgentMainSessionKey } from "@/lib/gateway/nodeGatewayClient";
import { loadStudioSettings } from "@/lib/studio/settings-store";
import { resolveOfficePreference } from "@/lib/studio/settings";
import { buildDirectedAgentMessageInstruction, type RuntimeAgentMessageMode } from "@/lib/runtime/agentMessaging";

export const runtime = "nodejs";
const MAX_REMOTE_MESSAGE_CHARS = 2_000;

type AgentsListResult = {
  mainKey?: string;
  agents?: Array<{ id?: string; name?: string }>;
};

const resolveLatestAssistantHistoryText = (messages: unknown): string | null => {
  const entries = Array.isArray(messages) ? messages : [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry || typeof entry !== "object") continue;
    const role = "role" in entry && typeof entry.role === "string" ? entry.role : null;
    if (role !== "assistant") continue;
    const content =
      "content" in entry && typeof entry.content === "string"
        ? entry.content.trim()
        : "text" in entry && typeof entry.text === "string"
          ? entry.text.trim()
          : "";
    if (content) return content;
  }
  return null;
};

const stripRemoteAgentPrefix = (agentId: string) =>
  agentId.startsWith("remote:") ? agentId.slice("remote:".length) : agentId;

export async function POST(request: Request) {
  const gatewayClient = new NodeGatewayClient();
  try {
    const body = (await request.json()) as {
      agentId?: unknown;
      message?: unknown;
      mode?: unknown;
    };
    const requestedAgentId =
      typeof body.agentId === "string" ? stripRemoteAgentPrefix(body.agentId.trim()) : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const mode: RuntimeAgentMessageMode = body.mode === "interval" ? "interval" : "direct";
    if (!requestedAgentId) {
      return NextResponse.json({ error: "Remote agent ID is required." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Remote message is required." }, { status: 400 });
    }
    if (message.length > MAX_REMOTE_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Remote message must be ${MAX_REMOTE_MESSAGE_CHARS} characters or fewer.` },
        { status: 400 },
      );
    }

    const settings = loadStudioSettings();
    const gatewayUrl = settings.gateway?.url?.trim() || "";
    const officePreference = resolveOfficePreference(settings, gatewayUrl);
    if (!officePreference.remoteOfficeEnabled) {
      return NextResponse.json({ error: "Remote office is disabled." }, { status: 400 });
    }
    if (officePreference.remoteOfficeSourceKind !== "openclaw_gateway") {
      return NextResponse.json(
        { error: "Remote messaging currently works only with the remote gateway source." },
        { status: 400 },
      );
    }
    const remoteGatewayUrl = officePreference.remoteOfficeGatewayUrl.trim();
    if (!remoteGatewayUrl) {
      return NextResponse.json(
        { error: "Remote office gateway URL is not configured." },
        { status: 400 },
      );
    }

    await gatewayClient.connect({
      gatewayUrl: remoteGatewayUrl,
      token: officePreference.remoteOfficeToken,
    });

    const agentsResult = await gatewayClient.request<AgentsListResult>("agents.list", {});
    const mainKey = agentsResult.mainKey?.trim() || "main";
    const remoteAgents = Array.isArray(agentsResult.agents) ? agentsResult.agents : [];
    if (remoteAgents.length === 0) {
      return NextResponse.json(
        { error: "Remote agent list is unavailable right now." },
        { status: 503 },
      );
    }
    if (!remoteAgents.some((agent) => (agent.id?.trim() ?? "") === requestedAgentId)) {
      return NextResponse.json({ error: "Remote agent is no longer available." }, { status: 404 });
    }

    const sessionKey = buildAgentMainSessionKey(requestedAgentId, mainKey);
    const sendResult = (await gatewayClient.request("chat.send", {
      sessionKey,
      message: buildDirectedAgentMessageInstruction({
        targetAgentId: requestedAgentId,
        message,
        mode,
        sourceLabel: "another office user",
      }),
      deliver: false,
      idempotencyKey: randomUUID(),
    })) as { runId?: string; status?: string };
    const runId =
      typeof sendResult?.runId === "string" && sendResult.runId.trim()
        ? sendResult.runId.trim()
        : null;
    if (runId) {
      await gatewayClient.request("agent.wait", {
        runId,
        timeoutMs: mode === "interval" ? 8_000 : 15_000,
      });
    }
    const historyResult = (await gatewayClient.request("chat.history", {
      sessionKey,
      limit: 8,
    })) as { messages?: unknown };
    const assistantText = resolveLatestAssistantHistoryText(historyResult.messages);

    return NextResponse.json({
      ok: true,
      agentId: requestedAgentId,
      sessionKey,
      assistantText,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send remote office message.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    gatewayClient.close();
  }
}
