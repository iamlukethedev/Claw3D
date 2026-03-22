import SpotifyWebApi from 'spotify-web-api-node';
import type { NextResponse } from 'next/server';
import type {
  SpotifyTokens,
  SpotifyUser,
  SpotifyPlaybackState,
  SpotifySearchResults,
  SpotifySearchWarning,
  SpotifyPlaylist,
  SpotifyTrack,
  SpotifyQueue,
  SpotifyCurrentlyPlaying,
  SpotifyImage,
} from '@/features/spotify-jukebox/types';
import { isPrivateOrLoopbackHostname } from '@/lib/security/urlSafety';

// Helper to convert Spotify ImageObject to our SpotifyImage type
function convertImage(image: { url: string; height: number | null; width: number | null }): SpotifyImage {
  return {
    url: image.url,
    height: image.height ?? 0,
    width: image.width ?? 0,
  };
}

function hasTrackShape(
  item: {
    id?: unknown;
    name?: unknown;
    artists?: unknown;
    album?: unknown;
    duration_ms?: unknown;
    uri?: unknown;
    preview_url?: unknown;
} | null | undefined,
): item is {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string; uri: string }>;
  album: { id: string; name: string; images: Array<{ url: string; height: number | null; width: number | null }>; uri: string };
  duration_ms: number;
  uri: string;
  preview_url: string | null;
} {
  const track = item;
  const album = track?.album && typeof track.album === 'object' ? track.album as { images?: unknown } : null;
  return Boolean(
    track &&
      typeof track.id === 'string' &&
      typeof track.name === 'string' &&
      Array.isArray(track.artists) &&
      album &&
      Array.isArray(album.images) &&
      typeof track.duration_ms === 'number' &&
      typeof track.uri === 'string',
  );
}

function mapTrackLikeToSpotifyTrack(
  item: unknown,
): {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string; uri: string }>;
  album: { id: string; name: string; images: SpotifyImage[]; uri: string };
  duration_ms: number;
  uri: string;
  preview_url: string | null;
} | null {
  if (!hasTrackShape(item as any)) {
    return null;
  }

  const track = item as {
    id: string;
    name: string;
    artists: Array<{ id: string; name: string; uri: string }>;
    album: {
      id: string;
      name: string;
      images: Array<{ url: string; height: number | null; width: number | null }>;
      uri: string;
    };
    duration_ms: number;
    uri: string;
    preview_url: string | null;
  };

  return {
    id: track.id,
    name: track.name,
    artists: track.artists.map((a) => ({
      id: a.id,
      name: a.name,
      uri: a.uri,
    })),
    album: {
      id: track.album.id,
      name: track.album.name,
      images: track.album.images.map(convertImage),
      uri: track.album.uri,
    },
    duration_ms: track.duration_ms || 0,
    uri: track.uri,
    preview_url: track.preview_url,
  };
}

function resolvePlaybackDeviceOption(deviceId?: string): { device_id?: string } {
  const resolvedDeviceId = deviceId?.trim();
  return resolvedDeviceId ? { device_id: resolvedDeviceId } : {};
}

const DEFAULT_SPOTIFY_REDIRECT_ORIGIN = 'http://127.0.0.1:3000';

function normalizeSpotifyRedirectOrigin(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Spotify redirect origin must use http or https.');
  }
  if (isPrivateOrLoopbackHostname(parsed.hostname) && parsed.hostname !== '127.0.0.1') {
    parsed.hostname = '127.0.0.1';
  }
  return parsed.origin;
}

function mapPlaylistLikeToSpotifyPlaylist(
  item: unknown,
): {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  tracks: { total: number };
  uri: string;
  owner: { display_name: string };
} | null {
  if (!item || typeof item !== "object") return null;
  const playlist = item as {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    images?: unknown;
    tracks?: unknown;
    uri?: unknown;
    owner?: unknown;
  };

  if (
    typeof playlist.id !== "string" ||
    typeof playlist.name !== "string" ||
    typeof playlist.uri !== "string" ||
    !Array.isArray(playlist.images) ||
    !playlist.owner ||
    typeof playlist.owner !== "object"
  ) {
    return null;
  }

  const owner = playlist.owner as { display_name?: unknown };
  const tracks = playlist.tracks as { total?: unknown } | undefined;

  return {
    id: playlist.id,
    name: playlist.name,
    description: typeof playlist.description === "string" ? playlist.description : "",
    images: playlist.images.map((image) => {
      const imageRecord =
        image && typeof image === "object"
          ? (image as { url?: unknown; height?: unknown; width?: unknown })
          : null;
      const height =
        typeof imageRecord?.height === "number" ? imageRecord.height : null;
      const width =
        typeof imageRecord?.width === "number" ? imageRecord.width : null;
      return convertImage({
        url: typeof imageRecord?.url === "string" ? imageRecord.url : "",
        height,
        width,
      });
    }),
    tracks: {
      total: typeof tracks?.total === "number" ? tracks.total : 0,
    },
    uri: playlist.uri,
    owner: {
      display_name:
        typeof owner.display_name === "string" && owner.display_name.trim()
          ? owner.display_name
          : "Unknown",
    },
  };
}

function summarizeSpotifySearchItem(item: unknown): SpotifySearchWarning['summary'] {
  if (item === null) {
    return { kind: 'null' };
  }

  const itemType = typeof item;
  if (itemType !== 'object') {
    return { kind: itemType as SpotifySearchWarning['summary']['kind'] };
  }

  const record = item as Record<string, unknown>;
  return {
    kind: 'object',
    keys: Object.keys(record).slice(0, 12),
    idType: typeof record.id,
    nameType: typeof record.name,
    uriType: typeof record.uri,
    imagesType: Array.isArray(record.images) ? 'array' : typeof record.images,
    ownerType:
      record.owner === null
        ? 'null'
        : Array.isArray(record.owner)
          ? 'array'
          : typeof record.owner,
    albumType:
      record.album === null
        ? 'null'
        : Array.isArray(record.album)
          ? 'array'
          : typeof record.album,
    artistsType:
      record.artists === null
        ? 'null'
        : Array.isArray(record.artists)
          ? 'array'
          : typeof record.artists,
    tracksType:
      record.tracks === null
        ? 'null'
        : Array.isArray(record.tracks)
          ? 'array'
          : typeof record.tracks,
  };
}

function describeInvalidPlaylistItem(item: unknown): string {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return 'item is not an object';
  }

  const playlist = item as {
    id?: unknown;
    name?: unknown;
    images?: unknown;
    uri?: unknown;
    owner?: unknown;
  };
  const missing: string[] = [];

  if (typeof playlist.id !== 'string') missing.push('id');
  if (typeof playlist.name !== 'string') missing.push('name');
  if (typeof playlist.uri !== 'string') missing.push('uri');
  if (!Array.isArray(playlist.images)) missing.push('images');
  if (!playlist.owner || typeof playlist.owner !== 'object' || Array.isArray(playlist.owner)) missing.push('owner');

  return missing.length > 0 ? `missing ${missing.join(', ')}` : 'invalid playlist shape';
}

function describeInvalidTrackItem(item: unknown): string {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return 'item is not an object';
  }

  const track = item as {
    id?: unknown;
    name?: unknown;
    artists?: unknown;
    album?: unknown;
    duration_ms?: unknown;
    uri?: unknown;
  };
  const missing: string[] = [];

  if (typeof track.id !== 'string') missing.push('id');
  if (typeof track.name !== 'string') missing.push('name');
  if (!Array.isArray(track.artists)) missing.push('artists');
  if (!track.album || typeof track.album !== 'object' || Array.isArray(track.album)) missing.push('album');
  if (typeof track.duration_ms !== 'number') missing.push('duration_ms');
  if (typeof track.uri !== 'string') missing.push('uri');

  return missing.length > 0 ? `missing ${missing.join(', ')}` : 'invalid track shape';
}

export function mapSpotifySearchResults(
  body: unknown,
  options?: {
    onWarning?: (warning: SpotifySearchWarning) => void;
  },
): SpotifySearchResults {
  if (!body || typeof body !== "object") {
    throw new Error("search_mapping_failed: response body was not an object");
  }

  const response = body as {
    tracks?: { items?: unknown; total?: unknown };
    playlists?: { items?: unknown; total?: unknown };
  };

  const hasTracksContainer = Object.prototype.hasOwnProperty.call(response, "tracks");
  const hasPlaylistsContainer = Object.prototype.hasOwnProperty.call(response, "playlists");
  if (!hasTracksContainer && !hasPlaylistsContainer) {
    throw new Error("search_mapping_failed: response missing tracks and playlists containers");
  }

  const trackItems = Array.isArray(response.tracks?.items) ? response.tracks.items : [];
  const mappedTracks: SpotifyTrack[] = [];
  for (let index = 0; index < trackItems.length; index += 1) {
    const mapped = mapTrackLikeToSpotifyTrack(trackItems[index]);
    if (mapped) {
      mappedTracks.push(mapped);
      continue;
    }

    const warning: SpotifySearchWarning = {
      type: 'invalid_track',
      index,
      reason: describeInvalidTrackItem(trackItems[index]),
      summary: summarizeSpotifySearchItem(trackItems[index]),
    };
    options?.onWarning?.(warning);
  }

  const playlistItems = Array.isArray(response.playlists?.items) ? response.playlists.items : [];
  const mappedPlaylists: SpotifyPlaylist[] = [];
  for (let index = 0; index < playlistItems.length; index += 1) {
    const mapped = mapPlaylistLikeToSpotifyPlaylist(playlistItems[index]);
    if (mapped) {
      mappedPlaylists.push(mapped);
      continue;
    }

    const warning: SpotifySearchWarning = {
      type: 'invalid_playlist',
      index,
      reason: describeInvalidPlaylistItem(playlistItems[index]),
      summary: summarizeSpotifySearchItem(playlistItems[index]),
    };
    options?.onWarning?.(warning);
  }

  return {
    tracks: {
      items: mappedTracks,
      total:
        typeof response.tracks?.total === "number" && Number.isFinite(response.tracks.total)
          ? response.tracks.total
          : mappedTracks.length,
    },
    playlists: {
      items: mappedPlaylists,
      total:
        typeof response.playlists?.total === "number" && Number.isFinite(response.playlists.total)
          ? response.playlists.total
          : mappedPlaylists.length,
    },
  };
}

const SPOTIFY_SEARCH_DEFAULT_LIMIT = 5;
const SPOTIFY_SEARCH_MAX_LIMIT = 10;

const normalizeSpotifySearchTypes = (
  types: readonly string[] | null | undefined,
): ('track' | 'playlist')[] => {
  const resolved = (types ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is 'track' | 'playlist' => value === 'track' || value === 'playlist');
  return resolved.length > 0 ? resolved : ['track', 'playlist'];
};

const resolveSpotifySearchLimit = (value: string | number | null | undefined): number => {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return SPOTIFY_SEARCH_DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(numeric), SPOTIFY_SEARCH_MAX_LIMIT);
};

const normalizeSpotifySearchMarket = (value: string | null | undefined): string | null => {
  const market = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(market) ? market : null;
};

export function buildSpotifySearchUrl(params: {
  query: string;
  types?: readonly string[] | null;
  limit?: string | number | null;
  market?: string | null;
  offset?: string | number | null;
}): URL {
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', params.query.trim());
  url.searchParams.set('type', normalizeSpotifySearchTypes(params.types).join(','));
  url.searchParams.set('limit', String(resolveSpotifySearchLimit(params.limit)));

  const market = normalizeSpotifySearchMarket(params.market);
  if (market) {
    url.searchParams.set('market', market);
  }

  const offsetValue =
    typeof params.offset === 'number'
      ? params.offset
      : typeof params.offset === 'string'
        ? Number.parseInt(params.offset, 10)
        : Number.NaN;
  if (Number.isFinite(offsetValue) && offsetValue >= 0) {
    url.searchParams.set('offset', String(Math.floor(offsetValue)));
  }

  return url;
}

// Scopes needed for jukebox functionality
const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
];

// Token storage (in production, use proper session/database storage)
interface TokenStore {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes?: string[];
}

export const SPOTIFY_ACCESS_TOKEN_COOKIE = 'spotify_access_token';
export const SPOTIFY_REFRESH_TOKEN_COOKIE = 'spotify_refresh_token';
export const SPOTIFY_EXPIRES_AT_COOKIE = 'spotify_expires_at';
export const SPOTIFY_OAUTH_STATE_COOKIE = 'spotify_oauth_state';
export const SPOTIFY_SCOPES_COOKIE = 'spotify_scopes';

let tokenStore: TokenStore | null = null;

function getSpotifyApi(
  tokens?: TokenStore,
  redirectUri?: string,
): SpotifyWebApi {
  const api = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: redirectUri?.trim() || resolveSpotifyRedirectUri(),
  });

  if (tokens) {
    api.setAccessToken(tokens.accessToken);
    api.setRefreshToken(tokens.refreshToken);
  }

  return api;
}

export function getStoredTokens(): TokenStore | null {
  return tokenStore;
}

export function storeTokens(tokens: SpotifyTokens): void {
  tokenStore = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: tokens.scope?.split(/\s+/).filter(Boolean) ?? [],
  };
}

export function clearStoredTokens(): void {
  tokenStore = null;
}

export function syncStoredTokensToResponse(response: NextResponse, tokens: TokenStore | null): void {
  if (!tokens) return;
  const scopes = tokens.scopes ?? [];

  response.cookies.set(SPOTIFY_ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  });
  response.cookies.set(SPOTIFY_REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set(SPOTIFY_EXPIRES_AT_COOKIE, String(tokens.expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  if (scopes.length > 0) {
    response.cookies.set(SPOTIFY_SCOPES_COOKIE, scopes.join(' '), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export function resolveSpotifyRedirectOrigin(): string {
  const configuredOrigin = process.env.SPOTIFY_REDIRECT_ORIGIN?.trim();
  if (configuredOrigin) {
    return normalizeSpotifyRedirectOrigin(configuredOrigin);
  }

  const configuredRedirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim();
  if (configuredRedirectUri) {
    return normalizeSpotifyRedirectOrigin(new URL(configuredRedirectUri).origin);
  }

  return DEFAULT_SPOTIFY_REDIRECT_ORIGIN;
}

export function resolveSpotifyRedirectUri(): string {
  return `${resolveSpotifyRedirectOrigin()}/api/spotify/callback`;
}

// Generate OAuth authorization URL
export function getAuthorizationUrl(state: string, redirectUri?: string): string {
  const api = getSpotifyApi(undefined, redirectUri);
  // The types for spotify-web-api-node are incorrect - scopes should be string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return api.createAuthorizeURL(SPOTIFY_SCOPES as any, state);
}

type CookieLike = {
  get(name: string): { value?: string } | undefined;
};

export function hydrateStoredTokensFromCookies(cookies: CookieLike): TokenStore | null {
  const accessToken = cookies.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value?.trim() ?? '';
  const refreshToken = cookies.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value?.trim() ?? '';
  const expiresAtRaw = cookies.get(SPOTIFY_EXPIRES_AT_COOKIE)?.value?.trim() ?? '';
  const scopesRaw = cookies.get(SPOTIFY_SCOPES_COOKIE)?.value?.trim() ?? '';
  const expiresAt = Number(expiresAtRaw);

  if (!accessToken && !refreshToken) {
    tokenStore = null;
    return null;
  }

  tokenStore = {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : 0,
    scopes: scopesRaw ? scopesRaw.split(/\s+/).filter(Boolean) : [],
  };
  return tokenStore;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  code: string,
  redirectUri?: string
): Promise<SpotifyTokens> {
  const api = getSpotifyApi(undefined, redirectUri);
  const data = await api.authorizationCodeGrant(code);

  const tokens: SpotifyTokens = {
    access_token: data.body.access_token,
    token_type: data.body.token_type,
    expires_in: data.body.expires_in,
    refresh_token: data.body.refresh_token,
    scope: data.body.scope,
  };

  storeTokens(tokens);
  return tokens;
}

// Refresh access token
export async function refreshAccessToken(): Promise<string> {
  if (!tokenStore) {
    throw new Error('No refresh token available');
  }

  const api = getSpotifyApi({
    accessToken: '',
    refreshToken: tokenStore.refreshToken,
    expiresAt: 0,
  });

  const data = await api.refreshAccessToken();
  const refreshedBody = data.body as typeof data.body & { scope?: string };

  tokenStore = {
    accessToken: refreshedBody.access_token,
    refreshToken: refreshedBody.refresh_token || tokenStore.refreshToken,
    expiresAt: Date.now() + refreshedBody.expires_in * 1000,
    scopes: refreshedBody.scope
      ? refreshedBody.scope.split(/\s+/).filter(Boolean)
      : tokenStore.scopes,
  };

  return refreshedBody.access_token;
}

// Mutex to prevent concurrent refresh race conditions (Bug #4)
let refreshPromise: Promise<string> | null = null;

// Ensure we have a valid access token
export async function getValidAccessToken(): Promise<string> {
  if (!tokenStore) {
    throw new Error('Not authenticated');
  }

  // If token is expired or about to expire (5 minute buffer)
  if (!tokenStore.accessToken || Date.now() >= tokenStore.expiresAt - 300000) {
    // If a refresh is already in progress, await it instead of starting another one
    if (refreshPromise) {
      return refreshPromise;
    }
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  return tokenStore.accessToken;
}

// Get current user profile
export async function getCurrentUser(): Promise<SpotifyUser> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });
  const data = await api.getMe();

  return {
    id: data.body.id,
    display_name: data.body.display_name || 'Unknown',
    email: data.body.email || '',
    images: (data.body.images || []).map(convertImage),
  };
}

// Get current playback state
export async function getPlaybackState(): Promise<SpotifyPlaybackState | null> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  try {
    const data = await api.getMyCurrentPlaybackState();

    if (!data.body || !data.body.item) {
      return {
        is_playing: false,
        current_track: null,
        progress_ms: 0,
        device_id: null,
        device_name: null,
        volume: 0,
      };
    }

    const device = data.body.device;
    const track = mapTrackLikeToSpotifyTrack(data.body.item);
    if (!track) {
      return {
        is_playing: data.body.is_playing,
        current_track: null,
        progress_ms: data.body.progress_ms || 0,
        device_id: device?.id || null,
        device_name: device?.name || null,
        volume: device?.volume_percent || 0,
      };
    }

    return {
      is_playing: data.body.is_playing,
      current_track: track,
      progress_ms: data.body.progress_ms || 0,
      device_id: device?.id || null,
      device_name: device?.name || null,
      volume: device?.volume_percent || 0,
    };
  } catch (error: unknown) {
    // Re-throw NO_ACTIVE_DEVICE so routes can handle it with a specific message
    if (error instanceof Error && error.message.includes('NO_ACTIVE_DEVICE')) {
      throw error;
    }
    throw error;
  }
}

// Get currently playing track (different from playback state)
export async function getCurrentlyPlaying(): Promise<SpotifyCurrentlyPlaying | null> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  try {
    const data = await api.getMyCurrentPlayingTrack();

    if (!data.body || !data.body.item) {
      return null;
    }

    const track = mapTrackLikeToSpotifyTrack(data.body.item);
    if (!track) {
      return null;
    }

    return {
      context: data.body.context
        ? {
            uri: data.body.context.uri,
            type: data.body.context.type as 'album' | 'playlist' | 'artist',
          }
        : null,
      currently_playing_type: (data.body.currently_playing_type as 'track' | 'episode' | 'ad') || 'track',
      is_playing: data.body.is_playing || false,
      item: track,
      progress_ms: data.body.progress_ms || null,
    };
  } catch {
    return null;
  }
}

// Start/resume playback
export async function playTrack(trackUri?: string, deviceId?: string): Promise<void> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  const options: { uris?: string[]; device_id?: string } = {};
  const deviceOptions = resolvePlaybackDeviceOption(deviceId);
  if (deviceOptions.device_id) {
    options.device_id = deviceOptions.device_id;
  }
  if (trackUri) {
    options.uris = [trackUri];
  }

  await api.play(options);
}

// Pause playback
export async function pausePlayback(deviceId?: string): Promise<void> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  const options = resolvePlaybackDeviceOption(deviceId);

  await api.pause(options);
}

// Skip to next track
export async function skipToNext(deviceId?: string): Promise<void> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  const options = resolvePlaybackDeviceOption(deviceId);

  await api.skipToNext(options);
}

// Go to previous track
export async function skipToPrevious(deviceId?: string): Promise<void> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  const options = resolvePlaybackDeviceOption(deviceId);

  await api.skipToPrevious(options);
}

// Set volume (0-100)
export async function setVolume(volume: number, deviceId?: string): Promise<void> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  const options = resolvePlaybackDeviceOption(deviceId);

  // Clamp volume between 0 and 100
  const clampedVolume = Math.max(0, Math.min(100, volume));
  await api.setVolume(clampedVolume, options);
}

// Search for tracks and playlists
export async function searchSpotify(
  query: string,
  types: ('track' | 'playlist')[] = ['track', 'playlist'],
  limit: number = 20
): Promise<SpotifySearchResults> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  const data = await api.search(query, types, { limit });
  return mapSpotifySearchResults(data.body);
}

// Get user's playlists
export async function getUserPlaylists(limit: number = 50): Promise<SpotifyPlaylist[]> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  const data = await api.getUserPlaylists({ limit });

  return data.body.items.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    description: playlist.description || '',
    images: playlist.images.map(convertImage),
    tracks: { total: playlist.tracks?.total || 0 },
    uri: playlist.uri,
    owner: {
      display_name: playlist.owner.display_name || 'Unknown',
    },
  }));
}

// Get queue
export async function getQueue(): Promise<SpotifyQueue> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  const data = await api.getQueue();

  return {
    currently_playing: data.body.currently_playing
      ? {
          id: data.body.currently_playing.id,
          name: data.body.currently_playing.name,
          artists: data.body.currently_playing.artists.map((a) => ({
            id: a.id,
            name: a.name,
            uri: a.uri,
          })),
          album: {
            id: data.body.currently_playing.album?.id || '',
            name: data.body.currently_playing.album?.name || '',
            images: (data.body.currently_playing.album?.images || []).map(convertImage),
            uri: data.body.currently_playing.album?.uri || '',
          },
          duration_ms: data.body.currently_playing.duration_ms || 0,
          uri: data.body.currently_playing.uri,
          preview_url: data.body.currently_playing.preview_url,
        }
      : null,
    queue: data.body.queue.map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((a) => ({
        id: a.id,
        name: a.name,
        uri: a.uri,
      })),
      album: {
        id: track.album?.id || '',
        name: track.album?.name || '',
        images: (track.album?.images || []).map(convertImage),
        uri: track.album?.uri || '',
      },
      duration_ms: track.duration_ms || 0,
      uri: track.uri,
      preview_url: track.preview_url,
    })),
  };
}

// Add track to queue
export async function addToQueue(trackUri: string): Promise<void> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  await api.addToQueue(trackUri);
}

// Start playback of a playlist
export async function playPlaylist(playlistUri: string, deviceId?: string): Promise<void> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  const options: { context_uri?: string; device_id?: string } = {
    context_uri: playlistUri,
    ...resolvePlaybackDeviceOption(deviceId),
  };

  await api.play(options);
}

// Get available devices
export async function getDevices(): Promise<{ id: string; name: string; is_active: boolean }[]> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  const data = await api.getMyDevices();

  return data.body.devices.map((device) => ({
    id: device.id,
    name: device.name,
    is_active: device.is_active,
  }));
}

// Transfer playback to a specific device
export async function transferPlayback(deviceId: string, play = false): Promise<void> {
  const token = await getValidAccessToken();
  const api = getSpotifyApi({ accessToken: token, refreshToken: '', expiresAt: 0 });

  await api.transferMyPlayback([deviceId], { play });
}
