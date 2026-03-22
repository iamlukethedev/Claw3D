import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/spotify/status/route';
import { clearStoredTokens } from '@/lib/spotify/client';

describe('spotify status route', () => {
  afterEach(() => {
    clearStoredTokens();
  });

  it('reports authenticated when only an access token cookie is present', async () => {
    const request = new NextRequest('http://localhost:3000/api/spotify/status', {
      headers: {
        cookie: 'spotify_access_token=access-token; spotify_expires_at=123456789',
      },
    });

    const response = await GET(request);
    const body = (await response.json()) as {
      connected?: boolean;
      hasAccessToken?: boolean;
      hasRefreshToken?: boolean;
      expiresAt?: number;
      expired?: boolean;
      scopes?: string[];
    };

    expect(response.status).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.hasAccessToken).toBe(true);
    expect(body.hasRefreshToken).toBe(false);
    expect(body.expiresAt).toBe(123456789);
    expect(body.expired).toBe(true);
    expect(body.scopes).toEqual([]);
  });
});
