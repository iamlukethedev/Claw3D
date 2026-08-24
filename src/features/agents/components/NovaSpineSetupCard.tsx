"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, DatabaseZap, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";

type NovaSpineIntegrationStatus = {
  openclawDetected: boolean;
  openclawVersion: string | null;
  openclawVersionValidated: boolean;
  pythonDetected: boolean;
  pythonVersion: string | null;
  pythonSupported: boolean;
  novaspineModuleDetected: boolean;
  openclawConfigPath: string | null;
  bundledVersion: string;
  packageSpec: string;
  memorySlot: string | null;
  contextEngineSlot: string | null;
  consciousnessEnabled: boolean;
  integrationEnabled: boolean;
  readiness:
    | "ready"
    | "integrated"
    | "missing-openclaw"
    | "missing-config"
    | "missing-python"
    | "unsupported-python"
    | "missing-assets";
  messages: string[];
};

type NovaSpineInstallResult = {
  ok: boolean;
  steps: Array<{ name: string; ok: boolean; detail: string }>;
  status: NovaSpineIntegrationStatus;
};

const readinessCopy: Record<NovaSpineIntegrationStatus["readiness"], string> = {
  ready: "OpenClaw is ready for one-click NovaSpine setup.",
  integrated: "NovaSpine is already wired into this OpenClaw install.",
  "missing-openclaw": "OpenClaw was not detected on this machine.",
  "missing-config": "OpenClaw is installed, but its config file was not found.",
  "missing-python": "Python 3 was not detected.",
  "unsupported-python": "Python 3.12+ is required for NovaSpine.",
  "missing-assets": "Claw3D is missing its bundled NovaSpine integration assets.",
};

const readJson = async <T,>(response: Response): Promise<T> => {
  const text = await response.text();
  return text.trim() ? (JSON.parse(text) as T) : ({} as T);
};

export const NovaSpineSetupCard = ({ compact = false }: { compact?: boolean }) => {
  const [status, setStatus] = useState<NovaSpineIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NovaSpineInstallResult | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/novaspine", { cache: "no-store" });
      const body = await readJson<{ status?: NovaSpineIntegrationStatus; error?: string }>(response);
      if (!response.ok || !body.status) {
        throw new Error(body.error || "Failed to load NovaSpine status.");
      }
      setStatus(body.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load NovaSpine status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/novaspine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install" }),
      });
      const body = await readJson<NovaSpineInstallResult & { error?: string }>(response);
      if (!response.ok && !body.status) {
        throw new Error(body.error || "NovaSpine install failed.");
      }
      setResult({
        ok: Boolean(body.ok),
        steps: Array.isArray(body.steps) ? body.steps : [],
        status: body.status,
      });
      if (body.status) {
        setStatus(body.status);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "NovaSpine install failed.");
    } finally {
      setInstalling(false);
    }
  }, [refresh]);

  const headline = useMemo(() => {
    if (status?.integrationEnabled) return "NovaSpine is active";
    if (status?.readiness === "ready") return "Enable NovaSpine memory";
    return "NovaSpine integration";
  }, [status]);

  const statusTone = status?.integrationEnabled
    ? "border-emerald-400/20 bg-emerald-500/10"
    : status?.readiness === "ready"
      ? "border-amber-400/20 bg-amber-500/10"
      : "border-white/10 bg-white/[0.03]";

  return (
    <div className={`rounded-xl border ${statusTone} ${compact ? "p-3" : "p-4"} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {status?.integrationEnabled ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            ) : (
              <DatabaseZap className="h-4 w-4 text-amber-300" />
            )}
            <p className="text-sm font-semibold text-white">{headline}</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-white/65">
            {status ? readinessCopy[status.readiness] : "Checking local OpenClaw and NovaSpine state…"}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          onClick={() => void refresh()}
          disabled={loading || installing}
          aria-label="Refresh NovaSpine status"
          title="Refresh"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {status ? (
        <div className={`grid gap-2 text-[11px] ${compact ? "" : "sm:grid-cols-2"}`}>
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white/70">
            OpenClaw:{" "}
            <span className="font-mono text-white">
              {status.openclawDetected ? status.openclawVersion ?? "detected" : "missing"}
            </span>
            {status.openclawDetected && !status.openclawVersionValidated ? (
              <span className="ml-2 text-amber-300">(untested version)</span>
            ) : null}
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white/70">
            Python:{" "}
            <span className="font-mono text-white">
              {status.pythonDetected ? status.pythonVersion ?? "detected" : "missing"}
            </span>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white/70">
            Slots:{" "}
            <span className="font-mono text-white">
              {status.memorySlot ?? "unset"} / {status.contextEngineSlot ?? "unset"}
            </span>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white/70">
            NovaSpine:{" "}
            <span className="font-mono text-white">
              {status.packageSpec}
            </span>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white/70">
            Consciousness:{" "}
            <span className="font-mono text-white">
              {status.consciousnessEnabled ? "enabled" : "not enabled"}
            </span>
          </div>
        </div>
      ) : null}

      {status?.messages?.length ? (
        <div className="space-y-1.5">
          {status.messages.map((message) => (
            <div
              key={message}
              className="flex items-start gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-4 text-white/60"
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span>{message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {result?.steps?.length ? (
        <div className="space-y-1.5 rounded-md border border-white/10 bg-black/20 px-3 py-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-white/80">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Latest setup run
          </div>
          {result.steps.map((step) => (
            <div key={step.name} className="text-[11px] leading-4 text-white/60">
              <span className={`font-mono ${step.ok ? "text-emerald-300" : "text-red-300"}`}>
                {step.ok ? "ok" : "fail"}
              </span>{" "}
              <span className="font-mono text-white/80">{step.name}</span>{" "}
              {step.detail}
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          {error}
        </div>
      ) : null}

      {!status?.integrationEnabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-amber-500 px-4 text-xs font-semibold text-[#1a1206] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handleInstall()}
            disabled={installing || loading || status?.readiness !== "ready"}
          >
            {installing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DatabaseZap className="h-3.5 w-3.5" />}
            {installing ? "Enabling NovaSpine…" : "Enable NovaSpine"}
          </button>
          <p className="text-[11px] leading-4 text-white/45">
            This keeps your existing OpenClaw install, preserves your model setup,
            and wires NovaSpine into that runtime.
          </p>
        </div>
      ) : (
        <p className="text-[11px] leading-4 text-white/45">
          Your OpenClaw install is already using NovaSpine memory and context slots.
        </p>
      )}
    </div>
  );
};
