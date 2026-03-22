import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockGetMyDevices = vi.fn(async () => ({ body: { devices: [] as Array<{ id: string; name: string; is_active: boolean }> } }));
const mockGetMyCurrentPlaybackState = vi.fn(async () => ({ body: null }));
const mockTransferMyPlayback: any = vi.fn(async () => ({}));
const mockPlay: any = vi.fn(async () => ({}));

vi.mock('spotify-web-api-node', () => {
  class MockSpotifyWebApi {
    createAuthorizeURL = vi.fn(() => 'https://example.com');
    authorizationCodeGrant = vi.fn();
    refreshAccessToken = vi.fn();
    getMe = vi.fn();
    getMyCurrentPlaybackState = () => mockGetMyCurrentPlaybackState();
    getMyCurrentPlayingTrack = vi.fn();
    getMyDevices = () => mockGetMyDevices();
    transferMyPlayback = (deviceIds: string[], options?: { play?: boolean }) =>
      mockTransferMyPlayback(deviceIds, options);
    play = (options?: { device_id?: string; uris?: string[]; context_uri?: string }) =>
      mockPlay(options);
    pause = vi.fn();
    skipToNext = vi.fn();
    skipToPrevious = vi.fn();
    setVolume = vi.fn();
    search = vi.fn();
    getUserPlaylists = vi.fn();
    getQueue = vi.fn();
    addToQueue = vi.fn();
    setAccessToken = vi.fn();
    setRefreshToken = vi.fn();
  }

  return {
    default: MockSpotifyWebApi,
  };
});

import { POST } from '@/app/api/spotify/play/route';
import { clearStoredTokens } from '@/lib/spotify/client';

const makeRequest = (body: Record<string, unknown>, cookie = '') =>
  new NextRequest('http://localhost:3000/api/spotify/play', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

describe('spotify play route', () => {
  afterEach(() => {
    clearStoredTokens();
    mockGetMyDevices.mockReset();
    mockGetMyCurrentPlaybackState.mockReset();
    mockTransferMyPlayback.mockReset();
    mockPlay.mockReset();
    mockGetMyDevices.mockResolvedValue({ body: { devices: [] } });
    mockGetMyCurrentPlaybackState.mockResolvedValue({ body: null });
    mockTransferMyPlayback.mockResolvedValue({});
    mockPlay.mockResolvedValue({});
  });

  const authCookie =
    'spotify_access_token=access-token; spotify_refresh_token=refresh-token; spotify_expires_at=9999999999999; spotify_scopes=user-modify-playback-state';

  it('returns a structured error when playback scope is missing', async () => {
    const response = await POST(
      makeRequest(
        { trackUri: 'spotify:track:1' },
        'spotify_access_token=access-token; spotify_refresh_token=refresh-token; spotify_expires_at=9999999999999',
      ),
    );

    const body = (await response.json()) as { ok?: boolean; error?: string; scope?: string };

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      error: 'missing_scope',
      scope: 'user-modify-playback-state',
    });
    expect(mockGetMyDevices).not.toHaveBeenCalled();
  });

  it('returns no_active_device when there are no playable devices', async () => {
    mockGetMyDevices.mockResolvedValue({ body: { devices: [] } });

    const response = await POST(
      makeRequest(
        { trackUri: 'spotify:track:1' },
        authCookie,
      ),
    );

    const body = (await response.json()) as { ok?: boolean; error?: string; availableDevices?: unknown[] };

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      error: 'no_active_device',
    });
    expect(body.availableDevices).toEqual([]);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('resumes playback without requiring a trackUri when current playback exists', async () => {
    mockGetMyCurrentPlaybackState.mockResolvedValue({
      body: {
        is_playing: false,
        progress_ms: 12345,
        device: {
          id: 'device-1',
          name: 'Office Speaker',
          volume_percent: 55,
        },
        item: {
          id: 'track-1',
          name: 'Example Track',
          artists: [
            { id: 'artist-1', name: 'Example Artist', uri: 'spotify:artist:artist-1' },
          ],
          duration_ms: 180000,
          uri: 'spotify:track:track-1',
          preview_url: null,
          album: {
            id: 'album-1',
            name: 'Example Album',
            uri: 'spotify:album:album-1',
            images: [],
            artists: [],
          },
        },
      },
    } as any);

    const response = await POST(
      makeRequest({}, authCookie),
    );

    const body = (await response.json()) as {
      ok?: boolean;
      success?: boolean;
      mode?: string;
      deviceId?: string;
      transferred?: boolean;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      success: true,
      mode: 'resume',
      deviceId: 'device-1',
      transferred: false,
    });
    expect(mockPlay).toHaveBeenCalledWith({ device_id: 'device-1' });
  });

  it('returns no_playback_context when play is requested without a resumable context', async () => {
    mockGetMyCurrentPlaybackState.mockResolvedValue({ body: null });

    const response = await POST(
      makeRequest({}, authCookie),
    );

    const body = (await response.json()) as {
      ok?: boolean;
      error?: string;
      message?: string;
    };

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: 'no_playback_context',
      message: 'No playback context to resume',
    });
    expect(mockGetMyDevices).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('uses the active device for playback', async () => {
    mockGetMyDevices.mockResolvedValue({
      body: {
        devices: [
          { id: 'device-1', name: 'Office Speaker', is_active: true },
        ],
      },
    } as any);

    const response = await POST(
      makeRequest(
        { trackUri: 'spotify:track:1' },
        authCookie,
      ),
    );

    const body = (await response.json()) as {
      ok?: boolean;
      success?: boolean;
      deviceId?: string;
      transferred?: boolean;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      success: true,
      deviceId: 'device-1',
      transferred: false,
    });
    expect(mockTransferMyPlayback).not.toHaveBeenCalled();
    expect(mockPlay).toHaveBeenCalledWith({ device_id: 'device-1', uris: ['spotify:track:1'] });
  });

  it('transfers playback to a non-active supplied device before starting playback', async () => {
    mockGetMyDevices.mockResolvedValue({
      body: {
        devices: [
          { id: 'device-1', name: 'Office Speaker', is_active: false },
        ],
      },
    } as any);

    const response = await POST(
      makeRequest(
        { trackUri: 'spotify:track:1', deviceId: 'device-1' },
        authCookie,
      ),
    );

    const body = (await response.json()) as {
      ok?: boolean;
      success?: boolean;
      deviceId?: string;
      transferred?: boolean;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      success: true,
      deviceId: 'device-1',
      transferred: true,
    });
    expect(mockTransferMyPlayback).toHaveBeenCalledWith(['device-1'], { play: false });
    expect(mockPlay).toHaveBeenCalledWith({ device_id: 'device-1', uris: ['spotify:track:1'] });
  });

  it('surfaces upstream spotify playback errors', async () => {
    mockGetMyDevices.mockResolvedValue({
      body: {
        devices: [
          { id: 'device-1', name: 'Office Speaker', is_active: true },
        ],
      },
    } as any);
    const error = Object.assign(new Error('Forbidden'), {
      statusCode: 403,
      body: { error: { message: 'Player command failed: Premium required' } },
    });
    mockPlay.mockRejectedValue(error);

    const response = await POST(
      makeRequest(
        { trackUri: 'spotify:track:1' },
        authCookie,
      ),
    );

    const body = (await response.json()) as {
      ok?: boolean;
      error?: string;
      message?: string;
      status?: number;
    };

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      error: 'premium_required',
      message: 'Spotify Premium is required for playback',
      status: 403,
    });
  });
});
