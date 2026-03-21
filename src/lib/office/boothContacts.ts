"use client";

import { randomUUID } from "@/lib/uuid";

export type BoothContact = {
  id: string;
  name: string;
  phone: string;
};

export type BoothHistoryEntry = {
  id: string;
  kind: "call" | "sms";
  name: string | null;
  phone: string;
  message: string | null;
  timestamp: number;
};

const CONTACTS_KEY = "claw3d-booth-contacts";
const HISTORY_KEY = "claw3d-booth-history";
const HISTORY_LIMIT = 50;

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const loadContacts = (): BoothContact[] => {
  if (typeof window === "undefined") return [];
  return safeParse<BoothContact[]>(localStorage.getItem(CONTACTS_KEY), []);
};

export const saveContacts = (contacts: BoothContact[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
};

export const addContact = (name: string, phone: string): BoothContact => {
  const contact: BoothContact = { id: randomUUID(), name: name.trim(), phone: phone.trim() };
  const contacts = loadContacts();
  saveContacts([contact, ...contacts]);
  return contact;
};

export const deleteContact = (id: string): void => {
  saveContacts(loadContacts().filter((c) => c.id !== id));
};

export const findContactByPhone = (phone: string): BoothContact | null => {
  const normalized = phone.replace(/\s/g, "");
  return loadContacts().find((c) => c.phone.replace(/\s/g, "") === normalized) ?? null;
};

export const loadHistory = (): BoothHistoryEntry[] => {
  if (typeof window === "undefined") return [];
  return safeParse<BoothHistoryEntry[]>(localStorage.getItem(HISTORY_KEY), []);
};

export const addHistoryEntry = (
  entry: Omit<BoothHistoryEntry, "id" | "timestamp">,
): BoothHistoryEntry => {
  const full: BoothHistoryEntry = { ...entry, id: randomUUID(), timestamp: Date.now() };
  const history = loadHistory();
  const next = [full, ...history].slice(0, HISTORY_LIMIT);
  if (typeof window !== "undefined") {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }
  return full;
};

export const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
