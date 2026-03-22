import { NextRequest, NextResponse } from 'next/server';
import {
  buildSpotifySearchUrl,
  getStoredTokens,
  hydrateStoredTokensFromCookies,
  getValidAccessToken,
  mapSpotifySearchResults,
  syncStoredTokensToResponse,
} from '@/lib/spotify/client';
import type { SpotifySearchWarning } from '@/features/spotify-jukebox/types';

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const requestMeta = {
      path: requestUrl.pathname,
      search: requestUrl.search || null,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    };
    console.info('spotify.search.request', requestMeta);

    hydrateStoredTokensFromCookies(request.cookies);
    const tokens = getStoredTokens();
    const hasAccessToken = Boolean(tokens?.accessToken?.trim());
    const hasRefreshToken = Boolean(tokens?.refreshToken?.trim());
    const expiresAt = tokens?.expiresAt ?? null;
    const expired = typeof expiresAt === 'number' ? Date.now() >= expiresAt : false;
    console.info('spotify.search.session', {
      ...requestMeta,
      connected: hasAccessToken || hasRefreshToken,
      hasAccessToken,
      hasRefreshToken,
      expiresAt,
      expired,
      scopes: tokens?.scopes ?? [],
    });

    if (!tokens || (!hasAccessToken && !hasRefreshToken)) {
      console.warn('spotify.search.not_connected', requestMeta);
      return NextResponse.json(
        { ok: false, error: 'not_connected' },
        { status: 401 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim() ?? '';
    const type = searchParams.get('type') || 'track,playlist';
    const market = searchParams.get('market');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const types = type
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry): entry is 'track' | 'playlist' => entry === 'track' || entry === 'playlist');
    const resolvedTypes = types.length > 0 ? types : ['track', 'playlist'];

    console.info('spotify.search.parsed_query', {
      ...requestMeta,
      query: query || null,
      type,
      types: resolvedTypes,
      limit: limit ? Number.parseInt(limit, 10) : null,
      market: market?.trim() || null,
      offset: offset ? Number.parseInt(offset, 10) : null,
    });

    if (!query) {
      console.warn('spotify.search.missing_query', requestMeta);
      return NextResponse.json(
        { ok: false, error: 'missing_query' },
        { status: 400 },
      );
    }

    console.info('spotify.search.token.check', {
      ...requestMeta,
      tokenState: {
        hasAccessToken,
        hasRefreshToken,
        expiresAt,
        expired,
      },
      refreshAttemptPlanned: !hasAccessToken || expired,
    });

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('spotify.search.token_error', {
        ...requestMeta,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return NextResponse.json(
        {
          ok: false,
          error: 'token_refresh_failed',
          detail: message,
        },
        { status: 401 },
      );
    }

    const spotifyUrl = buildSpotifySearchUrl({
      query,
      types: resolvedTypes,
      limit,
      market,
      offset,
    });

    console.info('spotify.search.upstream_request', {
      ...requestMeta,
      url: spotifyUrl.toString(),
      types: resolvedTypes,
      limit: spotifyUrl.searchParams.get('limit'),
      market: spotifyUrl.searchParams.get('market'),
      offset: spotifyUrl.searchParams.get('offset'),
    });

    const requestHeaders = {
      Authorization: `Bearer ${accessToken}`,
    };
    console.info('spotify.search.upstream_headers', {
      ...requestMeta,
      headers: {
        Authorization: 'Bearer [redacted]',
      },
    });

    const spotifyResponse = await fetch(spotifyUrl, {
      headers: requestHeaders,
      cache: 'no-store',
    });

    console.info('spotify.search.upstream_response', {
      ...requestMeta,
      status: spotifyResponse.status,
      ok: spotifyResponse.ok,
    });

    const responseText = await spotifyResponse.text();
    let responseBody: unknown = null;
    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
    }

    if (!spotifyResponse.ok) {
      console.warn('spotify.search.upstream_error', {
        ...requestMeta,
        status: spotifyResponse.status,
        body: responseBody,
      });
      return NextResponse.json(
        {
          ok: false,
          error: 'spotify_api_error',
          status: spotifyResponse.status,
          body: responseBody,
        },
        { status: spotifyResponse.status },
      );
    }

    console.info('spotify.search.mapping.start', {
      ...requestMeta,
      responseKeys:
        responseBody && typeof responseBody === 'object'
          ? Object.keys(responseBody as Record<string, unknown>)
          : [],
    });

    const warnings: SpotifySearchWarning[] = [];
    let results;
    try {
      results = mapSpotifySearchResults(responseBody, {
        onWarning: (warning) => {
          warnings.push(warning);
          if (warning.type === 'invalid_playlist') {
            console.warn('spotify.search.invalid_playlist_item', {
              ...requestMeta,
              index: warning.index,
              reason: warning.reason,
              summary: warning.summary,
            });
          } else {
            console.warn('spotify.search.invalid_track_item', {
              ...requestMeta,
              index: warning.index,
              reason: warning.reason,
              summary: warning.summary,
            });
          }
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('spotify.search.mapping_failed', {
        ...requestMeta,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return NextResponse.json(
        {
          ok: false,
          error: 'search_mapping_failed',
          detail: message,
        },
        { status: 500 },
      );
    }

    console.info('spotify.search.mapping.complete', {
      ...requestMeta,
      trackCount: results.tracks.items.length,
      playlistCount: results.playlists.items.length,
      warningCount: warnings.length,
    });

    const response = NextResponse.json({
      ok: true,
      ...results,
      ...(warnings.length ? { warnings } : {}),
    });
    syncStoredTokensToResponse(response, getStoredTokens());
    return response;
  } catch (error) {
    console.error('spotify.search.exception', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'search_exception',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
