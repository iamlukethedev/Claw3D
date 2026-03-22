'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useJukeboxStore } from '../state/jukebox-store';
import type { SpotifyPlaybackState } from '../types';

const POLL_INTERVAL = 5000; // Poll every 5 seconds

export function usePlaybackState() {
  const {
    currentTrack,
    isPlaying,
    progress,
    volume,
    deviceId,
    isAuthenticated,
    updatePlaybackState,
    setError,
  } = useJukeboxStore();

  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const readResponseDetail = useCallback(async (response: Response, fallback: string) => {
    const body = await response.json().catch(() => null);
    if (body && typeof body === 'object') {
      if ('message' in body && typeof (body as { message?: unknown }).message === 'string') {
        return (body as { message: string }).message;
      }
      if ('detail' in body && typeof (body as { detail?: unknown }).detail === 'string') {
        return (body as { detail: string }).detail;
      }
      if ('error' in body && typeof (body as { error?: unknown }).error === 'string') {
        return (body as { error: string }).error;
      }
    }
    return fallback;
  }, []);

  const normalizeErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (err instanceof Error && err.message.trim()) {
      return err.message;
    }
    return fallback;
  }, []);

  // Fetch current playback state
  const fetchPlaybackState = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/playback');

      if (!response.ok) {
        throw new Error('Failed to fetch playback state');
      }

      const data: SpotifyPlaybackState = await response.json();
      updatePlaybackState(data);
      setError(null);
      setLastUpdated(new Date());
      return data;
    } catch (err) {
      console.error('Failed to fetch playback state:', err);
      setError('Failed to get playback state');
      return null;
    }
  }, [updatePlaybackState, setError]);

  // Toggle play/pause
  const togglePlay = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = isPlaying ? '/api/spotify/pause' : '/api/spotify/play';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      if (!response.ok) {
        throw new Error(await readResponseDetail(response, `Failed to ${isPlaying ? 'pause' : 'play'}`));
      }

      // Refetch state after action
      await fetchPlaybackState();
      setError(null);
    } catch (err) {
      console.error('Failed to toggle play:', err);
      setError(normalizeErrorMessage(err, 'Failed to control playback'));
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, deviceId, fetchPlaybackState, normalizeErrorMessage, readResponseDetail, setError]);

  // Skip to next track
  const skipNext = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/spotify/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to skip');
      }

      // Small delay then refetch
      setTimeout(fetchPlaybackState, 500);
      setError(null);
    } catch (err) {
      console.error('Failed to skip:', err);
      setError(normalizeErrorMessage(err, 'Failed to skip track'));
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, fetchPlaybackState, normalizeErrorMessage, setError]);

  // Go to previous track
  const skipPrevious = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/spotify/previous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to go to previous');
      }

      setTimeout(fetchPlaybackState, 500);
      setError(null);
    } catch (err) {
      console.error('Failed to go to previous:', err);
      setError(normalizeErrorMessage(err, 'Failed to go to previous track'));
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, fetchPlaybackState, normalizeErrorMessage, setError]);

  // Set volume
  const changeVolume = useCallback(
    async (newVolume: number) => {
      try {
        const response = await fetch('/api/spotify/volume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume: newVolume, deviceId }),
        });

        if (!response.ok) {
          throw new Error('Failed to set volume');
        }
        setError(null);
      } catch (err) {
        console.error('Failed to set volume:', err);
        setError(normalizeErrorMessage(err, 'Failed to set volume'));
      }
    },
    [deviceId, normalizeErrorMessage, setError]
  );

  // Play a specific track
  const playTrack = useCallback(
    async (trackUri: string) => {
      setIsLoading(true);
      try {
      const response = await fetch('/api/spotify/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackUri, deviceId }),
      });

      if (!response.ok) {
        throw new Error(await readResponseDetail(response, 'Failed to play track'));
      }

        await fetchPlaybackState();
        setError(null);
      } catch (err) {
        console.error('Failed to play track:', err);
        setError(normalizeErrorMessage(err, 'Failed to play track'));
      } finally {
        setIsLoading(false);
      }
    },
    [deviceId, fetchPlaybackState, normalizeErrorMessage, readResponseDetail, setError]
  );

  const playPlaylist = useCallback(
    async (playlistUri: string) => {
      setIsLoading(true);
      try {
      const response = await fetch('/api/spotify/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistUri, deviceId }),
      });

      if (!response.ok) {
        throw new Error(await readResponseDetail(response, 'Failed to play playlist'));
      }

        await fetchPlaybackState();
        setError(null);
      } catch (err) {
        console.error('Failed to play playlist:', err);
        setError(normalizeErrorMessage(err, 'Failed to play playlist'));
      } finally {
        setIsLoading(false);
      }
    },
    [deviceId, fetchPlaybackState, normalizeErrorMessage, readResponseDetail, setError]
  );

  // Start polling for playback state
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    // Initial fetch
    fetchPlaybackState();

    // Set up interval
    intervalRef.current = setInterval(fetchPlaybackState, POLL_INTERVAL);
  }, [fetchPlaybackState]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-start polling when authenticated
  useEffect(() => {
    const { isAuthenticated } = useJukeboxStore.getState();

    if (isAuthenticated) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [isAuthenticated, startPolling, stopPolling]);

  // Update progress locally for smooth UI (only while playing)
  const [localProgress, setLocalProgress] = useState(progress);

  // Sync local progress when store progress changes (e.g., track change)
  useEffect(() => {
    setLocalProgress(progress);
  }, [progress]);

  // Increment local progress every second while playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setLocalProgress((prev) => {
        const newProgress = prev + 1000;
        if (currentTrack && newProgress >= currentTrack.duration_ms) {
          // Track ended, refetch state
          return 0;
        }
        return newProgress;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack]);

  // Bug #5 fix: refetch playback state when track ends (watching localProgress)
  // instead of calling fetchPlaybackState inside setState updater
  useEffect(() => {
    if (currentTrack && localProgress === 0 && isPlaying) {
      // Track just ended, fetch fresh state
      fetchPlaybackState();
    }
  }, [localProgress, currentTrack, isPlaying, fetchPlaybackState]);

  return {
    currentTrack,
    isPlaying,
    progress: isPlaying ? localProgress : progress,
    volume,
    deviceId,
    isLoading,
    lastUpdated,
    togglePlay,
    skipNext,
    skipPrevious,
    changeVolume,
    playTrack,
    playPlaylist,
    refetch: fetchPlaybackState,
  };
}
