import type { AgentFileName } from "@/lib/agents/agentFiles";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

type AgentsFilesGetResponse = {
  workspace?: unknown;
  file?: { missing?: unknown; content?: unknown; path?: unknown };
};

const resolveAgentId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("agentId is required.");
  }
  return trimmed;
};

export const readGatewayAgentFile = async (params: {
  client: GatewayClient;
  agentId: string;
  name: AgentFileName;
}): Promise<{ exists: boolean; content: string; path: string | null; workspace: string | null }> => {
  const agentId = resolveAgentId(params.agentId);
  const response = await params.client.call<AgentsFilesGetResponse>("agents.files.get", {
    agentId,
    name: params.name,
  });
  const file = response?.file;
  const fileRecord = file && typeof file === "object" ? (file as Record<string, unknown>) : null;
  const missing = fileRecord?.missing === true;
  const content =
    fileRecord && typeof fileRecord.content === "string" ? fileRecord.content : "";
  const path =
    fileRecord && typeof fileRecord.path === "string" ? fileRecord.path : null;
  const workspace =
    typeof response?.workspace === "string" ? response.workspace : null;
  return { exists: !missing, content, path, workspace };
};

export const writeGatewayAgentFile = async (params: {
  client: GatewayClient;
  agentId: string;
  name: AgentFileName;
  content: string;
}): Promise<void> => {
  const agentId = resolveAgentId(params.agentId);
  await params.client.call("agents.files.set", {
    agentId,
    name: params.name,
    content: params.content,
  });
};

export const writeGatewayAgentFiles = async (params: {
  client: GatewayClient;
  agentId: string;
  files: Partial<Record<AgentFileName, string>>;
}): Promise<void> => {
  const agentId = resolveAgentId(params.agentId);
  const entries = Object.entries(params.files).filter(
    (entry): entry is [AgentFileName, string] => typeof entry[1] === "string"
  );
  for (const [name, content] of entries) {
    await params.client.call("agents.files.set", {
      agentId,
      name,
      content,
    });
  }
};
