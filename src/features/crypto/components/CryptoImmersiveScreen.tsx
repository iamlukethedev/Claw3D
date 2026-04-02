"use client";

import {
  Activity,
  Bot,
  Coins,
  CandlestickChart,
  ExternalLink,
  LineChart,
  RefreshCw,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CRYPTO_ROOM_DEXSCREENER_URL,
  CRYPTO_ROOM_PAIR_ADDRESS,
} from "@/features/crypto/lib/constants";
import { useCryptoRoomState } from "@/features/crypto/hooks/useCryptoRoomState";
import { useCryptoLaunchState } from "@/features/crypto/hooks/useCryptoLaunchState";
import {
  getServerLaunchSessionStatus,
  loginServerLaunchSession,
  logoutServerLaunchSession,
} from "@/features/crypto/lib/launchClient";
import { getLaunchFieldLabel, getMissingRequiredLaunchField } from "@/features/crypto/lib/launchSchema";
import type { CryptoAgentTradeMode, CryptoTrackedPair } from "@/features/crypto/types";
import type { OfficeAgent } from "@/features/retro-office/core/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

type TabKey = "market" | "trade" | "ledger" | "agents" | "launch";

const DEXSCREENER_SOLANA_URL_RE =
  /^https?:\/\/(?:www\.)?dexscreener\.com\/solana\/([a-zA-Z0-9]{16,128})(?:[/?#].*)?$/i;

const parseMonitorTarget = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      url: CRYPTO_ROOM_DEXSCREENER_URL,
      lookupId: CRYPTO_ROOM_PAIR_ADDRESS,
    };
  }
  const directMatch = trimmed.match(DEXSCREENER_SOLANA_URL_RE);
  if (directMatch) {
    return {
      url: trimmed,
      lookupId: directMatch[1] ?? null,
    };
  }
  if (/^[a-zA-Z0-9]{16,128}$/.test(trimmed)) {
    return {
      url: `https://dexscreener.com/solana/${trimmed}`,
      lookupId: trimmed,
    };
  }
  return {
    url: trimmed,
    lookupId: null,
  };
};

export function CryptoImmersiveScreen({ agents }: { agents: OfficeAgent[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("market");
  const [iframeSrc, setIframeSrc] = useState(CRYPTO_ROOM_DEXSCREENER_URL);
  const [addressInput, setAddressInput] = useState(CRYPTO_ROOM_DEXSCREENER_URL);
  const [pairLookupInput, setPairLookupInput] = useState("");
  const [browsedPair, setBrowsedPair] = useState<CryptoTrackedPair | null>(null);
  const [browsedPairLoading, setBrowsedPairLoading] = useState(false);
  const [browsedPairError, setBrowsedPairError] = useState<string | null>(null);
  const state = useCryptoRoomState(agents);
  const launch = useCryptoLaunchState();

  const pendingApprovals = useMemo(
    () => state.approvals.filter((approval) => approval.status === "pending"),
    [state.approvals],
  );

  const syncBrowsedPair = async (lookupId: string | null) => {
    if (!lookupId || lookupId === CRYPTO_ROOM_PAIR_ADDRESS) {
      setBrowsedPair(null);
      setBrowsedPairError(null);
      setBrowsedPairLoading(false);
      return;
    }
    try {
      setBrowsedPairLoading(true);
      setBrowsedPairError(null);
      const response = await fetch(`/api/crypto/pair/${lookupId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        pair?: CryptoTrackedPair;
        error?: string;
      };
      if (!response.ok || !payload.pair) {
        throw new Error(payload.error?.trim() || "Unable to load DexScreener pair data.");
      }
      setBrowsedPair(payload.pair);
    } catch (error) {
      setBrowsedPair(null);
      setBrowsedPairError(
        error instanceof Error ? error.message : "Unable to load DexScreener pair data.",
      );
    } finally {
      setBrowsedPairLoading(false);
    }
  };

  const navigateMonitor = async (raw: string) => {
    const target = parseMonitorTarget(raw);
    setIframeSrc(target.url);
    setAddressInput(target.url);
    setPairLookupInput(target.lookupId ?? "");
    await syncBrowsedPair(target.lookupId);
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[radial-gradient(circle_at_top,#091923_0%,#04070d_35%,#010203_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(38,189,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(38,189,255,0.08)_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.15),transparent_35%)]" />
      <div className="relative flex min-h-full flex-col px-8 py-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.28em] text-cyan-200/70">
              <CandlestickChart className="h-4 w-4" />
              Claw3D Crypto Room
            </div>
            <h2 className="mt-3 text-[42px] font-semibold tracking-[0.06em] text-white">
              Solana Trading Desk
            </h2>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-cyan-100/70">
              The art room now runs as a monitored Solana room with DexScreener
              on the wall, Phantom-only signing, local trade reports, and agent
              trade queues that still stop for explicit wallet approval.
            </p>
          </div>

          <div className="flex w-full flex-col gap-4 xl:flex-row">
            <div className="flex-1 rounded-[28px] border border-cyan-400/15 bg-black/30 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/58">
                    Safety posture
                  </div>
                  <div className="mt-1 text-[18px] font-semibold text-white">
                    Phantom-only custody
                  </div>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 p-3">
                  <Shield className="h-5 w-5 text-emerald-200" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricCard
                  label="Connected wallet"
                  value={
                    state.wallet.publicKey
                      ? shorten(state.wallet.publicKey)
                      : "Not connected"
                  }
                />
                <MetricCard
                  label="Pending approvals"
                  value={String(pendingApprovals.length)}
                />
                <MetricCard
                  label="Realized PnL"
                  value={currency.format(state.report.realizedPnlUsd)}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    state.wallet.connected
                      ? void state.disconnectWallet()
                      : void state.connectWallet()
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-cyan-400/18 bg-cyan-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:bg-cyan-400/16"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  {state.wallet.connected ? "Disconnect" : "Connect"}
                </button>
                <button
                  type="button"
                  onClick={() => void state.refreshWallet()}
                  disabled={!state.wallet.connected || state.walletLoading}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/6 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/78 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${state.walletLoading ? "animate-spin" : ""}`}
                  />
                  {state.walletLoading ? "Refreshing" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      CRYPTO_ROOM_DEXSCREENER_URL,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100 transition-colors hover:bg-emerald-400/16"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  DexScreener
                </button>
                <button
                  type="button"
                  onClick={() => void state.revokeWallet()}
                  disabled={!state.wallet.connected}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-100 transition-colors hover:bg-rose-400/16 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Revoke
                </button>
              </div>
              {state.walletError ? (
                <Banner tone="danger" className="mt-4">
                  {state.walletError}
                </Banner>
              ) : null}
            </div>

            <div className="w-full rounded-[28px] border border-cyan-400/15 bg-black/30 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] xl:w-[340px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/58">
                    Wallet holdings
                  </div>
                  <div className="mt-1 text-[18px] font-semibold text-white">
                    {state.walletLoading
                      ? "Loading..."
                      : `${number.format(state.wallet.solBalance)} SOL`}
                  </div>
                </div>
                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-3">
                  <Coins className="h-5 w-5 text-cyan-200" />
                </div>
              </div>
              {!state.wallet.connected ? (
                <Banner tone="neutral" className="mt-4">
                  Connect Phantom to see holdings.
                </Banner>
              ) : (
                <>
                  <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-cyan-100/48">
                    {state.wallet.tokenHoldings.length} token{state.wallet.tokenHoldings.length !== 1 ? "s" : ""} found
                  </div>
                  <div className="mt-2 max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
                    {state.wallet.tokenHoldings.length === 0 ? (
                      <div className="py-2 text-[12px] text-white/40">No SPL tokens found.</div>
                    ) : (
                      state.wallet.tokenHoldings.map((holding) => (
                        <button
                          key={holding.mint}
                          type="button"
                          onClick={() => {
                            setActiveTab("market");
                            void navigateMonitor(holding.mint);
                          }}
                          className="flex items-center gap-2.5 rounded-[14px] border border-white/8 bg-white/[0.03] px-3 py-2 transition-colors hover:border-cyan-400/25 hover:bg-white/[0.06]"
                        >
                          {holding.imageUrl ? (
                            <img
                              src={holding.imageUrl}
                              alt={holding.symbol || holding.name}
                              className="h-8 w-8 flex-shrink-0 rounded-full"
                            />
                          ) : (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-bold text-white/40">
                              {(holding.symbol || "?").slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-white">
                              {holding.symbol || holding.name || shorten(holding.mint)}
                            </div>
                            {holding.name && holding.symbol ? (
                              <div className="text-[10px] text-white/40">{holding.name}</div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="text-right text-[14px] font-semibold text-white">
                              {number.format(holding.balance)}
                            </div>
                            <ExternalLink className="h-3 w-3 flex-shrink-0 text-white/25" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  {state.wallet.lastUpdatedAt ? (
                    <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/35">
                      Updated {new Date(state.wallet.lastUpdatedAt).toLocaleTimeString()}.
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="w-full rounded-[28px] border border-cyan-400/15 bg-black/30 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] xl:w-[340px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/58">
                    Local ledger
                  </div>
                  <div className="mt-1 text-[18px] font-semibold text-white">
                    {currency.format(state.report.totalPnlUsd)} PnL
                  </div>
                </div>
                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-3">
                  <Activity className="h-5 w-5 text-cyan-200" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MetricCard label="Realized" value={currency.format(state.report.realizedPnlUsd)} />
                <MetricCard label="Unrealized" value={currency.format(state.report.unrealizedPnlUsd)} />
                <MetricCard label="Win rate" value={`${state.report.winRatePct.toFixed(1)}%`} />
                <MetricCard label="Volume" value={compactCurrency.format(state.report.totalVolumeUsd)} />
              </div>
              <div className="mt-3 max-h-[160px] space-y-1.5 overflow-y-auto pr-1">
                {state.ledger.length === 0 ? (
                  <div className="py-2 text-[12px] text-white/40">No trades recorded yet.</div>
                ) : (
                  state.ledger.slice(0, 10).map((trade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between gap-2 rounded-[14px] border border-white/8 bg-white/[0.03] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold text-white">
                          {trade.side === "buy" ? "Bought" : "Sold"} {trade.tokenSymbol}
                        </div>
                        <div className="text-[10px] text-white/35">
                          {trade.source === "agent" ? trade.agentName ?? "Agent" : "User"} · {trade.status}
                        </div>
                      </div>
                      <div className="text-right text-[13px] font-semibold text-white">
                        {currency.format(trade.notionalUsd)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          {[
            {
              key: "market" as const,
              label: "Market",
              icon: <LineChart className="h-4 w-4" />,
            },
            {
              key: "trade" as const,
              label: "Trade",
              icon: <Wallet className="h-4 w-4" />,
            },
            {
              key: "ledger" as const,
              label: "Ledger",
              icon: <Activity className="h-4 w-4" />,
            },
            {
              key: "agents" as const,
              label: "Agents",
              icon: <Bot className="h-4 w-4" />,
            },
            {
              key: "launch" as const,
              label: "Launch",
              icon: <Sparkles className="h-4 w-4" />,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                activeTab === tab.key
                  ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100"
                  : "border-white/10 bg-white/4 text-white/62 hover:bg-white/10 hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === "market" ? (
            <MarketTab
              state={state}
              iframeSrc={iframeSrc}
              addressInput={addressInput}
              pairLookupInput={pairLookupInput}
              browsedPair={browsedPair}
              browsedPairLoading={browsedPairLoading}
              browsedPairError={browsedPairError}
              onAddressInputChange={setAddressInput}
              onPairLookupInputChange={setPairLookupInput}
              onNavigate={navigateMonitor}
              onLookup={() => navigateMonitor(pairLookupInput)}
            />
          ) : activeTab === "trade" ? (
            <TradeTab state={state} pendingApprovals={pendingApprovals} />
          ) : activeTab === "ledger" ? (
            <LedgerTab state={state} />
          ) : activeTab === "launch" ? (
            <LaunchTab launch={launch} />
          ) : (
            <AgentsTab state={state} />
          )}
        </div>
      </div>
    </div>
  );
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected image file."));
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to read the selected image file."));
    };
    reader.readAsDataURL(file);
  });

function MarketTab({
  state,
  iframeSrc,
  addressInput,
  pairLookupInput,
  browsedPair,
  browsedPairLoading,
  browsedPairError,
  onAddressInputChange,
  onPairLookupInputChange,
  onNavigate,
  onLookup,
}: {
  state: ReturnType<typeof useCryptoRoomState>;
  iframeSrc: string;
  addressInput: string;
  pairLookupInput: string;
  browsedPair: CryptoTrackedPair | null;
  browsedPairLoading: boolean;
  browsedPairError: string | null;
  onAddressInputChange: (value: string) => void;
  onPairLookupInputChange: (value: string) => void;
  onNavigate: (value: string) => Promise<void>;
  onLookup: () => Promise<void>;
}) {
  const snapshotPair = browsedPair ?? state.pair;
  const snapshotLoading = browsedPairLoading || (!browsedPair && state.pairLoading);
  const snapshotError = browsedPairError ?? (!browsedPair ? state.pairError : null);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
      <SectionCard
        title="Wall monitors"
        subtitle="Type any token address or DexScreener URL in the bar below and press Enter."
        action={
          <button
            type="button"
            onClick={() =>
              window.open(iframeSrc, "_blank", "noopener,noreferrer")
            }
            className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/75 transition-colors hover:bg-white/10"
          >
            Open full browser
          </button>
        }
      >
        <div className="overflow-hidden rounded-[22px] border border-cyan-300/12 bg-black/45">
          <div className="flex items-center gap-3 border-b border-white/10 bg-[#0b1118] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <input
              value={addressInput}
              onChange={(e) => onAddressInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onNavigate(addressInput);
              }}
              placeholder="Paste a token address or DexScreener URL..."
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-4 py-2 font-mono text-[13px] text-white/80 outline-none transition-colors placeholder:text-white/30 focus:border-cyan-400/30"
            />
            <button
              type="button"
              onClick={() => void onNavigate(addressInput)}
              className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60 transition-colors hover:bg-white/10"
            >
              Go
            </button>
            <button
              type="button"
              onClick={() => void onNavigate(CRYPTO_ROOM_DEXSCREENER_URL)}
              className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60 transition-colors hover:bg-white/10"
            >
              Home
            </button>
          </div>
          <iframe
            title="DexScreener crypto room"
            src={iframeSrc}
            className="h-[66vh] w-full bg-black"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Pair address"
            value={shorten(snapshotPair?.pairAddress ?? CRYPTO_ROOM_PAIR_ADDRESS)}
          />
          <MetricCard
            label="Tracked token"
            value={
              snapshotPair
                ? snapshotPair.baseToken.address === state.pair?.quoteToken.address
                  ? snapshotPair.quoteToken.symbol
                  : snapshotPair.baseToken.symbol
                : "Loading"
            }
          />
          <MetricCard
            label="Price"
            value={currency.format(snapshotPair?.priceUsd ?? 0)}
          />
          <MetricCard
            label="24H volume"
            value={compactCurrency.format(snapshotPair?.volume24hUsd ?? 0)}
          />
        </div>
      </SectionCard>

      <div className="space-y-6">
        <SectionCard
          title="Pair snapshot"
          subtitle="Live pair data from DexScreener."
        >
          <div className="mb-4 flex gap-2">
            <input
              value={pairLookupInput}
              onChange={(event) => onPairLookupInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void onLookup();
              }}
              placeholder="Paste token or pair address..."
              className="min-w-0 flex-1 rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/35"
            />
            <button
              type="button"
              onClick={() => void onLookup()}
              className="rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/72 transition-colors hover:bg-white/10"
            >
              Sync
            </button>
          </div>
          {snapshotLoading ? (
            <Banner tone="neutral">Loading pair telemetry.</Banner>
          ) : null}
          {snapshotError ? (
            <Banner tone="danger">{snapshotError}</Banner>
          ) : null}
          {snapshotPair ? (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Base token"
                value={snapshotPair.baseToken.symbol}
              />
              <MetricCard
                label="Quote token"
                value={snapshotPair.quoteToken.symbol}
              />
              <MetricCard
                label="1H change"
                value={formatSignedPct(snapshotPair.priceChangePct.h1)}
              />
              <MetricCard
                label="24H change"
                value={formatSignedPct(snapshotPair.priceChangePct.h24)}
              />
              <MetricCard
                label="Liquidity"
                value={compactCurrency.format(snapshotPair.liquidityUsd ?? 0)}
              />
              <MetricCard
                label="FDV"
                value={compactCurrency.format(snapshotPair.fdv ?? 0)}
              />
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Risk rails"
          subtitle="The crypto room never stores wallet secrets and keeps embedded browsing separate from swap signing."
        >
          <div className="space-y-3">
            <Banner tone="success">
              Wallet custody is delegated to Phantom. The app only sees the
              public key and signed transactions.
            </Banner>
            <Banner tone="neutral">
              Pending agent actions queue locally and require the user to
              explicitly load and sign them from the trade panel.
            </Banner>
            <Banner tone="danger">
              The local ledger only reflects trades submitted through this room.
              External wallet activity can change balances without changing the
              stored PnL history.
            </Banner>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function LaunchTab({
  launch,
}: {
  launch: ReturnType<typeof useCryptoLaunchState>;
}) {
  const [tipFloor, setTipFloor] = useState<number | null>(null);
  const [tipFloorError, setTipFloorError] = useState<string | null>(null);
  const [operatorPassword, setOperatorPassword] = useState("");
  const [serverSessionAuthenticated, setServerSessionAuthenticated] = useState(false);
  const [serverSessionBusy, setServerSessionBusy] = useState(false);
  const [serverSessionError, setServerSessionError] = useState<string | null>(null);
  const serverModeEnabled =
    process.env.NEXT_PUBLIC_CRYPTO_LAUNCH_SERVER_MODE_ENABLED === "true";
  const effectiveServerSessionAuthenticated =
    serverModeEnabled && serverSessionAuthenticated;
  const effectiveServerSessionError = serverModeEnabled ? serverSessionError : null;
  const serverModeUnavailableSelection =
    !serverModeEnabled && launch.draft.executionMode === "server_side";
  const missingField = getMissingRequiredLaunchField(launch.draft);
  const effectiveTipFloor = launch.draft.network === "mainnet" ? tipFloor : null;
  const effectiveTipFloorError =
    launch.draft.network === "mainnet" ? tipFloorError : null;
  const requiresServerOperatorSession =
    serverModeEnabled && launch.draft.executionMode === "server_side";
  const launchDisabled =
    launch.launchBusy ||
    Boolean(missingField) ||
    serverModeUnavailableSelection ||
    (requiresServerOperatorSession && !effectiveServerSessionAuthenticated);

  useEffect(() => {
    if (launch.draft.network !== "mainnet") {
      return;
    }
    let cancelled = false;
    void fetch("/api/crypto/launch/tip-floor", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          landed_tips_50th_percentile?: number;
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(payload?.error?.trim() || "Unable to load the Jito tip floor.");
        }
        if (!cancelled) {
          setTipFloor(payload?.landed_tips_50th_percentile ?? null);
          setTipFloorError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTipFloor(null);
          setTipFloorError(error instanceof Error ? error.message : "Unable to load the Jito tip floor.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [launch.draft.network]);

  useEffect(() => {
    if (!serverModeEnabled) return;
    let cancelled = false;
    void getServerLaunchSessionStatus()
      .then((authenticated) => {
        if (!cancelled) {
          setServerSessionAuthenticated(authenticated);
          setServerSessionError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setServerSessionAuthenticated(false);
          setServerSessionError(
            error instanceof Error ? error.message : "Unable to verify the launch operator session.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [serverModeEnabled]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
      <SectionCard
        title="Pump.fun launcher"
        subtitle="Build the token metadata here, choose how execution works, then launch from the same draft the chat flow uses."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={launch.resetDraft}
              className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/75 transition-colors hover:bg-white/10"
            >
              Reset draft
            </button>
            <button
              type="button"
              onClick={() => {
                launch.clearLaunchError();
                void launch.submitLaunch().catch(() => {});
              }}
              disabled={launchDisabled}
              className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {launch.launchBusy ? "Launching" : "Launch token"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LabeledField label="Network">
            <select
              value={launch.draft.network}
              onChange={(event) =>
                launch.setDraft((current) => ({
                  ...current,
                  network: event.target.value === "mainnet" ? "mainnet" : "devnet",
                }))
              }
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
            >
              <option value="devnet">Devnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
          </LabeledField>
          <LabeledField label="Execution mode">
            <select
              value={launch.draft.executionMode}
              onChange={(event) =>
                launch.setDraft((current) => ({
                  ...current,
                  executionMode:
                    event.target.value === "server_side" ? "server_side" : "user_approved",
                }))
              }
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
            >
              <option value="user_approved">User-approved wallet</option>
              <option value="server_side" disabled={!serverModeEnabled}>
                Server-side signer
              </option>
            </select>
          </LabeledField>
          {!serverModeEnabled ? (
            <LabeledField label="Server-side mode">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] leading-6 text-white/74">
                Disabled for this frontend build. Set
                {" "}
                `NEXT_PUBLIC_CRYPTO_LAUNCH_SERVER_MODE_ENABLED=true`
                {" "}
                after the server-side path is configured.
              </div>
            </LabeledField>
          ) : null}
          {serverModeEnabled ? (
            <LabeledField label="Server launch operator session">
              <div className="space-y-3 rounded-[18px] border border-amber-400/18 bg-[#071019] p-4">
                <div className="text-[12px] leading-6 text-white/70">
                  {effectiveServerSessionAuthenticated
                    ? "Authenticated. Server-side launches can use the protected server signer from this browser session."
                    : "Sign in with the launch operator password to unlock server-side launches."}
                </div>
                {!effectiveServerSessionAuthenticated ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="password"
                      value={operatorPassword}
                      onChange={(event) => setOperatorPassword(event.target.value)}
                      className="min-w-0 flex-1 rounded-2xl border border-amber-400/18 bg-black/20 px-4 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-amber-300/35"
                      placeholder="Launch operator password"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setServerSessionBusy(true);
                        setServerSessionError(null);
                        void loginServerLaunchSession(operatorPassword)
                          .then((authenticated) => {
                            setServerSessionAuthenticated(authenticated);
                            setOperatorPassword("");
                          })
                          .catch((error) => {
                            setServerSessionAuthenticated(false);
                            setServerSessionError(
                              error instanceof Error
                                ? error.message
                                : "Unable to authenticate the launch operator session.",
                            );
                          })
                          .finally(() => setServerSessionBusy(false));
                      }}
                      disabled={serverSessionBusy || !operatorPassword.trim()}
                      className="rounded-full border border-amber-300/25 bg-amber-300/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100 transition-colors hover:bg-amber-300/16 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {serverSessionBusy ? "Signing in" : "Unlock"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] uppercase tracking-[0.16em] text-emerald-200/85">
                      Operator session active
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setServerSessionBusy(true);
                        setServerSessionError(null);
                        void logoutServerLaunchSession()
                          .then(() => {
                            setServerSessionAuthenticated(false);
                          })
                          .catch((error) => {
                            setServerSessionError(
                              error instanceof Error
                                ? error.message
                                : "Unable to clear the launch operator session.",
                            );
                          })
                          .finally(() => setServerSessionBusy(false));
                      }}
                      disabled={serverSessionBusy}
                      className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/75 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {serverSessionBusy ? "Working" : "Lock"}
                    </button>
                  </div>
                )}
              </div>
            </LabeledField>
          ) : null}
          <LabeledField label="Token name">
            <input
              value={launch.draft.name}
              onChange={(event) =>
                launch.setDraft((current) => ({ ...current, name: event.target.value }))
              }
              maxLength={32}
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/35"
              placeholder="Claw Coin"
            />
          </LabeledField>
          <LabeledField label="Token symbol">
            <input
              value={launch.draft.symbol}
              onChange={(event) =>
                launch.setDraft((current) => ({
                  ...current,
                  symbol: event.target.value.toUpperCase(),
                }))
              }
              maxLength={10}
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] uppercase text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/35"
              placeholder="CLAW"
            />
          </LabeledField>
        </div>
        <div className="mt-4">
          <LabeledField label="Description">
            <textarea
              value={launch.draft.description}
              onChange={(event) =>
                launch.setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={5}
              maxLength={280}
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/35"
              placeholder="Tell the story behind the token."
            />
          </LabeledField>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <LabeledField label="Logo URL">
            <input
              value={launch.draft.logoUrl}
              onChange={(event) =>
                launch.setDraft((current) => ({ ...current, logoUrl: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/35"
              placeholder="https://..."
            />
          </LabeledField>
          <LabeledField label="Upload logo">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void readFileAsDataUrl(file)
                  .then((logoUrl) => {
                    launch.setDraft((current) => ({ ...current, logoUrl }));
                  })
                  .catch(() => {});
              }}
              className="block w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white file:mr-3 file:rounded-full file:border-0 file:bg-cyan-300/14 file:px-3 file:py-1 file:text-[11px] file:font-semibold file:uppercase file:tracking-[0.14em] file:text-cyan-100"
            />
          </LabeledField>
          <LabeledField label="Website">
            <input
              value={launch.draft.website}
              onChange={(event) =>
                launch.setDraft((current) => ({ ...current, website: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/35"
              placeholder="https://..."
            />
          </LabeledField>
          <LabeledField label="Twitter/X">
            <input
              value={launch.draft.twitter}
              onChange={(event) =>
                launch.setDraft((current) => ({ ...current, twitter: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/35"
              placeholder="https://x.com/..."
            />
          </LabeledField>
          <LabeledField label="Telegram">
            <input
              value={launch.draft.telegram}
              onChange={(event) =>
                launch.setDraft((current) => ({ ...current, telegram: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/35"
              placeholder="https://t.me/..."
            />
          </LabeledField>
          <LabeledField label="Discord">
            <input
              value={launch.draft.discord}
              onChange={(event) =>
                launch.setDraft((current) => ({ ...current, discord: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/35"
              placeholder="https://discord.gg/..."
            />
          </LabeledField>
          <LabeledField label="Priority fee (SOL)">
            <input
              value={launch.draft.priorityFeeSol}
              onChange={(event) =>
                launch.setDraft((current) => ({
                  ...current,
                  priorityFeeSol: Number(event.target.value) || 0,
                }))
              }
              inputMode="decimal"
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
            />
          </LabeledField>
          <LabeledField label="Compute units">
            <input
              value={launch.draft.computeUnitLimit}
              onChange={(event) =>
                launch.setDraft((current) => ({
                  ...current,
                  computeUnitLimit: Number(event.target.value) || 0,
                }))
              }
              inputMode="numeric"
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
            />
          </LabeledField>
        </div>
      </SectionCard>

      <div className="space-y-6">
        <SectionCard
          title="Launch review"
          subtitle="Required fields, runtime notes, and the last prepared or submitted launch."
        >
          <div className="space-y-3">
            {launch.conversation.active ? (
              <Banner tone="neutral">
                An agent is currently building this token draft and is waiting for{" "}
                {launch.conversation.awaitingField
                  ? getLaunchFieldLabel(launch.conversation.awaitingField)
                  : "confirmation"}
                .
              </Banner>
            ) : null}
            {missingField ? (
              <Banner tone="danger">
                Fill in the {getLaunchFieldLabel(missingField)} field before launching.
              </Banner>
            ) : (
              <Banner tone="success">
                The required token fields are complete and ready for launch review.
              </Banner>
            )}
            {launch.draft.executionMode === "user_approved" ? (
              <Banner tone="neutral">
                Wallet-approved launches will connect to Phantom, prepare the Pump.fun transaction, and ask for an explicit signature before submission.
              </Banner>
            ) : serverModeUnavailableSelection ? (
              <Banner tone="danger">
                Server-side mode is not enabled for this frontend build, so this draft cannot be launched until that flag is turned on or you switch back to user-approved mode.
              </Banner>
            ) : (
              <Banner tone="danger">
                Server-side launches require `CRYPTO_LAUNCH_SERVER_MODE_ENABLED=true`, `PUMPFUN_SERVER_SECRET_KEY`, and an authenticated operator session before submission.
              </Banner>
            )}
            {requiresServerOperatorSession && !effectiveServerSessionAuthenticated ? (
              <Banner tone="danger">
                Authenticate the launch operator session before you submit a server-side launch.
              </Banner>
            ) : null}
            {effectiveServerSessionError ? (
              <Banner tone="danger">{effectiveServerSessionError}</Banner>
            ) : null}
            {launch.draft.network === "mainnet" ? (
              effectiveTipFloor !== null ? (
                <Banner tone="neutral">
                  Current Jito p50 tip floor: {effectiveTipFloor.toFixed(6)} SOL.
                </Banner>
              ) : effectiveTipFloorError ? (
                <Banner tone="danger">{effectiveTipFloorError}</Banner>
              ) : null
            ) : (
              <Banner tone="neutral">
                Devnet is the safest place to validate the full flow before launching on mainnet.
              </Banner>
            )}
            {launch.launchError ? <Banner tone="danger">{launch.launchError}</Banner> : null}
          </div>
          <div className="mt-4 space-y-2">
            <StatRow label="Mode" value={launch.draft.executionMode === "server_side" ? "Server-side" : "User-approved"} />
            <StatRow label="Network" value={launch.draft.network} />
            <StatRow
              label="Creator wallet"
              value={launch.lastResult?.creatorPublicKey || launch.draft.creatorWallet || "Resolved at launch time"}
            />
            <StatRow label="Token name" value={launch.draft.name || "Pending"} />
            <StatRow label="Ticker" value={launch.draft.symbol || "Pending"} />
          </div>
        </SectionCard>

        <SectionCard
          title="Latest launch"
          subtitle="This reflects the most recent prepared or submitted token launch from this browser."
        >
          {launch.lastResult ? (
            <div className="space-y-3">
              <Banner tone="success">
                Launch submitted for {launch.lastResult.mintAddress}. You can review the mint and transaction links below.
              </Banner>
              <StatRow label="Mint address" value={shorten(launch.lastResult.mintAddress)} />
              <StatRow label="Creator" value={shorten(launch.lastResult.creatorPublicKey)} />
              <StatRow label="Submitted" value={new Date(launch.lastResult.submittedAt).toLocaleString()} />
              <a
                href={launch.lastResult.explorerTokenUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-cyan-100 transition-colors hover:bg-white/[0.06]"
              >
                Open token explorer
              </a>
              <a
                href={launch.lastResult.explorerTxUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-cyan-100 transition-colors hover:bg-white/[0.06]"
              >
                Open transaction explorer
              </a>
            </div>
          ) : launch.lastPrepared ? (
            <div className="space-y-3">
              <Banner tone="neutral">
                The last prepared launch is waiting for{" "}
                {launch.lastPrepared.executionMode === "server_side"
                  ? "server-side submission"
                  : "wallet approval"}
                .
              </Banner>
              <StatRow label="Mint address" value={shorten(launch.lastPrepared.mintAddress)} />
              <StatRow label="Metadata URI" value={shorten(launch.lastPrepared.metadataUri)} />
              <StatRow
                label="Expires"
                value={new Date(launch.lastPrepared.expiresAt).toLocaleTimeString()}
              />
            </div>
          ) : (
            <Banner tone="neutral">
              No Pump.fun token has been prepared in this browser yet.
            </Banner>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function TradeTab({
  state,
  pendingApprovals,
}: {
  state: ReturnType<typeof useCryptoRoomState>;
  pendingApprovals: ReturnType<typeof state.approvals.filter>;
}) {
  const inputLabel =
    state.tradeSide === "buy"
      ? `Input size (${state.pair?.quoteToken.symbol ?? "SOL"})`
      : `Input size (${state.trackedToken?.symbol ?? "TOKEN"})`;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_460px]">
      <SectionCard
        title="Native swap panel"
        subtitle="Prepare quotes through Jupiter and sign through Phantom."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PanelCard title="Wallet balances">
            <StatRow
              label="Wallet"
              value={
                state.wallet.publicKey
                  ? shorten(state.wallet.publicKey)
                  : "Not connected"
              }
            />
            <StatRow
              label="SOL"
              value={
                state.walletLoading
                  ? "Loading..."
                  : number.format(state.wallet.solBalance)
              }
            />
            <StatRow
              label={state.trackedToken?.symbol ?? "Tracked"}
              value={
                state.walletLoading
                  ? "Loading..."
                  : number.format(state.wallet.trackedTokenBalance)
              }
            />
          </PanelCard>

          <PanelCard title="Execution constraints">
            <StatRow
              label="Default slippage"
              value={`${state.settings.defaultSlippageBps} bps`}
            />
            <StatRow
              label="Daily loss guard"
              value={currency.format(state.settings.maxDailyLossUsd)}
            />
            <StatRow
              label="Quote route"
              value={state.quote?.routeLabel ?? "Request quote"}
            />
          </PanelCard>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[180px_minmax(0,1fr)_180px]">
          <LabeledField label="Side">
            <select
              value={state.tradeSide}
              onChange={(event) =>
                state.setTradeSide(event.target.value as "buy" | "sell")
              }
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[14px] text-white outline-none transition-colors focus:border-cyan-300/35"
            >
              <option value="buy">
                Buy {state.trackedToken?.symbol ?? "token"}
              </option>
              <option value="sell">
                Sell {state.trackedToken?.symbol ?? "token"}
              </option>
            </select>
          </LabeledField>
          <LabeledField label={inputLabel}>
            <input
              value={state.tradeAmountUi}
              onChange={(event) => state.setTradeAmountUi(event.target.value)}
              inputMode="decimal"
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[14px] text-white outline-none transition-colors focus:border-cyan-300/35"
            />
          </LabeledField>
          <LabeledField label="Slippage">
            <input
              value={state.tradeSlippageBps}
              onChange={(event) =>
                state.setTradeSlippageBps(Number(event.target.value) || 0)
              }
              inputMode="numeric"
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[14px] text-white outline-none transition-colors focus:border-cyan-300/35"
            />
          </LabeledField>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {state.tradeSide === "sell"
            ? [0.1, 0.25, 0.5, 1].map((fraction) => (
                <button
                  key={fraction}
                  type="button"
                  onClick={() =>
                    state.setTradeAmountUi(
                      (state.wallet.trackedTokenBalance * fraction).toFixed(4),
                    )
                  }
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/70 transition-colors hover:bg-white/10"
                >
                  {Math.round(fraction * 100)}%
                </button>
              ))
            : [0.1, 0.25, 0.5, 1].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => state.setTradeAmountUi(amount.toFixed(2))}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/70 transition-colors hover:bg-white/10"
                >
                  {amount.toFixed(2)} SOL
                </button>
              ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void state.requestQuote()}
            disabled={state.quoteLoading}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/24 bg-cyan-300/12 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${state.quoteLoading ? "animate-spin" : ""}`}
            />
            Request quote
          </button>
          <button
            type="button"
            onClick={() => void state.submitSwap()}
            disabled={
              state.submitting || !state.wallet.connected || !state.quote
            }
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300/24 bg-emerald-300/12 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-100 transition-colors hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Sign with Phantom
          </button>
        </div>

        {state.quote ? (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard
              label="Input"
              value={`${number.format(state.quote.inputAmountUi)} ${state.tradeSide === "buy" ? "SOL" : (state.trackedToken?.symbol ?? "TOKEN")}`}
            />
            <MetricCard
              label="Expected output"
              value={`${number.format(state.quote.outputAmountUi)} ${state.tradeSide === "buy" ? (state.trackedToken?.symbol ?? "TOKEN") : "SOL"}`}
            />
            <MetricCard
              label="Impact"
              value={`${state.quote.priceImpactPct.toFixed(2)}%`}
            />
            <MetricCard label="Route" value={state.quote.routeLabel} />
          </div>
        ) : null}

        {state.quoteError ? (
          <Banner tone="danger" className="mt-4">
            {state.quoteError}
          </Banner>
        ) : null}
        {state.swapError ? (
          <Banner tone="danger" className="mt-4">
            {state.swapError}
          </Banner>
        ) : null}
      </SectionCard>

      <div className="space-y-6">
        <SectionCard
          title="Approval queue"
          subtitle="Agent trades stop here before any signing step."
        >
          <div className="space-y-3">
            {pendingApprovals.length === 0 ? (
              <Banner tone="neutral">No queued approvals right now.</Banner>
            ) : (
              pendingApprovals.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/55">
                        {approval.agentName}
                      </div>
                      <div className="mt-1 text-[18px] font-semibold text-white">
                        {approval.side === "buy" ? "Buy" : "Sell"} proposal
                      </div>
                      <div className="mt-2 text-[13px] leading-6 text-white/70">
                        {approval.rationale}
                      </div>
                    </div>
                    <div className="rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                      expires in {minutesRemaining(approval.expiresAt)}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MetricCard
                      label="Size"
                      value={`${number.format(approval.proposedInputAmountUi)} ${approval.side === "buy" ? "SOL" : (state.trackedToken?.symbol ?? "TOKEN")}`}
                    />
                    <MetricCard
                      label="Slippage"
                      value={`${approval.slippageBps} bps`}
                    />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => state.loadApprovalIntoTrade(approval.id)}
                      className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100 transition-colors hover:bg-emerald-300/18"
                    >
                      Load into trade panel
                    </button>
                    <button
                      type="button"
                      onClick={() => state.rejectApproval(approval.id)}
                      className="rounded-full border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-100 transition-colors hover:bg-rose-300/18"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Manual safety checks"
          subtitle="These checks happen before you sign."
        >
          <div className="space-y-3">
            <Banner tone="success">
              The wallet provider stays outside the room UI and signs in
              Phantom.
            </Banner>
            <Banner tone="neutral">
              Quotes older than one minute are rejected and must be refreshed.
            </Banner>
            <Banner tone="neutral">
              Agent auto mode can queue trades, but it cannot silently submit
              transactions.
            </Banner>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function LedgerTab({
  state,
}: {
  state: ReturnType<typeof useCryptoRoomState>;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
      <SectionCard
        title="Local PnL report"
        subtitle="Tracked trades executed through this crypto room only."
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Total PnL"
            value={currency.format(state.report.totalPnlUsd)}
          />
          <MetricCard
            label="Realized"
            value={currency.format(state.report.realizedPnlUsd)}
          />
          <MetricCard
            label="Unrealized"
            value={currency.format(state.report.unrealizedPnlUsd)}
          />
          <MetricCard
            label="Win rate"
            value={`${state.report.winRatePct.toFixed(1)}%`}
          />
          <MetricCard
            label="Volume"
            value={compactCurrency.format(state.report.totalVolumeUsd)}
          />
          <MetricCard
            label="Fees"
            value={currency.format(state.report.feesPaidUsd)}
          />
          <MetricCard
            label="Average entry"
            value={currency.format(state.report.averageEntryUsd)}
          />
          <MetricCard
            label="Open quantity"
            value={`${number.format(state.report.openTokenQuantity)} ${state.report.trackedTokenSymbol}`}
          />
        </div>

        <div className="mt-6 space-y-3">
          {state.ledger.length === 0 ? (
            <Banner tone="neutral">
              The room has not recorded any trade activity yet.
            </Banner>
          ) : (
            state.ledger.map((trade) => (
              <div
                key={trade.id}
                className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/55">
                      {trade.source === "agent"
                        ? `${trade.agentName ?? "Agent"} · ${trade.status}`
                        : `User · ${trade.status}`}
                    </div>
                    <div className="mt-1 text-[17px] font-semibold text-white">
                      {trade.side === "buy" ? "Bought" : "Sold"}{" "}
                      {trade.tokenSymbol}
                    </div>
                    <div className="mt-1 text-[13px] text-white/68">
                      {trade.rationale ?? "No rationale recorded."}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                      Value
                    </div>
                    <div className="mt-1 text-[18px] text-white">
                      {currency.format(trade.notionalUsd)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <MetricCard
                    label="Input"
                    value={`${number.format(trade.inputAmountUi)} ${trade.side === "buy" ? "SOL" : trade.tokenSymbol}`}
                  />
                  <MetricCard
                    label="Output"
                    value={`${number.format(trade.outputAmountUi)} ${trade.side === "buy" ? trade.tokenSymbol : "SOL"}`}
                  />
                  <MetricCard
                    label="Token delta"
                    value={`${trade.tokenDelta >= 0 ? "+" : ""}${number.format(trade.tokenDelta)}`}
                  />
                  <MetricCard
                    label="Signature"
                    value={
                      trade.txSignature
                        ? shorten(trade.txSignature)
                        : trade.error
                          ? "Failed"
                          : "Pending"
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <div className="space-y-6">
        <SectionCard
          title="Attribution"
          subtitle="Performance split by user and agents."
        >
          <div className="space-y-3">
            {state.report.bySource.length === 0 ? (
              <Banner tone="neutral">No attributed trade flow yet.</Banner>
            ) : (
              state.report.bySource.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/55">
                    {entry.label}
                  </div>
                  <div className="mt-2 text-[18px] font-semibold text-white">
                    {currency.format(entry.realizedPnlUsd)}
                  </div>
                  <div className="mt-1 text-[12px] text-white/60">
                    {entry.tradeCount} trades ·{" "}
                    {compactCurrency.format(entry.totalVolumeUsd)} volume
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Guard rails"
          subtitle="Room-level reset and monitoring."
        >
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => state.resetRoom()}
              className="w-full rounded-[18px] border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.18em] text-rose-100 transition-colors hover:bg-rose-300/16"
            >
              Reset local crypto ledger
            </button>
            <Banner tone="danger">
              Resetting clears locally stored approvals and reports, but it does
              not touch the connected Phantom wallet or on-chain balances.
            </Banner>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function AgentsTab({
  state,
}: {
  state: ReturnType<typeof useCryptoRoomState>;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_440px]">
      <SectionCard
        title="Agent strategy board"
        subtitle="Configure who only suggests, who queues approvals, and which agents participate in the auto strategy loop."
        action={
          <button
            type="button"
            onClick={() => state.runAgentCycle()}
            className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-300/18"
          >
            Run agent cycle
          </button>
        }
      >
        <div className="space-y-4">
          {state.settings.agentSettings.map((setting) => (
            <div
              key={setting.agentId}
              className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/55">
                    Agent
                  </div>
                  <div className="mt-1 text-[20px] font-semibold text-white">
                    {setting.agentName}
                  </div>
                  <div className="mt-2 text-[13px] text-white/62">
                    {setting.lastSignalSummary ?? "No signal generated yet."}
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                  {setting.lastSignalAt
                    ? new Date(setting.lastSignalAt).toLocaleTimeString()
                    : "No signal"}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <LabeledField label="Mode">
                  <select
                    value={setting.mode}
                    onChange={(event) =>
                      state.updateAgentSetting(setting.agentId, {
                        mode: event.target.value as CryptoAgentTradeMode,
                      })
                    }
                    className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
                  >
                    <option value="suggest_only">Suggest only</option>
                    <option value="prepare_for_approval">
                      Prepare + approval
                    </option>
                    <option value="auto_strategy">Auto strategy</option>
                  </select>
                </LabeledField>
                <LabeledField label="Max trade (SOL)">
                  <input
                    value={setting.maxTradeSol}
                    onChange={(event) =>
                      state.updateAgentSetting(setting.agentId, {
                        maxTradeSol: Number(event.target.value) || 0,
                      })
                    }
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
                  />
                </LabeledField>
                <LabeledField label="Slippage (bps)">
                  <input
                    value={setting.slippageBps}
                    onChange={(event) =>
                      state.updateAgentSetting(setting.agentId, {
                        slippageBps: Number(event.target.value) || 0,
                      })
                    }
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
                  />
                </LabeledField>
                <LabeledField label="Cooldown (min)">
                  <input
                    value={setting.cooldownMinutes}
                    onChange={(event) =>
                      state.updateAgentSetting(setting.agentId, {
                        cooldownMinutes: Number(event.target.value) || 0,
                      })
                    }
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
                  />
                </LabeledField>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <LabeledField label="Daily loss limit (USD)">
                  <input
                    value={setting.dailyLossLimitUsd}
                    onChange={(event) =>
                      state.updateAgentSetting(setting.agentId, {
                        dailyLossLimitUsd: Number(event.target.value) || 0,
                      })
                    }
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
                  />
                </LabeledField>
                <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/25 px-4 py-3 text-[13px] text-white/78">
                  <input
                    type="checkbox"
                    checked={setting.allowSell}
                    onChange={(event) =>
                      state.updateAgentSetting(setting.agentId, {
                        allowSell: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-white/20 bg-black/40"
                  />
                  Allow sell signals for this agent.
                </label>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="space-y-6">
        <SectionCard
          title="Room controls"
          subtitle="Global automation and safety switches."
        >
          <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-[13px] text-white/78">
            <input
              type="checkbox"
              checked={state.settings.autoStrategyEnabled}
              onChange={(event) =>
                state.setSettings((current) => ({
                  ...current,
                  autoStrategyEnabled: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-white/20 bg-black/40"
            />
            Enable the room-level auto strategy loop for agents that are set to
            auto mode.
          </label>
          <LabeledField label="Room default slippage (bps)">
            <input
              value={state.settings.defaultSlippageBps}
              onChange={(event) =>
                state.setSettings((current) => ({
                  ...current,
                  defaultSlippageBps: Number(event.target.value) || 0,
                }))
              }
              inputMode="numeric"
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
            />
          </LabeledField>
          <LabeledField label="Room max daily loss (USD)">
            <input
              value={state.settings.maxDailyLossUsd}
              onChange={(event) =>
                state.setSettings((current) => ({
                  ...current,
                  maxDailyLossUsd: Number(event.target.value) || 0,
                }))
              }
              inputMode="decimal"
              className="w-full rounded-2xl border border-white/12 bg-[#071019] px-4 py-3 text-[13px] text-white outline-none transition-colors focus:border-cyan-300/35"
            />
          </LabeledField>
        </SectionCard>

        <SectionCard
          title="Automation notes"
          subtitle="What auto mode is allowed to do."
        >
          <div className="space-y-3">
            <Banner tone="neutral">
              `Suggest only` writes an idea to the room ledger and stops.
            </Banner>
            <Banner tone="neutral">
              `Prepare + approval` creates a pending approval request that the
              user can load into the trade panel.
            </Banner>
            <Banner tone="success">
              `Auto strategy` runs the same signal generation on a timer, but it
              still cannot bypass Phantom signing.
            </Banner>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-black/22 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.22em] text-cyan-100/55">
            {title}
          </div>
          <div className="mt-2 text-[14px] text-white/68">{subtitle}</div>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-[#061018]/82 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/48">
        {label}
      </div>
      <div className="mt-2 text-[16px] text-white">{value}</div>
    </div>
  );
}

function PanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#061018]/72 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/48">
        {title}
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-cyan-100/48">
        {label}
      </div>
      {children}
    </label>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="text-[12px] text-white/60">{label}</div>
      <div className="text-[13px] text-white">{value}</div>
    </div>
  );
}

function Banner({
  children,
  tone,
  className = "",
}: {
  children: React.ReactNode;
  tone: "neutral" | "success" | "danger";
  className?: string;
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
      : tone === "success"
        ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
        : "border-white/10 bg-white/[0.04] text-white/74";
  return (
    <div
      className={`rounded-[18px] border px-4 py-3 text-[13px] leading-6 ${toneClass} ${className}`}
    >
      {children}
    </div>
  );
}

const formatSignedPct = (value: number | null) =>
  value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const shorten = (value: string) =>
  value.length <= 16 ? value : `${value.slice(0, 6)}...${value.slice(-6)}`;

const minutesRemaining = (expiresAt: number) => {
  const diffMs = Math.max(0, expiresAt - Date.now());
  const minutes = Math.ceil(diffMs / 60_000);
  return `${minutes}m`;
};
