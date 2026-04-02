import crypto from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "claw3d_crypto_launch_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type SessionPayload = {
  scope: "crypto_launch_operator";
  exp: number;
};

const getSessionSecret = () => {
  const secret = process.env.CRYPTO_LAUNCH_SESSION_SECRET?.trim() || "";
  if (!secret) {
    throw new Error("CRYPTO_LAUNCH_SESSION_SECRET is not configured.");
  }
  return secret;
};

const getOperatorPassword = () => {
  const password = process.env.CRYPTO_LAUNCH_OPERATOR_PASSWORD?.trim() || "";
  if (!password) {
    throw new Error("CRYPTO_LAUNCH_OPERATOR_PASSWORD is not configured.");
  }
  return password;
};

const encodePayload = (payload: SessionPayload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const decodePayload = (value: string): SessionPayload | null => {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionPayload;
    if (
      parsed &&
      parsed.scope === "crypto_launch_operator" &&
      typeof parsed.exp === "number" &&
      Number.isFinite(parsed.exp)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const signPayload = (encodedPayload: string) =>
  crypto.createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");

const buildCookieValue = (payload: SessionPayload) => {
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
};

const parseCookieValue = (value: string | undefined): SessionPayload | null => {
  if (!value) return null;
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSignature = signPayload(encodedPayload);
  const left = Buffer.from(expectedSignature);
  const right = Buffer.from(signature);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }
  const payload = decodePayload(encodedPayload);
  if (!payload || payload.exp <= Date.now()) {
    return null;
  }
  return payload;
};

export const createLaunchOperatorSession = () =>
  buildCookieValue({
    scope: "crypto_launch_operator",
    exp: Date.now() + SESSION_TTL_MS,
  });

export const verifyLaunchOperatorPassword = (candidate: string) => {
  const expected = Buffer.from(getOperatorPassword());
  const actual = Buffer.from(candidate.trim());
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

export const hasLaunchOperatorSession = (request: NextRequest) =>
  Boolean(parseCookieValue(request.cookies.get(SESSION_COOKIE_NAME)?.value));

export const applyLaunchSessionCookie = (response: NextResponse, value: string) => {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
};

export const clearLaunchSessionCookie = (response: NextResponse) => {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
};
