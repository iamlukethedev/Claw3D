import crypto from "node:crypto";
import { NextResponse } from "next/server";

import {
  appendOfficeExternalEvent,
  listOfficeExternalEvents,
  type OfficeExternalEventEffect,
} from "@/lib/office/externalEventsStore";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;
const SIGNATURE_HEADER = "x-claw3d-signature";
const TIMESTAMP_HEADER = "x-claw3d-timestamp";
const MAX_TIMESTAMP_SKEW_MS = 5 * 60_000;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const errorJson = (message: string, status: number) => json({ error: message }, status);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const resolveSecret = () => process.env.CLAW3D_OFFICE_EVENTS_SECRET?.trim() ?? "";

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    crypto.timingSafeEqual(leftBuffer, leftBuffer);
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const buildExpectedSignature = (params: {
  bodyText: string;
  secret: string;
  timestamp: string;
}) =>
  `sha256=${crypto
    .createHmac("sha256", params.secret)
    .update(`${params.timestamp}.${params.bodyText}`)
    .digest("hex")}`;

const verifySignature = (request: Request, bodyText: string): string | null => {
  const secret = resolveSecret();
  if (!secret) return null;
  const signature = request.headers.get(SIGNATURE_HEADER)?.trim() ?? "";
  const timestamp = request.headers.get(TIMESTAMP_HEADER)?.trim() ?? "";
  if (!signature || !timestamp) {
    return "Office event signature and timestamp are required.";
  }
  const timestampMs = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampMs)) {
    return "Office event timestamp is invalid.";
  }
  if (Math.abs(Date.now() - timestampMs) > MAX_TIMESTAMP_SKEW_MS) {
    return "Office event timestamp is outside the allowed window.";
  }
  const expected = buildExpectedSignature({ bodyText, secret, timestamp });
  return safeCompare(signature, expected) ? null : "Office event signature is invalid.";
};

const normalizeString = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizeEffect = (value: unknown): OfficeExternalEventEffect | "none" => {
  if (value === "confetti" || value === "alarm" || value === "doorbell") return value;
  return "none";
};

export async function GET() {
  try {
    return json({ events: listOfficeExternalEvents() });
  } catch (error) {
    console.error("[office-events] GET failed.", error);
    return errorJson("Internal error reading office events.", 500);
  }
}

export async function POST(request: Request) {
  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    return errorJson("Invalid office event payload.", 400);
  }
  if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) {
    return errorJson("Office event payload is too large.", 413);
  }
  const signatureError = verifySignature(request, bodyText);
  if (signatureError) {
    return errorJson(signatureError, 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return errorJson("Invalid JSON payload.", 400);
  }
  if (!isRecord(body)) {
    return errorJson("Office event payload must be an object.", 400);
  }

  const source = normalizeString(body.source, 80);
  const eventType = normalizeString(body.eventType ?? body.type, 120);
  const title = normalizeString(body.title, 140);
  if (!source || !eventType || !title) {
    return errorJson("source, eventType, and title are required.", 400);
  }

  try {
    const event = appendOfficeExternalEvent({
      source,
      type: eventType,
      title,
      message: normalizeString(body.message, 500) || null,
      effect: normalizeEffect(body.effect),
      agentId: normalizeString(body.agentId, 120) || null,
      metadata: {
        externalUrl: normalizeString(body.externalUrl, 500) || null,
      },
    });
    return json({ event }, 201);
  } catch (error) {
    console.error("[office-events] POST failed.", error);
    return errorJson("Internal error writing office event.", 500);
  }
}
