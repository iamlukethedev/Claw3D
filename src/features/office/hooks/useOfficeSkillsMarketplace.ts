"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { readGatewayAgentSkillsAllowlist } from "@/lib/gateway/agentConfig";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { setAgentSkillEnabled } from "@/lib/skills/agentAccess";
import {
  appendPackagedSkillsToMarketplace,
  getPackagedSkillBySkillKey,
  listPackagedSkills,
} from "@/lib/skills/catalog";
import { installPackagedSkillViaGatewayAgent } from "@/lib/skills/install-gateway";
import { resolvePreferredInstallOption } from "@/lib/skills/presentation";
import { removeSkillFromGateway } from "@/lib/skills/remove";
import {
  installSkill,
  loadAgentSkillStatus,
  updateSkill,
  type SkillStatusEntry,
  type SkillStatusReport,
} from "@/lib/skills/types";

type MarketplaceMessage = {
  kind: "success" | "error";
  text: string;
};

export const useOfficeSkillsMarketplace = ({
  client,
  status,
  agents,
  preferredAgentId,
  onSkillActivityStart,
  onSkillActivityEnd,
}: {
  client: GatewayClient;
  status: GatewayStatus;
  agents: AgentState[];
  preferredAgentId?: string | null;
  onSkillActivityStart?: (agentId: string) => void;
  onSkillActivityEnd?: (agentId: string) => void;
}) => {
  const requestIdRef = useRef(0);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    preferredAgentId ?? null,
  );
  const [skillsReport, setSkillsReport] = useState<SkillStatusReport | null>(
    null,
  );
  const [skillsAllowlist, setSkillsAllowlist] = useState<string[] | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busySkillKey, setBusySkillKey] = useState<string | null>(null);
  const [message, setMessage] = useState<MarketplaceMessage | null>(null);
  const packagedSkillsByKey = useMemo(
    () => new Map(listPackagedSkills().map((skill) => [skill.skillKey, skill])),
    []
  );

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.agentId === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );
  const marketplaceSkills = useMemo(
    () => appendPackagedSkillsToMarketplace(skillsReport?.skills ?? []),
    [skillsReport]
  );

  useEffect(() => {
    const preferred = (preferredAgentId ?? "").trim();
    const current = (selectedAgentId ?? "").trim();
    const hasCurrent =
      current.length > 0 && agents.some((agent) => agent.agentId === current);
    if (hasCurrent) {
      return;
    }
    if (preferred && agents.some((agent) => agent.agentId === preferred)) {
      setSelectedAgentId(preferred);
      return;
    }
    setSelectedAgentId(agents[0]?.agentId ?? null);
  }, [agents, preferredAgentId, selectedAgentId]);

  const loadMarketplace = useCallback(
    async (agentId: string) => {
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId || status !== "connected") {
        setSkillsReport(null);
        setSkillsAllowlist(undefined);
        setLoading(false);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoading(true);
      setError(null);
      try {
        const [report, allowlist] = await Promise.all([
          loadAgentSkillStatus(client, resolvedAgentId),
          readGatewayAgentSkillsAllowlist({
            client,
            agentId: resolvedAgentId,
          }),
        ]);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSkillsReport(report);
        setSkillsAllowlist(allowlist);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        const nextMessage =
          err instanceof Error
            ? err.message
            : "Failed to load skills marketplace data.";
        setSkillsReport(null);
        setSkillsAllowlist(undefined);
        setError(nextMessage);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(nextMessage);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [client, status],
  );

  useEffect(() => {
    if (!selectedAgentId || status !== "connected") {
      requestIdRef.current += 1;
      setSkillsReport(null);
      setSkillsAllowlist(undefined);
      setLoading(false);
      return;
    }
    void loadMarketplace(selectedAgentId);
  }, [loadMarketplace, selectedAgentId, status]);

  const refresh = useCallback(async () => {
    if (!selectedAgentId) {
      return;
    }
    await loadMarketplace(selectedAgentId);
  }, [loadMarketplace, selectedAgentId]);

  const runSkillMutation = useCallback(
    async (params: {
      skillKey: string;
      successMessage: string;
      run: (agentId: string, report: SkillStatusReport) => Promise<void>;
    }) => {
      const agentId = selectedAgentId?.trim() ?? "";
      const report = skillsReport;
      const normalizedSkillKey = params.skillKey.trim();
      if (!agentId || !report) {
        setMessage({
          kind: "error",
          text: "Select an agent before managing marketplace skills.",
        });
        return;
      }

      setBusySkillKey(normalizedSkillKey);
      setError(null);
      setMessage(null);
      onSkillActivityStart?.(agentId);
      try {
        await params.run(agentId, report);
        await loadMarketplace(agentId);
        setMessage({
          kind: "success",
          text: params.successMessage,
        });
      } catch (err) {
        const nextMessage =
          err instanceof Error
            ? err.message
            : "Failed to update the skill.";
        setError(nextMessage);
        setMessage({
          kind: "error",
          text: nextMessage,
        });
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(nextMessage);
        }
      } finally {
        onSkillActivityEnd?.(agentId);
        setBusySkillKey((current) =>
          current === normalizedSkillKey ? null : current,
        );
      }
    },
    [loadMarketplace, onSkillActivityEnd, onSkillActivityStart, selectedAgentId, skillsReport],
  );

  const handleSetSkillEnabled = useCallback(
    async (skillName: string, enabled: boolean) => {
      const entry =
        skillsReport?.skills.find(
          (skill) => skill.name.trim() === skillName.trim(),
        ) ?? null;
      await runSkillMutation({
        skillKey: entry?.skillKey ?? skillName,
        successMessage: enabled
          ? `Enabled ${skillName.trim()} for ${selectedAgent?.name ?? "the selected agent"}.`
          : `Removed ${skillName.trim()} from ${selectedAgent?.name ?? "the selected agent"}.`,
        run: async (agentId, report) => {
          await setAgentSkillEnabled({
            client,
            agentId,
            skillName,
            enabled,
            visibleSkills: report.skills,
          });
        },
      });
    },
    [client, runSkillMutation, selectedAgent?.name, skillsReport],
  );

  const handleInstallSkill = useCallback(
    async (skill: SkillStatusEntry) => {
      const installOption = resolvePreferredInstallOption(skill);
      if (!installOption) {
        setMessage({
          kind: "error",
          text: `No guided install is available for ${skill.name.trim()}.`,
        });
        return;
      }
      await runSkillMutation({
        skillKey: skill.skillKey,
        successMessage: `Installed dependencies for ${skill.name.trim()}.`,
        run: async () => {
          await installSkill(client, {
            name: skill.name,
            installId: installOption.id,
            timeoutMs: 120_000,
          });
        },
      });
    },
    [client, runSkillMutation],
  );

  const handleInstallPackagedSkill = useCallback(
    async (skillKey: string) => {
      const packagedSkill = getPackagedSkillBySkillKey(skillKey);
      if (!packagedSkill) {
        setMessage({
          kind: "error",
          text: `No packaged marketplace skill was found for ${skillKey.trim() || "that entry"}.`,
        });
        return;
      }

      await runSkillMutation({
        skillKey: packagedSkill.skillKey,
        successMessage: `Successfully installed ${packagedSkill.name.trim()} in the selected workspace. Enable it for the agent from the CLAW3D tab.`,
        run: async (_agentId, report) => {
          await installPackagedSkillViaGatewayAgent({
            client,
            request: {
              packageId: packagedSkill.packageId,
              source: packagedSkill.installSource,
              workspaceDir: report.workspaceDir,
              managedSkillsDir: report.managedSkillsDir,
            },
          });
        },
      });
    },
    [client, runSkillMutation]
  );

  const handleSetSkillGlobalEnabled = useCallback(
    async (skillKey: string, enabled: boolean) => {
      await runSkillMutation({
        skillKey,
        successMessage: enabled
          ? "Skill enabled for this gateway."
          : "Skill disabled for this gateway.",
        run: async () => {
          await updateSkill(client, { skillKey, enabled });
        },
      });
    },
    [client, runSkillMutation],
  );

  const handleRemoveSkill = useCallback(
    async (skill: SkillStatusEntry) => {
      await runSkillMutation({
        skillKey: skill.skillKey,
        successMessage: `${skill.name.trim()} removed from gateway files.`,
        run: async (_agentId, report) => {
          await removeSkillFromGateway({
            client,
            skillKey: skill.skillKey,
            source: skill.source as
              | "openclaw-managed"
              | "openclaw-workspace",
            baseDir: skill.baseDir,
            workspaceDir: report.workspaceDir,
            managedSkillsDir: report.managedSkillsDir,
          });
        },
      });
    },
    [client, runSkillMutation],
  );

  return {
    agents,
    selectedAgent,
    selectedAgentId,
    setSelectedAgentId,
    skillsReport,
    marketplaceSkills,
    packagedSkillsByKey,
    skillsAllowlist,
    loading,
    error,
    busySkillKey,
    message,
    refresh,
    handleSetSkillEnabled,
    handleInstallSkill,
    handleInstallPackagedSkill,
    handleSetSkillGlobalEnabled,
    handleRemoveSkill,
  };
};

export type OfficeSkillsMarketplaceController = ReturnType<
  typeof useOfficeSkillsMarketplace
>;
