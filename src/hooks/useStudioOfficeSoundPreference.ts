"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudioSettingsCoordinator } from "@/lib/studio/coordinator";
import {
  defaultStudioOfficeSoundPreference,
  resolveOfficeSoundPreference,
  type StudioOfficeSoundPreference,
} from "@/lib/studio/settings";

type UseStudioOfficeSoundPreferenceParams = {
  gatewayUrl: string;
  storageKey?: string;
  settingsCoordinator: StudioSettingsCoordinator;
};

export const useStudioOfficeSoundPreference = ({
  gatewayUrl,
  storageKey,
  settingsCoordinator,
}: UseStudioOfficeSoundPreferenceParams) => {
  const [preference, setPreference] = useState<StudioOfficeSoundPreference>(
    defaultStudioOfficeSoundPreference(),
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const gatewayKey = gatewayUrl.trim() || storageKey?.trim() || "";
    if (!gatewayKey) {
      setPreference(defaultStudioOfficeSoundPreference());
      setLoaded(true);
      return;
    }
    setLoaded(false);
    const loadPreference = async () => {
      try {
        const settings = await settingsCoordinator.loadSettings({ maxAgeMs: 30_000 });
        if (cancelled) return;
        setPreference(
          settings
            ? resolveOfficeSoundPreference(settings, gatewayKey)
            : defaultStudioOfficeSoundPreference(),
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load office sound preference.", error);
          setPreference(defaultStudioOfficeSoundPreference());
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void loadPreference();
    return () => {
      cancelled = true;
    };
  }, [gatewayUrl, settingsCoordinator, storageKey]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      const gatewayKey = gatewayUrl.trim() || storageKey?.trim() || "";
      setPreference((current) => ({ ...current, enabled }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        { officeSound: { [gatewayKey]: { enabled } } },
        0,
      );
    },
    [gatewayUrl, settingsCoordinator, storageKey],
  );

  const setVolume = useCallback(
    (volume: number) => {
      const gatewayKey = gatewayUrl.trim() || storageKey?.trim() || "";
      setPreference((current) => ({ ...current, volume }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        { officeSound: { [gatewayKey]: { volume } } },
        0,
      );
    },
    [gatewayUrl, settingsCoordinator, storageKey],
  );

  return {
    loaded,
    preference,
    enabled: preference.enabled,
    volume: preference.volume,
    setEnabled,
    setVolume,
  };
};
