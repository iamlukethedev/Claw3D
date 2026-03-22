// Type declarations for spotify-web-api-node
declare module 'spotify-web-api-node' {
  export default class SpotifyWebApi {
    constructor(options?: {
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
      accessToken?: string;
      refreshToken?: string;
    });

    setAccessToken(token: string): void;
    setRefreshToken(token: string): void;

    createAuthorizeURL(scopes: string, state: string): string;
    authorizationCodeGrant(code: string): Promise<{ body: AuthorizationTokenResponse }>;

    refreshAccessToken(): Promise<{ body: RefreshTokenResponse }>;

    getMe(): Promise<{ body: UserObject }>;

    getMyCurrentPlaybackState(): Promise<{ body: PlaybackStateObject | null }>;
    getMyCurrentPlayingTrack(): Promise<{ body: CurrentlyPlayingObject | null }>;

    getMyDevices(): Promise<{ body: DevicesObject }>;

    transferMyPlayback(deviceIds: string[], options?: { play?: boolean }): Promise<unknown>;
    play(options?: { device_id?: string; uris?: string[]; context_uri?: string; offset?: unknown; position_ms?: number }): Promise<unknown>;
    pause(options?: { device_id?: string }): Promise<unknown>;
    skipToNext(options?: { device_id?: string }): Promise<unknown>;
    skipToPrevious(options?: { device_id?: string }): Promise<unknown>;
    setVolume(volumePercent: number, options?: { device_id?: string }): Promise<unknown>;

    search(
      query: string,
      types: string[],
      options?: { limit?: number; offset?: number }
    ): Promise<{ body: SearchResponse }>;

    getUserPlaylists(options?: { limit?: number; offset?: number }): Promise<{ body: ListResponse<PlaylistObject> }>;

    getQueue(): Promise<{ body: QueueObject }>;
    addToQueue(uri: string, options?: { device_id?: string }): Promise<unknown>;
  }

  interface AuthorizationTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope?: string;
  }

  interface RefreshTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
  }

  interface UserObject {
    id: string;
    display_name: string | null;
    email: string;
    images: ImageObject[];
  }

  interface ImageObject {
    url: string;
    height: number | null;
    width: number | null;
  }

  interface PlaybackStateObject {
    device: DeviceObject;
    repeat_state: string;
    shuffle_state: boolean;
    context: ContextObject | null;
    timestamp: number;
    progress_ms: number | null;
    is_playing: boolean;
    item: TrackObject | null;
    currently_playing_type: string;
  }

  interface CurrentlyPlayingObject {
    context: ContextObject | null;
    timestamp: number;
    progress_ms: number | null;
    is_playing: boolean;
    item: TrackObject | null;
    currently_playing_type: string;
  }

  interface DeviceObject {
    id: string;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number | null;
  }

  interface DevicesObject {
    devices: DeviceObject[];
  }

  interface ContextObject {
    uri: string;
    external_urls: { spotify: string };
    href: string;
    type: string;
  }

  interface TrackObject {
    id: string;
    name: string;
    duration_ms: number;
    uri: string;
    preview_url: string | null;
    artists: ArtistObject[];
    album: AlbumObject;
  }

  interface ArtistObject {
    id: string;
    name: string;
    uri: string;
    external_urls?: { spotify: string };
  }

  interface AlbumObject {
    id: string;
    name: string;
    uri: string;
    images: ImageObject[];
    artists: ArtistObject[];
  }

  interface SearchResponse {
    tracks?: ListResponse<TrackObject>;
    playlists?: ListResponse<PlaylistObject>;
    artists?: ListResponse<unknown>;
    albums?: ListResponse<unknown>;
  }

  interface ListResponse<T> {
    href: string;
    items: T[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
  }

  interface PlaylistObject {
    id: string;
    name: string;
    description: string | null;
    images: ImageObject[];
    tracks: { total: number; href: string };
    uri: string;
    owner: {
      id: string;
      display_name: string | null;
      external_urls: { spotify: string };
    };
    public: boolean | null;
    collaborative: boolean;
    snapshot_id: string;
    type: string;
  }

  interface QueueObject {
    currently_playing: TrackObject | null;
    queue: TrackObject[];
  }
}
