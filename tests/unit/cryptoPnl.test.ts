import { describe, expect, it } from "vitest";
import { buildCryptoReportSnapshot } from "@/features/crypto/lib/pnl";
import type { CryptoTradeRecord } from "@/features/crypto/types";

const buyTrade = (overrides: Partial<CryptoTradeRecord> = {}): CryptoTradeRecord => ({
  id: "buy-1",
  source: "user",
  status: "confirmed",
  agentId: null,
  agentName: null,
  pairAddress: "pair",
  tokenMint: "mint",
  tokenSymbol: "MEME",
  side: "buy",
  walletPublicKey: "wallet",
  inputMint: "sol",
  outputMint: "mint",
  inputAmountUi: 1,
  outputAmountUi: 100,
  tokenDelta: 100,
  notionalUsd: 100,
  executionPriceUsd: 1,
  slippageBps: 150,
  quoteCreatedAt: 1,
  txSignature: "sig",
  error: null,
  rationale: null,
  createdAt: 1,
  submittedAt: 1,
  confirmedAt: 1,
  ...overrides,
});

describe("buildCryptoReportSnapshot", () => {
  it("tracks open inventory and unrealized pnl", () => {
    const report = buildCryptoReportSnapshot({
      trades: [buyTrade()],
      approvals: [],
      currentTokenPriceUsd: 1.5,
      trackedTokenSymbol: "MEME",
    });

    expect(report.openTokenQuantity).toBe(100);
    expect(report.averageEntryUsd).toBe(1);
    expect(report.unrealizedPnlUsd).toBeCloseTo(50);
    expect(report.realizedPnlUsd).toBeCloseTo(0);
  });

  it("realizes pnl on sells using weighted average cost", () => {
    const report = buildCryptoReportSnapshot({
      trades: [
        buyTrade(),
        buyTrade({
          id: "buy-2",
          inputAmountUi: 0.5,
          outputAmountUi: 50,
          tokenDelta: 50,
          notionalUsd: 75,
          executionPriceUsd: 1.5,
        }),
        buyTrade({
          id: "sell-1",
          source: "agent",
          agentId: "agent-1",
          agentName: "Agent One",
          side: "sell",
          inputMint: "mint",
          outputMint: "sol",
          inputAmountUi: 60,
          outputAmountUi: 0.9,
          tokenDelta: -60,
          notionalUsd: 108,
          executionPriceUsd: 1.8,
        }),
      ],
      approvals: [],
      currentTokenPriceUsd: 2,
      trackedTokenSymbol: "MEME",
    });

    expect(report.realizedPnlUsd).toBeCloseTo(38);
    expect(report.openTokenQuantity).toBe(90);
    expect(report.unrealizedPnlUsd).toBeCloseTo(75);
    expect(report.bySource[0]?.label).toBe("User");
    expect(report.bySource[1]?.label).toBe("Agent One");
  });
});
