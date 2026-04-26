import { NextResponse } from "next/server";

import { isLikelyLocalGatewayUrl } from "@/lib/gateway/local-gateway";
import { removeSkillLocally } from "@/lib/skills/remove-local";
import type { RemovableSkillSource, SkillRemoveRequest } from "@/lib/skills/types";
import {
  resolveConfiguredSshTarget,
  resolveGatewaySshTargetFromGatewayUrl,
} from "@/lib/ssh/gateway-host";
import { removeSkillOverSsh } from "@/lib/ssh/skills-remove";
import { loadStudioSettings } from "@/lib/studio/settings-store";

export const runtime = "nodejs";

const REMOVABLE_SOURCES = new Set<RemovableSkillSource>([
  "openclaw-managed",
  "openclaw-workspace",
]);

const SAFE_PATH_RE = /^[a-zA-Z0-9_.~\x2F:\\-]+$/;

const normalizeRequired = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new Error(`${field} is required.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
};

const normalizeRequiredPath = (value: unknown, field: string): string => {
  const trimmed = normalizeRequired(value, field);
  if (!SAFE_PATH_RE.test(trimmed)) {
    throw new Error(`${field} contains invalid characters.`);
  }
  return trimmed;
};

const resolveSkillRemovalSshTarget = (): string | null => {
  const configured = resolveConfiguredSshTarget(process.env);
  if (configured) return configured;
  const settings = loadStudioSettings();
  const gatewayUrl = settings.gateway?.url ?? "";
  if (isLikelyLocalGatewayUrl(gatewayUrl)) return null;
  return resolveGatewaySshTargetFromGatewayUrl(gatewayUrl, process.env);
};

const normalizeRemoveRequest = (body: unknown): SkillRemoveRequest => {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request payload.");
  }

  const record = body as Partial<Record<keyof SkillRemoveRequest, unknown>>;
  const sourceRaw = normalizeRequired(record.source, "source");
  if (!REMOVABLE_SOURCES.has(sourceRaw as RemovableSkillSource)) {
    throw new Error(`Unsupported skill source for removal: ${sourceRaw}`);
  }

  return {
    skillKey: normalizeRequired(record.skillKey, "skillKey"),
    source: sourceRaw as RemovableSkillSource,
    baseDir: normalizeRequiredPath(record.baseDir, "baseDir"),
    workspaceDir: normalizeRequiredPath(record.workspaceDir, "workspaceDir"),
    managedSkillsDir: normalizeRequiredPath(record.managedSkillsDir, "managedSkillsDir"),
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const removeRequest = normalizeRemoveRequest(body);

    const sshTarget = resolveSkillRemovalSshTarget();
    const result = sshTarget
      ? removeSkillOverSsh({ sshTarget, request: removeRequest })
      : removeSkillLocally(removeRequest);

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove skill.";
    const status =
      message.includes("required") ||
      message.includes("Invalid request payload") ||
      message.includes("Unsupported skill source") ||
      message.includes("Refusing to remove") ||
      message.includes("not a directory") ||
      message.includes("Remote workspace skill removal is not supported over SSH") ||
      message.includes("Gateway URL is missing") ||
      message.includes("Invalid gateway URL") ||
      message.includes("require OPENCLAW_GATEWAY_SSH_TARGET") ||
      message.includes("invalid characters")
        ? 400
        : 500;
    if (status >= 500) {
      console.error(message);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
