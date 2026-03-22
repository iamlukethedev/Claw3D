import type {
  CryptoApprovalRequest,
  CryptoRoomSettings,
  CryptoTradeRecord,
} from "@/features/crypto/types";
import { CRYPTO_ROOM_PAIR_ADDRESS, CRYPTO_ROOM_STORAGE_KEY } from "@/features/crypto/lib/constants";
import type { OfficeAgent } from "@/features/retro-office/core/types";

type CryptoRoomPersistedState = {
  version: 1;
  settings: CryptoRoomSettings;
  ledger: CryptoTradeRecord[];
  approvals: CryptoApprovalRequest[];
};

const buildDefaultSettings = (agents: OfficeAgent[]): CryptoRoomSettings => ({
  pairAddress: CRYPTO_ROOM_PAIR_ADDRESS,
  defaultSlippageBps: 150,
  maxDailyLossUsd: 250,
  autoStrategyEnabled: false,
  reportCurrency: "USD",
  agentSettings: agents.map((agent, index) => ({
    agentId: agent.id,
    agentName: agent.name,
    mode: index === 0 ? "prepare_for_approval" : "suggest_only",
    maxTradeSol: 0.2,
    slippageBps: 150,
    cooldownMinutes: 30,
    dailyLossLimitUsd: 50,
    allowSell: true,
    lastSignalAt: null,
    lastSignalSummary: null,
  })),
});

export const buildInitialCryptoRoomState = (agents: OfficeAgent[]): CryptoRoomPersistedState => ({
  version: 1,
  settings: buildDefaultSettings(agents),
  ledger: [],
  approvals: [],
});

const mergeSettings = (
  current: CryptoRoomSettings,
  agents: OfficeAgent[],
): CryptoRoomSettings => {
  const byAgentId = new Map(current.agentSettings.map((entry) => [entry.agentId, entry]));
  return {
    ...current,
    pairAddress: current.pairAddress || CRYPTO_ROOM_PAIR_ADDRESS,
    reportCurrency: "USD",
    agentSettings: agents.map((agent, index) => {
      const existing = byAgentId.get(agent.id);
      if (existing) {
        return {
          ...existing,
          agentName: agent.name,
        };
      }
      return {
        agentId: agent.id,
        agentName: agent.name,
        mode: index === 0 ? "prepare_for_approval" : "suggest_only",
        maxTradeSol: 0.2,
        slippageBps: current.defaultSlippageBps || 150,
        cooldownMinutes: 30,
        dailyLossLimitUsd: 50,
        allowSell: true,
        lastSignalAt: null,
        lastSignalSummary: null,
      };
    }),
  };
};

export const loadCryptoRoomState = (agents: OfficeAgent[]): CryptoRoomPersistedState => {
  if (typeof window === "undefined") {
    return buildInitialCryptoRoomState(agents);
  }
  try {
    const raw = window.localStorage.getItem(CRYPTO_ROOM_STORAGE_KEY);
    if (!raw) return buildInitialCryptoRoomState(agents);
    const parsed = JSON.parse(raw) as Partial<CryptoRoomPersistedState> | null;
    if (!parsed || typeof parsed !== "object") {
      return buildInitialCryptoRoomState(agents);
    }
    const fallback = buildInitialCryptoRoomState(agents);
    return {
      version: 1,
      settings: mergeSettings(
        parsed.settings && typeof parsed.settings === "object"
          ? { ...fallback.settings, ...parsed.settings }
          : fallback.settings,
        agents,
      ),
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
      approvals: Array.isArray(parsed.approvals) ? parsed.approvals : [],
    };
  } catch {
    return buildInitialCryptoRoomState(agents);
  }
};

export const saveCryptoRoomState = (state: CryptoRoomPersistedState) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CRYPTO_ROOM_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
};
