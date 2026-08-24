import { NextResponse } from "next/server";

import {
  sanitizeStudioGatewaySettings,
  sanitizeStudioSettings,
  type StudioSettingsPatch,
} from "@/lib/studio/settings";
import {
  applyStudioSettingsPatch,
  loadLocalGatewayDefaults,
  loadStudioSettings,
} from "@/lib/studio/settings-store";

export const runtime = "nodejs";

const isPatch = (value: unknown): value is StudioSettingsPatch =>
  Boolean(value && typeof value === "object");

export async function GET() {
  try {
    const settings = loadStudioSettings();
    const localGatewayDefaults = loadLocalGatewayDefaults();
    // This Studio is protected by the access gate. OpenClaw's challenge
    // signature binds the auth token, so the browser needs the token before it
    // signs the connect frame.
    return NextResponse.json(
      {
        settings: sanitizeStudioSettings(settings),
        localGatewayDefaults: sanitizeStudioGatewaySettings(localGatewayDefaults),
        gatewayPrivate: settings.gateway,
        localGatewayDefaultsPrivate: localGatewayDefaults,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load studio settings.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody.trim()) {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }
    const body = JSON.parse(rawBody) as unknown;
    if (!isPatch(body)) {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }
    const settings = applyStudioSettingsPatch(body);
    const localGatewayDefaults = loadLocalGatewayDefaults();
    return NextResponse.json(
      {
        settings: sanitizeStudioSettings(settings),
        localGatewayDefaults: sanitizeStudioGatewaySettings(localGatewayDefaults),
        gatewayPrivate: settings.gateway,
        localGatewayDefaultsPrivate: localGatewayDefaults,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save studio settings.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
