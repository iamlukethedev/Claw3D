"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GitBranch, Maximize2, Minus, Plus } from "lucide-react";

import type { AgentState } from "@/features/agents/state/store";
import type { TaskBoardCard, TaskBoardStatus } from "@/features/office/tasks/types";

// ---------------------------------------------------------------------------
// JSON Canvas spec types (https://jsoncanvas.org/)
// ---------------------------------------------------------------------------
export type CanvasColor =
  | "1" | "2" | "3" | "4" | "5" | "6"
  | (string & Record<never, never>); // hex fallback

export type CanvasNodeBase = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
};

export type CanvasTextNode  = CanvasNodeBase & { type: "text";  text: string };
export type CanvasTaskNode  = CanvasNodeBase & { type: "task";  cardId: string };
export type CanvasGroupNode = CanvasNodeBase & { type: "group"; label?: string };
export type CanvasAgentNode = CanvasNodeBase & { type: "agent"; agentId: string };

export type CanvasNode = CanvasTextNode | CanvasTaskNode | CanvasGroupNode | CanvasAgentNode;

export type CanvasEdgeSide = "top" | "right" | "bottom" | "left";

export type CanvasEdge = {
  id: string;
  fromNode: string;
  fromSide?: CanvasEdgeSide;
  toNode: string;
  toSide?: CanvasEdgeSide;
  color?: CanvasColor;
  label?: string;
};

export type JsonCanvas = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const NODE_PALETTE: Record<string, string> = {
  "1": "border-rose-500/40 bg-rose-500/8",
  "2": "border-orange-400/40 bg-orange-400/8",
  "3": "border-amber-400/40 bg-amber-400/8",
  "4": "border-emerald-400/40 bg-emerald-400/8",
  "5": "border-cyan-400/40 bg-cyan-400/8",
  "6": "border-violet-400/40 bg-violet-400/8",
};

const STATUS_NODE_COLOR: Record<TaskBoardStatus, string> = {
  todo:        "border-white/15 bg-white/5",
  in_progress: "border-cyan-400/35 bg-cyan-500/8",
  blocked:     "border-rose-400/35 bg-rose-500/8",
  review:      "border-amber-400/35 bg-amber-400/8",
  done:        "border-emerald-400/30 bg-emerald-500/6",
};

const STATUS_LABELS: Record<TaskBoardStatus, string> = {
  todo:        "Todo",
  in_progress: "In Progress",
  blocked:     "Blocked",
  review:      "Review",
  done:        "Done",
};

const AGENT_STATUS_DOT: Record<string, string> = {
  idle:    "bg-white/30",
  running: "bg-cyan-400",
  error:   "bg-rose-400",
};

const MIN_ZOOM   = 0.2;
const MAX_ZOOM   = 2;
const ZOOM_STEP  = 0.15;
const DEFAULT_NODE_W = 280;
const DEFAULT_NODE_H = 160;
const AGENT_NODE_W   = 180;
const AGENT_NODE_H   = 80;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function nodeColorClass(node: CanvasNode): string {
  if (node.color && NODE_PALETTE[node.color]) return NODE_PALETTE[node.color]!;
  return "border-white/12 bg-white/[0.04]";
}

function anchorPoint(node: CanvasNode, side: CanvasEdgeSide | undefined): { x: number; y: number } {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  switch (side) {
    case "top":    return { x: cx, y: node.y };
    case "bottom": return { x: cx, y: node.y + node.height };
    case "left":   return { x: node.x, y: cy };
    case "right":  return { x: node.x + node.width, y: cy };
    default:       return { x: cx, y: cy };
  }
}

function nearestSide(from: CanvasNode, to: CanvasNode): CanvasEdgeSide {
  const fcx = from.x + from.width / 2;
  const fcy = from.y + from.height / 2;
  const tcx = to.x + to.width / 2;
  const tcy = to.y + to.height / 2;
  const dx = tcx - fcx;
  const dy = tcy - fcy;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "bottom" : "top";
}

function edgeLabel(fromNode: CanvasNode, toNode: CanvasNode): string | undefined {
  if (fromNode.type === "agent" && toNode.type === "task")  return "assigned";
  if (fromNode.type === "task"  && toNode.type === "task")  return "blocks";
  if (fromNode.type === "task"  && toNode.type === "agent") return "reported to";
  return undefined;
}

const stopEditableEventPropagation = (event: {
  stopPropagation: () => void;
}) => {
  event.stopPropagation();
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function TaskNodeCard({
  node, card, selected,
  onSelect, onDragStart, onStatusChange, onStartEdge,
  onResizeStart,
  onCardChange,
  agents,
  drawingEdge,
}: {
  node: CanvasTaskNode;
  card: TaskBoardCard;
  agents: AgentState[];
  selected: boolean;
  drawingEdge: boolean;
  onSelect: () => void;
  onDragStart: (e: ReactPointerEvent, nodeId: string) => void;
  onStatusChange: (cardId: string, status: TaskBoardStatus) => void;
  onCardChange: (cardId: string, patch: Partial<TaskBoardCard>) => void;
  onStartEdge: (nodeId: string) => void;
  onResizeStart: (e: ReactPointerEvent, nodeId: string) => void;
}) {
  const statusClass = STATUS_NODE_COLOR[card.status];
  return (
    <div
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: Math.max(DEFAULT_NODE_W, node.width),
        height: Math.max(DEFAULT_NODE_H, node.height),
        minWidth: DEFAULT_NODE_W,
        minHeight: DEFAULT_NODE_H,
      }}
      className={`flex flex-col overflow-hidden rounded-xl border transition-shadow ${statusClass} ${selected ? "ring-1 ring-cyan-400/50 shadow-lg shadow-cyan-500/10" : ""} ${drawingEdge ? "cursor-crosshair" : ""}`}
      data-node-id={node.id}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (drawingEdge) { onStartEdge(node.id); return; }
        onDragStart(e, node.id);
        onSelect();
      }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/8 px-3 py-2">
        <textarea
          value={card.title}
          onChange={(e) => onCardChange(card.id, { title: e.target.value })}
          onPointerDown={stopEditableEventPropagation}
          onMouseDown={stopEditableEventPropagation}
          onKeyDown={stopEditableEventPropagation}
          onKeyUp={stopEditableEventPropagation}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          placeholder="Task title"
          rows={2}
          className="min-h-[2.4rem] min-w-0 flex-1 resize-none bg-transparent text-[12px] font-semibold leading-relaxed text-white/95 outline-none placeholder:text-white/25"
        />
        <span className="shrink-0 rounded bg-black/20 px-1.5 py-0.5 font-mono text-[8px] uppercase text-white/65">
          {STATUS_LABELS[card.status]}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 py-2">
        <textarea
          value={card.description}
          onChange={(e) => onCardChange(card.id, { description: e.target.value })}
          onPointerDown={stopEditableEventPropagation}
          onMouseDown={stopEditableEventPropagation}
          onKeyDown={stopEditableEventPropagation}
          onKeyUp={stopEditableEventPropagation}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          placeholder="Describe the task..."
          className="min-h-0 flex-1 resize-none bg-transparent text-[11px] leading-relaxed text-white/72 outline-none placeholder:text-white/25"
        />
        {card.assignedAgentId ? (
          <span className="font-mono text-[9px] text-cyan-200/75">{card.assignedAgentId}</span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-1.5 border-t border-white/6 px-2 py-1.5">
        <select
          aria-label="Task status"
          value={card.status}
          onChange={(e) => { e.stopPropagation(); onStatusChange(card.id, e.target.value as TaskBoardStatus); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full rounded bg-black/20 px-1 py-0.5 font-mono text-[9px] text-white/75 outline-none"
        >
          {(Object.keys(STATUS_LABELS) as TaskBoardStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          aria-label="Assign task agent"
          value={card.assignedAgentId ?? ""}
          onChange={(e) => {
            e.stopPropagation();
            onCardChange(card.id, { assignedAgentId: e.target.value || null });
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full rounded bg-black/20 px-1 py-0.5 font-mono text-[9px] text-white/75 outline-none"
        >
          <option value="">Assign</option>
          {agents.map((agent) => (
            <option key={agent.agentId} value={agent.agentId}>
              {agent.name || agent.agentId}
            </option>
          ))}
        </select>
      </div>
      {!drawingEdge ? (
        <button
          type="button"
          aria-label="Resize task card"
          onPointerDown={(e) => onResizeStart(e, node.id)}
          className="absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded-sm border border-white/10 bg-black/25 text-white/35 hover:text-white/70"
        >
          <span className="pointer-events-none absolute bottom-[1px] right-[2px] text-[10px] leading-none">⌟</span>
        </button>
      ) : null}
    </div>
  );
}

function TextNodeCard({
  node, selected, drawingEdge,
  onSelect, onDragStart, onTextChange, onStartEdge,
}: {
  node: CanvasTextNode;
  selected: boolean;
  drawingEdge: boolean;
  onSelect: () => void;
  onDragStart: (e: ReactPointerEvent, nodeId: string) => void;
  onTextChange: (nodeId: string, text: string) => void;
  onStartEdge: (nodeId: string) => void;
}) {
  return (
    <div
      style={{ position: "absolute", left: node.x, top: node.y, width: node.width, height: node.height }}
      className={`overflow-hidden rounded-xl border ${nodeColorClass(node)} ${selected ? "ring-1 ring-cyan-400/50" : ""} ${drawingEdge ? "cursor-crosshair" : ""}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (drawingEdge) { onStartEdge(node.id); return; }
        onDragStart(e, node.id);
        onSelect();
      }}
    >
      <textarea
        value={node.text}
        onChange={(e) => onTextChange(node.id, e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Note…"
        className="h-full w-full resize-none bg-transparent px-3 py-2 text-[11px] leading-relaxed text-white/70 outline-none placeholder:text-white/20"
      />
    </div>
  );
}

function GroupNodeCard({
  node, selected, drawingEdge,
  onSelect, onDragStart, onStartEdge,
}: {
  node: CanvasGroupNode;
  selected: boolean;
  drawingEdge: boolean;
  onSelect: () => void;
  onDragStart: (e: ReactPointerEvent, nodeId: string) => void;
  onStartEdge: (nodeId: string) => void;
}) {
  return (
    <div
      style={{ position: "absolute", left: node.x, top: node.y, width: node.width, height: node.height }}
      className={`rounded-2xl border-2 border-dashed ${nodeColorClass(node)} ${selected ? "ring-1 ring-cyan-400/30" : ""} ${drawingEdge ? "cursor-crosshair" : ""}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (drawingEdge) { onStartEdge(node.id); return; }
        onDragStart(e, node.id);
        onSelect();
      }}
    >
      {node.label && (
        <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
          {node.label}
        </div>
      )}
    </div>
  );
}

function AgentNodeCard({
  node, agent, selected, drawingEdge,
  onSelect, onDragStart, onStartEdge,
}: {
  node: CanvasAgentNode;
  agent: AgentState | undefined;
  selected: boolean;
  drawingEdge: boolean;
  onSelect: () => void;
  onDragStart: (e: ReactPointerEvent, nodeId: string) => void;
  onStartEdge: (nodeId: string) => void;
}) {
  const dotClass = AGENT_STATUS_DOT[agent?.status ?? "idle"] ?? "bg-white/20";
  return (
    <div
      style={{ position: "absolute", left: node.x, top: node.y, width: node.width, height: node.height }}
      className={`flex flex-col overflow-hidden rounded-xl border border-violet-500/35 bg-violet-500/8 ${selected ? "ring-1 ring-violet-400/60 shadow-lg shadow-violet-500/10" : ""} ${drawingEdge ? "cursor-crosshair" : ""}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (drawingEdge) { onStartEdge(node.id); return; }
        onDragStart(e, node.id);
        onSelect();
      }}
    >
      <div className="flex cursor-grab items-center gap-2 border-b border-violet-500/20 px-3 py-2 active:cursor-grabbing">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        <span className="truncate text-[11px] font-medium text-violet-100/85">
          {agent?.name ?? node.agentId}
        </span>
        <span className="ml-auto shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-[8px] uppercase text-violet-300/50">
          agent
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center px-3">
        <span className="font-mono text-[9px] text-violet-300/30">
          {agent?.status ?? "unknown"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edge SVG layer — also renders the live draft line while connecting
// ---------------------------------------------------------------------------
function EdgeLayer({
  edges, nodes, canvasW, canvasH, draftLine,
}: {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
  canvasW: number;
  canvasH: number;
  draftLine: { x1: number; y1: number; x2: number; y2: number } | null;
}) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0, width: canvasW, height: canvasH }}
      className="pointer-events-none overflow-visible"
    >
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgba(255,255,255,0.2)" />
        </marker>
        <marker id="arrow-draft" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgba(139,92,246,0.6)" />
        </marker>
      </defs>

      {/* Committed edges */}
      {edges.map((edge) => {
        const from = nodeMap.get(edge.fromNode);
        const to   = nodeMap.get(edge.toNode);
        if (!from || !to) return null;
        const a  = anchorPoint(from, edge.fromSide);
        const b  = anchorPoint(to,   edge.toSide);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={edge.id}>
            <path
              d={`M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
            {edge.label && (
              <text x={mx} y={my - 4} textAnchor="middle" className="fill-white/30 font-mono text-[9px]">
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Draft edge while drawing */}
      {draftLine && (
        <line
          x1={draftLine.x1} y1={draftLine.y1}
          x2={draftLine.x2} y2={draftLine.y2}
          stroke="rgba(139,92,246,0.55)"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          markerEnd="url(#arrow-draft)"
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Agent palette sidebar chip
// ---------------------------------------------------------------------------
function AgentChip({
  agent,
  onDrop,
}: {
  agent: AgentState;
  onDrop: (agentId: string) => void;
}) {
  const dotClass = AGENT_STATUS_DOT[agent.status] ?? "bg-white/20";
  return (
    <button
      type="button"
      title={`Add ${agent.name} to canvas`}
      onClick={() => onDrop(agent.agentId)}
      className="flex w-full items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/8 px-2 py-1.5 text-left transition hover:border-violet-400/40 hover:bg-violet-500/15"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <span className="truncate font-mono text-[10px] text-violet-100/75">{agent.name}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main CanvasBoard
// ---------------------------------------------------------------------------
export function CanvasBoard({
  canvas,
  cardMap,
  agents,
  onCanvasChangeAction,
  onMoveCardAction,
  onCreateCardAction,
  onRequestClearAllAction,
  onConfirmClearAllAction,
  onCancelClearAllAction,
  onSelectCardAction,
  onUpdateCardAction,
  selectedCardId,
  clearAllPending,
  taskCount,
}: {
  canvas: JsonCanvas;
  cardMap: Map<string, TaskBoardCard>;
  agents: AgentState[];
  onCanvasChangeAction: (next: JsonCanvas) => void;
  onMoveCardAction: (cardId: string, status: TaskBoardStatus) => void;
  onCreateCardAction: () => void;
  onRequestClearAllAction: () => void;
  onConfirmClearAllAction: () => void;
  onCancelClearAllAction: () => void;
  onSelectCardAction: (cardId: string | null) => void;
  onUpdateCardAction: (cardId: string, patch: Partial<TaskBoardCard>) => void;
  selectedCardId: string | null;
  clearAllPending: boolean;
  taskCount: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom]             = useState(1);
  const [pan,  setPan]              = useState({ x: 40, y: 40 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showAgentPalette, setShowAgentPalette] = useState(false);

  // Edge-drawing state
  const [edgeFromNodeId, setEdgeFromNodeId] = useState<string | null>(null);
  const [draftLine, setDraftLine]           = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Pan / drag refs
  const isPanning       = useRef(false);
  const panStart        = useRef({ x: 0, y: 0 });
  const draggingNodeId  = useRef<string | null>(null);
  const dragStart       = useRef({ mx: 0, my: 0, nx: 0, ny: 0 });
  const resizingNodeId  = useRef<string | null>(null);
  const resizeStart     = useRef({ mx: 0, my: 0, width: 0, height: 0 });

  // Agent map for quick lookup
  const agentMap = useMemo(() => new Map(agents.map((a) => [a.agentId, a])), [agents]);

  // Canvas bounding box for SVG edge layer
  const canvasBounds = useMemo(() => {
    if (canvas.nodes.length === 0) return { w: 2000, h: 1200 };
    const maxX = Math.max(...canvas.nodes.map((n) => n.x + n.width))  + 200;
    const maxY = Math.max(...canvas.nodes.map((n) => n.y + n.height)) + 200;
    return { w: Math.max(maxX, 2000), h: Math.max(maxY, 1200) };
  }, [canvas.nodes]);

  // Wheel zoom toward cursor
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect  = el.getBoundingClientRect();
      const mx    = e.clientX - rect.left;
      const my    = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((prev) => {
        const next  = clamp(prev + delta, MIN_ZOOM, MAX_ZOOM);
        const scale = next / prev;
        setPan((p) => ({ x: mx - (mx - p.x) * scale, y: my - (my - p.y) * scale }));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Escape cancels edge drawing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && edgeFromNodeId) {
        setEdgeFromNodeId(null);
        setDraftLine(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [edgeFromNodeId]);

  // Convert screen coords → canvas coords
  const toCanvasCoords = useCallback((screenX: number, screenY: number) => {
    const el = viewportRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top  - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // Convert canvas coords → screen-relative-to-viewport coords (for SVG in canvas space)
  const fromNodeCenter = useCallback((nodeId: string) => {
    const node = canvas.nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  }, [canvas.nodes]);

  const handleNodeResize = useCallback((nodeId: string, width: number, height: number) => {
    onCanvasChangeAction({
      ...canvas,
      nodes: canvas.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              width: Math.max(DEFAULT_NODE_W, width),
              height: Math.max(DEFAULT_NODE_H, height),
            }
          : node,
      ),
    });
  }, [canvas, onCanvasChangeAction]);

  // ── Pointer handlers ────────────────────────────────────────────────────
  const onViewportPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (edgeFromNodeId) {
      // Clicked empty space while drawing — cancel
      setEdgeFromNodeId(null);
      setDraftLine(null);
      return;
    }
    isPanning.current = true;
    panStart.current  = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    setSelectedNodeId(null);
    onSelectCardAction(null);
  }, [pan, onSelectCardAction, edgeFromNodeId]);

  const onViewportPointerMove = useCallback((e: ReactPointerEvent) => {
    if (edgeFromNodeId) {
      const from = fromNodeCenter(edgeFromNodeId);
      const canvasCoords = toCanvasCoords(e.clientX, e.clientY);
      setDraftLine({ x1: from.x, y1: from.y, x2: canvasCoords.x, y2: canvasCoords.y });
      return;
    }
    if (draggingNodeId.current) {
      const dx     = (e.clientX - dragStart.current.mx) / zoom;
      const dy     = (e.clientY - dragStart.current.my) / zoom;
      const nodeId = draggingNodeId.current;
      onCanvasChangeAction({
        ...canvas,
        nodes: canvas.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, x: Math.round(dragStart.current.nx + dx), y: Math.round(dragStart.current.ny + dy) }
            : n,
        ),
      });
      return;
    }
    if (resizingNodeId.current) {
      const dx = (e.clientX - resizeStart.current.mx) / zoom;
      const dy = (e.clientY - resizeStart.current.my) / zoom;
      handleNodeResize(
        resizingNodeId.current,
        Math.round(resizeStart.current.width + dx),
        Math.round(resizeStart.current.height + dy),
      );
      return;
    }
    if (!isPanning.current) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, [canvas, handleNodeResize, onCanvasChangeAction, zoom, edgeFromNodeId, fromNodeCenter, toCanvasCoords]);

  const onViewportPointerUp = useCallback(() => {
    isPanning.current    = false;
    draggingNodeId.current = null;
    resizingNodeId.current = null;
  }, []);

  const onNodeDragStart = useCallback((e: ReactPointerEvent, nodeId: string) => {
    e.preventDefault();
    draggingNodeId.current = nodeId;
    const node = canvas.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    dragStart.current = { mx: e.clientX, my: e.clientY, nx: node.x, ny: node.y };
  }, [canvas.nodes]);

  const onNodeResizeStart = useCallback((e: ReactPointerEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizingNodeId.current = nodeId;
    draggingNodeId.current = null;
    isPanning.current = false;
    const node = canvas.nodes.find((currentNode) => currentNode.id === nodeId);
    if (!node) return;
    resizeStart.current = {
      mx: e.clientX,
      my: e.clientY,
      width: Math.max(DEFAULT_NODE_W, node.width),
      height: Math.max(DEFAULT_NODE_H, node.height),
    };
  }, [canvas.nodes]);

  // ── Edge drawing ────────────────────────────────────────────────────────
  const handleStartEdge = useCallback((nodeId: string) => {
    if (edgeFromNodeId === null || edgeFromNodeId === "__armed__") {
      // First click (or toolbar armed the mode): begin drawing from this node
      setEdgeFromNodeId(nodeId);
      const center = fromNodeCenter(nodeId);
      setDraftLine({ x1: center.x, y1: center.y, x2: center.x, y2: center.y });
    } else {
      // Second click: complete the edge (if different node)
      if (nodeId === edgeFromNodeId) {
        setEdgeFromNodeId(null);
        setDraftLine(null);
        return;
      }
      const fromNode = canvas.nodes.find((n) => n.id === edgeFromNodeId);
      const toNode   = canvas.nodes.find((n) => n.id === nodeId);
      if (!fromNode || !toNode) { setEdgeFromNodeId(null); setDraftLine(null); return; }

      const newEdge: CanvasEdge = {
        id:       `edge-${Date.now()}`,
        fromNode: edgeFromNodeId,
        fromSide: nearestSide(fromNode, toNode),
        toNode:   nodeId,
        toSide:   nearestSide(toNode, fromNode),
        label:    edgeLabel(fromNode, toNode),
      };

      onCanvasChangeAction({ ...canvas, edges: [...canvas.edges, newEdge] });

      // Side-effect: agent→task = assign agent
      if (fromNode.type === "agent" && toNode.type === "task") {
        onUpdateCardAction(toNode.cardId, { assignedAgentId: (fromNode as CanvasAgentNode).agentId });
      }
      // Side-effect: task→agent = also assign (reverse convenience)
      if (fromNode.type === "task" && toNode.type === "agent") {
        onUpdateCardAction(fromNode.cardId, { assignedAgentId: (toNode as CanvasAgentNode).agentId });
      }

      setEdgeFromNodeId(null);
      setDraftLine(null);
    }
  }, [edgeFromNodeId, canvas, onCanvasChangeAction, onUpdateCardAction, fromNodeCenter]);

  const toggleEdgeMode = () => {
    if (edgeFromNodeId) {
      setEdgeFromNodeId(null);
      setDraftLine(null);
    } else {
      // Just arm the mode — user clicks first node to start
      setEdgeFromNodeId("__armed__");
    }
  };

  // ── Node mutations ──────────────────────────────────────────────────────
  const handleTextChange = useCallback((nodeId: string, text: string) => {
    onCanvasChangeAction({
      ...canvas,
      nodes: canvas.nodes.map((n) => (n.id === nodeId ? { ...n, text } : n)),
    });
  }, [canvas, onCanvasChangeAction]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    onCanvasChangeAction({
      nodes: canvas.nodes.filter((n) => n.id !== selectedNodeId),
      edges: canvas.edges.filter((e) => e.fromNode !== selectedNodeId && e.toNode !== selectedNodeId),
    });
    setSelectedNodeId(null);
  }, [canvas, onCanvasChangeAction, selectedNodeId]);

  // ── Add nodes ───────────────────────────────────────────────────────────
  const addTextNode = () => {
    const id = `note-${Date.now()}`;
    onCanvasChangeAction({
      ...canvas,
      nodes: [
        ...canvas.nodes,
        { id, type: "text", text: "", x: Math.round((400 - pan.x) / zoom), y: Math.round((200 - pan.y) / zoom), width: DEFAULT_NODE_W, height: DEFAULT_NODE_H, color: "5" },
      ],
    });
  };

  const addGroupNode = () => {
    const id = `group-${Date.now()}`;
    onCanvasChangeAction({
      ...canvas,
      nodes: [
        ...canvas.nodes,
        { id, type: "group", label: "Group", x: Math.round((400 - pan.x) / zoom), y: Math.round((200 - pan.y) / zoom), width: 400, height: 300 },
      ],
    });
  };

  const addAgentNode = (agentId: string) => {
    // Don't duplicate
    if (canvas.nodes.some((n) => n.type === "agent" && (n as CanvasAgentNode).agentId === agentId)) return;
    const id    = `agent-${agentId}-${Date.now()}`;
    const agent = agentMap.get(agentId);
    const count = canvas.nodes.filter((n) => n.type === "agent").length;
    onCanvasChangeAction({
      ...canvas,
      nodes: [
        ...canvas.nodes,
        {
          id, type: "agent", agentId,
          x: Math.round((80 - pan.x) / zoom),
          y: Math.round((80 + count * (AGENT_NODE_H + 16) - pan.y) / zoom),
          width: AGENT_NODE_W, height: AGENT_NODE_H,
          color: "6",
        } as CanvasAgentNode,
      ],
    });
    void agent; // used for name display on the card itself
  };

  const resetView = () => { setZoom(1); setPan({ x: 40, y: 40 }); };

  // ── Render ──────────────────────────────────────────────────────────────
  const groups     = canvas.nodes.filter((n) => n.type === "group") as CanvasGroupNode[];
  const foreground = canvas.nodes.filter((n) => n.type !== "group");
  const drawingEdge = edgeFromNodeId !== null;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* ── Toolbar ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/8 px-4 py-2">
        <button type="button" onClick={addTextNode}
          className="rounded border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 hover:text-white">
          + Note
        </button>
        <button type="button" onClick={addGroupNode}
          className="rounded border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 hover:text-white">
          + Group
        </button>
        <button type="button" onClick={onCreateCardAction}
          className="rounded border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-400/50">
          + Task
        </button>
        {clearAllPending ? (
          <>
            <button
              type="button"
              onClick={onConfirmClearAllAction}
              className="rounded border border-rose-400/45 bg-rose-500/18 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-rose-100 hover:border-rose-300/70"
            >
              Confirm Delete All
            </button>
            <button
              type="button"
              onClick={onCancelClearAllAction}
              className="rounded border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 hover:text-white"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onRequestClearAllAction}
            disabled={taskCount === 0}
            className="rounded border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-rose-100 hover:border-rose-400/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete All
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowAgentPalette((v) => !v)}
          className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition ${showAgentPalette ? "border-violet-400/40 bg-violet-500/15 text-violet-200" : "border-violet-500/20 bg-violet-500/8 text-violet-300/70 hover:border-violet-400/35"}`}
        >
          + Agent
        </button>

        {/* Connect mode toggle */}
        <button
          type="button"
          onClick={toggleEdgeMode}
          title={
            drawingEdge
              ? "Click another card, agent, or group to finish the line. Press Esc to cancel."
              : "Draw a line between cards, agents, or groups."
          }
          className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition ${drawingEdge ? "border-violet-400/60 bg-violet-500/25 text-violet-200 ring-1 ring-violet-400/30" : "border-white/10 bg-white/5 text-white/50 hover:text-white"}`}
        >
          <GitBranch className="inline h-3 w-3 -mt-px mr-1" />
          {drawingEdge ? "Click target" : "Connect Lines"}
        </button>

        {selectedNodeId && (
          <button type="button" onClick={handleDeleteSelected}
            className="rounded border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-rose-100 hover:border-rose-400/40">
            Delete node
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setZoom((z) => clamp(z - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
            className="rounded border border-white/10 bg-white/5 p-1 text-white/50 hover:text-white">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-12 text-center font-mono text-[10px] text-white/40">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => clamp(z + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
            className="rounded border border-white/10 bg-white/5 p-1 text-white/50 hover:text-white">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={resetView} title="Reset view"
            className="rounded border border-white/10 bg-white/5 p-1 text-white/50 hover:text-white">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-white/6 bg-cyan-500/[0.04] px-4 py-2 font-mono text-[10px] leading-relaxed text-cyan-50/65">
        Type directly on task cards. Use <span className="text-cyan-200">Assign</span> to give work to an agent.{" "}
        {drawingEdge ? (
          <span className="text-violet-100">Now click a second card, agent, or group to finish the line.</span>
        ) : (
          <>
            Use <span className="text-violet-200">Connect Lines</span>, then click one card and another card/agent.
          </>
        )}
      </div>

      {/* ── Agent palette (slides in below toolbar) ── */}
      {showAgentPalette && agents.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-white/6 bg-violet-950/20 px-4 py-2">
          {agents.map((agent) => (
            <AgentChip
              key={agent.agentId}
              agent={agent}
              onDrop={(id) => { addAgentNode(id); setShowAgentPalette(false); }}
            />
          ))}
        </div>
      )}
      {showAgentPalette && agents.length === 0 && (
        <div className="shrink-0 border-b border-white/6 bg-violet-950/20 px-4 py-2 font-mono text-[10px] text-violet-300/40">
          No agents available.
        </div>
      )}

      {/* ── Viewport ── */}
      <div
        ref={viewportRef}
        className={`relative min-h-0 flex-1 overflow-hidden bg-[#050810] select-none ${drawingEdge ? "cursor-crosshair" : "cursor-default"}`}
        style={{
          backgroundImage:    "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize:     `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerLeave={onViewportPointerUp}
      >
        {/* Transformed canvas */}
        <div
          style={{
            transform:       `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position:        "absolute",
            width:           canvasBounds.w,
            height:          canvasBounds.h,
          }}
        >
          <EdgeLayer
            edges={canvas.edges}
            nodes={canvas.nodes}
            canvasW={canvasBounds.w}
            canvasH={canvasBounds.h}
            draftLine={draftLine}
          />

          {/* Groups behind */}
          {groups.map((node) => (
            <GroupNodeCard
              key={node.id}
              node={node}
              selected={selectedNodeId === node.id}
              drawingEdge={drawingEdge}
              onSelect={() => setSelectedNodeId(node.id)}
              onDragStart={onNodeDragStart}
              onStartEdge={handleStartEdge}
            />
          ))}

          {/* Foreground nodes */}
          {foreground.map((node) => {
            if (node.type === "task") {
              const card = cardMap.get(node.cardId);
              if (!card) return null;
              return (
                <TaskNodeCard
                  key={node.id}
                  node={node}
                  card={card}
                  agents={agents}
                  selected={selectedNodeId === node.id || selectedCardId === card.id}
                  drawingEdge={drawingEdge}
                  onSelect={() => { setSelectedNodeId(node.id); onSelectCardAction(card.id); }}
                  onDragStart={onNodeDragStart}
                  onStatusChange={onMoveCardAction}
                  onCardChange={onUpdateCardAction}
                  onStartEdge={handleStartEdge}
                  onResizeStart={onNodeResizeStart}
                />
              );
            }
            if (node.type === "text") {
              return (
                <TextNodeCard
                  key={node.id}
                  node={node}
                  selected={selectedNodeId === node.id}
                  drawingEdge={drawingEdge}
                  onSelect={() => setSelectedNodeId(node.id)}
                  onDragStart={onNodeDragStart}
                  onTextChange={handleTextChange}
                  onStartEdge={handleStartEdge}
                />
              );
            }
            if (node.type === "agent") {
              const agent = agentMap.get((node as CanvasAgentNode).agentId);
              return (
                <AgentNodeCard
                  key={node.id}
                  node={node as CanvasAgentNode}
                  agent={agent}
                  selected={selectedNodeId === node.id}
                  drawingEdge={drawingEdge}
                  onSelect={() => setSelectedNodeId(node.id)}
                  onDragStart={onNodeDragStart}
                  onStartEdge={handleStartEdge}
                />
              );
            }
            return null;
          })}
        </div>
      </div>

      {/* Hints */}
      <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[9px] uppercase tracking-[0.12em] text-white/15">
        {drawingEdge
          ? "Click a node to connect · Esc to cancel"
          : "Scroll to zoom · drag to pan"}
      </div>
    </div>
  );
}
