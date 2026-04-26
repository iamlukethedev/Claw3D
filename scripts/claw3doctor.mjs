import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { WebSocket } from "ws";
import {
  buildCustomRuntimeWarnings,
  buildDoctorJsonReport,
  buildGatewayFailureActions,
  buildGatewayWarnings,
  buildOpenClawWarnings,
  buildProfileWarnings,
  classifyGatewayFailure,
  DOCTOR_STATUSES,
  formatDoctorReport,
  parseDoctorArgs,
  resolveRuntimeContext,
  isCustomRuntimeAdapter,
  shouldRunCustomChecks,
  shouldRunDemoChecks,
  shouldRunHermesChecks,
  shouldRunOpenClawChecks,
  summarizeChecks,
} from "./lib/claw3doctor-core.mjs";

const require = createRequire(import.meta.url);
const {
  loadUpstreamGatewaySettings,
  resolveStateDir,
  resolveStudioSettingsPath,
} = require("../server/studio-settings.js");

function loadDotenvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadRuntimeEnv() {
  const cwd = process.cwd();
  loadDotenvFile(path.join(cwd, ".env.local"));
  loadDotenvFile(path.join(cwd, ".env"));
}

const readJsonFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
};

const formatErrorMessage = (error, fallback) => {
  if (!(error instanceof Error)) return fallback;
  if (
    error.name === "AggregateError" &&
    Array.isArray(error.errors) &&
    error.errors.length > 0
  ) {
    const details = error.errors
      .map((entry) =>
        entry instanceof Error
          ? entry.message || entry.name
          : String(entry ?? "").trim(),
      )
      .filter(Boolean);
    if (details.length > 0) {
      return details.join("; ");
    }
  }
  return error.message || error.name || fallback;
};

const checkPass = (category, label, message, actions) => ({
  status: DOCTOR_STATUSES.pass,
  category,
  label,
  message,
  ...(actions?.length ? { actions } : {}),
});

const checkWarn = (category, label, message, actions) => ({
  status: DOCTOR_STATUSES.warn,
  category,
  label,
  message,
  ...(actions?.length ? { actions } : {}),
});

const checkFail = (category, label, message, actions) => ({
  status: DOCTOR_STATUSES.fail,
  category,
  label,
  message,
  ...(actions?.length ? { actions } : {}),
});

const trim = (value) => (typeof value === "string" ? value.trim() : "");

const probeWebSocket = async (url, timeoutMs = 3500) =>
  await new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      resolve(result);
    };
    const socket = new WebSocket(url, { handshakeTimeout: timeoutMs });
    const timer = setTimeout(
      () => finish({ ok: false, message: `Timed out after ${timeoutMs}ms.` }),
      timeoutMs + 250,
    );
    socket.once("open", () =>
      finish({ ok: true, message: "WebSocket handshake succeeded." }),
    );
    socket.once("error", (error) =>
      finish({
        ok: false,
        message: formatErrorMessage(error, "WebSocket handshake failed."),
      }),
    );
    socket.once("unexpected-response", (_req, res) =>
      finish({
        ok: false,
        message: `Unexpected HTTP ${res.statusCode ?? "response"} during WebSocket upgrade.`,
      }),
    );
  });

const probeHttpJson = async ({ url, headers = {}, timeoutMs = 3500 }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}
    return { ok: response.ok, status: response.status, text, json };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      text: error instanceof Error ? error.message : "HTTP probe failed.",
      json: null,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const detectOpenClawVersion = () => {
  try {
    return execFileSync("openclaw", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 4000,
    }).trim();
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Unable to run openclaw --version";
  }
};

const detectWorkspaceState = () => {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    }).trim();
    const dirty =
      execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      }).trim().length > 0;
    return { branch, dirty, available: true };
  } catch {
    return { branch: "", dirty: false, available: false };
  }
};

const detectHermesModelHealth = async () => {
  const apiUrl = (
    trim(process.env.HERMES_API_URL) || "http://localhost:8642"
  ).replace(/\/$/, "");
  const apiKey = trim(process.env.HERMES_API_KEY);
  const model = trim(process.env.HERMES_MODEL) || "hermes";
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const result = await probeHttpJson({ url: `${apiUrl}/v1/models`, headers });
  return {
    apiUrl,
    model,
    apiKeyConfigured: Boolean(apiKey),
    probe: result,
  };
};

const probeCustomRuntimeHealth = async (runtimeUrl) => {
  const baseUrl = runtimeUrl.replace(/\/$/, "");
  const health = await probeHttpJson({ url: `${baseUrl}/health` });
  if (health.ok) {
    return {
      ok: true,
      message: "Custom runtime /health responded successfully.",
    };
  }

  const registry = await probeHttpJson({ url: `${baseUrl}/registry` });
  if (registry.ok) {
    return {
      ok: true,
      message: "Custom runtime /registry responded successfully.",
    };
  }

  return {
    ok: false,
    message:
      health.text ||
      registry.text ||
      "Custom runtime did not respond on /health or /registry.",
  };
};

const probeProfileHealth = async ({ adapterType, url }) => {
  if (isCustomRuntimeAdapter(adapterType)) {
    const result = await probeCustomRuntimeHealth(url);
    return {
      ok: result.ok,
      message: result.message,
    };
  }

  const result = await probeWebSocket(url);
  return {
    ok: result.ok,
    message: result.message,
  };
};

async function main() {
  loadRuntimeEnv();
  const args = parseDoctorArgs(process.argv.slice(2));

  const env = process.env;
  const stateDir = resolveStateDir(env);
  const settingsPath = resolveStudioSettingsPath(env);
  const upstreamGateway = loadUpstreamGatewaySettings(env);
  const studioSettings = readJsonFile(settingsPath);
  const runtimeContext = resolveRuntimeContext({
    settings: studioSettings,
    upstreamGateway,
    env,
  });
  const workspace = detectWorkspaceState();

  /**
   * Returns whether provider-specific checks for `adapterType` should run.
   * When --profile <adapter> is set, only that adapter is in scope.
   * When --all-profiles is set, all adapters are in scope.
   * Otherwise falls back to `defaultBehavior` (the existing shouldRun* predicate).
   */
  const adapterInScope = (adapterType, defaultBehavior) => {
    if (args.allProfiles) return true;
    if (args.profile) return args.profile === adapterType;
    return defaultBehavior;
  };

  const checks = [];

  checks.push(
    workspace.available
      ? workspace.dirty
        ? checkWarn(
            "Workspace",
            "Git branch",
            `${workspace.branch} (working tree has local modifications)`,
          )
        : checkPass(
            "Workspace",
            "Git branch",
            `${workspace.branch} (clean working tree)`,
          )
      : checkWarn(
          "Workspace",
          "Git branch",
          "Git branch could not be detected from this working directory.",
        ),
  );

  checks.push(
    runtimeContext.gatewayUrl
      ? checkPass(
          "Runtime profiles",
          "Runtime profile",
          `${runtimeContext.adapterType} selected at ${runtimeContext.gatewayUrl}`,
        )
      : checkFail(
          "Runtime profiles",
          "Runtime profile",
          "No runtime profile / gateway URL is configured.",
          ["Set the gateway URL in Claw3D connect/settings before retrying."],
        ),
  );

  checks.push(
    runtimeContext.tokenConfigured
      ? checkPass(
          "Runtime profiles",
          "Gateway token",
          "A gateway token is configured for the selected profile.",
        )
      : checkWarn(
          "Runtime profiles",
          "Gateway token",
          "No gateway token is configured for the selected profile.",
          [
            "If this backend requires token auth, set the upstream token in Claw3D settings or openclaw.json.",
          ],
        ),
  );

  for (const warning of buildProfileWarnings({ runtimeContext })) {
    checks.push(
      checkWarn("Runtime profiles", "Profile collision", warning, [
        "Assign distinct local ports or URLs if you want OpenClaw, Hermes, and demo running simultaneously instead of swapping one backend onto the same endpoint.",
      ]),
    );
  }

  if (args.profile) {
    const requestedProfile = runtimeContext.profiles?.[args.profile];
    checks.push(
      requestedProfile
        ? checkPass(
            "Runtime profiles",
            "Profile selection",
            `Scoped diagnostics to the ${args.profile} profile.`,
          )
        : checkFail(
            "Runtime profiles",
            "Profile selection",
            `Requested profile "${args.profile}" is not configured in current Studio settings.`,
            [
              "Run `node scripts/claw3doctor.mjs --all-profiles` to see the configured profile list.",
            ],
          ),
    );
  } else if (args.allProfiles) {
    checks.push(
      checkPass(
        "Runtime profiles",
        "Profile selection",
        "Running diagnostics across all configured runtime profiles.",
      ),
    );
  } else {
    checks.push(
      checkPass(
        "Runtime profiles",
        "Profile selection",
        `Running diagnostics for the selected ${runtimeContext.adapterType} profile only.`,
      ),
    );
  }

  for (const warning of buildGatewayWarnings({
    gatewayUrl: runtimeContext.gatewayUrl,
    studioAccessToken: trim(env.STUDIO_ACCESS_TOKEN),
    host: trim(env.HOST),
  })) {
    checks.push(checkWarn("Gateway access", "Gateway hints", warning));
  }

  if (adapterInScope("openclaw", runtimeContext.adapterType === "openclaw")) {
    for (const warning of buildOpenClawWarnings({
      gatewayUrl: runtimeContext.gatewayUrl,
      tokenConfigured: runtimeContext.tokenConfigured,
    })) {
      checks.push(
        checkWarn("OpenClaw", "OpenClaw hints", warning, [
          "If the browser/device is not yet approved, check `openclaw devices list` and approve the pending device before retrying the remote connection.",
        ]),
      );
    }
  }

  const customRuntimeInScope = args.allProfiles
    ? true
    : args.profile
      ? isCustomRuntimeAdapter(args.profile)
      : shouldRunCustomChecks({ runtimeContext });
  if (customRuntimeInScope) {
    for (const warning of buildCustomRuntimeWarnings({
      gatewayUrl: runtimeContext.gatewayUrl,
      allowlist:
        trim(env.CUSTOM_RUNTIME_ALLOWLIST) || trim(env.UPSTREAM_ALLOWLIST),
      nodeEnv: trim(env.NODE_ENV),
    })) {
      checks.push(checkWarn("Custom runtime", "Custom runtime hints", warning));
    }
  }

  const profileEntries = Object.entries(runtimeContext.profiles ?? {}).filter(
    ([adapterType]) => {
      if (args.allProfiles) return true;
      if (args.profile) return adapterType === args.profile;
      return adapterType === runtimeContext.adapterType;
    },
  );
  for (const [adapterTypeRaw, profile] of profileEntries) {
    const adapterType = adapterTypeRaw;
    const url = trim(profile?.url);
    if (!url) continue;
    const isSelected = adapterType === runtimeContext.adapterType;
    const label = `${adapterType} profile${isSelected ? " (selected)" : ""}`;
    const health = await probeProfileHealth({ adapterType, url });
    checks.push(
      health.ok
        ? checkPass("Profile health", label, `${url} -> ${health.message}`)
        : checkFail(
            "Profile health",
            label,
            `${url} -> ${health.message}`,
            buildGatewayFailureActions({
              adapterType,
              message: health.message,
              gatewayUrl: url,
            }).concat(
              isCustomRuntimeAdapter(adapterType)
                ? [
                    "If this runtime sits behind the Studio custom proxy, verify CUSTOM_RUNTIME_ALLOWLIST / UPSTREAM_ALLOWLIST for the target host.",
                  ]
                : [
                    "Verify the configured gateway URL is correct and the backend is listening.",
                  ],
            ),
          ),
    );
    const classification = classifyGatewayFailure({ message: health.message });
    if (classification) {
      checks.push(
        checkWarn(
          "Failure analysis",
          `${label} failure class`,
          `${classification.code} ${classification.label}: ${classification.message}`,
        ),
      );
    }
  }

  const openclawConfigPath = path.join(stateDir, "openclaw.json");
  const openclawConfigExists = fs.existsSync(openclawConfigPath);
  if (shouldRunOpenClawChecks({ runtimeContext, openclawConfigExists })) {
    checks.push(
      openclawConfigExists
        ? checkPass(
            "OpenClaw",
            "OpenClaw config",
            `Found ${openclawConfigPath}.`,
          )
        : checkWarn(
            "OpenClaw",
            "OpenClaw config",
            `No openclaw.json found at ${openclawConfigPath}.`,
            [
              "If you expect a local OpenClaw default, verify OPENCLAW_STATE_DIR or create openclaw.json.",
            ],
          ),
    );

    const version = detectOpenClawVersion();
    const versionLooksValid = /^OpenClaw\s+/i.test(version);
    checks.push(
      versionLooksValid
        ? checkPass("OpenClaw", "OpenClaw version", version)
        : checkWarn("OpenClaw", "OpenClaw version", version, [
            "Install OpenClaw or ensure it is available on PATH if this machine should run it directly.",
          ]),
    );
  }

  if (adapterInScope("demo", shouldRunDemoChecks({ runtimeContext, env }))) {
    const configuredPort = trim(env.DEMO_ADAPTER_PORT) || "18789";
    checks.push(
      checkPass(
        "Demo gateway",
        "Demo gateway config",
        `Demo mode expects the mock gateway on ws://localhost:${configuredPort}.`,
        [
          "Run `npm run demo-gateway` if you want a no-runtime office smoke test.",
        ],
      ),
    );
  }

  if (
    adapterInScope("hermes", shouldRunHermesChecks({ runtimeContext, env }))
  ) {
    const hermes = await detectHermesModelHealth();
    checks.push(
      checkPass(
        "Hermes",
        "Hermes adapter config",
        `Hermes API target ${hermes.apiUrl} | model ${hermes.model} | key ${
          hermes.apiKeyConfigured ? "configured" : "missing"
        }`,
      ),
    );

    if (hermes.probe.ok) {
      const models = Array.isArray(hermes.probe.json?.data)
        ? hermes.probe.json.data.map((entry) => trim(entry?.id)).filter(Boolean)
        : [];
      checks.push(
        checkPass(
          "Hermes",
          "Hermes API",
          models.length > 0
            ? `Hermes API reachable. Reported models: ${models.join(", ")}`
            : "Hermes API reachable.",
        ),
      );
      if (models.length > 0 && !models.includes(hermes.model)) {
        checks.push(
          checkWarn(
            "Hermes",
            "Hermes model",
            `Configured model "${hermes.model}" was not returned by /v1/models.`,
            [
              "Set HERMES_MODEL to one of the reported model ids or update the Hermes API configuration.",
            ],
          ),
        );
      }
    } else if (hermes.probe.status === 401) {
      checks.push(
        checkFail("Hermes", "Hermes API", "Hermes API returned HTTP 401.", [
          "Verify HERMES_API_KEY and confirm the adapter is loading the same .env values you expect.",
        ]),
      );
    } else {
      checks.push(
        checkFail(
          "Hermes",
          "Hermes API",
          hermes.probe.text || "Hermes API probe failed.",
          [
            "Start the Hermes API server and verify /v1/models responds before starting the adapter.",
          ],
        ),
      );
    }
  }

  const summary = summarizeChecks(checks);
  const reportInput = {
    summary,
    runtimeContext,
    paths: { stateDir, settingsPath },
    checks,
  };
  if (args.json) {
    console.log(JSON.stringify(buildDoctorJsonReport(reportInput), null, 2));
  } else {
    console.log(formatDoctorReport(reportInput));
  }
  process.exit(summary === DOCTOR_STATUSES.fail ? 1 : 0);
}

await main();
