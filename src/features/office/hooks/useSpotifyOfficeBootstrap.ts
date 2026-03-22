"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useJukeboxStore } from "@/features/spotify-jukebox/state/jukebox-store";

export type SpotifyOfficeBootstrapStatus = {
  connected: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  expiresAt: number | null;
  expired: boolean;
  scopes: string[];
};

export type SpotifyOfficeBootstrapNotice = {
  kind: "success" | "error";
  title: string;
  detail: string;
} | null;

const parseBool = (value: string | null) => value?.trim().toLowerCase() === "true";

const parseStatusPayload = (payload: unknown): SpotifyOfficeBootstrapStatus => {
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return {
    connected: Boolean(data.connected),
    hasAccessToken: Boolean(data.hasAccessToken),
    hasRefreshToken: Boolean(data.hasRefreshToken),
    expiresAt: typeof data.expiresAt === "number" ? data.expiresAt : null,
    expired: Boolean(data.expired),
    scopes: Array.isArray(data.scopes)
      ? data.scopes.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
};

export const useSpotifyOfficeBootstrap = () => {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<SpotifyOfficeBootstrapStatus | null>(null);
  const [notice, setNotice] = useState<SpotifyOfficeBootstrapNotice>(null);

  const querySummary = useMemo(
    () => ({
      spotifyConnected: parseBool(searchParams.get("spotify_connected")),
      spotifyError: searchParams.get("spotify_error")?.trim() || "",
      spotifyHostRedirect: parseBool(searchParams.get("spotify_host_redirect")),
      officeDebug: searchParams.get("officeDebug")?.trim() || "",
    }),
    [searchParams],
  );

  useEffect(() => {
    const rawQuery = Object.fromEntries(searchParams.entries());
    console.info("office.spotify_bootstrap.mounted", {
      pathname: window.location.pathname,
      search: window.location.search,
      query: rawQuery,
    });

    let cancelled = false;

    const run = async () => {
      console.info("office.spotify_bootstrap.status.start", {
        spotifyConnected: querySummary.spotifyConnected,
        spotifyError: querySummary.spotifyError || null,
        spotifyHostRedirect: querySummary.spotifyHostRedirect,
        officeDebug: querySummary.officeDebug || null,
      });

      try {
        const response = await fetch("/api/spotify/status", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        const nextStatus = parseStatusPayload(payload);

        console.info("office.spotify_bootstrap.status.result", {
          ok: response.ok,
          status: response.status,
          payload: nextStatus,
        });

        if (cancelled) return;

        setStatus(nextStatus);

        const store = useJukeboxStore.getState();
        store.setAuthState(nextStatus.connected, nextStatus.expiresAt);
        if (nextStatus.connected) {
          store.setError(null);
        }

        if (querySummary.spotifyError) {
          const message = `Spotify login failed: ${querySummary.spotifyError}`;
          store.setError(message);
          setNotice({
            kind: "error",
            title: "Spotify login failed",
            detail: message,
          });
          return;
        }

        if (querySummary.spotifyConnected) {
          const message = nextStatus.connected
            ? "Spotify connected."
            : "Spotify callback completed, but the auth status endpoint still reports disconnected.";
          if (!nextStatus.connected) {
            store.setError(message);
          }
          setNotice({
            kind: nextStatus.connected ? "success" : "error",
            title: nextStatus.connected ? "Spotify connected" : "Spotify login incomplete",
            detail: message,
          });
          return;
        }

        setNotice(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to refresh Spotify status.";
        console.error("office.spotify_bootstrap.status.error", {
          error: message,
        });
        if (cancelled) return;

        setStatus(null);
        if (querySummary.spotifyError) {
          const detail = `Spotify login failed: ${querySummary.spotifyError}`;
          useJukeboxStore.getState().setError(detail);
          setNotice({
            kind: "error",
            title: "Spotify login failed",
            detail,
          });
          return;
        }

        if (querySummary.spotifyConnected) {
          useJukeboxStore.getState().setError(message);
          setNotice({
            kind: "error",
            title: "Spotify login incomplete",
            detail: message,
          });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [querySummary.officeDebug, querySummary.spotifyConnected, querySummary.spotifyError, querySummary.spotifyHostRedirect, searchParams]);

  const clearNotice = () => {
    setNotice(null);
  };

  return {
    status,
    notice,
    clearNotice,
  };
};
