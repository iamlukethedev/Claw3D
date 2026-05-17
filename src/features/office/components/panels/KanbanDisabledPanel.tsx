"use client";

import { T, useTranslation } from "@/lib/i18n/TranslationProvider";

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
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700/40 bg-slate-950/95 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/40 bg-slate-800/60 px-2 text-center text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">
          Kanban
        </div>

        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">
          <T id="kanban.disabled_title" fallback="任務管理員" />
        </div>
        <h2 className="mt-1 text-xl font-semibold text-white"><T id="kanban.disabled_heading" fallback="看板技能未安裝" /></h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          <T id="kanban.disabled_desc" fallback="安裝 TASK-MANAGER 技能，讓 Agent 將工作捕捉為任務，並開啟看板工作區。" />
        </p>

        {installing ? (
          <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">
                <T id="kanban.installing" fallback="安裝中" />
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
              {progressMessage?.trim() || t("kanban.installing_msg", "正在安裝 task-manager 技能。")}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              <T id="kanban.installed_hint" fallback="安裝完成後，Claw3D 將重新整理 task-manager 狀態。" />
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
            {installing
              ? t("kanban.installing_btn", "正在安裝 TASK-MANAGER 技能…")
              : t("kanban.install_btn", "安裝 TASK-MANAGER 技能")}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-700/40 px-5 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800/50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
            disabled={installing}
          >
            <T id="common.dismiss" fallback="關閉" />
          </button>
        </div>
      </div>
    </div>
  );
}
