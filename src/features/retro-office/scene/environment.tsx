"use client";

import type { ReactNode } from "react";
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

function RemoteOfficePreview({
  centerX,
  centerZ,
  width,
  height,
  frameHeight,
  wallThickness,
}: {
  centerX: number;
  centerZ: number;
  width: number;
  height: number;
  frameHeight: number;
  wallThickness: number;
}) {
  const shellWidth = width * 0.88;
  const shellHeight = height * 0.86;
  const deskColumns = [-0.24, 0.02, 0.28] as const;
  const deskRows = [-0.22, 0.02] as const;

  return (
    <group>
      <mesh
        position={[centerX, -0.01, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width * 1.08, height * 1.08]} />
        <meshStandardMaterial color="#37474f" roughness={0.96} metalness={0.05} />
      </mesh>

      <mesh
        position={[centerX, 0.001, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#dde7ec" roughness={0.88} metalness={0.04} />
      </mesh>

      <mesh
        position={[centerX, 0.002, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width * 0.84, height * 0.72]} />
        <meshStandardMaterial color="#f6fbff" roughness={0.82} metalness={0.02} />
      </mesh>

      <mesh position={[centerX, frameHeight, centerZ]} castShadow>
        <boxGeometry args={[shellWidth, 0.08, shellHeight]} />
        <meshStandardMaterial color="#8ec5ff" transparent opacity={0.22} />
      </mesh>

      <mesh
        position={[centerX, frameHeight / 2, centerZ - shellHeight / 2]}
        castShadow
      >
        <boxGeometry args={[shellWidth, frameHeight, wallThickness]} />
        <meshStandardMaterial color="#b3e5fc" transparent opacity={0.3} />
      </mesh>

      <mesh
        position={[centerX - shellWidth * 0.25, frameHeight / 2, centerZ + shellHeight / 2]}
        castShadow
      >
        <boxGeometry args={[shellWidth * 0.34, frameHeight, wallThickness]} />
        <meshStandardMaterial color="#b3e5fc" transparent opacity={0.3} />
      </mesh>

      <mesh
        position={[centerX + shellWidth * 0.25, frameHeight / 2, centerZ + shellHeight / 2]}
        castShadow
      >
        <boxGeometry args={[shellWidth * 0.34, frameHeight, wallThickness]} />
        <meshStandardMaterial color="#b3e5fc" transparent opacity={0.3} />
      </mesh>

      {([-1, 1] as const).map((side) => (
        <mesh
          key={`remote-side-wall-${side}`}
          position={[centerX + side * (shellWidth / 2), frameHeight / 2, centerZ]}
          castShadow
        >
          <boxGeometry args={[wallThickness, frameHeight, shellHeight]} />
          <meshStandardMaterial color="#b3e5fc" transparent opacity={0.3} />
        </mesh>
      ))}

      <mesh
        position={[centerX, frameHeight / 2, centerZ - shellHeight * 0.08]}
        castShadow
      >
        <boxGeometry args={[wallThickness, frameHeight * 0.82, shellHeight * 0.48]} />
        <meshStandardMaterial color="#90a4ae" roughness={0.72} metalness={0.14} />
      </mesh>

      <mesh
        position={[centerX + shellWidth * 0.18, 0.22, centerZ + shellHeight * 0.18]}
        castShadow
      >
        <boxGeometry args={[0.92, 0.08, 0.42]} />
        <meshStandardMaterial color="#8d6e63" roughness={0.84} metalness={0.04} />
      </mesh>

      {deskRows.map((row) =>
        deskColumns.map((column, index) => (
          <group
            key={`remote-desk-${row}-${column}`}
            position={[centerX + width * column, 0, centerZ + height * row]}
          >
            <mesh position={[0, 0.14, 0]} castShadow>
              <boxGeometry args={[0.34, 0.08, 0.2]} />
              <meshStandardMaterial color="#6d4c41" roughness={0.82} metalness={0.05} />
            </mesh>
            <mesh position={[0, 0.25, -0.03]} castShadow>
              <boxGeometry args={[0.15, 0.11, 0.03]} />
              <meshStandardMaterial color="#263238" roughness={0.5} metalness={0.22} />
            </mesh>
            <mesh
              position={[0.13, 0.09, 0.07]}
              rotation={[0, (index % 2 === 0 ? 1 : -1) * 0.35, 0]}
              castShadow
            >
              <boxGeometry args={[0.1, 0.16, 0.1]} />
              <meshStandardMaterial color="#78909c" roughness={0.78} metalness={0.08} />
            </mesh>
          </group>
        )),
      )}

      {([-1, 1] as const).map((side) => (
        <group
          key={`remote-sign-${side}`}
          position={[centerX + side * (width * 0.34), 0, centerZ + height * 0.44]}
        >
          <mesh position={[0, 0.24, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.48, 10]} />
            <meshStandardMaterial color="#90a4ae" roughness={0.58} metalness={0.28} />
          </mesh>
          <mesh position={[0, 0.52, 0]} castShadow>
            <boxGeometry args={[0.34, 0.12, 0.04]} />
            <meshStandardMaterial color="#102a43" roughness={0.46} metalness={0.18} />
          </mesh>
          <mesh position={[0, 0.52, 0.025]}>
            <boxGeometry args={[0.28, 0.04, 0.01]} />
            <meshStandardMaterial color="#4dd0e1" emissive="#4dd0e1" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function FloorAndWalls() {
  const districtWidth = CANVAS_W * SCALE;
  const districtHeight = CANVAS_H * SCALE;
  const localOfficeWidth = LOCAL_OFFICE_CANVAS_WIDTH * SCALE;
  const localOfficeHeight = CANVAS_H * SCALE;
  const [districtCenterX, , districtCenterZ] = toWorld(CANVAS_W / 2, CANVAS_H / 2);
  const [localOfficeCenterX, , localOfficeCenterZ] = toWorld(
    LOCAL_OFFICE_CANVAS_WIDTH / 2,
    CANVAS_H / 2,
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
  const [remoteOfficeCenterX, , remoteOfficeCenterZ] = toWorld(
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
  const remoteOfficeWidth = (REMOTE_OFFICE_ZONE.maxX - REMOTE_OFFICE_ZONE.minX) * SCALE;
  const remoteOfficeHeight = (REMOTE_OFFICE_ZONE.maxY - REMOTE_OFFICE_ZONE.minY) * SCALE;
  const remoteOfficeFrameHeight = 1.08;
  const remoteWallThickness = 0.12;
  const localNorthWallZ = localOfficeCenterZ - localOfficeHeight / 2;
  const localSouthWallZ = localOfficeCenterZ + localOfficeHeight / 2;
  const localWestWallX = localOfficeCenterX - localOfficeWidth / 2;
  const localEastWallX = localOfficeCenterX + localOfficeWidth / 2;

  return (
    <group>
      <mesh
        position={[districtCenterX, -0.015, districtCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[districtWidth, districtHeight, 24, 14]} />
        <meshStandardMaterial color="#263238" roughness={0.98} metalness={0.02} />
      </mesh>

      <mesh
        position={[districtCenterX, -0.012, districtCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[districtWidth * 0.95, districtHeight * 0.9]} />
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
        <meshStandardMaterial color="#8d6e63" roughness={0.92} metalness={0.04} />
      </mesh>

      <RemoteOfficePreview
        centerX={remoteOfficeCenterX}
        centerZ={remoteOfficeCenterZ}
        width={remoteOfficeWidth}
        height={remoteOfficeHeight}
        frameHeight={remoteOfficeFrameHeight}
        wallThickness={remoteWallThickness}
      />

      {Array.from({ length: 10 }).map((_, index) => {
        const [wx, , wz] = toWorld(1870 + index * 62, 360 + (index % 2 === 0 ? -54 : 54));
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

      {Array.from({ length: 8 }).map((_, index) => {
        const [wx, , wz] = toWorld(1890 + index * 70, 274 + (index % 2 === 0 ? 0 : 172));
        return (
          <mesh key={`city-planter-${index}`} position={[wx, 0.08, wz]} castShadow>
            <boxGeometry args={[0.46, 0.14, 0.26]} />
            <meshStandardMaterial color="#5d4037" roughness={0.86} metalness={0.08} />
          </mesh>
        );
      })}

      {Array.from({ length: 8 }).map((_, index) => {
        const [wx, , wz] = toWorld(1890 + index * 70, 274 + (index % 2 === 0 ? 0 : 172));
        return (
          <mesh key={`city-planter-top-${index}`} position={[wx, 0.18, wz]}>
            <boxGeometry args={[0.38, 0.08, 0.18]} />
            <meshStandardMaterial color="#43a047" roughness={0.98} metalness={0} />
          </mesh>
        );
      })}

      {gymZoneFloorWidth > 0 && roomZoneFloorHeight > 0 ? (
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
          {Array.from({ length: 7 }).map((_, index) => {
            const offsetX =
              qaZoneCenterX - qaZoneFloorWidth * 0.38 + index * (qaZoneFloorWidth / 7);
            return (
              <mesh
                key={`qa-vertical-${index}`}
                position={[offsetX, 0.006, roomZoneCenterZ]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[0.015, qaZoneStripeHeight]} />
                <meshBasicMaterial color="#7c3aed" transparent opacity={0.34} />
              </mesh>
            );
          })}
          {Array.from({ length: 12 }).map((_, index) => {
            const z =
              roomZoneCenterZ -
              qaZoneStripeHeight / 2 +
              index * (qaZoneStripeHeight / 11);
            return (
              <mesh
                key={`qa-horizontal-${index}`}
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
            );
          })}
        </>
      ) : null}

      {Array.from({ length: 18 }).map((_, index) => {
        const z =
          localOfficeCenterZ - localOfficeHeight / 2 + (index + 1) * (localOfficeHeight / 18);
        return (
          <mesh
            key={index}
            position={[localOfficeCenterX, 0.001, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[localOfficeWidth, 0.008]} />
            <meshBasicMaterial color="#a07850" transparent opacity={0.25} />
          </mesh>
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
            <mesh position={[localOfficeCenterX, 0.5, localSouthWallZ]} receiveShadow>
              <boxGeometry args={[localOfficeWidth, 1, 0.12]} />
              <meshStandardMaterial
                color={wallColor}
                emissive={wallEmissive}
                emissiveIntensity={0.4}
                roughness={0.9}
              />
            </mesh>
            <mesh position={[localWestWallX, 0.5, localOfficeCenterZ]} receiveShadow>
              <boxGeometry args={[0.12, 1, localOfficeHeight]} />
              <meshStandardMaterial
                color={wallColor}
                emissive={wallEmissive}
                emissiveIntensity={0.4}
                roughness={0.9}
              />
            </mesh>
            <mesh position={[localEastWallX, 0.5, localOfficeCenterZ]} receiveShadow>
              <boxGeometry args={[0.12, 1, localOfficeHeight]} />
              <meshStandardMaterial
                color={wallColor}
                emissive={wallEmissive}
                emissiveIntensity={0.4}
                roughness={0.9}
              />
            </mesh>
          </>
        );
      })()}

      <mesh position={[localOfficeCenterX, 0.03, localNorthWallZ + 0.04]}>
        <boxGeometry args={[localOfficeWidth, 0.06, 0.04]} />
        <meshLambertMaterial color="#0c0c10" />
      </mesh>
      <mesh position={[localOfficeCenterX, 0.03, localSouthWallZ - 0.04]}>
        <boxGeometry args={[localOfficeWidth, 0.06, 0.04]} />
        <meshLambertMaterial color="#0c0c10" />
      </mesh>
      <mesh position={[localWestWallX + 0.04, 0.03, localOfficeCenterZ]}>
        <boxGeometry args={[0.04, 0.06, localOfficeHeight]} />
        <meshLambertMaterial color="#0c0c10" />
      </mesh>
      <mesh position={[localEastWallX - 0.04, 0.03, localOfficeCenterZ]}>
        <boxGeometry args={[0.04, 0.06, localOfficeHeight]} />
        <meshLambertMaterial color="#0c0c10" />
      </mesh>
    </group>
  );
}

export function WallPictures() {
  const localWidth = LOCAL_OFFICE_CANVAS_WIDTH * SCALE;
  const localHeight = CANVAS_H * SCALE;
  const [localCenterX, , localCenterZ] = toWorld(LOCAL_OFFICE_CANVAS_WIDTH / 2, CANVAS_H / 2);
  const northZ = localCenterZ - localHeight / 2 + 0.07;
  const southZ = localCenterZ + localHeight / 2 - 0.07;
  const westX = localCenterX - localWidth / 2 + 0.07;
  const eastX = localCenterX + localWidth / 2 - 0.07;
  const pictureY = 0.64;

  return (
    <group>
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
        position={[westX, pictureY, -3.5]}
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
        position={[westX, pictureY, 2.5]}
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
        position={[eastX, pictureY, -2.5]}
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
        position={[eastX, pictureY, 3.5]}
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
}
