import dns from "node:dns/promises";
import net from "node:net";
import type { NextRequest } from "next/server";
import { hasLaunchOperatorSession } from "@/features/crypto/server/launch/session";

type RateWindow = {
  count: number;
  resetAt: number;
};

const prepareRateWindowByIp = new Map<string, RateWindow>();
const submitRateWindowByIp = new Map<string, RateWindow>();

const PREPARE_WINDOW_MS = 60_000;
const PREPARE_LIMIT = 10;
const SUBMIT_WINDOW_MS = 60_000;
const SUBMIT_LIMIT = 20;
const LOGO_FETCH_TIMEOUT_MS = 8_000;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export type LaunchRequestContext = {
  requestIp: string | null;
  userAgent: string | null;
  hasOperatorSession: boolean;
};

export type LogoFetchResult = {
  blob: Blob;
  mimeType: string;
};

export const getLaunchRequestContext = (request: NextRequest): LaunchRequestContext => ({
  requestIp:
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null,
  userAgent: request.headers.get("user-agent")?.trim() || null,
  hasOperatorSession: hasLaunchOperatorSession(request),
});

export const assertServerSideLaunchAuthorized = (ctx: LaunchRequestContext) => {
  const enabled = process.env.CRYPTO_LAUNCH_SERVER_MODE_ENABLED === "true";
  if (!enabled) {
    throw new Error("Server-side token launches are disabled on this deployment.");
  }
  const configuredToken = process.env.CRYPTO_LAUNCH_ADMIN_TOKEN?.trim() || "";
  if (configuredToken) {
    throw new Error(
      "CRYPTO_LAUNCH_ADMIN_TOKEN is deprecated. Use the launch operator session flow instead.",
    );
  }
  if (!ctx.hasOperatorSession) {
    throw new Error("An authenticated launch operator session is required for server-side launches.");
  }
};

const consumeWindow = (
  bucket: Map<string, RateWindow>,
  key: string,
  limit: number,
  windowMs: number,
) => {
  const now = Date.now();
  const current = bucket.get(key);
  if (!current || current.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new Error("Too many launch requests. Please wait and try again.");
  }
  current.count += 1;
  bucket.set(key, current);
};

export const enforceLaunchPrepareRateLimit = (ctx: LaunchRequestContext) =>
  consumeWindow(prepareRateWindowByIp, ctx.requestIp || "unknown", PREPARE_LIMIT, PREPARE_WINDOW_MS);

export const enforceLaunchSubmitRateLimit = (ctx: LaunchRequestContext) =>
  consumeWindow(submitRateWindowByIp, ctx.requestIp || "unknown", SUBMIT_LIMIT, SUBMIT_WINDOW_MS);

const isPrivateIpv4 = (address: string): boolean => {
  const parts = address.split(".").map((value) => Number(value));
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value))) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 0) return true;
  return false;
};

const isPrivateIpv6 = (address: string): boolean => {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
};

const assertPublicHostname = async (hostname: string) => {
  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0) {
    throw new Error("Logo URL host did not resolve.");
  }
  for (const record of records) {
    if (net.isIP(record.address) === 4 && isPrivateIpv4(record.address)) {
      throw new Error("Logo URL points to a private network address.");
    }
    if (net.isIP(record.address) === 6 && isPrivateIpv6(record.address)) {
      throw new Error("Logo URL points to a private network address.");
    }
  }
};

export const validateLogoUrl = async (rawUrl: string): Promise<URL> => {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("Remote logo URLs must use HTTPS.");
  }
  if (!url.hostname || ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) {
    throw new Error("Logo URL must not target localhost.");
  }
  await assertPublicHostname(url.hostname);
  return url;
};

export const fetchLogoBlob = async (rawUrl: string): Promise<LogoFetchResult> => {
  const url = await validateLogoUrl(rawUrl);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS),
    redirect: "follow",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch the token logo from ${url.toString()}.`);
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
  if (!mimeType.startsWith("image/")) {
    throw new Error("Logo URL did not return an image.");
  }
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (contentLength > MAX_LOGO_BYTES) {
    throw new Error("Logo file exceeds the 2 MB size limit.");
  }
  const blob = await response.blob();
  if (blob.size > MAX_LOGO_BYTES) {
    throw new Error("Logo file exceeds the 2 MB size limit.");
  }
  return { blob, mimeType };
};
