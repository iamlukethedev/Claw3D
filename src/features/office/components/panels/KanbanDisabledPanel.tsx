"use client";

type KanbanDisabledPanelProps = {
  onClose: () => void;
  onInstall: () => void;
  installing?: boolean;
  progressPercent?: number;
  progressMessage?: string | null;
  errorMessage?: string | null;
};

export function KanbanDisabledPanel({
  onClose,
  onInstall,
  installing = false,
  progressPercent = 0,
  progressMessage = null,
  errorMessage = null,
}: KanbanDisabledPanelProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700/40 bg-slate-950/95 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/40 bg-slate-800/60 px-2 text-center text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">
          Kanban
        </div>

        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">
          Task Manager
        </div>
        <h2 className="mt-1 text-xl font-semibold text-white">Kanban Skill Not Installed</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Install the <span className="text-cyan-400">TASK-MANAGER</span> skill to let your
          agents capture work as tasks and open the Kanban desk.
        </p>

        {installing ? (
          <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">
                Installing
              </span>
              <span className="font-mono text-[10px] text-cyan-100/70">
                {Math.max(0, Math.min(100, Math.round(progressPercent)))}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/90">
              <div
                className="h-full rounded-full bg-cyan-400 transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(6, Math.min(100, progressPercent))}%` }}
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {progressMessage?.trim() || "Installing the task-manager skill."}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Once it&apos;s installed, Claw3D will refresh the task-manager state.
            </p>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-cyan-700/60 disabled:text-slate-200"
            onClick={onInstall}
            disabled={installing}
          >
            {installing ? "Installing TASK-MANAGER skill..." : "Install TASK-MANAGER skill"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-700/40 px-5 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800/50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
            disabled={installing}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
