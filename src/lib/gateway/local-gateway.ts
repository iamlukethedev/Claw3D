const parseHostname = (gatewayUrl: string): string | null => {
  const trimmed = gatewayUrl.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).hostname;
  } catch {
    return null;
  }
};

export const isLocalGatewayUrl = (gatewayUrl: string): boolean => {
  const hostname = parseHostname(gatewayUrl);
  if (!hostname) return false;
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0.0.0.0"
  );
};
