import { createElement, useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  useSettingsRouteController,
  type SettingsRouteController,
  type UseSettingsRouteControllerParams,
} from "@/features/agents/operations/useSettingsRouteController";
import type {
  InspectSidebarState,
  SettingsRouteTab,
} from "@/features/agents/operations/settingsRouteWorkflow";

type OverrideParams = Partial<
  Omit<
    UseSettingsRouteControllerParams,
    | "flushPendingDraft"
    | "dispatchSelectAgent"
    | "setInspectSidebar"
    | "setMobilePaneChat"
    | "setPersonalityHasUnsavedChanges"
    | "push"
    | "replace"
    | "confirmDiscard"
  >
>;

type RenderControllerContext = {
  getValue: () => SettingsRouteController;
  rerenderWith: (overrides: OverrideParams) => void;
  flushPendingDraft: ReturnType<typeof vi.fn<(agentId: string | null) => void>>;
  dispatchSelectAgent: ReturnType<typeof vi.fn<(agentId: string | null) => void>>;
  setInspectSidebar: ReturnType<
    typeof vi.fn<
      (
        next: InspectSidebarState | ((current: InspectSidebarState) => InspectSidebarState)
      ) => void
    >
  >;
  setMobilePaneChat: ReturnType<typeof vi.fn<() => void>>;
  setPersonalityHasUnsavedChanges: ReturnType<typeof vi.fn<(next: boolean) => void>>;
  push: ReturnType<typeof vi.fn<(href: string) => void>>;
  replace: ReturnType<typeof vi.fn<(href: string) => void>>;
  confirmDiscard: ReturnType<typeof vi.fn<() => boolean>>;
};

const renderController = (
  overrides?: OverrideParams,
  callbackOverrides?: Partial<
    Pick<
      UseSettingsRouteControllerParams,
      | "flushPendingDraft"
      | "dispatchSelectAgent"
      | "setInspectSidebar"
      | "setMobilePaneChat"
      | "setPersonalityHasUnsavedChanges"
      | "push"
      | "replace"
      | "confirmDiscard"
    >
  >
): RenderControllerContext => {
  const flushPendingDraft = vi.fn<(agentId: string | null) => void>(
    callbackOverrides?.flushPendingDraft ?? (() => undefined)
  );
  const dispatchSelectAgent = vi.fn<(agentId: string | null) => void>(
    callbackOverrides?.dispatchSelectAgent ?? (() => undefined)
  );
  const setInspectSidebar = vi.fn<
    (
      next: InspectSidebarState | ((current: InspectSidebarState) => InspectSidebarState)
    ) => void
  >(callbackOverrides?.setInspectSidebar ?? (() => undefined));
  const setMobilePaneChat = vi.fn<() => void>(
    callbackOverrides?.setMobilePaneChat ?? (() => undefined)
  );
  const setPersonalityHasUnsavedChanges = vi.fn<(next: boolean) => void>(
    callbackOverrides?.setPersonalityHasUnsavedChanges ?? (() => undefined)
  );
  const push = vi.fn<(href: string) => void>(callbackOverrides?.push ?? (() => undefined));
  const replace = vi.fn<(href: string) => void>(callbackOverrides?.replace ?? (() => undefined));
  const confirmDiscard = vi.fn<() => boolean>(callbackOverrides?.confirmDiscard ?? (() => true));

  let currentParams: UseSettingsRouteControllerParams = {
    settingsRouteActive: false,
    settingsRouteAgentId: null,
    status: "connected",
    agentsLoadedOnce: true,
    selectedAgentId: null,
    focusedAgentId: null,
    personalityHasUnsavedChanges: false,
    activeTab: "personality",
    inspectSidebar: null,
    agents: [{ agentId: "agent-1" }],
    flushPendingDraft,
    dispatchSelectAgent,
    setInspectSidebar,
    setMobilePaneChat,
    setPersonalityHasUnsavedChanges,
    push,
    replace,
    confirmDiscard,
    ...overrides,
  };

  const valueRef: { current: SettingsRouteController | null } = { current: null };

  const Probe = ({
    params,
    onValue,
  }: {
    params: UseSettingsRouteControllerParams;
    onValue: (value: SettingsRouteController) => void;
  }) => {
    const value = useSettingsRouteController(params);
    useEffect(() => {
      onValue(value);
    }, [onValue, value]);
    return createElement("div", { "data-testid": "probe" }, "ok");
  };

  const rendered = render(
    createElement(Probe, {
      params: currentParams,
      onValue: (value) => {
        valueRef.current = value;
      },
    })
  );

  return {
    getValue: () => {
      if (!valueRef.current) throw new Error("controller value unavailable");
      return valueRef.current;
    },
    rerenderWith: (nextOverrides) => {
      currentParams = {
        ...currentParams,
        ...nextOverrides,
      };
      rendered.rerender(
        createElement(Probe, {
          params: currentParams,
          onValue: (value) => {
            valueRef.current = value;
          },
        })
      );
    },
    flushPendingDraft,
    dispatchSelectAgent,
    setInspectSidebar,
    setMobilePaneChat,
    setPersonalityHasUnsavedChanges,
    push,
    replace,
    confirmDiscard,
  };
};

describe("useSettingsRouteController", () => {
  it("blocks back-to-chat when personality discard is declined", () => {
    const ctx = renderController(
      {
        settingsRouteActive: true,
        activeTab: "personality",
        personalityHasUnsavedChanges: true,
      },
      {
        confirmDiscard: () => false,
      }
    );

    act(() => {
      ctx.getValue().handleBackToChat();
    });

    expect(ctx.confirmDiscard).toHaveBeenCalledTimes(1);
    expect(ctx.setPersonalityHasUnsavedChanges).not.toHaveBeenCalled();
    expect(ctx.push).not.toHaveBeenCalled();
  });

  it("changes settings tab only after confirmed discard and clears dirty flag", () => {
    const ctx = renderController(
      {
        settingsRouteActive: true,
        settingsRouteAgentId: "agent-1",
        inspectSidebar: { agentId: "agent-1", tab: "personality" },
        activeTab: "personality",
        personalityHasUnsavedChanges: true,
      },
      {
        confirmDiscard: () => true,
      }
    );

    act(() => {
      ctx.getValue().handleSettingsRouteTabChange("capabilities");
    });

    expect(ctx.confirmDiscard).toHaveBeenCalledTimes(1);
    expect(ctx.setPersonalityHasUnsavedChanges).toHaveBeenCalledWith(false);
    expect(ctx.setInspectSidebar).toHaveBeenCalledWith({
      agentId: "agent-1",
      tab: "capabilities",
    });
  });

  it("runs open-settings commands in order and encodes route", () => {
    const order: string[] = [];
    const ctx = renderController(
      {
        focusedAgentId: "focused-agent",
        inspectSidebar: null,
      },
      {
        flushPendingDraft: () => {
          order.push("flush");
        },
        dispatchSelectAgent: () => {
          order.push("select");
        },
        setInspectSidebar: () => {
          order.push("inspect");
        },
        setMobilePaneChat: () => {
          order.push("pane");
        },
        push: (href) => {
          order.push(`push:${href}`);
        },
      }
    );
    order.length = 0;

    act(() => {
      ctx.getValue().handleOpenAgentSettingsRoute("agent 2");
    });

    expect(order).toEqual([
      "flush",
      "select",
      "inspect",
      "pane",
      "push:/agents?settingsAgentId=agent%202",
    ]);
  });

  it("keeps fleet-select behavior parity", () => {
    const ctx = renderController({
      focusedAgentId: "focused-agent",
      inspectSidebar: { agentId: "agent-1", tab: "automations" },
    });

    act(() => {
      ctx.getValue().handleFleetSelectAgent("agent-9");
    });

    expect(ctx.flushPendingDraft).toHaveBeenCalledWith("focused-agent");
    expect(ctx.dispatchSelectAgent).toHaveBeenCalledWith("agent-9");
    expect(ctx.setInspectSidebar).toHaveBeenCalledWith({
      agentId: "agent-9",
      tab: "automations",
    });
    expect(ctx.setMobilePaneChat).toHaveBeenCalledTimes(1);
  });

  it("redirects to root when route agent is missing after load", async () => {
    const ctx = renderController({
      settingsRouteActive: true,
      settingsRouteAgentId: "missing-agent",
      status: "connected",
      agentsLoadedOnce: true,
      agents: [{ agentId: "agent-1" }],
    });

    await waitFor(() => {
      expect(ctx.replace).toHaveBeenCalledWith("/");
    });
  });

  it("syncs route agent into inspect sidebar and selected agent", async () => {
    const ctx = renderController({
      settingsRouteActive: true,
      settingsRouteAgentId: "agent-1",
      selectedAgentId: null,
      inspectSidebar: null,
      agents: [{ agentId: "agent-1" }],
    });

    await waitFor(() => {
      expect(ctx.setInspectSidebar).toHaveBeenCalledWith({
        agentId: "agent-1",
        tab: "personality",
      });
      expect(ctx.dispatchSelectAgent).toHaveBeenCalledWith("agent-1");
    });
  });

  it("does not dispatch or mutate when non-route selection is already aligned", async () => {
    const ctx = renderController({
      settingsRouteActive: false,
      selectedAgentId: "agent-1",
      focusedAgentId: "agent-1",
      inspectSidebar: null,
      agents: [{ agentId: "agent-1" }],
    });

    await waitFor(() => {
      expect(ctx.dispatchSelectAgent).not.toHaveBeenCalled();
      expect(ctx.setInspectSidebar).not.toHaveBeenCalled();
      expect(ctx.replace).not.toHaveBeenCalled();
    });
  });

  it("does not call confirm when switching non-personality tabs", () => {
    const ctx = renderController({
      settingsRouteActive: true,
      settingsRouteAgentId: "agent-1",
      inspectSidebar: { agentId: "agent-1", tab: "capabilities" },
      activeTab: "capabilities" satisfies SettingsRouteTab,
      personalityHasUnsavedChanges: true,
    });

    act(() => {
      ctx.getValue().handleSettingsRouteTabChange("automations");
    });

    expect(ctx.confirmDiscard).not.toHaveBeenCalled();
    expect(ctx.setInspectSidebar).toHaveBeenCalledWith({
      agentId: "agent-1",
      tab: "automations",
    });
  });

  it("switches to skills tab without discard prompt when leaving capabilities", () => {
    const ctx = renderController({
      settingsRouteActive: true,
      settingsRouteAgentId: "agent-1",
      inspectSidebar: { agentId: "agent-1", tab: "capabilities" },
      activeTab: "capabilities" satisfies SettingsRouteTab,
      personalityHasUnsavedChanges: true,
    });

    act(() => {
      ctx.getValue().handleSettingsRouteTabChange("skills");
    });

    expect(ctx.confirmDiscard).not.toHaveBeenCalled();
    expect(ctx.setInspectSidebar).toHaveBeenCalledWith({
      agentId: "agent-1",
      tab: "skills",
    });
  });

  it("switches to system tab without discard prompt when leaving skills", () => {
    const ctx = renderController({
      settingsRouteActive: true,
      settingsRouteAgentId: "agent-1",
      inspectSidebar: { agentId: "agent-1", tab: "skills" },
      activeTab: "skills" satisfies SettingsRouteTab,
      personalityHasUnsavedChanges: true,
    });

    act(() => {
      ctx.getValue().handleSettingsRouteTabChange("system");
    });

    expect(ctx.confirmDiscard).not.toHaveBeenCalled();
    expect(ctx.setInspectSidebar).toHaveBeenCalledWith({
      agentId: "agent-1",
      tab: "system",
    });
  });
});
