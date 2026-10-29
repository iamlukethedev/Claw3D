"use client";

import { useId, useState, type FormEvent } from "react";

import type {
  BulletinCardChanges,
  BulletinCardDraft,
  BulletinMutationResult,
} from "@/features/office/bulletin/bulletinBoard";
import { BULLETIN_TYPE_THEME } from "@/features/office/bulletin/bulletinTheme";
import {
  BULLETIN_CARD_TYPES,
  BULLETIN_LIMITS,
  type BulletinCard,
  type BulletinCardType,
  type BulletinPriority,
} from "@/features/office/bulletin/types";

export type BulletinComposerAgent = { agentId: string; name: string };

type BulletinCardComposerProps = {
  // Card being edited; omitted when creating a new card.
  card?: BulletinCard | null;
  agents: BulletinComposerAgent[];
  onCreate: (draft: BulletinCardDraft) => BulletinMutationResult;
  onUpdate: (id: string, changes: BulletinCardChanges) => BulletinMutationResult;
  onDone: () => void;
};

const FIELD =
  "w-full rounded-md border border-amber-200/15 bg-black/35 px-3 py-2 text-sm text-amber-50 outline-none transition placeholder:text-amber-100/30 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-400/20";
const LABEL = "font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100/60";

const parseTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);

export function BulletinCardComposer({ card, agents, onCreate, onUpdate, onDone }: BulletinCardComposerProps) {
  const formId = useId();
  const [type, setType] = useState<BulletinCardType>(card?.type ?? "goal");
  const [title, setTitle] = useState(card?.title ?? "");
  const [body, setBody] = useState(card?.body ?? "");
  const [priority, setPriority] = useState<BulletinPriority>(card?.priority ?? "normal");
  const [agentId, setAgentId] = useState(card?.agentId ?? "");
  const [tags, setTags] = useState(card?.tags.join(", ") ?? "");
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = {
      type,
      title,
      body,
      priority,
      agentId: agentId || null,
      tags: parseTags(tags),
    };
    const result = card ? onUpdate(card.id, fields) : onCreate({ ...fields, pinned });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby={`${formId}-heading`}
      className="rounded-xl border border-amber-200/15 bg-stone-950/92 p-4 shadow-2xl sm:p-5"
    >
      <h3 id={`${formId}-heading`} className="bulletin-display text-2xl tracking-[0.06em] text-amber-50">
        {card ? "Edit note" : "Pin a new note"}
      </h3>

      <fieldset className="mt-3">
        <legend className={LABEL}>Type</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {BULLETIN_CARD_TYPES.map((option) => {
            const theme = BULLETIN_TYPE_THEME[option];
            const selected = option === type;
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400 ${
                  selected
                    ? "border-amber-200/50 bg-amber-100/12 text-amber-50"
                    : "border-amber-200/10 text-amber-100/60 hover:border-amber-200/30 hover:text-amber-50"
                }`}
              >
                <input
                  type="radio"
                  name={`${formId}-type`}
                  value={option}
                  checked={selected}
                  onChange={() => setType(option)}
                  className="sr-only"
                />
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.pin }} />
                {theme.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-3 grid gap-3">
        <label className="grid gap-1.5">
          <span className={LABEL}>Title</span>
          <input
            className={FIELD}
            value={title}
            maxLength={BULLETIN_LIMITS.titleMax}
            onChange={(event) => {
              setTitle(event.target.value);
              setError(null);
            }}
            placeholder="Ship Hermes adapter support"
            required
            autoFocus
          />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Details</span>
          <textarea
            className={`${FIELD} min-h-24 resize-y`}
            value={body}
            maxLength={BULLETIN_LIMITS.bodyMax}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Context, owner, next step."
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5">
            <span className={LABEL}>Priority</span>
            <select
              className={FIELD}
              value={priority}
              onChange={(event) => setPriority(event.target.value as BulletinPriority)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">Urgent</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={LABEL}>Linked agent</span>
            <select className={FIELD} value={agentId} onChange={(event) => setAgentId(event.target.value)}>
              <option value="">None</option>
              {agents.map((agent) => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={LABEL}>Tags</span>
            <input
              className={FIELD}
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="release, hermes"
            />
          </label>
        </div>
        {!card ? (
          <label className="flex items-center gap-2 text-sm text-amber-100/80">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(event) => setPinned(event.target.checked)}
              className="h-4 w-4 accent-amber-400"
            />
            Pin to the top of the board
          </label>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-amber-200/15 px-4 py-2 text-sm text-amber-100/70 transition hover:bg-amber-100/8 hover:text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          {card ? "Save note" : "Pin note"}
        </button>
      </div>
    </form>
  );
}
