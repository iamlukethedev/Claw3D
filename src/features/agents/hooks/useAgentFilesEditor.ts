"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  readGatewayAgentFile,
  writeGatewayAgentFile,
  writeGatewayAgentFiles,
} from "@/lib/gateway/agentFiles";
import {
  AGENT_FILE_NAMES,
  type AgentFileName,
  createAgentFilesState,
  isAgentFileName,
} from "@/lib/agents/agentFiles";

type AgentFilesState = ReturnType<typeof createAgentFilesState>;

export type UseAgentFilesEditorResult = {
  agentFiles: AgentFilesState;
  agentFilesLoading: boolean;
  agentFilesSaving: boolean;
  agentFilesDirty: boolean;
  agentFilesError: string | null;
  setAgentFileContent: (name: AgentFileName, value: string) => void;
  saveAgentFiles: () => Promise<boolean>;
  initializeAgentFiles: (files: Partial<Record<AgentFileName, string>>) => Promise<boolean>;
  discardAgentFileChanges: () => void;
};

export const useAgentFilesEditor = (params: {
  client: GatewayClient | null | undefined;
  agentId: string | null | undefined;
}): UseAgentFilesEditorResult => {
  const { client, agentId } = params;
  const [agentFiles, setAgentFiles] = useState(createAgentFilesState);
  const [agentFilesLoading, setAgentFilesLoading] = useState(false);
  const [agentFilesSaving, setAgentFilesSaving] = useState(false);
  const [agentFilesDirty, setAgentFilesDirty] = useState(false);
  const [agentFilesError, setAgentFilesError] = useState<string | null>(null);
  const savedAgentFilesRef = useRef<AgentFilesState>(createAgentFilesState());

  const cloneAgentFilesState = useCallback((source: AgentFilesState): AgentFilesState => {
    const next = createAgentFilesState();
    for (const name of AGENT_FILE_NAMES) {
      next[name] = { ...source[name] };
    }
    return next;
  }, []);

  const loadAgentFiles = useCallback(async () => {
    setAgentFilesLoading(true);
    setAgentFilesError(null);

    try {
      const trimmedAgentId = agentId?.trim();
      if (!trimmedAgentId) {
        const emptyState = createAgentFilesState();
        savedAgentFilesRef.current = emptyState;
        setAgentFiles(emptyState);
        setAgentFilesDirty(false);
        setAgentFilesError("Agent ID is missing for this agent.");
        return;
      }

      if (!client) {
        setAgentFilesError("Gateway client is not available.");
        return;
      }

      const results = await Promise.all(
        AGENT_FILE_NAMES.map(async (name) => {
          const file = await readGatewayAgentFile({ client, agentId: trimmedAgentId, name });
          return {
            name,
            content: file.content,
            exists: file.exists,
            path: file.path,
            workspace: file.workspace,
          };
        })
      );

      const nextState = createAgentFilesState();
      for (const file of results) {
        if (!isAgentFileName(file.name)) continue;
        nextState[file.name] = {
          content: file.content ?? "",
          exists: Boolean(file.exists),
          path: file.path ?? null,
          workspace: file.workspace ?? null,
        };
      }

      savedAgentFilesRef.current = nextState;
      setAgentFiles(nextState);
      setAgentFilesDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load agent files.";
      setAgentFilesError(message);
    } finally {
      setAgentFilesLoading(false);
    }
  }, [agentId, client]);

  const saveAgentFiles = useCallback(async () => {
    setAgentFilesSaving(true);
    setAgentFilesError(null);

    try {
      const trimmedAgentId = agentId?.trim();
      if (!trimmedAgentId) {
        setAgentFilesError("Agent ID is missing for this agent.");
        return false;
      }

      if (!client) {
        setAgentFilesError("Gateway client is not available.");
        return false;
      }

      await Promise.all(
        AGENT_FILE_NAMES.map(async (name) => {
          await writeGatewayAgentFile({
            client,
            agentId: trimmedAgentId,
            name,
            content: agentFiles[name].content,
          });
        })
      );

      const nextState = createAgentFilesState();
      for (const name of AGENT_FILE_NAMES) {
        nextState[name] = {
          content: agentFiles[name].content,
          exists: true,
          path: agentFiles[name].path,
          workspace: agentFiles[name].workspace,
        };
      }

      savedAgentFilesRef.current = nextState;
      setAgentFiles(nextState);
      setAgentFilesDirty(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save agent files.";
      setAgentFilesError(message);
      return false;
    } finally {
      setAgentFilesSaving(false);
    }
  }, [agentFiles, agentId, client]);

  const initializeAgentFiles = useCallback(
    async (files: Partial<Record<AgentFileName, string>>) => {
      setAgentFilesSaving(true);
      setAgentFilesError(null);

      try {
        const trimmedAgentId = agentId?.trim();
        if (!trimmedAgentId) {
          setAgentFilesError("Agent ID is missing for this agent.");
          return false;
        }

        if (!client) {
          setAgentFilesError("Gateway client is not available.");
          return false;
        }

        await writeGatewayAgentFiles({
          client,
          agentId: trimmedAgentId,
          files,
        });

        const nextState = cloneAgentFilesState(savedAgentFilesRef.current);
        for (const [name, content] of Object.entries(files)) {
          if (!isAgentFileName(name) || typeof content !== "string") continue;
          nextState[name] = {
            content,
            exists: true,
            path: nextState[name].path,
            workspace: nextState[name].workspace,
          };
        }

        savedAgentFilesRef.current = nextState;
        setAgentFiles(nextState);
        setAgentFilesDirty(false);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to initialize agent files.";
        setAgentFilesError(message);
        return false;
      } finally {
        setAgentFilesSaving(false);
      }
    },
    [agentId, client, cloneAgentFilesState]
  );

  const setAgentFileContent = useCallback((name: AgentFileName, value: string) => {
    if (!isAgentFileName(name)) return;

    setAgentFiles((prev) => ({
      ...prev,
      [name]: { ...prev[name], content: value },
    }));
    setAgentFilesDirty(true);
  }, []);

  const discardAgentFileChanges = useCallback(() => {
    setAgentFiles(cloneAgentFilesState(savedAgentFilesRef.current));
    setAgentFilesDirty(false);
    setAgentFilesError(null);
  }, [cloneAgentFilesState]);

  useEffect(() => {
    void loadAgentFiles();
  }, [loadAgentFiles]);

  return {
    agentFiles,
    agentFilesLoading,
    agentFilesSaving,
    agentFilesDirty,
    agentFilesError,
    setAgentFileContent,
    saveAgentFiles,
    initializeAgentFiles,
    discardAgentFileChanges,
  };
};
