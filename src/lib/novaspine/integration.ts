import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { resolveConfigPathCandidates, resolveStateDir } from "@/lib/clawdbot/paths";

export type NovaSpineIntegrationStatus = {
  stateDir: string;
  openclawConfigPath: string | null;
  openclawDetected: boolean;
  openclawVersion: string | null;
  openclawVersionValidated: boolean;
  pythonDetected: boolean;
  pythonVersion: string | null;
  pythonSupported: boolean;
  novaspineModuleDetected: boolean;
  installRoot: string;
  assetRoot: string;
  bundledVersion: string;
  packageSpec: string;
  memorySlot: string | null;
  contextEngineSlot: string | null;
  consciousnessEnabled: boolean;
  integrationEnabled: boolean;
  readiness:
    | "ready"
    | "integrated"
    | "missing-openclaw"
    | "missing-config"
    | "missing-python"
    | "unsupported-python"
    | "missing-assets";
  messages: string[];
};

export type NovaSpineInstallResult = {
  ok: boolean;
  steps: Array<{ name: string; ok: boolean; detail: string }>;
  status: NovaSpineIntegrationStatus;
};

type CommandResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number | null;
  error?: string;
};

const SUPPORTED_OPENCLAW_VERSIONS = new Set(["2026.4.5", "2026.4.7", "2026.4.9"]);
const BUNDLED_NOVASPINE_VERSION = "0.3.0";
const DEFAULT_NOVASPINE_PIP_SPEC = `novaspine==${BUNDLED_NOVASPINE_VERSION}`;
const DEFAULT_NOVASPINE_BASE_URL = "http://127.0.0.1:8420";
const DEFAULT_CONSCIOUSNESS_BASE_URL = "http://127.0.0.1:4111";
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
const BUNDLED_PLUGIN_IDS = [
  "novaspine-memory",
  "novaspine-context",
  "nova-consciousness",
] as const;
const BUNDLED_PACKAGE_DIRS = [
  "openclaw-memory-plugin",
  "openclaw-context-engine",
  "openclaw-consciousness",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const coerceString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const runCommand = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): CommandResult => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: INSTALL_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0 && !result.error,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    status: typeof result.status === "number" ? result.status : null,
    error: result.error instanceof Error ? result.error.message : undefined,
  };
};

const readVersion = (command: string, variants: string[][]): string | null => {
  for (const args of variants) {
    const result = runCommand(command, args);
    if (!result.ok) continue;
    const output = `${result.stdout}\n${result.stderr}`.trim();
    const match = output.match(/\b\d{4}\.\d+\.\d+\b/);
    if (match) return match[0];
    if (output) return output.split(/\s+/).pop() ?? null;
  }
  return null;
};

const detectPython = (): { detected: boolean; version: string | null; supported: boolean } => {
  const version = readVersion("python3", [["--version"]]);
  if (!version) {
    return { detected: false, version: null, supported: false };
  }
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  const supported =
    Number.isFinite(parts[0]) &&
    Number.isFinite(parts[1]) &&
    (parts[0] > 3 || (parts[0] === 3 && parts[1] >= 12));
  return { detected: true, version, supported };
};

const detectOpenClawVersion = (): string | null =>
  readVersion("openclaw", [["--version"], ["version"]]);

const resolveOpenClawConfigPath = (env: NodeJS.ProcessEnv = process.env): string | null => {
  const candidates = resolveConfigPathCandidates(env);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
};

const resolveNovaSpineInstallRoot = (env: NodeJS.ProcessEnv = process.env): string =>
  path.join(resolveStateDir(env), "claw3d", "novaspine", "openclaw");

const resolveBundledNovaSpineAssetRoot = (env: NodeJS.ProcessEnv = process.env): string => {
  const override = env.CLAW3D_NOVASPINE_ASSET_ROOT?.trim();
  if (override) return path.resolve(override);
  return path.join(process.cwd(), "vendor", "novaspine-openclaw", BUNDLED_NOVASPINE_VERSION);
};

const resolveNovaSpinePackageSpec = (env: NodeJS.ProcessEnv = process.env): string =>
  env.CLAW3D_NOVASPINE_PIP_SPEC?.trim() || DEFAULT_NOVASPINE_PIP_SPEC;

const detectNovaSpineModule = (): boolean => {
  const result = runCommand("python3", ["-c", "from importlib.util import find_spec; import sys; sys.exit(0 if find_spec('c3ae') else 1)"]);
  return result.ok;
};

const hasBundledNovaSpineAssets = (assetRoot: string): boolean => {
  try {
    if (!fs.existsSync(path.join(assetRoot, "patch-openclaw-config.py"))) return false;
    if (!fs.existsSync(path.join(assetRoot, "scripts"))) return false;
    return BUNDLED_PACKAGE_DIRS.every((dir) =>
      fs.existsSync(path.join(assetRoot, "packages", dir))
    );
  } catch {
    return false;
  }
};

const readOpenClawConfig = (configPath: string | null): Record<string, unknown> | null => {
  if (!configPath) return null;
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const detectPluginState = (config: Record<string, unknown> | null) => {
  const plugins = isRecord(config?.plugins) ? config.plugins : null;
  const slots = isRecord(plugins?.slots) ? plugins.slots : null;
  const entries = isRecord(plugins?.entries) ? plugins.entries : null;
  const memorySlot = coerceString(slots?.memory);
  const contextEngineSlot = coerceString(slots?.contextEngine);
  const consciousnessEntry = isRecord(entries?.["nova-consciousness"])
    ? (entries?.["nova-consciousness"] as Record<string, unknown>)
    : null;
  const consciousnessEnabled = consciousnessEntry?.enabled !== false && Boolean(consciousnessEntry);
  return {
    memorySlot,
    contextEngineSlot,
    consciousnessEnabled,
    integrationEnabled:
      memorySlot === "novaspine-memory" && contextEngineSlot === "novaspine-context",
  };
};

export const getNovaSpineIntegrationStatus = (
  env: NodeJS.ProcessEnv = process.env
): NovaSpineIntegrationStatus => {
  const stateDir = resolveStateDir(env);
  const openclawConfigPath = resolveOpenClawConfigPath(env);
  const openclawVersion = detectOpenClawVersion();
  const python = detectPython();
  const novaspineModuleDetected = detectNovaSpineModule();
  const config = readOpenClawConfig(openclawConfigPath);
  const pluginState = detectPluginState(config);
  const installRoot = resolveNovaSpineInstallRoot(env);
  const assetRoot = resolveBundledNovaSpineAssetRoot(env);
  const packageSpec = resolveNovaSpinePackageSpec(env);
  const bundledAssetsPresent = hasBundledNovaSpineAssets(assetRoot);
  const messages: string[] = [];

  let readiness: NovaSpineIntegrationStatus["readiness"] = "ready";
  if (pluginState.integrationEnabled) {
    readiness = "integrated";
  } else if (!openclawVersion) {
    readiness = "missing-openclaw";
    messages.push("OpenClaw CLI was not detected.");
  } else if (!openclawConfigPath) {
    readiness = "missing-config";
    messages.push("OpenClaw config was not found.");
  } else if (!python.detected) {
    readiness = "missing-python";
    messages.push("Python 3 was not detected.");
  } else if (!python.supported) {
    readiness = "unsupported-python";
    messages.push("NovaSpine currently requires Python 3.12+.");
  } else if (!bundledAssetsPresent) {
    readiness = "missing-assets";
    messages.push(`Bundled NovaSpine integration assets for ${BUNDLED_NOVASPINE_VERSION} were not found.`);
  }

  if (openclawVersion && !SUPPORTED_OPENCLAW_VERSIONS.has(openclawVersion)) {
    messages.push(`OpenClaw ${openclawVersion} is untested; install is still allowed.`);
  }
  if (pluginState.integrationEnabled && !novaspineModuleDetected) {
    messages.push("OpenClaw is wired for NovaSpine, but the local Python module was not detected.");
  }
  if (bundledAssetsPresent) {
    messages.push(`Claw3D is using bundled NovaSpine integration assets pinned to ${BUNDLED_NOVASPINE_VERSION}.`);
  }

  return {
    stateDir,
    openclawConfigPath,
    openclawDetected: Boolean(openclawVersion),
    openclawVersion,
    openclawVersionValidated: Boolean(openclawVersion && SUPPORTED_OPENCLAW_VERSIONS.has(openclawVersion)),
    pythonDetected: python.detected,
    pythonVersion: python.version,
    pythonSupported: python.supported,
    novaspineModuleDetected,
    installRoot,
    assetRoot,
    bundledVersion: BUNDLED_NOVASPINE_VERSION,
    packageSpec,
    memorySlot: pluginState.memorySlot,
    contextEngineSlot: pluginState.contextEngineSlot,
    consciousnessEnabled: pluginState.consciousnessEnabled,
    integrationEnabled: pluginState.integrationEnabled,
    readiness,
    messages,
  };
};

const ensureDir = (dir: string) => {
  fs.mkdirSync(dir, { recursive: true });
};

const copyDirectory = (source: string, destination: string) => {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
};

const writeBundledExampleConfig = (installRoot: string, baseUrl: string, consciousnessBaseUrl: string) => {
  const payload = {
    plugins: {
      allow: [...BUNDLED_PLUGIN_IDS],
      load: {
        paths: BUNDLED_PACKAGE_DIRS.map((dir) =>
          path.join(installRoot, "packages", dir)
        ),
      },
      slots: {
        memory: "novaspine-memory",
        contextEngine: "novaspine-context",
      },
      entries: {
        "novaspine-memory": {
          enabled: true,
          config: { baseUrl },
        },
        "novaspine-context": {
          enabled: true,
          config: { baseUrl },
        },
        "nova-consciousness": {
          enabled: true,
          config: { baseUrl: consciousnessBaseUrl },
        },
      },
    },
  };
  fs.writeFileSync(
    path.join(installRoot, "openclaw.plugins.example.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8"
  );
};

const stepResult = (name: string, result: CommandResult): { name: string; ok: boolean; detail: string } => ({
  name,
  ok: result.ok,
  detail: [result.stdout.trim(), result.stderr.trim(), result.error?.trim()]
    .filter(Boolean)
    .join(" | ") || (result.ok ? "ok" : "command failed"),
});

const installNovaSpinePythonPackage = (env: NodeJS.ProcessEnv, packageSpec: string) =>
  runCommand("python3", ["-m", "pip", "install", "--user", "--upgrade", packageSpec], { env });

const installBundledOpenClawAssets = (params: {
  assetRoot: string;
  installRoot: string;
}): CommandResult => {
  try {
    ensureDir(path.join(params.installRoot, "packages"));
    ensureDir(path.join(params.installRoot, "scripts"));
    for (const dir of BUNDLED_PACKAGE_DIRS) {
      copyDirectory(
        path.join(params.assetRoot, "packages", dir),
        path.join(params.installRoot, "packages", dir)
      );
    }
    copyDirectory(
      path.join(params.assetRoot, "scripts"),
      path.join(params.installRoot, "scripts")
    );
    writeBundledExampleConfig(
      params.installRoot,
      DEFAULT_NOVASPINE_BASE_URL,
      DEFAULT_CONSCIOUSNESS_BASE_URL
    );
    return {
      ok: true,
      stdout: `Bundled NovaSpine OpenClaw assets ${BUNDLED_NOVASPINE_VERSION} installed to ${params.installRoot}`,
      stderr: "",
      status: 0,
    };
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      status: 1,
      error: error instanceof Error ? error.message : "Failed to install bundled NovaSpine assets.",
    };
  }
};

const patchOpenClawConfig = (params: {
  env: NodeJS.ProcessEnv;
  assetRoot: string;
  configPath: string;
  installRoot: string;
}) =>
  runCommand(
    "python3",
    [
      path.join(params.assetRoot, "patch-openclaw-config.py"),
      "--config",
      params.configPath,
      "--install-root",
      params.installRoot,
      "--base-url",
      params.env.CLAW3D_NOVASPINE_BASE_URL?.trim() || DEFAULT_NOVASPINE_BASE_URL,
      "--consciousness-base-url",
      params.env.CLAW3D_NOVASPINE_CONSCIOUSNESS_BASE_URL?.trim() || DEFAULT_CONSCIOUSNESS_BASE_URL,
      "--force-slots",
    ],
    { env: params.env }
  );

const validateOpenClawConfig = (env: NodeJS.ProcessEnv) =>
  runCommand("openclaw", ["config", "validate"], { env });

const runNovaSpineDoctor = (env: NodeJS.ProcessEnv) =>
  runCommand("python3", ["-m", "c3ae.cli", "doctor", "--skip-api-check"], { env });

export const installNovaSpineIntoOpenClaw = (
  env: NodeJS.ProcessEnv = process.env
): NovaSpineInstallResult => {
  const initial = getNovaSpineIntegrationStatus(env);
  if (initial.readiness === "integrated") {
    return {
      ok: true,
      steps: [{ name: "status", ok: true, detail: "NovaSpine is already integrated." }],
      status: initial,
    };
  }
  if (!initial.openclawDetected || !initial.openclawConfigPath) {
    return {
      ok: false,
      steps: [{ name: "preflight", ok: false, detail: "OpenClaw CLI/config not detected." }],
      status: initial,
    };
  }
  if (!initial.pythonDetected || !initial.pythonSupported) {
    return {
      ok: false,
      steps: [{ name: "preflight", ok: false, detail: "Python 3.12+ is required for NovaSpine." }],
      status: initial,
    };
  }
  if (initial.readiness === "missing-assets") {
    return {
      ok: false,
      steps: [{ name: "preflight", ok: false, detail: `Bundled NovaSpine assets ${initial.bundledVersion} are missing from Claw3D.` }],
      status: initial,
    };
  }

  const steps: NovaSpineInstallResult["steps"] = [];
  const pipInstall = installNovaSpinePythonPackage(env, initial.packageSpec);
  steps.push(stepResult("python-package", pipInstall));
  if (!pipInstall.ok) {
    return { ok: false, steps, status: getNovaSpineIntegrationStatus(env) };
  }

  const bundleAssets = installBundledOpenClawAssets({
    assetRoot: initial.assetRoot,
    installRoot: initial.installRoot,
  });
  steps.push(stepResult("bundle-assets", bundleAssets));
  if (!bundleAssets.ok) {
    return { ok: false, steps, status: getNovaSpineIntegrationStatus(env) };
  }

  const patchConfig = patchOpenClawConfig({
    env,
    assetRoot: initial.assetRoot,
    configPath: initial.openclawConfigPath,
    installRoot: initial.installRoot,
  });
  steps.push(stepResult("openclaw-config-patch", patchConfig));
  if (!patchConfig.ok) {
    return { ok: false, steps, status: getNovaSpineIntegrationStatus(env) };
  }

  const validateConfig = validateOpenClawConfig(env);
  steps.push(stepResult("openclaw-validate", validateConfig));

  const doctor = runNovaSpineDoctor(env);
  steps.push(stepResult("novaspine-doctor", doctor));

  const status = getNovaSpineIntegrationStatus(env);
  return {
    ok: status.integrationEnabled,
    steps,
    status,
  };
};
