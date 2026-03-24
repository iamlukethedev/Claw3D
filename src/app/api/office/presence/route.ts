import { NextResponse } from "next/server";

import {
  fetchRemoteOfficePresenceSnapshot,
  loadOfficePresenceSnapshot,
} from "@/lib/office/presence";
import { loadStudioSettings } from "@/lib/studio/settings-store";
import { resolveOfficePreference } from "@/lib/studio/settings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const source = url.searchParams.get("source")?.trim() || "local";
    const workspaceId = url.searchParams.get("workspaceId")?.trim() || "default";
    if (source === "remote") {
      const settings = loadStudioSettings();
      const gatewayUrl = settings.gateway?.url?.trim() || "";
      const officePreference = resolveOfficePreference(settings, gatewayUrl);
      if (
        !officePreference.remoteOfficeEnabled ||
        !officePreference.remoteOfficePresenceUrl.trim()
      ) {
        return NextResponse.json(
          {
            workspaceId: "remote",
            timestamp: new Date().toISOString(),
            agents: [],
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      const startedAt = Date.now();
      console.info("[office-presence] Fetching remote office presence.", {
        presenceUrl: officePreference.remoteOfficePresenceUrl,
        tokenConfigured: Boolean(officePreference.remoteOfficeToken?.trim()),
      });
      const snapshot = await fetchRemoteOfficePresenceSnapshot({
        presenceUrl: officePreference.remoteOfficePresenceUrl,
        token: officePreference.remoteOfficeToken,
        timeoutMs: 15_000,
      });
      console.info("[office-presence] Remote office presence loaded.", {
        presenceUrl: officePreference.remoteOfficePresenceUrl,
        elapsedMs: Date.now() - startedAt,
        agentCount: snapshot.agents.length,
      });
      return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
    }
    const snapshot = loadOfficePresenceSnapshot(workspaceId);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load office presence.";
    console.error("[office-presence] Failed to load office presence.", {
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
