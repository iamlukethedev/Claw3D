"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  score: number | null;
  session: string;
  role: string;
  status: string;
  last_task: string | null;
  tasks_completed: number;
  quality_score: number | null;
  last_active: string | null;
}

interface SwarmData {
  agents: Agent[];
  total: number;
  live_tracked: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active:        { label: "Active",        color: "text-emerald-400", dot: "bg-emerald-400 animate-pulse" },
  idle:          { label: "Idle",          color: "text-sky-400",     dot: "bg-sky-400" },
  running:       { label: "Running",       color: "text-amber-400",   dot: "bg-amber-400 animate-pulse" },
  new:           { label: "New",           color: "text-violet-400",  dot: "bg-violet-400" },
  uninitialized: { label: "Uninitialized", color: "text-zinc-500",    dot: "bg-zinc-600" },
};

const SESSION_COLOR: Record<string, string> = {
  Core:     "bg-violet-900/60 text-violet-300 border-violet-700",
  S76:      "bg-sky-900/60 text-sky-300 border-sky-700",
  S57:      "bg-teal-900/60 text-teal-300 border-teal-700",
  "S82-GS": "bg-indigo-900/60 text-indigo-300 border-indigo-700",
  "S82-B2": "bg-blue-900/60 text-blue-300 border-blue-700",
  "S82-SH": "bg-cyan-900/60 text-cyan-300 border-cyan-700",
  "S82-BS": "bg-purple-900/60 text-purple-300 border-purple-700",
  S83:      "bg-pink-900/60 text-pink-300 border-pink-700",
  Council:  "bg-amber-900/60 text-amber-300 border-amber-700",
  Support:  "bg-zinc-800/60 text-zinc-300 border-zinc-600",
  CEO:      "bg-orange-900/60 text-orange-300 border-orange-700",
};

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.uninitialized;
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
    </span>
  );
}

function SessionBadge({ session }: { session: string }) {
  const cls = SESSION_COLOR[session] ?? "bg-zinc-800 text-zinc-300 border-zinc-600";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium ${cls}`}>
      {session}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-zinc-600 text-xs">—</span>;
  const pct = (score / 10) * 100;
  const color = score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-300 font-mono">{score.toFixed(1)}</span>
    </div>
  );
}

export default function SwarmDashboard() {
  const [data, setData] = useState<SwarmData | null>(null);
  const [filter, setFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "score" | "tasks" | "status">("score");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/swarm");
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const sessions = useMemo(() => {
    if (!data) return [];
    return ["All", ...Array.from(new Set(data.agents.map((a) => a.session)))];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.agents;
    if (sessionFilter !== "All") list = list.filter((a) => a.session === sessionFilter);
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(
        (a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "score") return (b.score ?? -1) - (a.score ?? -1);
      if (sortBy === "tasks") return b.tasks_completed - a.tasks_completed;
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return a.name.localeCompare(b.name);
    });
  }, [data, filter, sessionFilter, sortBy]);

  const stats = useMemo(() => {
    if (!data) return null;
    const agents = data.agents;
    return {
      active: agents.filter((a) => a.status === "active" || a.status === "running").length,
      initialized: agents.filter((a) => a.status !== "uninitialized").length,
      total: agents.length,
      totalTasks: agents.reduce((s, a) => s + a.tasks_completed, 0),
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400 font-mono text-sm">
        Loading swarm…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/office" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← 3D Office
          </Link>
          <span className="text-zinc-700">|</span>
          <h1 className="text-lg font-bold tracking-tight">ZEUS Swarm</h1>
          {stats && (
            <span className="text-xs text-zinc-500 font-mono">
              {stats.active} active · {stats.initialized}/{stats.total} initialized · {stats.totalTasks} tasks done
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          auto-refresh 30s
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-zinc-800/50 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search agents…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500 w-48"
        />
        <div className="flex gap-1 flex-wrap">
          {sessions.map((s) => (
            <button
              key={s}
              onClick={() => setSessionFilter(s)}
              className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${
                sessionFilter === s
                  ? "bg-zinc-700 text-zinc-100 border-zinc-500"
                  : "bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500 hover:text-zinc-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          Sort:
          {(["score", "name", "tasks", "status"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2 py-1 rounded border transition-colors ${
                sortBy === s
                  ? "bg-zinc-700 text-zinc-200 border-zinc-500"
                  : "bg-transparent text-zinc-600 border-zinc-800 hover:text-zinc-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((agent) => (
          <Link
            key={agent.id}
            href={`/office?agent=${agent.id}`}
            className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 hover:bg-zinc-800/80 transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-zinc-100 group-hover:text-white truncate">
                  {agent.name}
                </div>
                <div className="text-xs text-zinc-500 truncate mt-0.5">{agent.role}</div>
              </div>
              <SessionBadge session={agent.session} />
            </div>

            <div className="mt-3 space-y-2">
              <StatusDot status={agent.status} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600">Score</span>
                <ScoreBar score={agent.score} />
              </div>
              {agent.tasks_completed > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-600">Tasks</span>
                  <span className="text-xs font-mono text-zinc-400">{agent.tasks_completed}</span>
                </div>
              )}
              {agent.last_task && (
                <div className="mt-2 text-[10px] text-zinc-600 leading-relaxed line-clamp-2 font-mono">
                  {agent.last_task}
                </div>
              )}
            </div>

            <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] text-zinc-700 font-mono">{agent.id}</span>
              <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400 transition-colors">
                Chat →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-zinc-600 text-sm">
          No agents match your filter.
        </div>
      )}
    </div>
  );
}
