"use client";

import { useMemo, useState } from "react";

import {
  AgentIdentityFields,
  type AgentIdentityValues,
} from "@/features/agents/components/AgentIdentityFields";
import { AgentAvatarEditorPanel } from "@/features/agents/components/AgentAvatarEditorPanel";
import {
  createDefaultAgentAvatarProfile,
  type AgentAvatarProfile,
} from "@/lib/avatars/profile";
import { randomUUID } from "@/lib/uuid";

type AgentCreateWizardModalProps = {
  open: boolean;
  suggestedName?: string;
  busy?: boolean;
  submitError?: string | null;
  statusLine?: string | null;
  onClose: (createdAgentId: string | null) => void;
  onCreateAgent: (identity: AgentIdentityValues) => Promise<string | null>;
  onFinishAvatar: (params: {
    agentId: string;
    identity: AgentIdentityValues;
    profile: AgentAvatarProfile;
  }) => Promise<void>;
};

const stepClassName =
  "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]";

const buildInitialIdentity = (suggestedName: string): AgentIdentityValues => ({
  name: suggestedName.trim() || "New Agent",
  creature: "",
  vibe: "",
  emoji: "",
});

export function AgentCreateWizardModal({
  open,
  suggestedName = "",
  busy = false,
  submitError = null,
  statusLine = null,
  onClose,
  onCreateAgent,
  onFinishAvatar,
}: AgentCreateWizardModalProps) {
  const [step, setStep] = useState<"identity" | "avatar">("identity");
  const [identity, setIdentity] = useState<AgentIdentityValues>(() =>
    buildInitialIdentity(suggestedName),
  );
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [draftAvatarProfile, setDraftAvatarProfile] = useState<AgentAvatarProfile>(() =>
    createDefaultAgentAvatarProfile(randomUUID()),
  );

  const canCreate = useMemo(() => identity.name.trim().length > 0, [identity.name]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-background/84 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create agent wizard"
      onClick={() => {
        if (!busy) {
          onClose(createdAgentId);
        }
      }}
    >
      <div
        className="ui-panel flex h-[min(92vh,980px)] w-full max-w-6xl flex-col overflow-hidden shadow-xs"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border/40 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">
                New agent wizard
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                Create an agent step by step
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Start with identity, then customize the office avatar.
              </div>
            </div>
            <button
              type="button"
              className="ui-btn-ghost px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={() => {
                onClose(createdAgentId);
              }}
            >
              Close
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`${stepClassName} ${
                step === "identity"
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border/45 bg-background/40 text-muted-foreground"
              }`}
            >
              1. Identity
            </span>
            <span
              className={`${stepClassName} ${
                step === "avatar"
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : createdAgentId
                    ? "border-emerald-400/35 bg-emerald-500/10 text-foreground"
                    : "border-border/45 bg-background/40 text-muted-foreground"
              }`}
            >
              2. Avatar
            </span>
          </div>
          {statusLine ? (
            <div className="mt-4 rounded-md border border-border/45 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {statusLine}
            </div>
          ) : null}
          {submitError ? (
            <div className="ui-alert-danger mt-4 rounded-md px-3 py-2 text-xs">
              {submitError}
            </div>
          ) : null}
        </div>

        {step === "identity" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Identity</h3>
                <div className="text-xs text-muted-foreground">
                  Confirm the live agent name first, then fill in the rest of `IDENTITY.md`.
                </div>
                <AgentIdentityFields
                  values={identity}
                  disabled={busy}
                  onChange={(field, value) => {
                    setIdentity((current) => ({ ...current, [field]: value }));
                  }}
                />
              </section>

              <div className="mt-6 rounded-xl border border-border/45 bg-muted/20 p-4 text-sm text-muted-foreground">
                Creating the agent in this step makes it available in OpenClaw immediately so the
                wizard can save `IDENTITY.md` through the gateway before avatar customization.
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/40 pt-5">
                <button
                  type="button"
                  className="ui-btn-ghost px-3 py-2 text-xs"
                  disabled={busy}
                  onClick={() => {
                    onClose(createdAgentId);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ui-btn-primary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
                  disabled={!canCreate || busy}
                  onClick={async () => {
                    const agentId = await onCreateAgent(identity);
                    if (!agentId) return;
                    setCreatedAgentId(agentId);
                    setStep("avatar");
                  }}
                >
                  {busy ? "Creating..." : "Create and continue"}
                </button>
              </div>
            </div>
          </div>
        ) : createdAgentId ? (
          <AgentAvatarEditorPanel
            agentId={createdAgentId}
            agentName={identity.name.trim() || "New Agent"}
            initialProfile={draftAvatarProfile}
            cancelLabel="Close"
            saveLabel="Finish wizard"
            onCancel={() => {
              onClose(createdAgentId);
            }}
            onSave={async (profile) => {
              setDraftAvatarProfile(profile);
              await onFinishAvatar({
                agentId: createdAgentId,
                identity,
                profile,
              });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
