import { describe, expect, it } from "vitest";

import { resolveSettingsSidebarEntries } from "@/features/agents/operations/settingsSidebarTabs";

describe("resolveSettingsSidebarEntries", () => {
  it("hides_automations_when_runtime_lacks_cron_capability", () => {
    const entries = resolveSettingsSidebarEntries(false);

    expect(entries.find((entry) => entry.id === "automations")).toBeUndefined();
  });

  it("shows_automations_when_runtime_supports_cron", () => {
    const entries = resolveSettingsSidebarEntries(true);

    expect(entries.find((entry) => entry.id === "automations")).toBeTruthy();
  });
});
