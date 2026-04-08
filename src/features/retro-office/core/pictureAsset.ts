"use client";

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { SCALE } from "@/features/retro-office/core/constants";
import type {
  Picture3dPrimitive,
  Picture3dRecipe,
  PicturePropAsset,
} from "@/features/retro-office/core/types";

export const PICTURE_PROP_TYPE = "picture_prop";

const MAX_PREVIEW_EDGE = 320;
const MIN_PIXEL_WIDTH = 20;
const MAX_PIXEL_WIDTH = 44;
const MIN_PIXEL_HEIGHT = 20;
const MAX_PIXEL_HEIGHT = 44;
const PICTURE_PROP_DEPTH_UNITS = 30;
const DEFAULT_PALETTE = {
  accentColor: "#d97706",
  dominantColor: "#7c5c3b",
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampByte = (value: number) => clamp(Math.round(value), 0, 255);

const toHex = (value: number) => clampByte(value).toString(16).padStart(2, "0");

const rgbToHex = (r: number, g: number, b: number) =>
  `#${toHex(r)}${toHex(g)}${toHex(b)}`;

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const hexToRgb = (hex: string): RgbColor => {
  const normalized = hex.replace("#", "").trim();
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((channel) => `${channel}${channel}`)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
};

const mixColors = (base: string, overlay: string, ratio: number) => {
  const t = clamp(ratio, 0, 1);
  const start = hexToRgb(base);
  const end = hexToRgb(overlay);
  return rgbToHex(
    start.r + (end.r - start.r) * t,
    start.g + (end.g - start.g) * t,
    start.b + (end.b - start.b) * t,
  );
};

export const quantizeChannel = (value: number) =>
  clampByte(Math.round(clampByte(value) / 32) * 32);

type PaletteBucket = {
  accentScore: number;
  count: number;
  r: number;
  g: number;
  b: number;
};

export const derivePicturePalette = (rgba: ArrayLike<number>) => {
  const buckets = new Map<string, PaletteBucket>();
  let visiblePixels = 0;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (let index = 0; index < rgba.length; index += 4) {
    const alpha = rgba[index + 3] ?? 0;
    if (alpha < 24) continue;
    const r = rgba[index] ?? 0;
    const g = rgba[index + 1] ?? 0;
    const b = rgba[index + 2] ?? 0;
    visiblePixels += 1;
    totalR += r;
    totalG += g;
    totalB += b;

    const bucketKey = `${quantizeChannel(r)}:${quantizeChannel(g)}:${quantizeChannel(b)}`;
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const saturation = maxChannel - minChannel;
    const brightness = (r + g + b) / 3;
    const accentScore = saturation * 2 + brightness * 0.2;
    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.count += 1;
      existing.accentScore += accentScore;
      continue;
    }
    buckets.set(bucketKey, {
      accentScore,
      count: 1,
      r: quantizeChannel(r),
      g: quantizeChannel(g),
      b: quantizeChannel(b),
    });
  }

  if (visiblePixels === 0 || buckets.size === 0) {
    return { ...DEFAULT_PALETTE };
  }

  const dominantBucket =
    [...buckets.values()].sort((left, right) => right.count - left.count)[0] ?? {
      accentScore: 0,
      count: 1,
      r: 124,
      g: 92,
      b: 59,
    };
  const accentBucket =
    [...buckets.values()].sort(
      (left, right) =>
        right.accentScore / right.count - left.accentScore / left.count,
    )[0] ?? dominantBucket;

  const averageColor = rgbToHex(
    totalR / visiblePixels,
    totalG / visiblePixels,
    totalB / visiblePixels,
  );
  const dominantColor = mixColors(
    averageColor,
    rgbToHex(dominantBucket.r, dominantBucket.g, dominantBucket.b),
    0.6,
  );
  const accentColor = mixColors(
    dominantColor,
    rgbToHex(accentBucket.r, accentBucket.g, accentBucket.b),
    0.72,
  );

  return {
    accentColor,
    dominantColor,
    frameColor: mixColors(dominantColor, "#0f0a06", 0.72),
  };
};

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode the uploaded image."));
    image.src = src;
  });

const renderPreviewImage = (
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
) => {
  const sourceWidth =
    image instanceof HTMLImageElement || image instanceof HTMLCanvasElement
      ? image.width
      : targetWidth;
  const sourceHeight =
    image instanceof HTMLImageElement || image instanceof HTMLCanvasElement
      ? image.height
      : targetHeight;
  const sourceAspect = sourceWidth / Math.max(sourceHeight, 1);
  const targetAspect = targetWidth / Math.max(targetHeight, 1);

  let drawWidth = targetWidth;
  let drawHeight = targetHeight;
  let drawX = 0;
  let drawY = 0;

  if (sourceAspect > targetAspect) {
    drawHeight = targetWidth / sourceAspect;
    drawY = (targetHeight - drawHeight) / 2;
  } else {
    drawWidth = targetHeight * sourceAspect;
    drawX = (targetWidth - drawWidth) / 2;
  }

  context.fillStyle = "#f4efe4";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(
    image,
    0,
    0,
    sourceWidth,
    sourceHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  );
};

const sanitizeBaseFileName = (fileName: string) => {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "picture-prop";
};

export const getPicturePropGlbFileName = (asset: PicturePropAsset) =>
  `${sanitizeBaseFileName(asset.fileName)}.glb`;

export const resolvePicturePropFootprint = (aspectRatio: number) => {
  const safeAspect = clamp(Number.isFinite(aspectRatio) ? aspectRatio : 1, 0.65, 1.9);
  const widthUnits = Math.round(44 + (safeAspect - 0.65) * 18);
  return {
    depthUnits: PICTURE_PROP_DEPTH_UNITS,
    widthUnits: clamp(widthUnits, 40, 66),
  };
};

export const buildFallbackGeneratedModel = (
  palette: Pick<PicturePropAsset, "accentColor" | "dominantColor">,
  aspectRatio: number,
): Picture3dRecipe => {
  const safeAspect = clamp(aspectRatio, 0.65, 1.9);
  const width = clamp(1.1 + (safeAspect - 1) * 0.22, 0.86, 1.42);
  const depth = 0.72;
  const towerWidth = clamp(width * 0.28, 0.22, 0.34);
  const headWidth = clamp(width * 0.5, 0.32, 0.58);
  const highlightWidth = clamp(width * 0.14, 0.08, 0.18);
  return {
    title: "AI office sculpture",
    summary:
      "retro office collectible with chunky low-poly forms, matte materials, soft bevels, and furniture-like proportions.",
    footprintMeters: {
      width,
      depth,
      height: 1.66,
    },
    primitives: [
      {
        kind: "box",
        size: [width, 0.22, depth],
        position: [0, 0.11, 0],
        material: {
          color: palette.accentColor,
          roughness: 0.82,
        },
      },
      {
        kind: "box",
        size: [width * 0.74, 0.92, depth * 0.7],
        position: [0, 0.68, -0.02],
        material: {
          color: palette.dominantColor,
          roughness: 0.76,
        },
      },
      {
        kind: "box",
        size: [headWidth, 0.36, depth * 0.44],
        position: [0, 1.3, 0.04],
        material: {
          color: mixColors(palette.dominantColor, "#f6efe1", 0.3),
          roughness: 0.74,
        },
      },
      {
        kind: "box",
        size: [towerWidth, 0.54, depth * 0.44],
        position: [-(width * 0.22), 0.86, 0.12],
        material: {
          color: mixColors(palette.dominantColor, "#0f0a06", 0.72),
        roughness: 0.82,
        },
      },
      {
        kind: "box",
        size: [towerWidth, 0.62, depth * 0.36],
        position: [width * 0.22, 0.78, -0.08],
        material: {
          color: mixColors(mixColors(palette.dominantColor, "#0f0a06", 0.72), palette.dominantColor, 0.24),
          roughness: 0.78,
        },
      },
      {
        kind: "box",
        size: [highlightWidth, 0.68, depth * 0.8],
        position: [width * 0.34, 0.78, 0.05],
        material: {
          color: mixColors(palette.accentColor, "#f8d34d", 0.24),
          roughness: 0.66,
          metalness: 0.1,
        },
      },
    ],
  };
};

export const createPictureAssetFromFile = async (file: File) => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported for 3D generation.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    const aspectRatio = image.width / Math.max(image.height, 1);
    const pixelWidth = clamp(
      Math.round(32 * clamp(aspectRatio, 0.75, 1.5)),
      MIN_PIXEL_WIDTH,
      MAX_PIXEL_WIDTH,
    );
    const pixelHeight = clamp(
      Math.round(pixelWidth / Math.max(aspectRatio, 0.4)),
      MIN_PIXEL_HEIGHT,
      MAX_PIXEL_HEIGHT,
    );

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = pixelWidth;
    sourceCanvas.height = pixelHeight;
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) {
      throw new Error("Could not create an image processing context.");
    }
    sourceContext.imageSmoothingEnabled = true;
    renderPreviewImage(sourceContext, image, pixelWidth, pixelHeight);

    const previewScale = Math.max(
      1,
      Math.floor(MAX_PREVIEW_EDGE / Math.max(pixelWidth, pixelHeight)),
    );
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = pixelWidth * previewScale;
    previewCanvas.height = pixelHeight * previewScale;
    const previewContext = previewCanvas.getContext("2d");
    if (!previewContext) {
      throw new Error("Could not create a preview context.");
    }
    previewContext.imageSmoothingEnabled = false;
    previewContext.drawImage(
      sourceCanvas,
      0,
      0,
      previewCanvas.width,
      previewCanvas.height,
    );

    const palette = derivePicturePalette(
      sourceContext.getImageData(0, 0, pixelWidth, pixelHeight).data,
    );
    return {
      ...palette,
      aspectRatio,
      fileName: file.name,
      imageDataUrl: previewCanvas.toDataURL("image/webp", 0.86),
      pixelHeight,
      pixelWidth,
      provider: "preview",
      model: "local-fallback",
      summary:
        "Local preview generated. Upload will request an AI low-poly office asset recipe.",
      recipe: buildFallbackGeneratedModel(palette, aspectRatio),
    } satisfies PicturePropAsset;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const clampPrimitiveSize = (value: number, fallback: number, min: number, max: number) =>
  clamp(Number.isFinite(value) ? value : fallback, min, max);

const clampPrimitivePosition = (value: number, fallback = 0, min = -1.5, max = 1.8) =>
  clamp(Number.isFinite(value) ? value : fallback, min, max);

const clampPrimitiveRotation = (value: number, fallback = 0) =>
  clamp(Number.isFinite(value) ? value : fallback, -Math.PI, Math.PI);

const normalizeHexColor = (value: string | undefined, fallback: string) => {
  const raw = value?.trim() ?? "";
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    return fallback;
  }
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  return raw.toLowerCase();
};

export const sanitizeGeneratedPrimitive = (
  primitive: Picture3dPrimitive,
  palette: Pick<PicturePropAsset, "accentColor" | "dominantColor">,
  index: number,
): Picture3dPrimitive => {
  const fallbackColor =
    index === 0
      ? palette.dominantColor
      : index % 3 === 0
        ? palette.accentColor
        : mixColors(palette.dominantColor, "#0f0a06", 0.72);
  const material = {
    color: normalizeHexColor(primitive.material?.color, fallbackColor),
    metalness: clamp(primitive.material?.metalness ?? 0.08, 0, 0.35),
    roughness: clamp(primitive.material?.roughness ?? 0.76, 0.4, 1),
  };
  const rotation = primitive.rotation
    ? ([
        clampPrimitiveRotation(primitive.rotation[0] ?? Number.NaN),
        clampPrimitiveRotation(primitive.rotation[1] ?? Number.NaN),
        clampPrimitiveRotation(primitive.rotation[2] ?? Number.NaN),
      ] as [number, number, number])
    : undefined;
  const position = [
    clampPrimitivePosition(primitive.position[0] ?? Number.NaN),
    clampPrimitivePosition(primitive.position[1] ?? Number.NaN, 0.2, 0, 2.2),
    clampPrimitivePosition(primitive.position[2] ?? Number.NaN),
  ] as [number, number, number];
  if (primitive.kind === "cylinder") {
    return {
      kind: "cylinder",
      height: clampPrimitiveSize(primitive.height, 0.46, 0.08, 2.2),
      radiusTop: clampPrimitiveSize(primitive.radiusTop, 0.18, 0.04, 0.8),
      radiusBottom: clampPrimitiveSize(primitive.radiusBottom, 0.18, 0.04, 0.8),
      radialSegments: Math.round(clampPrimitiveSize(primitive.radialSegments ?? 16, 16, 8, 24)),
      position,
      ...(rotation ? { rotation } : {}),
      material,
    };
  }
  if (primitive.kind === "sphere") {
    return {
      kind: "sphere",
      radius: clampPrimitiveSize(primitive.radius, 0.24, 0.04, 0.8),
      widthSegments: Math.round(clampPrimitiveSize(primitive.widthSegments ?? 16, 16, 8, 24)),
      heightSegments: Math.round(clampPrimitiveSize(primitive.heightSegments ?? 16, 16, 8, 24)),
      position,
      ...(rotation ? { rotation } : {}),
      material,
    };
  }
  return {
    kind: "box",
    size: [
      clampPrimitiveSize(primitive.size[0] ?? Number.NaN, 0.46, 0.08, 1.8),
      clampPrimitiveSize(primitive.size[1] ?? Number.NaN, 0.46, 0.08, 2.2),
      clampPrimitiveSize(primitive.size[2] ?? Number.NaN, 0.46, 0.08, 1.8),
    ],
    position,
    ...(rotation ? { rotation } : {}),
    material,
  };
};

export const sanitizeGeneratedModel = (
  model: Picture3dRecipe | null | undefined,
  asset: Pick<
    PicturePropAsset,
    | "accentColor"
    | "aspectRatio"
    | "dominantColor"
    | "fileName"
    | "recipe"
  >,
): Picture3dRecipe => {
  const fallback = buildFallbackGeneratedModel(
    {
      accentColor: asset.accentColor,
      dominantColor: asset.dominantColor,
    },
    asset.aspectRatio,
  );
  if (!model) return fallback;
  const primitives: Picture3dPrimitive[] = Array.isArray(model.primitives)
    ? model.primitives
        .slice(0, 16)
        .map((primitive: Picture3dPrimitive, index: number) =>
          sanitizeGeneratedPrimitive(
            primitive,
            {
              accentColor: asset.accentColor,
              dominantColor: asset.dominantColor,
            },
            index,
          ),
        )
    : fallback.primitives;
  return {
    title: model.title?.trim() || sanitizeBaseFileName(asset.fileName),
    summary: model.summary?.trim() || fallback.summary,
    footprintMeters: {
      width: clamp(model.footprintMeters?.width ?? fallback.footprintMeters.width, 0.6, 1.8),
      depth: clamp(model.footprintMeters?.depth ?? fallback.footprintMeters.depth, 0.4, 1.4),
      height: clamp(model.footprintMeters?.height ?? fallback.footprintMeters.height, 0.8, 2.1),
    },
    primitives: primitives.length > 0 ? primitives : fallback.primitives,
  };
};

const createStandardMaterial = (
  color: string,
  overrides: Partial<THREE.MeshStandardMaterialParameters> = {},
) =>
  new THREE.MeshStandardMaterial({
    color,
    metalness: 0.08,
    roughness: 0.76,
    ...overrides,
  });

const createPrimitiveGeometry = (primitive: Picture3dPrimitive) => {
  switch (primitive.kind) {
    case "sphere":
      return new THREE.SphereGeometry(
        clamp(primitive.radius, 0.05, 0.9),
        primitive.widthSegments ?? 18,
        primitive.heightSegments ?? 18,
      );
    case "cylinder":
      return new THREE.CylinderGeometry(
        clamp(primitive.radiusTop, 0.04, 0.8),
        clamp(primitive.radiusBottom, 0.04, 0.8),
        clamp(primitive.height, 0.08, 2.2),
        primitive.radialSegments ?? 18,
      );
    case "box":
    default:
      return new THREE.BoxGeometry(
        clamp(primitive.size[0], 0.08, 1.8),
        clamp(primitive.size[1], 0.08, 2.2),
        clamp(primitive.size[2], 0.08, 1.8),
      );
  }
};

export const buildPicturePropGroup = (asset: PicturePropAsset) => {
  const model = sanitizeGeneratedModel(asset.recipe, asset);
  const footprint = resolvePicturePropFootprint(asset.aspectRatio);
  const widthScale = (footprint.widthUnits * SCALE) / Math.max(model.footprintMeters.width, 0.1);
  const depthScale = (footprint.depthUnits * SCALE) / Math.max(model.footprintMeters.depth, 0.1);
  const heightScale = 1.55 / Math.max(model.footprintMeters.height, 0.1);
  const uniformScale = clamp(Math.min(widthScale, depthScale, heightScale), 0.4, 1.6);
  const group = new THREE.Group();

  for (const primitive of model.primitives) {
    const geometry = createPrimitiveGeometry(primitive);
    const material = createStandardMaterial(primitive.material.color, {
      metalness: primitive.material.metalness ?? 0.08,
      roughness: primitive.material.roughness ?? 0.76,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      primitive.position[0] * uniformScale,
      primitive.position[1] * uniformScale,
      primitive.position[2] * uniformScale,
    );
    mesh.rotation.set(
      primitive.rotation?.[0] ?? 0,
      primitive.rotation?.[1] ?? 0,
      primitive.rotation?.[2] ?? 0,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const boundingBox = new THREE.Box3().setFromObject(group);
  const center = boundingBox.getCenter(new THREE.Vector3());
  const minY = boundingBox.min.y;
  group.position.set(-center.x, Math.max(0, -minY), -center.z);
  return group;
};

export const buildPicturePropItem = (
  asset: PicturePropAsset,
  uid: string,
  x: number,
  y: number,
) => {
  const footprint = resolvePicturePropFootprint(asset.aspectRatio);
  return {
    _uid: uid,
    h: footprint.depthUnits,
    pictureAsset: asset,
    type: PICTURE_PROP_TYPE,
    w: footprint.widthUnits,
    x,
    y,
  };
};

export const exportPictureAssetToGlb = async (asset: PicturePropAsset) => {
  const group = buildPicturePropGroup(asset);
  const exporter = new GLTFExporter();
  const binary = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      group,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
          return;
        }
        reject(new Error("3D generation export did not return a binary GLB."));
      },
      (error) => {
        reject(
          error instanceof Error ? error : new Error("3D generation export failed."),
        );
      },
      {
        binary: true,
        onlyVisible: false,
      },
    );
  });
  return new Blob([binary], { type: "model/gltf-binary" });
};
