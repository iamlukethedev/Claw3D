import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

import { WebSocket } from "ws";
import {
  DOCTOR_STATUSES,
  buildGatewayWarnings,
  formatDoctorReport,
  resolveRuntimeContext,
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
  if (error.name === "AggregateError" && Array.isArray(error.errors) && error.errors.length > 0) {
    const details = error.errors
      .map((entry) =>
        entry instanceof Error ? entry.message || entry.name : String(entry ?? "").trim(),
      )
      .filter(Boolean);
    if (details.length > 0) {
      return details.join("; ");
    }
  }
  return error.message || error.name || fallback;
};

const checkPass = (label, message, actions) => ({
  status: DOCTOR_STATUSES.pass,
  label,
  message,
  ...(actions?.length ? { actions } : {}),
});

const checkWarn = (label, message, actions) => ({
  status: DOCTOR_STATUSES.warn,
  label,
  message,
  ...(actions?.length ? { actions } : {}),
});

const checkFail = (label, message, actions) => ({
  status: DOCTOR_STATUSES.fail,
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
    socket.once("open", () => finish({ ok: true, message: "WebSocket handshake succeeded." }));
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
    return error instanceof Error ? error.message : "Unable to run openclaw --version";
  }
};

const detectHermesModelHealth = async () => {
  const apiUrl = (trim(process.env.HERMES_API_URL) || "http://localhost:8642").replace(/\/$/, "");
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

async function main() {
  loadRuntimeEnv();

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

  const checks = [];

  checks.push(
    runtimeContext.gatewayUrl
      ? checkPass(
          "Runtime profile",
          `${runtimeContext.adapterType} selected at ${runtimeContext.gatewayUrl}`,
        )
      : checkFail("Runtime profile", "No runtime profile / gateway URL is configured.", [
          "Set the gateway URL in Claw3D connect/settings before retrying.",
        ]),
  );

  checks.push(
    runtimeContext.tokenConfigured
      ? checkPass("Gateway token", "A gateway token is configured for the selected profile.")
      : checkWarn("Gateway token", "No gateway token is configured for the selected profile.", [
          "If this backend requires token auth, set the upstream token in Claw3D settings or openclaw.json.",
        ]),
  );

  for (const warning of buildGatewayWarnings({
    gatewayUrl: runtimeContext.gatewayUrl,
    studioAccessToken: trim(env.STUDIO_ACCESS_TOKEN),
    host: trim(env.HOST),
  })) {
    checks.push(checkWarn("Gateway hints", warning));
  }

  if (runtimeContext.gatewayUrl) {
    const wsProbe = await probeWebSocket(runtimeContext.gatewayUrl);
    checks.push(
      wsProbe.ok
        ? checkPass("Gateway reachability", wsProbe.message)
        : checkFail("Gateway reachability", wsProbe.message, [
            "Verify the configured gateway URL is correct and the backend is listening.",
            "If this is a public/tunneled deployment, compare direct local/LAN behavior before debugging deeper.",
          ]),
    );
  }

  const openclawConfigPath = path.join(stateDir, "openclaw.json");
  const openclawConfigExists = fs.existsSync(openclawConfigPath);
  if (shouldRunOpenClawChecks({ runtimeContext, openclawConfigExists })) {
    checks.push(
      openclawConfigExists
        ? checkPass("OpenClaw config", `Found ${openclawConfigPath}.`)
        : checkWarn("OpenClaw config", `No openclaw.json found at ${openclawConfigPath}.`, [
            "If you expect a local OpenClaw default, verify OPENCLAW_STATE_DIR or create openclaw.json.",
          ]),
    );

    const version = detectOpenClawVersion();
    const versionLooksValid = /^OpenClaw\s+/i.test(version);
    checks.push(
      versionLooksValid
        ? checkPass("OpenClaw version", version)
        : checkWarn("OpenClaw version", version, [
            "Install OpenClaw or ensure it is available on PATH if this machine should run it directly.",
          ]),
    );
  }

  if (shouldRunHermesChecks({ runtimeContext, env })) {
    const hermes = await detectHermesModelHealth();
    checks.push(
      checkPass(
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
          "Hermes API",
          models.length > 0
            ? `Hermes API reachable. Reported models: ${models.join(", ")}`
            : "Hermes API reachable.",
        ),
      );
      if (models.length > 0 && !models.includes(hermes.model)) {
        checks.push(
          checkWarn("Hermes model", `Configured model "${hermes.model}" was not returned by /v1/models.`, [
            "Set HERMES_MODEL to one of the reported model ids or update the Hermes API configuration.",
          ]),
        );
      }
    } else if (hermes.probe.status === 401) {
      checks.push(
        checkFail("Hermes API", "Hermes API returned HTTP 401.", [
          "Verify HERMES_API_KEY and confirm the adapter is loading the same .env values you expect.",
        ]),
      );
    } else {
      checks.push(
        checkFail("Hermes API", hermes.probe.text || "Hermes API probe failed.", [
          "Start the Hermes API server and verify /v1/models responds before starting the adapter.",
        ]),
      );
    }
  }

  const summary = summarizeChecks(checks);
  const report = formatDoctorReport({
    summary,
    runtimeContext,
    paths: { stateDir, settingsPath },
    checks,
  });
  console.log(report);
  process.exit(summary === DOCTOR_STATUSES.fail ? 1 : 0);
}

await main();
