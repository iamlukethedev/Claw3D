"use client";

import { useMemo, useState } from "react";

import { T, useTranslation } from '@/lib/i18n/TranslationProvider';

import type { SkillStatusReport } from "@/lib/skills/types";
import {
  buildAgentSkillsAllowlistSet,
  buildSkillMissingDetails,
  deriveAgentSkillDisplayState,
  deriveAgentSkillsAccessMode,
  deriveSkillReadinessState,
  type AgentSkillDisplayState,
} from "@/lib/skills/presentation";

type SkillRowFilter = "all" | AgentSkillDisplayState;

type AgentSkillsPanelProps = {
  skillsReport?: SkillStatusReport | null;
  skillsLoading?: boolean;
  skillsError?: string | null;
  skillsBusy?: boolean;
  skillsBusyKey?: string | null;
  skillsAllowlist?: string[] | undefined;
  onSetSkillEnabled: (skillName: string, enabled: boolean) => Promise<void> | void;
  onOpenSystemSetup: (skillKey?: string) => void;
};

const DISPLAY_CLASSES: Record<AgentSkillDisplayState, string> = {
  ready: "ui-badge-status-running",
  "setup-required": "ui-badge-status-error",
  "not-supported": "ui-badge-status-error",
};

const resolveHint = (
  skill: SkillStatusReport["skills"][number],
  displayState: AgentSkillDisplayState,
  t: (key: string, fallback: string) => string
): string | null => {
  if (displayState === "ready") {
    return null;
  }
  if (displayState === "not-supported") {
    if (skill.blockedByAllowlist) {
      return t('skills.hint_bundled', '受捆綁技能政策限制。');
    }
    return buildSkillMissingDetails(skill).find((line) => line.startsWith("Requires OS:")) ?? t('skills.hint_not_supported', '不支援。');
  }
  const readiness = deriveSkillReadinessState(skill);
  if (readiness === "disabled-globally") {
    return t('skills.hint_disabled', '已全域停用。請在系統設定中啟用。');
  }
  return buildSkillMissingDetails(skill)[0] ?? t('skills.hint_setup_required', '需要在系統設定中設定。');
};

export const AgentSkillsPanel = ({
  skillsReport = null,
  skillsLoading = false,
  skillsError = null,
  skillsBusy = false,
  skillsBusyKey = null,
  skillsAllowlist,
  onSetSkillEnabled,
  onOpenSystemSetup,
}: AgentSkillsPanelProps) => {
  const { t } = useTranslation();

  const FILTERS: Array<{ id: SkillRowFilter; label: string }> = [
    { id: "all", label: t('skills.filter_all', '全部') },
    { id: "ready", label: t('skills.filter_ready', '就緒') },
    { id: "setup-required", label: t('skills.filter_setup_required', '需要設定') },
    { id: "not-supported", label: t('skills.filter_not_supported', '不支援') },
  ];

  const DISPLAY_LABELS: Record<AgentSkillDisplayState, string> = {
    ready: t('skills.label_ready', '就緒'),
    "setup-required": t('skills.label_setup_required', '需要設定'),
    "not-supported": t('skills.label_not_supported', '不支援'),
  };

  const [skillsFilter, setSkillsFilter] = useState("");
  const [rowFilter, setRowFilter] = useState<SkillRowFilter>("all");

  const skillEntries = useMemo(() => skillsReport?.skills ?? [], [skillsReport]);
  const accessMode = deriveAgentSkillsAccessMode(skillsAllowlist);
  const allowlistSet = useMemo(() => buildAgentSkillsAllowlistSet(skillsAllowlist), [skillsAllowlist]);
  const anySkillBusy = skillsBusy || Boolean(skillsBusyKey);

  const rows = useMemo(() => {
    return skillEntries.map((skill) => {
      const normalizedName = skill.name.trim();
      const allowed =
        accessMode === "all" ? true : accessMode === "none" ? false : allowlistSet.has(normalizedName);
      const readiness = deriveSkillReadinessState(skill);
      return {
        skill,
        allowed,
        displayState: deriveAgentSkillDisplayState(readiness),
      };
    });
  }, [accessMode, allowlistSet, skillEntries]);

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
    if (rowFilter === "all") {
      return searchedRows;
    }
    return searchedRows.filter((entry) => entry.displayState === rowFilter);
  }, [rowFilter, searchedRows]);

  const filterCounts = useMemo(
    () =>
      searchedRows.reduce(
        (counts, entry) => {
          counts.all += 1;
          counts[entry.displayState] += 1;
          return counts;
        },
        {
          all: 0,
          ready: 0,
          "setup-required": 0,
          "not-supported": 0,
        } satisfies Record<SkillRowFilter, number>
      ),
    [searchedRows]
  );

  const enabledCount = useMemo(
    () => rows.reduce((count, entry) => count + (entry.allowed ? 1 : 0), 0),
    [rows]
  );

  return (
    <section className="sidebar-section" data-testid="agent-settings-skills">
      <div className="flex items-center justify-between gap-3">
        <h3 className="sidebar-section-title"><T id="skills.section_title" fallback="技能" /></h3>
        <div className="font-mono text-[10px] text-muted-foreground">
          {enabledCount}/{skillEntries.length}
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground"><T id="skills.section_desc" fallback="技能存取控制適用於此 Agent。" /></div>
      {accessMode === "selected" ? (
        <div className="mt-2 text-[10px] text-muted-foreground/80">
          <T id="skills.using_selected" fallback="此 Agent 僅使用選定的技能。" />
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
        {FILTERS.map((filter) => {
          const selected = rowFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              className="ui-btn-secondary px-2 py-1 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-65"
              data-active={selected ? "true" : "false"}
              disabled={skillsLoading}
              onClick={() => {
                setRowFilter(filter.id);
              }}
            >
              {filter.label} ({filterCounts[filter.id]})
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
            const statusLabel = DISPLAY_LABELS[entry.displayState];
            const statusClassName = DISPLAY_CLASSES[entry.displayState];
            const canConfigureInSystem = entry.displayState === "setup-required";
            const switchDisabled = anySkillBusy || entry.displayState === "not-supported";
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
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${statusClassName}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground/70">{entry.skill.description}</div>
                  {entry.displayState !== "ready" ? (
                    <div className="mt-1 text-[10px] text-muted-foreground/80">
                      {resolveHint(entry.skill, entry.displayState, t)}
                    </div>
                  ) : null}
                </div>
                <div className="flex w-full items-center justify-between gap-2 sm:w-[240px] sm:justify-end">
                  <button
                    type="button"
                    role="switch"
                    aria-label={`Skill ${entry.skill.name}`}
                    aria-checked={entry.allowed}
                    className={`ui-switch self-start ${entry.allowed ? "ui-switch--on" : ""}`}
                    disabled={switchDisabled}
                    onClick={() => {
                      void onSetSkillEnabled(entry.skill.name, !entry.allowed);
                    }}
                  >
                    <span className="ui-switch-thumb" />
                  </button>
                  {canConfigureInSystem ? (
                    <button
                      type="button"
                      className="ui-btn-secondary px-2 py-1 text-[9px] font-semibold"
                      onClick={() => {
                        onOpenSystemSetup(entry.skill.skillKey);
                      }}
                    >
                      {t('skills.open_system_setup', '開啟系統設定')}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};
