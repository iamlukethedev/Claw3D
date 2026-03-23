import { loadStudioSettings } from "@/lib/studio/settings-store";
import * as childProcess from "node:child_process";

const SSH_TARGET_ENV = "OPENCLAW_GATEWAY_SSH_TARGET";
const SSH_USER_ENV = "OPENCLAW_GATEWAY_SSH_USER";
const SSH_PORT_ENV = "OPENCLAW_GATEWAY_SSH_PORT";
const SSH_STRICT_HOST_KEY_ENV = "OPENCLAW_GATEWAY_SSH_STRICT_HOST_KEY_CHECKING";

export const resolveConfiguredSshTarget = (env: NodeJS.ProcessEnv = process.env): string | null => {
  const configuredTarget = env[SSH_TARGET_ENV]?.trim() ?? "";
  const configuredUser = env[SSH_USER_ENV]?.trim() ?? "";

  if (configuredTarget) {
    if (configuredTarget.includes("@")) return configuredTarget;
    if (configuredUser) return `${configuredUser}@${configuredTarget}`;
    return configuredTarget;
  }

  return null;
};

export const resolveConfiguredSshPort = (env: NodeJS.ProcessEnv = process.env): number | null => {
  const rawPort = env[SSH_PORT_ENV]?.trim() ?? "";
  if (!rawPort) {
    return null;
  }
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${SSH_PORT_ENV} must be a valid port.`);
  }
  return port;
};

export const resolveConfiguredSshStrictHostKeyChecking = (
  env: NodeJS.ProcessEnv = process.env
): "accept-new" | "yes" | "no" => {
  const rawValue = env[SSH_STRICT_HOST_KEY_ENV]?.trim().toLowerCase() ?? "";
  if (!rawValue) {
    return "accept-new";
  }
  if (rawValue === "accept-new" || rawValue === "yes" || rawValue === "no") {
    return rawValue;
  }
  throw new Error(
    `${SSH_STRICT_HOST_KEY_ENV} must be one of: accept-new, yes, no.`
  );
};

export const resolvePortFromGatewayUrl = (gatewayUrl: string): number | null => {
  const trimmed = gatewayUrl.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (!parsed.port) {
      return null;
    }
    const port = Number.parseInt(parsed.port, 10);
    return Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : null;
  } catch {
    return null;
  }
};

export const resolveGatewaySshTargetFromGatewayUrl = (
  gatewayUrl: string,
  env: NodeJS.ProcessEnv = process.env
): string => {
  const configured = resolveConfiguredSshTarget(env);
  if (configured) return configured;

  const trimmed = gatewayUrl.trim();
  if (!trimmed) {
    throw new Error(
      `Gateway URL is missing. Set it in Studio settings or set ${SSH_TARGET_ENV}.`
    );
  }
  let hostname: string;
  try {
    hostname = new URL(trimmed).hostname;
  } catch {
    throw new Error(`Invalid gateway URL: ${trimmed}`);
  }
  if (!hostname) {
    throw new Error(`Invalid gateway URL: ${trimmed}`);
  }

  const configuredUser = env[SSH_USER_ENV]?.trim() ?? "";
  const user = configuredUser || "ubuntu";
  return `${user}@${hostname}`;
};

export const resolveGatewaySshTarget = (env: NodeJS.ProcessEnv = process.env): string => {
  const configured = resolveConfiguredSshTarget(env);
  if (configured) return configured;

  const settings = loadStudioSettings();
  return resolveGatewaySshTargetFromGatewayUrl(settings.gateway?.url?.trim() ?? "", env);
};

export const extractJsonErrorMessage = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const direct = record.error;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    if (direct && typeof direct === "object") {
      const nested = (direct as Record<string, unknown>).message;
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
    return null;
  } catch {
    return null;
  }
};

export const parseJsonOutput = (raw: string, label: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`Command produced empty JSON output (${label}).`);
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(`Command produced invalid JSON output (${label}).`);
  }
};

export const runSshJson = (params: {
  sshTarget: string;
  sshPort?: number | null;
  strictHostKeyChecking?: "accept-new" | "yes" | "no";
  argv: string[];
  label: string;
  input?: string;
  fallbackMessage?: string;
  maxBuffer?: number;
}): unknown => {
  const options: childProcess.SpawnSyncOptionsWithStringEncoding = {
    encoding: "utf8",
    input: params.input,
  };
  if (params.maxBuffer !== undefined) {
    options.maxBuffer = params.maxBuffer;
  }

  const sshArgs = [
    "-o",
    "BatchMode=yes",
    "-o",
    `StrictHostKeyChecking=${params.strictHostKeyChecking ?? resolveConfiguredSshStrictHostKeyChecking()}`,
  ];
  if (typeof params.sshPort === "number") {
    sshArgs.push("-p", String(params.sshPort));
  }
  sshArgs.push(params.sshTarget, ...params.argv);

  const result = childProcess.spawnSync("ssh", sshArgs, { ...options });
  if (result.error) {
    throw new Error(`Failed to execute ssh: ${result.error.message}`);
  }
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.status !== 0) {
    const stderrText = stderr.trim();
    const stdoutText = stdout.trim();
    const message =
      extractJsonErrorMessage(stdout) ??
      extractJsonErrorMessage(stderr) ??
      (stderrText ||
        stdoutText ||
        params.fallbackMessage ||
        `Command failed (${params.label}).`);
    throw new Error(message);
  }
  return parseJsonOutput(stdout, params.label);
};
