import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  getAuthorizationUrl,
  SPOTIFY_OAUTH_STATE_COOKIE,
  resolveSpotifyRedirectOrigin,
  resolveSpotifyRedirectUri,
} from '@/lib/spotify/client';

export async function GET(request: Request) {
  try {
    const state = randomUUID();
    const requestOrigin = new URL(request.url).origin;
    const redirectOrigin = resolveSpotifyRedirectOrigin();
    const redirectUri = resolveSpotifyRedirectUri();
    console.info('spotify.auth.request', {
      hasState: Boolean(state),
      requestOrigin,
      redirectUri,
      redirectOrigin,
      envRedirectOrigin: process.env.SPOTIFY_REDIRECT_ORIGIN ?? null,
      envRedirectUri: process.env.SPOTIFY_REDIRECT_URI ?? null,
    });

    if (requestOrigin !== redirectOrigin) {
      console.warn('spotify.auth.host_mismatch', {
        requestOrigin,
        redirectOrigin,
        redirectUri,
      });
      return NextResponse.json(
        {
          error: 'host_mismatch',
          currentOrigin: requestOrigin,
          canonicalOrigin: redirectOrigin,
          canonicalRedirectUri: redirectUri,
        },
        { status: 409 }
      );
    }

    const authUrl = getAuthorizationUrl(state, redirectUri);
    const response = NextResponse.json({ authUrl });
    response.cookies.set(SPOTIFY_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error('Failed to generate auth URL:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
