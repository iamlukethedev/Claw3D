"use client";

import { useEffect } from "react";

export default function SpotifyCallbackPage() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const error = url.searchParams.get("error") ?? "";

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: "soundhermes-spotify-auth",
          code,
          state,
          error,
        },
        "*",
      );
      window.close();
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-cyan-500/20 bg-slate-900/90 p-8 text-center shadow-2xl">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/70">
          Soundhermes
        </div>
        <h1 className="text-xl font-semibold text-white">Finishing Spotify sign-in</h1>
        <p className="mt-3 text-sm text-slate-400">
          You can close this window if it does not close automatically.
        </p>
      </div>
    </main>
  );
}
