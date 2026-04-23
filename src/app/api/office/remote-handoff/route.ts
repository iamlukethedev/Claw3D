import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { NodeGatewayClient } from "@/lib/gateway/nodeGatewayClient";
import { sendAgentHandoffViaRuntime } from "@/lib/runtime/agentMessaging";
import { loadStudioSettings } from "@/lib/studio/settings-store";
import { resolveOfficePreference } from "@/lib/studio/settings";

export const runtime = "nodejs";
const MAX_REMOTE_MESSAGE_CHARS = 2_000;

const stripRemoteAgentPrefix = (agentId: string) =>
  agentId.startsWith("remote:") ? agentId.slice("remote:".length) : agentId;

export async function POST(request: Request) {
  const gatewayClient = new NodeGatewayClient();
  try {
    const body = (await request.json()) as {
      agentId?: unknown;
      task?: unknown;
      context?: unknown;
      deliverables?: unknown;
      acceptanceCriteria?: unknown;
    };
    const requestedAgentId =
      typeof body.agentId === "string" ? stripRemoteAgentPrefix(body.agentId.trim()) : "";
    const task = typeof body.task === "string" ? body.task.trim() : "";
    const context = typeof body.context === "string" ? body.context.trim() : "";
    const acceptanceCriteria =
      typeof body.acceptanceCriteria === "string" ? body.acceptanceCriteria.trim() : "";
    const deliverables = Array.isArray(body.deliverables)
      ? body.deliverables.filter((entry): entry is string => typeof entry === "string")
      : [];

    if (!requestedAgentId) {
      return NextResponse.json({ error: "Remote agent ID is required." }, { status: 400 });
    }
    if (!task) {
      return NextResponse.json({ error: "Remote handoff task is required." }, { status: 400 });
    }
    if (task.length > MAX_REMOTE_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Remote handoff must be ${MAX_REMOTE_MESSAGE_CHARS} characters or fewer.` },
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
        { error: "Remote handoffs currently work only with the remote gateway source." },
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

    const handoffResult = (await sendAgentHandoffViaRuntime(
      { call: gatewayClient.request.bind(gatewayClient) },
      {
        targetAgentId: requestedAgentId,
        task,
        sourceLabel: "another office user",
        context: context || undefined,
        acceptanceCriteria: acceptanceCriteria || undefined,
        deliverables,
        idempotencyKey: randomUUID(),
      },
    )) as { runId?: string; status?: string };

    return NextResponse.json({
      ok: true,
      agentId: requestedAgentId,
      runId:
        typeof handoffResult?.runId === "string" && handoffResult.runId.trim()
          ? handoffResult.runId.trim()
          : null,
      status: typeof handoffResult?.status === "string" ? handoffResult.status : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send remote office handoff.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    gatewayClient.close();
  }
}
