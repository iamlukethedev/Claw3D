"use client";

import { useEffect, useState } from "react";
import {
  Music,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import { usePlaybackState } from "../hooks/usePlaybackState";
import { useSpotifySearch } from "../hooks/useSpotifySearch";
import { useJukeboxStore } from "../state/jukebox-store";
import type { SpotifyTrack } from "../types";

interface JukeboxPanelProps {
  onClose: () => void;
}

const shellClass =
  "relative flex h-[min(860px,calc(100vh-3rem))] w-full max-w-5xl flex-col overflow-hidden rounded-[40px] border border-sky-200/18 bg-slate-950/78 shadow-[0_30px_120px_rgba(0,0,0,0.8)] backdrop-blur-xl";

const sectionShellClass =
  "rounded-[30px] border border-sky-300/14 bg-[linear-gradient(180deg,rgba(8,18,37,0.9)_0%,rgba(2,6,23,0.95)_100%)]";

const controlButtonClass =
  "inline-flex items-center justify-center rounded-full border border-sky-300/14 bg-slate-900/80 text-sky-100/70 transition-colors hover:border-sky-300/30 hover:bg-slate-800/90 hover:text-sky-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const cardButtonClass =
  "group flex w-full items-center gap-3.5 rounded-[22px] border border-transparent px-3.5 py-2.5 text-left transition-colors hover:border-sky-300/18 hover:bg-sky-400/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const resultRowClass =
  "group grid w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] border border-transparent px-3 py-2 text-left transition-colors hover:border-sky-300/18 hover:bg-sky-400/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const smallChipClass =
  "rounded-full border border-sky-300/12 bg-slate-900/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-sky-100/55";

const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function JukeboxPanel({ onClose }: JukeboxPanelProps) {
  const { isAuthenticated, isConnecting, connect } = useSpotifyAuth();
  const error = useJukeboxStore((state) => state.error);
  const setError = useJukeboxStore((state) => state.setError);
  const {
    currentTrack,
    isPlaying,
    progress,
    volume,
    togglePlay,
    skipNext,
    skipPrevious,
    changeVolume,
    playTrack,
    playPlaylist,
    isLoading,
  } = usePlaybackState();
  const { query, setQuery, clearSearch, isSearching, tracks, playlists } = useSpotifySearch();
  const [showSearch, setShowSearch] = useState(true);
  const [localVolume, setLocalVolume] = useState(volume);

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleVolumeChange = (newVolume: number) => {
    setLocalVolume(newVolume);
    changeVolume(newVolume);
  };

  const handleTrackSelect = (track: SpotifyTrack) => {
    playTrack(track.uri);
    clearSearch();
    setShowSearch(false);
  };

  const handlePlaylistSelect = (playlistUri: string) => {
    playPlaylist(playlistUri);
    clearSearch();
    setShowSearch(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[radial-gradient(circle_at_top,#0f172a_0%,#050816_46%,#02030a_100%)] px-4 py-6 text-white backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(56,189,248,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.08)_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <div className={shellClass}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/35 to-transparent" />

          <div className="flex items-center justify-between border-b border-sky-300/12 bg-slate-900/55 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/16 bg-sky-400/10 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.06)]">
                <Music size={19} />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-sky-200/70">
                  SOUNDCLAW
                </div>
                <div className="mt-1 text-sm font-semibold tracking-[0.02em] text-sky-50">
                  Music console
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${
                  isAuthenticated
                    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                    : "border-rose-300/20 bg-rose-400/10 text-rose-100"
                }`}
              >
                {isAuthenticated ? "Connected" : "Disconnected"}
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sky-300/14 bg-slate-900/80 text-sky-100/70 transition-colors hover:border-sky-300/30 hover:bg-slate-800/90 hover:text-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                aria-label="Close Spotify jukebox"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {error ? (
            <div className="mx-4 mt-4 rounded-2xl border border-rose-400/25 bg-rose-950/70 px-4 py-3 text-sm text-rose-50 shadow-[0_0_0_1px_rgba(244,63,94,0.08)] sm:mx-6">
              <div className="flex items-start gap-3">
                <div className="flex-1">{error}</div>
                <button
                  onClick={() => setError(null)}
                  className="rounded-full border border-current/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-rose-100/80 transition-colors hover:bg-white/5 hover:text-rose-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_1fr]">
            <section className="flex min-h-0 flex-col border-b border-sky-300/10 p-3.5 sm:p-4 lg:border-b-0 lg:border-r">
              {!isAuthenticated ? (
                <div className={`${sectionShellClass} flex min-h-0 flex-1 flex-col p-[18px] sm:p-5`}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-sky-200/70">
                    Booth link required
                  </div>
                  <div className="mt-2.5 text-xl font-semibold tracking-[0.01em] text-sky-50">
                    Connect Spotify to use the booth console.
                  </div>
                  <p className="mt-2.5 max-w-md text-[13px] leading-5 text-sky-100/70">
                    The jukebox is built into the booth hardware. Once connected, playback,
                    search, and volume controls appear as part of the same console.
                  </p>
                  <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="mt-5 inline-flex items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-400/12 px-[18px] py-2.5 text-sm font-semibold text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.06)] transition-colors hover:border-sky-300/35 hover:bg-sky-400/16 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isConnecting ? "Connecting..." : "Connect Spotify"}
                  </button>
                </div>
              ) : (
                <>
                  <div className={`${sectionShellClass} flex min-h-0 flex-1 flex-col p-[18px] sm:p-5`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-200/60">
                          Now playing
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-sky-100/45">
                          Current output
                        </div>
                      </div>
                      <div className="rounded-full border border-sky-300/14 bg-slate-900/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-sky-100/70">
                        {isLoading ? "Busy" : isPlaying ? "Playing" : "Idle"}
                      </div>
                    </div>

                    <div className="mt-3.5 rounded-[26px] border border-sky-300/12 bg-slate-950/80 p-[18px]">
                      {currentTrack ? (
                        <div className="flex gap-3.5">
                          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-[20px] border border-sky-300/12 bg-slate-900 shadow-[0_0_0_1px_rgba(56,189,248,0.05)]">
                            {currentTrack.album.images[0] ? (
                              <img
                                src={currentTrack.album.images[0].url}
                                alt={currentTrack.album.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(14,28,54,0.95),rgba(2,6,23,0.98))] text-sky-100/45">
                                <Music size={24} />
                              </div>
                            )}
                            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-sky-300/10" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-200/60">
                              Current track
                            </div>
                            <p className="mt-1.5 truncate text-sm font-semibold text-sky-50">
                              {currentTrack.name}
                            </p>
                            <p className="mt-1 truncate text-[13px] text-sky-100/70">
                              {currentTrack.artists.map((a) => a.name).join(", ")}
                            </p>
                            <p className="mt-1.5 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-sky-200/45">
                              {currentTrack.album.name}
                            </p>

                            <div className="mt-3">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(125,211,252,0.85),rgba(56,189,248,1))] transition-all"
                                  style={{ width: `${(progress / currentTrack.duration_ms) * 100}%` }}
                                />
                              </div>
                              <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-sky-200/45">
                                <span>{formatTime(progress)}</span>
                                <span>{formatTime(currentTrack.duration_ms)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex min-h-[104px] items-center justify-center rounded-[18px] border border-dashed border-sky-300/12 bg-slate-950/45 px-6 text-center text-sm leading-5 text-sky-100/55">
                          No track is playing. Use the search bay to cue something from the booth.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 rounded-[30px] border border-sky-300/14 bg-slate-950/55 px-4 py-3.5">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={skipPrevious}
                        disabled={isLoading}
                        className={`${controlButtonClass} h-11 w-11`}
                        aria-label="Previous track"
                      >
                        <SkipBack size={20} />
                      </button>
                      <button
                        onClick={togglePlay}
                        disabled={isLoading}
                        className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-sky-300/18 bg-[linear-gradient(180deg,rgba(125,211,252,0.25),rgba(56,189,248,0.16))] text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.08),0_14px_38px_rgba(2,8,23,0.44)] transition-colors hover:border-sky-300/30 hover:bg-[linear-gradient(180deg,rgba(125,211,252,0.32),rgba(56,189,248,0.22))] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        aria-label={isPlaying ? "Pause playback" : "Play playback"}
                      >
                        {isLoading ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : isPlaying ? (
                          <Pause size={22} />
                        ) : (
                          <Play size={22} className="ml-0.5" />
                        )}
                      </button>
                      <button
                        onClick={skipNext}
                        disabled={isLoading}
                        className={`${controlButtonClass} h-11 w-11`}
                        aria-label="Next track"
                      >
                        <SkipForward size={20} />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => handleVolumeChange(localVolume > 0 ? 0 : 50)}
                        className={`${controlButtonClass} h-9 w-9`}
                        aria-label={localVolume === 0 ? "Unmute" : "Mute"}
                      >
                        {localVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={localVolume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-400"
                      />
                      <span className="w-10 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-sky-200/55">
                        {localVolume}%
                      </span>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden p-3.5 sm:p-4">
              {isAuthenticated ? (
                <div
                  className={`${sectionShellClass} flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-[18px]`}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-200/60">
                        Track Hunter
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-sky-100/45">
                        Find something worth hearing
                      </div>
                    </div>
                    <button
                      onClick={() => setShowSearch((current) => !current)}
                      className="rounded-full border border-sky-300/14 bg-slate-900/75 px-2.5 py-[5px] font-mono text-[10px] uppercase tracking-[0.16em] text-sky-100/70 transition-colors hover:border-sky-300/30 hover:bg-slate-800/90 hover:text-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      {showSearch ? "Hide search" : "Show search"}
                    </button>
                  </div>

                  <div
                    className={`mt-3.5 min-h-0 flex flex-1 flex-col gap-3.5 overflow-hidden ${
                      showSearch ? "" : "hidden"
                    }`}
                  >
                    <div className="relative rounded-[20px] border border-sky-300/14 bg-slate-950/75">
                      <Search
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sky-200/45"
                      />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tracks, playlists, or whatever bad decision you’re chasing..."
                        className="w-full rounded-[20px] border-0 bg-transparent py-3 pl-10 pr-4 font-mono text-[11px] text-sky-50 placeholder:text-sky-200/35 appearance-none !outline-none !ring-0 !shadow-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none [-webkit-appearance:none]"
                      />
                    </div>

                    {isSearching ? (
                      <div className="rounded-[22px] border border-sky-300/12 bg-slate-950/70 px-4 py-2.5 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-sky-200/55">
                        Searching your next bad idea...
                      </div>
                    ) : null}

                    {tracks.length > 0 || playlists.length > 0 ? (
                      <div className="min-h-0 flex flex-1 flex-col overflow-hidden rounded-[26px] border border-sky-300/12 bg-slate-950/75">
                        <div className="h-full min-h-0 overflow-y-auto px-2.5 py-2.5 pb-5">
                          <div className="w-full max-w-[34rem] space-y-0.5 pr-2">
                            {tracks.slice(0, 5).map((track) => (
                              <button
                                key={track.id}
                                onClick={() => handleTrackSelect(track)}
                                title={`${track.name} · ${track.artists.map((a) => a.name).join(", ")} · ${track.album.name}`}
                                className={resultRowClass}
                              >
                                <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-[15px] border border-sky-300/12 bg-slate-900/80">
                                  {track.album.images[0] ? (
                                    <img
                                      src={track.album.images[0].url}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-sky-100/45">
                                      <Music size={14} />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[13px] font-medium leading-5 text-sky-50">
                                    {track.name}
                                  </div>
                                  <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-sky-200/55">
                                    {track.artists.map((a) => a.name).join(", ")}
                                  </div>
                                </div>
                                <span className={smallChipClass}>{formatTime(track.duration_ms)}</span>
                              </button>
                            ))}

                            {playlists.slice(0, 5).map((playlist) => (
                              <button
                                key={playlist.id}
                                onClick={() => handlePlaylistSelect(playlist.uri)}
                                title={`${playlist.name} · ${playlist.owner.display_name || "Spotify Playlist"}`}
                                className={resultRowClass}
                              >
                                <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-[15px] border border-sky-300/12 bg-slate-900/80">
                                  <Music size={14} className="text-sky-100/45" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[13px] font-medium leading-5 text-sky-50">
                                    {playlist.name}
                                  </div>
                                  <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-sky-200/55">
                                    {playlist.owner.display_name || "Spotify Playlist"}
                                  </div>
                                </div>
                                <span className={smallChipClass}>{playlist.tracks.total} tracks</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : query && !isSearching ? (
                      <div className="rounded-[22px] border border-sky-300/12 bg-slate-950/70 px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-sky-200/55">
                        No results found
                      </div>
                    ) : (
                      <div className="rounded-[22px] border border-sky-300/12 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-sky-100/62">
                        Search for tracks or playlists. Results show up here, for better or worse.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <div className="border-t border-sky-300/12 px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-sky-200/40 sm:px-6">
            Multi-source music console
          </div>
        </div>
      </div>
    </div>
  );
}
