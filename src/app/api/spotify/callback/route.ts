import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  SPOTIFY_EXPIRES_AT_COOKIE,
  SPOTIFY_OAUTH_STATE_COOKIE,
  SPOTIFY_ACCESS_TOKEN_COOKIE,
  SPOTIFY_REFRESH_TOKEN_COOKIE,
  SPOTIFY_SCOPES_COOKIE,
  resolveSpotifyRedirectOrigin,
  resolveSpotifyRedirectUri,
  syncStoredTokensToResponse,
} from '@/lib/spotify/client';
import type { SpotifyTokens } from '@/features/spotify-jukebox/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const expectedState = request.cookies.get(SPOTIFY_OAUTH_STATE_COOKIE)?.value?.trim() ?? '';
  const existingRefreshToken = request.cookies.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value?.trim() ?? '';
  const requestOrigin = new URL(request.url).origin;
  const redirectOrigin = resolveSpotifyRedirectOrigin();
  const redirectUri = resolveSpotifyRedirectUri();
  const officeUrl = (path: string) => new URL(path, redirectOrigin);
  const hasCode = Boolean(code);
  const hasState = Boolean(state);
  const stateMatches = Boolean(state && expectedState && state === expectedState);

  console.info('spotify.callback.request', {
    hasCode,
    hasState,
    stateMatches,
    requestOrigin,
    redirectUri,
    redirectOrigin,
    hasExistingRefreshToken: Boolean(existingRefreshToken),
  });

  if (error) {
    console.warn('spotify.callback.error', { error, requestOrigin, redirectUri });
    const target = officeUrl(`/office?spotify_error=${encodeURIComponent(error)}`);
    console.info('spotify.callback.redirect', {
      reason: 'spotify_error',
      target: target.toString(),
    });
    return NextResponse.redirect(
      target
    );
  }

  if (!code) {
    console.warn('spotify.callback.no_code', { requestOrigin, redirectUri });
    const target = officeUrl('/office?spotify_error=no_code');
    console.info('spotify.callback.redirect', {
      reason: 'no_code',
      target: target.toString(),
    });
    return NextResponse.redirect(
      target
    );
  }

  if (!state || !expectedState || state !== expectedState) {
    console.warn('spotify.callback.bad_state', {
      hasState,
      expectedStatePresent: Boolean(expectedState),
      stateMatches,
      requestOrigin,
      redirectUri,
    });
    const target = officeUrl('/office?spotify_error=bad_state');
    console.info('spotify.callback.redirect', {
      reason: 'bad_state',
      target: target.toString(),
    });
    return NextResponse.redirect(
      target
    );
  }

  try {
    const tokens: SpotifyTokens = await exchangeCodeForTokens(code, redirectUri);
    const refreshToken = tokens.refresh_token?.trim() || existingRefreshToken;
    const scopes = tokens.scope?.trim() ? tokens.scope.trim().split(/\s+/).filter(Boolean) : [];
    const tokenExchangeOk = Boolean(tokens.access_token);
    const hasRefreshToken = Boolean(refreshToken);
    const tokenPersisted = Boolean(tokens.access_token);

    console.info('spotify.callback.exchange_ok', {
      tokenExchangeOk,
      hasRefreshToken,
      scopes,
      expiresIn: tokens.expires_in,
      tokenPersisted,
      redirectUri,
    });

    if (!tokenExchangeOk) {
      console.warn('spotify.callback.missing_access_token', { redirectUri });
      const target = officeUrl('/office?spotify_error=token_exchange_failed');
      console.info('spotify.callback.redirect', {
        reason: 'missing_access_token',
        target: target.toString(),
      });
      return NextResponse.redirect(
        target
      );
    }

    const target = officeUrl('/office?spotify_connected=true');
    console.info('spotify.callback.redirect', {
      reason: 'token_exchange_ok',
      target: target.toString(),
      hasRefreshToken: Boolean(refreshToken),
      scopes,
    });
    const response = NextResponse.redirect(
      target
    );
    syncStoredTokensToResponse(response, {
      accessToken: tokens.access_token,
      refreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scopes,
    });
    response.cookies.set(SPOTIFY_EXPIRES_AT_COOKIE, String(Date.now() + tokens.expires_in * 1000), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: tokens.expires_in * 2,
    });
    response.cookies.set(SPOTIFY_OAUTH_STATE_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set(SPOTIFY_ACCESS_TOKEN_COOKIE, tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: tokens.expires_in,
    });
    if (refreshToken) {
      response.cookies.set(SPOTIFY_REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: tokens.expires_in * 2,
      });
    }
    if (scopes.length > 0) {
      response.cookies.set(SPOTIFY_SCOPES_COOKIE, scopes.join(' '), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: tokens.expires_in * 2,
      });
    }

    return response;
  } catch (err) {
    console.error('spotify.callback.token_exchange_failed', {
      error: err instanceof Error ? err.message : String(err),
      requestOrigin,
      redirectUri,
      hasCode,
      hasState,
      stateMatches,
    });
    const target = officeUrl('/office?spotify_error=token_exchange_failed');
    console.info('spotify.callback.redirect', {
      reason: 'token_exchange_failed',
      target: target.toString(),
    });
    return NextResponse.redirect(
      target
    );
  }
}
