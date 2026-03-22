import fs from "node:fs";
import net from "node:net";

const WSL_GATEWAY_HOST_ENV = "OPENCLAW_GATEWAY_HOST";
const WSL_RESOLV_CONF_PATH = "/etc/resolv.conf";

const parseHostname = (gatewayUrl: string): string | null => {
  const trimmed = gatewayUrl.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).hostname;
  } catch {
    return null;
  }
};

const resolveConfiguredGatewayHost = (): string => {
  const override = process.env[WSL_GATEWAY_HOST_ENV]?.trim();
  if (override) return override;

  const isWsl = Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);
  if (!isWsl) return "localhost";

  try {
    const resolvConf = fs.readFileSync(WSL_RESOLV_CONF_PATH, "utf8");
    const match = resolvConf.match(/^\s*nameserver\s+(\S+)\s*$/m);
    const host = match?.[1]?.trim() ?? "";
    if (host && net.isIP(host) > 0) {
      return host;
    }
  } catch {}

  return "localhost";
};

export const isLocalGatewayUrlForServer = (gatewayUrl: string): boolean => {
  const hostname = parseHostname(gatewayUrl);
  if (!hostname) return false;
  const normalized = hostname.trim().toLowerCase();
  const configuredHost = resolveConfiguredGatewayHost().trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    normalized === configuredHost
  );
};

const normalizeLoopbackHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "0.0.0.0" ? "127.0.0.1" : hostname;
};

export const resolveBrowserControlBaseUrlForServer = (
  gatewayUrl: string | null | undefined
): string | null => {
  const trimmed = gatewayUrl?.trim();
  if (!trimmed || !isLocalGatewayUrlForServer(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol === "wss:" ? "https:" : "http:";
    const port = parsed.port
      ? Number(parsed.port)
      : parsed.protocol === "wss:"
        ? 443
        : 80;
    if (!Number.isFinite(port)) return null;
    const controlPort = port + 2;
    return `${protocol}//${normalizeLoopbackHostname(parsed.hostname)}:${controlPort}`;
  } catch {
    return null;
  }
};
