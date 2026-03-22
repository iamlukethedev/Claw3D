import { isLocalGatewayUrl } from "@/lib/gateway/local-gateway";

const SCREENSHOT_ONLY_HOSTS = [
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)threads\.net$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)tiktok\.com$/i,
];

export const shouldPreferBrowserScreenshot = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  try {
    const hostname = new URL(trimmed).hostname;
    return SCREENSHOT_ONLY_HOSTS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
};

const normalizeLoopbackHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "0.0.0.0" ? "127.0.0.1" : hostname;
};

export const resolveBrowserControlBaseUrl = (gatewayUrl: string | null | undefined): string | null => {
  const trimmed = gatewayUrl?.trim();
  if (!trimmed || !isLocalGatewayUrl(trimmed)) return null;
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

export const normalizeBrowserPreviewUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    const normalized = parsed.toString();
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return value.trim();
  }
};
