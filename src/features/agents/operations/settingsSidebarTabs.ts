import type { SettingsRouteTab } from "@/features/agents/operations/settingsRouteWorkflow";

export type SettingsSidebarEntry = {
  id: SettingsRouteTab;
  label: string;
};

const BASE_SETTINGS_SIDEBAR_ENTRIES: readonly SettingsSidebarEntry[] = [
  { id: "personality", label: "Behavior" },
  { id: "capabilities", label: "Capabilities" },
  { id: "skills", label: "Skills" },
  { id: "system", label: "System setup" },
  { id: "automations", label: "Automations" },
  { id: "advanced", label: "Advanced" },
];

export const resolveSettingsSidebarEntries = (runtimeSupportsCron: boolean) =>
  BASE_SETTINGS_SIDEBAR_ENTRIES.filter(
    (entry) => runtimeSupportsCron || entry.id !== "automations"
  );
