import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { cryptoLaunchSubmitSchema } from "@/features/crypto/lib/launchSchema";
import { getLaunchRequestContext } from "@/features/crypto/server/launch/security";
import { submitCryptoLaunch } from "@/features/crypto/server/launch/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = cryptoLaunchSubmitSchema.parse(await request.json());
    const result = await submitCryptoLaunch({
      ...payload,
      requestContext: getLaunchRequestContext(request),
    });
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Invalid launch submission payload.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }
    if (error instanceof Error && /too many launch requests/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (
      error instanceof Error &&
      /(session|disabled|invalid|submit token|deprecated|operator)/i.test(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to submit the Pump.fun launch.",
      },
      { status: 502 },
    );
  }
}
