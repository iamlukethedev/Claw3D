import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";

import { usePlaybackState } from "@/features/spotify-jukebox/hooks/usePlaybackState";
import { useJukeboxStore } from "@/features/spotify-jukebox/state/jukebox-store";

const track = {
  id: "track-1",
  name: "Example Track",
  artists: [{ id: "artist-1", name: "Example Artist", uri: "spotify:artist:artist-1" }],
  album: {
    id: "album-1",
    name: "Example Album",
    images: [],
    uri: "spotify:album:album-1",
  },
  duration_ms: 180000,
  uri: "spotify:track:track-1",
  preview_url: null,
};

const resumedPlaybackStateBody = {
  is_playing: true,
  current_track: track,
  progress_ms: 12000,
  device_id: "device-1",
  device_name: "Office Speaker",
  volume: 55,
};

const pausedPlaybackStateBody = {
  is_playing: false,
  current_track: track,
  progress_ms: 12000,
  device_id: "device-1",
  device_name: "Office Speaker",
  volume: 55,
};

const renderProbe = () => {
  let value: ReturnType<typeof usePlaybackState> | null = null;

  const Probe = () => {
    value = usePlaybackState();
    return createElement("div", { "data-testid": "probe" }, "ok");
  };

  const rendered = render(createElement(Probe));

  return {
    getValue: () => {
      if (!value) {
        throw new Error("hook value unavailable");
      }
      return value;
    },
    rerender: rendered.rerender,
  };
};

const requestUrl = (input: string | Request | URL) =>
  typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();

describe("usePlaybackState toggle playback", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useJukeboxStore.setState({
      isAuthenticated: false,
      isConnecting: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      user: null,
      currentTrack: null,
      isPlaying: false,
      progress: 0,
      volume: 50,
      deviceId: null,
      queue: [],
      isPanelOpen: false,
      error: null,
    });
  });

  it("pauses through the pause route when playback is already running", async () => {
    useJukeboxStore.setState({
      currentTrack: track,
      isPlaying: true,
      progress: 12000,
      volume: 55,
      deviceId: "device-1",
      isAuthenticated: false,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url === "/api/spotify/pause") {
        return Response.json({ success: true });
      }
      if (url === "/api/spotify/playback") {
        return Response.json(pausedPlaybackStateBody);
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const { getValue } = renderProbe();

    await act(async () => {
      await getValue().togglePlay();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/spotify/pause",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ deviceId: "device-1" }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/spotify/playback");
  });

  it("resumes through the play route without sending a track uri", async () => {
    useJukeboxStore.setState({
      currentTrack: track,
      isPlaying: false,
      progress: 12000,
      volume: 55,
      deviceId: "device-1",
      isAuthenticated: false,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = requestUrl(input);
      if (url === "/api/spotify/play") {
        return Response.json({ ok: true, success: true, deviceId: "device-1", mode: "resume" });
      }
      if (url === "/api/spotify/playback") {
        return Response.json(resumedPlaybackStateBody);
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const { getValue } = renderProbe();

    await act(async () => {
      await getValue().togglePlay();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/spotify/play",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ deviceId: "device-1" }),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/spotify/play",
      expect.objectContaining({
        body: expect.stringContaining("trackUri"),
      }),
    );
    await waitFor(() => {
      expect(useJukeboxStore.getState().error).toBeNull();
    });
  });

  it("surfaces the explicit no playback context error when nothing can be resumed", async () => {
    useJukeboxStore.setState({
      currentTrack: null,
      isPlaying: false,
      progress: 0,
      volume: 55,
      deviceId: null,
      isAuthenticated: false,
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url === "/api/spotify/play") {
        return Response.json(
          { ok: false, error: "no_playback_context", message: "No playback context to resume" },
          { status: 400 },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const { getValue } = renderProbe();

    await act(async () => {
      await getValue().togglePlay();
    });

    expect(useJukeboxStore.getState().error).toBe("No playback context to resume");
  });
});
