"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SCALE } from "@/features/retro-office/core/constants";
import {
  getItemBaseSize,
  getItemRotationRadians,
  toWorld,
} from "@/features/retro-office/core/geometry";
import {
  buildPicturePropGroup,
  PICTURE_PROP_TYPE,
  resolvePicturePropFootprint,
} from "@/features/retro-office/core/pictureAsset";
import type { FurnitureItem } from "@/features/retro-office/core/types";
import type {
  BasicFurnitureModelProps,
  InteractiveFurnitureModelProps,
} from "@/features/retro-office/objects/types";

const disposeObject3D = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if ("map" in material && material.map instanceof THREE.Texture) {
        material.map.dispose();
      }
      material.dispose();
    }
  });
};

const applyHighlight = ({
  editMode,
  isHovered,
  isSelected,
  object,
}: {
  editMode: boolean;
  isHovered: boolean;
  isSelected: boolean;
  object: THREE.Object3D;
}) => {
  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      if (isSelected) {
        material.emissive.set("#fbbf24");
        material.emissiveIntensity = 0.34;
      } else if (isHovered && editMode) {
        material.emissive.set("#4a90d9");
        material.emissiveIntensity = 0.24;
      } else {
        material.emissive.set("#000000");
        material.emissiveIntensity = 0;
      }
    }
  });
};

const buildStyledObject = (
  item: FurnitureItem,
  overrideAsset = item.pictureAsset,
) => {
  if (!overrideAsset) return null;
  return buildPicturePropGroup(overrideAsset);
};

export function PicturePropModel({
  item,
  isSelected,
  isHovered,
  editMode,
  onPointerDown,
  onPointerOver,
  onPointerOut,
  onClick,
}: InteractiveFurnitureModelProps) {
  const asset = item.pictureAsset;
  const modelObject = useMemo(
    () => buildStyledObject(item),
    [item],
  );
  const [wx, , wz] = toWorld(item.x, item.y);
  const { width, height } = getItemBaseSize(item);
  const pivotX = width * SCALE * 0.5;
  const pivotZ = height * SCALE * 0.5;
  const rotY = getItemRotationRadians(item);
  const yOffset = item.elevation ?? 0;

  useEffect(() => {
    if (!modelObject) return;
    applyHighlight({
      editMode,
      isHovered,
      isSelected,
      object: modelObject,
    });
  }, [editMode, isHovered, isSelected, modelObject]);

  useEffect(
    () => () => {
      if (!modelObject) return;
      disposeObject3D(modelObject);
    },
    [modelObject],
  );

  if (!asset || !modelObject) return null;

  return (
    <group
      position={[wx, yOffset, wz]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown(item._uid);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onPointerOver(item._uid);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onPointerOut();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(item._uid);
      }}
    >
      <group position={[pivotX, 0, pivotZ]} rotation={[0, rotY, 0]}>
        <primitive object={modelObject} />
      </group>
    </group>
  );
}

export function PicturePropGhost({
  asset,
  position,
}: {
  asset: NonNullable<FurnitureItem["pictureAsset"]>;
  position: [number, number, number];
}) {
  const footprint = resolvePicturePropFootprint(asset.aspectRatio);
  const ghostItem = useMemo<FurnitureItem>(
    () => ({
      _uid: "__picture_prop_ghost__",
      h: footprint.depthUnits,
      pictureAsset: asset,
      type: PICTURE_PROP_TYPE,
      w: footprint.widthUnits,
      x: 0,
      y: 0,
    }),
    [asset, footprint.depthUnits, footprint.widthUnits],
  );
  const modelObject = useMemo(
    () => buildStyledObject(ghostItem, asset),
    [asset, ghostItem],
  );
  const pivotX = footprint.widthUnits * SCALE * 0.5;
  const pivotZ = footprint.depthUnits * SCALE * 0.5;

  useEffect(() => {
    if (!modelObject) return;
    modelObject.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.transparent = true;
        material.opacity = 0.78;
        material.emissive.set("#fbbf24");
        material.emissiveIntensity = 0.18;
      }
    });
  }, [modelObject]);

  useEffect(
    () => () => {
      if (!modelObject) return;
      disposeObject3D(modelObject);
    },
    [modelObject],
  );

  if (!modelObject) return null;

  return (
    <group position={position}>
      <group position={[pivotX, 0, pivotZ]}>
        <primitive object={modelObject} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pivotX, 0.01, pivotZ]}>
        <planeGeometry args={[footprint.widthUnits * SCALE, footprint.depthUnits * SCALE]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

export function ReadOnlyPicturePropModel({
  item,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}: BasicFurnitureModelProps) {
  return (
    <PicturePropModel
      item={item}
      isSelected={false}
      isHovered={false}
      editMode={false}
      onPointerDown={onPointerDown ?? (() => {})}
      onPointerOver={onPointerOver ?? (() => {})}
      onPointerOut={onPointerOut ?? (() => {})}
    />
  );
}
