import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BookOpenText,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DollarSign,
  ExternalLink,
  FileJson,
  GitBranch,
  RadioTower,
  Send,
  ShieldCheck,
  ShieldQuestion,
  Wrench,
  TriangleAlert,
} from "lucide-react";
import {
  type AgentHealthStatus,
  type AgentToolAccessEntry,
  type AgentToolCapability,
  type DelegationQueueItem,
  type DelegationRuntimeRoute,
  type DelegationStageStatus,
  type DelegationSmokeTestReport,
  type ExecutionStatus,
  type ManualDelegationResult,
  type MemorySearchSummary,
  type ModelHealthEntry,
  type MissionAgentEntry,
  type ObsidianAuditIssue,
  type ObsidianSyncNote,
  type ProjectMemoryEntry,
  type RoutineJobEntry,
  type SourceStatus,
  loadTianaOperationsSnapshot,
} from "@/lib/operations/tianaBoard";

export const dynamic = "force-dynamic";

const configStatusStyles: Record<string, string> = {
  OK: "border-[var(--status-running-border)] bg-[var(--status-running-bg)] text-[var(--status-running-fg)]",
  WARN: "border-[var(--status-approval-border)] bg-[var(--status-approval-bg)] text-[var(--status-approval-fg)]",
  FAIL: "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]",
};

const executionStatusStyles: Record<ExecutionStatus, string> = {
  RUNNING: "border-[var(--status-running-border)] bg-[var(--status-running-bg)] text-[var(--status-running-fg)]",
  RECENT: "border-[var(--status-approval-border)] bg-[var(--status-approval-bg)] text-[var(--status-approval-fg)]",
  ERROR: "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]",
  STALE: "border-border bg-muted text-muted-foreground",
  NO_SESSION: "border-border bg-muted text-muted-foreground",
  UNKNOWN: "border-border bg-muted text-muted-foreground",
};

const sourceStatusStyles: Record<SourceStatus, string> = {
  connected: "border-[var(--status-running-border)] bg-[var(--status-running-bg)] text-[var(--status-running-fg)]",
  missing: "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]",
  pending: "border-border bg-muted text-muted-foreground",
};

const delegationStatusStyles: Record<DelegationQueueItem["status"], string> = {
  SENT: "border-[var(--status-approval-border)] bg-[var(--status-approval-bg)] text-[var(--status-approval-fg)]",
  RESPONDED: "border-[var(--status-approval-border)] bg-[var(--status-approval-bg)] text-[var(--status-approval-fg)]",
  FAILED: "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]",
  VALIDATED: "border-[var(--status-running-border)] bg-[var(--status-running-bg)] text-[var(--status-running-fg)]",
  DELIVERED: "border-[var(--status-running-border)] bg-[var(--status-running-bg)] text-[var(--status-running-fg)]",
};

const delegationStageStyles: Record<DelegationStageStatus, string> = {
  done: "border-[var(--status-running-border)] bg-[var(--status-running-bg)] text-[var(--status-running-fg)]",
  failed: "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]",
  pending: "border-border bg-muted text-muted-foreground",
};

function formatDate(value: string | number | undefined) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function formatUsd(value: number | null | undefined) {
  if (typeof value !== "number") return "Sem custo calculado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function ConfigPill({ status }: { status: AgentHealthStatus | undefined }) {
  const label = String(status ?? "UNKNOWN").toUpperCase();
  return (
    <span className={`inline-flex min-w-20 items-center justify-center rounded-[6px] border px-2 py-1 text-xs font-semibold ${configStatusStyles[label] ?? "border-border bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

function ExecutionPill({ status }: { status: ExecutionStatus }) {
  return (
    <span className={`inline-flex min-w-24 items-center justify-center rounded-[6px] border px-2 py-1 text-xs font-semibold ${executionStatusStyles[status]}`}>
      {status}
    </span>
  );
}

function SourcePill({ status }: { status: SourceStatus }) {
  const label = status === "connected" ? "conectada" : status === "missing" ? "ausente" : "pendente";
  return (
    <span className={`inline-flex min-w-24 items-center justify-center rounded-[6px] border px-2 py-1 text-xs font-semibold ${sourceStatusStyles[status]}`}>
      {label}
    </span>
  );
}

function DelegationStatusPill({ status }: { status: DelegationQueueItem["status"] }) {
  return (
    <span className={`inline-flex min-w-24 items-center justify-center rounded-[6px] border px-2 py-1 text-xs font-semibold ${delegationStatusStyles[status]}`}>
      {status}
    </span>
  );
}

function DelegationStageMarker({ status }: { status: DelegationStageStatus }) {
  const glyph = status === "done" ? "✓" : status === "failed" ? "!" : "·";
  return (
    <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${delegationStageStyles[status]}`}>
      {glyph}
    </span>
  );
}

function AgentRow({ agent }: { agent: MissionAgentEntry }) {
  const notes = [
    agent.executionReason,
    ...(agent.issues ?? []),
    ...(agent.warnings ?? []),
  ].filter(Boolean);

  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="py-3 pl-4 pr-3 align-top">
        <div className="font-medium text-foreground">{agent.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">{agent.id}</div>
      </td>
      <td className="px-3 py-3 align-top text-sm text-muted-foreground">{agent.role}</td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-col gap-2">
          <ConfigPill status={agent.configStatus} />
          <span className="text-[11px] text-muted-foreground">configuração</span>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-col gap-2">
          <ExecutionPill status={agent.executionStatus} />
          <span className="text-[11px] text-muted-foreground">execução real</span>
        </div>
      </td>
      <td className="px-3 py-3 align-top text-xs text-muted-foreground">
        <div className="font-medium text-foreground">{agent.modelPrimary}</div>
        <div className="mt-1">{agent.modelFallbacks.length ? `Fallback: ${agent.modelFallbacks.join(" -> ")}` : "Sem fallback"}</div>
      </td>
      <td className="py-3 pl-3 pr-4 align-top text-xs text-muted-foreground">
        <div>{notes.length ? notes.join("; ") : "Sem pendencias"}</div>
        <div className="mt-1">Sessões: {agent.sessionCount}</div>
      </td>
    </tr>
  );
}

function MemorySearchCard({ memorySearch }: { memorySearch: MemorySearchSummary }) {
  return (
    <div className="rounded-[8px] border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Busca da memória</div>
          <div className="mt-1 text-sm font-semibold text-foreground">{memorySearch.mode}</div>
          <p className="mt-2 text-xs text-muted-foreground">{memorySearch.detail}</p>
        </div>
        <SourcePill status={memorySearch.sourceStatus} />
      </div>
      <dl className="mt-4 grid gap-3 text-xs md:grid-cols-4">
        <div>
          <dt className="font-medium text-foreground">Provider</dt>
          <dd className="mt-1 text-muted-foreground">{memorySearch.provider}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Fallback</dt>
          <dd className="mt-1 text-muted-foreground">{memorySearch.fallback}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Embeddings</dt>
          <dd className="mt-1 text-muted-foreground">{memorySearch.vectorEnabled ? "ativos" : "desativados"}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Pesos</dt>
          <dd className="mt-1 text-muted-foreground">
            texto {memorySearch.textWeight ?? "?"} · vetor {memorySearch.vectorWeight ?? "?"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function DelegationQueueCard({ item }: { item: DelegationQueueItem }) {
  return (
    <article className="rounded-[8px] border border-border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Pedido recebido</div>
          <h3 className="mt-1 text-sm font-semibold text-foreground">{item.task}</h3>
          <div className="mt-2 text-xs text-muted-foreground">
            {item.agentName} ({item.agentId}) · {formatDate(item.updatedAt)}
          </div>
        </div>
        <DelegationStatusPill status={item.status} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {item.stages.map((stage) => (
          <div key={stage.id} className="min-w-0">
            <div className="flex items-center gap-2">
              <DelegationStageMarker status={stage.status} />
              <div className="min-w-0 text-xs font-medium text-foreground">{stage.label}</div>
            </div>
            <div className="mt-2 line-clamp-3 text-xs text-muted-foreground">{stage.detail}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(stage.timestamp)}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

function latestDelegationTestLine(report: DelegationSmokeTestReport | null) {
  if (!report) return "Nenhum smoke test registrado ainda.";
  const failed = report.results.filter((result) => result.status !== "ok");
  const first = failed[0] ?? report.results[0];
  if (!first) return `Último teste em ${formatDate(report.generatedAt)} sem resultado detalhado.`;
  const statusText = failed.length
    ? `Falha: ${failed.map((result) => result.agentName).join(", ")}`
    : `${first.agentName}: ${first.status}`;
  return `${statusText} · ${first.reply || first.error || "sem resposta"} · ${formatDate(report.generatedAt)}`;
}

function DelegationRuntimeRouteCard({ route }: { route: DelegationRuntimeRoute }) {
  return (
    <article className="rounded-[8px] border border-border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{route.agentName}</h3>
          <div className="mt-1 text-xs text-muted-foreground">{route.routeId} · {route.agentId}</div>
        </div>
        <form action="/api/operations/agent-delegation-test" method="post">
          <input type="hidden" name="agentId" value={route.agentId} />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-[6px] border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <RadioTower size={14} aria-hidden="true" />
            Testar agente
          </button>
        </form>
      </div>
      <dl className="mt-4 grid gap-3 text-xs md:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Canal real</dt>
          <dd className="mt-1 text-muted-foreground">{route.primaryChannel}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Fallback</dt>
          <dd className="mt-1 text-muted-foreground">{route.fallbackAgentName} ({route.fallbackAgentId})</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{route.reason}</p>
      <p className="mt-2 text-xs text-muted-foreground">{route.fallbackReason}</p>
    </article>
  );
}

function ManualDelegationPanel({
  routes,
  latestManual,
  manualHistory,
}: {
  routes: DelegationRuntimeRoute[];
  latestManual: ManualDelegationResult | null;
  manualHistory: ManualDelegationResult[];
}) {
  const statusSource = (status: ManualDelegationResult["status"]): SourceStatus => (
    status === "responded" ? "connected" : status === "pending" || status === "stale" ? "pending" : "missing"
  );

  return (
    <div className="mt-4 rounded-[8px] border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Send size={16} aria-hidden="true" />
            Delegar agora
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Envio manual curto pelo canal real `sessions_send/openclaw-agent`, registrado no log append-only.
          </p>
        </div>
        <form action="/api/operations/delegate-now" method="post" className="grid w-full gap-2 lg:max-w-3xl lg:grid-cols-[180px_minmax(220px,1fr)_auto]">
          <label className="min-w-0 text-xs text-muted-foreground">
            Rota/agente
            <select
              name="routeId"
              required
              className="mt-1 h-10 w-full rounded-[6px] border border-border bg-background px-3 text-sm text-foreground"
              defaultValue={routes[0]?.routeId ?? ""}
            >
              {routes.map((route) => (
                <option key={route.routeId} value={route.routeId}>
                  {route.agentName}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-muted-foreground">
            Mensagem
            <input
              name="message"
              required
              maxLength={400}
              placeholder="RESPONDA_DELEGATE_NOW_OK"
              className="mt-1 h-10 w-full rounded-[6px] border border-border bg-background px-3 text-sm text-foreground"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-[6px] border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-accent"
          >
            <Send size={14} aria-hidden="true" />
            Enviar
          </button>
        </form>
      </div>
      <div className="mt-4 rounded-[8px] border border-border bg-card p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Histórico manual</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {latestManual ? `${latestManual.agentName} · ${latestManual.status}` : "Sem envio manual registrado"}
            </div>
          </div>
          {latestManual ? <SourcePill status={statusSource(latestManual.status)} /> : <SourcePill status="pending" />}
        </div>
        {manualHistory.length ? (
          <div className="mt-3 divide-y divide-border/70 text-xs">
            {manualHistory.slice(0, 5).map((item) => (
              <div key={item.id} className="grid gap-3 py-3 first:pt-0 last:pb-0 lg:grid-cols-[minmax(150px,0.8fr)_minmax(220px,1.2fr)_minmax(220px,1.2fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SourcePill status={statusSource(item.status)} />
                    <span className="font-medium text-foreground">{item.agentName}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {item.durationMs ? `${item.durationMs}ms` : `${item.ageMinutes ?? 0}min`} · {formatDate(item.completedAt ?? item.requestedAt)}
                  </div>
                </div>
                <div className="min-w-0 text-muted-foreground">
                  <div className="font-medium text-foreground">Mensagem</div>
                  <div className="mt-1 line-clamp-2">{item.message}</div>
                </div>
                <div className="min-w-0 text-muted-foreground">
                  <div className="font-medium text-foreground">Resposta/erro</div>
                  <div className={item.error ? "mt-1 line-clamp-2 text-[var(--status-error-fg)]" : "mt-1 line-clamp-2"}>
                    {item.reply || item.error || item.status}
                  </div>
                </div>
                <form action="/api/operations/delegate-now" method="post" className="flex justify-start lg:justify-end">
                  {item.routeId && item.routeId !== "manual" ? (
                    <input type="hidden" name="routeId" value={item.routeId} />
                  ) : (
                    <input type="hidden" name="agentId" value={item.agentId} />
                  )}
                  <input type="hidden" name="message" value={item.message} />
                  <button
                    type="submit"
                    disabled={!item.canRetry}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={13} aria-hidden="true" />
                    Tentar novamente
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">O primeiro envio via botão aparecerá aqui após a resposta ou erro bruto do agente.</p>
        )}
      </div>
    </div>
  );
}

function ToolCapabilityPill({ capability }: { capability: AgentToolCapability }) {
  return (
    <div className={`rounded-[6px] border px-2 py-2 ${sourceStatusStyles[capability.status]}`}>
      <div className="text-[11px] font-semibold">{capability.label}</div>
      <div className="mt-1 line-clamp-2 text-[11px] opacity-80">{capability.detail}</div>
    </div>
  );
}

function AgentToolAccessCard({ entry }: { entry: AgentToolAccessEntry }) {
  return (
    <article className="rounded-[8px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{entry.agentName}</h3>
          <div className="mt-1 text-xs text-muted-foreground">{entry.agentId}</div>
        </div>
        <SourcePill status={entry.sourceStatus} />
      </div>
      <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{entry.role}</div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        {entry.capabilities.map((capability) => (
          <ToolCapabilityPill key={capability.id} capability={capability} />
        ))}
      </div>
    </article>
  );
}

function ProjectMemoryCard({ project }: { project: ProjectMemoryEntry }) {
  return (
    <article className="rounded-[8px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{project.label}</h3>
          <div className="mt-1 text-xs text-muted-foreground">{project.owner} · {formatDate(project.updatedAt)}</div>
        </div>
        <SourcePill status={project.status} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{project.summary}</p>
      <dl className="mt-4 grid gap-3 text-xs md:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Foco atual</dt>
          <dd className="mt-1 text-muted-foreground">{project.currentFocus}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Próxima ação</dt>
          <dd className="mt-1 text-muted-foreground">{project.nextAction}</dd>
        </div>
      </dl>
      <code className="mt-4 block truncate rounded-[6px] bg-muted p-2 text-[11px] text-muted-foreground">{project.path}</code>
    </article>
  );
}

function RoutineJobCard({ job }: { job: RoutineJobEntry }) {
  const status = job.enabled
    ? job.lastRunStatus === "ok" || !job.lastRunStatus
      ? "connected"
      : "missing"
    : "pending";
  const delivery = [job.deliveryMode, job.deliveryChannel].filter(Boolean).join("/") || "sem entrega";

  return (
    <article className="rounded-[8px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{job.name}</h3>
          <div className="mt-1 text-xs text-muted-foreground">{job.scheduleKind}: {job.schedule} {job.timezone ? `· ${job.timezone}` : ""}</div>
        </div>
        <SourcePill status={status} />
      </div>
      <dl className="mt-4 grid gap-3 text-xs md:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Próxima execução</dt>
          <dd className="mt-1 text-muted-foreground">{formatDate(job.nextRunAtMs)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Última execução</dt>
          <dd className="mt-1 text-muted-foreground">{job.lastRunStatus ?? "sem histórico"} · {formatDate(job.lastRunAtMs)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Payload/modelo</dt>
          <dd className="mt-1 text-muted-foreground">{job.payloadKind}{job.payloadModel ? ` · ${job.payloadModel}` : ""}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Entrega/alerta</dt>
          <dd className="mt-1 text-muted-foreground">{delivery}{job.failureAlertChannel ? ` · falha: ${job.failureAlertChannel}` : ""}</dd>
        </div>
      </dl>
      {job.lastError ? <div className="mt-3 text-xs text-[var(--status-error-fg)]">{job.lastError}</div> : null}
    </article>
  );
}

function ModelHealthCard({ entry }: { entry: ModelHealthEntry }) {
  const modelList = [
    entry.primaryModel,
    ...entry.fallbackModels.map((model) => `fallback ${model}`),
  ];

  return (
    <article className="rounded-[8px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{entry.agentName}</h3>
          <div className="mt-1 text-xs text-muted-foreground">{entry.agentId}</div>
        </div>
        <ConfigPill status={entry.status} />
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{modelList.join(" · ")}</div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="font-medium text-foreground">Sessões</dt>
          <dd className="mt-1 text-muted-foreground">{formatNumber(entry.sessionCount)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Tokens</dt>
          <dd className="mt-1 text-muted-foreground">{formatNumber(entry.totalTokens)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Custo</dt>
          <dd className="mt-1 text-muted-foreground">{formatUsd(entry.estimatedCostUsd)}</dd>
        </div>
      </dl>
      <div className="mt-3 text-xs text-muted-foreground">
        Provedores: {entry.providers.length ? entry.providers.join(", ") : "sem sessões"} · modelos recentes: {entry.recentModels.length ? entry.recentModels.join(", ") : "sem histórico"}
      </div>
      {entry.cronJobs.length ? (
        <div className="mt-3 text-xs text-muted-foreground">
          Cron: {entry.cronJobs.map((job) => `${job.name}${job.model ? ` (${job.model})` : ""}`).join("; ")}
        </div>
      ) : null}
      {entry.warnings.length ? (
        <ul className="mt-3 space-y-1 text-xs text-[var(--status-approval-fg)]">
          {entry.warnings.slice(0, 3).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground">Sem alertas de modelo.</div>
      )}
      {entry.historyNotes.length ? (
        <div className="mt-3 text-xs text-muted-foreground">
          Histórico: {entry.historyNotes.slice(0, 2).join(" ")}
        </div>
      ) : null}
    </article>
  );
}

function ObsidianNoteCard({ note }: { note: ObsidianSyncNote }) {
  return (
    <article className="rounded-[8px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{note.label}</h3>
          <div className="mt-1 text-xs text-muted-foreground">{note.role}</div>
        </div>
        <SourcePill status={note.status} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{note.detail}</p>
      <div className="mt-4 flex items-center gap-2">
        <a
          href={note.obsidianUrl}
          className="inline-flex items-center gap-2 rounded-[6px] border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
        >
          <ExternalLink size={14} aria-hidden="true" />
          Abrir nota
        </a>
      </div>
      <code className="mt-3 block truncate rounded-[6px] bg-muted p-2 text-[11px] text-muted-foreground">{note.path}</code>
    </article>
  );
}

function ObsidianIssueRow({ issue }: { issue: ObsidianAuditIssue }) {
  const status = issue.severity === "error" ? "missing" : issue.severity === "warning" ? "pending" : "connected";

  return (
    <div className="rounded-[8px] border border-border bg-muted/30 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{issue.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{issue.detail}</div>
        </div>
        <SourcePill status={status} />
      </div>
      {issue.path ? <code className="mt-3 block truncate rounded-[6px] bg-background p-2 text-[11px] text-muted-foreground">{issue.path}</code> : null}
      {issue.obsidianUrl ? (
        <a
          href={issue.obsidianUrl}
          className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-foreground hover:text-muted-foreground"
        >
          <ExternalLink size={14} aria-hidden="true" />
          Abrir no Obsidian
        </a>
      ) : null}
    </div>
  );
}

export default async function TianaOperationsPage() {
  const snapshot = await loadTianaOperationsSnapshot();
  const configOkCount = snapshot.agents.filter((agent) => String(agent.configStatus).toUpperCase() === "OK").length;
  const runningCount = snapshot.agents.filter((agent) => agent.executionStatus === "RUNNING").length;
  const blockedCount = snapshot.agents.filter((agent) => agent.executionStatus === "ERROR" || agent.executionStatus === "NO_SESSION").length;
  const latest = snapshot.delegations.latest;

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <Link
              href="/office"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar ao escritorio
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-foreground md:text-3xl">
              Escobar OS Mission Control
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Painel operacional da Tiana com configuração, execução real, delegações, sessões, modelos, custos e regras de roteamento.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-[8px] border border-border bg-card px-3 py-2">
              <div className="text-xs text-muted-foreground">Config OK</div>
              <div className="text-xl font-semibold">{configOkCount}</div>
            </div>
            <div className="rounded-[8px] border border-border bg-card px-3 py-2">
              <div className="text-xs text-muted-foreground">Rodando</div>
              <div className="text-xl font-semibold">{runningCount}</div>
            </div>
            <div className="rounded-[8px] border border-border bg-card px-3 py-2">
              <div className="text-xs text-muted-foreground">Sem execução</div>
              <div className="text-xl font-semibold">{blockedCount}</div>
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Áreas do Mission Control">
          {[
            ["#agentes", "Agentes"],
            ["#delegacoes", "Delegações"],
            ["#delegacao-real", "Delegação real"],
            ["#ferramentas", "Ferramentas"],
            ["#memoria", "Memória"],
            ["#obsidian", "Obsidian"],
            ["#sessoes", "Sessões"],
            ["#rotinas", "Rotinas"],
            ["#custos", "Custos/modelos"],
            ["#modelos", "Saúde modelos"],
            ["#regras", "Regras"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-[6px] border border-border bg-card px-3 py-2 text-muted-foreground hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div id="agentes" className="rounded-[8px] border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bot size={18} aria-hidden="true" />
                  Agentes: configuração x execução
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Verde em configuração só confirma cadastro/healthcheck. Verde em execução exige sessão `running`.
                </div>
              </div>
              <div className="flex gap-2">
                <ConfigPill status={snapshot.health?.overall} />
                <SourcePill status={snapshot.sessions.sourceStatus} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-3 pl-4 pr-3 font-semibold">Agente</th>
                    <th className="px-3 py-3 font-semibold">Função</th>
                    <th className="px-3 py-3 font-semibold">Config</th>
                    <th className="px-3 py-3 font-semibold">Execução</th>
                    <th className="px-3 py-3 font-semibold">Modelo</th>
                    <th className="py-3 pl-3 pr-4 font-semibold">Sinal operacional</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {snapshot.agents.map((agent) => (
                    <AgentRow key={agent.id} agent={agent} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <section id="delegacoes" className="rounded-[8px] border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Activity size={18} aria-hidden="true" />
                  Última delegação
                </div>
                <SourcePill status={snapshot.delegations.sourceStatus} />
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Agente</dt>
                  <dd className="font-medium">{latest?.agentName ?? "Sem agente"} ({latest?.agentId ?? "sem-id"})</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Tarefa</dt>
                  <dd>{latest?.task ?? "Sem tarefa registrada"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Decisão</dt>
                  <dd>{latest?.decision ?? "Sem decisão"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Criado em</dt>
                  <dd>{formatDate(latest?.createdAt ?? latest?.timestamp)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-[8px] border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileJson size={18} aria-hidden="true" />
                Fontes reais
              </div>
              <div className="mt-4 space-y-3 text-xs text-muted-foreground">
                {snapshot.sources.map((source) => (
                  <div key={source.label} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-foreground">{source.label}</div>
                      <SourcePill status={source.status} />
                    </div>
                    <div className="mt-1">{source.detail}</div>
                    {source.path ? <code className="mt-2 block break-all rounded-[6px] bg-muted p-2">{source.path}</code> : null}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>

        <section className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <GitBranch size={18} aria-hidden="true" />
                Fila obrigatória de delegação
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Ciclo esperado: pedido recebido, agente responsável, status do agente, validação da Tiana e entrega consolidada.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{snapshot.delegations.queue.length} ciclos recentes</span>
          </div>
          <div className="mt-4 grid gap-3">
            {snapshot.delegations.queue.length ? snapshot.delegations.queue.map((item) => (
              <DelegationQueueCard key={item.id} item={item} />
            )) : (
              <div className="rounded-[8px] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Sem fila conectada. O painel nao marca delegacao como concluida sem eventos reais no log estruturado.
              </div>
            )}
          </div>
        </section>

        <section id="delegacao-real" className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={18} aria-hidden="true" />
                Delegação real x fallback
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Separa agente executando de verdade, spawn limpo bloqueado pelo runtime e exceção controlada da Tiana.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <SourcePill status={snapshot.delegationRuntime.sourceStatus} />
              <span>{snapshot.delegationRuntime.configuredAgentCount} especialistas</span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[8px] border border-border bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Canal operacional</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{snapshot.delegationRuntime.preferredChannel}</div>
              <p className="mt-2 text-xs text-muted-foreground">{snapshot.delegationRuntime.detail}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Spawn limpo</div>
              <div className="mt-1 flex items-center gap-2">
                <SourcePill status={snapshot.delegationRuntime.cleanSpawnStatus} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{snapshot.delegationRuntime.cleanSpawnDetail}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-muted/30 p-4">
              <div className="text-xs text-muted-foreground">Teste noturno leve</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <SourcePill status={snapshot.delegationRuntime.latestTestStatus} />
                <span className="text-sm font-semibold text-foreground">{snapshot.delegationRuntime.latestTestDetail}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{latestDelegationTestLine(snapshot.delegationRuntime.latestTest)}</p>
              {snapshot.delegationRuntime.latestTest?.modelPolicy ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{snapshot.delegationRuntime.latestTest.modelPolicy}</p>
              ) : null}
            </div>
          </div>
          <ManualDelegationPanel
            routes={snapshot.delegationRuntime.routes}
            latestManual={snapshot.delegationRuntime.latestManual}
            manualHistory={snapshot.delegationRuntime.manualHistory}
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {snapshot.delegationRuntime.routes.map((route) => (
              <DelegationRuntimeRouteCard key={route.routeId} route={route} />
            ))}
          </div>
        </section>

        <section id="ferramentas" className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wrench size={18} aria-hidden="true" />
                Permissões e ferramentas por agente
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Mapa declarativo do que cada agente tem confirmado por catálogo, pasta local, cron, skills e Vault. Permissão não declarada fica pendente.
              </p>
            </div>
            <SourcePill status={snapshot.agentToolAccess.sourceStatus} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{snapshot.agentToolAccess.detail}</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {snapshot.agentToolAccess.entries.map((entry) => (
              <AgentToolAccessCard key={entry.agentId} entry={entry} />
            ))}
          </div>
        </section>

        <section id="obsidian" className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BookOpenText size={18} aria-hidden="true" />
                Obsidian Sync e auditoria operacional
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Verifica se entregas, agentes e políticas do OpenClaw estão espelhadas no Vault oficial sem resíduos em áreas ativas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <SourcePill status={snapshot.obsidianSync.sourceStatus} />
              <span>{snapshot.obsidianSync.errorCount} erros</span>
              <span>{snapshot.obsidianSync.warningCount} avisos</span>
            </div>
          </div>
          <div className="mt-4 rounded-[8px] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {snapshot.obsidianSync.detail}
            <code className="mt-3 block truncate rounded-[6px] bg-background p-2 text-[11px]">{snapshot.obsidianSync.vaultRoot}</code>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {snapshot.obsidianSync.notes.map((note) => (
              <ObsidianNoteCard key={note.id} note={note} />
            ))}
          </div>
          <div className="mt-4 rounded-[8px] border border-border bg-card p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Política Claude controlada</div>
                <div className="mt-1 text-xs text-muted-foreground">{snapshot.obsidianSync.claudePolicy.detail}</div>
              </div>
              <SourcePill status={snapshot.obsidianSync.claudePolicy.status} />
            </div>
            <dl className="mt-4 grid gap-3 text-xs md:grid-cols-3">
              <div>
                <dt className="font-medium text-foreground">Principal</dt>
                <dd className="mt-1 text-muted-foreground">{snapshot.obsidianSync.claudePolicy.primary}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Fallback automático</dt>
                <dd className="mt-1 text-muted-foreground">{snapshot.obsidianSync.claudePolicy.fallback}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Claude disponível</dt>
                <dd className="mt-1 text-muted-foreground">
                  {snapshot.obsidianSync.claudePolicy.manualModels.length
                    ? snapshot.obsidianSync.claudePolicy.manualModels.join(", ")
                    : "sem modelo Claude configurado"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="mt-4">
            {snapshot.obsidianSync.issues.length ? (
              <div className="grid gap-3">
                {snapshot.obsidianSync.issues.map((issue) => (
                  <ObsidianIssueRow key={issue.id} issue={issue} />
                ))}
              </div>
            ) : (
              <div className="rounded-[8px] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Nenhum resíduo operacional ativo encontrado. Legado e changelog histórico ficam fora do alerta.
              </div>
            )}
          </div>
        </section>

        <section id="memoria" className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BookOpenText size={18} aria-hidden="true" />
                Memória operacional por projeto
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Contexto separado por área para reduzir mistura entre Tenis e Cia, EM, OpenClaw, Mission Control e agentes.
              </p>
            </div>
            <SourcePill status={snapshot.projectMemory.sourceStatus} />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <MemorySearchCard memorySearch={snapshot.memorySearch} />
            {snapshot.projectMemory.projects.length ? snapshot.projectMemory.projects.map((project) => (
              <ProjectMemoryCard key={project.id} project={project} />
            )) : (
              <div className="rounded-[8px] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Sem arquivos em {snapshot.projectMemory.root}. O painel nao mistura memorias gerais quando a fonte por projeto esta ausente.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[8px] border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div id="sessoes" className="flex items-center gap-2 text-sm font-semibold">
                <RadioTower size={18} aria-hidden="true" />
                Sessões recentes
              </div>
              <SourcePill status={snapshot.sessions.sourceStatus} />
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {snapshot.sessions.recent.length ? snapshot.sessions.recent.map((session) => (
                <div key={`${session.agentId}:${session.key}`} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{session.agentId}</div>
                    <span className="text-xs text-muted-foreground">{session.status ?? "sem status explícito"}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {session.key} · {session.modelProvider ?? "provider?"}/{session.model ?? "modelo?"} · {formatDate(session.updatedAt)}
                  </div>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground">Sem sessões locais conectadas.</div>
              )}
            </div>
          </section>

          <section className="rounded-[8px] border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <GitBranch size={18} aria-hidden="true" />
                Histórico curto de delegações
              </div>
              <span className="text-xs text-muted-foreground">{snapshot.delegations.recent.length} eventos</span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {snapshot.delegations.recent.map((entry) => (
                <div key={entry.id ?? `${entry.event}:${entry.createdAt}:${entry.task}`} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{entry.agentName ?? entry.agentId ?? "Sem agente"}</div>
                    <span className="rounded-[6px] border border-border px-2 py-1 text-xs text-muted-foreground">{entry.event ?? "sem-evento"}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{entry.task ?? "Sem tarefa"} · {formatDate(entry.createdAt ?? entry.timestamp)}</div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <section id="rotinas" className="rounded-[8px] border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock size={18} aria-hidden="true" />
                Rotinas e cron
              </div>
              <SourcePill status={snapshot.routines.sourceStatus} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{snapshot.routines.detail}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Scheduler</div>
                <div className="text-lg font-semibold">{snapshot.routines.schedulerEnabled ? "Ativo" : "Sem leitura"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Heartbeat</div>
                <div className="text-lg font-semibold">{snapshot.routines.heartbeatStatus === "connected" ? "Com tarefas" : "Sem tarefas"}</div>
              </div>
            </div>
          </section>

          <section id="custos" className="rounded-[8px] border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <DollarSign size={18} aria-hidden="true" />
                Custos e modelos
              </div>
              <SourcePill status={snapshot.costs.sourceStatus} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Sessões</div>
                <div className="text-lg font-semibold">{formatNumber(snapshot.costs.totalSessions)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Tokens</div>
                <div className="text-lg font-semibold">{formatNumber(snapshot.costs.totalTokens)}</div>
              </div>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">Custo estimado: {formatUsd(snapshot.costs.estimatedCostUsd)}</div>
          </section>

          <section id="regras" className="rounded-[8px] border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={18} aria-hidden="true" />
                Regras de roteamento
              </div>
              <SourcePill status={snapshot.routingRules.sourceStatus} />
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              {snapshot.routingRules.routes.length} rotas carregadas do delegation gate.
            </div>
            <div className="mt-3 max-h-40 space-y-2 overflow-auto text-xs text-muted-foreground">
              {snapshot.routingRules.routes.map((route) => (
                <div key={route.id} className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                  <span>{route.id}</span>
                  <span>{route.specialistAgentId}</span>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section id="modelos" className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <DollarSign size={18} aria-hidden="true" />
                Consumo e saúde dos modelos por agente
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cruza catálogo, sessões, custos e cron para destacar erro recente, consumo e resíduos de modelo fora do padrão.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{snapshot.modelHealth.totalAgents} agentes</span>
              <span>{snapshot.modelHealth.warningCount} avisos</span>
              <span>{snapshot.modelHealth.errorCount} erros</span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {snapshot.modelHealth.entries.map((entry) => (
              <ModelHealthCard key={entry.agentId} entry={entry} />
            ))}
          </div>
        </section>

        <section className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock size={18} aria-hidden="true" />
                Rotinas reais do OpenClaw cron
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Lidas direto do SQLite local do OpenClaw; jobs sem histórico não são tratados como sucesso.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{snapshot.routines.jobs.length} rotinas carregadas</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {snapshot.routines.jobs.length ? snapshot.routines.jobs.map((job) => (
              <RoutineJobCard key={job.id} job={job} />
            )) : (
              <div className="rounded-[8px] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Nenhuma rotina encontrada em {snapshot.routines.sqlitePath}.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {snapshot.errors.length ? <TriangleAlert size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
            Leitura local
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {snapshot.errors.length ? snapshot.errors.join("; ") : "Fontes principais lidas. Campos sem fonte real permanecem como pendente/ausente."}
            <span className="inline-flex items-center gap-1 text-xs">
              <Clock3 size={14} aria-hidden="true" />
              Atualizado em {formatDate(snapshot.generatedAt)}
            </span>
          </div>
          {!snapshot.errors.length ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldQuestion size={14} aria-hidden="true" />
              Regra visual: verde em execução significa `running`; histórico ou configuração OK não viram disponibilidade real.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
