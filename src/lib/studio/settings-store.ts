import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";
import {
  defaultStudioSettings,
  mergeStudioSettings,
  normalizeStudioSettings,
  type StudioGatewayAdapterType,
  type StudioGatewayProfile,
  type StudioGatewaySettings,
  type StudioSettings,
  type StudioSettingsPatch,
} from "@/lib/studio/settings";

// Studio settings are intentionally stored as a local JSON file for a single-user workflow.
// That includes gateway connection details, so treat the state directory as plaintext secret
// storage and document any changes to this threat model in README.md and SECURITY.md.
const SETTINGS_DIRNAME = "claw3d";
const SETTINGS_FILENAME = "settings.json";
const OPENCLAW_CONFIG_FILENAME = "openclaw.json";
const DEFAULT_LOCAL_GATEWAY_PORT = 18789;

export const resolveStudioSettingsPath = () =>
  path.join(resolveStateDir(), SETTINGS_DIRNAME, SETTINGS_FILENAME);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const buildGatewaySettings = (params: {
  adapterType: StudioGatewayAdapterType;
  url: string;
  token?: string;
  profiles?: Partial<Record<StudioGatewayAdapterType, StudioGatewayProfile>>;
}): StudioGatewaySettings => ({
  url: params.url,
  token: params.token ?? "",
  adapterType: params.adapterType,
  ...(params.profiles ? { profiles: params.profiles } : {}),
});

const buildLocalProfile = (url: string, token = ""): StudioGatewayProfile => ({ url, token });

const readOpenclawGatewayDefaults = (): StudioGatewaySettings | null => {
  try {
    const configPath = path.join(resolveStateDir(), OPENCLAW_CONFIG_FILENAME);
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const gateway = isRecord(parsed.gateway) ? parsed.gateway : null;
    if (!gateway) return null;
    const auth = isRecord(gateway.auth) ? gateway.auth : null;
    const token = typeof auth?.token === "string" ? auth.token.trim() : "";
    const port = typeof gateway.port === "number" && Number.isFinite(gateway.port) ? gateway.port : null;
    if (!token) return null;
    const url = port ? `ws://localhost:${port}` : `ws://localhost:${DEFAULT_LOCAL_GATEWAY_PORT}`;
    if (!url) return null;
    return buildGatewaySettings({
      adapterType: "openclaw",
      url,
      token,
      profiles: {
        openclaw: buildLocalProfile(url, token),
      },
    });
  } catch {
    return null;
  }
};

const normalizeAdapterType = (value: string | undefined): StudioGatewayAdapterType | null => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "openclaw" || normalized === "hermes" || normalized === "demo" || normalized === "custom") {
    return normalized;
  }
  return null;
};

const readPortBasedGatewayProfile = (
  adapterType: Extract<StudioGatewayAdapterType, "hermes" | "demo">,
  envKey: "HERMES_ADAPTER_PORT" | "DEMO_ADAPTER_PORT"
): StudioGatewayProfile | null => {
  const rawPort = process.env[envKey]?.trim();
  if (!rawPort) return null;
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isFinite(port) || port <= 0) return null;
  return buildLocalProfile(`ws://localhost:${port}`);
};

const buildEnvGatewayDefaults = (): StudioGatewaySettings | null => {
  const envUrl = process.env.CLAW3D_GATEWAY_URL?.trim();
  const envToken = process.env.CLAW3D_GATEWAY_TOKEN?.trim() ?? "";
  const envAdapterType =
    normalizeAdapterType(process.env.CLAW3D_GATEWAY_ADAPTER_TYPE) ?? "openclaw";

  const hermesProfile = readPortBasedGatewayProfile("hermes", "HERMES_ADAPTER_PORT");
  const demoProfile = readPortBasedGatewayProfile("demo", "DEMO_ADAPTER_PORT");

  const profiles: Partial<Record<StudioGatewayAdapterType, StudioGatewayProfile>> = {};
  if (hermesProfile) profiles.hermes = hermesProfile;
  if (demoProfile) profiles.demo = demoProfile;

  if (envUrl) {
    profiles[envAdapterType] = buildLocalProfile(envUrl, envToken);
    return buildGatewaySettings({
      adapterType: envAdapterType,
      url: envUrl,
      token: envToken,
      profiles,
    });
  }

  const fallbackProfile = profiles.hermes ?? profiles.demo ?? null;
  if (!fallbackProfile) return null;
  const fallbackAdapterType = profiles.hermes ? "hermes" : "demo";
  return buildGatewaySettings({
    adapterType: fallbackAdapterType,
    url: fallbackProfile.url,
    token: fallbackProfile.token,
    profiles,
  });
};

const mergeGatewayProfiles = (
  base: StudioGatewaySettings,
  extra: StudioGatewaySettings | null
): StudioGatewaySettings => {
  if (!extra?.profiles) {
    return base;
  }
  const mergedProfiles: Partial<Record<StudioGatewayAdapterType, StudioGatewayProfile>> = {
    ...(base.profiles ?? {}),
  };
  for (const [adapterType, profile] of Object.entries(extra.profiles) as Array<
    [StudioGatewayAdapterType, StudioGatewayProfile | undefined]
  >) {
    if (!profile || mergedProfiles[adapterType]) {
      continue;
    }
    mergedProfiles[adapterType] = profile;
  }
  return {
    ...base,
    profiles: mergedProfiles,
  };
};

export const loadLocalGatewayDefaults = (): StudioGatewaySettings | null => {
  const fromFile = readOpenclawGatewayDefaults();
  const fromEnv = buildEnvGatewayDefaults();
  if (fromFile) {
    return mergeGatewayProfiles(fromFile, fromEnv);
  }
  // Fall back to env vars so operators can configure the gateway URL at
  // runtime without openclaw.json and without a rebuild. If no explicit
  // URL is provided, also expose local Hermes/Demo adapter ports when set.
  return fromEnv;
};

export const loadStudioSettings = (): StudioSettings => {
  const settingsPath = resolveStudioSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    const defaults = defaultStudioSettings();
    const gateway = loadLocalGatewayDefaults();
    return gateway ? { ...defaults, gateway } : defaults;
  }
  const raw = fs.readFileSync(settingsPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const settings = normalizeStudioSettings(parsed);
  if (!settings.gateway?.token) {
    const gateway = loadLocalGatewayDefaults();
    if (gateway) {
      return {
        ...settings,
        gateway: settings.gateway?.url?.trim()
          ? {
              url: settings.gateway.url.trim(),
              token: gateway.token,
              adapterType: settings.gateway.adapterType,
            }
          : gateway,
      };
    }
  }
  return settings;
};

export const saveStudioSettings = (next: StudioSettings) => {
  const settingsPath = resolveStudioSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), "utf8");
};

export const applyStudioSettingsPatch = (patch: StudioSettingsPatch): StudioSettings => {
  const current = loadStudioSettings();
  const next = mergeStudioSettings(current, patch);
  saveStudioSettings(next);
  return next;
};
