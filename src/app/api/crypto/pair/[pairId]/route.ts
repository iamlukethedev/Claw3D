import { NextResponse } from "next/server";

const PAIR_ID_RE = /^[a-zA-Z0-9]{16,128}$/;

type DexScreenerPair = {
  chainId?: string;
  pairAddress?: string;
  dexId?: string;
  url?: string;
  priceUsd?: string;
  priceNative?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: {
    usd?: number;
  };
  volume?: {
    h24?: number;
  };
  txns?: {
    h24?: {
      buys?: number;
      sells?: number;
    };
  };
  baseToken?: {
    address?: string;
    symbol?: string;
    name?: string;
  };
  quoteToken?: {
    address?: string;
    symbol?: string;
    name?: string;
  };
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  info?: {
    imageUrl?: string;
  };
};

const toResponsePair = (pair: DexScreenerPair) => ({
  pairAddress: pair.pairAddress!,
  dexId: pair.dexId ?? null,
  url: pair.url ?? `https://dexscreener.com/solana/${pair.pairAddress}`,
  priceUsd: Number(pair.priceUsd ?? "0"),
  priceNative: pair.priceNative ? Number(pair.priceNative) : null,
  fdv: pair.fdv ?? null,
  marketCap: pair.marketCap ?? null,
  liquidityUsd: pair.liquidity?.usd ?? null,
  volume24hUsd: pair.volume?.h24 ?? null,
  buys24h: pair.txns?.h24?.buys ?? null,
  sells24h: pair.txns?.h24?.sells ?? null,
  pairLabel: `${pair.baseToken?.symbol ?? "TOKEN"}/${pair.quoteToken?.symbol ?? "TOKEN"}`,
  chainId: pair.chainId ?? "solana",
  quoteToken: {
    address: pair.quoteToken!.address!,
    symbol: pair.quoteToken?.symbol ?? "TOKEN",
    name: pair.quoteToken?.name ?? pair.quoteToken?.symbol ?? "Token",
  },
  baseToken: {
    address: pair.baseToken!.address!,
    symbol: pair.baseToken?.symbol ?? "TOKEN",
    name: pair.baseToken?.name ?? pair.baseToken?.symbol ?? "Token",
  },
  priceChangePct: {
    m5: pair.priceChange?.m5 ?? null,
    h1: pair.priceChange?.h1 ?? null,
    h6: pair.priceChange?.h6 ?? null,
    h24: pair.priceChange?.h24 ?? null,
  },
  imageUrl: pair.info?.imageUrl ?? null,
  loadedAt: Date.now(),
});

const isCompletePair = (pair: DexScreenerPair | undefined): pair is DexScreenerPair =>
  Boolean(pair?.pairAddress && pair.baseToken?.address && pair.quoteToken?.address);

const getBestPair = (pairs: DexScreenerPair[]) =>
  pairs
    .filter(isCompletePair)
    .sort((left, right) => (right.liquidity?.usd ?? 0) - (left.liquidity?.usd ?? 0))[0];

export async function GET(
  _request: Request,
  context: { params: Promise<{ pairId: string }> },
) {
  const { pairId } = await context.params;
  if (!PAIR_ID_RE.test(pairId)) {
    return NextResponse.json({ error: "Invalid pair id." }, { status: 400 });
  }

  try {
    const requestOptions = {
      headers: {
        accept: "application/json",
      },
      cache: "no-store" as const,
    };

    const pairUpstream = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${pairId}`,
      requestOptions,
    );

    let pair: DexScreenerPair | undefined;
    if (pairUpstream.ok) {
      const payload = (await pairUpstream.json()) as {
        pairs?: DexScreenerPair[];
      };
      pair = getBestPair(payload.pairs ?? []);
    }

    if (!pair) {
      const tokenUpstream = await fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${pairId}`,
        requestOptions,
      );
      if (!tokenUpstream.ok) {
        throw new Error(`DexScreener request failed with ${tokenUpstream.status}.`);
      }
      const tokenPayload = (await tokenUpstream.json()) as DexScreenerPair[];
      pair = getBestPair(tokenPayload);
    }

    if (!pair) {
      return NextResponse.json({ error: "Pair data was not available." }, { status: 404 });
    }

    return NextResponse.json({
      pair: toResponsePair(pair),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the requested pair.",
      },
      { status: 502 },
    );
  }
}
