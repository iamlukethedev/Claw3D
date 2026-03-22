export type CryptoTradeIntentSource = "user" | "agent";

export type CryptoAgentTradeMode =
  | "suggest_only"
  | "prepare_for_approval"
  | "auto_strategy";

export type CryptoTradeSide = "buy" | "sell";

export type CryptoTradeStatus =
  | "draft"
  | "approval_pending"
  | "ready_to_sign"
  | "submitted"
  | "confirmed"
  | "rejected"
  | "failed";

export type CryptoTrackedPair = {
  pairAddress: string;
  dexId: string | null;
  url: string;
  priceUsd: number;
  priceNative: number | null;
  fdv: number | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  buys24h: number | null;
  sells24h: number | null;
  pairLabel: string;
  chainId: string;
  quoteToken: {
    address: string;
    symbol: string;
    name: string;
  };
  baseToken: {
    address: string;
    symbol: string;
    name: string;
  };
  priceChangePct: {
    m5: number | null;
    h1: number | null;
    h6: number | null;
    h24: number | null;
  };
  imageUrl: string | null;
  loadedAt: number;
};

export type CryptoQuotePreview = {
  inputMint: string;
  outputMint: string;
  inAmountRaw: string;
  outAmountRaw: string;
  inputAmountUi: number;
  outputAmountUi: number;
  priceImpactPct: number;
  slippageBps: number;
  routeLabel: string;
  raw: unknown;
  createdAt: number;
};

export type CryptoTokenHolding = {
  mint: string;
  symbol: string;
  name: string;
  imageUrl: string;
  balance: number;
  decimals: number;
  uiAmountString: string;
};

export type CryptoWalletSnapshot = {
  publicKey: string | null;
  connected: boolean;
  solBalance: number;
  tokenHoldings: CryptoTokenHolding[];
  trackedTokenBalance: number;
  trackedTokenDecimals: number;
  lastUpdatedAt: number | null;
};

export type CryptoTradeRecord = {
  id: string;
  source: CryptoTradeIntentSource;
  status: CryptoTradeStatus;
  agentId: string | null;
  agentName: string | null;
  pairAddress: string;
  tokenMint: string;
  tokenSymbol: string;
  side: CryptoTradeSide;
  walletPublicKey: string | null;
  inputMint: string;
  outputMint: string;
  inputAmountUi: number;
  outputAmountUi: number;
  tokenDelta: number;
  notionalUsd: number;
  executionPriceUsd: number;
  slippageBps: number;
  quoteCreatedAt: number;
  txSignature: string | null;
  error: string | null;
  rationale: string | null;
  createdAt: number;
  submittedAt: number | null;
  confirmedAt: number | null;
};

export type CryptoApprovalRequest = {
  id: string;
  agentId: string;
  agentName: string;
  pairAddress: string;
  side: CryptoTradeSide;
  maxTradeSol: number;
  slippageBps: number;
  rationale: string;
  proposedInputAmountUi: number;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "approved" | "rejected" | "expired";
};

export type CryptoAgentSetting = {
  agentId: string;
  agentName: string;
  mode: CryptoAgentTradeMode;
  maxTradeSol: number;
  slippageBps: number;
  cooldownMinutes: number;
  dailyLossLimitUsd: number;
  allowSell: boolean;
  lastSignalAt: number | null;
  lastSignalSummary: string | null;
};

export type CryptoRoomSettings = {
  pairAddress: string;
  defaultSlippageBps: number;
  maxDailyLossUsd: number;
  autoStrategyEnabled: boolean;
  reportCurrency: "USD";
  agentSettings: CryptoAgentSetting[];
};

export type CryptoReportSnapshot = {
  trackedTokenSymbol: string;
  tradeCount: number;
  confirmedTradeCount: number;
  pendingApprovals: number;
  totalVolumeUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  totalPnlUsd: number;
  winRatePct: number;
  feesPaidUsd: number;
  openTokenQuantity: number;
  averageEntryUsd: number;
  biggestWinnerUsd: number;
  biggestLoserUsd: number;
  bySource: Array<{
    id: string;
    label: string;
    realizedPnlUsd: number;
    totalVolumeUsd: number;
    tradeCount: number;
  }>;
};
