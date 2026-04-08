export const buildAgentMainSessionKey = (agentId: string, mainKey: string) => {
  const trimmedAgent = agentId.trim();
  const trimmedKey = mainKey.trim() || "main";
  return `agent:${trimmedAgent}:${trimmedKey}`;
};

export const parseAgentIdFromSessionKey = (sessionKey: string): string | null => {
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : null;
};
