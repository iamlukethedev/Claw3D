import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/spotify/search/route";
import { clearStoredTokens } from "@/lib/spotify/client";

const makeRequest = (url: string, cookie = "") =>
  new NextRequest(url, {
    headers: cookie ? { cookie } : undefined,
  });

describe("spotify search route", () => {
  afterEach(() => {
    clearStoredTokens();
    vi.unstubAllGlobals();
  });

  it("returns a structured error when the query is missing", async () => {
    const response = await GET(
      makeRequest("http://localhost:3000/api/spotify/search", "spotify_access_token=token; spotify_expires_at=9999999999999"),
    );

    const body = (await response.json()) as { ok?: boolean; error?: string };

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: "missing_query",
    });
  });

  it("returns a structured error when spotify responds non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Invalid token" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ) as typeof fetch,
    );

    const response = await GET(
      makeRequest(
        "http://localhost:3000/api/spotify/search?q=Eminem",
        "spotify_access_token=token; spotify_refresh_token=refresh; spotify_expires_at=9999999999999",
      ),
    );

    const body = (await response.json()) as {
      ok?: boolean;
      error?: string;
      status?: number;
      body?: unknown;
    };

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: "spotify_api_error",
      status: 401,
    });
    expect(body.body).toMatchObject({ error: { message: "Invalid token" } });
  });

  it("maps a successful spotify search response", async () => {
    const rawResponse = {
      tracks: {
        total: 1,
        items: [
          {
            id: "track-1",
            name: "Lose Yourself",
            artists: [{ id: "artist-1", name: "Eminem", uri: "spotify:artist:1" }],
            album: {
              id: "album-1",
              name: "8 Mile",
              images: [{ url: "https://example.com/cover.jpg", height: 640, width: 640 }],
              uri: "spotify:album:1",
            },
            duration_ms: 326000,
            uri: "spotify:track:1",
            preview_url: null,
          },
        ],
      },
      playlists: {
        total: 1,
        items: [
          {
            id: "playlist-1",
            name: "Eminem Essentials",
            description: "Best of Eminem",
            images: [{ url: "https://example.com/playlist.jpg", height: 300, width: 300 }],
            tracks: { total: 42 },
            uri: "spotify:playlist:1",
            owner: { display_name: "Spotify" },
          },
        ],
      },
    };

    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("https://api.spotify.com/v1/search");
      expect(String(input)).toContain("q=Eminem");
      expect(String(input)).toContain("type=track%2Cplaylist");
      expect(String(input)).toContain("limit=5");
      return new Response(JSON.stringify(rawResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchSpy as typeof fetch);

    const response = await GET(
      makeRequest(
        "http://localhost:3000/api/spotify/search?q=Eminem",
        "spotify_access_token=token; spotify_refresh_token=refresh; spotify_expires_at=9999999999999",
      ),
    );

    const body = (await response.json()) as {
      ok?: boolean;
      tracks?: { items?: Array<{ name?: string }> };
      playlists?: { items?: Array<{ name?: string }> };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.tracks?.items?.[0]?.name).toBe("Lose Yourself");
    expect(body.playlists?.items?.[0]?.name).toBe("Eminem Essentials");
  });

  it("skips a malformed playlist item without failing the whole search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            tracks: {
              total: 1,
              items: [
                {
                  id: "track-1",
                  name: "Lose Yourself",
                  artists: [{ id: "artist-1", name: "Eminem", uri: "spotify:artist:1" }],
                  album: {
                    id: "album-1",
                    name: "8 Mile",
                    images: null,
                    uri: "spotify:album:1",
                  },
                  duration_ms: 326000,
                  uri: "spotify:track:1",
                  preview_url: null,
                },
              ],
            },
            playlists: {
              total: 2,
              items: [
                {
                  id: "playlist-1",
                  name: "Eminem Essentials",
                  description: "Best of Eminem",
                  images: [{ url: "https://example.com/playlist.jpg", height: 300, width: 300 }],
                  tracks: { total: 42 },
                  uri: "spotify:playlist:1",
                  owner: { display_name: "Spotify" },
                },
                {
                  id: "playlist-2",
                  name: "Broken Playlist",
                  description: "Missing owner should be skipped",
                  images: [{ url: "https://example.com/playlist-2.jpg", height: 300, width: 300 }],
                  tracks: { total: 10 },
                  uri: "spotify:playlist:2",
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch,
    );

    const response = await GET(
      makeRequest(
        "http://localhost:3000/api/spotify/search?q=Eminem",
        "spotify_access_token=token; spotify_refresh_token=refresh; spotify_expires_at=9999999999999",
      ),
    );

    const body = (await response.json()) as {
      ok?: boolean;
      playlists?: { items?: Array<{ name?: string }> };
      warnings?: Array<{ type?: string; index?: number; reason?: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.playlists?.items?.map((item) => item.name)).toEqual(["Eminem Essentials"]);
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "invalid_playlist",
          index: 1,
          reason: "missing owner",
        }),
      ]),
    );
  });

  it("returns a mapping failure when the spotify payload is totally unusable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ foo: "bar" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ) as typeof fetch,
    );

    const response = await GET(
      makeRequest(
        "http://localhost:3000/api/spotify/search?q=Eminem",
        "spotify_access_token=token; spotify_refresh_token=refresh; spotify_expires_at=9999999999999",
      ),
    );

    const body = (await response.json()) as {
      ok?: boolean;
      error?: string;
      detail?: string;
    };

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      error: "search_mapping_failed",
    });
    expect(body.detail).toContain("response missing tracks and playlists containers");
  });

  it("clamps overlarge requested limits and drops invalid market values", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("limit")).toBe("10");
      expect(url.searchParams.get("market")).toBeNull();
      expect(url.searchParams.get("type")).toBe("track,playlist");
      return new Response(
        JSON.stringify({
          tracks: { total: 0, items: [] },
          playlists: { total: 0, items: [] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchSpy as typeof fetch);

    const response = await GET(
      makeRequest(
        "http://localhost:3000/api/spotify/search?q=Eminem&limit=20&market=not-a-market",
        "spotify_access_token=token; spotify_refresh_token=refresh; spotify_expires_at=9999999999999",
      ),
    );

    const body = (await response.json()) as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
