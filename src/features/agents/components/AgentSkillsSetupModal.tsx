"use client";

import { useEffect } from "react";

import type { SkillStatusEntry } from "@/lib/skills/types";
import {
  buildSkillMissingDetails,
  canRemoveSkill,
  deriveSkillReadinessState,
  resolvePreferredInstallOption,
} from "@/lib/skills/presentation";

type SkillSetupMessage = { kind: "success" | "error"; message: string };

type AgentSkillsSetupModalProps = {
  skill: SkillStatusEntry | null;
  skillsBusy: boolean;
  skillsBusyKey: string | null;
  skillMessage: SkillSetupMessage | null;
  apiKeyDraft: string;
  defaultAgentScopeWarning?: string | null;
  onClose: () => void;
  onInstallSkill: (skillKey: string, name: string, installId: string) => Promise<void> | void;
  onSetSkillGlobalEnabled: (skillKey: string, enabled: boolean) => Promise<void> | void;
  onRemoveSkill: (
    skill: { skillKey: string; source: string; baseDir: string }
  ) => Promise<void> | void;
  onSkillApiKeyChange: (skillKey: string, value: string) => Promise<void> | void;
  onSaveSkillApiKey: (skillKey: string) => Promise<void> | void;
};

const READINESS_LABELS = {
  ready: "Ready",
  "needs-setup": "Needs setup",
  unavailable: "Unavailable",
  "disabled-globally": "Disabled globally",
} as const;

const READINESS_CLASSES = {
  ready: "ui-badge-status-running",
  "needs-setup": "ui-badge-status-error",
  unavailable: "ui-badge-status-error",
  "disabled-globally": "ui-badge-status-error",
} as const;

export const AgentSkillsSetupModal = ({
  skill,
  skillsBusy,
  skillsBusyKey,
  skillMessage,
  apiKeyDraft,
  defaultAgentScopeWarning = null,
  onClose,
  onInstallSkill,
  onSetSkillGlobalEnabled,
  onRemoveSkill,
  onSkillApiKeyChange,
  onSaveSkillApiKey,
}: AgentSkillsSetupModalProps) => {
  useEffect(() => {
    if (!skill) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, skill]);

  if (!skill) {
    return null;
  }

  const readiness = deriveSkillReadinessState(skill);
  const readinessLabel = READINESS_LABELS[readiness];
  const readinessClassName = READINESS_CLASSES[readiness];
  const missingDetails = buildSkillMissingDetails(skill);
  const installOption = resolvePreferredInstallOption(skill);
  const canDeleteSkill = canRemoveSkill(skill);
  const busyForSkill = skillsBusyKey === skill.skillKey;
  const anySkillBusy = skillsBusy || Boolean(skillsBusyKey);
  const trimmedApiKey = apiKeyDraft.trim();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Setup ${skill.name}`}
      onClick={onClose}
    >
      <div
        className="ui-panel w-full max-w-2xl bg-card shadow-xs"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-5">
          <div className="min-w-0">
            <div className="text-[11px] font-medium tracking-[0.01em] text-muted-foreground/80">
              System setup
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-foreground">{skill.name}</span>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${readinessClassName}`}
              >
                {readinessLabel}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground/80">
              Changes affect all agents on this gateway.
            </div>
          </div>
          <button
            type="button"
            className="sidebar-btn-ghost px-3 font-mono text-[10px] font-semibold tracking-[0.06em]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="space-y-3 px-6 pb-3 text-[11px] text-muted-foreground">
          {defaultAgentScopeWarning ? (
            <div className="rounded-md border border-border/60 bg-surface-1/65 px-3 py-2 text-[10px] text-muted-foreground/80">
              {defaultAgentScopeWarning}
            </div>
          ) : null}
          <div>{skill.description}</div>
          {skill.blockedByAllowlist ? (
            <div className="text-[10px] text-muted-foreground/80">
              Blocked by bundled skills policy (`skills.allowBundled`).
            </div>
          ) : null}
          {missingDetails.map((line) => (
            <div key={`${skill.skillKey}:${line}`} className="text-[10px] text-muted-foreground/80">
              {line}
            </div>
          ))}
          {skillMessage ? (
            <div
              className={`text-[10px] ${skillMessage.kind === "error" ? "ui-text-danger" : "ui-text-success"}`}
            >
              {skillMessage.message}
            </div>
          ) : null}
          <div className="space-y-2 rounded-md border border-border/60 bg-surface-1/65 px-3 py-3">
            {installOption ? (
              <button
                type="button"
                className="ui-btn-secondary w-full px-3 py-2 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-65"
                disabled={anySkillBusy}
                onClick={() => {
                  void onInstallSkill(skill.skillKey, skill.name, installOption.id);
                }}
              >
                {busyForSkill ? "Working..." : installOption.label}
              </button>
            ) : null}
            <button
              type="button"
              className="ui-btn-secondary w-full px-3 py-2 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-65"
              disabled={anySkillBusy}
              onClick={() => {
                void onSetSkillGlobalEnabled(skill.skillKey, skill.disabled);
              }}
            >
              {busyForSkill
                ? "Working..."
                : skill.disabled
                  ? "Enable globally"
                  : "Disable globally"}
            </button>
            {skill.primaryEnv ? (
              <>
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(event) => {
                    void onSkillApiKeyChange(skill.skillKey, event.target.value);
                  }}
                  disabled={anySkillBusy}
                  className="w-full rounded-md border border-border/60 bg-surface-1 px-3 py-2 text-[10px] text-foreground outline-none transition focus:border-border"
                  placeholder={`Set ${skill.primaryEnv}`}
                  aria-label={`API key for ${skill.name}`}
                />
                <button
                  type="button"
                  className="ui-btn-secondary w-full px-3 py-2 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-65"
                  disabled={anySkillBusy || trimmedApiKey.length === 0}
                  onClick={() => {
                    if (trimmedApiKey.length === 0) {
                      return;
                    }
                    void onSaveSkillApiKey(skill.skillKey);
                  }}
                >
                  {busyForSkill ? "Working..." : `Save ${skill.primaryEnv}`}
                </button>
              </>
            ) : null}
            {canDeleteSkill ? (
              <button
                type="button"
                className="ui-btn-secondary ui-btn-danger w-full px-3 py-2 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-65"
                disabled={anySkillBusy}
                onClick={() => {
                  const approved = window.confirm(
                    `Remove ${skill.name} from the gateway for all agents?`
                  );
                  if (!approved) {
                    return;
                  }
                  void onRemoveSkill({
                    skillKey: skill.skillKey,
                    source: skill.source,
                    baseDir: skill.baseDir,
                  });
                  onClose();
                }}
              >
                Remove for all agents
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
