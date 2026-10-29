import type { BulletinCardType } from "@/features/office/bulletin/types";

// One color language for the 2D board and the in-world prop, so a card
// spotted across the office reads the same once the board is opened.
export type BulletinTypeTheme = {
  label: string;
  pin: string;
  band: string;
  paper: string;
  chip: string;
};

export const BULLETIN_TYPE_THEME: Record<BulletinCardType, BulletinTypeTheme> = {
  goal: {
    label: "Goal",
    pin: "#10b981",
    band: "#34d399",
    paper: "#f3faf2",
    chip: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  },
  announcement: {
    label: "Announcement",
    pin: "#0ea5e9",
    band: "#38bdf8",
    paper: "#f2f8fc",
    chip: "bg-sky-500/15 text-sky-200 border-sky-400/30",
  },
  blocker: {
    label: "Blocker",
    pin: "#e11d48",
    band: "#fb7185",
    paper: "#fff3f2",
    chip: "bg-rose-500/15 text-rose-200 border-rose-400/30",
  },
  handoff: {
    label: "Handoff",
    pin: "#7c3aed",
    band: "#a78bfa",
    paper: "#f7f4fd",
    chip: "bg-violet-500/15 text-violet-200 border-violet-400/30",
  },
  meeting_note: {
    label: "Meeting note",
    pin: "#d97706",
    band: "#fbbf24",
    paper: "#fffbea",
    chip: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  },
};
