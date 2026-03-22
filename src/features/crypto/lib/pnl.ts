import type {
  CryptoApprovalRequest,
  CryptoReportSnapshot,
  CryptoTradeRecord,
} from "@/features/crypto/types";

type SourceAggregate = {
  id: string;
  label: string;
  realizedPnlUsd: number;
  totalVolumeUsd: number;
  tradeCount: number;
};

export const buildCryptoReportSnapshot = (params: {
  trades: CryptoTradeRecord[];
  approvals: CryptoApprovalRequest[];
  currentTokenPriceUsd: number;
  trackedTokenSymbol: string;
}): CryptoReportSnapshot => {
  const confirmedTrades = params.trades.filter((trade) => trade.status === "confirmed");
  let inventoryQty = 0;
  let inventoryCostUsd = 0;
  let realizedPnlUsd = 0;
  let feesPaidUsd = 0;
  let wins = 0;
  let losses = 0;
  let biggestWinnerUsd = 0;
  let biggestLoserUsd = 0;
  const sourceMap = new Map<string, SourceAggregate>();

  const pushSourceAggregate = (trade: CryptoTradeRecord, realizedDeltaUsd: number) => {
    const id = trade.agentId ?? trade.source;
    const label = trade.agentName ?? (trade.source === "agent" ? "Agent" : "User");
    const current = sourceMap.get(id) ?? {
      id,
      label,
      realizedPnlUsd: 0,
      totalVolumeUsd: 0,
      tradeCount: 0,
    };
    current.realizedPnlUsd += realizedDeltaUsd;
    current.totalVolumeUsd += trade.notionalUsd;
    current.tradeCount += 1;
    sourceMap.set(id, current);
  };

  for (const trade of confirmedTrades) {
    const tokenQty = Math.abs(trade.tokenDelta);
    const tradeFeeUsd = trade.notionalUsd * 0.003;
    feesPaidUsd += tradeFeeUsd;
    if (trade.tokenDelta > 0) {
      inventoryQty += trade.tokenDelta;
      inventoryCostUsd += trade.notionalUsd;
      pushSourceAggregate(trade, 0);
      continue;
    }

    const quantitySold = Math.min(inventoryQty, tokenQty);
    const averageEntryUsd = inventoryQty > 0 ? inventoryCostUsd / inventoryQty : 0;
    const realizedDeltaUsd = quantitySold * trade.executionPriceUsd - quantitySold * averageEntryUsd;
    realizedPnlUsd += realizedDeltaUsd;
    inventoryQty = Math.max(0, inventoryQty - quantitySold);
    inventoryCostUsd = Math.max(0, inventoryCostUsd - quantitySold * averageEntryUsd);
    if (realizedDeltaUsd > 0) wins += 1;
    if (realizedDeltaUsd < 0) losses += 1;
    biggestWinnerUsd = Math.max(biggestWinnerUsd, realizedDeltaUsd);
    biggestLoserUsd = Math.min(biggestLoserUsd, realizedDeltaUsd);
    pushSourceAggregate(trade, realizedDeltaUsd);
  }

  const openTokenValueUsd = inventoryQty * params.currentTokenPriceUsd;
  const unrealizedPnlUsd = openTokenValueUsd - inventoryCostUsd;
  const resolvedTrades = wins + losses;

  return {
    trackedTokenSymbol: params.trackedTokenSymbol,
    tradeCount: params.trades.length,
    confirmedTradeCount: confirmedTrades.length,
    pendingApprovals: params.approvals.filter((approval) => approval.status === "pending").length,
    totalVolumeUsd: params.trades.reduce((sum, trade) => sum + trade.notionalUsd, 0),
    realizedPnlUsd,
    unrealizedPnlUsd,
    totalPnlUsd: realizedPnlUsd + unrealizedPnlUsd,
    winRatePct: resolvedTrades > 0 ? (wins / resolvedTrades) * 100 : 0,
    feesPaidUsd,
    openTokenQuantity: inventoryQty,
    averageEntryUsd: inventoryQty > 0 ? inventoryCostUsd / inventoryQty : 0,
    biggestWinnerUsd,
    biggestLoserUsd,
    bySource: [...sourceMap.values()].sort((left, right) => right.totalVolumeUsd - left.totalVolumeUsd),
  };
};
