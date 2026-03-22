import { NextRequest, NextResponse } from 'next/server';
import {
  getStoredTokens,
  hydrateStoredTokensFromCookies,
  skipToPrevious,
  syncStoredTokensToResponse,
} from '@/lib/spotify/client';

export async function POST(request: NextRequest) {
  try {
    hydrateStoredTokensFromCookies(request.cookies);
    const tokens = getStoredTokens();
    if (!tokens || (!tokens.accessToken && !tokens.refreshToken)) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const { deviceId } = body;

    await skipToPrevious(deviceId);

    const response = NextResponse.json({ success: true });
    syncStoredTokensToResponse(response, getStoredTokens());
    return response;
  } catch (error) {
    console.error('Failed to go to previous:', error);

    if (error instanceof Error && error.message.includes('NO_ACTIVE_DEVICE')) {
      return NextResponse.json(
        { error: 'NO_ACTIVE_DEVICE', message: 'Open Spotify on a device first' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Failed to go to previous' }, { status: 500 });
  }
}
