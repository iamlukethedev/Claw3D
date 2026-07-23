import { spawn } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORKSPACE_ROOT = "/Users/escobarjr/EscobarOS/workspace";
const OPENCLAW_CATALOG_PATH = "/Users/escobarjr/.openclaw/openclaw.json";
const ROUTING_RULES_PATH = `${WORKSPACE_ROOT}/config/delegation-routes.json`;
const DELEGATION_OUTPUT_ROOT = `${WORKSPACE_ROOT}/outputs/openclaw/delegations`;
const DELEGATION_LOG_PATH = `${DELEGATION_OUTPUT_ROOT}/delegation_log.jsonl`;
const LATEST_DELEGATION_PATH = `${DELEGATION_OUTPUT_ROOT}/latest_delegation.json`;
function delegateNowScriptPath(): string {
  return [
    WORKSPACE_ROOT,
    "scripts",
    "openclaw-agent-delegate-now.mjs",
  ].join("/");
}
const MAX_MESSAGE_LENGTH = 400;
const AGENT_TIMEOUT_SECONDS = 45;

type OpenClawCatalog = {
  agents?: {
    list?: Array<{
      id?: string;
      name?: string | null;
      identity?: {
        name?: string;
      };
    }>;
  };
};

type RoutingConfig = {
  routes?: Array<{
    id?: string;
    agentId?: string;
    specialistAgentId?: string;
    agentName?: string;
    reason?: string;
  }>;
};

type DelegationEvent = {
  id: string;
  createdAt: string;
  event: "sent" | "responded" | "failed";
  agentId: string;
  agentName: string;
  task: string;
  reason: string;
  decision: string;
  details: Record<string, unknown>;
};

function wantsJson(request: NextRequest): boolean {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function isValidAgentId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,80}$/.test(value);
}

function isValidRouteId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_.:-]{1,120}$/.test(value);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function resolveTarget(params: { agentId: string; routeId: string }) {
  const [catalog, routing] = await Promise.all([
    readJsonFile<OpenClawCatalog>(OPENCLAW_CATALOG_PATH),
    readJsonFile<RoutingConfig>(ROUTING_RULES_PATH),
  ]);
  const route = params.routeId
    ? (routing?.routes ?? []).find((entry) => entry.id === params.routeId)
    : null;
  const agentId = route?.agentId || route?.specialistAgentId || params.agentId;
  const catalogAgent = (catalog?.agents?.list ?? []).find((agent) => agent.id === agentId);

  return {
    agentId,
    agentName: route?.agentName || catalogAgent?.identity?.name || catalogAgent?.name || agentId,
    routeId: route?.id,
    reason: route?.reason || "Delegacao manual enviada pelo Mission Control.",
    knownAgent: Boolean(catalogAgent),
    knownRoute: params.routeId ? Boolean(route) : true,
  };
}

async function appendDelegationEvent(event: DelegationEvent) {
  await mkdir(DELEGATION_OUTPUT_ROOT, { recursive: true });
  await appendFile(DELEGATION_LOG_PATH, `${JSON.stringify(event)}\n`, "utf8");
  await writeFile(LATEST_DELEGATION_PATH, `${JSON.stringify(event, null, 2)}\n`, "utf8");
}

async function parseRequest(request: NextRequest) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json();
    return {
      agentId: String(body?.agentId || "").trim(),
      routeId: String(body?.routeId || "").trim(),
      message: String(body?.message || "").trim(),
    };
  }

  const form = await request.formData();
  return {
    agentId: String(form.get("agentId") || "").trim(),
    routeId: String(form.get("routeId") || "").trim(),
    message: String(form.get("message") || "").trim(),
  };
}

export async function POST(request: NextRequest) {
  const { agentId, routeId, message } = await parseRequest(request);
  const json = wantsJson(request);

  if (!message) {
    return NextResponse.json({ error: "message vazio" }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `message acima de ${MAX_MESSAGE_LENGTH} caracteres` }, { status: 400 });
  }

  if ((agentId ? 1 : 0) + (routeId ? 1 : 0) !== 1) {
    return NextResponse.json({ error: "envie exatamente um de agentId ou routeId" }, { status: 400 });
  }

  if (agentId && !isValidAgentId(agentId)) {
    return NextResponse.json({ error: "agentId invalido" }, { status: 400 });
  }

  if (routeId && !isValidRouteId(routeId)) {
    return NextResponse.json({ error: "routeId invalido" }, { status: 400 });
  }

  const target = await resolveTarget({ agentId, routeId });
  if (!target.knownRoute) {
    return NextResponse.json({ error: "routeId nao encontrado" }, { status: 404 });
  }

  if (!target.agentId || !isValidAgentId(target.agentId) || !target.knownAgent) {
    return NextResponse.json({ error: "agente nao encontrado no catalogo" }, { status: 404 });
  }

  const runId = `delegate-now-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const task = `Delegar agora [${runId.slice(-8)}]: ${message}`;
  const requestedAt = new Date().toISOString();
  const baseDetails = {
    source: "mission-control-delegate-now",
    mode: "async",
    manualDelegateNow: true,
    runId,
    routeId: target.routeId,
    message,
    requestedAt,
    channel: "sessions_send/openclaw-agent",
    timeoutSeconds: AGENT_TIMEOUT_SECONDS,
  };

  const sentEvent: DelegationEvent = {
    id: `${runId}:sent`,
    createdAt: requestedAt,
    event: "sent",
    agentId: target.agentId,
    agentName: target.agentName,
    task,
    reason: target.reason,
    decision: "Delegacao manual enviada pelo Mission Control.",
    details: baseDetails,
  };
  await appendDelegationEvent(sentEvent);

  try {
    const child = spawn("node", [
      delegateNowScriptPath(),
      "--agent-id",
      target.agentId,
      "--agent-name",
      target.agentName,
      "--route-id",
      target.routeId ?? "manual",
      "--run-id",
      runId,
      "--task",
      task,
      "--reason",
      target.reason,
      "--timeout-seconds",
      String(AGENT_TIMEOUT_SECONDS),
      "--message",
      message,
    ], {
      cwd: WORKSPACE_ROOT,
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    const response = {
      ok: true,
      runId,
      status: "queued",
      agentId: target.agentId,
      agentName: target.agentName,
      routeId: target.routeId,
      message,
      detail: "Delegacao enfileirada. A resposta ou falha sera registrada na fila quando o agente terminar.",
      channel: "sessions_send/openclaw-agent",
    };

    return json
      ? NextResponse.json(response)
      : NextResponse.redirect(new URL("/operations#delegacao-real", request.url), 303);
  } catch (error) {
    const completedAt = new Date().toISOString();
    const rawError = error instanceof Error ? error.message : String(error);
    const event: DelegationEvent = {
      id: `${runId}:failed`,
      createdAt: completedAt,
      event: "failed",
      agentId: target.agentId,
      agentName: target.agentName,
      task,
      reason: target.reason,
      decision: rawError,
      details: {
        ...baseDetails,
        status: "failed",
        completedAt,
        error: rawError,
      },
    };
    await appendDelegationEvent(event);

    const response = {
      ok: false,
      runId,
      status: "failed",
      agentId: target.agentId,
      agentName: target.agentName,
      routeId: target.routeId,
      message,
      error: rawError,
      channel: "sessions_send/openclaw-agent",
    };

    return json
      ? NextResponse.json(response, { status: 502 })
      : NextResponse.redirect(new URL("/operations#delegacao-real", request.url), 303);
  }
}
