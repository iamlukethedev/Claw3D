import type { FurnitureItem } from "@/features/retro-office/core/types";

export type OfficeLayoutSnapshot = {
  gatewayUrl: string;
  timestamp: string;
  width: number;
  height: number;
  furniture: FurnitureItem[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const normalizeOfficeLayoutSnapshot = (
  value: unknown,
  fallbackGatewayUrl = "",
): OfficeLayoutSnapshot | null => {
  if (!isRecord(value)) return null;
  const gatewayUrl =
    typeof value.gatewayUrl === "string" && value.gatewayUrl.trim().length > 0
      ? value.gatewayUrl.trim()
      : fallbackGatewayUrl.trim();
  const timestamp =
    typeof value.timestamp === "string" && value.timestamp.trim().length > 0
      ? value.timestamp
      : new Date().toISOString();
  const width =
    typeof value.width === "number" && Number.isFinite(value.width) && value.width > 0
      ? value.width
      : 1800;
  const height =
    typeof value.height === "number" && Number.isFinite(value.height) && value.height > 0
      ? value.height
      : 720;
  const furniture = Array.isArray(value.furniture)
    ? value.furniture.filter((item): item is FurnitureItem => isRecord(item))
    : [];
  return {
    gatewayUrl,
    timestamp,
    width,
    height,
    furniture,
  };
};

export const deriveRemoteLayoutUrlFromPresenceUrl = (presenceUrl: string) => {
  const trimmed = presenceUrl.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    parsed.pathname = parsed.pathname.replace(/\/presence\/?$/, "/layout");
    parsed.searchParams.delete("source");
    return parsed.toString();
  } catch {
    return trimmed.replace(/\/presence\/?$/, "/layout");
  }
};
