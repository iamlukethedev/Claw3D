import { create } from 'zustand';
import type {
  JukeboxState,
  SpotifyUser,
  SpotifyTrack,
  SpotifyPlaybackState,
  SpotifyTokens,
} from '../types';

export const useJukeboxStore = create<JukeboxState>((set) => ({
  // Initial state
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

  // Actions
  setAuthenticated: (tokens: SpotifyTokens, user: SpotifyUser) =>
    set({
      isAuthenticated: true,
      isConnecting: false,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      user,
      error: null,
    }),

  setConnecting: (connecting: boolean) =>
    set({ isConnecting: connecting }),

  clearAuth: () =>
    set({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      user: null,
      currentTrack: null,
      isPlaying: false,
      progress: 0,
      queue: [],
      error: null,
    }),

  updatePlaybackState: (state: SpotifyPlaybackState) =>
    set({
      isPlaying: state.is_playing,
      currentTrack: state.current_track,
      progress: state.progress_ms,
      volume: state.volume,
      deviceId: state.device_id,
    }),

  setCurrentTrack: (track: SpotifyTrack | null) =>
    set({ currentTrack: track }),

  setIsPlaying: (playing: boolean) =>
    set({ isPlaying: playing }),

  setProgress: (progress: number) =>
    set({ progress }),

  setVolume: (volume: number) =>
    set({ volume: Math.max(0, Math.min(100, volume)) }),

  setDeviceId: (deviceId: string | null) =>
    set({ deviceId }),

  setQueue: (queue: SpotifyTrack[]) =>
    set({ queue }),

  addToQueue: (track: SpotifyTrack) =>
    set((state) => ({
      queue: [...state.queue, track],
    })),

  removeFromQueue: (trackId: string) =>
    set((state) => ({
      queue: state.queue.filter((t) => t.id !== trackId),
    })),

  clearQueue: () =>
    set({ queue: [] }),

  openPanel: () =>
    set({ isPanelOpen: true }),

  closePanel: () =>
    set({ isPanelOpen: false }),

  setError: (error: string | null) =>
    set({ error }),

  setAccessToken: (token: string, expiresAt: number) =>
    set({
      accessToken: token,
      tokenExpiresAt: expiresAt,
    }),

  setAuthState: (isAuthenticated: boolean, expiresAt: number | null) =>
    set({
      isAuthenticated,
      tokenExpiresAt: expiresAt,
      isConnecting: false,
    }),
}));

// Selectors for common use cases
export const selectIsPlaying = (state: JukeboxState) => state.isPlaying;
export const selectCurrentTrack = (state: JukeboxState) => state.currentTrack;
export const selectIsAuthenticated = (state: JukeboxState) => state.isAuthenticated;
export const selectIsPanelOpen = (state: JukeboxState) => state.isPanelOpen;
export const selectVolume = (state: JukeboxState) => state.volume;
export const selectQueue = (state: JukeboxState) => state.queue;
export const selectError = (state: JukeboxState) => state.error;
export const selectUser = (state: JukeboxState) => state.user;
