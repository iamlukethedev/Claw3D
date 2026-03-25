import { NextResponse } from "next/server";
import {
  deriveRemoteLayoutUrlFromPresenceUrl,
  normalizeOfficeLayoutSnapshot,
  type OfficeLayoutSnapshot,
} from "@/lib/office/layoutSnapshot";
import { loadOfficeLayoutSnapshot, saveOfficeLayoutSnapshot } from "@/lib/office/layoutSnapshotStore";
import { loadStudioSettings } from "@/lib/studio/settings-store";
import { resolveOfficePreference } from "@/lib/studio/settings";

export const runtime = "nodejs";
const REMOTE_LAYOUT_TIMEOUT_MS = 10_000;

const fetchRemoteOfficeLayoutSnapshot = async (params: {
  layoutUrl: string;
  token?: string | null;
}): Promise<OfficeLayoutSnapshot | null> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const token = params.token?.trim() ?? "";
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-Claw3D-Office-Token"] = token;
  }
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, REMOTE_LAYOUT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(params.layoutUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: abortController.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Remote office layout request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Remote office layout request failed with status ${response.status}.`);
  }
  const payload = (await response.json()) as unknown;
  return normalizeOfficeLayoutSnapshot(payload, "");
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const source = url.searchParams.get("source")?.trim() || "local";
    if (source === "remote") {
      const settings = loadStudioSettings();
      const gatewayUrl = settings.gateway?.url?.trim() || "";
      const officePreference = resolveOfficePreference(settings, gatewayUrl);
      if (
        !officePreference.remoteOfficeEnabled ||
        officePreference.remoteOfficeSourceKind !== "presence_endpoint" ||
        !officePreference.remoteOfficePresenceUrl.trim()
      ) {
        return NextResponse.json({ snapshot: null }, { headers: { "Cache-Control": "no-store" } });
      }
      const layoutUrl = deriveRemoteLayoutUrlFromPresenceUrl(
        officePreference.remoteOfficePresenceUrl,
      );
      if (!layoutUrl) {
        return NextResponse.json({ snapshot: null }, { headers: { "Cache-Control": "no-store" } });
      }
      const snapshot = await fetchRemoteOfficeLayoutSnapshot({
        layoutUrl,
        token: officePreference.remoteOfficeToken,
      });
      return NextResponse.json(
        { snapshot },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const gatewayUrl = url.searchParams.get("gatewayUrl")?.trim() || "";
    const settings = loadStudioSettings();
    const resolvedGatewayUrl = gatewayUrl || settings.gateway?.url?.trim() || "";
    const snapshot = loadOfficeLayoutSnapshot(resolvedGatewayUrl);
    return NextResponse.json(
      { snapshot },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load office layout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { snapshot?: unknown };
    const snapshot = normalizeOfficeLayoutSnapshot(body.snapshot, "");
    if (!snapshot) {
      return NextResponse.json({ error: "Invalid office layout snapshot." }, { status: 400 });
    }
    saveOfficeLayoutSnapshot(snapshot);
    return NextResponse.json(
      { snapshot },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save office layout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
