import { describe, expect, it } from "vitest";

import {
  SETTINGS_ROUTE_AGENT_ID_QUERY_PARAM,
  buildSettingsRouteHref,
  parseSettingsRouteAgentIdFromQueryParam,
  parseSettingsRouteAgentIdFromPathname,
  planBackToChatCommands,
  planFleetSelectCommands,
  planNonRouteSelectionSyncCommands,
  planOpenSettingsRouteCommands,
  planSettingsRouteSyncCommands,
  planSettingsTabChangeCommands,
} from "@/features/agents/operations/settingsRouteWorkflow";

describe("settingsRouteWorkflow", () => {
  it("parses a valid settings route agent id", () => {
    expect(parseSettingsRouteAgentIdFromPathname("/agents/agent%201/settings")).toBe("agent 1");
  });

  it("returns null for non-settings routes", () => {
    expect(parseSettingsRouteAgentIdFromPathname("/agents/main/chat")).toBeNull();
    expect(parseSettingsRouteAgentIdFromPathname("/")).toBeNull();
  });

  it("falls back to raw path segment when decoding throws", () => {
    expect(parseSettingsRouteAgentIdFromPathname("/agents/%E0%A4%A/settings")).toBe(
      "%E0%A4%A"
    );
  });

  it("builds encoded settings route href", () => {
    expect(buildSettingsRouteHref("agent one/2")).toBe(
      `/agents?${SETTINGS_ROUTE_AGENT_ID_QUERY_PARAM}=agent%20one%2F2`
    );
  });

  it("parses settings route agent id from query param", () => {
    expect(parseSettingsRouteAgentIdFromQueryParam("agent-1")).toBe("agent-1");
    expect(parseSettingsRouteAgentIdFromQueryParam("agent%201")).toBe("agent 1");
    expect(parseSettingsRouteAgentIdFromQueryParam("%E0%A4%A")).toBe("%E0%A4%A");
    expect(parseSettingsRouteAgentIdFromQueryParam("  ")).toBeNull();
    expect(parseSettingsRouteAgentIdFromQueryParam(null)).toBeNull();
  });

  it("throws when building settings route href with empty agent id", () => {
    expect(() => buildSettingsRouteHref("   ")).toThrow(
      "Cannot build settings route href: agent id is empty."
    );
  });

  it("requires discard confirmation for back-to-chat when personality is dirty", () => {
    expect(
      planBackToChatCommands({
        settingsRouteActive: true,
        activeTab: "personality",
        personalityHasUnsavedChanges: true,
        discardConfirmed: false,
      })
    ).toEqual([]);

    expect(
      planBackToChatCommands({
        settingsRouteActive: true,
        activeTab: "personality",
        personalityHasUnsavedChanges: true,
        discardConfirmed: true,
      })
    ).toEqual([
      { kind: "set-personality-dirty", value: false },
      { kind: "push", href: "/" },
    ]);
  });

  it("plans settings tab change and clears personality dirty state after confirmed discard", () => {
    expect(
      planSettingsTabChangeCommands({
        nextTab: "capabilities",
        currentInspectSidebar: { agentId: "agent-1", tab: "personality" },
        settingsRouteAgentId: "agent-1",
        settingsRouteActive: true,
        personalityHasUnsavedChanges: true,
        discardConfirmed: false,
      })
    ).toEqual([]);

    expect(
      planSettingsTabChangeCommands({
        nextTab: "capabilities",
        currentInspectSidebar: { agentId: "agent-1", tab: "personality" },
        settingsRouteAgentId: "agent-1",
        settingsRouteActive: true,
        personalityHasUnsavedChanges: true,
        discardConfirmed: true,
      })
    ).toEqual([
      { kind: "set-personality-dirty", value: false },
      {
        kind: "set-inspect-sidebar",
        value: { agentId: "agent-1", tab: "capabilities" },
      },
    ]);
  });

  it("changes from capabilities to skills without discard confirmation", () => {
    expect(
      planSettingsTabChangeCommands({
        nextTab: "skills",
        currentInspectSidebar: { agentId: "agent-1", tab: "capabilities" },
        settingsRouteAgentId: "agent-1",
        settingsRouteActive: true,
        personalityHasUnsavedChanges: true,
        discardConfirmed: false,
      })
    ).toEqual([
      {
        kind: "set-inspect-sidebar",
        value: { agentId: "agent-1", tab: "skills" },
      },
    ]);
  });

  it("changes from skills to system without discard confirmation", () => {
    expect(
      planSettingsTabChangeCommands({
        nextTab: "system",
        currentInspectSidebar: { agentId: "agent-1", tab: "skills" },
        settingsRouteAgentId: "agent-1",
        settingsRouteActive: true,
        personalityHasUnsavedChanges: true,
        discardConfirmed: false,
      })
    ).toEqual([
      {
        kind: "set-inspect-sidebar",
        value: { agentId: "agent-1", tab: "system" },
      },
    ]);
  });

  it("plans route-agent synchronization commands", () => {
    expect(
      planSettingsRouteSyncCommands({
        settingsRouteActive: true,
        settingsRouteAgentId: "agent-2",
        status: "connected",
        agentsLoadedOnce: true,
        selectedAgentId: "agent-1",
        hasRouteAgent: true,
        currentInspectSidebar: null,
      })
    ).toEqual([
      {
        kind: "set-inspect-sidebar",
        value: { agentId: "agent-2", tab: "personality" },
      },
      { kind: "select-agent", agentId: "agent-2" },
    ]);
  });

  it("plans redirect when settings route agent is missing after load", () => {
    expect(
      planSettingsRouteSyncCommands({
        settingsRouteActive: true,
        settingsRouteAgentId: "missing",
        status: "connected",
        agentsLoadedOnce: true,
        selectedAgentId: null,
        hasRouteAgent: false,
        currentInspectSidebar: null,
      })
    ).toEqual([{ kind: "replace", href: "/" }]);
  });

  it("plans non-route selection reconciliation", () => {
    expect(
      planNonRouteSelectionSyncCommands({
        settingsRouteActive: false,
        selectedAgentId: "agent-2",
        focusedAgentId: "agent-3",
        hasSelectedAgentInAgents: false,
        currentInspectSidebar: { agentId: "agent-1", tab: "automations" },
        hasInspectSidebarAgent: false,
      })
    ).toEqual([
      {
        kind: "set-inspect-sidebar",
        value: { agentId: "agent-2", tab: "automations" },
      },
      { kind: "set-inspect-sidebar", value: null },
      { kind: "select-agent", agentId: null },
      { kind: "select-agent", agentId: "agent-3" },
    ]);
  });

  it("plans settings-route open and fleet-select commands with draft flush", () => {
    expect(
      planOpenSettingsRouteCommands({
        agentId: "agent 2",
        currentInspectSidebar: { agentId: "agent-1", tab: "advanced" },
        focusedAgentId: "agent-1",
      })
    ).toEqual([
      { kind: "flush-pending-draft", agentId: "agent-1" },
      { kind: "select-agent", agentId: "agent 2" },
      {
        kind: "set-inspect-sidebar",
        value: { agentId: "agent 2", tab: "advanced" },
      },
      { kind: "set-mobile-pane-chat" },
      { kind: "push", href: "/agents?settingsAgentId=agent%202" },
    ]);

    expect(
      planFleetSelectCommands({
        agentId: "agent-9",
        currentInspectSidebar: { agentId: "agent-1", tab: "capabilities" },
        focusedAgentId: "agent-3",
      })
    ).toEqual([
      { kind: "flush-pending-draft", agentId: "agent-3" },
      { kind: "select-agent", agentId: "agent-9" },
      {
        kind: "set-inspect-sidebar",
        value: { agentId: "agent-9", tab: "capabilities" },
      },
      { kind: "set-mobile-pane-chat" },
    ]);
  });
});
