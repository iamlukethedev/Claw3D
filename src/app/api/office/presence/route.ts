import { NextResponse } from "next/server";

import { loadOfficePresenceSnapshot } from "@/lib/office/presence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId")?.trim() || "default";
    const snapshot = await loadOfficePresenceSnapshot(workspaceId);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load office presence.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
