# Spotify Jukebox Feature - Implementation Plan

## Overview

Add a Spotify-connected jukebox to the Claw3D 3D office environment that allows agents and users to play, pause, skip, and select music tracks. The jukebox will be a new interactive 3D object in the retro office with associated UI controls and state management.

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                      Claw3D Frontend                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  SpotifyJukebox  │  │   RetroOffice3D  │                │
│  │   (3D Object)    │  │                  │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                     │                           │
│  ┌────────┴─────────────────────┴─────────┐                │
│  │         Spotify Jukebox Feature         │                │
│  │  ┌─────────────┐  ┌─────────────────┐  │                │
│  │  │ State Store │  │ API Routes      │  │                │
│  │  │ (Zustand)   │  │ /api/spotify/*  │  │                │
│  │  └─────────────┘  └─────────────────┘  │                │
│  └─────────────────────────────────────────┘                │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────┐           │
│  │              Next.js API Routes               │           │
│  │  - OAuth flow                                │           │
│  │  - Token refresh                             │           │
│  │  - Playback control                          │           │
│  │  - Track info                                │           │
│  └───────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Spotify Web API                          │
│  - OAuth 2.0 authentication                                 │
│  - Player control (play, pause, skip)                       │
│  - Currently playing info                                   │
│  - Playlist/track search                                    │
└─────────────────────────────────────────────────────────────┘
```

### Where to Place Code

| Component | Location |
|-----------|----------|
| 3D Jukebox Object | `src/features/retro-office/objects/Jukebox.tsx` |
| Jukebox Feature Module | `src/features/spotify-jukebox/` |
| State Store | `src/features/spotify-jukebox/state/jukebox-store.ts` |
| API Routes | `src/app/api/spotify/` |
| Spotify API Client | `src/lib/spotify/` |
| Type Definitions | `src/features/spotify-jukebox/types.ts` |
| Hooks | `src/features/spotify-jukebox/hooks/` |
| UI Components | `src/features/spotify-jukebox/components/` |
| Office Integration | `src/features/retro-office/` (modify) |

---

## Feature Module Structure

```
src/features/spotify-jukebox/
├── components/
│   ├── JukeboxPanel.tsx        # Control panel overlay
│   ├── TrackDisplay.tsx        # Current track info display
│   ├── PlaylistBrowser.tsx     # Browse/search playlists
│   └── JukeboxControls.tsx     # Play/pause/skip controls
├── hooks/
│   ├── useSpotifyAuth.ts       # OAuth state hook
│   ├── usePlaybackState.ts     # Current playback state
│   └── useSpotifySearch.ts     # Track/playlist search
├── state/
│   └── jukebox-store.ts        # Zustand store for jukebox state
├── types.ts                    # TypeScript interfaces
└── index.ts                    # Public exports
```

---

## Step-by-Step Implementation

### Phase 1: Project Setup & Configuration

**1.1 Add Environment Variables**

Add to `.env.example` and `.env`:
```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback
```

**1.2 Install Dependencies**
```bash
npm install spotify-web-api-node zustand
```

**1.3 Create Type Definitions** (`src/features/spotify-jukebox/types.ts`)

```typescript
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  uri: string;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  current_track: SpotifyTrack | null;
  progress_ms: number;
  device_id: string | null;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
}

export interface JukeboxState {
  isConnected: boolean;
  playbackState: SpotifyPlaybackState | null;
  currentPlaylist: SpotifyPlaylist | null;
  queue: SpotifyTrack[];
  volume: number;
  error: string | null;
}
```

---

### Phase 2: Spotify API Client (`src/lib/spotify/client.ts`)

Create a server-side Spotify API client with:

1. **OAuth 2.0 Flow**
   - Authorization URL generation
   - Token exchange
   - Automatic token refresh

2. **API Methods**
   - `getPlaybackState()` - Current track info
   - `playTrack(trackUri)` - Start playback
   - `pausePlayback()` - Pause
   - `skipTrack()` - Next track
   - `previousTrack()` - Previous track
   - `setVolume(level)` - Volume control (0-100)
   - `searchTracks(query)` - Search for tracks
   - `getUserPlaylists()` - User's playlists

---

### Phase 3: API Routes

Create Next.js API routes under `/src/app/api/spotify/`:

**3.1 OAuth Routes**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/spotify/auth` | GET | Generate OAuth authorization URL |
| `/api/spotify/callback` | GET | Handle OAuth callback, store tokens |
| `/api/spotify/refresh` | POST | Refresh access token |
| `/api/spotify/status` | GET | Check if authenticated |

**3.2 Playback Routes**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/spotify/playback` | GET | Get current playback state |
| `/api/spotify/play` | POST | Start/resume playback |
| `/api/spotify/pause` | POST | Pause playback |
| `/api/spotify/skip` | POST | Skip to next track |
| `/api/spotify/previous` | POST | Go to previous track |
| `/api/spotify/volume` | POST | Set volume |
| `/api/spotify/search` | GET | Search tracks |

---

### Phase 4: State Management

**Zustand Store** (`src/features/spotify-jukebox/state/jukebox-store.ts`)

```typescript
interface JukeboxStore {
  // Connection state
  isAuthenticated: boolean;
  accessToken: string | null;

  // Playback state
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  progress: number;
  volume: number;

  // Queue
  queue: SpotifyTrack[];
  currentPlaylist: SpotifyPlaylist | null;

  // UI state
  isPanelOpen: boolean;
  error: string | null;

  // Actions
  setAuthenticated: (token: string) => void;
  updatePlaybackState: (state: SpotifyPlaybackState) => void;
  setCurrentTrack: (track: SpotifyTrack | null) => void;
  togglePlay: () => void;
  skip: () => void;
  previous: () => void;
  setVolume: (level: number) => void;
  addToQueue: (track: SpotifyTrack) => void;
  openPanel: () => void;
  closePanel: () => void;
}
```

---

### Phase 5: React Hooks

**5.1 `useSpotifyAuth`** - Manage OAuth flow from components

**5.2 `usePlaybackState`** - Poll or websocket for playback updates

**5.3 `useSpotifySearch`** - Debounced track/playlist search

---

### Phase 6: 3D Jukebox Object

Create `src/features/retro-office/objects/Jukebox.tsx`:

**Visual Design:**
- Retro-style jukebox cabinet (can use primitives or simple geometry)
- Animated elements: spinning records, glowing lights
- Click interaction to open jukebox panel

**Implementation Approach:**

```tsx
// Jukebox.tsx - Simplified structure
export function Jukebox({
  position,
  onInteract
}: {
  position: [number, number, number];
  onInteract: () => void;
}) {
  const { currentTrack, isPlaying } = useJukeboxStore();

  return (
    <group position={position} onClick={onInteract}>
      {/* Jukebox cabinet - built with primitives */}
      <mesh>
        <boxGeometry args={[1, 2, 0.5]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Record (spins when playing) */}
      <JukeboxRecord isPlaying={isPlaying} />

      {/* Current track display */}
      <TrackDisplayBillboard track={currentTrack} />

      {/* Glow effect when playing */}
      {isPlaying && <JukeboxGlow />}
    </group>
  );
}
```

**Placement:** Add to lounge area of the office (coordinate ~x=400-600 range based on existing layout)

---

### Phase 7: UI Panel Component

**JukeboxPanel** (`src/features/spotify-jukebox/components/JukeboxPanel.tsx`)

An overlay panel with:
- Current track display (album art, title, artist)
- Play/Pause, Skip, Previous buttons
- Volume slider
- Search input for tracks
- Queue display
- Playlist browser

**Design:**
- Fits the retro office aesthetic (maybe CRT-style display)
- Positioned as an overlay when jukebox is clicked
- Can be dismissed by clicking outside or pressing Escape

---

### Phase 8: Office Integration

**8.1 Add Jukebox to RetroOffice3D**

In `src/features/retro-office/RetroOffice3D.tsx`:
- Import and place `<Jukebox />` in the lounge area
- Add interaction handler to open panel

**8.2 Event Trigger Integration**

In `src/lib/office/eventTriggers.ts`:
- Optional: Add jukebox animations when agents interact
- Example: Agent walks to jukebox, presses buttons

**8.3 Settings Persistence**

In `src/lib/studio/settings.ts`:
- Persist user's Spotify connection status
- Remember last played track/playlist

---

## File Changes Summary

### New Files to Create

```
src/features/spotify-jukebox/
├── index.ts
├── types.ts
├── components/
│   ├── JukeboxPanel.tsx
│   ├── TrackDisplay.tsx
│   ├── PlaylistBrowser.tsx
│   └── JukeboxControls.tsx
├── hooks/
│   ├── useSpotifyAuth.ts
│   ├── usePlaybackState.ts
│   └── useSpotifySearch.ts
└── state/
    └── jukebox-store.ts

src/lib/spotify/
├── client.ts
└── types.ts

src/app/api/spotify/
├── auth/route.ts
├── callback/route.ts
├── refresh/route.ts
├── status/route.ts
├── playback/route.ts
├── play/route.ts
├── pause/route.ts
├── skip/route.ts
├── previous/route.ts
├── volume/route.ts
└── search/route.ts

src/features/retro-office/objects/
└── Jukebox.tsx (new interactive object)
```

### Files to Modify

| File | Changes |
|------|---------|
| `.env.example` | Add Spotify env vars |
| `package.json` | Add spotify-web-api-node, zustand |
| `src/features/retro-office/RetroOffice3D.tsx` | Import and place Jukebox |
| `src/lib/studio/settings.ts` | Add Spotify settings schema |

---

## Implementation Order

1. **Setup** - Env vars, dependencies, types
2. **API Client** - Spotify Web API wrapper
3. **API Routes** - OAuth + playback control endpoints
4. **State Store** - Zustand store for jukebox state
5. **Hooks** - React hooks for components
6. **3D Object** - Jukebox visual in office
7. **UI Panel** - Control overlay component
8. **Office Integration** - Wire into RetroOffice3D
9. **Testing** - Unit tests, e2e tests
10. **Documentation** - Update docs

---

## Spotify API Scopes Required

```
streaming          # Playback control
user-read-playback-state  # Get current playback
user-modify-playback-state  # Control playback
user-read-currently-playing  # Get current track
user-library-read  # Access user playlists (optional)
playlist-read-private  # Browse playlists (optional)
```

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Not authenticated | Show "Connect to Spotify" button |
| Token expired | Auto-refresh, re-auth if fails |
| No active device | Prompt user to start Spotify app |
| Playback failed | Show error toast, log details |
| Network error | Retry with exponential backoff |

---

## Testing Strategy

**Unit Tests:**
- Spotify client methods (mocked responses)
- Zustand store actions
- Hook behavior

**E2E Tests:**
- OAuth flow (requires Spotify dev app)
- Playback controls
- Jukebox interaction in 3D scene

---

## Future Enhancements (Post-MVP)

1. **Agent Jukebox Control** - Agents can trigger music via desk directives
2. **Room-Based Audio** - Different music in different zones
3. **Music Visualizer** - Reactive visuals in 3D
4. **Playlist Presets** - Quick-select mood-based playlists
5. **Social Features** - Users can request songs

---

## Compatibility Notes

- This feature is **standalone** and does not require OpenClaw changes
- Spotify authentication is handled entirely within Claw3D
- No gateway modifications needed
- Works with existing office navigation and event systems
