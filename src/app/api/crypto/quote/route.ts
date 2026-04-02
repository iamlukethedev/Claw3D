import { NextResponse } from "next/server";

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const inputMint = searchParams.get("inputMint")?.trim() ?? "";
  const outputMint = searchParams.get("outputMint")?.trim() ?? "";
  const amount = searchParams.get("amount")?.trim() ?? "";
  const slippageBps = Number(searchParams.get("slippageBps") ?? "150");

  if (!MINT_RE.test(inputMint) || !MINT_RE.test(outputMint)) {
    return NextResponse.json({ error: "Invalid token mint." }, { status: 400 });
  }
  if (!/^\d+$/.test(amount) || Number(amount) <= 0) {
    return NextResponse.json({ error: "Invalid swap amount." }, { status: 400 });
  }
  if (!Number.isFinite(slippageBps) || slippageBps < 10 || slippageBps > 5_000) {
    return NextResponse.json({ error: "Slippage must be between 10 and 5000 bps." }, { status: 400 });
  }

  try {
    const query = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: String(slippageBps),
      restrictIntermediateTokens: "true",
    });
    const upstream = await fetch(`https://api.jup.ag/swap/v1/quote?${query.toString()}`, {
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    });
    const payload = await upstream.json();
    if (!upstream.ok) {
      throw new Error(
        typeof payload?.error === "string"
          ? payload.error
          : "Quote request failed.",
      );
    }
    return NextResponse.json({ quote: payload });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to request a Jupiter quote.",
      },
      { status: 502 },
    );
  }
}
