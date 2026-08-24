import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const WORKSPACE_ROOT = "/Users/escobarjr/EscobarOS/workspace";
const OPENCLAW_ROOT = "/Users/escobarjr/.openclaw";

const OPENCLAW_CATALOG_PATH = `${OPENCLAW_ROOT}/openclaw.json`;
const OPENCLAW_SQLITE_PATH = `${OPENCLAW_ROOT}/state/openclaw.sqlite`;
const AGENTS_SESSIONS_ROOT = `${OPENCLAW_ROOT}/agents`;
const AGENTS_HEALTH_PATH = `${WORKSPACE_ROOT}/outputs/openclaw/agents-health/latest-status.json`;
const LATEST_DELEGATION_PATH = `${WORKSPACE_ROOT}/outputs/openclaw/delegations/latest_delegation.json`;
const DELEGATION_LOG_PATH = `${WORKSPACE_ROOT}/outputs/openclaw/delegations/delegation_log.jsonl`;
const DELEGATION_TEST_LATEST_PATH = `${WORKSPACE_ROOT}/outputs/openclaw/delegation-tests/latest.json`;
const ROUTING_RULES_PATH = `${WORKSPACE_ROOT}/config/delegation-routes.json`;
const PROJECT_MEMORY_ROOT = `${WORKSPACE_ROOT}/memory/projects`;
const UIUX_PRO_MAX_SKILL_ROOT = `${WORKSPACE_ROOT}/skills/ui-ux-pro-max`;
const FRONTEND_DESIGN_ULTIMATE_SKILL_ROOT = `${WORKSPACE_ROOT}/skills/frontend-design-ultimate`;
const HEARTBEAT_PATH = `${WORKSPACE_ROOT}/HEARTBEAT.md`;
const OBSIDIAN_VAULT_ROOT = "/Users/escobarjr/Library/CloudStorage/GoogleDrive-em.mktdigitalrc@gmail.com/Meu Drive/Escobar OS";
const OBSIDIAN_DAILY_OPENCLAW_NOTE = `${OBSIDIAN_VAULT_ROOT}/09_Automatizacoes/OpenClaw/2026-07-18-mission-control-e-modelos.md`;
const OBSIDIAN_LUMI_AGENT_NOTE = `${OBSIDIAN_VAULT_ROOT}/03_Agentes/Lumi/AGENTE_ATENDENTE.md`;
const OBSIDIAN_LUMI_KB_INDEX = `${OBSIDIAN_VAULT_ROOT}/04_Conhecimento/EM_Marketing_Digital/Atendimento_Lumi/INDEX.md`;

const RECENT_SESSION_WINDOW_MS = 6 * 60 * 60 * 1000;
const execFileAsync = promisify(execFile);

export type AgentHealthStatus = "OK" | "WARN" | "FAIL" | string;
export type ExecutionStatus = "RUNNING" | "RECENT" | "STALE" | "NO_SESSION" | "ERROR" | "UNKNOWN";
export type SourceStatus = "connected" | "missing" | "pending";

export type AgentHealthEntry = {
  id: string;
  name: string;
  role?: string;
  status: AgentHealthStatus;
  model?: string;
  issues?: string[];
  warnings?: string[];
};

export type AgentsHealthSnapshot = {
  generatedAt?: string;
  overall?: AgentHealthStatus;
  agents?: AgentHealthEntry[];
  output?: {
    markdownPath?: string;
    jsonPath?: string;
  };
};

export type DelegationSnapshot = {
  id?: string;
  createdAt?: string;
  timestamp?: string;
  event?: string;
  agentId?: string;
  agentName?: string;
  task?: string;
  reason?: string;
  decision?: string;
  details?: Record<string, unknown>;
};

export type DelegationStageStatus = "done" | "pending" | "failed";

export type DelegationQueueItem = {
  id: string;
  task: string;
  agentId: string;
  agentName: string;
  reason: string;
  decision: string;
  requestedAt?: string;
  updatedAt?: string;
  status: "SENT" | "RESPONDED" | "FAILED" | "VALIDATED" | "DELIVERED";
  stages: Array<{
    id: "received" | "sent" | "agent-response" | "validated" | "delivered";
    label: string;
    status: DelegationStageStatus;
    timestamp?: string;
    detail: string;
  }>;
  events: DelegationSnapshot[];
};

type OpenClawAgent = {
  id?: string;
  name?: string | null;
  role?: string;
  agentDir?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
  };
  model?: string | {
    primary?: string;
    fallbacks?: string[];
  } | null;
  memorySearch?: MemorySearchConfig;
};

type MemorySearchConfig = {
  enabled?: boolean;
  provider?: string;
  fallback?: string;
  query?: {
    hybrid?: {
      enabled?: boolean;
      vectorWeight?: number;
      textWeight?: number;
    };
  };
};

type OpenClawCatalog = {
  tools?: {
    agentToAgent?: {
      enabled?: boolean;
      allow?: string[];
    };
  };
  agents?: {
    defaults?: {
      model?: ConfiguredModel;
      models?: Record<string, unknown> | Array<{ id?: string }>;
      memorySearch?: MemorySearchConfig;
    };
    list?: OpenClawAgent[];
  };
};

type ConfiguredModel = string | {
  primary?: string;
  fallbacks?: string[];
} | null | undefined;

export type SessionSummary = {
  key: string;
  agentId: string;
  sessionId?: string;
  status?: string;
  channel?: string;
  model?: string;
  modelProvider?: string;
  updatedAt?: number;
  startedAt?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  transcriptPath?: string;
  lastError?: string;
};

export type MissionAgentEntry = {
  id: string;
  name: string;
  role: string;
  configStatus: AgentHealthStatus;
  configReason: string;
  executionStatus: ExecutionStatus;
  executionReason: string;
  modelPrimary: string;
  modelFallbacks: string[];
  staticHealth?: AgentHealthEntry;
  latestSession?: SessionSummary;
  sessionCount: number;
  issues: string[];
  warnings: string[];
};

export type DelegationHistory = {
  latest: DelegationSnapshot | null;
  recent: DelegationSnapshot[];
  queue: DelegationQueueItem[];
  sourceStatus: SourceStatus;
};

export type OperationsSource = {
  label: string;
  path?: string;
  status: SourceStatus;
  detail: string;
};

export type CostSummary = {
  sourceStatus: SourceStatus;
  totalSessions: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  byAgent: Array<{
    agentId: string;
    agentName: string;
    sessions: number;
    tokens: number;
    estimatedCostUsd: number | null;
  }>;
};

export type RoutingRuleSummary = {
  sourceStatus: SourceStatus;
  path: string;
  routes: Array<{
    id: string;
    specialistAgentId: string;
    agentName?: string;
    reason: string;
    keywordCount: number;
  }>;
};

export type DelegationSmokeTestResult = {
  agentId: string;
  agentName: string;
  status: "ok" | "failed" | "unexpected_reply" | string;
  expectedToken: string;
  reply?: string;
  startedAt: string;
  durationMs: number;
  channel: string;
  error?: string;
};

export type DelegationSmokeTestReport = {
  generatedAt: string;
  catalogPath: string;
  preferredDelegationChannel: string;
  cleanSpawnStatus: string;
  mode?: "single" | "rotate" | "all" | string;
  batchSize?: number;
  timeoutSeconds?: number;
  messageProfile?: string;
  modelPolicy?: string;
  testedCount: number;
  okCount: number;
  failCount: number;
  results: DelegationSmokeTestResult[];
};

export type DelegationRuntimeRoute = {
  routeId: string;
  agentId: string;
  agentName: string;
  primaryChannel: string;
  cleanSpawnStatus: SourceStatus;
  fallbackAgentId: string;
  fallbackAgentName: string;
  fallbackReason: string;
  reason: string;
};

export type ManualDelegationResult = {
  id: string;
  task: string;
  agentId: string;
  agentName: string;
  routeId?: string;
  status: "pending" | "responded" | "failed" | "timeout" | "stale" | string;
  requestedAt?: string;
  completedAt?: string;
  durationMs?: number;
  message: string;
  reply?: string;
  error?: string;
  channel: string;
  ageMinutes: number | null;
  canRetry: boolean;
};

export type DelegationRuntimeSummary = {
  sourceStatus: SourceStatus;
  detail: string;
  preferredChannel: string;
  cleanSpawnStatus: SourceStatus;
  cleanSpawnDetail: string;
  configuredAgentCount: number;
  blockedSpawnEvents: number;
  latestTest: DelegationSmokeTestReport | null;
  latestTestStatus: SourceStatus;
  latestTestDetail: string;
  latestTestAgeHours: number | null;
  latestManual: ManualDelegationResult | null;
  manualHistory: ManualDelegationResult[];
  routes: DelegationRuntimeRoute[];
};

export type AgentToolCapability = {
  id: "delegation" | "workspace" | "obsidian" | "cron" | "claude" | "uiux" | "frontend" | "whatsapp" | "browser";
  label: string;
  status: SourceStatus;
  detail: string;
};

export type AgentToolAccessEntry = {
  agentId: string;
  agentName: string;
  role: string;
  sourceStatus: SourceStatus;
  capabilities: AgentToolCapability[];
};

export type AgentToolAccessSummary = {
  sourceStatus: SourceStatus;
  detail: string;
  entries: AgentToolAccessEntry[];
};

export type PendingOperationsArea = {
  id: string;
  label: string;
  status: SourceStatus;
  detail: string;
};

export type RoutineJobEntry = {
  id: string;
  name: string;
  agentId?: string;
  enabled: boolean;
  scheduleKind: string;
  schedule: string;
  timezone?: string;
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastRunStatus?: string;
  lastError?: string;
  payloadKind: string;
  payloadModel?: string;
  deliveryMode?: string;
  deliveryChannel?: string;
  failureAlertChannel?: string;
};

export type ModelHealthEntry = {
  agentId: string;
  agentName: string;
  status: AgentHealthStatus;
  primaryModel: string;
  fallbackModels: string[];
  sessionCount: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  providers: string[];
  recentModels: string[];
  latestError?: string;
  cronJobs: Array<{
    id: string;
    name: string;
    model?: string;
    status?: string;
  }>;
  warnings: string[];
  historyNotes: string[];
};

export type ModelHealthSummary = {
  sourceStatus: SourceStatus;
  totalAgents: number;
  warningCount: number;
  errorCount: number;
  entries: ModelHealthEntry[];
};

export type RoutineSummary = {
  sourceStatus: SourceStatus;
  schedulerEnabled: boolean;
  sqlitePath: string;
  heartbeatPath: string;
  heartbeatStatus: SourceStatus;
  detail: string;
  jobs: RoutineJobEntry[];
};

export type ProjectMemoryEntry = {
  id: string;
  label: string;
  owner: string;
  status: SourceStatus;
  summary: string;
  currentFocus: string;
  nextAction: string;
  updatedAt?: string;
  path: string;
};

export type ProjectMemorySummary = {
  sourceStatus: SourceStatus;
  root: string;
  projects: ProjectMemoryEntry[];
};

export type MemorySearchSummary = {
  sourceStatus: SourceStatus;
  mode: "FTS/files only" | "embeddings" | "disabled" | "unknown";
  provider: string;
  fallback: string;
  vectorEnabled: boolean;
  textWeight: number | null;
  vectorWeight: number | null;
  detail: string;
};

export type ObsidianSyncNote = {
  id: string;
  label: string;
  role: "operacao" | "agente" | "conhecimento" | "legado" | "politica";
  status: SourceStatus;
  path: string;
  obsidianUrl: string;
  detail: string;
};

export type ObsidianAuditIssue = {
  id: string;
  label: string;
  severity: "error" | "warning" | "info";
  status: SourceStatus;
  path?: string;
  obsidianUrl?: string;
  detail: string;
};

export type ObsidianSyncSummary = {
  sourceStatus: SourceStatus;
  vaultRoot: string;
  detail: string;
  notes: ObsidianSyncNote[];
  issues: ObsidianAuditIssue[];
  errorCount: number;
  warningCount: number;
  staleReferenceCount: number;
  claudePolicy: {
    status: SourceStatus;
    primary: string;
    fallback: string;
    manualModels: string[];
    detail: string;
  };
};

export type TianaOperationsSnapshot = {
  generatedAt: string;
  paths: {
    openclawCatalog: string;
    openclawSqlite: string;
    agentsHealth: string;
    latestDelegation: string;
    delegationLog: string;
    sessionsRoot: string;
    routingRules: string;
    projectMemory: string;
    heartbeat: string;
    obsidianVault: string;
  };
  health: AgentsHealthSnapshot | null;
  agents: MissionAgentEntry[];
  sessions: {
    sourceStatus: SourceStatus;
    recent: SessionSummary[];
  };
  delegations: DelegationHistory;
  costs: CostSummary;
  routingRules: RoutingRuleSummary;
  delegationRuntime: DelegationRuntimeSummary;
  agentToolAccess: AgentToolAccessSummary;
  projectMemory: ProjectMemorySummary;
  memorySearch: MemorySearchSummary;
  obsidianSync: ObsidianSyncSummary;
  modelHealth: ModelHealthSummary;
  routines: RoutineSummary;
  errors: string[];
  sources: OperationsSource[];
};

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  return (await readTextFile(filePath)) !== null;
}

function obsidianUrl(filePath: string): string {
  const relative = filePath.startsWith(`${OBSIDIAN_VAULT_ROOT}/`)
    ? filePath.slice(OBSIDIAN_VAULT_ROOT.length + 1).replace(/\.md$/, "")
    : filePath;
  return `obsidian://open?vault=${encodeURIComponent("Escobar OS")}&file=${encodeURIComponent(relative)}`;
}

function getCatalogAgents(catalog: OpenClawCatalog | null): OpenClawAgent[] {
  return Array.isArray(catalog?.agents?.list) ? catalog.agents.list : [];
}

function describeModel(model: ConfiguredModel, fallbackModel?: ConfiguredModel) {
  const raw = model || fallbackModel;
  if (!raw) return { primary: "sem modelo configurado", fallbacks: [] };
  if (typeof raw === "string") return { primary: raw, fallbacks: [] };
  return {
    primary: raw.primary || "sem modelo configurado",
    fallbacks: Array.isArray(raw.fallbacks) ? raw.fallbacks : [],
  };
}

function roleFromAgent(agent: OpenClawAgent, health?: AgentHealthEntry) {
  return health?.role || agent.identity?.theme || agent.role || "Sem funcao declarada";
}

function dateMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function isRecentMs(value: number | undefined): boolean {
  return Boolean(value && Date.now() - value <= RECENT_SESSION_WINDOW_MS);
}

async function readLastTranscriptError(pathname: string | undefined): Promise<string | undefined> {
  if (!pathname) return undefined;
  const raw = await readTextFile(pathname);
  if (!raw) return undefined;

  const lines = raw.trim().split("\n").slice(-10).reverse();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as {
        message?: {
          stopReason?: string;
          errorMessage?: string;
          errorCode?: string;
        };
      };
      const error = entry.message?.errorMessage || entry.message?.errorCode;
      if (error) return error;
      if (entry.message?.stopReason === "error") return "Ultima execucao terminou com erro.";
    } catch {
      // Ignore malformed historical log lines.
    }
  }

  return undefined;
}

async function readAgentSessions(agentId: string): Promise<SessionSummary[]> {
  const registryPath = `${AGENTS_SESSIONS_ROOT}/${agentId}/sessions/sessions.json`;
  const registry = await readJsonFile<Record<string, Record<string, unknown>>>(registryPath);
  if (!registry) return [];

  return await Promise.all(
    Object.entries(registry).map(async ([key, record]) => {
      const sessionId = typeof record.sessionId === "string" ? record.sessionId : undefined;
      const sessionFile = typeof record.sessionFile === "string"
        ? record.sessionFile
        : sessionId
          ? `${AGENTS_SESSIONS_ROOT}/${agentId}/sessions/${sessionId}.jsonl`
          : undefined;
      const status = typeof record.status === "string" ? record.status : undefined;
      const lastError = await readLastTranscriptError(sessionFile);

      return {
        key,
        agentId,
        sessionId,
        status,
        channel: typeof record.channel === "string"
          ? record.channel
          : typeof record.lastChannel === "string"
            ? record.lastChannel
            : undefined,
        model: typeof record.model === "string" ? record.model : undefined,
        modelProvider: typeof record.modelProvider === "string" ? record.modelProvider : undefined,
        updatedAt: dateMs(record.updatedAt),
        startedAt: dateMs(record.startedAt) ?? dateMs(record.sessionStartedAt),
        totalTokens: typeof record.totalTokens === "number" ? record.totalTokens : undefined,
        estimatedCostUsd: typeof record.estimatedCostUsd === "number" ? record.estimatedCostUsd : undefined,
        transcriptPath: sessionFile,
        lastError,
      };
    }),
  );
}

function classifyExecution(session: SessionSummary | undefined): {
  status: ExecutionStatus;
  reason: string;
} {
  if (!session) {
    return {
      status: "NO_SESSION",
      reason: "Sem sessao local registrada para este agente.",
    };
  }

  const updatedAt = session.updatedAt ?? 0;

  if (session.lastError && (String(session.status || "").toLowerCase() === "running" || isRecentMs(updatedAt))) {
    return {
      status: "ERROR",
      reason: session.lastError,
    };
  }

  if (String(session.status || "").toLowerCase() === "running") {
    return {
      status: "RUNNING",
      reason: "Sessao marcada como running no registro local do OpenClaw.",
    };
  }

  if (isRecentMs(updatedAt)) {
    return {
      status: "RECENT",
      reason: "Ha sessao recente, mas ela nao esta marcada como running.",
    };
  }

  return {
    status: "STALE",
    reason: session.lastError
      ? `Erro historico em sessao antiga: ${session.lastError}`
      : "Ha historico de sessao, mas sem disponibilidade ativa confirmada.",
  };
}

async function loadSessionsForAgents(agentIds: string[]): Promise<SessionSummary[]> {
  const nested = await Promise.all(agentIds.map((agentId) => readAgentSessions(agentId)));
  return nested
    .flat()
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

function readDelegationTime(entry: DelegationSnapshot) {
  return dateMs(entry.createdAt) ?? dateMs(entry.timestamp) ?? 0;
}

function normalizeDelegationEvent(event: string | undefined) {
  return String(event || "").trim().toLowerCase();
}

function delegationTimestamp(entry: DelegationSnapshot | undefined): string | undefined {
  return entry?.createdAt ?? entry?.timestamp;
}

function delegationQueueKey(entry: DelegationSnapshot) {
  const task = String(entry.task || "sem-tarefa").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return task;
}

function stringDetail(details: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberDetail(details: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = details?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isManualDelegateNow(entry: DelegationSnapshot): boolean {
  return entry.details?.manualDelegateNow === true || stringDetail(entry.details, "source") === "mission-control-delegate-now";
}

function manualDelegationKey(entry: DelegationSnapshot): string {
  const runId = stringDetail(entry.details, "runId");
  if (runId) return runId;
  return [
    entry.agentId || "sem-agente",
    String(entry.task || "sem-tarefa").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(),
  ].join(":");
}

function buildManualDelegationResult(group: DelegationSnapshot[]): ManualDelegationResult {
  const events = group.sort((a, b) => readDelegationTime(a) - readDelegationTime(b));
  const first = events[0];
  const latest = events[events.length - 1];
  const sent = events.find((entry) => normalizeDelegationEvent(entry.event) === "sent") ?? first;
  const terminal = [...events].reverse().find((entry) => {
    const event = normalizeDelegationEvent(entry.event);
    return event === "responded" || event === "failed";
  });
  const details = terminal?.details ?? latest.details ?? sent.details;
  const event = normalizeDelegationEvent(terminal?.event);
  const requestedAt = stringDetail(sent.details, "requestedAt") ?? delegationTimestamp(sent);
  const completedAt = terminal ? delegationTimestamp(terminal) : undefined;
  const latestAtMs = readDelegationTime(terminal ?? latest);
  const ageMinutes = latestAtMs
    ? Math.max(0, Math.round(((Date.now() - latestAtMs) / 60_000) * 10) / 10)
    : null;
  const isStale = !terminal && ageMinutes !== null && ageMinutes > 10;
  const terminalStatus = stringDetail(details, "status");
  const routeId = stringDetail(details, "routeId") ?? stringDetail(sent.details, "routeId");
  const status = terminal
    ? terminalStatus === "ok"
      ? "responded"
      : terminalStatus || (event === "responded" ? "responded" : "failed")
    : isStale
      ? "stale"
      : "pending";

  return {
    id: terminal?.id || latest.id || manualDelegationKey(first),
    task: first.task || "Delegacao manual",
    agentId: first.agentId || "sem-agente",
    agentName: first.agentName || first.agentId || "Sem agente",
    routeId: routeId && routeId !== "manual" ? routeId : undefined,
    status,
    requestedAt,
    completedAt,
    durationMs: numberDetail(details, "durationMs"),
    message: stringDetail(details, "message") || stringDetail(sent.details, "message") || first.task || "Sem mensagem",
    reply: stringDetail(details, "reply") || stringDetail(details, "replyPreview"),
    error: stringDetail(details, "error") || (event === "failed" ? terminal?.decision : undefined),
    channel: stringDetail(details, "channel") || stringDetail(sent.details, "channel") || "sessions_send/openclaw-agent",
    ageMinutes,
    canRetry: Boolean(first.agentId && (stringDetail(details, "message") || stringDetail(sent.details, "message"))),
  };
}

function buildManualDelegationHistory(entries: DelegationSnapshot[], limit = 8): ManualDelegationResult[] {
  const groups = new Map<string, DelegationSnapshot[]>();

  for (const entry of entries) {
    if (!isManualDelegateNow(entry)) continue;
    const key = manualDelegationKey(entry);
    const current = groups.get(key) ?? [];
    current.push(entry);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map(buildManualDelegationResult)
    .sort((a, b) => (dateMs(b.completedAt) ?? dateMs(b.requestedAt) ?? 0) - (dateMs(a.completedAt) ?? dateMs(a.requestedAt) ?? 0))
    .slice(0, limit);
}

function buildDelegationQueue(entries: DelegationSnapshot[]): DelegationQueueItem[] {
  const groups = new Map<string, DelegationSnapshot[]>();

  for (const entry of entries) {
    const key = delegationQueueKey(entry);
    const current = groups.get(key) ?? [];
    current.push(entry);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const events = group.sort((a, b) => readDelegationTime(a) - readDelegationTime(b));
      const latest = events[events.length - 1];
      const first = events[0];
      const sent = events.find((entry) => normalizeDelegationEvent(entry.event) === "sent");
      const responded = events.find((entry) => normalizeDelegationEvent(entry.event) === "responded");
      const failed = events.find((entry) => normalizeDelegationEvent(entry.event) === "failed");
      const validated = events.find((entry) => normalizeDelegationEvent(entry.event) === "validated");
      const delivered = events.find((entry) => normalizeDelegationEvent(entry.event) === "delivered");
      const status = delivered
        ? "DELIVERED"
        : validated
          ? "VALIDATED"
          : failed
            ? "FAILED"
            : responded
              ? "RESPONDED"
              : "SENT";

      return {
        id: latest.id || key,
        task: first.task || "Sem tarefa registrada",
        agentId: first.agentId || "sem-agente",
        agentName: first.agentName || first.agentId || "Sem agente",
        reason: first.reason || "Sem motivo registrado.",
        decision: latest.decision || first.decision || "Sem decisao registrada.",
        requestedAt: delegationTimestamp(sent ?? first),
        updatedAt: delegationTimestamp(latest),
        status,
        stages: [
          {
            id: "received",
            label: "Pedido recebido",
            status: "done",
            timestamp: delegationTimestamp(first),
            detail: first.task || "Pedido registrado no log de delegacao.",
          },
          {
            id: "sent",
            label: "Agente responsavel",
            status: sent ? "done" : "pending",
            timestamp: delegationTimestamp(sent),
            detail: `${first.agentName || first.agentId || "Sem agente"} - ${first.reason || "sem motivo registrado"}`,
          },
          {
            id: "agent-response",
            label: "Status do agente",
            status: failed ? "failed" : responded ? "done" : "pending",
            timestamp: delegationTimestamp(failed ?? responded),
            detail: failed
              ? failed.decision || "Falha registrada."
              : responded
                ? responded.decision || "Resposta registrada."
                : "Aguardando resposta ou falha formal.",
          },
          {
            id: "validated",
            label: "Validacao",
            status: validated ? "done" : "pending",
            timestamp: delegationTimestamp(validated),
            detail: validated?.decision || "Aguardando validacao da Tiana.",
          },
          {
            id: "delivered",
            label: "Entrega",
            status: delivered ? "done" : "pending",
            timestamp: delegationTimestamp(delivered),
            detail: delivered?.decision || "Aguardando entrega consolidada.",
          },
        ],
        events,
      } satisfies DelegationQueueItem;
    })
    .sort((a, b) => (dateMs(b.updatedAt) ?? 0) - (dateMs(a.updatedAt) ?? 0))
    .slice(0, 6);
}

async function loadDelegations(): Promise<DelegationHistory> {
  const [latest, rawLog] = await Promise.all([
    readJsonFile<DelegationSnapshot>(LATEST_DELEGATION_PATH),
    readTextFile(DELEGATION_LOG_PATH),
  ]);

  if (!rawLog) {
    return {
      latest,
      recent: latest ? [latest] : [],
      queue: latest ? buildDelegationQueue([latest]) : [],
      sourceStatus: latest ? "connected" : "missing",
    };
  }

  const recent = rawLog
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as DelegationSnapshot;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is DelegationSnapshot => Boolean(entry))
    .sort((a, b) => readDelegationTime(b) - readDelegationTime(a))
    .slice(0, 80);

  return {
    latest,
    recent,
    queue: buildDelegationQueue(recent),
    sourceStatus: "connected",
  };
}

function buildCostSummary(sessions: SessionSummary[], agents: MissionAgentEntry[]): CostSummary {
  const byName = new Map(agents.map((agent) => [agent.id, agent.name]));
  const rows = new Map<string, { sessions: number; tokens: number; cost: number | null }>();

  for (const session of sessions) {
    const current = rows.get(session.agentId) ?? { sessions: 0, tokens: 0, cost: null };
    current.sessions += 1;
    current.tokens += session.totalTokens ?? 0;
    if (typeof session.estimatedCostUsd === "number") {
      current.cost = (current.cost ?? 0) + session.estimatedCostUsd;
    }
    rows.set(session.agentId, current);
  }

  const totalCost = [...rows.values()].reduce<number | null>((sum, row) => {
    if (row.cost === null) return sum;
    return (sum ?? 0) + row.cost;
  }, null);

  return {
    sourceStatus: sessions.length ? "connected" : "missing",
    totalSessions: sessions.length,
    totalTokens: [...rows.values()].reduce((sum, row) => sum + row.tokens, 0),
    estimatedCostUsd: totalCost,
    byAgent: [...rows.entries()]
      .map(([agentId, row]) => ({
        agentId,
        agentName: byName.get(agentId) ?? agentId,
        sessions: row.sessions,
        tokens: row.tokens,
        estimatedCostUsd: row.cost,
      }))
      .sort((a, b) => b.tokens - a.tokens),
  };
}

function isAttentionModel(model: string | undefined): boolean {
  if (!model) return false;
  return /gemini/i.test(model);
}

function buildModelHealthSummary(
  agents: MissionAgentEntry[],
  sessions: SessionSummary[],
  routines: RoutineSummary,
): ModelHealthSummary {
  const sessionsByAgent = new Map<string, SessionSummary[]>();
  for (const session of sessions) {
    const current = sessionsByAgent.get(session.agentId) ?? [];
    current.push(session);
    sessionsByAgent.set(session.agentId, current);
  }

  const cronJobsByAgent = new Map<string, RoutineJobEntry[]>();
  for (const job of routines.jobs) {
    const agentId = job.agentId || "sem-agente";
    const current = cronJobsByAgent.get(agentId) ?? [];
    current.push(job);
    cronJobsByAgent.set(agentId, current);
  }

  const entries = agents.map<ModelHealthEntry>((agent) => {
    const agentSessions = sessionsByAgent.get(agent.id) ?? [];
    const cronJobs = cronJobsByAgent.get(agent.id) ?? [];
    const totalTokens = agentSessions.reduce((sum, session) => sum + (session.totalTokens ?? 0), 0);
    const estimatedCostUsd = agentSessions.reduce<number | null>((sum, session) => {
      if (typeof session.estimatedCostUsd !== "number") return sum;
      return (sum ?? 0) + session.estimatedCostUsd;
    }, null);
    const providers = [...new Set(agentSessions.map((session) => session.modelProvider).filter((provider): provider is string => Boolean(provider)))];
    const recentModels = [...new Set(agentSessions.map((session) => session.model).filter((model): model is string => Boolean(model)))].slice(0, 4);
    const hasRecentGeminiSession = agentSessions.some((session) => isRecentMs(session.updatedAt) && isAttentionModel(session.model));
    const hasHistoricalGeminiSession = agentSessions.some((session) => !isRecentMs(session.updatedAt) && isAttentionModel(session.model));
    const latestSessionIsRecent = isRecentMs(agent.latestSession?.updatedAt);
    const latestError = latestSessionIsRecent ? agent.latestSession?.lastError : undefined;
    const historicalError = !latestSessionIsRecent ? agent.latestSession?.lastError : undefined;
    const historyNotes = [
      ...(hasHistoricalGeminiSession
        ? ["Historico de sessoes antigas ainda mostra Gemini."]
        : []),
      ...(historicalError ? [`Erro historico em sessao antiga: ${historicalError}`] : []),
    ];
    const warnings = [
      ...agent.warnings,
      ...(isAttentionModel(agent.modelPrimary) || agent.modelFallbacks.some(isAttentionModel)
        ? ["Catalogo do agente ainda referencia Gemini."]
        : []),
      ...(hasRecentGeminiSession
        ? ["Sessoes recentes ainda mostram Gemini."]
        : []),
      ...(cronJobs.some((job) => isAttentionModel(job.payloadModel))
        ? ["Cron vinculado ao agente ainda usa Gemini."]
        : []),
      ...(latestError ? [`Erro recente: ${latestError}`] : []),
    ];
    const status = latestError
      ? "FAIL"
      : warnings.length
        ? "WARN"
        : "OK";

    return {
      agentId: agent.id,
      agentName: agent.name,
      status,
      primaryModel: agent.modelPrimary,
      fallbackModels: agent.modelFallbacks,
      sessionCount: agentSessions.length,
      totalTokens,
      estimatedCostUsd,
      providers,
      recentModels,
      latestError,
      cronJobs: cronJobs.map((job) => ({
        id: job.id,
        name: job.name,
        model: job.payloadModel,
        status: job.lastRunStatus,
      })),
      warnings,
      historyNotes,
    };
  });

  return {
    sourceStatus: agents.length ? "connected" : "missing",
    totalAgents: entries.length,
    warningCount: entries.filter((entry) => entry.status === "WARN").length,
    errorCount: entries.filter((entry) => entry.status === "FAIL").length,
    entries: entries.sort((a, b) => {
      const weight = (status: AgentHealthStatus) => status === "FAIL" ? 0 : status === "WARN" ? 1 : 2;
      return weight(a.status) - weight(b.status) || b.totalTokens - a.totalTokens;
    }),
  };
}

async function loadRoutingRules(): Promise<RoutingRuleSummary> {
  const raw = await readJsonFile<{
    routes?: Array<{
      id?: string;
      agentId?: string;
      specialistAgentId?: string;
      agentName?: string;
      reason?: string;
      matchAny?: string[];
      keywords?: string[];
    }>;
  }>(ROUTING_RULES_PATH);

  if (!raw) {
    return {
      sourceStatus: "missing",
      path: ROUTING_RULES_PATH,
      routes: [],
    };
  }

  return {
    sourceStatus: "connected",
    path: ROUTING_RULES_PATH,
    routes: (raw.routes ?? []).map((route) => ({
      id: route.id || "sem-id",
      specialistAgentId: route.agentId || route.specialistAgentId || "sem-agente",
      agentName: typeof route.agentName === "string" ? route.agentName : undefined,
      reason: route.reason || "Sem motivo registrado.",
      keywordCount: route.matchAny?.length ?? route.keywords?.length ?? 0,
    })),
  };
}

async function hasDirectoryEntries(pathname: string): Promise<boolean> {
  try {
    const entries = await readdir(pathname);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function hasUiUxProMaxSkill(): Promise<boolean> {
  const requiredFiles = [
    `${UIUX_PRO_MAX_SKILL_ROOT}/SKILL.md`,
    `${UIUX_PRO_MAX_SKILL_ROOT}/scripts/search.py`,
    `${UIUX_PRO_MAX_SKILL_ROOT}/scripts/core.py`,
    `${UIUX_PRO_MAX_SKILL_ROOT}/scripts/design_system.py`,
    `${UIUX_PRO_MAX_SKILL_ROOT}/data/styles.csv`,
    `${UIUX_PRO_MAX_SKILL_ROOT}/data/ux-guidelines.csv`,
    `${UIUX_PRO_MAX_SKILL_ROOT}/data/stacks/nextjs.csv`,
  ];
  const checks = await Promise.all(requiredFiles.map((filePath) => fileExists(filePath)));
  return checks.every(Boolean);
}

async function hasFrontendDesignUltimateSkill(): Promise<boolean> {
  const requiredFiles = [
    `${FRONTEND_DESIGN_ULTIMATE_SKILL_ROOT}/SKILL.md`,
    `${FRONTEND_DESIGN_ULTIMATE_SKILL_ROOT}/references/source-audit.md`,
    `${FRONTEND_DESIGN_ULTIMATE_SKILL_ROOT}/scripts/usage-notes.sh`,
  ];
  const checks = await Promise.all(requiredFiles.map((filePath) => fileExists(filePath)));
  return checks.every(Boolean);
}

function readMarkdownField(raw: string, label: string): string {
  const pattern = new RegExp(`^- ${label}:\\s*(.+)$`, "im");
  return raw.match(pattern)?.[1]?.trim() || "";
}

function readMarkdownFirstBullet(raw: string, section: string): string {
  const pattern = new RegExp(`^## ${section}\\s*\\n([\\s\\S]*?)(?:\\n## |$)`, "im");
  const sectionBody = raw.match(pattern)?.[1] ?? "";
  return sectionBody.match(/^- (.+)$/m)?.[1]?.trim() || "";
}

function titleFromMarkdown(raw: string, fallback: string): string {
  return raw.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

async function loadProjectMemory(): Promise<ProjectMemorySummary> {
  try {
    const entries = await readdir(PROJECT_MEMORY_ROOT, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => `${PROJECT_MEMORY_ROOT}/${entry.name}`)
      .sort();

    const projects = await Promise.all(files.map(async (filePath) => {
      const raw = await readTextFile(filePath);
      const id = filePath.split("/").pop()?.replace(/\.md$/, "") || filePath;
      if (!raw) {
        return {
          id,
          label: id,
          owner: "Sem dono",
          status: "missing",
          summary: "Arquivo nao pode ser lido.",
          currentFocus: "Sem foco carregado.",
          nextAction: "Conferir arquivo de memoria.",
          path: filePath,
        } satisfies ProjectMemoryEntry;
      }

      const status = readMarkdownField(raw, "Status");
      return {
        id,
        label: titleFromMarkdown(raw, id),
        owner: readMarkdownField(raw, "Dono") || "Sem dono",
        status: status.toLowerCase() === "pendente" ? "pending" : "connected",
        summary: readMarkdownField(raw, "Resumo") || "Sem resumo registrado.",
        currentFocus: readMarkdownFirstBullet(raw, "Foco atual") || "Sem foco atual registrado.",
        nextAction: readMarkdownFirstBullet(raw, "Proxima acao") || "Sem proxima acao registrada.",
        updatedAt: readMarkdownField(raw, "Atualizado em") || undefined,
        path: filePath,
      } satisfies ProjectMemoryEntry;
    }));

    return {
      sourceStatus: projects.length ? "connected" : "missing",
      root: PROJECT_MEMORY_ROOT,
      projects,
    };
  } catch {
    return {
      sourceStatus: "missing",
      root: PROJECT_MEMORY_ROOT,
      projects: [],
    };
  }
}

function buildMemorySearchSummary(catalog: OpenClawCatalog | null): MemorySearchSummary {
  const defaultConfig = catalog?.agents?.defaults?.memorySearch;
  const mainConfig = catalog?.agents?.list?.find((agent) => agent.id === "main")?.memorySearch;
  const config = mainConfig ?? defaultConfig;
  const defaultProvider = defaultConfig?.provider ?? "unset";
  const provider = config?.provider ?? "unset";
  const fallback = config?.fallback ?? "unset";
  const vectorWeight = typeof config?.query?.hybrid?.vectorWeight === "number"
    ? config.query.hybrid.vectorWeight
    : null;
  const textWeight = typeof config?.query?.hybrid?.textWeight === "number"
    ? config.query.hybrid.textWeight
    : null;
  const vectorEnabled = provider !== "none" && vectorWeight !== 0;
  const enabled = config?.enabled !== false;

  if (!config) {
    return {
      sourceStatus: "pending",
      mode: "unknown",
      provider,
      fallback,
      vectorEnabled: false,
      textWeight,
      vectorWeight,
      detail: "memorySearch nao declarado no catalogo; runtime pode usar provider padrao.",
    };
  }

  if (!enabled) {
    return {
      sourceStatus: "missing",
      mode: "disabled",
      provider,
      fallback,
      vectorEnabled: false,
      textWeight,
      vectorWeight,
      detail: "Busca de memoria desabilitada no catalogo.",
    };
  }

  if (provider === "none") {
    return {
      sourceStatus: "connected",
      mode: "FTS/files only",
      provider,
      fallback,
      vectorEnabled: false,
      textWeight,
      vectorWeight,
      detail: "Memoria em FTS/files only: provider none, embeddings desativados e busca textual ativa.",
    };
  }

  if (mainConfig?.provider === "local" && defaultProvider === "none") {
    return {
      sourceStatus: "connected",
      mode: "embeddings",
      provider: "main: local / especialistas: none",
      fallback,
      vectorEnabled,
      textWeight,
      vectorWeight,
      detail: "Tiana usa embeddings locais sem API key; especialistas herdam FTS/files only para evitar reindex lento e custo externo.",
    };
  }

  return {
    sourceStatus: "pending",
    mode: "embeddings",
    provider,
    fallback,
    vectorEnabled,
    textWeight,
    vectorWeight,
    detail: `Memoria configurada com provider ${provider}; validar cota antes de tratar embeddings como disponiveis.`,
  };
}

type CronJobRow = {
  job_id?: string;
  name?: string;
  agent_id?: string | null;
  enabled?: number;
  schedule_kind?: string;
  schedule_expr?: string | null;
  schedule_tz?: string | null;
  every_ms?: number | null;
  at?: string | null;
  next_run_at_ms?: number | null;
  last_run_at_ms?: number | null;
  last_run_status?: string | null;
  last_error?: string | null;
  payload_kind?: string;
  payload_model?: string | null;
  delivery_mode?: string | null;
  delivery_channel?: string | null;
  failure_alert_channel?: string | null;
};

function summarizeSchedule(row: CronJobRow): string {
  if (row.schedule_kind === "cron" && row.schedule_expr) return row.schedule_expr;
  if (row.schedule_kind === "every" && row.every_ms) return `a cada ${Math.round(row.every_ms / 60000)} min`;
  if (row.schedule_kind === "at" && row.at) return row.at;
  return row.schedule_kind || "sem agenda";
}

function heartbeatHasActiveTasks(raw: string | null): boolean {
  if (!raw) return false;
  return raw
    .split("\n")
    .map((line) => line.trim())
    .some((line) => line && !line.startsWith("#") && !line.startsWith("<!--") && !line.endsWith("-->"));
}

async function loadRoutineSummary(): Promise<RoutineSummary> {
  const heartbeat = await readTextFile(HEARTBEAT_PATH);
  const heartbeatStatus: SourceStatus = heartbeatHasActiveTasks(heartbeat) ? "connected" : "pending";

  try {
    const query = `
      select
        job_id,
        name,
        agent_id,
        enabled,
        schedule_kind,
        schedule_expr,
        schedule_tz,
        every_ms,
        at,
        next_run_at_ms,
        last_run_at_ms,
        last_run_status,
        last_error,
        payload_kind,
        payload_model,
        delivery_mode,
        delivery_channel,
        failure_alert_channel
      from cron_jobs
      order by enabled desc, next_run_at_ms asc, name asc
      limit 20;
    `;
    const { stdout } = await execFileAsync("sqlite3", ["-json", OPENCLAW_SQLITE_PATH, query], {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    const rows = JSON.parse(stdout || "[]") as CronJobRow[];
    const jobs = rows.map<RoutineJobEntry>((row) => ({
      id: row.job_id || "sem-id",
      name: row.name || "Sem nome",
      agentId: row.agent_id ?? undefined,
      enabled: Boolean(row.enabled),
      scheduleKind: row.schedule_kind || "unknown",
      schedule: summarizeSchedule(row),
      timezone: row.schedule_tz || undefined,
      nextRunAtMs: row.next_run_at_ms ?? undefined,
      lastRunAtMs: row.last_run_at_ms ?? undefined,
      lastRunStatus: row.last_run_status ?? undefined,
      lastError: row.last_error ?? undefined,
      payloadKind: row.payload_kind || "unknown",
      payloadModel: row.payload_model ?? undefined,
      deliveryMode: row.delivery_mode ?? undefined,
      deliveryChannel: row.delivery_channel ?? undefined,
      failureAlertChannel: row.failure_alert_channel ?? undefined,
    }));
    const enabledCount = jobs.filter((job) => job.enabled).length;

    return {
      sourceStatus: jobs.length ? "connected" : "missing",
      schedulerEnabled: true,
      sqlitePath: OPENCLAW_SQLITE_PATH,
      heartbeatPath: HEARTBEAT_PATH,
      heartbeatStatus,
      detail: jobs.length
        ? `${enabledCount} de ${jobs.length} rotinas habilitadas no OpenClaw cron.`
        : "SQLite lido, mas nenhuma rotina encontrada.",
      jobs,
    };
  } catch (error) {
    return {
      sourceStatus: "missing",
      schedulerEnabled: false,
      sqlitePath: OPENCLAW_SQLITE_PATH,
      heartbeatPath: HEARTBEAT_PATH,
      heartbeatStatus,
      detail: error instanceof Error ? error.message : "Nao foi possivel ler o SQLite do OpenClaw cron.",
      jobs: [],
    };
  }
}

async function listMarkdownFiles(root: string, ignoredDirNames: Set<string>): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(entries.map(async (entry) => {
      const pathname = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!ignoredDirNames.has(entry.name)) await walk(pathname);
        return;
      }
      if (entry.isFile() && entry.name.endsWith(".md")) results.push(pathname);
    }));
  }

  await walk(root);
  return results.sort();
}

async function findActiveObsidianResidues(): Promise<ObsidianAuditIssue[]> {
  const ignoredDirNames = new Set([".obsidian", "01_BACKUPS", "99_Legado"]);
  const markdownFiles = await listMarkdownFiles(OBSIDIAN_VAULT_ROOT, ignoredDirNames);
  const patterns = [
    /Sofia/i,
    /SOFIA_ATENDIMENTO/,
    /Atendimento_Sofia/,
    /03_Agentes\/Sofia/,
  ];
  const ignoredFiles = new Set([`${OBSIDIAN_VAULT_ROOT}/01_Governanca/CHANGELOG.md`]);
  const issues: ObsidianAuditIssue[] = [];

  for (const filePath of markdownFiles) {
    if (ignoredFiles.has(filePath)) continue;
    const raw = await readTextFile(filePath);
    if (!raw) continue;
    if (!patterns.some((pattern) => pattern.test(raw))) continue;
    issues.push({
      id: `stale-reference:${filePath}`,
      label: "Legado em area ativa",
      severity: "warning",
      status: "pending",
      path: filePath,
      obsidianUrl: obsidianUrl(filePath),
      detail: "Referencia antiga encontrada fora de 99_Legado ou changelog historico.",
    });
  }

  return issues;
}

async function loadObsidianSyncSummary(catalog: OpenClawCatalog | null): Promise<ObsidianSyncSummary> {
  const requiredNotes = [
    {
      id: "mission-control-day",
      label: "Registro OpenClaw do dia",
      role: "operacao",
      path: OBSIDIAN_DAILY_OPENCLAW_NOTE,
      detail: "Nota consolidada das entregas do Mission Control e modelos.",
    },
    {
      id: "lumi-agent",
      label: "Lumi - agente atendente",
      role: "agente",
      path: OBSIDIAN_LUMI_AGENT_NOTE,
      detail: "Ficha oficial da atendente operacional da EM.",
    },
    {
      id: "lumi-kb",
      label: "Atendimento Lumi - base de conhecimento",
      role: "conhecimento",
      path: OBSIDIAN_LUMI_KB_INDEX,
      detail: "Indice ativo de atendimento e qualificacao de leads.",
    },
  ] satisfies Array<Omit<ObsidianSyncNote, "status" | "obsidianUrl">>;

  const notes = await Promise.all(requiredNotes.map(async (note) => ({
    ...note,
    status: await fileExists(note.path) ? "connected" : "missing",
    obsidianUrl: obsidianUrl(note.path),
  } satisfies ObsidianSyncNote)));

  const residues = await findActiveObsidianResidues();
  const defaults = describeModel(catalog?.agents?.defaults?.model);
  const configuredModels = catalog?.agents?.defaults?.model && typeof catalog.agents.defaults.model !== "string"
    ? [
        catalog.agents.defaults.model.primary,
        ...(catalog.agents.defaults.model.fallbacks ?? []),
      ].filter((model): model is string => Boolean(model))
    : [];
  const rawModels = catalog?.agents?.defaults?.models;
  const catalogModels = Array.isArray(rawModels)
    ? rawModels.map((model) => model.id).filter((model): model is string => Boolean(model))
    : rawModels
      ? Object.keys(rawModels)
      : [];
  const manualClaudeModels = catalogModels.filter((model) => /claude|anthropic/i.test(model));
  const automaticClaude = [defaults.primary, ...defaults.fallbacks].some((model) => /claude|anthropic/i.test(model));
  const claudePolicyIssue: ObsidianAuditIssue | null = automaticClaude
    ? {
        id: "claude-automatic-fallback",
        label: "Claude em fallback automatico",
        severity: "error",
        status: "missing",
        detail: "Claude deve ficar disponivel para uso combinado, mas nao como fallback automatico.",
      }
    : null;
  const missingNotes = notes
    .filter((note) => note.status === "missing")
    .map<ObsidianAuditIssue>((note) => ({
      id: `missing-note:${note.id}`,
      label: "Nota ausente",
      severity: "error",
      status: "missing",
      path: note.path,
      obsidianUrl: note.obsidianUrl,
      detail: note.detail,
    }));
  const issues = [
    ...missingNotes,
    ...residues,
    ...(claudePolicyIssue ? [claudePolicyIssue] : []),
  ];
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    sourceStatus: errorCount ? "missing" : warningCount ? "pending" : "connected",
    vaultRoot: OBSIDIAN_VAULT_ROOT,
    detail: errorCount
      ? `${errorCount} pendencia critica no sync do Obsidian.`
      : warningCount
        ? `${warningCount} aviso de auditoria no Obsidian.`
        : "Vault oficial sincronizado com os registros operacionais principais.",
    notes,
    issues,
    errorCount,
    warningCount,
    staleReferenceCount: residues.length,
    claudePolicy: {
      status: automaticClaude ? "missing" : "connected",
      primary: defaults.primary,
      fallback: defaults.fallbacks.join(" -> ") || "sem fallback",
      manualModels: manualClaudeModels,
      detail: configuredModels.length
        ? "OpenAI segue principal; Claude conectado fica para uso manual combinado."
        : "Politica de modelos lida do catalogo OpenClaw.",
    },
  };
}

async function loadDelegationRuntimeSummary(
  catalog: OpenClawCatalog | null,
  routingRules: RoutingRuleSummary,
  delegations: DelegationHistory,
): Promise<DelegationRuntimeSummary> {
  const catalogAgents = getCatalogAgents(catalog);
  const agentsById = new Map(catalogAgents.map((agent) => [agent.id, agent]));
  const latestTest = await readJsonFile<DelegationSmokeTestReport>(DELEGATION_TEST_LATEST_PATH);
  const latestTestTime = latestTest?.generatedAt ? new Date(latestTest.generatedAt).getTime() : Number.NaN;
  const latestTestAgeHours = Number.isFinite(latestTestTime)
    ? Math.max(0, Math.round(((Date.now() - latestTestTime) / 3_600_000) * 10) / 10)
    : null;
  const latestTestIsStale = latestTestAgeHours !== null && latestTestAgeHours > 30;
  const blockedSpawnEvents = delegations.recent.filter((entry) => {
    const haystack = JSON.stringify(entry).toLowerCase();
    return haystack.includes("sessions_spawn") || haystack.includes("allowed: main") || haystack.includes("runtime");
  }).length;
  const hasPassingTest = Boolean(latestTest?.results?.some((result) => result.status === "ok"));
  const latestTestStatus: SourceStatus = !latestTest
    ? "missing"
    : latestTest.failCount > 0
      ? "pending"
      : latestTestIsStale
        ? "pending"
        : "connected";
  const latestTestDetail = latestTest
    ? [
        `${latestTest.okCount}/${latestTest.testedCount} OK`,
        `${latestTest.mode ?? "single"}`,
        latestTestAgeHours === null ? null : `${latestTestAgeHours}h atras`,
        latestTest.timeoutSeconds ? `timeout ${latestTest.timeoutSeconds}s` : null,
      ].filter(Boolean).join(" · ")
    : "Sem teste noturno registrado.";
  const routes = routingRules.routes.map<DelegationRuntimeRoute>((route) => {
    const agent = agentsById.get(route.specialistAgentId);
    return {
      routeId: route.id,
      agentId: route.specialistAgentId,
      agentName: route.agentName || agent?.identity?.name || agent?.name || route.specialistAgentId,
      primaryChannel: "sessions_send/openclaw-agent",
      cleanSpawnStatus: "pending",
      fallbackAgentId: "main",
      fallbackAgentName: "Tiana",
      fallbackReason: "Se o agente falhar ou o runtime negar spawn limpo, entra excecao controlada registrada.",
      reason: route.reason,
    };
  });
  const manualHistory = buildManualDelegationHistory(delegations.recent);
  const latestManual = manualHistory[0] ?? null;

  return {
    sourceStatus: hasPassingTest ? "connected" : latestTest ? "pending" : "missing",
    detail: hasPassingTest
      ? "Delegacao real validada por agente configurado. Spawn limpo continua restrito neste runtime, entao o canal operacional e sessions_send/openclaw-agent."
      : latestTest
        ? "Ha teste registrado, mas nenhum agente respondeu com token esperado."
        : "Sem smoke test recente registrado. Use o botao Testar agente no painel.",
    preferredChannel: "sessions_send/openclaw-agent",
    cleanSpawnStatus: "pending",
    cleanSpawnDetail: "sessions_spawn no runtime atual aceita apenas main; especialistas respondem por sessions_send/openclaw-agent.",
    configuredAgentCount: catalogAgents.filter((agent) => agent.id && agent.id !== "main").length,
    blockedSpawnEvents,
    latestTest,
    latestTestStatus,
    latestTestDetail,
    latestTestAgeHours,
    latestManual,
    manualHistory,
    routes,
  };
}

async function loadAgentToolAccessSummary(
  catalog: OpenClawCatalog | null,
  agents: MissionAgentEntry[],
  routines: RoutineSummary,
): Promise<AgentToolAccessSummary> {
  const catalogAgents = getCatalogAgents(catalog);
  const catalogById = new Map(catalogAgents.map((agent) => [agent.id, agent]));
  const agentToAgentAllow = new Set(catalog?.tools?.agentToAgent?.allow ?? []);
  const agentToAgentEnabled = catalog?.tools?.agentToAgent?.enabled === true;
  const rawModels = catalog?.agents?.defaults?.models;
  const catalogModels = Array.isArray(rawModels)
    ? rawModels.map((model) => model.id).filter((model): model is string => Boolean(model))
    : rawModels
      ? Object.keys(rawModels)
      : [];
  const hasManualClaude = catalogModels.some((model) => /claude|anthropic/i.test(model));
  const cronByAgent = new Map<string, RoutineJobEntry[]>();
  const uiUxSkillConnected = await hasUiUxProMaxSkill();
  const frontendDesignSkillConnected = await hasFrontendDesignUltimateSkill();
  const visualFrontendSkillAgents = new Set(["em-webdesigner", "felix-desenvolvedor"]);

  for (const job of routines.jobs) {
    if (!job.agentId) continue;
    const current = cronByAgent.get(job.agentId) ?? [];
    current.push(job);
    cronByAgent.set(job.agentId, current);
  }

  const entries = await Promise.all(agents.map(async (agent) => {
    const catalogAgent = catalogById.get(agent.id);
    const agentDir = catalogAgent?.agentDir || `${AGENTS_SESSIONS_ROOT}/${agent.id}/agent`;
    const workspaceStatus = await hasDirectoryEntries(agentDir) ? "connected" : "missing";
    const obsidianAgentDir = `${OBSIDIAN_VAULT_ROOT}/03_Agentes/${agent.name}`;
    const obsidianStatus = await hasDirectoryEntries(obsidianAgentDir) ? "connected" : "pending";
    const jobs = cronByAgent.get(agent.id) ?? [];
    const delegationStatus = agentToAgentEnabled && agentToAgentAllow.has(agent.id) ? "connected" : "missing";
    const usesVisualFrontendSkills = visualFrontendSkillAgents.has(agent.id);
    const capabilities: AgentToolCapability[] = [
      {
        id: "delegation",
        label: "Delegacao A2A",
        status: delegationStatus,
        detail: delegationStatus === "connected"
          ? "Permitido na allowlist agentToAgent; canal operacional sessions_send/openclaw-agent."
          : "Nao permitido na allowlist agentToAgent.",
      },
      {
        id: "workspace",
        label: "Arquivos/workspace",
        status: workspaceStatus,
        detail: workspaceStatus === "connected"
          ? agentDir
          : "Pasta de agente nao encontrada.",
      },
      {
        id: "obsidian",
        label: "Obsidian",
        status: obsidianStatus,
        detail: obsidianStatus === "connected"
          ? obsidianAgentDir
          : "Sem ficha propria em 03_Agentes; usar nota operacional/projeto quando aplicavel.",
      },
      {
        id: "cron",
        label: "Cron",
        status: jobs.length ? "connected" : "pending",
        detail: jobs.length
          ? jobs.map((job) => job.name).join("; ")
          : "Sem rotina propria vinculada a este agente.",
      },
      {
        id: "claude",
        label: "Claude manual",
        status: hasManualClaude ? "connected" : "missing",
        detail: hasManualClaude
          ? "Disponivel apenas por decisao combinada; nao e fallback automatico."
          : "Nenhum modelo Claude configurado.",
      },
      {
        id: "uiux",
        label: "UI/UX Pro Max",
        status: uiUxSkillConnected && usesVisualFrontendSkills ? "connected" : uiUxSkillConnected ? "pending" : "missing",
        detail: uiUxSkillConnected
          ? usesVisualFrontendSkills
            ? `${UIUX_PRO_MAX_SKILL_ROOT} - consulta UI/UX disponivel para telas, paineis e design systems.`
            : "Skill instalada; uso sob demanda via Vanellope/Felix."
          : "Skill UI/UX Pro Max incompleta ou ausente.",
      },
      {
        id: "frontend",
        label: "Frontend Design Ultimate",
        status: frontendDesignSkillConnected && usesVisualFrontendSkills ? "connected" : frontendDesignSkillConnected ? "pending" : "missing",
        detail: frontendDesignSkillConnected
          ? usesVisualFrontendSkills
            ? `${FRONTEND_DESIGN_ULTIMATE_SKILL_ROOT} - execucao frontend React/Next/Tailwind com anti-generico e mobile-first.`
            : "Skill instalada; uso sob demanda via Vanellope/Felix."
          : "Skill Frontend Design Ultimate incompleta ou ausente.",
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        status: "pending",
        detail: "Permissao por agente nao declarada no catalogo atual.",
      },
      {
        id: "browser",
        label: "Browser",
        status: "pending",
        detail: "Permissao por agente nao declarada no catalogo atual.",
      },
    ];

    return {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      sourceStatus: capabilities.some((capability) => capability.status === "missing")
        ? "pending"
        : "connected",
      capabilities,
    } satisfies AgentToolAccessEntry;
  }));

  return {
    sourceStatus: entries.length ? "connected" : "missing",
    detail: entries.length
      ? "Mapa de ferramentas montado a partir do catalogo OpenClaw, pastas de agentes, rotinas, skills e Vault oficial."
      : "Nenhum agente encontrado para mapear ferramentas.",
    entries,
  };
}

export async function loadTianaOperationsSnapshot(): Promise<TianaOperationsSnapshot> {
  const [health, latestDelegations, catalog, routingRules, projectMemory, routines] = await Promise.all([
    readJsonFile<AgentsHealthSnapshot>(AGENTS_HEALTH_PATH),
    loadDelegations(),
    readJsonFile<OpenClawCatalog>(OPENCLAW_CATALOG_PATH),
    loadRoutingRules(),
    loadProjectMemory(),
    loadRoutineSummary(),
  ]);

  const catalogAgents = getCatalogAgents(catalog);
  const healthById = new Map((health?.agents ?? []).map((agent) => [agent.id, agent]));
  const catalogAgentIds = catalogAgents.map((agent) => agent.id).filter((id): id is string => Boolean(id));
  const sessions = await loadSessionsForAgents(catalogAgentIds);
  const sessionsByAgent = new Map<string, SessionSummary[]>();
  for (const session of sessions) {
    const current = sessionsByAgent.get(session.agentId) ?? [];
    current.push(session);
    sessionsByAgent.set(session.agentId, current);
  }

  const defaultModel = catalog?.agents?.defaults?.model;
  const agents = catalogAgents.map<MissionAgentEntry>((agent) => {
    const id = agent.id || "sem-id";
    const healthEntry = healthById.get(id);
    const agentSessions = sessionsByAgent.get(id) ?? [];
    const latestSession = agentSessions[0];
    const execution = classifyExecution(latestSession);
    const model = describeModel(agent.model, defaultModel);
    const issues = healthEntry?.issues ?? [];
    const warnings = healthEntry?.warnings ?? [];

    return {
      id,
      name: healthEntry?.name || agent.identity?.name || agent.name || id,
      role: roleFromAgent(agent, healthEntry),
      configStatus: healthEntry?.status || "UNKNOWN",
      configReason: healthEntry
        ? "Configuracao validada pelo healthcheck estatico."
        : "Agente existe no catalogo, mas nao apareceu no healthcheck estatico.",
      executionStatus: execution.status,
      executionReason: execution.reason,
      modelPrimary: model.primary,
      modelFallbacks: model.fallbacks,
      staticHealth: healthEntry,
      latestSession,
      sessionCount: agentSessions.length,
      issues,
      warnings,
    };
  });

  const sessionsRootHasData = await hasDirectoryEntries(AGENTS_SESSIONS_ROOT);
  const errors: string[] = [];
  if (!catalog) errors.push(`Could not read ${OPENCLAW_CATALOG_PATH}`);
  if (!health) errors.push(`Could not read ${AGENTS_HEALTH_PATH}`);
  if (!latestDelegations.latest) errors.push(`Could not read ${LATEST_DELEGATION_PATH}`);

  const costs = buildCostSummary(sessions, agents);
  const modelHealth = buildModelHealthSummary(agents, sessions, routines);
  const memorySearch = buildMemorySearchSummary(catalog);
  const obsidianSync = await loadObsidianSyncSummary(catalog);
  const delegationRuntime = await loadDelegationRuntimeSummary(catalog, routingRules, latestDelegations);
  const agentToolAccess = await loadAgentToolAccessSummary(catalog, agents, routines);
  const uiUxSkillConnected = await hasUiUxProMaxSkill();
  const frontendDesignSkillConnected = await hasFrontendDesignUltimateSkill();

  const sources: OperationsSource[] = [
    {
      label: "Catalogo real OpenClaw",
      path: OPENCLAW_CATALOG_PATH,
      status: catalog ? "connected" : "missing",
      detail: catalog ? `${catalogAgents.length} agentes no catalogo.` : "Fonte ausente.",
    },
    {
      label: "Health/configuracao estatica",
      path: AGENTS_HEALTH_PATH,
      status: health ? "connected" : "missing",
      detail: health ? `Status geral ${health.overall ?? "UNKNOWN"}.` : "Fonte ausente.",
    },
    {
      label: "Sessoes locais OpenClaw",
      path: AGENTS_SESSIONS_ROOT,
      status: sessionsRootHasData ? "connected" : "missing",
      detail: sessions.length ? `${sessions.length} sessoes lidas.` : "Nenhuma sessao encontrada.",
    },
    {
      label: "Delegacoes",
      path: DELEGATION_LOG_PATH,
      status: latestDelegations.sourceStatus,
      detail: `${latestDelegations.recent.length} eventos recentes carregados.`,
    },
    {
      label: "Teste real de delegacao",
      path: DELEGATION_TEST_LATEST_PATH,
      status: delegationRuntime.sourceStatus,
      detail: delegationRuntime.detail,
    },
    {
      label: "Regras de roteamento",
      path: ROUTING_RULES_PATH,
      status: routingRules.sourceStatus,
      detail: `${routingRules.routes.length} rotas carregadas.`,
    },
    {
      label: "Memoria por projeto",
      path: PROJECT_MEMORY_ROOT,
      status: projectMemory.sourceStatus,
      detail: `${projectMemory.projects.length} projetos com memoria operacional.`,
    },
    {
      label: "Busca de memoria",
      path: OPENCLAW_CATALOG_PATH,
      status: memorySearch.sourceStatus,
      detail: memorySearch.detail,
    },
    {
      label: "Cron/rotinas",
      path: OPENCLAW_SQLITE_PATH,
      status: routines.sourceStatus,
      detail: routines.detail,
    },
    {
      label: "Obsidian oficial",
      path: OBSIDIAN_VAULT_ROOT,
      status: obsidianSync.sourceStatus,
      detail: obsidianSync.detail,
    },
    {
      label: "Ferramentas por agente",
      path: OPENCLAW_CATALOG_PATH,
      status: agentToolAccess.sourceStatus,
      detail: agentToolAccess.detail,
    },
    {
      label: "UI/UX Pro Max",
      path: UIUX_PRO_MAX_SKILL_ROOT,
      status: uiUxSkillConnected ? "connected" : "missing",
      detail: uiUxSkillConnected
        ? "Skill UI/UX vendor instalada e validavel para Vanellope/Felix."
        : "Skill UI/UX Pro Max ainda nao possui todos os recursos esperados.",
    },
    {
      label: "Frontend Design Ultimate",
      path: FRONTEND_DESIGN_ULTIMATE_SKILL_ROOT,
      status: frontendDesignSkillConnected ? "connected" : "missing",
      detail: frontendDesignSkillConnected
        ? "Skill frontend instalada para Vanellope/Felix em execucao React/Next/Tailwind."
        : "Skill Frontend Design Ultimate ainda nao possui todos os recursos esperados.",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    paths: {
      openclawCatalog: OPENCLAW_CATALOG_PATH,
      openclawSqlite: OPENCLAW_SQLITE_PATH,
      agentsHealth: AGENTS_HEALTH_PATH,
      latestDelegation: LATEST_DELEGATION_PATH,
      delegationLog: DELEGATION_LOG_PATH,
      sessionsRoot: AGENTS_SESSIONS_ROOT,
      routingRules: ROUTING_RULES_PATH,
      projectMemory: PROJECT_MEMORY_ROOT,
      heartbeat: HEARTBEAT_PATH,
      obsidianVault: OBSIDIAN_VAULT_ROOT,
    },
    health,
    agents,
    sessions: {
      sourceStatus: sessionsRootHasData ? "connected" : "missing",
      recent: sessions.slice(0, 10),
    },
    delegations: latestDelegations,
    costs,
    routingRules,
    delegationRuntime,
    agentToolAccess,
    projectMemory,
    memorySearch,
    obsidianSync,
    modelHealth,
    routines,
    errors,
    sources,
  };
}
