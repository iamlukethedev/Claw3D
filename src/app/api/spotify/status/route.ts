import { NextRequest, NextResponse } from 'next/server';
import {
  getStoredTokens,
  hydrateStoredTokensFromCookies,
} from '@/lib/spotify/client';

export async function GET(request: NextRequest) {
  hydrateStoredTokensFromCookies(request.cookies);
  const tokens = getStoredTokens();

  const hasAccessToken = Boolean(tokens?.accessToken?.trim());
  const hasRefreshToken = Boolean(tokens?.refreshToken?.trim());
  const expiresAt = tokens?.expiresAt ?? null;
  const expired = typeof expiresAt === 'number' ? Date.now() >= expiresAt : false;
  const scopes = tokens?.scopes ?? [];
  const connected = hasAccessToken || hasRefreshToken;

  return NextResponse.json({
    connected,
    hasAccessToken,
    hasRefreshToken,
    expiresAt,
    expired,
    scopes,
  });
}
