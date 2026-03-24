"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudioSettingsCoordinator } from "@/lib/studio/coordinator";
import {
  defaultStudioOfficePreferencePublic,
  resolveOfficePreferencePublic,
  type StudioOfficePreferencePublic,
} from "@/lib/studio/settings";

type UseStudioOfficePreferenceParams = {
  gatewayUrl: string;
  settingsCoordinator: StudioSettingsCoordinator;
};

export const useStudioOfficePreference = ({
  gatewayUrl,
  settingsCoordinator,
}: UseStudioOfficePreferenceParams) => {
  const [preference, setPreference] = useState<StudioOfficePreferencePublic>(
    defaultStudioOfficePreferencePublic()
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const gatewayKey = gatewayUrl.trim();
    if (!gatewayKey) {
      setPreference(defaultStudioOfficePreferencePublic());
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
            ? resolveOfficePreferencePublic(settings, gatewayKey)
            : defaultStudioOfficePreferencePublic()
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load office preference.", error);
          setPreference(defaultStudioOfficePreferencePublic());
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };
    void loadPreference();
    return () => {
      cancelled = true;
    };
  }, [gatewayUrl, settingsCoordinator]);

  const setTitle = useCallback(
    (title: string) => {
      const gatewayKey = gatewayUrl.trim();
      setPreference((current) => ({ ...current, title }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        {
          office: {
            [gatewayKey]: {
              title,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const setRemoteOfficeEnabled = useCallback(
    (remoteOfficeEnabled: boolean) => {
      const gatewayKey = gatewayUrl.trim();
      setPreference((current) => ({ ...current, remoteOfficeEnabled }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        {
          office: {
            [gatewayKey]: {
              remoteOfficeEnabled,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const setRemoteOfficeLabel = useCallback(
    (remoteOfficeLabel: string) => {
      const gatewayKey = gatewayUrl.trim();
      setPreference((current) => ({ ...current, remoteOfficeLabel }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        {
          office: {
            [gatewayKey]: {
              remoteOfficeLabel,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const setRemoteOfficeSourceKind = useCallback(
    (remoteOfficeSourceKind: StudioOfficePreferencePublic["remoteOfficeSourceKind"]) => {
      const gatewayKey = gatewayUrl.trim();
      setPreference((current) => ({ ...current, remoteOfficeSourceKind }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        {
          office: {
            [gatewayKey]: {
              remoteOfficeSourceKind,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const setRemoteOfficePresenceUrl = useCallback(
    (remoteOfficePresenceUrl: string) => {
      const gatewayKey = gatewayUrl.trim();
      setPreference((current) => ({ ...current, remoteOfficePresenceUrl }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        {
          office: {
            [gatewayKey]: {
              remoteOfficePresenceUrl,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const setRemoteOfficeGatewayUrl = useCallback(
    (remoteOfficeGatewayUrl: string) => {
      const gatewayKey = gatewayUrl.trim();
      setPreference((current) => ({ ...current, remoteOfficeGatewayUrl }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        {
          office: {
            [gatewayKey]: {
              remoteOfficeGatewayUrl,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const setRemoteOfficeToken = useCallback(
    (remoteOfficeToken: string) => {
      const gatewayKey = gatewayUrl.trim();
      if (!gatewayKey) return;
      setPreference((current) => ({
        ...current,
        remoteOfficeTokenConfigured: remoteOfficeToken.trim().length > 0,
      }));
      settingsCoordinator.schedulePatch(
        {
          office: {
            [gatewayKey]: {
              remoteOfficeToken,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  return {
    loaded,
    preference,
    title: preference.title,
    remoteOfficeEnabled: preference.remoteOfficeEnabled,
    remoteOfficeSourceKind: preference.remoteOfficeSourceKind,
    remoteOfficeLabel: preference.remoteOfficeLabel,
    remoteOfficePresenceUrl: preference.remoteOfficePresenceUrl,
    remoteOfficeGatewayUrl: preference.remoteOfficeGatewayUrl,
    remoteOfficeTokenConfigured: preference.remoteOfficeTokenConfigured,
    setTitle,
    setRemoteOfficeEnabled,
    setRemoteOfficeSourceKind,
    setRemoteOfficeLabel,
    setRemoteOfficePresenceUrl,
    setRemoteOfficeGatewayUrl,
    setRemoteOfficeToken,
  };
};
