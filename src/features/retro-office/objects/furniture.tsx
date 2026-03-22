"use client";

import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCALE } from "@/features/retro-office/core/constants";
import {
  FURNITURE_ROTATION,
  getItemBaseSize,
  getItemRotationRadians,
  resolveItemTypeKey,
  toWorld,
} from "@/features/retro-office/core/geometry";
import type { FurnitureItem } from "@/features/retro-office/core/types";
import type { InteractiveFurnitureModelProps } from "@/features/retro-office/objects/types";

export const FURNITURE_GLB: Record<string, string> = {
  desk_cubicle: "/office-assets/models/furniture/desk.glb",
  executive_desk: "/office-assets/models/furniture/deskCorner.glb",
  chair: "/office-assets/models/furniture/chairDesk.glb",
  round_table: "/office-assets/models/furniture/tableRound.glb",
  couch: "/office-assets/models/furniture/loungeSofa.glb",
  couch_v: "/office-assets/models/furniture/loungeDesignChair.glb",
  bookshelf: "/office-assets/models/furniture/bookcaseClosed.glb",
  plant: "/office-assets/models/furniture/pottedPlant.glb",
  beanbag: "/office-assets/models/furniture/loungeDesignChair.glb",
  pingpong: "/office-assets/models/furniture/tableCoffee.glb",
  table_rect: "/office-assets/models/furniture/table.glb",
  coffee_machine: "/office-assets/models/furniture/kitchenCoffeeMachine.glb",
  fridge: "/office-assets/models/furniture/kitchenFridgeSmall.glb",
  water_cooler: "/office-assets/models/furniture/plantSmall1.glb",
  whiteboard: "/office-assets/models/furniture/bookcaseClosed.glb",
  cabinet: "/office-assets/models/furniture/kitchenCabinet.glb",
  computer: "/office-assets/models/furniture/computerScreen.glb",
  lamp: "/office-assets/models/furniture/lampRoundFloor.glb",
  printer: "/office-assets/models/furniture/kitchenCoffeeMachine.glb",
};

export const FURNITURE_SCALE: Record<string, [number, number, number]> = {
  desk_cubicle: [1.5, 1.5, 1.5],
  executive_desk: [1.8, 1.8, 1.8],
  chair: [1.2, 1.2, 1.2],
  round_table: [3.2, 3.2, 3.2],
  couch: [1.8, 1.8, 1.8],
  couch_v: [1.4, 1.4, 1.4],
  bookshelf: [1.5, 2, 1.5],
  plant: [1.2, 1.8, 1.2],
  beanbag: [1, 1, 1],
  pingpong: [2.4, 1.2, 1.6],
  table_rect: [1.4, 1.2, 1.0],
  coffee_machine: [0.8, 0.8, 0.8],
  fridge: [1, 1.4, 1],
  water_cooler: [1, 2, 1],
  whiteboard: [0.6, 1.4, 0.3],
  cabinet: [2.6, 1.2, 1],
  computer: [1.1, 1.1, 1.1],
  lamp: [1.2, 1.2, 1.2],
  printer: [1, 1.2, 0.8],
};

export const FURNITURE_Y_OFFSET: Record<string, number> = {
  computer: 0.61,
};

export const FURNITURE_TINT: Record<string, string | null> = {
  desk_cubicle: "#8b5e32",
  executive_desk: "#6b3c1a",
  chair: "#4a5568",
  round_table: "#9a6332",
  couch: "#3d5575",
  couch_v: "#5a4870",
  bookshelf: "#5c3520",
  beanbag: null,
  computer: "#363c58",
  pingpong: "#2d6048",
  table_rect: "#7a5028",
  coffee_machine: "#2d2d38",
  fridge: "#505a60",
  water_cooler: "#3a5070",
  whiteboard: "#f4f2ee",
  cabinet: "#3c4248",
  plant: null,
  lamp: "#c8a060",
  printer: "#404858",
};

const SHADOW_CASTING_FURNITURE_TYPES = new Set([
  "desk_cubicle",
  "executive_desk",
  "round_table",
  "table_rect",
  "couch",
  "couch_v",
  "bookshelf",
  "cabinet",
  "fridge",
]);

const furnitureTemplateCache = new Map<string, THREE.Object3D>();

type InstancedFurnitureMeshDef = {
  castShadow: boolean;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrixWorld: THREE.Matrix4;
  receiveShadow: boolean;
};

const resolveFurnitureTemplate = (params: {
  glbPath: string;
  itemColor: string | undefined;
  itemType: string;
  scene: THREE.Object3D;
}) => {
  const cacheKey = `${params.glbPath}:${params.itemType}:${params.itemColor ?? ""}`;
  const cached = furnitureTemplateCache.get(cacheKey);
  if (cached) return cached;

  const rawTint =
    params.itemType === "beanbag"
      ? (params.itemColor ?? null)
      : FURNITURE_TINT[params.itemType];
  const tintColor = rawTint ? new THREE.Color(rawTint) : null;
  const template = params.scene.clone(true);
  const castShadow = SHADOW_CASTING_FURNITURE_TYPES.has(params.itemType);

  template.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const templateMats = mats.map((material) => {
      const nextMaterial = material.clone() as THREE.MeshStandardMaterial;
      if (tintColor && "color" in nextMaterial) {
        nextMaterial.color.lerp(tintColor, 0.8);
      }
      if ("roughness" in nextMaterial) nextMaterial.roughness = 0.65;
      if ("metalness" in nextMaterial) nextMaterial.metalness = 0.08;
      nextMaterial.userData = {
        ...nextMaterial.userData,
        furnitureSharedMaterial: true,
      };
      return nextMaterial;
    });
    mesh.material = Array.isArray(mesh.material) ? templateMats : templateMats[0];
  });

  furnitureTemplateCache.set(cacheKey, template);
  return template;
};

const buildFurnitureItemMatrix = (item: FurnitureItem, itemType: string) => {
  const [wx, , wz] = toWorld(item.x, item.y);
  const yOffset = (FURNITURE_Y_OFFSET[itemType] ?? 0) + (item.elevation ?? 0);
  const scale = FURNITURE_SCALE[itemType] ?? [1, 1, 1];
  const rotY = getItemRotationRadians(item);
  const { width, height } = getItemBaseSize(item);
  const pivotX = width * SCALE * 0.5;
  const pivotZ = height * SCALE * 0.5;

  const containerMatrix = new THREE.Matrix4().makeTranslation(wx, yOffset, wz);
  const pivotMatrix = new THREE.Matrix4().makeTranslation(pivotX, 0, pivotZ);
  const rotationMatrix = new THREE.Matrix4().makeRotationY(rotY);
  const unpivotMatrix = new THREE.Matrix4().makeTranslation(-pivotX, 0, -pivotZ);
  const scaleMatrix = new THREE.Matrix4().makeScale(scale[0], scale[1], scale[2]);

  return containerMatrix
    .multiply(pivotMatrix)
    .multiply(rotationMatrix)
    .multiply(unpivotMatrix)
    .multiply(scaleMatrix);
};

export function InstancedFurnitureItems({
  itemType,
  items,
  onItemClick,
}: {
  itemType: string;
  items: FurnitureItem[];
  onItemClick?: (itemUid: string) => void;
}) {
  const glbPath = FURNITURE_GLB[itemType] ?? FURNITURE_GLB.table_rect;
  const { scene } = useGLTF(glbPath);
  const template = useMemo(
    () =>
      resolveFurnitureTemplate({
        glbPath,
        itemColor: undefined,
        itemType,
        scene,
      }),
    [glbPath, itemType, scene],
  );
  const meshRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const meshDefs = useMemo<InstancedFurnitureMeshDef[]>(() => {
    template.updateMatrixWorld(true);
    const nextDefs: InstancedFurnitureMeshDef[] = [];
    template.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      nextDefs.push({
        castShadow: mesh.castShadow,
        geometry: mesh.geometry,
        material: mesh.material as THREE.Material,
        matrixWorld: mesh.matrixWorld.clone(),
        receiveShadow: mesh.receiveShadow,
      });
    });
    return nextDefs;
  }, [template]);
  const itemMatrices = useMemo(
    () => items.map((item) => buildFurnitureItemMatrix(item, itemType)),
    [itemType, items],
  );
  const itemUidByInstanceId = useMemo(
    () => items.map((item) => item._uid),
    [items],
  );

  const handleClick = useMemo(
    () =>
      onItemClick
        ? (event: ThreeEvent<MouseEvent>) => {
            event.stopPropagation();
            const instanceId = event.instanceId;
            if (typeof instanceId !== "number") return;
            const itemUid = itemUidByInstanceId[instanceId];
            if (!itemUid) return;
            onItemClick(itemUid);
          }
        : undefined,
    [itemUidByInstanceId, onItemClick],
  );

  useLayoutEffect(() => {
    meshDefs.forEach((def, meshIndex) => {
      const instancedMesh = meshRefs.current[meshIndex];
      if (!instancedMesh) return;
      const worldMatrix = new THREE.Matrix4();
      for (let itemIndex = 0; itemIndex < itemMatrices.length; itemIndex += 1) {
        worldMatrix.multiplyMatrices(itemMatrices[itemIndex], def.matrixWorld);
        instancedMesh.setMatrixAt(itemIndex, worldMatrix);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.computeBoundingSphere();
    });
  }, [itemMatrices, meshDefs]);

  if (items.length === 0) return null;

  return (
    <>
      {meshDefs.map((def, meshIndex) => (
        <instancedMesh
          key={`${itemType}-${meshIndex}`}
          ref={(node) => {
            meshRefs.current[meshIndex] = node;
          }}
          args={[def.geometry, def.material, items.length]}
          castShadow={def.castShadow}
          receiveShadow={def.receiveShadow}
          onClick={handleClick}
        />
      ))}
    </>
  );
}

export function FurnitureModel({
  item,
  isSelected,
  isHovered,
  editMode,
  onPointerDown,
  onPointerOver,
  onPointerOut,
  onClick,
}: InteractiveFurnitureModelProps) {
  const itemType = resolveItemTypeKey(item);
  const glbPath = FURNITURE_GLB[itemType] ?? FURNITURE_GLB.table_rect;
  const { scene } = useGLTF(glbPath);
  const template = useMemo(
    () =>
      resolveFurnitureTemplate({
        glbPath,
        itemColor: item.color,
        itemType,
        scene,
      }),
    [glbPath, item.color, itemType, scene],
  );
  const cloned = useMemo(() => template.clone(true), [template]);
  const [wx, , wz] = toWorld(item.x, item.y);
  const yOffset = (FURNITURE_Y_OFFSET[itemType] ?? 0) + (item.elevation ?? 0);
  const scale = FURNITURE_SCALE[itemType] ?? [1, 1, 1];
  const rotY = getItemRotationRadians(item);
  const { width, height } = getItemBaseSize(item);
  const pivotX = width * SCALE * 0.5;
  const pivotZ = height * SCALE * 0.5;

  useEffect(() => {
    const highlightActive = isSelected || (isHovered && editMode);
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const nextMats = mats.map((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) {
          return material;
        }
        const hasOwnMaterial = Boolean(material.userData?.furnitureInstanceMaterial);
        let nextMaterial = material;
        if (highlightActive && !hasOwnMaterial) {
          nextMaterial = material.clone();
          nextMaterial.userData = {
            ...material.userData,
            furnitureInstanceMaterial: true,
          };
        }
        if (!("emissive" in nextMaterial)) {
          return nextMaterial;
        }
        if (isSelected) {
          nextMaterial.emissive.set("#fbbf24");
          nextMaterial.emissiveIntensity = 0.35;
        } else if (isHovered && editMode) {
          nextMaterial.emissive.set("#4a90d9");
          nextMaterial.emissiveIntensity = 0.25;
        } else {
          nextMaterial.emissive.set("#000000");
          nextMaterial.emissiveIntensity = 0;
        }
        return nextMaterial;
      });
      mesh.material = Array.isArray(mesh.material) ? nextMats : nextMats[0];
    });
  }, [cloned, editMode, isHovered, isSelected]);

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
        <group position={[-pivotX, 0, -pivotZ]} scale={scale}>
          <primitive object={cloned} />
        </group>
      </group>
    </group>
  );
}

export function PlacementGhost({
  itemType,
  position,
}: {
  itemType: string;
  position: [number, number, number];
}) {
  const glbPath = FURNITURE_GLB[itemType] ?? FURNITURE_GLB.table_rect;
  const { scene } = useGLTF(glbPath);
  const template = useMemo(
    () =>
      resolveFurnitureTemplate({
        glbPath,
        itemColor: undefined,
        itemType,
        scene,
      }),
    [glbPath, itemType, scene],
  );
  const cloned = useMemo(() => template.clone(true), [template]);
  const scale = FURNITURE_SCALE[itemType] ?? [1, 1, 1];
  const rotY = FURNITURE_ROTATION[itemType] ?? 0;

  return (
    <group position={position} rotation={[0, rotY, 0]} scale={scale}>
      <primitive object={cloned} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

// Preloads all furniture GLB models. Must be called inside a React component.
export function FurniturePreloader() {
  useEffect(() => {
    [...new Set(Object.values(FURNITURE_GLB))].forEach((path) => useGLTF.preload(path));
  }, []);
  return null;
}
