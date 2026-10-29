"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";

import type { BulletinBoardSummary, BulletinHighlight } from "@/features/office/bulletin/bulletinBoard";
import { BULLETIN_TYPE_THEME } from "@/features/office/bulletin/bulletinTheme";
import { SCALE } from "@/features/retro-office/core/constants";
import { getItemBaseSize, getItemRotationRadians, toWorld } from "@/features/retro-office/core/geometry";
import type { InteractiveFurnitureModelProps } from "@/features/retro-office/objects/types";

export type BulletinBoardModelProps = InteractiveFurnitureModelProps & {
  summary?: BulletinBoardSummary | null;
};

const BOARD_CENTER_Y = 1.02;
const FRAME_SIZE: [number, number, number] = [1.62, 1.0, 0.06];
const CORK_SIZE: [number, number] = [1.5, 0.88];
const GRID_COLUMNS = 4;
const CARD_SIZE: [number, number] = [0.3, 0.22];
const CARD_STEP: [number, number] = [0.36, 0.27];
const CARD_Z = FRAME_SIZE[2] / 2 + 0.012;
const TILTS = [-0.05, 0.035, -0.015, 0.045, 0.01, -0.035];

// Shown on an empty board so the prop still reads as a notice board.
const PLACEHOLDER_NOTES: BulletinHighlight[] = [
  { id: "placeholder-a", type: "meeting_note", priority: "normal", pinned: false, title: "" },
  { id: "placeholder-b", type: "announcement", priority: "normal", pinned: false, title: "" },
];

function BoardCard({ highlight, index }: { highlight: BulletinHighlight; index: number }) {
  const theme = BULLETIN_TYPE_THEME[highlight.type];
  const column = index % GRID_COLUMNS;
  const row = Math.floor(index / GRID_COLUMNS);
  const x = -CARD_STEP[0] * ((GRID_COLUMNS - 1) / 2) + column * CARD_STEP[0];
  const y = BOARD_CENTER_Y + CARD_STEP[1] - row * CARD_STEP[1];
  const tilt = TILTS[index % TILTS.length] ?? 0;
  return (
    <group position={[x, y, CARD_Z]} rotation={[0, 0, tilt]}>
      <mesh receiveShadow>
        <planeGeometry args={CARD_SIZE} />
        <meshStandardMaterial color={theme.paper} roughness={0.92} />
      </mesh>
      <mesh position={[0, CARD_SIZE[1] / 2 - 0.018, 0.001]}>
        <planeGeometry args={[CARD_SIZE[0], 0.036]} />
        <meshStandardMaterial color={theme.band} roughness={0.8} />
      </mesh>
      {/* Ruled lines hint at text without rendering it. */}
      {[0.02, -0.03, -0.08].map((lineY) => (
        <mesh key={lineY} position={[-0.02, lineY, 0.001]}>
          <planeGeometry args={[CARD_SIZE[0] * 0.72, 0.012]} />
          <meshStandardMaterial color="#9a8f80" roughness={1} transparent opacity={0.45} />
        </mesh>
      ))}
      {highlight.pinned ? (
        <mesh position={[0, CARD_SIZE[1] / 2, 0.002]} rotation={[0, 0, -0.06]}>
          <planeGeometry args={[0.12, 0.045]} />
          <meshStandardMaterial color="#fdf6d6" roughness={0.6} transparent opacity={0.85} />
        </mesh>
      ) : (
        <mesh position={[0, CARD_SIZE[1] / 2 - 0.015, 0.012]} castShadow>
          <sphereGeometry args={[0.016, 12, 12]} />
          <meshStandardMaterial color={theme.pin} roughness={0.35} metalness={0.1} />
        </mesh>
      )}
    </group>
  );
}

function AlertLamp() {
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    material.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 4) * 0.7;
  });
  return (
    <mesh position={[FRAME_SIZE[0] / 2 - 0.08, BOARD_CENTER_Y + FRAME_SIZE[1] / 2 + 0.05, 0.01]}>
      <sphereGeometry args={[0.045, 16, 16]} />
      <meshStandardMaterial ref={materialRef} color="#ef4444" emissive="#ef4444" emissiveIntensity={1} roughness={0.3} />
    </mesh>
  );
}

export function BulletinBoardModel({
  item,
  isSelected,
  isHovered,
  editMode,
  summary,
  onPointerDown,
  onPointerOver,
  onPointerOut,
  onClick,
}: BulletinBoardModelProps) {
  const [wx, , wz] = toWorld(item.x, item.y);
  const { width, height } = getItemBaseSize(item);
  const rotY = getItemRotationRadians(item);
  const highlights = summary && summary.highlights.length > 0 ? summary.highlights : PLACEHOLDER_NOTES;
  const showAlert = Boolean(summary && summary.highPriorityBlockers > 0);
  // Interactive outside edit mode too: hovering hints that the board opens.
  const highlightColor = isSelected ? "#fbbf24" : isHovered ? (editMode ? "#fb7185" : "#fde68a") : "#000000";
  const highlightIntensity = isSelected ? 0.32 : isHovered ? 0.16 : 0;

  return (
    <group
      position={[wx, 0, wz]}
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
      <group position={[(width * SCALE) / 2, 0, (height * SCALE) / 2]} rotation={[0, rotY, 0]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * (FRAME_SIZE[0] / 2 - 0.05), 0, 0]}>
            <mesh position={[0, BOARD_CENTER_Y * 0.78, -0.02]} castShadow>
              <boxGeometry args={[0.05, BOARD_CENTER_Y * 1.56, 0.05]} />
              <meshStandardMaterial color="#5c3519" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.02, -0.02]} castShadow receiveShadow>
              <boxGeometry args={[0.07, 0.04, 0.34]} />
              <meshStandardMaterial color="#4a2b14" roughness={0.75} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, BOARD_CENTER_Y, 0]} castShadow receiveShadow>
          <boxGeometry args={FRAME_SIZE} />
          <meshStandardMaterial
            color="#6e4223"
            roughness={0.62}
            emissive={highlightColor}
            emissiveIntensity={highlightIntensity}
          />
        </mesh>
        <mesh position={[0, BOARD_CENTER_Y, FRAME_SIZE[2] / 2 + 0.002]} receiveShadow>
          <planeGeometry args={CORK_SIZE} />
          <meshStandardMaterial color="#b98a5a" roughness={0.98} />
        </mesh>
        {/* Brass name plate. */}
        <mesh position={[0, BOARD_CENTER_Y + FRAME_SIZE[1] / 2 + 0.06, 0]} castShadow>
          <boxGeometry args={[0.46, 0.1, 0.03]} />
          <meshStandardMaterial color="#c9a227" roughness={0.35} metalness={0.65} />
        </mesh>
        {highlights.map((highlight, index) => (
          <BoardCard key={highlight.id} highlight={highlight} index={index} />
        ))}
        {showAlert ? <AlertLamp /> : null}
      </group>
    </group>
  );
}
