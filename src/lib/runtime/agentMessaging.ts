import { buildAgentMainSessionKey, parseAgentIdFromSessionKey } from "@/lib/gateway/GatewayClient";
import { buildAgentInstruction } from "@/lib/text/message-extract";
import { randomUUID } from "@/lib/uuid";

export type RuntimeAgentMessageMode = "direct" | "interval";

export type RuntimeAgentMessagePayload = {
  targetAgentId: string;
  message: string;
  sourceAgentId?: string | null;
  sourceLabel?: string | null;
  mode?: RuntimeAgentMessageMode;
  cadenceHint?: string | null;
  idempotencyKey?: string | null;
};

export type RuntimeAgentHandoffPayload = {
  targetAgentId: string;
  task: string;
  sourceAgentId?: string | null;
  sourceLabel?: string | null;
  context?: string | null;
  deliverables?: string[];
  acceptanceCriteria?: string | null;
  idempotencyKey?: string | null;
};

type GatewayCallLike = {
  call: <T = unknown>(method: string, params: unknown) => Promise<T>;
};

type GatewayAgentsListResult = {
  mainKey?: string;
  agents?: Array<{ id?: string; name?: string }>;
};

const resolveLabel = (sourceAgentId?: string | null, sourceLabel?: string | null) =>
  sourceLabel?.trim() || sourceAgentId?.trim() || "another agent";

export const buildDirectedAgentMessageInstruction = (
  payload: RuntimeAgentMessagePayload,
): string => {
  const mode = payload.mode ?? "direct";
  const sourceLabel = resolveLabel(payload.sourceAgentId, payload.sourceLabel);
  const message = payload.message.trim();
  const cadenceHint = payload.cadenceHint?.trim();
  if (mode === "interval") {
    return [
      `You received an interval coordination message from ${sourceLabel}.`,
      "Treat this as an ongoing collaboration thread instead of a one-off interruption.",
      "Respond in plain text with the next useful update, question, or checkpoint.",
      cadenceHint ? `Cadence hint: ${cadenceHint}` : null,
      "",
      `Message: ${message}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `You received a direct agent message from ${sourceLabel}.`,
    "Reply in plain text only and stay focused on the request.",
    "Do not use tools unless the runtime already allows them for this session.",
    "",
    `Message: ${message}`,
  ].join("\n");
};

export const buildAgentHandoffInstruction = (
  payload: RuntimeAgentHandoffPayload,
): string => {
  const sourceLabel = resolveLabel(payload.sourceAgentId, payload.sourceLabel);
  const task = payload.task.trim();
  const context = payload.context?.trim();
  const acceptanceCriteria = payload.acceptanceCriteria?.trim();
  const deliverables =
    payload.deliverables?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  return [
    `You received a work handoff from ${sourceLabel}.`,
    "Acknowledge ownership, then continue the work in plain text.",
    "If anything is ambiguous, ask one focused clarification question instead of guessing.",
    "",
    `Task: ${task}`,
    context ? `Context: ${context}` : null,
    acceptanceCriteria ? `Acceptance criteria: ${acceptanceCriteria}` : null,
    deliverables.length > 0 ? "Deliverables:\n- " + deliverables.join("\n- ") : null,
  ]
    .filter(Boolean)
    .join("\n");
};

const resolveSessionKeyFromAgentList = async (
  client: GatewayCallLike,
  targetAgentId: string,
): Promise<string> => {
  const agentsResult = await client.call<GatewayAgentsListResult>("agents.list", {});
  const remoteAgents = Array.isArray(agentsResult.agents) ? agentsResult.agents : [];
  if (!remoteAgents.some((entry) => (entry.id?.trim() ?? "") === targetAgentId)) {
    throw new Error("Target agent is no longer available.");
  }
  return buildAgentMainSessionKey(targetAgentId, agentsResult.mainKey?.trim() || "main");
};

export const sendDirectedAgentMessageViaRuntime = async (
  client: GatewayCallLike,
  payload: RuntimeAgentMessagePayload,
) => {
  const targetAgentId = payload.targetAgentId.trim();
  const message = payload.message.trim();
  if (!targetAgentId || !message) {
    throw new Error("Target agent and message are required.");
  }
  const sessionKey = await resolveSessionKeyFromAgentList(client, targetAgentId);
  return client.call("chat.send", {
    sessionKey,
    message: buildAgentInstruction({
      message: buildDirectedAgentMessageInstruction(payload),
    }),
    deliver: false,
    echoUserMessage: false,
    sourceAgentId: payload.sourceAgentId?.trim() || parseAgentIdFromSessionKey(sessionKey),
    idempotencyKey: payload.idempotencyKey?.trim() || randomUUID(),
  });
};

export const sendAgentHandoffViaRuntime = async (
  client: GatewayCallLike,
  payload: RuntimeAgentHandoffPayload,
) => {
  const targetAgentId = payload.targetAgentId.trim();
  const task = payload.task.trim();
  if (!targetAgentId || !task) {
    throw new Error("Target agent and handoff task are required.");
  }
  const sessionKey = await resolveSessionKeyFromAgentList(client, targetAgentId);
  return client.call("chat.send", {
    sessionKey,
    message: buildAgentInstruction({
      message: buildAgentHandoffInstruction(payload),
    }),
    deliver: false,
    echoUserMessage: false,
    sourceAgentId: payload.sourceAgentId?.trim() || parseAgentIdFromSessionKey(sessionKey),
    idempotencyKey: payload.idempotencyKey?.trim() || randomUUID(),
  });
};
