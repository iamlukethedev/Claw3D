import { buildAgentMainSessionKey } from "@/lib/gateway/sessionKeys";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  createGatewayAgent,
  removeGatewayAgentFromConfigOnly,
  updateGatewayAgentOverrides,
} from "@/lib/gateway/agentConfig";
import type {
  Picture3dRecipe,
  Picture3dPrimitive,
} from "@/features/retro-office/core/types";

const PICTURE_MODEL_AGENT_NAME = "Picture Modeler";
export const MAX_PICTURE_MODEL_UPLOAD_BYTES = 12 * 1024 * 1024;

type GatewayLikeClient = {
  call<T = unknown>(method: string, params: unknown): Promise<T>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const resolveRunId = (payload: unknown): string => {
  if (!isRecord(payload)) {
    throw new Error("Gateway returned an invalid chat.send response.");
  }
  const runId = typeof payload.runId === "string" ? payload.runId.trim() : "";
  if (!runId) {
    throw new Error("Gateway returned an invalid chat.send response (missing runId).");
  }
  return runId;
};

const resolveMainKey = async (client: GatewayLikeClient): Promise<string> => {
  const result = (await client.call("agents.list", {})) as { mainKey?: unknown };
  return typeof result?.mainKey === "string" && result.mainKey.trim()
    ? result.mainKey.trim()
    : "main";
};

const escapeForPrompt = (value: string) => JSON.stringify(value);

export const buildPictureModelGatewayPrompt = (summary: {
  fileName: string;
  aspectRatio: number;
  dominantColor: string;
  accentColor: string;
  pixelWidth: number;
  pixelHeight: number;
  summaryText: string;
}) =>
  [
    "Create a low-poly 3D office asset recipe from the following visual summary.",
    "Return ONLY valid JSON with this exact shape:",
    "{",
    '  "title": string,',
    '  "summary": string,',
    '  "footprintMeters": { "width": number, "depth": number, "height": number },',
    '  "primitives": [',
    "    {",
    '      "kind": "box" | "cylinder" | "sphere",',
    '      "position": [x, y, z],',
    '      "rotation": [x, y, z],',
    '      "material": { "color": "#rrggbb", "roughness": number, "metalness": number },',
    '      "size"?: [x, y, z],',
    '      "radiusTop"?: number,',
    '      "radiusBottom"?: number,',
    '      "height"?: number,',
    '      "radius"?: number,',
    '      "radialSegments"?: number,',
    '      "widthSegments"?: number,',
    '      "heightSegments"?: number',
    "    }",
    "  ]",
    "}",
    "",
    "Constraints:",
    "1. 3 to 12 primitives only.",
    "2. The asset must be freestanding and stable on the floor.",
    "3. Use a matte retro office furniture style.",
    "4. Prefer chunky simplified silhouettes over fine detail.",
    "5. Use only boxes, cylinders, and spheres.",
    "6. Keep the object at desk collectible scale.",
    "7. Do not include markdown fences or explanation text.",
    "",
    `Source file: ${escapeForPrompt(summary.fileName)}`,
    `Aspect ratio: ${summary.aspectRatio.toFixed(4)}`,
    `Dominant color: ${summary.dominantColor}`,
    `Accent color: ${summary.accentColor}`,
    `Pixel size: ${summary.pixelWidth}x${summary.pixelHeight}`,
    `Visual summary: ${escapeForPrompt(summary.summaryText)}`,
  ].join("\n");

const normalizeNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizeColor = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;

const normalizeVector = (
  value: unknown,
  fallback: [number, number, number],
): [number, number, number] => {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  return [
    normalizeNumber(value[0], fallback[0]),
    normalizeNumber(value[1], fallback[1]),
    normalizeNumber(value[2], fallback[2]),
  ];
};

const normalizePrimitive = (
  primitive: unknown,
  fallbackColor: string,
): Picture3dPrimitive | null => {
  if (!isRecord(primitive)) return null;
  const kind =
    primitive.kind === "cylinder" || primitive.kind === "sphere" || primitive.kind === "box"
      ? primitive.kind
      : "box";
  const material = isRecord(primitive.material) ? primitive.material : {};
  const baseMaterial = {
    color: normalizeColor(material.color, fallbackColor),
    roughness: normalizeNumber(material.roughness, 0.76),
    metalness: normalizeNumber(material.metalness, 0.08),
  };
  const position = normalizeVector(primitive.position, [0, 0.5, 0]);
  const rotation = normalizeVector(primitive.rotation, [0, 0, 0]);
  if (kind === "cylinder") {
    return {
      kind,
      position,
      rotation,
      material: baseMaterial,
      radiusTop: normalizeNumber(primitive.radiusTop, 0.16),
      radiusBottom: normalizeNumber(primitive.radiusBottom, 0.18),
      height: normalizeNumber(primitive.height, 0.6),
      radialSegments: normalizeNumber(primitive.radialSegments, 16),
    };
  }
  if (kind === "sphere") {
    return {
      kind,
      position,
      rotation,
      material: baseMaterial,
      radius: normalizeNumber(primitive.radius, 0.24),
      widthSegments: normalizeNumber(primitive.widthSegments, 16),
      heightSegments: normalizeNumber(primitive.heightSegments, 16),
    };
  }
  return {
    kind: "box",
    position,
    rotation,
    material: baseMaterial,
    size: normalizeVector(primitive.size, [0.4, 0.4, 0.4]),
  };
};

const extractAssistantText = (payload: unknown): string => {
  if (!isRecord(payload)) return "";
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message)) continue;
    const role = typeof message.role === "string" ? message.role.trim() : "";
    if (role !== "assistant") continue;
    const content = typeof message.content === "string" ? message.content.trim() : "";
    if (content) return content;
  }
  return "";
};

const stripCodeFences = (value: string) =>
  value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

const parseRecipeFromHistory = (
  payload: unknown,
  summary: {
    fileName: string;
    summaryText: string;
    dominantColor: string;
    accentColor: string;
  },
): Picture3dRecipe => {
  const assistantText = stripCodeFences(extractAssistantText(payload));
  if (!assistantText) {
    throw new Error("OpenClaw did not return a 3D recipe.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(assistantText);
  } catch {
    throw new Error("OpenClaw returned invalid JSON for the 3D recipe.");
  }
  if (!isRecord(parsed)) {
    throw new Error("OpenClaw returned an invalid 3D recipe payload.");
  }
  const footprint = isRecord(parsed.footprintMeters) ? parsed.footprintMeters : {};
  const rawPrimitives = Array.isArray(parsed.primitives) ? parsed.primitives : [];
  const primitives = rawPrimitives
    .slice(0, 12)
    .map((primitive, index) =>
      normalizePrimitive(
        primitive,
        index % 2 === 0 ? summary.dominantColor : summary.accentColor,
      ),
    )
    .filter((primitive): primitive is Picture3dPrimitive => primitive !== null);
  if (primitives.length === 0) {
    throw new Error("OpenClaw returned a 3D recipe without usable primitives.");
  }
  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : `${summary.fileName} sculpture`,
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : summary.summaryText,
    footprintMeters: {
      width: normalizeNumber(footprint.width, 1),
      depth: normalizeNumber(footprint.depth, 0.8),
      height: normalizeNumber(footprint.height, 1.4),
    },
    primitives,
  };
};

export const generatePictureModelViaGateway = async (params: {
  client: GatewayLikeClient;
  summary: {
    fileName: string;
    aspectRatio: number;
    dominantColor: string;
    accentColor: string;
    pixelWidth: number;
    pixelHeight: number;
    summaryText: string;
  };
}): Promise<Picture3dRecipe> => {
  let helperAgentId: string | null = null;
  const configClient = params.client as unknown as GatewayClient;
  try {
    const created = await createGatewayAgent({
      client: configClient,
      name: `${PICTURE_MODEL_AGENT_NAME} ${Date.now()}`,
    });
    helperAgentId = created.id;

    await updateGatewayAgentOverrides({
      client: configClient,
      agentId: helperAgentId,
      overrides: {
        tools: {
          alsoAllow: ["group:runtime"],
          deny: ["group:web", "group:fs"],
        },
      },
    });

    const mainKey = await resolveMainKey(params.client);
    const sessionKey = buildAgentMainSessionKey(helperAgentId, mainKey);
    const sendResult = await params.client.call("chat.send", {
      sessionKey,
      message: buildPictureModelGatewayPrompt(params.summary),
      deliver: false,
      idempotencyKey: `picture-model:${Date.now()}`,
    });
    const runId = resolveRunId(sendResult);
    await params.client.call("agent.wait", { runId, timeoutMs: 120_000 });
    const history = await params.client.call("chat.history", {
      sessionKey,
      limit: 12,
    });
    return parseRecipeFromHistory(history, params.summary);
  } finally {
    if (helperAgentId) {
      try {
        await removeGatewayAgentFromConfigOnly({
          client: configClient,
          agentId: helperAgentId,
        });
      } catch {
        // Best-effort cleanup for temporary picture-model agents.
      }
    }
  }
};
