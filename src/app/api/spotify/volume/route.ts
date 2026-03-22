import { NextRequest, NextResponse } from 'next/server';
import {
  getStoredTokens,
  getValidAccessToken,
  hydrateStoredTokensFromCookies,
  setVolume,
  syncStoredTokensToResponse,
} from '@/lib/spotify/client';

export async function POST(request: NextRequest) {
  try {
    hydrateStoredTokensFromCookies(request.cookies);
    const tokens = getStoredTokens();
    if (!tokens || (!tokens.accessToken && !tokens.refreshToken)) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    // Validate auth by calling getValidAccessToken — uses tokenStore (Bug #1 fix)
    await getValidAccessToken();
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { volume, deviceId } = body;

    if (typeof volume !== 'number') {
      return NextResponse.json({ error: 'Volume must be a number' }, { status: 400 });
    }

    await setVolume(volume, deviceId);

    const response = NextResponse.json({ success: true });
    syncStoredTokensToResponse(response, getStoredTokens());
    return response;
  } catch (error) {
    console.error('Failed to set volume:', error);

    if (error instanceof Error && error.message.includes('NO_ACTIVE_DEVICE')) {
      return NextResponse.json(
        { error: 'NO_ACTIVE_DEVICE', message: 'Open Spotify on a device first' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Failed to set volume' }, { status: 500 });
  }
}
