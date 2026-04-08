import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildPicturePropGroup,
  buildPicturePropItem,
  derivePicturePalette,
  resolvePicturePropFootprint,
} from "@/features/retro-office/core/pictureAsset";
import type { PicturePropAsset } from "@/features/retro-office/core/types";

const demoAsset: PicturePropAsset = {
  fileName: "photo.png",
  imageDataUrl: "data:image/png;base64,abc",
  aspectRatio: 1.1,
  dominantColor: "#774433",
  accentColor: "#335577",
  pixelWidth: 32,
  pixelHeight: 28,
  provider: "openai",
  model: "gpt-4o-mini",
  summary: "Chunky desk collectible inspired by the uploaded reference.",
  recipe: {
    title: "Retro Desk Figure",
    summary: "Layered low-poly character silhouette.",
    footprintMeters: {
      width: 0.84,
      depth: 0.46,
      height: 1.24,
    },
    primitives: [
      {
        kind: "box",
        size: [0.78, 0.2, 0.44],
        position: [0, 0.1, 0],
        material: { color: "#774433", roughness: 0.82, metalness: 0.06 },
      },
      {
        kind: "cylinder",
        radiusTop: 0.14,
        radiusBottom: 0.18,
        height: 0.78,
        position: [0, 0.59, 0],
        material: { color: "#335577", roughness: 0.74, metalness: 0.08 },
      },
      {
        kind: "sphere",
        radius: 0.22,
        position: [0, 1.08, 0.02],
        material: { color: "#d9c4aa", roughness: 0.7, metalness: 0.04 },
      },
    ],
  },
};

describe("derivePicturePalette", () => {
  it("builds stable dominant and accent colors from visible pixels", () => {
    const pixels = new Uint8ClampedArray([
      200,
      60,
      60,
      255,
      200,
      60,
      60,
      255,
      40,
      80,
      200,
      255,
    ]);

    expect(derivePicturePalette(pixels)).toEqual({
      accentColor: "#4857a1",
      dominantColor: "#ae4151",
      frameColor: "#3c191b",
    });
  });
});

describe("resolvePicturePropFootprint", () => {
  it("scales width with aspect ratio and clamps the result", () => {
    expect(resolvePicturePropFootprint(0.4)).toEqual({
      depthUnits: 30,
      widthUnits: 44,
    });
    expect(resolvePicturePropFootprint(1.5)).toEqual({
      depthUnits: 30,
      widthUnits: 59,
    });
  });
});

describe("buildPicturePropGroup", () => {
  it("builds a freestanding object whose base sits on the floor", () => {
    const group = buildPicturePropGroup(demoAsset);
    expect(group.children.length).toBe(3);
    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
  });
});

describe("buildPicturePropItem", () => {
  it("stores the AI recipe on the furniture item", () => {
    const item = buildPicturePropItem(demoAsset, "item-1", 100, 120);

    expect(item.pictureAsset?.recipe.title).toBe("Retro Desk Figure");
    expect(item.type).toBe("picture_prop");
    expect(item.w).toBeGreaterThan(0);
    expect(item.h).toBeGreaterThan(0);
  });
});
