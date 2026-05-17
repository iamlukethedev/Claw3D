"use client";

import { useMemo, useState } from "react";

import { T, useTranslation } from '@/lib/i18n/TranslationProvider';

import { AgentSkillsSetupModal } from "@/features/agents/components/AgentSkillsSetupModal";
import {
  buildSkillMissingDetails,
  deriveSkillReadinessState,
  type SkillReadinessState,
} from "@/lib/skills/presentation";
import type { SkillStatusReport } from "@/lib/skills/types";

type SkillSetupMessage = { kind: "success" | "error"; message: string };

type ReadinessFilter = "all" | SkillReadinessState;

type SystemSkillsPanelProps = {
  skillsReport?: SkillStatusReport | null;
  skillsLoading?: boolean;
  skillsError?: string | null;
  skillsBusy?: boolean;
  skillsBusyKey?: string | null;
  skillMessages?: Record<string, SkillSetupMessage>;
  skillApiKeyDrafts?: Record<string, string>;
  defaultAgentScopeWarning?: string | null;
  initialSkillKey?: string | null;
  onInitialSkillKeyHandled?: () => void;
  onSetSkillGlobalEnabled: (skillKey: string, enabled: boolean) => Promise<void> | void;
  onInstallSkill: (skillKey: string, name: string, installId: string) => Promise<void> | void;
  onRemoveSkill: (
    skill: { skillKey: string; source: string; baseDir: string }
  ) => Promise<void> | void;
  onSkillApiKeyChange: (skillKey: string, value: string) => Promise<void> | void;
  onSaveSkillApiKey: (skillKey: string) => Promise<void> | void;
};

const READINESS_CLASSES = {
  ready: "ui-badge-status-running",
  "needs-setup": "ui-badge-status-error",
  unavailable: "ui-badge-status-error",
  "disabled-globally": "ui-badge-status-error",
} as const;

const resolveReadinessHint = (
  skill: SkillStatusReport["skills"][number],
  readiness: SkillReadinessState,
  t: (key: string, fallback: string) => string
): string | null => {
  if (readiness === "ready") {
    return null;
  }
  if (readiness === "disabled-globally") {
    return t('skills.hint_disabled', '已全域停用。請在系統設定中啟用。');
  }
  if (readiness === "unavailable") {
    if (skill.blockedByAllowlist) {
      return t('skills.hint_bundled', '受捆綁技能政策限制。');
    }
    return buildSkillMissingDetails(skill)[0] ?? t('skills.hint_unavailable', '此系統無法使用。');
  }
  return buildSkillMissingDetails(skill)[0] ?? t('skills.hint_setup_required', '需要在系統設定中設定。');
};

export const SystemSkillsPanel = ({
  skillsReport = null,
  skillsLoading = false,
  skillsError = null,
  skillsBusy = false,
  skillsBusyKey = null,
  skillMessages = {},
  skillApiKeyDrafts = {},
  defaultAgentScopeWarning = null,
  initialSkillKey = null,
  onInitialSkillKeyHandled,
  onSetSkillGlobalEnabled,
  onInstallSkill,
  onRemoveSkill,
  onSkillApiKeyChange,
  onSaveSkillApiKey,
}: SystemSkillsPanelProps) => {
  const { t } = useTranslation();

  const READINESS_FILTERS: Array<{ id: ReadinessFilter; label: string }> = [
    { id: "all", label: t('skills.filter_all', '全部') },
    { id: "ready", label: t('skills.filter_ready', '就緒') },
    { id: "needs-setup", label: t('skills.filter_setup_required', '需要設定') },
    { id: "disabled-globally", label: t('skills.filter_disabled', '已全域停用') },
  ];

  const READINESS_LABELS = {
    ready: t('skills.label_ready', '就緒'),
    "needs-setup": t('skills.label_needs_setup', '需要設定'),
    unavailable: t('skills.label_unavailable', '無法使用'),
    "disabled-globally": t('skills.label_disabled', '已全域停用'),
  } as const;

  const [skillsFilter, setSkillsFilter] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [setupSkillKey, setSetupSkillKey] = useState<string | null>(null);

  const skillEntries = useMemo(() => skillsReport?.skills ?? [], [skillsReport]);
  const anySkillBusy = skillsBusy || Boolean(skillsBusyKey);
  const requestedInitialSkillKey = useMemo(() => {
    const candidate = initialSkillKey?.trim() ?? "";
    if (!candidate) {
      return null;
    }
    return skillEntries.some((entry) => entry.skillKey === candidate) ? candidate : null;
  }, [initialSkillKey, skillEntries]);

  const rows = useMemo(
    () =>
      skillEntries.map((skill) => ({
        skill,
        readiness: deriveSkillReadinessState(skill),
      })),
    [skillEntries]
  );

  const searchedRows = useMemo(() => {
    const query = skillsFilter.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((entry) =>
      [entry.skill.name, entry.skill.description, entry.skill.source, entry.skill.skillKey]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [rows, skillsFilter]);

  const filteredRows = useMemo(() => {
    if (readinessFilter === "all") {
      return searchedRows;
    }
    return searchedRows.filter((entry) => entry.readiness === readinessFilter);
  }, [readinessFilter, searchedRows]);

  const readinessCounts = useMemo(
    () =>
      searchedRows.reduce(
        (counts, entry) => {
          counts.all += 1;
          counts[entry.readiness] += 1;
          return counts;
        },
        {
          all: 0,
          ready: 0,
          "needs-setup": 0,
          unavailable: 0,
          "disabled-globally": 0,
        } satisfies Record<ReadinessFilter, number>
      ),
    [searchedRows]
  );

  const setupQueue = useMemo(
    () =>
      rows.filter(
        (entry) => entry.readiness === "needs-setup" || entry.readiness === "disabled-globally"
      ),
    [rows]
  );

  const selectedSkillKey = setupSkillKey ?? requestedInitialSkillKey;
  const selectedSetupSkill = selectedSkillKey
    ? skillEntries.find((entry) => entry.skillKey === selectedSkillKey) ?? null
    : null;

  return (
    <section className="sidebar-section" data-testid="agent-settings-system-skills">
      <div className="flex items-center justify-between gap-3">
        <h3 className="sidebar-section-title"><T id="system_skills.title" fallback="系統技能設定" /></h3>
        <div className="font-mono text-[10px] text-muted-foreground">{skillEntries.length}</div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        <T id="system_skills.desc" fallback="此處的變更將影響此閘道器上的所有 Agent。" />
      </div>
      {defaultAgentScopeWarning ? (
        <div className="mt-3 rounded-md border border-border/60 bg-surface-1/65 px-3 py-2 text-[10px] text-muted-foreground/82">
          {defaultAgentScopeWarning}
        </div>
      ) : null}
      {setupQueue.length > 0 ? (
        <div className="mt-3 rounded-md border border-border/60 bg-surface-1/65 px-3 py-3">
          <div className="text-[10px] font-semibold text-foreground/85">{t('skills.setup_queue', '需要設定（%{n}）').replace('%{n}', String(setupQueue.length))}</div>
          <div className="mt-2 flex flex-col gap-2">
            {setupQueue.slice(0, 5).map((entry) => (
              <div
                key={`setup-queue:${entry.skill.skillKey}`}
                className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground/85"
              >
                <span className="truncate">{entry.skill.name}</span>
                <button
                  type="button"
                  className="ui-btn-secondary px-2 py-1 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-65"
                  disabled={anySkillBusy}
                  onClick={() => {
                    onInitialSkillKeyHandled?.();
                    setSetupSkillKey(entry.skill.skillKey);
                  }}
                >
                  {t('skills.setup_button', '設定')}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-3">
        <input
          value={skillsFilter}
          onChange={(event) => setSkillsFilter(event.target.value)}
          placeholder={t('skills.search_placeholder', '搜尋技能')}
          className="w-full rounded-md border border-border/60 bg-surface-1 px-3 py-2 text-[11px] text-foreground outline-none transition focus:border-border"
          aria-label={t('skills.search_placeholder', '搜尋技能')}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {READINESS_FILTERS.map((filter) => {
          const selected = readinessFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              className="ui-btn-secondary px-2 py-1 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-65"
              data-active={selected ? "true" : "false"}
              disabled={skillsLoading}
              onClick={() => {
                setReadinessFilter(filter.id);
              }}
            >
              {filter.label} ({readinessCounts[filter.id]})
            </button>
          );
        })}
      </div>
      {skillsLoading ? <div className="mt-3 text-[11px] text-muted-foreground"><T id="skills.loading" fallback="載入技能中…" /></div> : null}
      {!skillsLoading && skillsError ? (
        <div className="ui-alert-danger mt-3 rounded-md px-3 py-2 text-xs">{skillsError}</div>
      ) : null}
      {!skillsLoading && !skillsError && filteredRows.length === 0 ? (
        <div className="mt-3 text-[11px] text-muted-foreground"><T id="skills.empty" fallback="找不到符合的技能。" /></div>
      ) : null}
      {!skillsLoading && !skillsError && filteredRows.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {filteredRows.map((entry) => {
            const readinessLabel = READINESS_LABELS[entry.readiness];
            const readinessClassName = READINESS_CLASSES[entry.readiness];
            const message = skillMessages[entry.skill.skillKey] ?? null;
            return (
              <div
                key={`${entry.skill.source}:${entry.skill.skillKey}`}
                className="ui-settings-row flex min-h-[68px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[11px] font-medium text-foreground/88">{entry.skill.name}</span>
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                      {entry.skill.source}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${readinessClassName}`}
                    >
                      {readinessLabel}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground/70">{entry.skill.description}</div>
                  {entry.readiness !== "ready" ? (
                    <div className="mt-1 text-[10px] text-muted-foreground/80">
                      {resolveReadinessHint(entry.skill, entry.readiness, t)}
                    </div>
                  ) : null}
                  {message ? (
                    <div
                      className={`mt-1 text-[10px] ${message.kind === "error" ? "ui-text-danger" : "ui-text-success"}`}
                    >
                      {message.message}
                    </div>
                  ) : null}
                </div>
                <div className="flex w-full items-center justify-end gap-2 sm:w-[210px]">
                  <button
                    type="button"
                    className="ui-btn-secondary px-2 py-1 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-65"
                    disabled={anySkillBusy}
                    onClick={() => {
                      onInitialSkillKeyHandled?.();
                      setSetupSkillKey(entry.skill.skillKey);
                    }}
                  >
                    {t('common.configure', '設定')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      <AgentSkillsSetupModal
        skill={selectedSetupSkill}
        skillsBusy={skillsBusy}
        skillsBusyKey={skillsBusyKey}
        skillMessage={selectedSetupSkill ? skillMessages[selectedSetupSkill.skillKey] ?? null : null}
        apiKeyDraft={selectedSetupSkill ? skillApiKeyDrafts[selectedSetupSkill.skillKey] ?? "" : ""}
        defaultAgentScopeWarning={defaultAgentScopeWarning}
        onClose={() => {
          onInitialSkillKeyHandled?.();
          setSetupSkillKey(null);
        }}
        onInstallSkill={onInstallSkill}
        onSetSkillGlobalEnabled={onSetSkillGlobalEnabled}
        onRemoveSkill={onRemoveSkill}
        onSkillApiKeyChange={onSkillApiKeyChange}
        onSaveSkillApiKey={onSaveSkillApiKey}
      />
    </section>
  );
};
