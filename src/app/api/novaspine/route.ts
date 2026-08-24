import { NextResponse } from "next/server";

import {
  getNovaSpineIntegrationStatus,
  installNovaSpineIntoOpenClaw,
} from "@/lib/novaspine/integration";

export const runtime = "nodejs";

type InstallRequest = {
  action?: string;
};

export async function GET() {
  try {
    const status = getNovaSpineIntegrationStatus();
    return NextResponse.json({ status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to inspect NovaSpine integration state.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as InstallRequest;
    const action = typeof body.action === "string" ? body.action.trim() : "install";
    if (action !== "install") {
      return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }
    const result = installNovaSpineIntoOpenClaw();
    const statusCode = result.ok ? 200 : 500;
    return NextResponse.json(result, { status: statusCode, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to install NovaSpine into OpenClaw.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
