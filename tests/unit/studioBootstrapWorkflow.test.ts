import { describe, expect, it } from "vitest";

import {
  planBootstrapSelection,
  planFocusedFilterPatch,
  planFocusedPreferenceRestore,
  planFocusedSelectionPatch,
} from "@/features/agents/operations/studioBootstrapWorkflow";
import { defaultStudioSettings, type StudioSettings } from "@/lib/studio/settings";

describe("studioBootstrapWorkflow", () => {
  it("keeps existing selection when one is already active", () => {
    const intent = planBootstrapSelection({
      hasCurrentSelection: true,
      preferredSelectedAgentId: "agent-1",
      availableAgentIds: ["agent-1", "agent-2"],
      suggestedSelectedAgentId: "agent-2",
    });

    expect(intent).toEqual({ initialSelectedAgentId: undefined });
  });

  it("prefers saved selected agent when present in seeds", () => {
    const intent = planBootstrapSelection({
      hasCurrentSelection: false,
      preferredSelectedAgentId: "agent-2",
      availableAgentIds: ["agent-1", "agent-2"],
      suggestedSelectedAgentId: "agent-1",
    });

    expect(intent).toEqual({ initialSelectedAgentId: "agent-2" });
  });

  it("falls back to suggested selected agent when saved preference is unavailable", () => {
    const intent = planBootstrapSelection({
      hasCurrentSelection: false,
      preferredSelectedAgentId: "agent-9",
      availableAgentIds: ["agent-1", "agent-2"],
      suggestedSelectedAgentId: "agent-1",
    });

    expect(intent).toEqual({ initialSelectedAgentId: "agent-1" });
  });

  it("builds focused filter patch only when gateway key and touch state allow it", () => {
    expect(
      planFocusedFilterPatch({
        gatewayKey: "",
        focusFilterTouched: true,
        focusFilter: "running",
      })
    ).toEqual({ kind: "skip", reason: "missing-gateway-key" });

    expect(
      planFocusedFilterPatch({
        gatewayKey: "https://gateway.test",
        focusFilterTouched: false,
        focusFilter: "running",
      })
    ).toEqual({ kind: "skip", reason: "focus-filter-not-touched" });

    expect(
      planFocusedFilterPatch({
        gatewayKey: "https://gateway.test",
        focusFilterTouched: true,
        focusFilter: "running",
      })
    ).toEqual({
      kind: "patch",
      patch: {
        focused: {
          "https://gateway.test": {
            mode: "focused",
            filter: "running",
          },
        },
      },
      debounceMs: 300,
    });
  });

  it("builds focused selected-agent patch only when connection and load gates pass", () => {
    expect(
      planFocusedSelectionPatch({
        gatewayKey: "",
        status: "connected",
        focusedPreferencesLoaded: true,
        agentsLoadedOnce: true,
        selectedAgentId: "agent-1",
      })
    ).toEqual({ kind: "skip", reason: "missing-gateway-key" });

    expect(
      planFocusedSelectionPatch({
        gatewayKey: "https://gateway.test",
        status: "connecting",
        focusedPreferencesLoaded: true,
        agentsLoadedOnce: true,
        selectedAgentId: "agent-1",
      })
    ).toEqual({ kind: "skip", reason: "not-connected" });

    expect(
      planFocusedSelectionPatch({
        gatewayKey: "https://gateway.test",
        status: "connected",
        focusedPreferencesLoaded: false,
        agentsLoadedOnce: true,
        selectedAgentId: "agent-1",
      })
    ).toEqual({ kind: "skip", reason: "focused-preferences-not-loaded" });

    expect(
      planFocusedSelectionPatch({
        gatewayKey: "https://gateway.test",
        status: "connected",
        focusedPreferencesLoaded: true,
        agentsLoadedOnce: false,
        selectedAgentId: "agent-1",
      })
    ).toEqual({ kind: "skip", reason: "agents-not-loaded" });

    expect(
      planFocusedSelectionPatch({
        gatewayKey: "https://gateway.test",
        status: "connected",
        focusedPreferencesLoaded: true,
        agentsLoadedOnce: true,
        selectedAgentId: "agent-2",
      })
    ).toEqual({
      kind: "patch",
      patch: {
        focused: {
          "https://gateway.test": {
            mode: "focused",
            selectedAgentId: "agent-2",
          },
        },
      },
      debounceMs: 300,
    });
  });

  it("resolves focused preference restore values from settings", () => {
    const settings: StudioSettings = {
      ...defaultStudioSettings(),
      focused: {
        "https://gateway.test": {
          mode: "focused",
          selectedAgentId: "agent-3",
          filter: "approvals",
        },
      },
    };

    expect(
      planFocusedPreferenceRestore({
        settings,
        gatewayKey: "https://gateway.test",
        focusFilterTouched: false,
      })
    ).toEqual({
      preferredSelectedAgentId: "agent-3",
      focusFilter: "approvals",
    });

    expect(
      planFocusedPreferenceRestore({
        settings,
        gatewayKey: "https://gateway.unknown",
        focusFilterTouched: false,
      })
    ).toEqual({
      preferredSelectedAgentId: null,
      focusFilter: "all",
    });
  });

  it("restores running filter as all", () => {
    const settings: StudioSettings = {
      ...defaultStudioSettings(),
      focused: {
        "https://gateway.test": {
          mode: "focused",
          selectedAgentId: "agent-7",
          filter: "running",
        },
      },
    };

    expect(
      planFocusedPreferenceRestore({
        settings,
        gatewayKey: "https://gateway.test",
        focusFilterTouched: false,
      })
    ).toEqual({
      preferredSelectedAgentId: "agent-7",
      focusFilter: "all",
    });
  });
});
