"use client";

// Spotify PKCE OAuth helpers.
// No client secret is needed; PKCE is the recommended flow for SPAs.

const STORAGE_PREFIX = "soundhermes_";
const TOKEN_KEY = `${STORAGE_PREFIX}token`;
const EXPIRY_KEY = `${STORAGE_PREFIX}expiry`;
const VERIFIER_KEY = `${STORAGE_PREFIX}verifier`;
const CLIENT_ID_KEY = `${STORAGE_PREFIX}client_id`;
const CALLBACK_BASE_URL_KEY = `${STORAGE_PREFIX}callback_base_url`;
const REDIRECT_URI_KEY = `${STORAGE_PREFIX}redirect_uri`;
const STATE_KEY = `${STORAGE_PREFIX}state`;

export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

// ---------------------------------------------------------------------------
// Client ID persistence
// ---------------------------------------------------------------------------

export const saveClientId = (id: string) => {
  try { localStorage.setItem(CLIENT_ID_KEY, id); } catch { /* ignore */ }
};

export const loadClientId = (): string => {
  try { return localStorage.getItem(CLIENT_ID_KEY) ?? ""; } catch { return ""; }
};

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, "");

export const saveCallbackBaseUrl = (url: string) => {
  try { localStorage.setItem(CALLBACK_BASE_URL_KEY, normalizeBaseUrl(url)); } catch { /* ignore */ }
};

export const loadCallbackBaseUrl = (): string => {
  try { return localStorage.getItem(CALLBACK_BASE_URL_KEY) ?? ""; } catch { return ""; }
};

// ---------------------------------------------------------------------------
// Token persistence
// ---------------------------------------------------------------------------

export const saveToken = (token: string, expiresInSeconds: number) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
  } catch { /* ignore */ }
};

export const loadToken = (): string | null => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = Number(localStorage.getItem(EXPIRY_KEY) ?? "0");
    if (!token || Date.now() > expiry) return null;
    return token;
  } catch { return null; }
};

export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    localStorage.removeItem(VERIFIER_KEY);
    localStorage.removeItem(REDIRECT_URI_KEY);
    localStorage.removeItem(STATE_KEY);
  } catch { /* ignore */ }
};

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

const generateRandom = (length: number): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
};

const sha256 = async (plain: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest("SHA-256", data);
};

const base64urlEncode = (buffer: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// ---------------------------------------------------------------------------
// OAuth redirect.
// ---------------------------------------------------------------------------

export const startSpotifyAuth = async (
  clientId: string,
  redirectUri: string,
  popup?: Window | null,
) => {
  const verifier = generateRandom(64);
  const state = generateRandom(32);
  const challenge = base64urlEncode(await sha256(verifier));
  try {
    localStorage.setItem(VERIFIER_KEY, verifier);
    localStorage.setItem(REDIRECT_URI_KEY, redirectUri);
    localStorage.setItem(STATE_KEY, state);
  } catch { /* ignore */ }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES,
  });

  const authorizeUrl = `https://accounts.spotify.com/authorize?${params}`;
  if (popup && !popup.closed) {
    popup.location.href = authorizeUrl;
    popup.focus();
    return;
  }
  window.location.href = authorizeUrl;
};

// ---------------------------------------------------------------------------
// Token exchange (called after redirect back with ?code=...)
// ---------------------------------------------------------------------------

export const exchangeCodeForToken = async (
  code: string,
  clientId: string,
  redirectUri?: string,
): Promise<boolean> => {
  try {
    const verifier = localStorage.getItem(VERIFIER_KEY);
    const resolvedRedirectUri = redirectUri ?? localStorage.getItem(REDIRECT_URI_KEY);
    if (!verifier || !resolvedRedirectUri) return false;

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: resolvedRedirectUri,
      code_verifier: verifier,
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) return false;

    const json = await res.json() as { access_token: string; expires_in: number };
    saveToken(json.access_token, json.expires_in);
    localStorage.removeItem(VERIFIER_KEY);
    localStorage.removeItem(REDIRECT_URI_KEY);
    localStorage.removeItem(STATE_KEY);
    return true;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Redirect URI helper.
// ---------------------------------------------------------------------------

export const buildRedirectUri = (callbackBaseUrl?: string): string => {
  const baseUrl = normalizeBaseUrl(callbackBaseUrl ?? loadCallbackBaseUrl());
  return baseUrl ? `${baseUrl}/spotify/callback` : "";
};

export const loadAuthState = (): string => {
  try { return localStorage.getItem(STATE_KEY) ?? ""; } catch { return ""; }
};
