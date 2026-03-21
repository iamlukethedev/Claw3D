/**
 * Server-side device identity for Claw3D Studio proxy.
 * Generates and persists an Ed25519 keypair used to sign gateway connect frames
 * when the browser cannot (e.g. non-secure HTTP context).
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const { getPublicKeyAsync, signAsync, utils } = require("@noble/ed25519");

// ── base64url helpers ──────────────────────────────────────────────────────

const base64UrlEncode = (bytes) => {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const base64UrlDecode = (input) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
};

// ── device id = hex(sha256(pubKey)) ───────────────────────────────────────

const fingerprintPublicKey = (pubKeyBytes) =>
  crypto.createHash("sha256").update(Buffer.from(pubKeyBytes)).digest("hex");

// ── payload builder (mirrors GatewayBrowserClient) ────────────────────────

const buildDeviceAuthPayload = ({ deviceId, clientId, clientMode, role, scopes, signedAtMs, token, nonce }) => {
  const version = nonce ? "v2" : "v1";
  const base = [
    version,
    deviceId,
    clientId,
    clientMode,
    role,
    scopes.join(","),
    String(signedAtMs),
    token ?? "",
  ];
  if (version === "v2") base.push(nonce ?? "");
  return base.join("|");
};

// ── persistent identity store ──────────────────────────────────────────────

const resolveDevicePath = (env = process.env) => {
  const home = env.HOME || env.USERPROFILE || os.homedir();
  const stateDir = env.OPENCLAW_STATE_DIR?.trim() || path.join(home, ".openclaw");
  return path.join(stateDir, "claw3d", "studio-device.json");
};

const loadStoredIdentity = (devicePath) => {
  try {
    if (!fs.existsSync(devicePath)) return null;
    const stored = JSON.parse(fs.readFileSync(devicePath, "utf8"));
    if (
      stored?.version === 1 &&
      typeof stored.deviceId === "string" &&
      typeof stored.publicKey === "string" &&
      typeof stored.privateKey === "string"
    ) {
      return { deviceId: stored.deviceId, publicKey: stored.publicKey, privateKey: stored.privateKey };
    }
  } catch {}
  return null;
};

const saveIdentity = (devicePath, identity) => {
  try {
    fs.mkdirSync(path.dirname(devicePath), { recursive: true });
    fs.writeFileSync(
      devicePath,
      JSON.stringify({ version: 1, ...identity, createdAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("[studio-device] Failed to save device identity:", err?.message ?? err);
  }
};

const generateIdentity = async () => {
  const privateKeyBytes = utils.randomSecretKey();
  const publicKeyBytes = await getPublicKeyAsync(privateKeyBytes);
  const deviceId = fingerprintPublicKey(publicKeyBytes);
  return {
    deviceId,
    publicKey: base64UrlEncode(publicKeyBytes),
    privateKey: base64UrlEncode(privateKeyBytes),
  };
};

// Singleton promise — one identity per process lifetime.
let _identityPromise = null;

const getStudioDeviceIdentity = (env = process.env) => {
  if (!_identityPromise) {
    const devicePath = resolveDevicePath(env);
    _identityPromise = (async () => {
      const stored = loadStoredIdentity(devicePath);
      if (stored) return stored;
      const identity = await generateIdentity();
      saveIdentity(devicePath, identity);
      return identity;
    })();
  }
  return _identityPromise;
};

// ── public API ─────────────────────────────────────────────────────────────

/**
 * Build a signed device auth block for inclusion in a gateway connect frame.
 *
 * @param {object} params
 * @param {string|undefined} params.nonce - Challenge nonce from connect.challenge event.
 * @param {string|undefined} params.token - Gateway auth token.
 * @param {string} params.clientId
 * @param {string} params.clientMode
 * @param {string} params.role
 * @param {string[]} params.scopes
 * @returns {Promise<{id:string, publicKey:string, signature:string, signedAt:number, nonce:string|undefined}>}
 */
const buildServerDeviceAuth = async ({ nonce, token, clientId, clientMode, role, scopes }) => {
  const identity = await getStudioDeviceIdentity();
  const signedAtMs = Date.now();
  const privKeyBytes = base64UrlDecode(identity.privateKey);
  const payload = buildDeviceAuthPayload({
    deviceId: identity.deviceId,
    clientId,
    clientMode,
    role,
    scopes,
    signedAtMs,
    token,
    nonce,
  });
  const sigBytes = await signAsync(Buffer.from(payload, "utf8"), privKeyBytes);
  return {
    id: identity.deviceId,
    publicKey: identity.publicKey,
    signature: base64UrlEncode(sigBytes),
    signedAt: signedAtMs,
    nonce,
  };
};

module.exports = { buildServerDeviceAuth, getStudioDeviceIdentity };
