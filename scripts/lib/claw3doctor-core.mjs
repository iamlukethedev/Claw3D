export const DOCTOR_STATUSES = {
  pass: "PASS",
  warn: "WARN",
  fail: "FAIL",
};

const VALID_ADAPTER_TYPES = new Set(["openclaw", "hermes", "demo", "custom"]);
const TUNNEL_HOST_PATTERN = /(cloudflare|trycloudflare|ngrok|tailscale|ts\.net|tunnel)/i;

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

const trimString = (value) => (typeof value === "string" ? value.trim() : "");

export const normalizeAdapterType = (value, fallback = "openclaw") => {
  const normalized = trimString(value).toLowerCase();
  return VALID_ADAPTER_TYPES.has(normalized) ? normalized : fallback;
};

export const resolveRuntimeContext = ({ settings, upstreamGateway, env = process.env }) => {
  const gateway = isRecord(settings?.gateway) ? settings.gateway : null;
  const adapterType = normalizeAdapterType(
    gateway?.adapterType ?? upstreamGateway?.adapterType ?? env.CLAW3D_GATEWAY_ADAPTER_TYPE,
    "openclaw",
  );
  const rawProfiles = isRecord(gateway?.profiles) ? gateway.profiles : null;
  const profiles = {};
  for (const key of VALID_ADAPTER_TYPES) {
    const profile = isRecord(rawProfiles?.[key]) ? rawProfiles[key] : null;
    const url = trimString(profile?.url);
    const token = trimString(profile?.token);
    if (!url) continue;
    profiles[key] = { url, token };
  }

  const selectedProfile =
    profiles[adapterType] ??
    (trimString(upstreamGateway?.url)
      ? {
          url: trimString(upstreamGateway.url),
          token: trimString(upstreamGateway?.token),
        }
      : null);

  return {
    adapterType,
    gatewayUrl: selectedProfile?.url ?? "",
    token: selectedProfile?.token ?? "",
    tokenConfigured: Boolean(selectedProfile?.token),
    profiles,
  };
};

export const buildGatewayWarnings = ({ gatewayUrl, studioAccessToken = "", host = "" }) => {
  const warnings = [];
  const url = trimString(gatewayUrl);
  if (!url) {
    warnings.push("No gateway URL configured.");
    return warnings;
  }

  let parsed = null;
  try {
    parsed = new URL(url);
  } catch {
    warnings.push("Gateway URL is not a valid URL.");
    return warnings;
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local");
  const isRemote = !isLocalHost;

  if (isRemote && protocol === "ws:") {
    warnings.push(
      "Remote gateway uses ws://. Public or cross-device browser connections usually need wss:// or an HTTPS-backed Studio proxy.",
    );
  }

  if (isRemote && TUNNEL_HOST_PATTERN.test(hostname)) {
    warnings.push(
      "Gateway host looks tunnel-backed. If connect fails, compare direct local/LAN behavior before debugging the runtime itself.",
    );
  }

  const normalizedHost = trimString(host).toLowerCase();
  const publicStudioHost =
    normalizedHost &&
    normalizedHost !== "localhost" &&
    normalizedHost !== "127.0.0.1" &&
    normalizedHost !== "::1" &&
    normalizedHost !== "0.0.0.0";
  if (publicStudioHost && !trimString(studioAccessToken)) {
    warnings.push(
      "Studio appears to be configured for a public host without STUDIO_ACCESS_TOKEN. Remote admin access should not be exposed that way.",
    );
  }

  return warnings;
};

export const summarizeChecks = (checks) => {
  let hasFail = false;
  let hasWarn = false;
  for (const check of checks) {
    if (check.status === DOCTOR_STATUSES.fail) hasFail = true;
    if (check.status === DOCTOR_STATUSES.warn) hasWarn = true;
  }
  if (hasFail) return DOCTOR_STATUSES.fail;
  if (hasWarn) return DOCTOR_STATUSES.warn;
  return DOCTOR_STATUSES.pass;
};

export const shouldRunHermesChecks = ({ runtimeContext, env = process.env }) =>
  runtimeContext.adapterType === "hermes" ||
  Boolean(trimString(env.HERMES_API_URL) || trimString(env.HERMES_ADAPTER_PORT));

export const shouldRunOpenClawChecks = ({ runtimeContext, openclawConfigExists = false }) =>
  runtimeContext.adapterType === "openclaw" || openclawConfigExists;

export const formatDoctorReport = ({ summary, runtimeContext, paths, checks }) => {
  const lines = [];
  lines.push(`Claw3Doctor: ${summary}`);
  lines.push("");
  lines.push(`Runtime provider: ${runtimeContext.adapterType}`);
  lines.push(`Gateway URL: ${runtimeContext.gatewayUrl || "(not configured)"}`);
  lines.push(`Gateway token: ${runtimeContext.tokenConfigured ? "configured" : "missing"}`);
  lines.push(`State dir: ${paths.stateDir}`);
  lines.push(`Studio settings: ${paths.settingsPath}`);
  lines.push("");
  for (const check of checks) {
    lines.push(`[${check.status.toLowerCase()}] ${check.label}: ${check.message}`);
  }
  const actions = checks.flatMap((check) => check.actions ?? []);
  if (actions.length > 0) {
    lines.push("");
    lines.push("Suggested next actions:");
    actions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`);
    });
  }
  return lines.join("\n");
};
