"use client";

import { memo, type ReactNode } from "react";
import {
  CANVAS_H,
  CANVAS_W,
  EAST_WING_ROOM_HEIGHT,
  EAST_WING_ROOM_TOP_Y,
  GYM_ROOM_WIDTH,
  GYM_ROOM_X,
  QA_LAB_WIDTH,
  QA_LAB_X,
  SCALE,
} from "@/features/retro-office/core/constants";
import {
  CITY_PATH_ZONE,
  LOCAL_OFFICE_CANVAS_HEIGHT,
  LOCAL_OFFICE_CANVAS_WIDTH,
  REMOTE_OFFICE_ZONE,
} from "@/features/retro-office/core/district";
import { toWorld } from "@/features/retro-office/core/geometry";

function FramedPicture({
  position,
  rotY = 0,
  w = 0.52,
  h = 0.38,
  frameColor = "#1c1008",
  bgColor = "#f0ece0",
  art,
}: {
  position: [number, number, number];
  rotY?: number;
  w?: number;
  h?: number;
  frameColor?: string;
  bgColor?: string;
  art: ReactNode;
}) {
  const frameDepth = 0.028;
  const inset = 0.038;
  const artZ = frameDepth / 2 + 0.007;

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[w, h, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={0.75}
          metalness={0.18}
        />
      </mesh>
      <mesh position={[0, 0, frameDepth / 2 + 0.003]}>
        <boxGeometry args={[w - inset * 2, h - inset * 2, 0.005]} />
        <meshStandardMaterial color={bgColor} roughness={0.95} metalness={0} />
      </mesh>
      <group position={[0, 0, artZ]}>{art}</group>
    </group>
  );
}

function UsaFlagArt() {
  const flagWidth = 0.52;
  const flagHeight = 0.3;
  const stripeHeight = flagHeight / 13;
  const cantonWidth = flagWidth * 0.4;
  const cantonHeight = stripeHeight * 7;

  return (
    <>
      {Array.from({ length: 13 }).map((_, index) => (
        <mesh
          key={`usa-stripe-${index}`}
          position={[0, flagHeight / 2 - stripeHeight / 2 - index * stripeHeight, 0]}
        >
          <planeGeometry args={[flagWidth, stripeHeight]} />
          <meshBasicMaterial
            color={index % 2 === 0 ? "#b22234" : "#ffffff"}
            side={2}
          />
        </mesh>
      ))}
      <mesh
        position={[
          -flagWidth / 2 + cantonWidth / 2,
          flagHeight / 2 - cantonHeight / 2,
          0.001,
        ]}
      >
        <planeGeometry args={[cantonWidth, cantonHeight]} />
        <meshBasicMaterial color="#3c3b6e" side={2} />
      </mesh>
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 6 }).map((__, column) => (
          <mesh
            key={`usa-star-${row}-${column}`}
            position={[
              -flagWidth / 2 + 0.04 + column * 0.025,
              flagHeight / 2 - 0.03 - row * 0.035,
              0.002,
            ]}
          >
            <circleGeometry args={[0.0045, 6]} />
            <meshBasicMaterial color="#ffffff" side={2} />
          </mesh>
        )),
      )}
    </>
  );
}

function BrazilFlagArt() {
  return (
    <>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.52, 0.3]} />
        <meshBasicMaterial color="#009b3a" side={2} />
      </mesh>
      <mesh position={[0, 0, 0.001]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.25, 0.25]} />
        <meshBasicMaterial color="#ffdf00" side={2} />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <circleGeometry args={[0.068, 28]} />
        <meshBasicMaterial color="#002776" side={2} />
      </mesh>
      <mesh position={[0, 0.004, 0.003]} rotation={[0, 0, -0.22]}>
        <planeGeometry args={[0.19, 0.026]} />
        <meshBasicMaterial color="#ffffff" side={2} />
      </mesh>
    </>
  );
}

function OfficeFlagPole({
  position,
  rotY = 0,
  art,
}: {
  position: [number, number, number];
  rotY?: number;
  art: ReactNode;
}) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.16, 18]} />
        <meshStandardMaterial color="#3a3229" roughness={0.94} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.024, 0.03, 2.48, 14]} />
        <meshStandardMaterial color="#c4c9d1" roughness={0.32} metalness={0.88} />
      </mesh>
      <mesh position={[0, 2.6, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#d4af37" roughness={0.28} metalness={0.92} />
      </mesh>
      <mesh position={[0.3, 2.34, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.62, 10]} />
        <meshStandardMaterial color="#c4c9d1" roughness={0.32} metalness={0.88} />
      </mesh>
      <group position={[0.42, 2.16, 0.02]} scale={[1.9, 1.9, 1.9]}>
        {art}
      </group>
    </group>
  );
}

const SOCCER_FIELD_WIDTH = 24.8;
const SOCCER_FIELD_DEPTH = 9.6;
const SOCCER_STADIUM_BASE_WIDTH = SOCCER_FIELD_WIDTH + 3.2;
const SOCCER_STADIUM_BASE_DEPTH = SOCCER_FIELD_DEPTH + 2.8;
const SOCCER_ENTRY_PATH_WIDTH = 2.1;
const SOCCER_ENTRY_OPENING_WIDTH = 3.8;
const SOCCER_TEAM_SHAPE = [
  { x: 0, z: -3.42, goalkeeper: true },
  { x: -8.2, z: -2.38, goalkeeper: false },
  { x: -2.85, z: -2.52, goalkeeper: false },
  { x: 2.85, z: -2.52, goalkeeper: false },
  { x: 8.2, z: -2.38, goalkeeper: false },
  { x: -9.2, z: -0.32, goalkeeper: false },
  { x: -3.45, z: -0.44, goalkeeper: false },
  { x: 3.45, z: -0.44, goalkeeper: false },
  { x: 9.2, z: -0.32, goalkeeper: false },
  { x: -3.7, z: 2.34, goalkeeper: false },
  { x: 3.7, z: 2.5, goalkeeper: false },
] as const;

function SoccerPlayer({
  position,
  teamColor,
  facing = 0,
  goalkeeper = false,
}: {
  position: [number, number, number];
  teamColor: string;
  facing?: number;
  goalkeeper?: boolean;
}) {
  const jerseyColor = goalkeeper ? "#f8fafc" : teamColor;
  const shortColor = goalkeeper ? teamColor : "#f8fafc";
  const sockColor = goalkeeper ? "#111827" : teamColor;
  return (
    <group position={position} rotation={[0, facing, 0]} scale={1.75}>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.12, 12]} />
        <meshBasicMaterial color="#000" transparent opacity={0.18} />
      </mesh>
      <group position={[-0.045, 0.1, 0]}>
        <mesh>
          <boxGeometry args={[0.07, 0.14, 0.08]} />
          <meshLambertMaterial color={sockColor} />
        </mesh>
        <mesh position={[0, -0.09, 0]}>
          <boxGeometry args={[0.07, 0.05, 0.12]} />
          <meshLambertMaterial color="#111827" />
        </mesh>
      </group>
      <group position={[0.045, 0.1, 0]}>
        <mesh>
          <boxGeometry args={[0.07, 0.14, 0.08]} />
          <meshLambertMaterial color={sockColor} />
        </mesh>
        <mesh position={[0, -0.09, 0]}>
          <boxGeometry args={[0.07, 0.05, 0.12]} />
          <meshLambertMaterial color="#111827" />
        </mesh>
      </group>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.18, 0.2, 0.1]} />
        <meshLambertMaterial color={jerseyColor} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <boxGeometry args={[0.1, 0.05, 0.08]} />
        <meshLambertMaterial color={goalkeeper ? teamColor : "#0f172a"} />
      </mesh>
      <group position={[-0.12, 0.28, 0]} rotation={[0, 0, 0.32]}>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[0.06, 0.16, 0.06]} />
          <meshLambertMaterial color={jerseyColor} />
        </mesh>
        <mesh position={[0, -0.17, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.05]} />
          <meshLambertMaterial color="#f1c7a6" />
        </mesh>
      </group>
      <group position={[0.12, 0.28, 0]} rotation={[0, 0, -0.32]}>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[0.06, 0.16, 0.06]} />
          <meshLambertMaterial color={jerseyColor} />
        </mesh>
        <mesh position={[0, -0.17, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.05]} />
          <meshLambertMaterial color="#f1c7a6" />
        </mesh>
      </group>
      <mesh position={[0, 0.52, 0.016]} castShadow>
        <sphereGeometry args={[0.082, 16, 16]} />
        <meshStandardMaterial color="#f1c7a6" roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.61, 0.05]}>
        <planeGeometry args={[0.09, 0.07]} />
        <meshBasicMaterial color={goalkeeper ? teamColor : "#f8fafc"} />
      </mesh>
      <mesh position={[0, 0.19, 0.055]}>
        <boxGeometry args={[0.21, 0.11, 0.05]} />
        <meshLambertMaterial color={shortColor} />
      </mesh>
      {goalkeeper ? (
        <mesh position={[0, 0.26, -0.09]} castShadow>
          <boxGeometry args={[0.32, 0.045, 0.09]} />
          <meshStandardMaterial color={teamColor} roughness={0.72} metalness={0.04} />
        </mesh>
      ) : null}
    </group>
  );
}

function GoalFrame({
  position,
  rotY = 0,
}: {
  position: [number, number, number];
  rotY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[-1.3, 0.72, 0]} castShadow>
        <boxGeometry args={[0.08, 1.24, 0.08]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} metalness={0.14} />
      </mesh>
      <mesh position={[1.3, 0.72, 0]} castShadow>
        <boxGeometry args={[0.08, 1.24, 0.08]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} metalness={0.14} />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[2.68, 0.08, 0.08]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} metalness={0.14} />
      </mesh>
      <mesh position={[0, 0.64, -0.92]} receiveShadow>
        <boxGeometry args={[2.52, 1.28, 0.03]} />
        <meshStandardMaterial color="#dbeafe" transparent opacity={0.24} roughness={0.95} />
      </mesh>
      <mesh position={[-1.24, 0.64, -0.46]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[0.94, 1.28, 0.03]} />
        <meshStandardMaterial color="#dbeafe" transparent opacity={0.18} roughness={0.95} />
      </mesh>
      <mesh position={[1.24, 0.64, -0.46]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[0.94, 1.28, 0.03]} />
        <meshStandardMaterial color="#dbeafe" transparent opacity={0.18} roughness={0.95} />
      </mesh>
    </group>
  );
}

export const FloorAndWalls = memo(function FloorAndWalls({
  showRemoteOffice = true,
}: {
  showRemoteOffice?: boolean;
}) {
  const districtWidth = CANVAS_W * SCALE;
  const districtHeight = CANVAS_H * SCALE;
  const localOfficeWidth = LOCAL_OFFICE_CANVAS_WIDTH * SCALE;
  const localOfficeHeight = LOCAL_OFFICE_CANVAS_HEIGHT * SCALE;
  const [districtCenterX, , districtCenterZ] = toWorld(CANVAS_W / 2, CANVAS_H / 2);
  const [localOfficeCenterX, , localOfficeCenterZ] = toWorld(
    LOCAL_OFFICE_CANVAS_WIDTH / 2,
    LOCAL_OFFICE_CANVAS_HEIGHT / 2,
  );
  const [gymZoneCenterX, , roomZoneCenterZ] = toWorld(
    GYM_ROOM_X + GYM_ROOM_WIDTH / 2,
    EAST_WING_ROOM_TOP_Y + EAST_WING_ROOM_HEIGHT / 2,
  );
  const [qaZoneCenterX] = toWorld(
    QA_LAB_X + QA_LAB_WIDTH / 2,
    EAST_WING_ROOM_TOP_Y + EAST_WING_ROOM_HEIGHT / 2,
  );
  const [pathCenterX, , pathCenterZ] = toWorld(
    (CITY_PATH_ZONE.minX + CITY_PATH_ZONE.maxX) / 2,
    (CITY_PATH_ZONE.minY + CITY_PATH_ZONE.maxY) / 2,
  );
  const [, , remoteOfficeCenterZ] = toWorld(
    (REMOTE_OFFICE_ZONE.minX + REMOTE_OFFICE_ZONE.maxX) / 2,
    (REMOTE_OFFICE_ZONE.minY + REMOTE_OFFICE_ZONE.maxY) / 2,
  );
  const gymZoneWidth = Math.max(0, GYM_ROOM_WIDTH * SCALE);
  const qaZoneWidth = Math.max(0, QA_LAB_WIDTH * SCALE);
  const roomZoneHeight = EAST_WING_ROOM_HEIGHT * SCALE;
  const roomFloorInset = 0.08;
  const roomZoneFloorHeight = Math.max(0, roomZoneHeight - roomFloorInset * 2);
  const gymZoneFloorWidth = Math.max(0, gymZoneWidth - roomFloorInset * 2);
  const qaZoneFloorWidth = Math.max(0, qaZoneWidth - roomFloorInset * 2);
  const qaZoneStripeHeight = roomZoneFloorHeight * 0.86;
  const qaZoneStripeWidth = qaZoneFloorWidth * 0.92;
  const remoteOfficeOffsetZ = remoteOfficeCenterZ - localOfficeCenterZ;
  const localNorthWallZ = localOfficeCenterZ - localOfficeHeight / 2;
  const localSouthWallZ = localOfficeCenterZ + localOfficeHeight / 2;
  const localWestWallX = localOfficeCenterX - localOfficeWidth / 2;
  const localEastWallX = localOfficeCenterX + localOfficeWidth / 2;
  const stadiumCenterX = localOfficeCenterX;
  const stadiumCenterZ = pathCenterZ;
  const stadiumNorthEdgeZ = stadiumCenterZ - SOCCER_FIELD_DEPTH / 2;
  const outdoorSouthEdgeZ = stadiumCenterZ + SOCCER_STADIUM_BASE_DEPTH / 2 + 0.92;
  const localGroundCenterZ = (localNorthWallZ + outdoorSouthEdgeZ) / 2;
  const localGroundHeight = outdoorSouthEdgeZ - localNorthWallZ;
  const southWallWingWidth = Math.max(
    0.8,
    (localOfficeWidth - SOCCER_ENTRY_OPENING_WIDTH) / 2,
  );
  const southWallWingOffsetX = SOCCER_ENTRY_OPENING_WIDTH / 2 + southWallWingWidth / 2;
  const pathEntryStartZ = localSouthWallZ + 0.14;
  const entryPathLength = Math.max(0.42, stadiumNorthEdgeZ - pathEntryStartZ);
  const entryPathCenterZ = pathEntryStartZ + entryPathLength / 2;
  const groundCenterX = showRemoteOffice ? districtCenterX : localOfficeCenterX;
  const groundCenterZ = showRemoteOffice ? districtCenterZ : localGroundCenterZ;
  const groundWidth = showRemoteOffice ? districtWidth : localOfficeWidth;
  const groundHeight = showRemoteOffice ? districtHeight : localGroundHeight;

  return (
    <group>
      <mesh
        position={[groundCenterX, -0.015, groundCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[groundWidth, groundHeight, 24, 14]} />
        <meshStandardMaterial color="#263238" roughness={0.98} metalness={0.02} />
      </mesh>

      <mesh
        position={[groundCenterX, -0.012, groundCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[groundWidth * 0.95, groundHeight * 0.9]} />
        <meshStandardMaterial color="#1b232a" roughness={0.96} metalness={0.04} />
      </mesh>

      <mesh
        position={[localOfficeCenterX, 0, localOfficeCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[localOfficeWidth, localOfficeHeight, 22, 14]} />
        <meshLambertMaterial color="#c8a97e" />
      </mesh>

      <mesh
        position={[pathCenterX, 0.002, pathCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry
          args={[
            (CITY_PATH_ZONE.maxX - CITY_PATH_ZONE.minX) * SCALE,
            (CITY_PATH_ZONE.maxY - CITY_PATH_ZONE.minY) * SCALE,
          ]}
        />
        <meshStandardMaterial color="#6d8b5a" roughness={0.96} metalness={0.02} />
      </mesh>

      <mesh
        position={[pathCenterX, 0.004, pathCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry
          args={[
            (CITY_PATH_ZONE.maxX - CITY_PATH_ZONE.minX) * SCALE * 0.72,
            (CITY_PATH_ZONE.maxY - CITY_PATH_ZONE.minY) * SCALE * 0.26,
          ]}
        />
        <meshStandardMaterial color="#c9ae8d" roughness={0.94} metalness={0.02} />
      </mesh>

      <mesh
        position={[localOfficeCenterX, 0.008, entryPathCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[SOCCER_ENTRY_PATH_WIDTH, entryPathLength]} />
        <meshStandardMaterial color="#d8c09f" roughness={0.93} metalness={0.03} />
      </mesh>

      <mesh
        position={[stadiumCenterX, 0.012, stadiumCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[SOCCER_STADIUM_BASE_WIDTH, SOCCER_STADIUM_BASE_DEPTH]} />
        <meshStandardMaterial color="#4b5563" roughness={0.84} metalness={0.1} />
      </mesh>

      <mesh
        position={[stadiumCenterX, 0.016, stadiumCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[SOCCER_FIELD_WIDTH, SOCCER_FIELD_DEPTH]} />
        <meshStandardMaterial color="#2f8f46" roughness={0.94} metalness={0.02} />
      </mesh>

      {Array.from({ length: 7 }).map((_, index) => {
        const stripeX =
          stadiumCenterX - SOCCER_FIELD_WIDTH / 2 + (index + 0.5) * (SOCCER_FIELD_WIDTH / 7);
        return (
          <mesh
            key={`soccer-stripe-${index}`}
            position={[stripeX, 0.017, stadiumCenterZ]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[SOCCER_FIELD_WIDTH / 7, SOCCER_FIELD_DEPTH]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#3c9b50" : "#2d8442"} />
          </mesh>
        );
      })}

      <mesh
        position={[stadiumCenterX, 0.018, stadiumCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[SOCCER_FIELD_WIDTH, 0.06]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      <mesh
        position={[stadiumCenterX, 0.018, stadiumCenterZ - SOCCER_FIELD_DEPTH / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[SOCCER_FIELD_WIDTH, 0.06]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      <mesh
        position={[stadiumCenterX, 0.018, stadiumCenterZ + SOCCER_FIELD_DEPTH / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[SOCCER_FIELD_WIDTH, 0.06]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      <mesh
        position={[stadiumCenterX - SOCCER_FIELD_WIDTH / 2, 0.018, stadiumCenterZ]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
      >
        <planeGeometry args={[SOCCER_FIELD_DEPTH, 0.06]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      <mesh
        position={[stadiumCenterX + SOCCER_FIELD_WIDTH / 2, 0.018, stadiumCenterZ]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
      >
        <planeGeometry args={[SOCCER_FIELD_DEPTH, 0.06]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[stadiumCenterX, 0.019, stadiumCenterZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.54, 0.61, 32]} />
        <meshBasicMaterial color="#f8fafc" side={2} />
      </mesh>
      <mesh position={[stadiumCenterX, 0.019, stadiumCenterZ]}>
        <circleGeometry args={[0.06, 14]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      {[-1, 1].map((direction) => {
        const boxZ = stadiumCenterZ + direction * (SOCCER_FIELD_DEPTH / 2 - 0.42);
        const smallBoxZ = stadiumCenterZ + direction * (SOCCER_FIELD_DEPTH / 2 - 0.2);
        return (
          <group key={`soccer-boxes-${direction}`}>
            <mesh position={[stadiumCenterX, 0.019, boxZ]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.74, 0.8, 4, 1, -Math.PI / 4, Math.PI / 2]} />
              <meshBasicMaterial color="#f8fafc" side={2} />
            </mesh>
            <mesh position={[stadiumCenterX, 0.018, boxZ]}>
              <planeGeometry args={[4.2, 0.06]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[stadiumCenterX - 2.1, 0.018, boxZ - direction * 0.37]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.78, 0.06]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[stadiumCenterX + 2.1, 0.018, boxZ - direction * 0.37]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.78, 0.06]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[stadiumCenterX, 0.018, smallBoxZ]}>
              <planeGeometry args={[1.9, 0.06]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[stadiumCenterX - 0.95, 0.018, smallBoxZ - direction * 0.18]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.42, 0.06]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[stadiumCenterX + 0.95, 0.018, smallBoxZ - direction * 0.18]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.42, 0.06]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
          </group>
        );
      })}

      <GoalFrame position={[stadiumCenterX, 0.02, stadiumCenterZ - SOCCER_FIELD_DEPTH / 2 + 0.12]} />
      <GoalFrame
        position={[stadiumCenterX, 0.02, stadiumCenterZ + SOCCER_FIELD_DEPTH / 2 - 0.12]}
        rotY={Math.PI}
      />

      {SOCCER_TEAM_SHAPE.map((player, index) => (
        <SoccerPlayer
          key={`blue-player-${index}`}
          position={[stadiumCenterX + player.x, 0.24, stadiumCenterZ + player.z]}
          teamColor="#2563eb"
          facing={0}
          goalkeeper={player.goalkeeper}
        />
      ))}
      {SOCCER_TEAM_SHAPE.map((player, index) => (
        <SoccerPlayer
          key={`red-player-${index}`}
          position={[stadiumCenterX + player.x, 0.24, stadiumCenterZ - player.z]}
          teamColor="#dc2626"
          facing={Math.PI}
          goalkeeper={player.goalkeeper}
        />
      ))}

      <mesh position={[stadiumCenterX + 0.28, 0.08, stadiumCenterZ + 0.04]} castShadow receiveShadow>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.46} metalness={0.05} />
      </mesh>
      <mesh position={[stadiumCenterX + 0.28, 0.08, stadiumCenterZ + 0.04]}>
        <torusGeometry args={[0.052, 0.008, 8, 10]} />
        <meshStandardMaterial color="#111827" roughness={0.65} metalness={0.04} />
      </mesh>

      {[-1, 1].map((direction) => (
        <group key={`stadium-stands-${direction}`}>
          {[0, 1, 2].map((tier) => (
            <mesh
              key={`stand-${direction}-${tier}`}
              position={[
                stadiumCenterX,
                0.17 + tier * 0.09,
                stadiumCenterZ + direction * (SOCCER_FIELD_DEPTH / 2 + 0.42 + tier * 0.16),
              ]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[SOCCER_FIELD_WIDTH - tier * 1.15, 0.08, 0.28]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.82} metalness={0.12} />
            </mesh>
          ))}
        </group>
      ))}

      {[-1, 1].flatMap((zDirection) =>
        [-1, 1].map((xDirection) => {
          const lightX = stadiumCenterX + xDirection * (SOCCER_FIELD_WIDTH / 2 + 0.92);
          const lightZ = stadiumCenterZ + zDirection * (SOCCER_FIELD_DEPTH / 2 + 0.64);
          return (
            <group key={`soccer-light-${zDirection}-${xDirection}`} position={[lightX, 0, lightZ]}>
              <mesh position={[0, 0.92, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.06, 1.84, 12]} />
                <meshStandardMaterial color="#d1d5db" roughness={0.54} metalness={0.52} />
              </mesh>
              <mesh position={[0, 1.92, zDirection * -0.05]} castShadow>
                <boxGeometry args={[0.42, 0.16, 0.12]} />
                <meshStandardMaterial
                  color="#fef3c7"
                  emissive="#fde68a"
                  emissiveIntensity={0.58}
                  roughness={0.36}
                  metalness={0.22}
                />
              </mesh>
            </group>
          );
        }),
      )}

      <group position={[stadiumCenterX + SOCCER_FIELD_WIDTH / 2 + 1.28, 0, stadiumCenterZ]}>
        <mesh position={[0, 1.02, 0]} castShadow>
          <boxGeometry args={[0.22, 2.04, 0.22]} />
          <meshStandardMaterial color="#475569" roughness={0.74} metalness={0.18} />
        </mesh>
        <mesh position={[0, 2.24, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.42, 0.82, 0.18]} />
          <meshStandardMaterial color="#111827" roughness={0.58} metalness={0.22} />
        </mesh>
        <mesh position={[0, 2.4, 0.1]}>
          <planeGeometry args={[1.1, 0.42]} />
          <meshBasicMaterial color="#93c5fd" />
        </mesh>
        <mesh position={[0, 2.12, 0.1]}>
          <planeGeometry args={[1.1, 0.18]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      {showRemoteOffice ? (
        <>
          <mesh
            position={[localOfficeCenterX, 0, localOfficeCenterZ + remoteOfficeOffsetZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[localOfficeWidth, localOfficeHeight, 22, 14]} />
            <meshLambertMaterial color="#c8a97e" />
          </mesh>

          {Array.from({ length: 8 }).map((_, index) => {
            const [wx, , wz] = toWorld(330 + index * 170, 820 + (index % 2 === 0 ? -44 : 44));
            return (
              <mesh key={`garden-bed-${index}`} position={[wx, 0.03, wz]} castShadow receiveShadow>
                <boxGeometry args={[0.58, 0.06, 0.18]} />
                <meshStandardMaterial color="#5d4037" roughness={0.84} metalness={0.06} />
              </mesh>
            );
          })}

          {Array.from({ length: 8 }).map((_, index) => {
            const [wx, , wz] = toWorld(330 + index * 170, 820 + (index % 2 === 0 ? -44 : 44));
            return (
              <mesh key={`garden-bed-top-${index}`} position={[wx, 0.09, wz]}>
                <boxGeometry args={[0.48, 0.05, 0.12]} />
                <meshStandardMaterial color="#7cb342" roughness={0.98} metalness={0} />
              </mesh>
            );
          })}

          {Array.from({ length: 6 }).map((_, index) => {
            const [wx, , wz] = toWorld(420 + index * 190, 900);
            return (
              <group key={`garden-light-${index}`} position={[wx, 0, wz]}>
                <mesh position={[0, 0.2, 0]} castShadow>
                  <cylinderGeometry args={[0.025, 0.025, 0.4, 10]} />
                  <meshStandardMaterial color="#d7ccc8" roughness={0.62} metalness={0.24} />
                </mesh>
                <mesh position={[0, 0.43, 0]}>
                  <sphereGeometry args={[0.05, 12, 12]} />
                  <meshStandardMaterial color="#fff3cd" emissive="#fff3cd" emissiveIntensity={0.55} />
                </mesh>
              </group>
            );
          })}

          {Array.from({ length: 8 }).map((_, index) => {
            const [wx, , wz] = toWorld(220 + index * 190, 1005);
            return (
              <mesh
                key={`city-light-${index}`}
                position={[wx, 0.18, wz]}
                castShadow
                receiveShadow
              >
                <cylinderGeometry args={[0.04, 0.04, 0.36, 10]} />
                <meshStandardMaterial color="#d7ccc8" roughness={0.6} metalness={0.35} />
              </mesh>
            );
          })}

          {Array.from({ length: 4 }).map((_, index) => {
            const [wx, , wz] = toWorld(250 + index * 430, 955);
            return (
              <mesh key={`city-planter-${index}`} position={[wx, 0.08, wz]} castShadow>
                <boxGeometry args={[0.46, 0.14, 0.26]} />
                <meshStandardMaterial color="#5d4037" roughness={0.86} metalness={0.08} />
              </mesh>
            );
          })}

          {Array.from({ length: 4 }).map((_, index) => {
            const [wx, , wz] = toWorld(250 + index * 430, 955);
            return (
              <mesh key={`city-planter-top-${index}`} position={[wx, 0.18, wz]}>
                <boxGeometry args={[0.38, 0.08, 0.18]} />
                <meshStandardMaterial color="#43a047" roughness={0.98} metalness={0} />
              </mesh>
            );
          })}
        </>
      ) : null}

      {gymZoneFloorWidth > 0 && roomZoneFloorHeight > 0 ? (
        <>
          <mesh
            position={[gymZoneCenterX, 0.002, roomZoneCenterZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[gymZoneFloorWidth, roomZoneFloorHeight]} />
            <meshStandardMaterial
              color="#24272d"
              roughness={0.95}
              metalness={0.05}
            />
          </mesh>
          {showRemoteOffice ? (
            <mesh
              position={[gymZoneCenterX, 0.002, roomZoneCenterZ + remoteOfficeOffsetZ]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[gymZoneFloorWidth, roomZoneFloorHeight]} />
              <meshStandardMaterial
                color="#24272d"
                roughness={0.95}
                metalness={0.05}
              />
            </mesh>
          ) : null}
        </>
      ) : null}

      {qaZoneFloorWidth > 0 && roomZoneFloorHeight > 0 ? (
        <>
          <mesh
            position={[qaZoneCenterX, 0.003, roomZoneCenterZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[qaZoneFloorWidth, roomZoneFloorHeight]} />
            <meshStandardMaterial
              color="#12091d"
              roughness={0.92}
              metalness={0.08}
            />
          </mesh>
          {showRemoteOffice ? (
            <mesh
              position={[qaZoneCenterX, 0.003, roomZoneCenterZ + remoteOfficeOffsetZ]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[qaZoneFloorWidth, roomZoneFloorHeight]} />
              <meshStandardMaterial
                color="#12091d"
                roughness={0.92}
                metalness={0.08}
              />
            </mesh>
          ) : null}
          <mesh
            position={[qaZoneCenterX, 0.004, roomZoneCenterZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[qaZoneFloorWidth * 0.96, roomZoneFloorHeight * 0.88]} />
            <meshStandardMaterial
              color="#170d28"
              roughness={0.86}
              metalness={0.12}
            />
          </mesh>
          {showRemoteOffice ? (
            <mesh
              position={[qaZoneCenterX, 0.004, roomZoneCenterZ + remoteOfficeOffsetZ]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[qaZoneFloorWidth * 0.96, roomZoneFloorHeight * 0.88]} />
              <meshStandardMaterial
                color="#170d28"
                roughness={0.86}
                metalness={0.12}
              />
            </mesh>
          ) : null}
          {Array.from({ length: 7 }).map((_, index) => {
            const offsetX =
              qaZoneCenterX - qaZoneFloorWidth * 0.38 + index * (qaZoneFloorWidth / 7);
            return (
              <group key={`qa-vertical-group-${index}`}>
                <mesh
                  key={`qa-vertical-local-${index}`}
                  position={[offsetX, 0.006, roomZoneCenterZ]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <planeGeometry args={[0.015, qaZoneStripeHeight]} />
                  <meshBasicMaterial color="#7c3aed" transparent opacity={0.34} />
                </mesh>
                {showRemoteOffice ? (
                  <mesh
                    key={`qa-vertical-remote-${index}`}
                    position={[offsetX, 0.006, roomZoneCenterZ + remoteOfficeOffsetZ]}
                    rotation={[-Math.PI / 2, 0, 0]}
                  >
                    <planeGeometry args={[0.015, qaZoneStripeHeight]} />
                    <meshBasicMaterial color="#7c3aed" transparent opacity={0.34} />
                  </mesh>
                ) : null}
              </group>
            );
          })}
          {Array.from({ length: 12 }).map((_, index) => {
            const z =
              roomZoneCenterZ -
              qaZoneStripeHeight / 2 +
              index * (qaZoneStripeHeight / 11);
            return (
              <group key={`qa-horizontal-group-${index}`}>
                <mesh
                  key={`qa-horizontal-local-${index}`}
                  position={[qaZoneCenterX, 0.006, z]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <planeGeometry args={[qaZoneStripeWidth, 0.012]} />
                  <meshBasicMaterial
                    color="#38bdf8"
                    transparent
                    opacity={index % 3 === 0 ? 0.28 : 0.12}
                  />
                </mesh>
                {showRemoteOffice ? (
                  <mesh
                    key={`qa-horizontal-remote-${index}`}
                    position={[qaZoneCenterX, 0.006, z + remoteOfficeOffsetZ]}
                    rotation={[-Math.PI / 2, 0, 0]}
                  >
                    <planeGeometry args={[qaZoneStripeWidth, 0.012]} />
                    <meshBasicMaterial
                      color="#38bdf8"
                      transparent
                      opacity={index % 3 === 0 ? 0.28 : 0.12}
                    />
                  </mesh>
                ) : null}
              </group>
            );
          })}
        </>
      ) : null}

      {Array.from({ length: 18 }).map((_, index) => {
        const z =
          localOfficeCenterZ - localOfficeHeight / 2 + (index + 1) * (localOfficeHeight / 18);
        return (
          <group key={`floor-line-group-${index}`}>
            <mesh
              position={[localOfficeCenterX, 0.001, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[localOfficeWidth, 0.008]} />
              <meshBasicMaterial color="#a07850" transparent opacity={0.25} />
            </mesh>
            {showRemoteOffice ? (
              <mesh
                position={[localOfficeCenterX, 0.001, z + remoteOfficeOffsetZ]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[localOfficeWidth, 0.008]} />
                <meshBasicMaterial color="#a07850" transparent opacity={0.25} />
              </mesh>
            ) : null}
          </group>
        );
      })}

      {(() => {
        const wallColor = "#8d6e63";
        const wallEmissive = "#4e342e";

        return (
          <>
            <mesh position={[localOfficeCenterX, 0.5, localNorthWallZ]} receiveShadow>
              <boxGeometry args={[localOfficeWidth, 1, 0.12]} />
              <meshStandardMaterial
                color={wallColor}
                emissive={wallEmissive}
                emissiveIntensity={0.4}
                roughness={0.9}
              />
            </mesh>
            {showRemoteOffice ? (
              <mesh
                position={[localOfficeCenterX, 0.5, localNorthWallZ + remoteOfficeOffsetZ]}
                receiveShadow
              >
                <boxGeometry args={[localOfficeWidth, 1, 0.12]} />
                <meshStandardMaterial
                  color={wallColor}
                  emissive={wallEmissive}
                  emissiveIntensity={0.4}
                  roughness={0.9}
                />
              </mesh>
            ) : null}
            {([-1, 1] as const).map((direction) => (
              <mesh
                key={`local-south-wall-${direction}`}
                position={[
                  localOfficeCenterX + direction * southWallWingOffsetX,
                  0.5,
                  localSouthWallZ,
                ]}
                receiveShadow
              >
                <boxGeometry args={[southWallWingWidth, 1, 0.12]} />
                <meshStandardMaterial
                  color={wallColor}
                  emissive={wallEmissive}
                  emissiveIntensity={0.4}
                  roughness={0.9}
                />
              </mesh>
            ))}
            {showRemoteOffice ? (
              <mesh
                position={[localOfficeCenterX, 0.5, localSouthWallZ + remoteOfficeOffsetZ]}
                receiveShadow
              >
                <boxGeometry args={[localOfficeWidth, 1, 0.12]} />
                <meshStandardMaterial
                  color={wallColor}
                  emissive={wallEmissive}
                  emissiveIntensity={0.4}
                  roughness={0.9}
                />
              </mesh>
            ) : null}
            <mesh position={[localWestWallX, 0.5, localOfficeCenterZ]} receiveShadow>
              <boxGeometry args={[0.12, 1, localOfficeHeight]} />
              <meshStandardMaterial
                color={wallColor}
                emissive={wallEmissive}
                emissiveIntensity={0.4}
                roughness={0.9}
              />
            </mesh>
            {showRemoteOffice ? (
              <mesh
                position={[localWestWallX, 0.5, localOfficeCenterZ + remoteOfficeOffsetZ]}
                receiveShadow
              >
                <boxGeometry args={[0.12, 1, localOfficeHeight]} />
                <meshStandardMaterial
                  color={wallColor}
                  emissive={wallEmissive}
                  emissiveIntensity={0.4}
                  roughness={0.9}
                />
              </mesh>
            ) : null}
            <mesh position={[localEastWallX, 0.5, localOfficeCenterZ]} receiveShadow>
              <boxGeometry args={[0.12, 1, localOfficeHeight]} />
              <meshStandardMaterial
                color={wallColor}
                emissive={wallEmissive}
                emissiveIntensity={0.4}
                roughness={0.9}
              />
            </mesh>
            {showRemoteOffice ? (
              <mesh
                position={[localEastWallX, 0.5, localOfficeCenterZ + remoteOfficeOffsetZ]}
                receiveShadow
              >
                <boxGeometry args={[0.12, 1, localOfficeHeight]} />
                <meshStandardMaterial
                  color={wallColor}
                  emissive={wallEmissive}
                  emissiveIntensity={0.4}
                  roughness={0.9}
                />
              </mesh>
            ) : null}
          </>
        );
      })()}

      <mesh position={[localOfficeCenterX, 0.03, localNorthWallZ + 0.04]}>
        <boxGeometry args={[localOfficeWidth, 0.06, 0.04]} />
        <meshLambertMaterial color="#0c0c10" />
      </mesh>
      {showRemoteOffice ? (
        <mesh position={[localOfficeCenterX, 0.03, localNorthWallZ + 0.04 + remoteOfficeOffsetZ]}>
          <boxGeometry args={[localOfficeWidth, 0.06, 0.04]} />
          <meshLambertMaterial color="#0c0c10" />
        </mesh>
      ) : null}
      {([-1, 1] as const).map((direction) => (
        <mesh
          key={`local-south-trim-${direction}`}
          position={[
            localOfficeCenterX + direction * southWallWingOffsetX,
            0.03,
            localSouthWallZ - 0.04,
          ]}
        >
          <boxGeometry args={[southWallWingWidth, 0.06, 0.04]} />
          <meshLambertMaterial color="#0c0c10" />
        </mesh>
      ))}
      {showRemoteOffice ? (
        <mesh position={[localOfficeCenterX, 0.03, localSouthWallZ - 0.04 + remoteOfficeOffsetZ]}>
          <boxGeometry args={[localOfficeWidth, 0.06, 0.04]} />
          <meshLambertMaterial color="#0c0c10" />
        </mesh>
      ) : null}
      <mesh position={[localWestWallX + 0.04, 0.03, localOfficeCenterZ]}>
        <boxGeometry args={[0.04, 0.06, localOfficeHeight]} />
        <meshLambertMaterial color="#0c0c10" />
      </mesh>
      {showRemoteOffice ? (
        <mesh position={[localWestWallX + 0.04, 0.03, localOfficeCenterZ + remoteOfficeOffsetZ]}>
          <boxGeometry args={[0.04, 0.06, localOfficeHeight]} />
          <meshLambertMaterial color="#0c0c10" />
        </mesh>
      ) : null}
      <mesh position={[localEastWallX - 0.04, 0.03, localOfficeCenterZ]}>
        <boxGeometry args={[0.04, 0.06, localOfficeHeight]} />
        <meshLambertMaterial color="#0c0c10" />
      </mesh>
      {showRemoteOffice ? (
        <mesh position={[localEastWallX - 0.04, 0.03, localOfficeCenterZ + remoteOfficeOffsetZ]}>
          <boxGeometry args={[0.04, 0.06, localOfficeHeight]} />
          <meshLambertMaterial color="#0c0c10" />
        </mesh>
      ) : null}
    </group>
  );
});

export const WallPictures = memo(function WallPictures({
  showRemoteOffice = true,
}: {
  showRemoteOffice?: boolean;
}) {
  const localWidth = LOCAL_OFFICE_CANVAS_WIDTH * SCALE;
  const localHeight = LOCAL_OFFICE_CANVAS_HEIGHT * SCALE;
  const [localCenterX, , localCenterZ] = toWorld(
    LOCAL_OFFICE_CANVAS_WIDTH / 2,
    LOCAL_OFFICE_CANVAS_HEIGHT / 2,
  );
  const northZ = localCenterZ - localHeight / 2 + 0.07;
  const southZ = localCenterZ + localHeight / 2 - 0.07;
  const westX = localCenterX - localWidth / 2 + 0.07;
  const eastX = localCenterX + localWidth / 2 - 0.07;
  const pictureY = 0.64;
  const [localFlagPoleX, , localFlagPoleZ] = toWorld(
    180,
    LOCAL_OFFICE_CANVAS_HEIGHT - 110,
  );
  const [remoteFlagPoleX, , remoteFlagPoleZ] = toWorld(
    180,
    REMOTE_OFFICE_ZONE.maxY - 110,
  );
  const localFlagPolePosition: [number, number, number] = [localFlagPoleX, 0, localFlagPoleZ];
  const remoteFlagPolePosition: [number, number, number] = [
    remoteFlagPoleX,
    0,
    remoteFlagPoleZ,
  ];

  return (
    <group>
      <OfficeFlagPole
        position={localFlagPolePosition}
        rotY={0.32}
        art={<UsaFlagArt />}
      />
      {showRemoteOffice ? (
        <OfficeFlagPole
          position={remoteFlagPolePosition}
          rotY={0.32}
          art={<BrazilFlagArt />}
        />
      ) : null}

      <FramedPicture
        position={[localCenterX - 7.5, pictureY, northZ]}
        rotY={0}
        w={0.58}
        h={0.42}
        frameColor="#1a0e06"
        bgColor="#f8f4ec"
        art={
          <>
            <mesh position={[-0.12, 0.07, 0]}>
              <planeGeometry args={[0.22, 0.14]} />
              <meshBasicMaterial color="#c0392b" />
            </mesh>
            <mesh position={[0.09, 0.07, 0]}>
              <planeGeometry args={[0.18, 0.14]} />
              <meshBasicMaterial color="#2980b9" />
            </mesh>
            <mesh position={[0.04, -0.07, 0]}>
              <planeGeometry args={[0.26, 0.12]} />
              <meshBasicMaterial color="#f39c12" />
            </mesh>
            <mesh position={[0, 0, 0.001]}>
              <planeGeometry args={[0.006, 0.3]} />
              <meshBasicMaterial color="#1c1008" />
            </mesh>
            <mesh position={[0, 0.01, 0.001]}>
              <planeGeometry args={[0.4, 0.006]} />
              <meshBasicMaterial color="#1c1008" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[localCenterX - 1.5, pictureY, northZ]}
        rotY={0}
        w={0.64}
        h={0.4}
        frameColor="#2a1a0a"
        bgColor="#a8d8f0"
        art={
          <>
            <mesh position={[0, 0.08, 0]}>
              <planeGeometry args={[0.56, 0.1]} />
              <meshBasicMaterial color="#6ab8e8" />
            </mesh>
            <mesh position={[0.18, 0.09, 0.001]}>
              <circleGeometry args={[0.038, 12]} />
              <meshBasicMaterial color="#f8d060" />
            </mesh>
            <mesh position={[0, 0, 0.001]}>
              <planeGeometry args={[0.56, 0.1]} />
              <meshBasicMaterial color="#7ab870" />
            </mesh>
            <mesh position={[-0.12, -0.04, 0.002]}>
              <planeGeometry args={[0.28, 0.1]} />
              <meshBasicMaterial color="#5a9a58" />
            </mesh>
            <mesh position={[0, -0.1, 0.001]}>
              <planeGeometry args={[0.56, 0.08]} />
              <meshBasicMaterial color="#8b6348" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[localCenterX + 4, pictureY, northZ]}
        rotY={0}
        w={0.5}
        h={0.42}
        frameColor="#1a0e06"
        bgColor="#f0d090"
        art={
          <>
            <mesh position={[0, 0.07, 0]}>
              <planeGeometry args={[0.4, 0.12]} />
              <meshBasicMaterial color="#e07820" />
            </mesh>
            <mesh position={[0, -0.02, 0]}>
              <planeGeometry args={[0.4, 0.09]} />
              <meshBasicMaterial color="#c0403a" />
            </mesh>
            <mesh position={[0, -0.1, 0]}>
              <planeGeometry args={[0.4, 0.08]} />
              <meshBasicMaterial color="#4a2870" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[localCenterX + 8.5, pictureY, northZ]}
        rotY={0}
        w={0.55}
        h={0.38}
        frameColor="#262626"
        bgColor="#101820"
        art={
          <>
            {([-0.11, -0.05, 0.01, 0.07, 0.12] as const).map((y, index) => (
              <mesh
                key={index}
                position={[index % 2 === 0 ? -0.04 : 0.02, y, 0]}
              >
                <planeGeometry args={[0.22 + (index % 3) * 0.07, 0.012]} />
                <meshBasicMaterial
                  color={
                    ["#22d3ee", "#a78bfa", "#4ade80", "#f472b6", "#fb923c"][
                      index
                    ]
                  }
                />
              </mesh>
            ))}
            <mesh position={[0.17, 0.12, 0]}>
              <circleGeometry args={[0.018, 10]} />
              <meshBasicMaterial color="#22d3ee" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[localCenterX - 5.5, pictureY, southZ]}
        rotY={Math.PI}
        w={0.6}
        h={0.4}
        frameColor="#1c1008"
        bgColor="#e8e0f0"
        art={
          <>
            <mesh position={[-0.14, 0.06, 0]}>
              <planeGeometry args={[0.2, 0.22]} />
              <meshBasicMaterial color="#7b68ee" />
            </mesh>
            <mesh position={[0.06, 0.04, 0]}>
              <planeGeometry args={[0.26, 0.18]} />
              <meshBasicMaterial color="#20b2aa" />
            </mesh>
            <mesh position={[-0.05, -0.1, 0]}>
              <planeGeometry args={[0.32, 0.1]} />
              <meshBasicMaterial color="#ff7f50" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[localCenterX, pictureY, southZ]}
        rotY={Math.PI}
        w={0.5}
        h={0.36}
        frameColor="#0a0a12"
        bgColor="#0a0a12"
        art={
          <>
            {([0, 1, 2, 3, 4, 5] as const).map((index) => (
              <mesh key={index} position={[-0.17 + index * 0.068, 0, 0]}>
                <planeGeometry args={[0.052, 0.26]} />
                <meshBasicMaterial
                  color={
                    [
                      "#ef4444",
                      "#f97316",
                      "#eab308",
                      "#22c55e",
                      "#3b82f6",
                      "#a855f7",
                    ][index]
                  }
                />
              </mesh>
            ))}
          </>
        }
      />

      <FramedPicture
        position={[localCenterX + 5.5, pictureY, southZ]}
        rotY={Math.PI}
        w={0.46}
        h={0.42}
        frameColor="#2a2008"
        bgColor="#d4c8a8"
        art={
          <>
            <mesh position={[0, 0.02, 0]}>
              <boxGeometry args={[0.1, 0.14, 0.001]} />
              <meshBasicMaterial color="#2a1a0a" />
            </mesh>
            <mesh position={[0, 0.13, 0]}>
              <circleGeometry args={[0.04, 14]} />
              <meshBasicMaterial color="#2a1a0a" />
            </mesh>
            <mesh position={[-0.03, -0.09, 0]}>
              <boxGeometry args={[0.035, 0.1, 0.001]} />
              <meshBasicMaterial color="#2a1a0a" />
            </mesh>
            <mesh position={[0.03, -0.09, 0]}>
              <boxGeometry args={[0.035, 0.1, 0.001]} />
              <meshBasicMaterial color="#2a1a0a" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[westX, pictureY, localCenterZ - 3.5]}
        rotY={-Math.PI / 2}
        w={0.52}
        h={0.4}
        frameColor="#1c1008"
        bgColor="#f0c840"
        art={
          <>
            {([0, Math.PI / 3, -Math.PI / 3] as const).map(
              (rotation, index) => (
                <mesh
                  key={index}
                  position={[0, 0, 0]}
                  rotation={[0, 0, rotation]}
                >
                  <boxGeometry args={[0.08, 0.28, 0.001]} />
                  <meshBasicMaterial color="#c84020" />
                </mesh>
              ),
            )}
          </>
        }
      />

      <FramedPicture
        position={[westX, pictureY, localCenterZ + 2.5]}
        rotY={-Math.PI / 2}
        w={0.58}
        h={0.44}
        frameColor="#102040"
        bgColor="#1a3a6a"
        art={
          <>
            {([-0.14, -0.07, 0, 0.07, 0.14] as const).map((x, index) => (
              <mesh key={`bv${index}`} position={[x, 0, 0]}>
                <planeGeometry args={[0.004, 0.34]} />
                <meshBasicMaterial color="#4080c0" transparent opacity={0.5} />
              </mesh>
            ))}
            {([-0.12, -0.06, 0, 0.06, 0.12] as const).map((y, index) => (
              <mesh key={`bh${index}`} position={[0, y, 0]}>
                <planeGeometry args={[0.42, 0.004]} />
                <meshBasicMaterial color="#4080c0" transparent opacity={0.5} />
              </mesh>
            ))}
            <mesh position={[-0.05, 0.04, 0.001]}>
              <planeGeometry args={[0.16, 0.12]} />
              <meshBasicMaterial color="#4080c0" transparent opacity={0.3} />
            </mesh>
            <mesh position={[0.1, -0.05, 0.001]}>
              <planeGeometry args={[0.12, 0.1]} />
              <meshBasicMaterial color="#4080c0" transparent opacity={0.3} />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[eastX, pictureY, localCenterZ - 2.5]}
        rotY={Math.PI / 2}
        w={0.56}
        h={0.42}
        frameColor="#1c1008"
        bgColor="#1a2840"
        art={
          <>
            {([0.12, 0.04, -0.04, -0.12] as const).map((y, index) => (
              <mesh key={index} position={[0, y, 0]}>
                <planeGeometry args={[0.44, 0.03 + index * 0.008]} />
                <meshBasicMaterial
                  color={["#60a0f8", "#4080d8", "#3060b8", "#205090"][index]}
                />
              </mesh>
            ))}
          </>
        }
      />

      <FramedPicture
        position={[eastX, pictureY, localCenterZ + 3.5]}
        rotY={Math.PI / 2}
        w={0.48}
        h={0.44}
        frameColor="#2a1a0a"
        bgColor="#f8f4e8"
        art={
          <>
            <mesh position={[0, -0.06, 0]}>
              <boxGeometry args={[0.018, 0.18, 0.001]} />
              <meshBasicMaterial color="#3a6a2a" />
            </mesh>
            <mesh position={[-0.07, 0.04, 0.001]} rotation={[0, 0, 0.4]}>
              <boxGeometry args={[0.12, 0.06, 0.001]} />
              <meshBasicMaterial color="#4a8a38" />
            </mesh>
            <mesh position={[0.07, 0.02, 0.001]} rotation={[0, 0, -0.4]}>
              <boxGeometry args={[0.12, 0.06, 0.001]} />
              <meshBasicMaterial color="#5aa042" />
            </mesh>
            <mesh position={[0, 0.1, 0.001]}>
              <boxGeometry args={[0.08, 0.1, 0.001]} />
              <meshBasicMaterial color="#48904a" />
            </mesh>
            <mesh position={[0, -0.14, 0.001]}>
              <boxGeometry args={[0.1, 0.05, 0.001]} />
              <meshBasicMaterial color="#b86040" />
            </mesh>
          </>
        }
      />

      {null}
    </group>
  );
});
