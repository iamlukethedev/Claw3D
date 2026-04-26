export const DOCTOR_STATUSES = {
  pass: "PASS",
  warn: "WARN",
  fail: "FAIL",
};

const VALID_ADAPTER_TYPES = new Set([
  "openclaw",
  "hermes",
  "demo",
  "local",
  "claw3d",
  "custom",
]);
const TUNNEL_HOST_PATTERN =
  /(cloudflare|trycloudflare|ngrok|tailscale|tunnel)/i;
const DEFAULT_GATEWAY_URL_BY_ADAPTER = {
  openclaw: "ws://localhost:18789",
  hermes: "ws://localhost:18789",
  demo: "ws://localhost:18789",
  local: "http://localhost:7770",
  claw3d: "http://localhost:3000/api/runtime/custom",
  custom: "http://localhost:7770",
};

const isRecord = (value) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const trimString = (value) => (typeof value === "string" ? value.trim() : "");
const hasHostnameSuffix = (hostname, suffix) =>
  hostname === suffix || hostname.endsWith(`.${suffix}`);
const isTunnelBackedHostname = (hostname) =>
  Boolean(
    hostname &&
      (TUNNEL_HOST_PATTERN.test(hostname) || hasHostnameSuffix(hostname, "ts.net")),
  );
const supportsAnsi = () =>
  Boolean(process.stdout?.isTTY && process.env.NO_COLOR !== "1");
const colorize = (text, code) =>
  supportsAnsi() ? `\u001b[${code}m${text}\u001b[0m` : text;
const formatStatusBadge = (status) => {
  switch (status) {
    case DOCTOR_STATUSES.pass:
      return colorize("[PASS]", "32");
    case DOCTOR_STATUSES.warn:
      return colorize("[WARN]", "33");
    case DOCTOR_STATUSES.fail:
      return colorize("[FAIL]", "31");
    default:
      return `[${status}]`;
  }
};

export const normalizeAdapterType = (value, fallback = "openclaw") => {
  const normalized = trimString(value).toLowerCase();
  return VALID_ADAPTER_TYPES.has(normalized) ? normalized : fallback;
};

export const isCustomRuntimeAdapter = (adapterType) => {
  const normalized = normalizeAdapterType(adapterType, "");
  return (
    normalized === "custom" ||
    normalized === "local" ||
    normalized === "claw3d"
  );
};

export const resolveRuntimeContext = ({
  settings,
  upstreamGateway,
  env = process.env,
}) => {
  const gateway = isRecord(settings?.gateway) ? settings.gateway : null;
  const adapterType = normalizeAdapterType(
    gateway?.adapterType ??
      upstreamGateway?.adapterType ??
      env.CLAW3D_GATEWAY_ADAPTER_TYPE,
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

  const upstreamUrl = trimString(upstreamGateway?.url);
  const selectedProfile = profiles[adapterType]
    ? profiles[adapterType]
    : upstreamUrl
      ? {
          url: upstreamUrl,
          token: trimString(upstreamGateway?.token),
        }
      : {
          url: DEFAULT_GATEWAY_URL_BY_ADAPTER[adapterType],
          token: "",
        };
  if (selectedProfile?.url && !profiles[adapterType]) {
    profiles[adapterType] = {
      url: selectedProfile.url,
      token: selectedProfile.token ?? "",
    };
  }

  return {
    adapterType,
    gatewayUrl: selectedProfile?.url ?? "",
    token: selectedProfile?.token ?? "",
    tokenConfigured: Boolean(selectedProfile?.token),
    profiles,
  };
};

export const buildGatewayWarnings = ({
  gatewayUrl,
  studioAccessToken = "",
  host = "",
}) => {
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

  if (isRemote && isTunnelBackedHostname(hostname)) {
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

export const buildProfileWarnings = ({ runtimeContext }) => {
  const warnings = [];
  const urlToAdapters = new Map();
  for (const [adapterType, profile] of Object.entries(
    runtimeContext?.profiles ?? {},
  )) {
    const url = trimString(profile?.url);
    if (!url) continue;
    const key = url.toLowerCase();
    const adapters = urlToAdapters.get(key) ?? [];
    adapters.push(adapterType);
    urlToAdapters.set(key, adapters);
  }

  for (const [url, adapters] of urlToAdapters.entries()) {
    if (adapters.length < 2) continue;
    warnings.push(
      `Multiple runtime profiles share the same endpoint (${url}): ${adapters.join(", ")}. That is fine for one-runtime-at-a-time local use, but simultaneous runtimes need distinct URLs or ports.`,
    );
  }

  return warnings;
};

export const buildOpenClawWarnings = ({
  gatewayUrl,
  tokenConfigured = false,
}) => {
  const warnings = [];
  const url = trimString(gatewayUrl);
  if (!url) return warnings;

  let parsed = null;
  try {
    parsed = new URL(url);
  } catch {
    return warnings;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local");
  if (isLocalHost) {
    return warnings;
  }

  if (!tokenConfigured) {
    warnings.push(
      "Remote OpenClaw profile has no gateway token configured. Remote/browser clients often fail with pairing or approval-style errors until the device or token path is approved.",
    );
  }

  if (isTunnelBackedHostname(hostname)) {
    warnings.push(
      "Remote OpenClaw host looks tunnel-backed. If you hit 1008/1011/1012-style failures, verify direct local or LAN access first, then check pairing/device approval and reverse-proxy websocket handling.",
    );
  }

  return warnings;
};

export const buildCustomRuntimeWarnings = ({
  gatewayUrl,
  allowlist = "",
  nodeEnv = "",
}) => {
  const warnings = [];
  const url = trimString(gatewayUrl);
  if (!url) return warnings;

  let parsed = null;
  try {
    parsed = new URL(url);
  } catch {
    warnings.push("Custom runtime URL is not a valid URL.");
    return warnings;
  }

  if (parsed.protocol === "ws:" || parsed.protocol === "wss:") {
    warnings.push(
      "Custom runtime profile uses a websocket URL. The custom provider boundary is expected to expose an HTTP API (for example /health and /v1/chat/completions).",
    );
  }

  const isProduction = trimString(nodeEnv).toLowerCase() === "production";
  const hostname = parsed.hostname.toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local");
  if (isProduction && !isLocalHost && !trimString(allowlist)) {
    warnings.push(
      "Production custom runtime is configured without CUSTOM_RUNTIME_ALLOWLIST or UPSTREAM_ALLOWLIST. The runtime proxy should not rely on open-host defaults there.",
    );
  }

  return warnings;
};

export const buildGatewayFailureActions = ({
  adapterType,
  message = "",
  gatewayUrl = "",
}) => {
  const actions = [];
  const normalized = trimString(message).toLowerCase();
  const url = trimString(gatewayUrl);
  let parsedUrl = null;
  try {
    parsedUrl = url ? new URL(url) : null;
  } catch {}
  const hostname = parsedUrl?.hostname?.toLowerCase() ?? "";
  const isTunnelBacked = isTunnelBackedHostname(hostname);
  const isCloudflare = hostname.includes("cloudflare");
  const isTailscale =
    hostname.includes("tailscale") || hasHostnameSuffix(hostname, "ts.net");

  if (normalized.includes("econnrefused") || normalized.includes("timed out")) {
    actions.push(
      "Verify the backend is actually listening on the configured host and port before retrying from Claw3D.",
    );
  }

  if (normalized.includes("1011")) {
    actions.push(
      "If this is OpenClaw behind a reverse proxy or tunnel, verify websocket upgrade handling and compare direct local/LAN behavior before assuming the runtime itself is broken.",
    );
  }

  if (normalized.includes("1012")) {
    actions.push(
      "A 1012-style close usually means the upstream is restarting or unavailable temporarily. Retry after checking the backend service logs.",
    );
  }

  if (
    normalized.includes("1008") ||
    normalized.includes("pairing required") ||
    normalized.includes("approve")
  ) {
    actions.push(
      "For OpenClaw, check pending device/browser approval with `openclaw devices list` and approve the request before retrying the remote browser session.",
    );
  }

  if (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("unexpected http 401")
  ) {
    actions.push(
      "Recheck the configured token/auth path. The gateway or proxy is rejecting the connection before the office can load.",
    );
  }

  if (isCloudflare) {
    actions.push(
      "For Cloudflare or similar HTTPS tunnels, verify websocket upgrade forwarding and prefer an HTTPS-backed Studio path rather than a bare ws:// remote endpoint.",
    );
  }

  if (isTailscale) {
    actions.push(
      "For Tailnet-hosted OpenClaw, test the same gateway directly on local/LAN first, then compare against the Tailnet URL so pairing/proxy issues do not get conflated.",
    );
  }

  if (isTunnelBacked) {
    actions.push(
      "Because this endpoint looks tunnel-backed, reproduce once via direct local or LAN access to separate runtime problems from tunnel/proxy problems.",
    );
  }

  if (isCustomRuntimeAdapter(adapterType)) {
    actions.push(
      "Custom runtimes should answer over HTTP on /health or /registry, not just a raw websocket endpoint.",
    );
  }

  return [...new Set(actions)];
};

export const classifyGatewayFailure = ({ message = "" }) => {
  const normalized = trimString(message).toLowerCase();
  if (!normalized) return null;

  if (normalized.includes("1008") || normalized.includes("pairing required")) {
    return {
      code: "1008",
      label: "Policy or pairing gate",
      message:
        "The upstream is rejecting this session for policy/pairing reasons. Check device approval, browser identity, and token flow.",
    };
  }

  if (normalized.includes("1011")) {
    return {
      code: "1011",
      label: "Upstream runtime or proxy failure",
      message:
        "The websocket upgraded but the upstream failed mid-connect or during runtime handling. Check runtime logs and reverse-proxy websocket support.",
    };
  }

  if (normalized.includes("1012")) {
    return {
      code: "1012",
      label: "Service restart or temporary unavailability",
      message:
        "The upstream likely restarted or was briefly unavailable. Recheck service health and retry once the backend settles.",
    };
  }

  if (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("unexpected http 401") ||
    normalized.includes("unexpected http 403")
  ) {
    return {
      code: normalized.includes("403") ? "403" : "401",
      label: "Auth rejection",
      message:
        "The upstream or proxy rejected auth before the office connected. Recheck the selected profile token, studio access path, and adapter env alignment.",
    };
  }

  if (normalized.includes("econnrefused")) {
    return {
      code: "ECONNREFUSED",
      label: "Listener missing",
      message:
        "Nothing is listening on the configured host/port. Start the backend or fix the profile URL before retrying.",
    };
  }

  if (normalized.includes("timed out")) {
    return {
      code: "TIMEOUT",
      label: "Connection timeout",
      message:
        "The endpoint did not complete the handshake in time. Check proxy path, host reachability, and whether the backend is overloaded or hanging.",
    };
  }

  return null;
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
  Boolean(
    trimString(env.HERMES_API_URL) || trimString(env.HERMES_ADAPTER_PORT),
  );

export const shouldRunOpenClawChecks = ({
  runtimeContext,
  openclawConfigExists = false,
}) => runtimeContext.adapterType === "openclaw" || openclawConfigExists;

export const shouldRunDemoChecks = ({ runtimeContext, env = process.env }) =>
  runtimeContext.adapterType === "demo" ||
  Boolean(trimString(env.DEMO_ADAPTER_PORT));

export const shouldRunCustomChecks = ({ runtimeContext }) =>
  isCustomRuntimeAdapter(runtimeContext.adapterType);

export const formatDoctorReport = ({
  summary,
  runtimeContext,
  paths,
  checks,
}) => {
  const summaryCounts = {
    pass: checks.filter((check) => check.status === DOCTOR_STATUSES.pass)
      .length,
    warn: checks.filter((check) => check.status === DOCTOR_STATUSES.warn)
      .length,
    fail: checks.filter((check) => check.status === DOCTOR_STATUSES.fail)
      .length,
  };
  const groupedChecks = new Map();
  for (const check of checks) {
    const category = check.category || "General";
    const entries = groupedChecks.get(category) ?? [];
    entries.push(check);
    groupedChecks.set(category, entries);
  }
  const lines = [];
  lines.push("==================================================");
  lines.push(`Claw3Doctor ${formatStatusBadge(summary)}`);
  lines.push("==================================================");
  lines.push("");
  lines.push(`Runtime provider: ${runtimeContext.adapterType}`);
  lines.push(
    `Selected profile: ${runtimeContext.gatewayUrl || "(not configured)"}`,
  );
  lines.push(
    `Gateway token: ${runtimeContext.tokenConfigured ? "configured" : "missing"}`,
  );
  lines.push(`State dir: ${paths.stateDir}`);
  lines.push(`Studio settings: ${paths.settingsPath}`);
  const configuredProfiles = Object.entries(runtimeContext.profiles ?? {});
  if (configuredProfiles.length > 0) {
    lines.push("Configured profiles:");
    for (const [adapterType, profile] of configuredProfiles) {
      lines.push(`  - ${adapterType}: ${profile.url}`);
    }
  }
  lines.push(
    `Check counts: ${summaryCounts.pass} pass, ${summaryCounts.warn} warn, ${summaryCounts.fail} fail`,
  );
  lines.push("");
  for (const [category, categoryChecks] of groupedChecks.entries()) {
    lines.push(`${category}`);
    lines.push("-".repeat(category.length));
    for (const check of categoryChecks) {
      lines.push(
        `  ${formatStatusBadge(check.status)} ${check.label}: ${check.message}`,
      );
    }
    lines.push("");
  }
  const actions = checks.flatMap((check) => check.actions ?? []);
  if (actions.length > 0) {
    lines.push("Suggested next actions:");
    actions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`);
    });
  }
  return lines.join("\n");
};

export const buildDoctorJsonReport = ({
  summary,
  runtimeContext,
  paths,
  checks,
}) => ({
  doctor: "claw3doctor",
  summary,
  runtimeContext,
  paths,
  checks,
  counts: {
    pass: checks.filter((check) => check.status === DOCTOR_STATUSES.pass)
      .length,
    warn: checks.filter((check) => check.status === DOCTOR_STATUSES.warn)
      .length,
    fail: checks.filter((check) => check.status === DOCTOR_STATUSES.fail)
      .length,
  },
});

/**
 * Parse CLI argv into structured doctor args.
 * Exported so the flag behaviour can be unit tested without spawning a process.
 */
export const parseDoctorArgs = (argv) => {
  const args = {
    json: false,
    allProfiles: false,
    profile: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (entry === "--json") {
      args.json = true;
      continue;
    }
    if (entry === "--all-profiles") {
      args.allProfiles = true;
      continue;
    }
    if (entry === "--profile") {
      const next = trimString(argv[index + 1] ?? "").toLowerCase();
      if (next) {
        args.profile = next;
        index += 1;
      }
    }
  }
  return args;
};
