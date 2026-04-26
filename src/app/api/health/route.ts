import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "claw3d",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
