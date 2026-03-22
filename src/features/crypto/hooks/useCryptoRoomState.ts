"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CRYPTO_ROOM_AGENT_LOOP_MS, CRYPTO_ROOM_APPROVAL_TTL_MS, CRYPTO_ROOM_PAIR_ADDRESS, SOL_MINT } from "@/features/crypto/lib/constants";
import { buildCryptoReportSnapshot } from "@/features/crypto/lib/pnl";
import {
  deserializeSwapTransaction,
  enrichHoldingsMetadata,
  fetchTokenDecimals,
  fetchWalletSnapshot,
  getPhantomProvider,
  getSolanaConnection,
  getTrackedToken,
  quotePreviewFromResponse,
  rawAmountFromUi,
} from "@/features/crypto/lib/solana";
import {
  buildInitialCryptoRoomState,
  loadCryptoRoomState,
  saveCryptoRoomState,
} from "@/features/crypto/lib/storage";
import type {
  CryptoAgentSetting,
  CryptoApprovalRequest,
  CryptoQuotePreview,
  CryptoRoomSettings,
  CryptoTradeRecord,
  CryptoTradeSide,
  CryptoTrackedPair,
  CryptoWalletSnapshot,
} from "@/features/crypto/types";
import type { OfficeAgent } from "@/features/retro-office/core/types";

const buildId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `crypto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const emptyWallet: CryptoWalletSnapshot = {
  publicKey: null,
  connected: false,
  solBalance: 0,
  tokenHoldings: [],
  trackedTokenBalance: 0,
  trackedTokenDecimals: 9,
  lastUpdatedAt: null,
};

const resolveApprovalSide = (params: {
  pair: CryptoTrackedPair;
  wallet: CryptoWalletSnapshot;
  setting: CryptoAgentSetting;
}): CryptoTradeSide | null => {
  const { pair, wallet, setting } = params;
  const h1 = pair.priceChangePct.h1 ?? 0;
  const h24 = pair.priceChangePct.h24 ?? 0;
  if (h1 <= -6 || h24 <= -15) return "buy";
  if (setting.allowSell && wallet.trackedTokenBalance > 0 && (h1 >= 10 || h24 >= 20)) {
    return "sell";
  }
  return null;
};

const resolveApprovalAmount = (params: {
  setting: CryptoAgentSetting;
  wallet: CryptoWalletSnapshot;
  side: CryptoTradeSide;
}): number => {
  if (params.side === "buy") {
    return Math.min(params.setting.maxTradeSol, Math.max(0.05, params.setting.maxTradeSol * 0.75));
  }
  return Number((params.wallet.trackedTokenBalance * 0.25).toFixed(4));
};

const buildAgentRationale = (params: {
  pair: CryptoTrackedPair;
  side: CryptoTradeSide;
  amountUi: number;
  setting: CryptoAgentSetting;
}) => {
  const h1 = params.pair.priceChangePct.h1 ?? 0;
  const h24 = params.pair.priceChangePct.h24 ?? 0;
  if (params.side === "buy") {
    return `${params.setting.agentName} spotted a ${Math.abs(h1).toFixed(1)}% 1H pullback and wants to scale into ${params.pair.baseToken.symbol} with ${params.amountUi.toFixed(3)} SOL.`;
  }
  return `${params.setting.agentName} wants to trim exposure after a ${Math.max(h1, h24).toFixed(1)}% breakout and de-risk 25% of the tracked bag.`;
};

export function useCryptoRoomState(agents: OfficeAgent[]) {
  const initialState = useMemo(() => loadCryptoRoomState(agents), [agents]);
  const [settings, setSettings] = useState<CryptoRoomSettings>(initialState.settings);
  const [ledger, setLedger] = useState<CryptoTradeRecord[]>(initialState.ledger);
  const [approvals, setApprovals] = useState<CryptoApprovalRequest[]>(initialState.approvals);
  const [pair, setPair] = useState<CryptoTrackedPair | null>(null);
  const [pairLoading, setPairLoading] = useState(true);
  const [pairError, setPairError] = useState<string | null>(null);
  const [trackedTokenDecimals, setTrackedTokenDecimals] = useState(9);
  const [wallet, setWallet] = useState<CryptoWalletSnapshot>(emptyWallet);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [tradeSide, setTradeSide] = useState<CryptoTradeSide>("buy");
  const [tradeAmountUi, setTradeAmountUi] = useState("0.10");
  const [tradeSlippageBps, setTradeSlippageBps] = useState(settings.defaultSlippageBps);
  const [quote, setQuote] = useState<CryptoQuotePreview | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);

  useEffect(() => {
    setTradeSlippageBps(settings.defaultSlippageBps);
  }, [settings.defaultSlippageBps]);

  useEffect(() => {
    saveCryptoRoomState({
      version: 1,
      settings,
      ledger,
      approvals,
    });
  }, [approvals, ledger, settings]);

  useEffect(() => {
    let cancelled = false;
    const loadPair = async () => {
      setPairLoading(true);
      setPairError(null);
      try {
        const response = await fetch(`/api/crypto/pair/${settings.pairAddress || CRYPTO_ROOM_PAIR_ADDRESS}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { pair?: CryptoTrackedPair; error?: string };
        if (!response.ok || !payload.pair) {
          throw new Error(payload.error?.trim() || "Unable to load Solana market data.");
        }
        if (cancelled) return;
        setPair(payload.pair);
      } catch (error) {
        if (cancelled) return;
        setPair(null);
        setPairError(error instanceof Error ? error.message : "Unable to load Solana market data.");
      } finally {
        if (!cancelled) setPairLoading(false);
      }
    };
    void loadPair();
    return () => {
      cancelled = true;
    };
  }, [settings.pairAddress]);

  useEffect(() => {
    if (!pair) return;
    let cancelled = false;
    const trackedToken = getTrackedToken(pair);
    void fetchTokenDecimals(trackedToken.address)
      .then((decimals) => {
        if (!cancelled) {
          setTrackedTokenDecimals(decimals);
          setWallet((current) => ({
            ...current,
            trackedTokenDecimals: decimals,
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTrackedTokenDecimals(9);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pair]);

  const refreshWallet = useCallback(async () => {
    const publicKey = wallet.publicKey;
    if (!publicKey) return;
    const trackedMint = pair ? getTrackedToken(pair).address : undefined;
    try {
      setWalletLoading(true);
      const snapshot = await fetchWalletSnapshot({
        publicKey,
        trackedTokenMint: trackedMint,
        trackedTokenDecimals,
      });
      snapshot.tokenHoldings = await enrichHoldingsMetadata(snapshot.tokenHoldings);
      setWallet(snapshot);
      setWalletError(null);
    } catch (error) {
      setWalletError(
        error instanceof Error ? error.message : "Unable to refresh the connected wallet.",
      );
    } finally {
      setWalletLoading(false);
    }
  }, [pair, trackedTokenDecimals, wallet.publicKey]);

  const connectWallet = useCallback(async () => {
    const provider = getPhantomProvider();
    if (!provider) {
      setWalletError("Phantom was not detected in this browser.");
      return;
    }
    try {
      const connected = await provider.connect();
      const publicKey = connected.publicKey.toBase58();
      setWallet({
        ...emptyWallet,
        connected: true,
        publicKey,
      });
      setWalletError(null);
      setWalletLoading(true);
      const trackedMint = pair ? getTrackedToken(pair).address : undefined;
      const snapshot = await fetchWalletSnapshot({
        publicKey,
        trackedTokenMint: trackedMint,
        trackedTokenDecimals,
      });
      snapshot.tokenHoldings = await enrichHoldingsMetadata(snapshot.tokenHoldings);
      setWallet(snapshot);
      setWalletError(null);
      setWalletLoading(false);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Wallet connection was cancelled.");
      setWalletLoading(false);
    }
  }, [pair, trackedTokenDecimals]);

  const disconnectWallet = useCallback(async () => {
    try {
      await getPhantomProvider()?.disconnect();
    } catch {
      /* ignore */
    }
    setWallet(emptyWallet);
    setQuote(null);
  }, []);

  const revokeWallet = useCallback(async () => {
    const provider = getPhantomProvider();
    try {
      await provider?.disconnect();
    } catch {
      /* ignore */
    }
    setWallet(emptyWallet);
    setQuote(null);
    setWalletError(null);
  }, []);

  useEffect(() => {
    if (!wallet.connected || !wallet.publicKey) return;
    void refreshWallet();
  }, [pair, refreshWallet, wallet.connected, wallet.publicKey]);

  useEffect(() => {
    const now = Date.now();
    setApprovals((current) =>
      current.map((approval) =>
        approval.status === "pending" && approval.expiresAt < now
          ? { ...approval, status: "expired" }
          : approval,
      ),
    );
  }, []);

  const trackedToken = pair ? getTrackedToken(pair) : null;

  const report = useMemo(
    () =>
      buildCryptoReportSnapshot({
        trades: ledger,
        approvals,
        currentTokenPriceUsd: pair?.priceUsd ?? 0,
        trackedTokenSymbol: trackedToken?.symbol ?? "TOKEN",
      }),
    [approvals, ledger, pair?.priceUsd, trackedToken?.symbol],
  );

  const requestQuote = useCallback(
    async (params?: {
      side?: CryptoTradeSide;
      amountUi?: number;
      slippageBps?: number;
    }) => {
      if (!pair || !trackedToken) {
        setQuoteError("Pair metadata is still loading.");
        return null;
      }
      const side = params?.side ?? tradeSide;
      const amountUi = params?.amountUi ?? Number(tradeAmountUi);
      const slippageBps = params?.slippageBps ?? tradeSlippageBps;
      if (!Number.isFinite(amountUi) || amountUi <= 0) {
        setQuoteError("Enter a trade size greater than zero.");
        return null;
      }
      const inputMint = side === "buy" ? SOL_MINT : trackedToken.address;
      const outputMint = side === "buy" ? trackedToken.address : SOL_MINT;
      const inputDecimals = side === "buy" ? 9 : trackedTokenDecimals;
      const outputDecimals = side === "buy" ? trackedTokenDecimals : 9;
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const query = new URLSearchParams({
          inputMint,
          outputMint,
          amount: rawAmountFromUi(amountUi, inputDecimals),
          slippageBps: String(slippageBps),
        });
        const response = await fetch(`/api/crypto/quote?${query.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          quote?: {
            inAmount: string;
            outAmount: string;
            priceImpactPct?: string;
            routePlan?: Array<{
              swapInfo?: {
                label?: string;
              };
            }>;
          };
          error?: string;
        };
        if (!response.ok || !payload.quote) {
          throw new Error(payload.error?.trim() || "Unable to load a Jupiter quote.");
        }
        const nextQuote = quotePreviewFromResponse({
          response: payload.quote,
          inputMint,
          outputMint,
          inputDecimals,
          outputDecimals,
          slippageBps,
        });
        setQuote(nextQuote);
        return nextQuote;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load a Jupiter quote.";
        setQuote(null);
        setQuoteError(message);
        return null;
      } finally {
        setQuoteLoading(false);
      }
    },
    [pair, trackedToken, trackedTokenDecimals, tradeAmountUi, tradeSide, tradeSlippageBps],
  );

  const submitSwap = useCallback(async () => {
    if (!quote || !pair || !trackedToken) {
      setSwapError("Request a fresh quote before signing a trade.");
      return;
    }
    if (!wallet.publicKey) {
      setSwapError("Connect Phantom before signing a trade.");
      return;
    }
    const provider = getPhantomProvider();
    if (!provider) {
      setSwapError("Phantom is not available in this browser.");
      return;
    }
    const tradeAgeMs = Date.now() - quote.createdAt;
    if (tradeAgeMs > 60_000) {
      setSwapError("Quote expired. Refresh the quote before signing.");
      return;
    }

    setSubmitting(true);
    setSwapError(null);
    try {
      const response = await fetch("/api/crypto/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote.raw,
          userPublicKey: wallet.publicKey,
        }),
      });
      const payload = (await response.json()) as {
        swapTransaction?: string;
        error?: string;
      };
      if (!response.ok || !payload.swapTransaction) {
        throw new Error(payload.error?.trim() || "Unable to build the Jupiter swap transaction.");
      }

      const transaction = deserializeSwapTransaction(payload.swapTransaction);
      const signed = await provider.signTransaction(transaction);
      const connection = getSolanaConnection();
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction(signature, "confirmed");

      const inputAmountUi = quote.inputAmountUi;
      const outputAmountUi = quote.outputAmountUi;
      const side = tradeSide;
      const notionalUsd =
        side === "buy"
          ? outputAmountUi * (pair.priceUsd ?? 0)
          : inputAmountUi * (pair.priceUsd ?? 0);
      const nextRecord: CryptoTradeRecord = {
        id: buildId(),
        source: selectedApprovalId ? "agent" : "user",
        status: "confirmed",
        agentId:
          selectedApprovalId
            ? approvals.find((approval) => approval.id === selectedApprovalId)?.agentId ?? null
            : null,
        agentName:
          selectedApprovalId
            ? approvals.find((approval) => approval.id === selectedApprovalId)?.agentName ?? null
            : null,
        pairAddress: pair.pairAddress,
        tokenMint: trackedToken.address,
        tokenSymbol: trackedToken.symbol,
        side,
        walletPublicKey: wallet.publicKey,
        inputMint: quote.inputMint,
        outputMint: quote.outputMint,
        inputAmountUi,
        outputAmountUi,
        tokenDelta: side === "buy" ? outputAmountUi : -inputAmountUi,
        notionalUsd,
        executionPriceUsd: pair.priceUsd,
        slippageBps: quote.slippageBps,
        quoteCreatedAt: quote.createdAt,
        txSignature: signature,
        error: null,
        rationale:
          selectedApprovalId
            ? approvals.find((approval) => approval.id === selectedApprovalId)?.rationale ?? null
            : "Manual trade from the crypto room.",
        createdAt: Date.now(),
        submittedAt: Date.now(),
        confirmedAt: Date.now(),
      };
      setLedger((current) => [nextRecord, ...current].slice(0, 250));
      if (selectedApprovalId) {
        setApprovals((current) =>
          current.map((approval) =>
            approval.id === selectedApprovalId
              ? { ...approval, status: "approved" }
              : approval,
          ),
        );
        setSelectedApprovalId(null);
      }
      setQuote(null);
      await refreshWallet();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The trade could not be completed.";
      setSwapError(message);
      const failedRecord: CryptoTradeRecord = {
        id: buildId(),
        source: selectedApprovalId ? "agent" : "user",
        status: "failed",
        agentId:
          selectedApprovalId
            ? approvals.find((approval) => approval.id === selectedApprovalId)?.agentId ?? null
            : null,
        agentName:
          selectedApprovalId
            ? approvals.find((approval) => approval.id === selectedApprovalId)?.agentName ?? null
            : null,
        pairAddress: pair?.pairAddress ?? CRYPTO_ROOM_PAIR_ADDRESS,
        tokenMint: trackedToken?.address ?? "",
        tokenSymbol: trackedToken?.symbol ?? "TOKEN",
        side: tradeSide,
        walletPublicKey: wallet.publicKey,
        inputMint: quote?.inputMint ?? SOL_MINT,
        outputMint: quote?.outputMint ?? "",
        inputAmountUi: quote?.inputAmountUi ?? Number(tradeAmountUi),
        outputAmountUi: quote?.outputAmountUi ?? 0,
        tokenDelta: tradeSide === "buy" ? quote?.outputAmountUi ?? 0 : -(quote?.inputAmountUi ?? 0),
        notionalUsd:
          tradeSide === "buy"
            ? (quote?.outputAmountUi ?? 0) * (pair?.priceUsd ?? 0)
            : (quote?.inputAmountUi ?? 0) * (pair?.priceUsd ?? 0),
        executionPriceUsd: pair?.priceUsd ?? 0,
        slippageBps: quote?.slippageBps ?? tradeSlippageBps,
        quoteCreatedAt: quote?.createdAt ?? Date.now(),
        txSignature: null,
        error: message,
        rationale:
          selectedApprovalId
            ? approvals.find((approval) => approval.id === selectedApprovalId)?.rationale ?? null
            : "Manual trade from the crypto room.",
        createdAt: Date.now(),
        submittedAt: null,
        confirmedAt: null,
      };
      setLedger((current) => [
        failedRecord,
        ...current,
      ].slice(0, 250));
    } finally {
      setSubmitting(false);
    }
  }, [
    approvals,
    pair,
    quote,
    refreshWallet,
    selectedApprovalId,
    trackedToken,
    tradeAmountUi,
    tradeSide,
    tradeSlippageBps,
    wallet.publicKey,
  ]);

  const updateAgentSetting = useCallback(
    (agentId: string, patch: Partial<CryptoAgentSetting>) => {
      setSettings((current) => ({
        ...current,
        agentSettings: current.agentSettings.map((entry) =>
          entry.agentId === agentId ? { ...entry, ...patch } : entry,
        ),
      }));
    },
    [],
  );

  const loadApprovalIntoTrade = useCallback(
    (approvalId: string) => {
      const approval = approvals.find((entry) => entry.id === approvalId);
      if (!approval) return;
      setTradeSide(approval.side);
      setTradeAmountUi(approval.proposedInputAmountUi.toFixed(approval.side === "buy" ? 3 : 4));
      setTradeSlippageBps(approval.slippageBps);
      setSelectedApprovalId(approvalId);
      setQuote(null);
      setQuoteError(null);
      setSwapError(null);
    },
    [approvals],
  );

  const rejectApproval = useCallback((approvalId: string) => {
    setApprovals((current) =>
      current.map((approval) =>
        approval.id === approvalId ? { ...approval, status: "rejected" } : approval,
      ),
    );
    if (selectedApprovalId === approvalId) {
      setSelectedApprovalId(null);
      setQuote(null);
    }
  }, [selectedApprovalId]);

  const runAgentCycle = useCallback(() => {
    if (!pair || !trackedToken) return;
    const now = Date.now();
    const nextApprovals: CryptoApprovalRequest[] = [];
    const nextLedgers: CryptoTradeRecord[] = [];

    setSettings((current) => ({
      ...current,
      agentSettings: current.agentSettings.map((setting) => {
        const minutesSinceLastSignal =
          setting.lastSignalAt ? (now - setting.lastSignalAt) / 60_000 : Number.POSITIVE_INFINITY;
        if (minutesSinceLastSignal < setting.cooldownMinutes) {
          return setting;
        }
        const mode = setting.mode;
        const dailyLossHit = report.totalPnlUsd <= -Math.abs(setting.dailyLossLimitUsd);
        if (dailyLossHit) {
          return {
            ...setting,
            lastSignalAt: now,
            lastSignalSummary: "Paused after hitting the daily loss guard.",
          };
        }
        const side = resolveApprovalSide({ pair, wallet, setting });
        if (!side) {
          return {
            ...setting,
            lastSignalAt: now,
            lastSignalSummary: "Holding fire while the pair is inside the risk band.",
          };
        }
        const proposedInputAmountUi = resolveApprovalAmount({ setting, wallet, side });
        if (!Number.isFinite(proposedInputAmountUi) || proposedInputAmountUi <= 0) {
          return {
            ...setting,
            lastSignalAt: now,
            lastSignalSummary: "Skipped because there was no safe size available.",
          };
        }
        const rationale = buildAgentRationale({
          pair,
          side,
          amountUi: proposedInputAmountUi,
          setting,
        });
        if (mode === "suggest_only" || !wallet.connected) {
          nextLedgers.push({
            id: buildId(),
            source: "agent",
            status: "draft",
            agentId: setting.agentId,
            agentName: setting.agentName,
            pairAddress: pair.pairAddress,
            tokenMint: trackedToken.address,
            tokenSymbol: trackedToken.symbol,
            side,
            walletPublicKey: wallet.publicKey,
            inputMint: side === "buy" ? SOL_MINT : trackedToken.address,
            outputMint: side === "buy" ? trackedToken.address : SOL_MINT,
            inputAmountUi: proposedInputAmountUi,
            outputAmountUi: 0,
            tokenDelta: 0,
            notionalUsd: proposedInputAmountUi * (side === "buy" ? pair.priceUsd : pair.priceUsd),
            executionPriceUsd: pair.priceUsd,
            slippageBps: setting.slippageBps,
            quoteCreatedAt: now,
            txSignature: null,
            error: null,
            rationale,
            createdAt: now,
            submittedAt: null,
            confirmedAt: null,
          });
        } else {
          nextApprovals.push({
            id: buildId(),
            agentId: setting.agentId,
            agentName: setting.agentName,
            pairAddress: pair.pairAddress,
            side,
            maxTradeSol: setting.maxTradeSol,
            slippageBps: setting.slippageBps,
            rationale,
            proposedInputAmountUi,
            createdAt: now,
            expiresAt: now + CRYPTO_ROOM_APPROVAL_TTL_MS,
            status: "pending",
          });
        }
        return {
          ...setting,
          lastSignalAt: now,
          lastSignalSummary: rationale,
        };
      }),
    }));

    if (nextApprovals.length > 0) {
      setApprovals((current) => [...nextApprovals, ...current].slice(0, 100));
    }
    if (nextLedgers.length > 0) {
      setLedger((current) => [...nextLedgers, ...current].slice(0, 250));
    }
  }, [pair, report.totalPnlUsd, trackedToken, wallet]);

  useEffect(() => {
    if (!settings.autoStrategyEnabled) return;
    if (!settings.agentSettings.some((setting) => setting.mode === "auto_strategy")) return;
    const intervalId = window.setInterval(() => {
      runAgentCycle();
    }, CRYPTO_ROOM_AGENT_LOOP_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [runAgentCycle, settings.agentSettings, settings.autoStrategyEnabled]);

  const resetRoom = useCallback(() => {
    const next = buildInitialCryptoRoomState(agents);
    setSettings(next.settings);
    setLedger(next.ledger);
    setApprovals(next.approvals);
    setQuote(null);
    setSelectedApprovalId(null);
  }, [agents]);

  return {
    pair,
    pairLoading,
    pairError,
    trackedToken,
    trackedTokenDecimals,
    wallet,
    walletLoading,
    walletError,
    connectWallet,
    disconnectWallet,
    revokeWallet,
    refreshWallet,
    tradeSide,
    setTradeSide,
    tradeAmountUi,
    setTradeAmountUi,
    tradeSlippageBps,
    setTradeSlippageBps,
    quote,
    quoteLoading,
    quoteError,
    requestQuote,
    submitting,
    submitSwap,
    swapError,
    settings,
    setSettings,
    updateAgentSetting,
    ledger,
    approvals,
    report,
    loadApprovalIntoTrade,
    rejectApproval,
    runAgentCycle,
    resetRoom,
    selectedApprovalId,
  };
}
