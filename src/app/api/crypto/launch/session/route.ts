import { NextRequest, NextResponse } from "next/server";
import {
  applyLaunchSessionCookie,
  clearLaunchSessionCookie,
  createLaunchOperatorSession,
  hasLaunchOperatorSession,
  verifyLaunchOperatorPassword,
} from "@/features/crypto/server/launch/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    authenticated: hasLaunchOperatorSession(request),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password.trim()) {
    return NextResponse.json({ error: "Operator password is required." }, { status: 400 });
  }
  try {
    if (!verifyLaunchOperatorPassword(password)) {
      return NextResponse.json({ error: "Invalid operator password." }, { status: 401 });
    }
    const response = NextResponse.json({ authenticated: true });
    applyLaunchSessionCookie(response, createLaunchOperatorSession());
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the launch operator session.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  clearLaunchSessionCookie(response);
  return response;
}
