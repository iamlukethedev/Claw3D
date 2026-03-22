import { afterEach, describe, expect, it } from "vitest";
import { NextResponse } from "next/server";

import { GET as spotifyAuthRouteGet } from "@/app/api/spotify/auth/route";
import {
  clearStoredTokens,
  SPOTIFY_ACCESS_TOKEN_COOKIE,
  SPOTIFY_EXPIRES_AT_COOKIE,
  SPOTIFY_REFRESH_TOKEN_COOKIE,
  buildSpotifySearchUrl,
  getAuthorizationUrl,
  getStoredTokens,
  hydrateStoredTokensFromCookies,
  syncStoredTokensToResponse,
} from "@/lib/spotify/client";

describe("spotify client auth helpers", () => {
  const priorClientId = process.env.SPOTIFY_CLIENT_ID;
  const priorClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const priorRedirectOrigin = process.env.SPOTIFY_REDIRECT_ORIGIN;
  const priorRedirectUri = process.env.SPOTIFY_REDIRECT_URI;

  afterEach(() => {
    process.env.SPOTIFY_CLIENT_ID = priorClientId;
    process.env.SPOTIFY_CLIENT_SECRET = priorClientSecret;
    process.env.SPOTIFY_REDIRECT_ORIGIN = priorRedirectOrigin;
    process.env.SPOTIFY_REDIRECT_URI = priorRedirectUri;
    clearStoredTokens();
  });

  it("includes the supplied oauth state in the authorization url", () => {
    process.env.SPOTIFY_CLIENT_ID = "client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "client-secret";
    process.env.SPOTIFY_REDIRECT_ORIGIN = "http://127.0.0.1:3000";

    const authUrl = getAuthorizationUrl("state-123");
    const parsed = new URL(authUrl);

    expect(parsed.searchParams.get("state")).toBe("state-123");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:3000/api/spotify/callback"
    );
  });

  it("hydrates stored tokens from cookies", () => {
    hydrateStoredTokensFromCookies({
      get(name: string) {
        if (name === "spotify_access_token") return { value: "access-token" };
        if (name === "spotify_refresh_token") return { value: "refresh-token" };
        if (name === "spotify_expires_at") return { value: "123456789" };
        return undefined;
      },
    });

    expect(getStoredTokens()).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 123456789,
      scopes: [],
    });
  });

  it("writes stored tokens back to response cookies", () => {
    const response = NextResponse.json({ ok: true });
    syncStoredTokensToResponse(response, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 123456789,
      scopes: [],
    });

    expect(response.cookies.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value).toBe("access-token");
    expect(response.cookies.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value).toBe("refresh-token");
    expect(response.cookies.get(SPOTIFY_EXPIRES_AT_COOKIE)?.value).toBe("123456789");
  });

  it("auth route uses the canonical 127.0.0.1 redirect origin", async () => {
    process.env.SPOTIFY_CLIENT_ID = "client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "client-secret";
    process.env.SPOTIFY_REDIRECT_ORIGIN = "http://127.0.0.1:3000";

    const response = await spotifyAuthRouteGet(
      new Request("http://127.0.0.1:3000/api/spotify/auth")
    );
    const body = (await response.json()) as { authUrl?: string };
    const parsed = new URL(body.authUrl ?? "");

    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:3000/api/spotify/callback"
    );
  });

  it("does not leak localhost into the redirect uri when the request host is localhost", async () => {
    process.env.SPOTIFY_CLIENT_ID = "client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "client-secret";
    process.env.SPOTIFY_REDIRECT_ORIGIN = "http://127.0.0.1:3000";

    const response = await spotifyAuthRouteGet(
      new Request("http://localhost:3000/api/spotify/auth")
    );
    const body = (await response.json()) as {
      currentOrigin?: string;
      canonicalOrigin?: string;
      canonicalRedirectUri?: string;
    };

    expect(response.status).toBe(409);
    expect(body.currentOrigin).toBe("http://localhost:3000");
    expect(body.canonicalOrigin).toBe("http://127.0.0.1:3000");
    expect(body.canonicalRedirectUri).toBe(
      "http://127.0.0.1:3000/api/spotify/callback"
    );
  });

  it("builds a spotify search url with validated optional params", () => {
    const url = buildSpotifySearchUrl({
      query: "Eminem",
      types: ["track", "playlist", "bogus"],
      limit: "20",
      market: "us",
      offset: "3",
    });

    expect(url.toString()).toBe(
      "https://api.spotify.com/v1/search?q=Eminem&type=track%2Cplaylist&limit=10&market=US&offset=3"
    );
  });
});
