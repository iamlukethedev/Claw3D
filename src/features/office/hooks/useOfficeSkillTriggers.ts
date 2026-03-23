"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { AgentState } from "@/features/agents/state/store";
import { readGatewayAgentSkillsAllowlist } from "@/lib/gateway/agentConfig";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { OfficeSkillTriggerMovementTarget } from "@/lib/office/places";
import {
  buildAgentSkillsAllowlistSet,
  deriveAgentSkillsAccessMode,
  deriveSkillReadinessState,
} from "@/lib/skills/presentation";
import {
  listPackagedSkillTriggerDefinitions,
  resolveTriggeredSkillDefinition,
  type SkillTriggerDefinition,
} from "@/lib/skills/triggers";
import { loadAgentSkillStatus } from "@/lib/skills/types";

const isSkillEnabledForAgent = (params: {
  allowlist: string[] | undefined;
  skillName: string;
}): boolean => {
  const accessMode = deriveAgentSkillsAccessMode(params.allowlist);
  if (accessMode === "all") {
    return true;
  }
  if (accessMode === "none") {
    return false;
  }
  return buildAgentSkillsAllowlistSet(params.allowlist).has(params.skillName.trim());
};

export const useOfficeSkillTriggers = ({
  client,
  status,
  agents,
}: {
  client: GatewayClient;
  status: GatewayStatus;
  agents: AgentState[];
}) => {
  const requestIdRef = useRef(0);
  const [enabledTriggersByAgentId, setEnabledTriggersByAgentId] = useState<
    Record<string, SkillTriggerDefinition[]>
  >({});
  const packagedTriggers = useMemo(() => listPackagedSkillTriggerDefinitions(), []);
  const agentIdsKey = useMemo(
    () => agents.map((agent) => agent.agentId).sort().join("|"),
    [agents],
  );
  const stableAgentIds = useMemo(
    () => (agentIdsKey ? agentIdsKey.split("|").filter((value) => value.length > 0) : []),
    [agentIdsKey],
  );
  const shouldLoadTriggers =
    status === "connected" && stableAgentIds.length > 0 && packagedTriggers.length > 0;

  useEffect(() => {
    if (!shouldLoadTriggers) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      try {
        const triggerBySkillKey = new Map(
          packagedTriggers.map((trigger) => [trigger.skillKey, trigger]),
        );
        const results = await Promise.all(
          stableAgentIds.map(async (agentId) => {
            const [report, allowlist] = await Promise.all([
              loadAgentSkillStatus(client, agentId),
              readGatewayAgentSkillsAllowlist({ client, agentId }),
            ]);
            const enabledTriggers = report.skills
              .filter((skill) => deriveSkillReadinessState(skill) === "ready")
              .filter((skill) => isSkillEnabledForAgent({ allowlist, skillName: skill.name }))
              .map((skill) => triggerBySkillKey.get(skill.skillKey))
              .filter((trigger): trigger is SkillTriggerDefinition => Boolean(trigger));
            return [agentId, enabledTriggers] as const;
          }),
        );

        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }

        setEnabledTriggersByAgentId(Object.fromEntries(results));
      } catch {
        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }
        setEnabledTriggersByAgentId({});
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [client, packagedTriggers, shouldLoadTriggers, stableAgentIds]);

  const visibleEnabledTriggersByAgentId = useMemo(
    () => (shouldLoadTriggers ? enabledTriggersByAgentId : {}),
    [enabledTriggersByAgentId, shouldLoadTriggers]
  );

  const movementTargetByAgentId = useMemo<Record<string, OfficeSkillTriggerMovementTarget>>(() => {
    const next: Record<string, OfficeSkillTriggerMovementTarget> = {};
    for (const agent of agents) {
      const trigger = resolveTriggeredSkillDefinition({
        isAgentRunning: agent.status === "running" || Boolean(agent.runId),
        lastUserMessage: agent.lastUserMessage,
        transcriptEntries: agent.transcriptEntries,
        triggers: visibleEnabledTriggersByAgentId[agent.agentId] ?? [],
      });
      if (trigger) {
        next[agent.agentId] = trigger.movementTarget;
      }
    }
    return next;
  }, [agents, visibleEnabledTriggersByAgentId]);

  return {
    enabledTriggersByAgentId: visibleEnabledTriggersByAgentId,
    movementTargetByAgentId,
  };
};
