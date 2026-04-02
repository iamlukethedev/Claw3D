import {
  executeServerSideLaunch,
  executeWalletApprovedLaunch,
} from "@/features/crypto/lib/launchClient";
import {
  buildInitialCryptoLaunchState,
  loadCryptoLaunchState,
  saveCryptoLaunchState,
} from "@/features/crypto/lib/launchStorage";
import {
  getLaunchFieldLabel,
  getMissingRequiredLaunchField,
  isSkipAnswer,
  normalizeLaunchDraft,
  parseExecutionModeAnswer,
  parseNetworkAnswer,
} from "@/features/crypto/lib/launchSchema";
import type { AgentState } from "@/features/agents/state/store";
import type {
  CryptoLaunchDraft,
  CryptoLaunchDraftState,
  CryptoLaunchQuestionId,
} from "@/features/crypto/types";

type ChatInteractionDispatchAction =
  | { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }
  | { type: "appendOutput"; agentId: string; line: string };

const QUESTION_ORDER: readonly CryptoLaunchQuestionId[] = [
  "network",
  "executionMode",
  "name",
  "symbol",
  "description",
  "logoUrl",
  "website",
  "twitter",
  "telegram",
  "discord",
  "confirm",
] as const;

const START_RE =
  /\b(create|launch|make)\b[\s\S]*\b(token|coin|memecoin|meme coin)\b/i;

const isAffirmative = (value: string) => /^(yes|y|launch|create it|ship it|do it|confirm)$/i.test(value.trim());
const isNegative = (value: string) => /^(no|n|cancel|stop|abort|not now)$/i.test(value.trim());
const wantsOpenRoom = (value: string) =>
  /(open|show).*(crypto room|launch tab)|crypto room|manual/i.test(value.trim());

function getNextQuestion(current: CryptoLaunchQuestionId | null): CryptoLaunchQuestionId {
  if (!current) return QUESTION_ORDER[0];
  const index = QUESTION_ORDER.indexOf(current);
  return QUESTION_ORDER[Math.min(index + 1, QUESTION_ORDER.length - 1)]!;
}

function buildQuestion(field: CryptoLaunchQuestionId): string {
  switch (field) {
    case "network":
      return "Which network should I use: `devnet` or `mainnet`?";
    case "executionMode":
      return "Should I use `user-approved wallet` mode or `server-side` mode?";
    case "name":
      return "What is the token name?";
    case "symbol":
      return "What is the token symbol? Keep it under 10 characters.";
    case "description":
      return "What description should I publish for the token?";
    case "logoUrl":
      return "What is the logo URL? If you want to upload an image manually instead, say `open crypto room`.";
    case "website":
      return "What website should I attach? Reply with a URL or `skip`.";
    case "twitter":
      return "What Twitter/X link or handle should I attach? Reply with a value or `skip`.";
    case "telegram":
      return "What Telegram link or handle should I attach? Reply with a value or `skip`.";
    case "discord":
      return "What Discord invite or handle should I attach? Reply with a value or `skip`.";
    case "confirm":
      return "Everything is collected. Reply `launch` to create the token now, or say `open crypto room` if you want to review it manually first.";
  }
}

function buildSummary(draft: CryptoLaunchDraft): string {
  return [
    "Token draft ready:",
    `- Network: ${draft.network}`,
    `- Mode: ${draft.executionMode === "server_side" ? "server-side" : "user-approved wallet"}`,
    `- Name: ${draft.name}`,
    `- Symbol: ${draft.symbol}`,
    `- Description: ${draft.description}`,
    `- Logo: ${draft.logoUrl}`,
    `- Website: ${draft.website || "skip"}`,
    `- Twitter/X: ${draft.twitter || "skip"}`,
    `- Telegram: ${draft.telegram || "skip"}`,
    `- Discord: ${draft.discord || "skip"}`,
  ].join("\n");
}

function persistState(state: CryptoLaunchDraftState) {
  saveCryptoLaunchState(state);
}

function appendAssistant(dispatch: (action: ChatInteractionDispatchAction) => void, agentId: string, line: string) {
  dispatch({ type: "appendOutput", agentId, line });
}

function updateDraftForAnswer(
  field: CryptoLaunchQuestionId,
  answer: string,
  draft: CryptoLaunchDraft,
): { draft: CryptoLaunchDraft; error: string | null } {
  const trimmed = answer.trim();
  switch (field) {
    case "network": {
      const network = parseNetworkAnswer(trimmed);
      if (!network) {
        return { draft, error: "Please reply with `devnet` or `mainnet`." };
      }
      return { draft: { ...draft, network }, error: null };
    }
    case "executionMode": {
      const executionMode = parseExecutionModeAnswer(trimmed);
      if (!executionMode) {
        return {
          draft,
          error: "Please reply with `user-approved wallet` or `server-side`.",
        };
      }
      return { draft: { ...draft, executionMode }, error: null };
    }
    case "name":
      return trimmed ? { draft: { ...draft, name: trimmed }, error: null } : { draft, error: "The token name cannot be empty." };
    case "symbol":
      return trimmed
        ? { draft: { ...draft, symbol: trimmed.toUpperCase() }, error: null }
        : { draft, error: "The token symbol cannot be empty." };
    case "description":
      return trimmed
        ? { draft: { ...draft, description: trimmed }, error: null }
        : { draft, error: "The token description cannot be empty." };
    case "logoUrl":
      if (!trimmed) {
        return { draft, error: "A logo URL is required for the chat launch flow." };
      }
      return { draft: { ...draft, logoUrl: trimmed }, error: null };
    case "website":
      return { draft: { ...draft, website: isSkipAnswer(trimmed) ? "" : trimmed }, error: null };
    case "twitter":
      return { draft: { ...draft, twitter: isSkipAnswer(trimmed) ? "" : trimmed }, error: null };
    case "telegram":
      return { draft: { ...draft, telegram: isSkipAnswer(trimmed) ? "" : trimmed }, error: null };
    case "discord":
      return { draft: { ...draft, discord: isSkipAnswer(trimmed) ? "" : trimmed }, error: null };
    case "confirm":
      return { draft, error: null };
  }
}

async function launchFromDraft(params: {
  state: CryptoLaunchDraftState;
}) {
  const draft = normalizeLaunchDraft(params.state.draft);
  const outcome =
    draft.executionMode === "server_side"
      ? await executeServerSideLaunch(draft)
      : await executeWalletApprovedLaunch(draft);
  const nextState: CryptoLaunchDraftState = {
    ...params.state,
    draft: {
      ...draft,
      creatorWallet:
        draft.executionMode === "user_approved" ? outcome.result.creatorPublicKey : draft.creatorWallet,
    },
    conversation: {
      active: false,
      agentId: null,
      awaitingField: null,
      lastUpdatedAt: Date.now(),
    },
    lastPrepared: outcome.prepared,
    lastResult: outcome.result,
  };
  persistState(nextState);
  return outcome.result;
}

export async function maybeHandleCryptoLaunchChat(params: {
  agentId: string;
  message: string;
  dispatch: (action: ChatInteractionDispatchAction) => void;
}): Promise<boolean> {
  const trimmed = params.message.trim();
  if (!trimmed) return false;

  const existing = loadCryptoLaunchState();
  const activeForAgent =
    existing.conversation.active && existing.conversation.agentId === params.agentId;
  const shouldStart = START_RE.test(trimmed);

  if (!activeForAgent && !shouldStart) {
    return false;
  }

  appendAssistant(params.dispatch, params.agentId, `> ${trimmed}`);

  if (shouldStart && !activeForAgent) {
    const nextState: CryptoLaunchDraftState = {
      ...buildInitialCryptoLaunchState(),
      conversation: {
        active: true,
        agentId: params.agentId,
        awaitingField: QUESTION_ORDER[0],
        lastUpdatedAt: Date.now(),
      },
      lastPrepared: existing.lastPrepared,
      lastResult: existing.lastResult,
    };
    persistState(nextState);
    appendAssistant(
      params.dispatch,
      params.agentId,
      `I can handle that. ${buildQuestion(QUESTION_ORDER[0])}`,
    );
    return true;
  }

  if (!activeForAgent) {
    appendAssistant(
      params.dispatch,
      params.agentId,
      "Another agent already owns the active token launch draft. Open the crypto room to review it or cancel that flow first.",
    );
    return true;
  }

  if (isNegative(trimmed)) {
    const nextState: CryptoLaunchDraftState = {
      ...existing,
      conversation: {
        active: false,
        agentId: null,
        awaitingField: null,
        lastUpdatedAt: Date.now(),
      },
    };
    persistState(nextState);
    appendAssistant(
      params.dispatch,
      params.agentId,
      "Token launch cancelled. The draft stays available in the crypto room if you want to resume manually.",
    );
    return true;
  }

  const awaitingField = existing.conversation.awaitingField ?? QUESTION_ORDER[0];
  if (awaitingField === "confirm") {
    if (existing.draft.executionMode === "server_side") {
      persistState({
        ...existing,
        conversation: {
          ...existing.conversation,
          active: false,
          agentId: null,
          awaitingField: null,
          lastUpdatedAt: Date.now(),
        },
      });
      appendAssistant(
        params.dispatch,
        params.agentId,
        "Server-side launches now require an authenticated operator session from the crypto room Launch tab. I saved the draft there for manual review and submission.",
      );
      return true;
    }
    if (wantsOpenRoom(trimmed)) {
      persistState({
        ...existing,
        conversation: {
          ...existing.conversation,
          active: false,
          agentId: null,
          awaitingField: null,
          lastUpdatedAt: Date.now(),
        },
      });
      appendAssistant(
        params.dispatch,
        params.agentId,
        "The launch draft is ready in the crypto room Launch tab. Review it there and launch whenever you want.",
      );
      return true;
    }
    if (!isAffirmative(trimmed)) {
      appendAssistant(
        params.dispatch,
        params.agentId,
        "Reply `launch` to create the token now, or say `open crypto room` to finish it manually.",
      );
      return true;
    }
    try {
      const result = await launchFromDraft({ state: existing });
      appendAssistant(
        params.dispatch,
        params.agentId,
        [
          `Token created on ${result.network}.`,
          `Mint: ${result.mintAddress}`,
          `Creator: ${result.creatorPublicKey}`,
          `Transaction: ${result.explorerTxUrl}`,
        ].join("\n"),
      );
    } catch (error) {
      appendAssistant(
        params.dispatch,
        params.agentId,
        error instanceof Error
          ? `Launch failed: ${error.message}`
          : "Launch failed. Try again or open the crypto room to review the draft.",
      );
    }
    return true;
  }

  if (awaitingField === "logoUrl" && wantsOpenRoom(trimmed)) {
    appendAssistant(
      params.dispatch,
      params.agentId,
      "The draft is waiting in the crypto room Launch tab. Upload the logo there, then finish the launch manually or come back here and say `launch`.",
    );
    return true;
  }

  const nextDraft = updateDraftForAnswer(awaitingField, trimmed, normalizeLaunchDraft(existing.draft));
  if (nextDraft.error) {
    appendAssistant(params.dispatch, params.agentId, nextDraft.error);
    return true;
  }

  const candidateNextField = getNextQuestion(awaitingField);
  const nextState: CryptoLaunchDraftState = {
    ...existing,
    draft: nextDraft.draft,
    conversation: {
      active: true,
      agentId: params.agentId,
      awaitingField: candidateNextField,
      lastUpdatedAt: Date.now(),
    },
  };

  if (candidateNextField === "confirm") {
    const missingField = getMissingRequiredLaunchField(nextState.draft);
    if (missingField) {
      nextState.conversation.awaitingField = missingField;
      persistState(nextState);
      appendAssistant(
        params.dispatch,
        params.agentId,
        `I still need the ${getLaunchFieldLabel(missingField)}. ${buildQuestion(missingField)}`,
      );
      return true;
    }
    persistState(nextState);
    appendAssistant(params.dispatch, params.agentId, buildSummary(nextState.draft));
    appendAssistant(params.dispatch, params.agentId, buildQuestion("confirm"));
    return true;
  }

  persistState(nextState);
  appendAssistant(params.dispatch, params.agentId, buildQuestion(candidateNextField));
  return true;
}
