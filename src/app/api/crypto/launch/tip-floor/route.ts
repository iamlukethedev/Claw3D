import { NextResponse } from "next/server";
import { fetchJitoTipFloor } from "@/features/crypto/server/launch/service";

export async function GET() {
  try {
    const tipFloor = await fetchJitoTipFloor();
    if (!tipFloor) {
      return NextResponse.json({ error: "Tip floor unavailable." }, { status: 503 });
    }
    return NextResponse.json(tipFloor);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load the Jito tip floor.",
      },
      { status: 502 },
    );
  }
}
