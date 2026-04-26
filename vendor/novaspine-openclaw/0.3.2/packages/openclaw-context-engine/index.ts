import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/memory-core";

type NovaSpineContextConfig = {
  baseUrl: string;
  apiToken?: string;
  autoRecall: boolean;
  sessionIngestOnBootstrap: boolean;
  sessionIngestOnAfterTurn: boolean;
  recallTopK: number;
  recallMinScore: number;
  recallFormat: "xml" | "plain";
  recentMessages: number;
  reserveTokens: number;
  defaultTokenBudget: number;
  timeoutMs: number;
  mode: "balanced" | "memory-heavy" | "session-heavy";
  includeWorkspaceMemory: boolean;
  recentMemoryFiles: number;
};

type RecallMemory = {
  content: string;
  role: string;
  session_id: string;
  score: number;
  source_id?: string;
};

type RecallResponse = {
  memories: RecallMemory[];
  count: number;
};

type SessionIngestResponse = {
  session_id: string;
  chunks_ingested: number;
};

type HealthResponse = {
  status?: string;
  service?: string;
};

type StatusResponse = Record<string, unknown>;

type PersistedState = {
  sessionFingerprints: Record<string, string>;
};

const CONTEXT_ENGINE_GUIDANCE = [
  "NovaSpine context-engine mode is available.",
  "Treat the injected <nova-context-engine> envelope as a compacted working set, not as ground truth.",
  "Prefer the envelope for continuity and compaction, and prefer explicit NovaSpine tools when the user directly asks what was remembered.",
  "Do not repeat the entire envelope back to the user unless they ask for the assembled context.",
].join("\n");

const configSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    baseUrl: { type: "string" },
    apiToken: { type: "string" },
    autoRecall: { type: "boolean" },
    sessionIngestOnBootstrap: { type: "boolean" },
    sessionIngestOnAfterTurn: { type: "boolean" },
    recallTopK: { type: "number", minimum: 1, maximum: 20 },
    recallMinScore: { type: "number", minimum: 0, maximum: 1 },
    recallFormat: { type: "string", enum: ["xml", "plain"] },
    recentMessages: { type: "number", minimum: 1, maximum: 20 },
    reserveTokens: { type: "number", minimum: 256, maximum: 32000 },
    defaultTokenBudget: { type: "number", minimum: 1024, maximum: 200000 },
    timeoutMs: { type: "number", minimum: 1000, maximum: 60000 },
    mode: { type: "string", enum: ["balanced", "memory-heavy", "session-heavy"] },
    includeWorkspaceMemory: { type: "boolean" },
    recentMemoryFiles: { type: "number", minimum: 1, maximum: 10 },
  },
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeConfig(pluginConfig: unknown): NovaSpineContextConfig {
  const raw = asRecord(pluginConfig);
  return {
    baseUrl: readString(raw.baseUrl, "http://127.0.0.1:8420").replace(/\/+$/, ""),
    apiToken: readOptionalString(raw.apiToken),
    autoRecall: readBoolean(raw.autoRecall, true),
    sessionIngestOnBootstrap: readBoolean(raw.sessionIngestOnBootstrap, true),
    sessionIngestOnAfterTurn: readBoolean(raw.sessionIngestOnAfterTurn, true),
    recallTopK: Math.max(1, Math.min(20, Math.floor(readNumber(raw.recallTopK, 5)))),
    recallMinScore: Math.max(0, Math.min(1, readNumber(raw.recallMinScore, 0.005))),
    recallFormat: raw.recallFormat === "plain" ? "plain" : "xml",
    recentMessages: Math.max(1, Math.min(20, Math.floor(readNumber(raw.recentMessages, 6)))),
    reserveTokens: Math.max(256, Math.min(32000, Math.floor(readNumber(raw.reserveTokens, 2048)))),
    defaultTokenBudget: Math.max(1024, Math.min(200000, Math.floor(readNumber(raw.defaultTokenBudget, 24000)))),
    timeoutMs: Math.max(1000, Math.min(60000, Math.floor(readNumber(raw.timeoutMs, 12000)))),
    mode: raw.mode === "memory-heavy" || raw.mode === "session-heavy" ? raw.mode : "balanced",
    includeWorkspaceMemory: readBoolean(raw.includeWorkspaceMemory, true),
    recentMemoryFiles: Math.max(1, Math.min(10, Math.floor(readNumber(raw.recentMemoryFiles, 2)))),
  };
}

function buildHeaders(cfg: NovaSpineContextConfig): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cfg.apiToken) headers.authorization = `Bearer ${cfg.apiToken}`;
  return headers;
}

async function requestJson<T>(
  cfg: NovaSpineContextConfig,
  route: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${cfg.baseUrl}${route}`, {
    method: init.method ?? "GET",
    headers: buildHeaders(cfg),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail ? `${response.status} ${response.statusText}: ${detail}` : `${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function extractMessageText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const record = message as Record<string, unknown>;
  const content = record.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const block = item as Record<string, unknown>;
    if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
      parts.push(block.text.trim());
    }
  }
  return parts.join("\n").trim();
}

function normalizeWhitespace(value: string): string {
  return String(value || "")
    .replace(/<nova-context-engine[\s\S]*?<\/nova-context-engine>/gi, " ")
    .replace(/<relevant-memories>[\s\S]*?<\/relevant-memories>/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function approximateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function compactText(value: string, limit: number): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1) return `${normalized.slice(0, Math.max(0, limit - 1))}…`;
  let result = "";
  for (const sentence of sentences) {
    const candidate = result ? `${result} ${sentence}` : sentence;
    if (candidate.length > limit) continue;
    result = candidate;
    if (result.length >= limit * 0.82) break;
  }
  return result || `${normalized.slice(0, Math.max(0, limit - 1))}…`;
}

function escapeXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function latestUserObjective(messages: unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") continue;
    const record = message as Record<string, unknown>;
    if (record.role !== "user") continue;
    const text = extractMessageText(record);
    if (text) return text;
  }
  return extractMessageText(messages[messages.length - 1]);
}

function recentSessionMessages(messages: unknown[], windowSize: number): { role: string; text: string }[] {
  return messages
    .slice(-windowSize)
    .map((message) => {
      const record = asRecord(message);
      return {
        role: readString(record.role, "unknown"),
        text: compactText(extractMessageText(record), 280),
      };
    })
    .filter((message) => message.text);
}

function trimMessagesToBudget(messages: unknown[], tokenBudget: number): unknown[] {
  if (!messages.length) return [];
  const selected: unknown[] = [];
  let used = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const cost = Math.max(8, approximateTokens(extractMessageText(message)));
    if (selected.length > 0 && used + cost > tokenBudget) break;
    selected.push(message);
    used += cost;
  }
  return selected.length > 0 ? selected.reverse() : [messages[messages.length - 1]];
}

function deriveBudgets(cfg: NovaSpineContextConfig, tokenBudget: number) {
  const totalChars = Math.max(1600, Math.floor(tokenBudget * 4));
  const objective = Math.min(640, Math.max(240, Math.floor(totalChars * 0.14)));
  const memoryRatio = cfg.mode === "memory-heavy" ? 0.48 : cfg.mode === "session-heavy" ? 0.24 : 0.36;
  const sessionRatio = cfg.mode === "session-heavy" ? 0.42 : cfg.mode === "memory-heavy" ? 0.24 : 0.30;
  const workspaceRatio = cfg.includeWorkspaceMemory ? 0.14 : 0;
  return {
    totalChars,
    objective,
    memory: Math.max(520, Math.floor(totalChars * memoryRatio)),
    session: Math.max(360, Math.floor(totalChars * sessionRatio)),
    workspace: cfg.includeWorkspaceMemory ? Math.max(220, Math.floor(totalChars * workspaceRatio)) : 0,
  };
}

function workspaceMemoryDir(api: OpenClawPluginApi): string {
  return api.resolvePath("~/.openclaw/workspace/memory");
}

async function loadWorkspaceMemoryHighlights(
  api: OpenClawPluginApi,
  recentFiles: number,
  budgetChars: number,
): Promise<Array<{ file: string; text: string }>> {
  const dir = workspaceMemoryDir(api);
  try {
    const files = (await readdir(dir))
      .filter((name) => name.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, recentFiles);
    const perFileLimit = Math.max(180, Math.floor(budgetChars / Math.max(1, files.length)));
    const items: Array<{ file: string; text: string }> = [];
    for (const file of files) {
      const raw = await readFile(`${dir}/${file}`, "utf-8");
      const compacted = compactText(raw, perFileLimit);
      if (compacted) items.push({ file, text: compacted });
    }
    return items;
  } catch {
    return [];
  }
}

function filterMemoryHits(memories: RecallMemory[], minScore: number): RecallMemory[] {
  return memories
    .filter((memory) => Number(memory.score) >= minScore)
    .map((memory) => ({
      ...memory,
      content: compactText(memory.content, 360),
    }))
    .filter((memory) => memory.content);
}

function buildEnvelope(
  cfg: NovaSpineContextConfig,
  objective: string,
  memories: RecallMemory[],
  sessionMessages: Array<{ role: string; text: string }>,
  workspaceItems: Array<{ file: string; text: string }>,
  tokenBudget: number,
): string {
  const budgets = deriveBudgets(cfg, tokenBudget);
  const sections: string[] = [`<query>${escapeXml(compactText(objective, budgets.objective))}</query>`];
  if (memories.length) {
    const perItem = Math.max(180, Math.floor(budgets.memory / memories.length));
    sections.push(
      `<long-term-memory count="${memories.length}">\n${memories
        .map((memory, index) => {
          const score = Number.isFinite(Number(memory.score)) ? Number(memory.score).toFixed(3) : "n/a";
          return `  <memory index="${index + 1}" role="${escapeXml(memory.role)}" score="${escapeXml(score)}">${escapeXml(compactText(memory.content, perItem))}</memory>`;
        })
        .join("\n")}\n</long-term-memory>`,
    );
  }
  if (sessionMessages.length) {
    const perTurn = Math.max(140, Math.floor(budgets.session / sessionMessages.length));
    sections.push(
      `<recent-session count="${sessionMessages.length}">\n${sessionMessages
        .map((message, index) => {
          return `  <turn index="${index + 1}" role="${escapeXml(message.role)}">${escapeXml(compactText(message.text, perTurn))}</turn>`;
        })
        .join("\n")}\n</recent-session>`,
    );
  }
  if (workspaceItems.length && budgets.workspace > 0) {
    const perItem = Math.max(140, Math.floor(budgets.workspace / workspaceItems.length));
    sections.push(
      `<workspace-memory count="${workspaceItems.length}">\n${workspaceItems
        .map((item, index) => {
          return `  <memory-file index="${index + 1}" file="${escapeXml(item.file)}">${escapeXml(compactText(item.text, perItem))}</memory-file>`;
        })
        .join("\n")}\n</workspace-memory>`,
    );
  }
  return [
    `<nova-context-engine mode="${escapeXml(cfg.mode)}" budget_tokens="${tokenBudget}" source="novaspine-context">`,
    sections.join("\n"),
    "</nova-context-engine>",
  ].join("\n");
}

async function loadState(path: string): Promise<PersistedState> {
  try {
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw) as Partial<PersistedState>;
    return { sessionFingerprints: data.sessionFingerprints ?? {} };
  } catch {
    return { sessionFingerprints: {} };
  }
}

async function persistState(path: string, state: PersistedState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), "utf-8");
}

async function computeFileFingerprint(path: string): Promise<string | undefined> {
  try {
    const info = await stat(path);
    return info.isFile() ? `${Math.floor(info.mtimeMs)}:${info.size}` : undefined;
  } catch {
    return undefined;
  }
}

function createNovaSpineContextEngine(
  api: OpenClawPluginApi,
  cfg: NovaSpineContextConfig,
  statePath: string,
) {
  let stateLoaded = false;
  let state: PersistedState = { sessionFingerprints: {} };

  async function ensureStateLoaded() {
    if (stateLoaded) return;
    state = await loadState(statePath);
    stateLoaded = true;
  }

  async function ingestSessionFileIfChanged(params: { sessionId: string; sessionKey?: string; sessionFile: string }) {
    await ensureStateLoaded();
    const fingerprint = await computeFileFingerprint(params.sessionFile);
    if (!fingerprint) return { updated: false, importedMessages: 0, reason: "missing_session_file" };
    const key = params.sessionKey || params.sessionId || params.sessionFile;
    if (state.sessionFingerprints[key] === fingerprint) {
      return { updated: false, importedMessages: 0, reason: "unchanged" };
    }
    const response = await requestJson<SessionIngestResponse>(cfg, "/api/v1/sessions/ingest", {
      method: "POST",
      body: { path: params.sessionFile },
    });
    state.sessionFingerprints[key] = fingerprint;
    await persistState(statePath, state);
    api.logger.info(`novaspine-context: ingested ${params.sessionFile} (${response.chunks_ingested} chunks)`);
    return { updated: true, importedMessages: response.chunks_ingested };
  }

  return {
    info: {
      id: "novaspine-context",
      name: "NovaSpine Context Engine",
      version: "0.2.0",
      ownsCompaction: false,
    },

    async bootstrap(params: { sessionId: string; sessionKey?: string; sessionFile: string }) {
      if (!cfg.sessionIngestOnBootstrap) {
        return { bootstrapped: false, reason: "session_ingest_on_bootstrap_disabled" };
      }
      const result = await ingestSessionFileIfChanged(params);
      return result.updated
        ? { bootstrapped: true, importedMessages: result.importedMessages }
        : { bootstrapped: false, reason: result.reason };
    },

    async ingest() {
      return { ingested: false };
    },

    async ingestBatch() {
      return { ingestedCount: 0 };
    },

    async afterTurn(params: { sessionId: string; sessionKey?: string; sessionFile: string }) {
      if (!cfg.sessionIngestOnAfterTurn) return;
      try {
        await ingestSessionFileIfChanged(params);
      } catch (error) {
        api.logger.warn(`novaspine-context: afterTurn ingest failed: ${String(error)}`);
      }
    },

    async assemble(params: { sessionId: string; sessionKey?: string; messages: unknown[]; tokenBudget?: number }) {
      const budget =
        typeof params.tokenBudget === "number" && Number.isFinite(params.tokenBudget) && params.tokenBudget > 0
          ? Math.floor(params.tokenBudget)
          : cfg.defaultTokenBudget;
      const objective = latestUserObjective(params.messages);
      const sessionMessages = recentSessionMessages(params.messages, cfg.recentMessages);
      const workspaceItems = cfg.includeWorkspaceMemory
        ? await loadWorkspaceMemoryHighlights(api, cfg.recentMemoryFiles, Math.floor(budget * 4 * 0.14))
        : [];
      let memories: RecallMemory[] = [];
      if (cfg.autoRecall && objective) {
        try {
          const response = await requestJson<RecallResponse>(cfg, "/api/v1/memory/recall", {
            method: "POST",
            body: { query: objective, top_k: cfg.recallTopK },
          });
          memories = filterMemoryHits(response.memories || [], cfg.recallMinScore);
        } catch (error) {
          api.logger.warn(`novaspine-context: recall failed: ${String(error)}`);
        }
      }
      const envelope = buildEnvelope(cfg, objective, memories, sessionMessages, workspaceItems, budget);
      const envelopeTokens = envelope ? approximateTokens(envelope) : 0;
      const messageBudget = Math.max(256, budget - cfg.reserveTokens - envelopeTokens);
      const trimmedMessages = trimMessagesToBudget(params.messages, messageBudget);
      return {
        messages: trimmedMessages,
        estimatedTokens: approximateTokens(envelope) + trimmedMessages.reduce<number>((sum, msg) => sum + approximateTokens(extractMessageText(msg)), 0),
        systemPromptAddition: envelope
          ? `${CONTEXT_ENGINE_GUIDANCE}\n\n${envelope}`
          : CONTEXT_ENGINE_GUIDANCE,
      };
    },

    async compact(params: { currentTokenCount?: number; tokenBudget?: number; force?: boolean }) {
      const tokensBefore =
        typeof params.currentTokenCount === "number" && Number.isFinite(params.currentTokenCount)
          ? Math.floor(params.currentTokenCount)
          : 0;
      if (!params.force && params.tokenBudget && tokensBefore > 0 && tokensBefore <= params.tokenBudget) {
        return { ok: true, compacted: false, reason: "within_budget", result: { tokensBefore } };
      }
      return {
        ok: true,
        compacted: false,
        reason: "novaspine_context_assembles_live_context",
        result: { tokensBefore },
      };
    },

    async dispose() {
      if (stateLoaded) await persistState(statePath, state);
    },
  };
}

const novaspineContextPlugin = {
  id: "novaspine-context",
  name: "NovaSpine Context Engine",
  description: "NovaSpine context engine for OpenClaw",
  kind: "context-engine" as const,
  configSchema,

  register(api: OpenClawPluginApi) {
    const cfg = normalizeConfig(api.pluginConfig);
    const statePath = api.resolvePath("~/.openclaw/plugin-state/novaspine-context-fingerprints.json");

    api.registerService({
      id: "novaspine-context",
      async start() {
        try {
          const health = await requestJson<HealthResponse>(cfg, "/api/v1/health");
          api.logger.info(
            `novaspine-context: connected to ${cfg.baseUrl} (${health.service ?? "unknown-service"}: ${health.status ?? "unknown"})`,
          );
        } catch (error) {
          api.logger.warn(`novaspine-context: health check failed: ${String(error)}`);
        }
      },
    });

    api.registerCli(
      ({ program }) => {
        const context = program.command("novaspine-context").description("NovaSpine context-engine plugin commands");
        context.command("health").description("Check the NovaSpine API health").action(async () => {
          const health = await requestJson<HealthResponse>(cfg, "/api/v1/health");
          console.log(JSON.stringify(health, null, 2));
        });
        context.command("status").description("Show NovaSpine full status").action(async () => {
          const status = await requestJson<StatusResponse>(cfg, "/api/v1/status/full");
          console.log(JSON.stringify(status, null, 2));
        });
      },
      { commands: ["novaspine-context"] },
    );

    api.registerContextEngine("novaspine-context", () => createNovaSpineContextEngine(api, cfg, statePath));
  },
};

export default novaspineContextPlugin;
