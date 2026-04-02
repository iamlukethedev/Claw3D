import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  SOLANA_RPC_ENDPOINTS,
  SOL_DECIMALS,
  SOL_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@/features/crypto/lib/constants";
import type { CryptoQuotePreview, CryptoTokenHolding, CryptoTrackedPair, CryptoWalletSnapshot } from "@/features/crypto/types";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (
    transaction: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
};

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
    solana?: PhantomProvider;
  }
}

let activeRpcIndex = 0;

export const getSolanaConnection = () =>
  new Connection(SOLANA_RPC_ENDPOINTS[activeRpcIndex] ?? SOLANA_RPC_ENDPOINTS[0], "confirmed");

const advanceRpc = () => {
  activeRpcIndex = (activeRpcIndex + 1) % SOLANA_RPC_ENDPOINTS.length;
};

const isForbiddenError = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("403") || msg.includes("Access forbidden");
};

const withRpcFallback = async <T>(fn: (connection: Connection) => Promise<T>): Promise<T> => {
  const attempts = SOLANA_RPC_ENDPOINTS.length;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(getSolanaConnection());
    } catch (error) {
      if (isForbiddenError(error) && i < attempts - 1) {
        advanceRpc();
        continue;
      }
      throw error;
    }
  }
  throw new Error("All Solana RPC endpoints returned errors.");
};

export const getPhantomProvider = (): PhantomProvider | null => {
  if (typeof window === "undefined") return null;
  const provider = window.phantom?.solana ?? window.solana ?? null;
  if (!provider?.isPhantom) return null;
  return provider;
};

export const fetchTokenDecimals = async (mint: string): Promise<number> => {
  if (mint === SOL_MINT) return SOL_DECIMALS;
  return withRpcFallback(async (connection) => {
    const accountInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
    const parsed = accountInfo.value?.data;
    if (
      parsed &&
      typeof parsed === "object" &&
      "parsed" in parsed &&
      typeof parsed.parsed === "object" &&
      parsed.parsed &&
      "info" in parsed.parsed &&
      typeof parsed.parsed.info === "object" &&
      parsed.parsed.info &&
      "decimals" in parsed.parsed.info &&
      typeof parsed.parsed.info.decimals === "number"
    ) {
      return parsed.parsed.info.decimals;
    }
    return 9;
  });
};

export const fetchWalletSnapshot = async (params: {
  publicKey: string;
  trackedTokenMint?: string;
  trackedTokenDecimals?: number;
}): Promise<CryptoWalletSnapshot> => {
  const owner = new PublicKey(params.publicKey);
  const [solBalance, tokenAccountsLegacy, tokenAccounts2022] = await withRpcFallback(
    async (connection) =>
      Promise.all([
        connection.getBalance(owner),
        connection.getParsedTokenAccountsByOwner(owner, {
          programId: new PublicKey(TOKEN_PROGRAM_ID),
        }),
        connection.getParsedTokenAccountsByOwner(owner, {
          programId: new PublicKey(TOKEN_2022_PROGRAM_ID),
        }),
      ]),
  );
  const tokenAccounts = [...tokenAccountsLegacy.value, ...tokenAccounts2022.value];

  const holdingsMap = new Map<string, CryptoTokenHolding>();
  for (const entry of tokenAccounts) {
    const parsed = entry.account.data.parsed;
    const info =
      parsed && typeof parsed === "object" && "info" in parsed
        ? (parsed.info as Record<string, unknown>)
        : null;
    const mint = typeof info?.mint === "string" ? info.mint : "";
    if (!mint) continue;
    const tokenAmount =
      typeof info?.tokenAmount === "object" && info.tokenAmount
        ? (info.tokenAmount as Record<string, unknown>)
        : null;
    const uiAmountString =
      typeof tokenAmount?.uiAmountString === "string"
        ? tokenAmount.uiAmountString
        : "0";
    const decimals =
      typeof tokenAmount?.decimals === "number" ? tokenAmount.decimals : 9;
    const balance = Number(uiAmountString || "0");
    const existing = holdingsMap.get(mint);
    if (existing) {
      existing.balance += balance;
      existing.uiAmountString = existing.balance.toString();
    } else {
      holdingsMap.set(mint, {
        mint,
        symbol: "",
        name: "",
        imageUrl: "",
        balance,
        decimals,
        uiAmountString,
      });
    }
  }

  const tokenHoldings = Array.from(holdingsMap.values()).filter(
    (h) => h.balance > 0,
  );

  let trackedTokenBalance = 0;
  const trackedMint = params.trackedTokenMint;
  if (trackedMint) {
    const match = holdingsMap.get(trackedMint);
    trackedTokenBalance = match?.balance ?? 0;
  }

  return {
    publicKey: params.publicKey,
    connected: true,
    solBalance: solBalance / LAMPORTS_PER_SOL,
    tokenHoldings,
    trackedTokenBalance,
    trackedTokenDecimals: params.trackedTokenDecimals ?? 9,
    lastUpdatedAt: Date.now(),
  };
};

type TokenMeta = { symbol: string; name: string; imageUrl: string };
const tokenMetadataCache = new Map<string, TokenMeta>();
let jupiterLoaded = false;
let jupiterLoadPromise: Promise<void> | null = null;

const loadJupiterTokenList = async () => {
  if (jupiterLoaded) return;
  if (jupiterLoadPromise) {
    await jupiterLoadPromise;
    return;
  }
  jupiterLoadPromise = (async () => {
    try {
      const response = await fetch("https://tokens.jup.ag/tokens", {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Token list fetch failed.");
      const tokens = (await response.json()) as Array<{
        address: string;
        symbol?: string;
        name?: string;
        logoURI?: string;
      }>;
      for (const t of tokens) {
        if (t.address && (t.symbol || t.name)) {
          tokenMetadataCache.set(t.address, {
            symbol: t.symbol ?? "",
            name: t.name ?? "",
            imageUrl: t.logoURI ?? "",
          });
        }
      }
    } catch {
      // Jupiter unavailable; DexScreener fallback will handle unknowns.
    }
    jupiterLoaded = true;
  })();
  await jupiterLoadPromise;
};

const fetchDexScreenerTokenMeta = async (mints: string[]) => {
  const batchSize = 30;
  for (let i = 0; i < mints.length; i += batchSize) {
    const batch = mints.slice(i, i + batchSize).join(",");
    try {
      const response = await fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${batch}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!response.ok) continue;
      const pairs = (await response.json()) as Array<{
        baseToken?: { address?: string; symbol?: string; name?: string };
        quoteToken?: { address?: string; symbol?: string; name?: string };
        info?: { imageUrl?: string };
      }>;
      for (const p of pairs) {
        for (const tok of [p.baseToken, p.quoteToken]) {
          if (tok?.address && (tok.symbol || tok.name) && !tokenMetadataCache.has(tok.address)) {
            tokenMetadataCache.set(tok.address, {
              symbol: tok.symbol ?? "",
              name: tok.name ?? "",
              imageUrl: p.info?.imageUrl ?? "",
            });
          }
        }
      }
    } catch {
      // Silently skip failed batch.
    }
  }
};

export const enrichHoldingsMetadata = async (
  holdings: CryptoTokenHolding[],
): Promise<CryptoTokenHolding[]> => {
  await loadJupiterTokenList();

  const unknownMints = holdings
    .filter((h) => !tokenMetadataCache.has(h.mint))
    .map((h) => h.mint);
  if (unknownMints.length > 0) {
    await fetchDexScreenerTokenMeta(unknownMints);
  }

  return holdings.map((h) => {
    const meta = tokenMetadataCache.get(h.mint);
    if (meta) {
      return {
        ...h,
        symbol: meta.symbol || h.symbol,
        name: meta.name || h.name,
        imageUrl: meta.imageUrl || h.imageUrl,
      };
    }
    return h;
  });
};

export const rawAmountFromUi = (amountUi: number, decimals: number): string => {
  const normalized = Number.isFinite(amountUi) ? Math.max(0, amountUi) : 0;
  return Math.round(normalized * 10 ** decimals).toString();
};

export const quotePreviewFromResponse = (params: {
  response: {
    inAmount: string;
    outAmount: string;
    priceImpactPct?: string;
    routePlan?: Array<{
      swapInfo?: {
        label?: string;
      };
    }>;
  };
  inputMint: string;
  outputMint: string;
  inputDecimals: number;
  outputDecimals: number;
  slippageBps: number;
}): CryptoQuotePreview => ({
  inputMint: params.inputMint,
  outputMint: params.outputMint,
  inAmountRaw: params.response.inAmount,
  outAmountRaw: params.response.outAmount,
  inputAmountUi: Number(params.response.inAmount) / 10 ** params.inputDecimals,
  outputAmountUi: Number(params.response.outAmount) / 10 ** params.outputDecimals,
  priceImpactPct: Number(params.response.priceImpactPct ?? "0"),
  slippageBps: params.slippageBps,
  routeLabel:
    params.response.routePlan?.[0]?.swapInfo?.label?.trim() || "Jupiter route",
  raw: params.response,
  createdAt: Date.now(),
});

export const deserializeSwapTransaction = (base64Transaction: string) =>
  VersionedTransaction.deserialize(
    Uint8Array.from(atob(base64Transaction), (char) => char.charCodeAt(0)),
  );

export const getTrackedToken = (pair: CryptoTrackedPair) =>
  pair.baseToken.address === SOL_MINT ? pair.quoteToken : pair.baseToken;
