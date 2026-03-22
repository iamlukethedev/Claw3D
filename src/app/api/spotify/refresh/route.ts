import { NextRequest, NextResponse } from 'next/server';
import {
  getStoredTokens,
  hydrateStoredTokensFromCookies,
  refreshAccessToken,
  syncStoredTokensToResponse,
} from '@/lib/spotify/client';

export async function POST(request: NextRequest) {
  try {
    hydrateStoredTokensFromCookies(request.cookies);
    const newToken = await refreshAccessToken();
    const tokens = getStoredTokens();

    const response = NextResponse.json({
      success: true,
      accessToken: newToken,
      expiresAt: tokens?.expiresAt ?? null,
    });
    syncStoredTokensToResponse(response, tokens);

    return response;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
  }
}
