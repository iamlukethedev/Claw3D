'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useJukeboxStore } from '../state/jukebox-store';

interface AuthStatus {
  connected: boolean;
  isExpired: boolean;
  expiresAt: number | null;
  hasAccessToken?: boolean;
  hasRefreshToken?: boolean;
  scopes?: string[];
}

const HOST_SWITCH_PENDING_KEY = 'spotify_host_switch_pending';

export function useSpotifyAuth() {
  const searchParams = useSearchParams();
  const {
    isAuthenticated,
    isConnecting,
    error,
    setConnecting,
    clearAuth,
    setAuthState,
    setError,
  } = useJukeboxStore();

  const [status, setStatus] = useState<AuthStatus>({
    connected: false,
    isExpired: false,
    expiresAt: null,
    hasAccessToken: false,
    hasRefreshToken: false,
    scopes: [],
  });

  // Check authentication status
  const checkStatus = useCallback(async () => {
    console.info('spotify.auth.status.start', {
      path: window.location.pathname,
      search: window.location.search,
      hasSpotifyError: Boolean(searchParams.get('spotify_error')),
      hasSpotifyConnected: searchParams.get('spotify_connected') === 'true',
    });
    try {
      const response = await fetch('/api/spotify/status');
      const data = await response.json();
      console.info('spotify.auth.status.result', {
        ok: response.ok,
        status: response.status,
        connected: Boolean(data.connected),
        hasAccessToken: Boolean(data.hasAccessToken),
        hasRefreshToken: Boolean(data.hasRefreshToken),
        expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : null,
        expired: Boolean(data.expired),
      });
      setStatus(data);
      setAuthState(Boolean(data.connected), typeof data.expiresAt === 'number' ? data.expiresAt : null);
      setError(null);
      return data;
    } catch (err) {
      console.error('Failed to check auth status:', err);
      return null;
    }
  }, [searchParams, setAuthState, setError]);

  // Initiate OAuth flow
  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    console.info('spotify.auth.connect.start', {
      path: window.location.pathname,
      search: window.location.search,
    });

    if (window.location.hostname === 'localhost') {
      const nextUrl = new URL(window.location.href);
      nextUrl.hostname = '127.0.0.1';
      nextUrl.searchParams.set('spotify_host_redirect', 'true');
      console.info('spotify.auth.connect.canonicalize', {
        from: window.location.href,
        target: nextUrl.toString(),
      });
      sessionStorage.setItem(HOST_SWITCH_PENDING_KEY, '1');
      window.location.href = nextUrl.toString();
      return;
    }

    try {
      const response = await fetch('/api/spotify/auth');
      const data = await response.json();

      if (response.status === 409 && data?.canonicalOrigin) {
        const target = `${data.canonicalOrigin}/office?spotify_host_redirect=true`;
        console.info('spotify.auth.connect.redirect', {
          reason: 'host_mismatch',
          target,
        });
        sessionStorage.setItem(HOST_SWITCH_PENDING_KEY, '1');
        window.location.href = target;
        return;
      }

      if (data.authUrl) {
        console.info('spotify.auth.connect.redirect', {
          reason: 'oauth_authorize',
          target: data.authUrl,
        });
        sessionStorage.removeItem(HOST_SWITCH_PENDING_KEY);
        // Redirect to Spotify OAuth
        window.location.href = data.authUrl;
      } else {
        setError('Failed to get authorization URL');
        setConnecting(false);
      }
    } catch (err) {
      console.error('Failed to initiate auth:', err);
      setError('Failed to connect to Spotify');
      setConnecting(false);
    }
  }, [setConnecting, setError]);

  // Disconnect/logout
  const disconnect = useCallback(() => {
    clearAuth();
    setStatus({
      connected: false,
      isExpired: false,
      expiresAt: null,
      hasAccessToken: false,
      hasRefreshToken: false,
      scopes: [],
    });
  }, [clearAuth]);

  // Refresh token
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/refresh', { method: 'POST' });
      if (!response.ok) return false;

      const data = await response.json();

      // Bug #3 fix: update the Zustand store with new token info
      if (data.accessToken && data.expiresAt) {
        useJukeboxStore.getState().setAccessToken(data.accessToken, data.expiresAt);
        useJukeboxStore.getState().setAuthState(true, data.expiresAt);
        setError(null);
      }

      return true;
    } catch (err) {
      console.error('Failed to refresh token:', err);
      return false;
    }
  }, [setError]);

  // Initial status check
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    const errorParam = searchParams.get('spotify_error');

    if (errorParam) {
      setError(`Spotify login failed: ${errorParam}`);
    } else if (sessionStorage.getItem(HOST_SWITCH_PENDING_KEY) === '1') {
      sessionStorage.removeItem(HOST_SWITCH_PENDING_KEY);
      void connect();
    }
  }, [checkStatus, connect, searchParams, setError]);

  return {
    isAuthenticated,
    isConnecting,
    error,
    status,
    connect,
    disconnect,
    refresh,
    checkStatus,
  };
}
