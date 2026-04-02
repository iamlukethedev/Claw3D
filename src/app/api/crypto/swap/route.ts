import { NextResponse } from "next/server";

const PUBLIC_KEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      quoteResponse?: unknown;
      userPublicKey?: string;
    };
    const userPublicKey = payload.userPublicKey?.trim() ?? "";
    if (!PUBLIC_KEY_RE.test(userPublicKey)) {
      return NextResponse.json({ error: "Invalid wallet public key." }, { status: 400 });
    }
    if (!payload.quoteResponse || typeof payload.quoteResponse !== "object") {
      return NextResponse.json({ error: "Missing quote payload." }, { status: 400 });
    }

    const upstream = await fetch("https://api.jup.ag/swap/v1/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        quoteResponse: payload.quoteResponse,
        userPublicKey,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: 1_000_000,
            priorityLevel: "veryHigh",
          },
        },
      }),
      cache: "no-store",
    });
    const upstreamPayload = await upstream.json();
    if (!upstream.ok || typeof upstreamPayload?.swapTransaction !== "string") {
      throw new Error(
        typeof upstreamPayload?.error === "string"
          ? upstreamPayload.error
          : "Unable to build a swap transaction.",
      );
    }

    return NextResponse.json({
      swapTransaction: upstreamPayload.swapTransaction,
      lastValidBlockHeight:
        typeof upstreamPayload.lastValidBlockHeight === "number"
          ? upstreamPayload.lastValidBlockHeight
          : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare the Solana swap transaction.",
      },
      { status: 502 },
    );
  }
}
