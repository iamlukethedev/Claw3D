import type { AgentPermissionsDraft } from "@/features/agents/operations/agentPermissionsOperation";
import { sendChatMessageViaStudio } from "@/features/agents/operations/chatSendOperation";
import { buildHistoryLines, type ChatHistoryMessage } from "@/features/agents/state/runtimeEventBridge";
import type { AgentState } from "@/features/agents/state/store";
import type { CommandModeId } from "@/features/agents/operations/agentPermissionsOperation";
import type { TranscriptAppendMeta } from "@/features/agents/state/transcript";

type GatewayClientLike = {
  call: <T = unknown>(method: string, params: unknown) => Promise<T>;
};

type DispatchAction =
  | { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }
  | { type: "appendOutput"; agentId: string; line: string; transcript?: TranscriptAppendMeta };

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const resolveCompanyPlanningAgent = (params: {
  agents: AgentState[];
  preferredAgentId?: string | null;
}) => {
  const preferred = params.preferredAgentId?.trim() ?? "";
  if (preferred) {
    const preferredAgent = params.agents.find((entry) => entry.agentId === preferred) ?? null;
    if (preferredAgent) return preferredAgent;
  }
  return params.agents[0] ?? null;
};

export const buildCompanyRolePermissionsDraft = (
  commandMode: CommandModeId
): AgentPermissionsDraft => ({
  commandMode,
  webAccess: commandMode !== "off",
  fileTools: commandMode !== "off",
});

export async function runOpenClawPlanningPrompt(params: {
  client: GatewayClientLike;
  dispatch: (action: DispatchAction) => void;
  agent: AgentState;
  getAgent: (agentId: string) => AgentState | null;
  clearRunTracking?: (runId: string) => void;
  prompt: string;
  historyLimit?: number;
  timeoutMs?: number;
}): Promise<string> {
  const trimmedPrompt = params.prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("Planning prompt is required.");
  }
  if (params.agent.status === "running") {
    throw new Error(`Wait for ${params.agent.name} to finish the current run first.`);
  }

  await sendChatMessageViaStudio({
    client: params.client,
    dispatch: params.dispatch,
    getAgent: params.getAgent,
    agentId: params.agent.agentId,
    sessionKey: params.agent.sessionKey,
    message: trimmedPrompt,
    clearRunTracking: params.clearRunTracking,
    echoUserMessage: false,
  });

  const timeoutAt = Date.now() + (params.timeoutMs ?? 90_000);
  while (Date.now() < timeoutAt) {
    const liveAgent = params.getAgent(params.agent.agentId);
    if (liveAgent && liveAgent.status !== "running") {
      const history = await params.client.call<{
        sessionKey: string;
        messages: ChatHistoryMessage[];
      }>("chat.history", {
        sessionKey: params.agent.sessionKey,
        limit: params.historyLimit ?? 80,
      });
      const derived = buildHistoryLines(history.messages ?? []);
      if (derived.lastAssistant?.trim()) {
        return derived.lastAssistant.trim();
      }
      throw new Error("The planning agent finished, but no assistant response was available.");
    }
    await sleep(800);
  }

  throw new Error("Timed out while waiting for the planning agent response.");
}
