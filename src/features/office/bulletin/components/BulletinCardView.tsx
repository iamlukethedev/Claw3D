"use client";

import { Archive, ArchiveRestore, ExternalLink, MessageSquare, Pencil, Pin, PinOff } from "lucide-react";

import { BULLETIN_TYPE_THEME } from "@/features/office/bulletin/bulletinTheme";
import type { BulletinCard } from "@/features/office/bulletin/types";
import type { TaskBoardStatus } from "@/features/office/tasks/types";

export type BulletinLinkedTask = {
  title: string;
  status: TaskBoardStatus;
};

type BulletinCardViewProps = {
  card: BulletinCard;
  nowMs: number;
  agentName: string | null;
  linkedTask: BulletinLinkedTask | null;
  onEdit: (card: BulletinCard) => void;
  onTogglePinned: (card: BulletinCard) => void;
  onToggleArchived: (card: BulletinCard) => void;
  onOpenAgent: (agentId: string) => void;
  onOpenTask: (taskId: string) => void;
};

const TASK_STATUS_LABEL: Record<TaskBoardStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  review: "In review",
  done: "Done",
};

// Small deterministic tilt so the board reads as hand-pinned paper.
const TILTS = ["-1.2deg", "0.8deg", "-0.4deg", "1.1deg", "0.2deg", "-0.9deg"];

const tiltFor = (id: string): string => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return TILTS[hash % TILTS.length] ?? "0deg";
};

export const formatCardAge = (iso: string, nowMs: number): string => {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "";
  const minutes = Math.max(0, Math.round((nowMs - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const authorLabel = (card: BulletinCard, agentName: string | null): string => {
  if (card.authorType === "human") return card.authorName ?? "You";
  if (card.authorType === "agent") return card.authorName ?? agentName ?? "Agent";
  return card.authorName ? `${card.authorName} · auto` : "Office · auto";
};

const ACTION_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-900/8 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500";

export function BulletinCardView({
  card,
  nowMs,
  agentName,
  linkedTask,
  onEdit,
  onTogglePinned,
  onToggleArchived,
  onOpenAgent,
  onOpenTask,
}: BulletinCardViewProps) {
  const theme = BULLETIN_TYPE_THEME[card.type];
  const isSystem = card.authorType === "system";
  const titleId = `bulletin-card-${card.id}-title`;
  return (
    <article
      aria-labelledby={titleId}
      className="bulletin-paper group relative flex min-h-[148px] flex-col rounded-[3px] px-4 pb-3 pt-5 text-stone-800 transition-transform duration-200 hover:z-10 hover:-translate-y-0.5 focus-within:z-10"
      style={{
        backgroundColor: theme.paper,
        transform: card.archived ? undefined : `rotate(${tiltFor(card.id)})`,
        opacity: card.archived ? 0.72 : 1,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5 rounded-t-[3px]"
        style={{ backgroundColor: theme.band }}
      />
      {card.pinned ? (
        <span aria-hidden="true" className="bulletin-tape absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2" />
      ) : (
        <span
          aria-hidden="true"
          className="bulletin-pin absolute -top-1.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: theme.pin }}
        />
      )}

      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: theme.pin }}>
          {theme.label}
        </span>
        {card.priority === "high" ? (
          <span className="rounded-sm bg-rose-600 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white">
            Urgent
          </span>
        ) : card.priority === "low" ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-stone-400">Low</span>
        ) : null}
        {card.archived ? (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-stone-500">
            {card.archivedBy === "system" ? "Resolved" : "Archived"}
          </span>
        ) : null}
      </div>

      <h4 id={titleId} className="mt-1.5 text-[15px] font-semibold leading-snug text-stone-900 [overflow-wrap:anywhere]">
        {card.title}
      </h4>
      {card.body ? (
        <p className="mt-1.5 line-clamp-6 whitespace-pre-line text-[13px] leading-relaxed text-stone-600 [overflow-wrap:anywhere]">
          {card.body}
        </p>
      ) : null}

      {card.tags.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Tags">
          {card.tags.map((tag) => (
            <li key={tag} className="rounded-sm bg-stone-900/6 px-1.5 py-px font-mono text-[10px] text-stone-500">
              #{tag}
            </li>
          ))}
        </ul>
      ) : null}

      {card.agentId || (card.taskId && linkedTask) ? (
        <div className="mt-2.5 flex flex-col gap-1">
          {card.agentId ? (
            <button
              type="button"
              className="inline-flex w-fit items-center gap-1.5 rounded-md text-[12px] font-medium text-stone-700 underline decoration-stone-300 underline-offset-2 transition hover:text-stone-950 hover:decoration-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              onClick={() => onOpenAgent(card.agentId as string)}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Open chat with {agentName ?? "agent"}
            </button>
          ) : null}
          {card.taskId && linkedTask ? (
            <button
              type="button"
              className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-md text-left text-[12px] font-medium text-stone-700 underline decoration-stone-300 underline-offset-2 transition hover:text-stone-950 hover:decoration-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              onClick={() => onOpenTask(card.taskId as string)}
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Kanban · {TASK_STATUS_LABEL[linkedTask.status]}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <footer className="mt-auto flex items-center gap-2 pt-3">
        <span className="min-w-0 truncate font-mono text-[10px] text-stone-500">
          {authorLabel(card, agentName)} · {formatCardAge(card.updatedAt, nowMs)}
        </span>
        <div className="ml-auto flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {!isSystem && !card.archived ? (
            <button type="button" className={ACTION_BUTTON} aria-label={`Edit "${card.title}"`} onClick={() => onEdit(card)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
          {!card.archived ? (
            <button
              type="button"
              className={ACTION_BUTTON}
              aria-label={card.pinned ? `Unpin "${card.title}"` : `Pin "${card.title}"`}
              aria-pressed={card.pinned}
              onClick={() => onTogglePinned(card)}
            >
              {card.pinned ? (
                <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Pin className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          ) : null}
          <button
            type="button"
            className={ACTION_BUTTON}
            aria-label={card.archived ? `Restore "${card.title}"` : `Archive "${card.title}"`}
            onClick={() => onToggleArchived(card)}
          >
            {card.archived ? (
              <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </footer>
    </article>
  );
}
