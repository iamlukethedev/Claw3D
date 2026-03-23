"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { AgentIdentityFields } from "@/features/agents/components/AgentIdentityFields";
import {
  AGENT_FILE_META,
  AGENT_FILE_PLACEHOLDERS,
  type AgentFileName,
} from "@/lib/agents/agentFiles";
import { parsePersonalityFiles, serializePersonalityFiles } from "@/lib/agents/personalityBuilder";
import { useAgentFilesEditor } from "@/features/agents/hooks/useAgentFilesEditor";

export type AgentBrainPanelProps = {
  client: GatewayClient;
  agents: AgentState[];
  selectedAgentId: string | null;
  activeSection?: AgentFileName;
  onCancel?: () => void;
  onUnsavedChangesChange?: (dirty: boolean) => void;
  onRename?: (agentId: string, name: string) => Promise<boolean>;
};

const AgentBrainPanelSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="space-y-3 border-t border-border/55 pt-8 first:border-t-0 first:pt-0">
    <h3 className="text-sm font-medium text-foreground">{title}</h3>
    {children}
  </section>
);

export const AgentBrainPanel = ({
  client,
  agents,
  selectedAgentId,
  activeSection,
  onCancel,
  onUnsavedChangesChange,
  onRename,
}: AgentBrainPanelProps) => {
  const selectedAgent = useMemo(
    () =>
      selectedAgentId
        ? agents.find((entry) => entry.agentId === selectedAgentId) ?? null
        : null,
    [agents, selectedAgentId]
  );

  const {
    agentFiles,
    agentFilesLoading,
    agentFilesSaving,
    agentFilesDirty,
    agentFilesError,
    setAgentFileContent,
    saveAgentFiles,
  } = useAgentFilesEditor({ client, agentId: selectedAgent?.agentId ?? null });
  const draft = useMemo(() => parsePersonalityFiles(agentFiles), [agentFiles]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setIdentityField = useCallback(
    (field: "name" | "creature" | "vibe" | "emoji" | "avatar", value: string) => {
      const nextDraft = parsePersonalityFiles(agentFiles);
      nextDraft.identity[field] = value;
      const serialized = serializePersonalityFiles(nextDraft);
      setAgentFileContent("IDENTITY.md", serialized["IDENTITY.md"]);
    },
    [agentFiles, setAgentFileContent]
  );

  const handleSave = useCallback(async () => {
    if (agentFilesLoading || agentFilesSaving || !agentFilesDirty) return;
    setSaveError(null);
    const saved = await saveAgentFiles();
    if (!saved || !selectedAgent || !onRename) {
      return;
    }
    const nextName = draft.identity.name.trim();
    const currentName = selectedAgent.name.trim();
    if (!nextName || nextName === currentName) {
      return;
    }
    const renamed = await onRename(selectedAgent.agentId, nextName);
    if (!renamed) {
      setSaveError("Saved IDENTITY.md, but could not rename the live agent.");
    }
  }, [
    agentFilesDirty,
    agentFilesLoading,
    agentFilesSaving,
    draft.identity.name,
    onRename,
    saveAgentFiles,
    selectedAgent,
  ]);

  useEffect(() => {
    onUnsavedChangesChange?.(agentFilesDirty);
  }, [agentFilesDirty, onUnsavedChangesChange]);

  useEffect(() => {
    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [onUnsavedChangesChange]);

  const renderMarkdownEditor = useCallback(
    (name: Exclude<AgentFileName, "IDENTITY.md">) => (
      <AgentBrainPanelSection title={AGENT_FILE_META[name].title}>
        <div className="text-xs text-muted-foreground">{AGENT_FILE_META[name].hint}</div>
        <textarea
          aria-label={AGENT_FILE_META[name].title}
          className="h-[min(56vh,480px)] w-full resize-y rounded-md border border-border/80 bg-background px-4 py-3 font-mono text-sm leading-6 text-foreground outline-none"
          value={agentFiles[name].content}
          placeholder={AGENT_FILE_PLACEHOLDERS[name]}
          disabled={agentFilesLoading || agentFilesSaving}
          onChange={(event) => {
            setAgentFileContent(name, event.target.value);
          }}
        />
      </AgentBrainPanelSection>
    ),
    [agentFiles, agentFilesLoading, agentFilesSaving, setAgentFileContent],
  );

  const renderIdentityEditor = useCallback(
    () => (
      <section className="space-y-3 border-t border-border/55 pt-8 first:border-t-0 first:pt-0">
        <h3 className="text-sm font-medium text-foreground">{AGENT_FILE_META["IDENTITY.md"].title}</h3>
        <div className="text-xs text-muted-foreground">
          {AGENT_FILE_META["IDENTITY.md"].hint}
        </div>
        <div className="text-xs text-muted-foreground">
          Changing <span className="font-medium text-foreground">Name</span> here also renames the live agent
          when you save.
        </div>
        <AgentIdentityFields
          values={draft.identity}
          disabled={agentFilesLoading || agentFilesSaving}
          onChange={(field, value) => {
            setIdentityField(field, value);
          }}
        />
      </section>
    ),
    [agentFilesLoading, agentFilesSaving, draft.identity, setIdentityField],
  );

  const renderedSections = useMemo(() => {
    if (activeSection === "IDENTITY.md") {
      return [renderIdentityEditor()];
    }
    if (activeSection) {
      return [renderMarkdownEditor(activeSection as Exclude<AgentFileName, "IDENTITY.md">)];
    }
    return [
      renderMarkdownEditor("SOUL.md"),
      renderMarkdownEditor("AGENTS.md"),
      renderMarkdownEditor("USER.md"),
      renderIdentityEditor(),
    ];
  }, [activeSection, renderIdentityEditor, renderMarkdownEditor]);

  return (
    <div
      className="agent-inspect-panel flex min-h-0 flex-col overflow-hidden"
      data-testid="agent-personality-panel"
      style={{ position: "relative", left: "auto", top: "auto", width: "100%", height: "100%" }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
        <section
          className="mx-auto flex min-h-0 w-full max-w-[920px] flex-col"
          data-testid="agent-personality-files"
        >
          {agentFilesError ? (
            <div className="ui-alert-danger mb-4 rounded-md px-3 py-2 text-xs">
              {agentFilesError}
            </div>
          ) : null}
          {saveError ? (
            <div className="ui-alert-danger mb-4 rounded-md px-3 py-2 text-xs">
              {saveError}
            </div>
          ) : null}

          <div className="mb-6 flex items-center justify-end gap-2 border-b border-border/40 pb-4">
            <button
              type="button"
              className="ui-btn-ghost px-3 py-2 text-xs"
              disabled={agentFilesLoading || agentFilesSaving}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ui-btn-primary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
              disabled={agentFilesLoading || agentFilesSaving || !agentFilesDirty}
              onClick={() => {
                void handleSave();
              }}
            >
              Save
            </button>
          </div>

          <div className="space-y-8 pb-8">
            {renderedSections.map((section, index) => (
              <div key={`${activeSection ?? "all"}-${index}`}>{section}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
