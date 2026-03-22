import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { useJukeboxStore } from "@/features/spotify-jukebox/state/jukebox-store";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

describe("useSpotifyOfficeBootstrap", () => {
  afterEach(() => {
    cleanup();
    searchParams = new URLSearchParams();
    useJukeboxStore.getState().clearAuth();
    useJukeboxStore.getState().setError(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hydrates spotify auth on office mount after a successful callback", async () => {
    searchParams = new URLSearchParams("spotify_connected=true");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            connected: true,
            hasAccessToken: true,
            hasRefreshToken: true,
            expiresAt: 123456789,
            expired: false,
            scopes: ["user-read-playback-state"],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch,
    );

    const { useSpotifyOfficeBootstrap } = await import(
      "@/features/office/hooks/useSpotifyOfficeBootstrap"
    );

    const Probe = () => {
      const { notice, status } = useSpotifyOfficeBootstrap();
      return createElement(
        "div",
        null,
        createElement("div", { "data-testid": "connected" }, String(status?.connected ?? false)),
        createElement("div", { "data-testid": "notice" }, notice?.detail ?? ""),
      );
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("connected")).toHaveTextContent("true");
    });

    expect(screen.getByTestId("notice")).toHaveTextContent("Spotify connected.");
    expect(useJukeboxStore.getState().isAuthenticated).toBe(true);
    expect(useJukeboxStore.getState().tokenExpiresAt).toBe(123456789);
    expect(useJukeboxStore.getState().error).toBeNull();
  });

  it("surfaces callback errors explicitly on office mount", async () => {
    searchParams = new URLSearchParams("spotify_error=bad_state");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            connected: false,
            hasAccessToken: false,
            hasRefreshToken: false,
            expiresAt: null,
            expired: false,
            scopes: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch,
    );

    const { useSpotifyOfficeBootstrap } = await import(
      "@/features/office/hooks/useSpotifyOfficeBootstrap"
    );

    const Probe = () => {
      const { notice } = useSpotifyOfficeBootstrap();
      return createElement("div", { "data-testid": "notice" }, notice?.detail ?? "");
    };

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByTestId("notice")).toHaveTextContent(
        "Spotify login failed: bad_state",
      );
    });

    expect(useJukeboxStore.getState().isAuthenticated).toBe(false);
    expect(useJukeboxStore.getState().error).toBe("Spotify login failed: bad_state");
  });
});
