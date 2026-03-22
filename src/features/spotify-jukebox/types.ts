// Spotify API Types

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  uri: string;
}

export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  uri: string;
  preview_url: string | null;
}

export interface SpotifyCurrentlyPlaying {
  context: {
    uri: string;
    type: 'album' | 'playlist' | 'artist';
  } | null;
  currently_playing_type: 'track' | 'episode' | 'ad';
  is_playing: boolean;
  item: SpotifyTrack | null;
  progress_ms: number | null;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  current_track: SpotifyTrack | null;
  progress_ms: number;
  device_id: string | null;
  device_name: string | null;
  volume: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  tracks: {
    total: number;
  };
  uri: string;
  owner: {
    display_name: string;
  };
}

export interface SpotifySearchWarning {
  type: 'invalid_track' | 'invalid_playlist';
  index: number;
  reason: string;
  summary: {
    kind: 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean' | 'undefined' | 'symbol' | 'bigint' | 'function';
    keys?: string[];
    idType?: string;
    nameType?: string;
    uriType?: string;
    imagesType?: string;
    ownerType?: string;
    albumType?: string;
    artistsType?: string;
    tracksType?: string;
  };
}

export interface SpotifySearchResults {
  tracks: {
    items: SpotifyTrack[];
    total: number;
  };
  playlists: {
    items: SpotifyPlaylist[];
    total: number;
  };
  warnings?: SpotifySearchWarning[];
}

export interface SpotifyQueue {
  currently_playing: SpotifyTrack | null;
  queue: SpotifyTrack[];
}

// OAuth Types

export interface SpotifyTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope?: string;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: SpotifyImage[];
}

// Jukebox Feature State Types

export interface JukeboxState {
  // Connection state
  isAuthenticated: boolean;
  isConnecting: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;

  // User info
  user: SpotifyUser | null;

  // Playback state
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  deviceId: string | null;

  // Queue
  queue: SpotifyTrack[];

  // UI state
  isPanelOpen: boolean;
  error: string | null;

  // Actions
  setAuthenticated: (tokens: SpotifyTokens, user: SpotifyUser) => void;
  setConnecting: (connecting: boolean) => void;
  clearAuth: () => void;
  updatePlaybackState: (state: SpotifyPlaybackState) => void;
  setCurrentTrack: (track: SpotifyTrack | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setProgress: (progress: number) => void;
  setVolume: (volume: number) => void;
  setDeviceId: (deviceId: string | null) => void;
  setQueue: (queue: SpotifyTrack[]) => void;
  addToQueue: (track: SpotifyTrack) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setError: (error: string | null) => void;
  setAccessToken: (token: string, expiresAt: number) => void;
  setAuthState: (isAuthenticated: boolean, expiresAt: number | null) => void;
}
