import { NextRequest, NextResponse } from 'next/server';
import {
  getStoredTokens,
  getPlaybackState,
  getValidAccessToken,
  hydrateStoredTokensFromCookies,
  syncStoredTokensToResponse,
} from '@/lib/spotify/client';

export async function GET(request: NextRequest) {
  try {
    hydrateStoredTokensFromCookies(request.cookies);
    const tokens = getStoredTokens();
    if (!tokens || (!tokens.accessToken && !tokens.refreshToken)) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    // Validate auth via tokenStore (Bug #1 fix)
    await getValidAccessToken();
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const playbackState = await getPlaybackState();

    if (!playbackState) {
      const response = NextResponse.json({
        is_playing: false,
        current_track: null,
        progress_ms: 0,
        device_id: null,
        device_name: null,
        volume: 0,
      });
      syncStoredTokensToResponse(response, getStoredTokens());
      return response;
    }

    const response = NextResponse.json(playbackState);
    syncStoredTokensToResponse(response, getStoredTokens());
    return response;
  } catch (error) {
    console.error('Failed to get playback state:', error);

    if (error instanceof Error && error.message.includes('NO_ACTIVE_DEVICE')) {
      return NextResponse.json(
        { error: 'NO_ACTIVE_DEVICE', message: 'Open Spotify on a device first' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Failed to get playback state' }, { status: 500 });
  }
}
