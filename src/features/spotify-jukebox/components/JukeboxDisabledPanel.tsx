"use client";

import { T, useTranslation } from "@/lib/i18n/TranslationProvider";

type JukeboxDisabledPanelProps = {
  onClose: () => void;
  onInstall: () => void;
};

export function JukeboxDisabledPanel({ onClose, onInstall }: JukeboxDisabledPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700/40 bg-slate-950/95 p-8 text-center shadow-2xl">
        {/* Jukebox icon. */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/40 bg-slate-800/60 text-4xl">
          🎵
        </div>

        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">
          Soundclaw
        </div>
        <h2 className="mt-1 text-xl font-semibold text-white"><T id="jukebox.disabled_heading" fallback="Jukebox Not Installed" /></h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          <T id="jukebox.disabled_desc" fallback='Install the SOUNDCLAW skill to let your agents pick and play music right from the office jukebox.' />
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 active:scale-95"
            onClick={onInstall}
          >
            <T id="jukebox.install_btn" fallback="Install SOUNDCLAW skill" />
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-700/40 px-5 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800/50"
            onClick={onClose}
          >
            <T id="common.dismiss" fallback="Dismiss" />
          </button>
        </div>
      </div>
    </div>
  );
}
