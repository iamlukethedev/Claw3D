"use client";

import { create } from "zustand";
import { loadToken, clearToken, loadClientId, saveClientId } from "./auth";
import {
  fetchPlayerState,
  searchTracks,
  playTrack,
  pausePlayback,
  resumePlayback,
  skipToNext,
  skipToPrevious,
  setVolume,
  type PlayerState,
  type SpotifyTrack,
} from "./spotifyApi";

const SOUNDHERMES_PLAYBACK_STARTED_EVENT = "soundhermes:playback-started";

const emitPlaybackStarted = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SOUNDHERMES_PLAYBACK_STARTED_EVENT, {
      detail: { startedAt: Date.now() },
    }),
  );
};

type JukeboxView = "setup" | "player";

type JukeboxStore = {
  // Auth state.
  token: string | null;
  clientId: string;
  view: JukeboxView;

  // Player state.
  playerState: PlayerState | null;
  searchResults: SpotifyTrack[];
  searchQuery: string;
  isSearching: boolean;
  isLoadingPlayer: boolean;
  error: string | null;

  // Actions.
  init: () => void;
  setClientId: (id: string) => void;
  setToken: (token: string) => void;
  disconnect: () => void;
  refreshPlayer: () => Promise<void>;
  search: (query: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  play: (uri: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  volume: (percent: number) => Promise<void>;
};

export const useJukeboxStore = create<JukeboxStore>((set, get) => ({
  token: null,
  clientId: "",
  view: "setup",
  playerState: null,
  searchResults: [],
  searchQuery: "",
  isSearching: false,
  isLoadingPlayer: false,
  error: null,

  init: () => {
    const token = loadToken();
    const clientId = loadClientId();
    set({
      token,
      clientId,
      view: token ? "player" : "setup",
    });
  },

  setClientId: (id) => {
    saveClientId(id);
    set({ clientId: id });
  },

  setToken: (token) => {
    set({ token, view: "player" });
  },

  disconnect: () => {
    clearToken();
    set({ token: null, view: "setup", playerState: null, searchResults: [], searchQuery: "" });
  },

  refreshPlayer: async () => {
    const { token } = get();
    if (!token) return;
    set({ isLoadingPlayer: true, error: null });
    try {
      const playerState = await fetchPlayerState(token);
      set({ playerState, isLoadingPlayer: false });
    } catch {
      set({ isLoadingPlayer: false, error: "Could not reach Spotify." });
    }
  },

  search: async (query) => {
    const { token } = get();
    if (!token || !query.trim()) return;
    set({ isSearching: true, error: null });
    try {
      const results = await searchTracks(token, query);
      set({ searchResults: results, isSearching: false });
    } catch {
      set({ isSearching: false, error: "Search failed." });
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  play: async (uri) => {
    const { token, playerState } = get();
    if (!token) return;
    set({ error: null });
    try {
      await playTrack(token, uri, playerState?.deviceId);
      // Brief delay for Spotify to update state.
      await new Promise((r) => setTimeout(r, 500));
      await get().refreshPlayer();
      emitPlaybackStarted();
    } catch {
      set({ error: "Playback failed. Make sure Spotify is open on a device." });
    }
  },

  pause: async () => {
    const { token } = get();
    if (!token) return;
    await pausePlayback(token);
    set((s) => ({
      playerState: s.playerState ? { ...s.playerState, isPlaying: false } : null,
    }));
  },

  resume: async () => {
    const { token } = get();
    if (!token) return;
    await resumePlayback(token);
    set((s) => ({
      playerState: s.playerState ? { ...s.playerState, isPlaying: true } : null,
    }));
    emitPlaybackStarted();
  },

  next: async () => {
    const { token } = get();
    if (!token) return;
    await skipToNext(token);
    await new Promise((r) => setTimeout(r, 500));
    await get().refreshPlayer();
  },

  previous: async () => {
    const { token } = get();
    if (!token) return;
    await skipToPrevious(token);
    await new Promise((r) => setTimeout(r, 500));
    await get().refreshPlayer();
  },

  volume: async (percent) => {
    const { token } = get();
    if (!token) return;
    await setVolume(token, percent);
    set((s) => ({
      playerState: s.playerState ? { ...s.playerState, volumePercent: percent } : null,
    }));
  },
}));

export const SOUNDHERMES_PLAYBACK_STARTED_EVENT_NAME = SOUNDHERMES_PLAYBACK_STARTED_EVENT;
