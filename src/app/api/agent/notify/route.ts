import { NextResponse } from "next/server";
import {
  isTwilioConfigured,
  normalizePhoneNumber,
  sendSms,
  makeCall,
} from "@/lib/office/twilio";

export const runtime = "nodejs";

// ── Config ────────────────────────────────────────────────────────────────────

const OWNER_PHONE_NUMBER = process.env.OWNER_PHONE_NUMBER?.trim() ?? "";
const MAX_MESSAGE_CHARS = 300;

// Agents autorisés : liste d'IDs séparés par des virgules, ou vide = tous autorisés
const ALLOWED_AGENTS: Set<string> | null = (() => {
  const raw = process.env.NOTIFY_ALLOWED_AGENTS?.trim();
  if (!raw) return null;
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? new Set(ids) : null;
})();

const RATE_LIMIT_PER_AGENT = Number(process.env.NOTIFY_RATE_LIMIT_PER_AGENT ?? 3);
const RATE_WINDOW_MS = 60 * 60 * 1_000; // 1 heure
const GLOBAL_RATE_LIMIT = 10;

// ── Rate limiting (in-memory, reset au redémarrage) ───────────────────────────

type RateBucket = { count: number; resetAt: number };
const agentBuckets = new Map<string, RateBucket>();
let globalBucket: RateBucket = { count: 0, resetAt: Date.now() + RATE_WINDOW_MS };

const checkAndIncrement = (bucket: RateBucket, limit: number, now: number): boolean => {
  if (now >= bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_WINDOW_MS;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
};

const checkRateLimit = (agentId: string): { ok: boolean; retryInMinutes: number } => {
  const now = Date.now();

  // Global
  if (!checkAndIncrement(globalBucket, GLOBAL_RATE_LIMIT, now)) {
    return { ok: false, retryInMinutes: Math.ceil((globalBucket.resetAt - now) / 60_000) };
  }

  // Par agent
  let bucket = agentBuckets.get(agentId);
  if (!bucket) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    agentBuckets.set(agentId, bucket);
  }
  if (!checkAndIncrement(bucket, RATE_LIMIT_PER_AGENT, now)) {
    return { ok: false, retryInMinutes: Math.ceil((bucket.resetAt - now) / 60_000) };
  }

  return { ok: true, retryInMinutes: 0 };
};

// ── Sanitisation ──────────────────────────────────────────────────────────────

const sanitizeMessage = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
};

const sanitizeAgentId = (value: unknown): string => {
  if (typeof value !== "string") return "unknown";
  return value.replace(/[^\w\-]/g, "").slice(0, 64) || "unknown";
};

// ── Handler ───────────────────────────────────────────────────────────────────

type NotifyRequestBody = {
  kind?: string;
  message?: unknown;
  agentId?: unknown;
};

export async function POST(request: Request) {
  try {
    // Vérifications de config serveur
    if (!OWNER_PHONE_NUMBER) {
      return NextResponse.json(
        { error: "Owner notifications are not configured on this server." },
        { status: 503 },
      );
    }
    if (!isTwilioConfigured()) {
      return NextResponse.json(
        { error: "Twilio is not configured on this server." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as NotifyRequestBody;
    const agentId = sanitizeAgentId(body.agentId);
    const kind = body.kind === "call" ? "call" : "sms";
    const message = sanitizeMessage(body.message);

    if (!message) {
      return NextResponse.json({ error: "message is required." }, { status: 400 });
    }

    // Allowlist
    if (ALLOWED_AGENTS !== null && !ALLOWED_AGENTS.has(agentId)) {
      return NextResponse.json(
        { error: "This agent is not allowed to send notifications." },
        { status: 403 },
      );
    }

    // Rate limit
    const rate = checkRateLimit(agentId);
    if (!rate.ok) {
      return NextResponse.json(
        { error: `Rate limit reached. Try again in ${rate.retryInMinutes} minute(s).` },
        { status: 429 },
      );
    }

    const to = normalizePhoneNumber(OWNER_PHONE_NUMBER);
    const excerpt = message.length > 60 ? message.slice(0, 60) + "…" : message;

    if (kind === "call") {
      await makeCall({ to, message });
      console.log(`[agent/notify] call | agent=${agentId} | "${excerpt}"`);
      return NextResponse.json({ ok: true, kind: "call" }, { headers: { "Cache-Control": "no-store" } });
    } else {
      await sendSms({ to, body: message });
      console.log(`[agent/notify] sms  | agent=${agentId} | "${excerpt}"`);
      return NextResponse.json({ ok: true, kind: "sms" }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Notification failed.";
    console.error(`[agent/notify] error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
