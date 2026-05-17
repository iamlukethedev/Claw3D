const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const isLocalPage = (): boolean => {
  try {
    const hostname = window.location.hostname;
    return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".home");
  } catch {
    return false;
  }
};

export const resolveStudioProxyGatewayUrl = (upstreamGatewayUrl?: string): string => {
  const raw = typeof upstreamGatewayUrl === "string" ? upstreamGatewayUrl.trim() : "";
  if (raw && isLocalPage()) {
    try {
      const parsed = new URL(raw);
      if (LOOPBACK_HOSTS.has(parsed.hostname)) {
        return raw;
      }
    } catch {
      // Fall through to the Studio proxy for malformed or non-URL values.
    }
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  return `${protocol}://${host}/api/gateway/ws`;
};

