import { afterEach, describe, expect, it, vi } from 'vitest';

const playbackStateMock = {
  body: {
    is_playing: true,
    progress_ms: 42000,
    device: {
      id: 'device-1',
      name: 'Office Speaker',
      volume_percent: 55,
    },
    item: {
      id: 'episode-1',
      name: 'Episode One',
      artists: [],
      duration_ms: 1800000,
      uri: 'spotify:episode:episode-1',
      preview_url: null,
      // Episodes do not have an album field.
    },
  },
};

const emptyPlaybackStateMock = {
  body: null,
};

const currentPlayingMock = {
  body: {
    is_playing: false,
    currently_playing_type: 'episode',
    progress_ms: 0,
    context: null,
    item: {
      id: 'episode-1',
      name: 'Episode One',
      artists: [],
      duration_ms: 1800000,
      uri: 'spotify:episode:episode-1',
      preview_url: null,
    },
  },
};

let mockGetMyCurrentPlaybackState: any = vi.fn(async () => playbackStateMock);
let mockGetMyCurrentPlayingTrack: any = vi.fn(async () => currentPlayingMock);

vi.mock('spotify-web-api-node', () => {
  class MockSpotifyWebApi {
    createAuthorizeURL = vi.fn(() => 'https://example.com');
    authorizationCodeGrant = vi.fn();
    refreshAccessToken = vi.fn();
    getMe = vi.fn();
    getMyCurrentPlaybackState = () => mockGetMyCurrentPlaybackState();
    getMyCurrentPlayingTrack = () => mockGetMyCurrentPlayingTrack();
    play = vi.fn();
    pause = vi.fn();
    skipToNext = vi.fn();
    skipToPrevious = vi.fn();
    setVolume = vi.fn();
    searchTracks = vi.fn();
    getUserPlaylists = vi.fn();
    getPlaylistTracks = vi.fn();
    addToQueue = vi.fn();
    getDevice = vi.fn();
    setAccessToken = vi.fn();
    setRefreshToken = vi.fn();
  }

  return {
    default: MockSpotifyWebApi,
  };
});

import {
  clearStoredTokens,
  getCurrentlyPlaying,
  getPlaybackState,
  storeTokens,
} from '@/lib/spotify/client';

describe('spotify playback mapping', () => {
  afterEach(() => {
    clearStoredTokens();
    mockGetMyCurrentPlaybackState = vi.fn(async () => playbackStateMock);
    mockGetMyCurrentPlayingTrack = vi.fn(async () => currentPlayingMock);
  });

  it('treats non-track playback items as no current track', async () => {
    storeTokens({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: '',
    });

    await expect(getPlaybackState()).resolves.toEqual({
      is_playing: true,
      current_track: null,
      progress_ms: 42000,
      device_id: 'device-1',
      device_name: 'Office Speaker',
      volume: 55,
    });
  });

  it('treats an empty playback response as disconnected state', async () => {
    mockGetMyCurrentPlaybackState = vi.fn(async () => emptyPlaybackStateMock);

    storeTokens({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: '',
    });

    await expect(getPlaybackState()).resolves.toEqual({
      is_playing: false,
      current_track: null,
      progress_ms: 0,
      device_id: null,
      device_name: null,
      volume: 0,
    });
  });

  it('returns null for non-track currently-playing items', async () => {
    storeTokens({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: '',
    });

    await expect(getCurrentlyPlaying()).resolves.toBeNull();
  });
});
