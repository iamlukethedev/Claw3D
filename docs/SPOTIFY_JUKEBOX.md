# SOUNDCLAW — PR Handoff Notes
**Commit:** `c62041e` — feat: add Spotify jukebox with full OAuth flow
**Repo:** `~/.openclaw/workspace/claw3d`
**Branch:** `main` (2 commits ahead of `origin/main`)

---

## What Is SOUNDCLAW

SOUNDCLAW is the in-app music console embedded in the Claw3D 3D office. It is powered by Spotify.

Click the jukebox in the 3D environment to open a full control panel: OAuth connection, track and playlist search, playback controls (play, pause, skip, previous, volume), device selection, and a now-playing display with album art, track title, artist, and progress bar.

All Spotify API calls route through server-side Next.js routes — tokens never touch the browser.

---

## How It Works

### OAuth flow
1. User clicks **Connect Spotify** in the SOUNDCLAW panel
2. Browser navigates to Spotify's authorization page with scopes: `streaming user-read-playback-state user-modify-playback-state user-read-currently-playing`
3. Spotify redirects back to `/api/spotify/callback?code=...`
4. Server exchanges the code for access + refresh tokens; stores them in **httpOnly cookies**

### Auth redirect rule
```
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
```
The code normalizes all redirect origins to `127.0.0.1`. Using `localhost` in the browser URL will break the callback. This is enforced in `client.ts` (`normalizeSpotifyRedirectOrigin`). The Spotify Developer Dashboard redirect URI must match exactly.

### Playback requirement
**Spotify Premium and an active playback device are required.**

The Spotify Web API can only control a Spotify player that already exists and is signed in. SOUNDCLAW cannot create a virtual player.

Two things must be true before anything will play:
1. Spotify must be installed on your active device
2. That device must be showing in SOUNDCLAW's device selector as active

When no active device is found, the `play` route returns:
```json
{ "ok": false, "error": "no_active_device", "message": "Open Spotify on a device first" }
```

---

## What's in This Commit

52 files changed — 3,788 insertions, 536 deletions. Key additions:

| Component | Files | What it does |
|-----------|-------|-------------|
| **Spotify API client** | `src/lib/spotify/client.ts` | Full OAuth 2.0 + token refresh + all API calls |
| **SOUNDCLAW UI** | `src/features/spotify-jukebox/components/JukeboxPanel.tsx` | Control panel overlay |
| **Playback hooks** | `hooks/usePlaybackState.ts`, `useSpotifyAuth.ts`, `useSpotifySearch.ts` | State management |
| **API routes** | `src/app/api/spotify/{auth,callback,refresh,status,playback,play,pause,skip,previous,volume,search}/route.ts` | 11 endpoints |
| **3D object** | `src/features/retro-office/objects/Jukebox.tsx` | Jukebox in the office scene |
| **Bootstrap** | `src/features/office/hooks/useSpotifyOfficeBootstrap.ts` | Office-level Spotify init |
| **Tests** | `tests/unit/spotify*.test.ts`, `usePlaybackState.test.tsx` | 8 test files |

---

## Manual Verification

| Check | Status |
|-------|--------|
| OAuth: connect → Spotify → callback → token stored | ✅ |
| Token refresh runs without race conditions | ✅ (mutex in client.ts) |
| Search returns tracks and playlists | ✅ |
| Play: active device → music starts | ✅ |
| Play: no active device → `503 "Open Spotify on a device first"` | ✅ |
| Play: non-Premium account → `403 premium_required` | ✅ |
| Pause, skip, previous, volume | ✅ |
| `127.0.0.1` redirect enforcement in client.ts | ✅ |
| `.env.example` correct redirect URI | ✅ |
| OAuth state cookie replay protection | ✅ |
| Working tree clean at commit | ✅ |

---

## Known Caveats

### ⚠️ Spotify Premium required
Playback control (play, pause, skip) requires Spotify Premium. The `play` route returns `{ "error": "premium_required", "message": "Spotify Premium is required for playback" }` for free accounts.

### ⚠️ Spotify must be installed and active
Before playing anything, open Spotify on your device and confirm it appears in SOUNDCLAW's device selector. No active device = API call succeeds but produces no audio.

### ⚠️ Auth redirect must be `127.0.0.1:3000`
Mixing `localhost` and `127.0.0.1` across the auth flow will cause silent callback failures. The code enforces normalization, but the Spotify Developer Dashboard URI must be registered as `http://127.0.0.1:3000/api/spotify/callback`.

### ⚠️ Tokens are server-side only
Tokens live in httpOnly cookies server-side. A server restart invalidates the session — the user must re-authenticate. This is not a bug; token persistence layer can be added later.

---

## Screenshots

**SOUNDCLAW control panel (jukebox open, track playing):**
`public/office-assets/soundclaw-jukebox-screenshot.png`
> Captured from a real browser with Spotify connected and active playback.

**Claw3D office dashboard:**
`public/office-assets/soundclaw-dashboard-screenshot.png`
> Full office view showing the 3D environment and the jukebox object.

---

## Changelog Entry

Add to `CHANGELOG.md` before publishing:

```md
## [0.1.3] - YYYY-MM-DD

### Added
- **SOUNDCLAW**: in-app music console powered by Spotify, embedded in the 3D office.
  Connects via OAuth, supports search, play/pause/skip/volume, device selection,
  and now-playing display. Requires Spotify Premium and an active playback device.
  Local auth redirect must use `http://127.0.0.1:3000/api/spotify/callback`.
```

---

## PR Readiness

| Area | Status |
|------|--------|
| Working tree clean | ✅ |
| Commit message accurate | ✅ |
| Auth flow correct | ✅ |
| Error handling (no device, premium, auth) | ✅ |
| Setup caveats documented | ✅ |
| Screenshot artifacts present | ✅ |
| Unit tests | ✅ (8 files) |
| Release-blocking issues | **NONE** |

**Verdict: READY TO PUSH.**

---

## TUTORIAL.md Change (unstaged)

**File:** `TUTORIAL.md` (line ~183)
**Change:** Added Spotify playback requirement caveat to the Spotify section. No other content changes.

**Diff:**
```diff
 Do not mix `localhost` and `127.0.0.1` across the auth start and callback.

+> **Spotify playback requirement:** The Spotify Web API can only control a player
+> that is already running. **Spotify must be installed and an active playback
+> device must be available** (Spotify must be open and signed in somewhere)
+> for the jukebox to play music.
```

This is the only TUTORIAL.md change in this session. It is **unstaged and uncommitted** — review before push.
