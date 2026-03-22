import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/spotify/client', () => ({
  exchangeCodeForTokens: vi.fn(),
  resolveSpotifyRedirectOrigin: () => 'http://127.0.0.1:3000',
  resolveSpotifyRedirectUri: () => 'http://127.0.0.1:3000/api/spotify/callback',
  SPOTIFY_ACCESS_TOKEN_COOKIE: 'spotify_access_token',
  SPOTIFY_REFRESH_TOKEN_COOKIE: 'spotify_refresh_token',
  SPOTIFY_EXPIRES_AT_COOKIE: 'spotify_expires_at',
  SPOTIFY_OAUTH_STATE_COOKIE: 'spotify_oauth_state',
  SPOTIFY_SCOPES_COOKIE: 'spotify_scopes',
  syncStoredTokensToResponse: vi.fn(),
}));

import { GET } from '@/app/api/spotify/callback/route';
import {
  exchangeCodeForTokens,
  SPOTIFY_ACCESS_TOKEN_COOKIE,
  SPOTIFY_REFRESH_TOKEN_COOKIE,
  SPOTIFY_EXPIRES_AT_COOKIE,
} from '@/lib/spotify/client';

describe('spotify callback route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps an existing refresh token when spotify omits one on callback', async () => {
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: 'new-access',
      refresh_token: '',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: '',
    });

    const request = new NextRequest(
      'http://127.0.0.1:3000/api/spotify/callback?code=code-123&state=state-123',
      {
        headers: {
          cookie:
            'spotify_oauth_state=state-123; spotify_refresh_token=existing-refresh',
        },
      }
    );

    const response = await GET(request);

    expect(response.headers.get('location')).toBe(
      'http://127.0.0.1:3000/office?spotify_connected=true'
    );
    expect(response.cookies.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value).toBe('new-access');
    expect(response.cookies.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value).toBe('existing-refresh');
    expect(response.cookies.get(SPOTIFY_EXPIRES_AT_COOKIE)?.value).toBeTruthy();
  });

  it('redirects back to office with an explicit error when spotify returns an error', async () => {
    const request = new NextRequest(
      'http://127.0.0.1:3000/api/spotify/callback?error=access_denied',
    );

    const response = await GET(request);

    expect(response.headers.get('location')).toBe(
      'http://127.0.0.1:3000/office?spotify_error=access_denied'
    );
  });

  it('redirects back to the canonical office origin regardless of request host', async () => {
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: '',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/spotify/callback?code=code-123&state=state-123',
      {
        headers: {
          cookie: 'spotify_oauth_state=state-123',
        },
      }
    );

    const response = await GET(request);

    expect(response.headers.get('location')).toBe(
      'http://127.0.0.1:3000/office?spotify_connected=true'
    );
  });
});
