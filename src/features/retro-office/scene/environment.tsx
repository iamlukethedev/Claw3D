"use client";

import { Billboard, Text } from "@react-three/drei";
import { memo, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
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

function TowerBlock({
  position,
  width,
  depth,
  height,
  bodyColor,
  accentColor,
  windowColor,
}: {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  accentColor: string;
  windowColor: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={bodyColor} roughness={0.88} metalness={0.08} />
      </mesh>
      <mesh position={[0, height + 0.14, 0]} castShadow>
        <boxGeometry args={[width * 0.76, 0.28, depth * 0.76]} />
        <meshStandardMaterial color={accentColor} roughness={0.74} metalness={0.2} />
      </mesh>
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 3 }).map((__, column) => (
          <mesh
            key={`tower-window-${row}-${column}`}
            position={[
              -width * 0.24 + column * (width * 0.24),
              0.4 + row * (height * 0.18),
              depth / 2 + 0.01,
            ]}
          >
            <planeGeometry args={[width * 0.13, height * 0.08]} />
            <meshBasicMaterial color={windowColor} />
          </mesh>
        )),
      )}
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 2 }).map((__, column) => (
          <mesh
            key={`tower-side-window-${row}-${column}`}
            position={[
              width / 2 + 0.01,
              0.4 + row * (height * 0.18),
              -depth * 0.16 + column * (depth * 0.32),
            ]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <planeGeometry args={[depth * 0.16, height * 0.08]} />
            <meshBasicMaterial color={windowColor} />
          </mesh>
        )),
      )}
    </group>
  );
}

function StorefrontBlock({
  position,
  rotationY = 0,
  width,
  depth,
  height,
  bodyColor,
  awningColor,
  trimColor,
  windowColor,
}: {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  awningColor: string;
  trimColor: string;
  windowColor: string;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={bodyColor} roughness={0.86} metalness={0.08} />
      </mesh>
      <mesh position={[0, height + 0.08, 0]} castShadow>
        <boxGeometry args={[width + 0.08, 0.16, depth + 0.08]} />
        <meshStandardMaterial color={trimColor} roughness={0.72} metalness={0.16} />
      </mesh>
      <mesh position={[0, height * 0.58, depth / 2 + 0.13]} castShadow>
        <boxGeometry args={[width * 0.94, 0.12, 0.28]} />
        <meshStandardMaterial color={awningColor} roughness={0.7} metalness={0.04} />
      </mesh>
      <mesh position={[0, height * 0.78, depth / 2 + 0.02]}>
        <planeGeometry args={[width * 0.66, height * 0.16]} />
        <meshBasicMaterial color={trimColor} />
      </mesh>
      <mesh position={[-width * 0.2, height * 0.34, depth / 2 + 0.01]}>
        <planeGeometry args={[width * 0.22, height * 0.36]} />
        <meshBasicMaterial color={windowColor} />
      </mesh>
      <mesh position={[width * 0.2, height * 0.34, depth / 2 + 0.01]}>
        <planeGeometry args={[width * 0.22, height * 0.36]} />
        <meshBasicMaterial color={windowColor} />
      </mesh>
      <mesh position={[0, height * 0.18, depth / 2 + 0.015]}>
        <planeGeometry args={[width * 0.16, height * 0.28]} />
        <meshBasicMaterial color="#2a1c12" />
      </mesh>
    </group>
  );
}

function TownhouseBlock({
  position,
  rotationY = 0,
  width,
  depth,
  height,
  bodyColor,
  roofColor,
  doorColor,
  windowColor,
}: {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  roofColor: string;
  doorColor: string;
  windowColor: string;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={bodyColor} roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh position={[0, height + width * 0.14, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[width * 0.72, width * 0.54, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.78} metalness={0.08} />
      </mesh>
      <mesh position={[0, height * 0.18, depth / 2 + 0.015]}>
        <planeGeometry args={[width * 0.18, height * 0.28]} />
        <meshBasicMaterial color={doorColor} />
      </mesh>
      {[-width * 0.22, width * 0.22].map((offsetX, index) => (
        <mesh key={`townhouse-window-lower-${index}`} position={[offsetX, height * 0.32, depth / 2 + 0.01]}>
          <planeGeometry args={[width * 0.16, height * 0.16]} />
          <meshBasicMaterial color={windowColor} />
        </mesh>
      ))}
      {[-width * 0.22, width * 0.22].map((offsetX, index) => (
        <mesh key={`townhouse-window-upper-${index}`} position={[offsetX, height * 0.62, depth / 2 + 0.01]}>
          <planeGeometry args={[width * 0.16, height * 0.16]} />
          <meshBasicMaterial color={windowColor} />
        </mesh>
      ))}
    </group>
  );
}

function StreetTree({
  position,
  canopyColor = "#3f9142",
}: {
  position: [number, number, number];
  canopyColor?: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.055, 0.44, 10]} />
        <meshStandardMaterial color="#6d4c41" roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color={canopyColor} roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[0.11, 0.54, 0.05]} castShadow>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color={canopyColor} roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[-0.1, 0.55, -0.06]} castShadow>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial color={canopyColor} roughness={0.9} metalness={0.02} />
      </mesh>
    </group>
  );
}

function CompactCar({
  position,
  rotationY = 0,
  bodyColor,
  scale = 1,
}: {
  position: [number, number, number];
  rotationY?: number;
  bodyColor: string;
  scale?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.14, 0.22]} />
        <meshStandardMaterial color={bodyColor} roughness={0.52} metalness={0.28} />
      </mesh>
      <mesh position={[0.02, 0.2, 0]} castShadow>
        <boxGeometry args={[0.24, 0.11, 0.2]} />
        <meshStandardMaterial color={bodyColor} roughness={0.48} metalness={0.34} />
      </mesh>
      <mesh position={[0.07, 0.21, 0.112]}>
        <planeGeometry args={[0.12, 0.07]} />
        <meshBasicMaterial color="#c8e6ff" />
      </mesh>
      <mesh position={[0.07, 0.21, -0.112]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.12, 0.07]} />
        <meshBasicMaterial color="#c8e6ff" />
      </mesh>
      {[
        [-0.14, 0.05, 0.11],
        [0.14, 0.05, 0.11],
        [-0.14, 0.05, -0.11],
        [0.14, 0.05, -0.11],
      ].map(([x, y, z], index) => (
        <mesh key={`car-wheel-${index}`} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.03, 10]} />
          <meshStandardMaterial color="#121212" roughness={0.86} metalness={0.08} />
        </mesh>
      ))}
    </group>
  );
}

function MovingCompactCar({
  route,
  speed = 0.16,
  phase = 0,
  bodyColor,
}: {
  route: Array<[number, number, number]>;
  speed?: number;
  phase?: number;
  bodyColor: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const segmentLengths = useMemo(() => {
    if (route.length < 2) return [];
    const lengths: number[] = [];
    for (let index = 0; index < route.length - 1; index += 1) {
      const [x1, , z1] = route[index] ?? [0, 0, 0];
      const [x2, , z2] = route[index + 1] ?? [0, 0, 0];
      lengths.push(Math.hypot(x2 - x1, z2 - z1));
    }
    return lengths;
  }, [route]);
  const totalLength = useMemo(
    () => segmentLengths.reduce((sum, value) => sum + value, 0),
    [segmentLengths],
  );
  useFrame((state) => {
    if (!groupRef.current) return;
    if (route.length < 2 || totalLength <= 0) return;
    const elapsed = state.clock.getElapsedTime();
    const startDistance =
      (((elapsed + phase) * speed) % totalLength + totalLength) % totalLength;
    let remaining = startDistance;
    let segmentIndex = 0;
    while (
      segmentIndex < segmentLengths.length - 1 &&
      remaining > (segmentLengths[segmentIndex] ?? 0)
    ) {
      remaining -= segmentLengths[segmentIndex] ?? 0;
      segmentIndex += 1;
    }
    const currentLength = Math.max(0.0001, segmentLengths[segmentIndex] ?? 0.0001);
    const t = remaining / currentLength;
    const start = route[segmentIndex] ?? route[0];
    const end = route[segmentIndex + 1] ?? route[route.length - 1];
    const x = (start?.[0] ?? 0) + ((end?.[0] ?? 0) - (start?.[0] ?? 0)) * t;
    const z = (start?.[2] ?? 0) + ((end?.[2] ?? 0) - (start?.[2] ?? 0)) * t;
    const heading = Math.atan2(
      (end?.[2] ?? 0) - (start?.[2] ?? 0),
      (end?.[0] ?? 0) - (start?.[0] ?? 0),
    );
    groupRef.current.position.set(x, 0, z);
    groupRef.current.rotation.set(0, -heading, 0);
  });
  if (route.length < 2 || totalLength <= 0) return null;
  return (
    <group ref={groupRef}>
      <CompactCar position={[0, 0, 0]} rotationY={0} bodyColor={bodyColor} />
    </group>
  );
}

function CityTrafficLayer({
  cityRoadSpanX,
  cityRoadSpanZ,
  localOfficeCenterX,
  localOfficeCenterZ,
  northRoadZ,
  southRoadZ,
  westRoadX,
  eastRoadX,
}: {
  cityRoadSpanX: number;
  cityRoadSpanZ: number;
  localOfficeCenterX: number;
  localOfficeCenterZ: number;
  northRoadZ: number;
  southRoadZ: number;
  westRoadX: number;
  eastRoadX: number;
}) {
  const outerLoopRoute = useMemo(
    () =>
      [
        [localOfficeCenterX - cityRoadSpanX * 0.45, 0, northRoadZ],
        [localOfficeCenterX + cityRoadSpanX * 0.45, 0, northRoadZ],
        [eastRoadX, 0, localOfficeCenterZ + cityRoadSpanZ * 0.45],
        [localOfficeCenterX - cityRoadSpanX * 0.45, 0, southRoadZ],
        [westRoadX, 0, localOfficeCenterZ - cityRoadSpanZ * 0.45],
        [localOfficeCenterX - cityRoadSpanX * 0.45, 0, northRoadZ],
      ] as Array<[number, number, number]>,
    [
      cityRoadSpanX,
      cityRoadSpanZ,
      eastRoadX,
      localOfficeCenterX,
      localOfficeCenterZ,
      northRoadZ,
      southRoadZ,
      westRoadX,
    ],
  );
  const crossLoopRoute = useMemo(
    () =>
      [
        [westRoadX, 0, localOfficeCenterZ - cityRoadSpanZ * 0.35],
        [localOfficeCenterX + cityRoadSpanX * 0.35, 0, northRoadZ],
        [eastRoadX, 0, localOfficeCenterZ + cityRoadSpanZ * 0.28],
        [localOfficeCenterX - cityRoadSpanX * 0.35, 0, southRoadZ],
        [westRoadX, 0, localOfficeCenterZ - cityRoadSpanZ * 0.35],
      ] as Array<[number, number, number]>,
    [
      cityRoadSpanX,
      cityRoadSpanZ,
      eastRoadX,
      localOfficeCenterX,
      localOfficeCenterZ,
      northRoadZ,
      southRoadZ,
      westRoadX,
    ],
  );

  return (
    <>
      {[
        { route: outerLoopRoute, speed: 0.2, phase: 0.0, color: "#e53935" },
        { route: outerLoopRoute, speed: 0.2, phase: 2.4, color: "#1d4ed8" },
        { route: outerLoopRoute, speed: 0.2, phase: 4.7, color: "#f59e0b" },
        { route: outerLoopRoute, speed: 0.2, phase: 7.1, color: "#16a34a" },
        { route: crossLoopRoute, speed: 0.16, phase: 1.2, color: "#8b5cf6" },
        { route: crossLoopRoute, speed: 0.16, phase: 3.6, color: "#0284c7" },
      ].map((traffic, index) => (
        <MovingCompactCar
          key={`moving-traffic-${index}`}
          route={traffic.route}
          speed={traffic.speed}
          phase={traffic.phase}
          bodyColor={traffic.color}
        />
      ))}
    </>
  );
}

function FactoryBlock({
  position,
  width,
  depth,
  height,
  bodyColor,
  roofColor,
  chimneyColor,
}: {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  roofColor: string;
  chimneyColor: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={bodyColor} roughness={0.86} metalness={0.08} />
      </mesh>
      <mesh position={[0, height + 0.03, 0]} castShadow>
        <boxGeometry args={[width * 0.92, 0.06, depth * 0.92]} />
        <meshStandardMaterial color={roofColor} roughness={0.78} metalness={0.12} />
      </mesh>
      {[-width * 0.22, 0, width * 0.22].map((offsetX, index) => (
        <mesh key={`factory-chimney-${index}`} position={[offsetX, height + 0.18, -depth * 0.18]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 0.34 + index * 0.07, 10]} />
          <meshStandardMaterial color={chimneyColor} roughness={0.72} metalness={0.18} />
        </mesh>
      ))}
    </group>
  );
}

function LotCutawayBase({
  position,
  width,
  depth,
  tone = "grass",
}: {
  position: [number, number, number];
  width: number;
  depth: number;
  tone?: "grass" | "shop" | "home";
}) {
  const surfaceColor =
    tone === "shop" ? "#d7d1c0" : tone === "home" ? "#cdddb7" : "#9ec27e";
  const borderColor =
    tone === "shop" ? "#6b7280" : tone === "home" ? "#8d6e63" : "#5d4037";
  return (
    <group position={position}>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={surfaceColor} roughness={0.98} metalness={0.01} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[width + 0.08, 0.04, depth + 0.08]} />
        <meshStandardMaterial color={borderColor} roughness={0.88} metalness={0.06} />
      </mesh>
    </group>
  );
}

function BuildingBillboardLabel({
  position,
  text,
  color = "#f8fafc",
  background = "#111827",
}: {
  position: [number, number, number];
  text: string;
  color?: string;
  background?: string;
}) {
  return (
    <Billboard position={position} follow lockX={false} lockY={false} lockZ={false}>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[1.7, 0.32]} />
        <meshBasicMaterial color={background} transparent opacity={0.9} />
      </mesh>
      <Text
        fontSize={0.14}
        color={color}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.5}
      >
        {text}
      </Text>
    </Billboard>
  );
}

function RoadTile({
  position,
  size,
  mask,
}: {
  position: [number, number, number];
  size: number;
  mask: RoadMask;
}) {
  const roadWidth = size * 0.72;
  const laneWidth = size * 0.06;
  return (
    <group position={position}>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#5c8f47" roughness={0.98} metalness={0.01} />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[roadWidth, roadWidth]} />
        <meshStandardMaterial color="#3f4650" roughness={0.95} metalness={0.08} />
      </mesh>
      {mask.north || mask.south ? (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[laneWidth, size * 0.88]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.95} />
        </mesh>
      ) : null}
      {mask.east || mask.west ? (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[laneWidth, size * 0.88]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.95} />
        </mesh>
      ) : null}
      {mask.north ? (
        <mesh position={[0, 0.0045, -size * 0.36]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[roadWidth, size * 0.3]} />
          <meshStandardMaterial color="#3f4650" roughness={0.95} metalness={0.08} />
        </mesh>
      ) : null}
      {mask.south ? (
        <mesh position={[0, 0.0045, size * 0.36]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[roadWidth, size * 0.3]} />
          <meshStandardMaterial color="#3f4650" roughness={0.95} metalness={0.08} />
        </mesh>
      ) : null}
      {mask.west ? (
        <mesh position={[-size * 0.36, 0.0045, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[roadWidth, size * 0.3]} />
          <meshStandardMaterial color="#3f4650" roughness={0.95} metalness={0.08} />
        </mesh>
      ) : null}
      {mask.east ? (
        <mesh position={[size * 0.36, 0.0045, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[roadWidth, size * 0.3]} />
          <meshStandardMaterial color="#3f4650" roughness={0.95} metalness={0.08} />
        </mesh>
      ) : null}
    </group>
  );
}

function FullCityScene({
  centerX,
  centerZ,
  onEnterHeadquarters,
  onEnterStore,
  onEnterHouse,
  activeSceneMode = "city",
}: {
  centerX: number;
  centerZ: number;
  onEnterHeadquarters?: () => void;
  onEnterStore?: () => void;
  onEnterHouse?: () => void;
  activeSceneMode?: "city" | "office" | "store" | "house";
}) {
  const cityGrid = useMemo(() => buildCityGrid(), []);
  const [hqHovered, setHqHovered] = useState(false);
  const baseOffsetX = centerX - ((CITY_GRID_COLUMNS - 1) * CITY_GRID_CELL_SIZE) / 2;
  const baseOffsetZ = centerZ - ((CITY_GRID_ROWS - 1) * CITY_GRID_CELL_SIZE) / 2;
  const cityWidth = CITY_GRID_COLUMNS * CITY_GRID_CELL_SIZE;
  const cityDepth = CITY_GRID_ROWS * CITY_GRID_CELL_SIZE;
  const hqPosition: [number, number, number] = [centerX, 0, centerZ + CITY_GRID_CELL_SIZE * 0.5];
  const storeAnchor: [number, number, number] = [
    baseOffsetX + 1 * CITY_GRID_CELL_SIZE,
    0,
    baseOffsetZ + 1 * CITY_GRID_CELL_SIZE,
  ];
  const houseAnchor: [number, number, number] = [
    baseOffsetX + 8 * CITY_GRID_CELL_SIZE,
    0,
    baseOffsetZ + 6 * CITY_GRID_CELL_SIZE,
  ];
  const trafficNorthZ = baseOffsetZ + 2 * CITY_GRID_CELL_SIZE;
  const trafficSouthZ = baseOffsetZ + 5 * CITY_GRID_CELL_SIZE;
  const trafficWestX = baseOffsetX + 2 * CITY_GRID_CELL_SIZE;
  const trafficEastX = baseOffsetX + 7 * CITY_GRID_CELL_SIZE;
  const storeLotActive = activeSceneMode === "store";
  const houseLotActive = activeSceneMode === "house";
  return (
    <group>
      <mesh position={[centerX, -0.02, centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[cityWidth + 3.2, cityDepth + 3.2]} />
        <meshStandardMaterial color="#66a04a" roughness={0.99} metalness={0.01} />
      </mesh>
      {cityGrid.map((cell) => {
        const x = baseOffsetX + cell.gx * CITY_GRID_CELL_SIZE;
        const z = baseOffsetZ + cell.gz * CITY_GRID_CELL_SIZE;
        const isStoreLot = cell.gx === 1 && cell.gz === 1;
        const isHouseLot = cell.gx === 8 && cell.gz === 6;
        if (cell.road) {
          return (
            <RoadTile
              key={`full-city-road-${cell.gx}-${cell.gz}`}
              position={[x, 0, z]}
              size={CITY_GRID_CELL_SIZE}
              mask={cell.mask}
            />
          );
        }
        const lotPosition: [number, number, number] = [x, 0, z];
        if (isStoreLot && storeLotActive) {
          return (
            <group key="full-city-store-cutaway" position={lotPosition}>
              <LotCutawayBase
                position={[0, 0, 0]}
                width={CITY_GRID_CELL_SIZE * 0.96}
                depth={CITY_GRID_CELL_SIZE * 0.96}
                tone="shop"
              />
              <StreetTree position={[-0.34, 0, -0.28]} canopyColor="#4ea34a" />
              <StreetTree position={[0.28, 0, 0.22]} canopyColor="#3f9142" />
            </group>
          );
        }
        if (isHouseLot && houseLotActive) {
          return (
            <group key="full-city-house-cutaway" position={lotPosition}>
              <LotCutawayBase
                position={[0, 0, 0]}
                width={CITY_GRID_CELL_SIZE * 0.98}
                depth={CITY_GRID_CELL_SIZE * 0.98}
                tone="home"
              />
              <StreetTree position={[-0.28, 0, -0.26]} canopyColor="#4ea34a" />
              <StreetTree position={[0.24, 0, 0.18]} canopyColor="#5aa05c" />
            </group>
          );
        }
        if ((cell.gx + cell.gz) % 7 === 0) {
          return (
            <group key={`full-city-park-${cell.gx}-${cell.gz}`} position={lotPosition}>
              <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[CITY_GRID_CELL_SIZE * 0.9, CITY_GRID_CELL_SIZE * 0.9]} />
                <meshStandardMaterial color="#5d994a" roughness={0.98} metalness={0.01} />
              </mesh>
              <StreetTree position={[-0.24, 0, -0.18]} canopyColor="#3f9142" />
              <StreetTree position={[0.18, 0, 0.12]} canopyColor="#4ea34a" />
            </group>
          );
        }
        if (cell.zone === "residential") {
          return (
            <TownhouseBlock
              key={`full-city-res-${cell.gx}-${cell.gz}`}
              position={lotPosition}
              rotationY={(cell.gx + cell.gz) % 2 === 0 ? 0 : Math.PI / 2}
              width={0.72}
              depth={0.72}
              height={0.78 + ((cell.gx + cell.gz) % 3) * 0.12}
              bodyColor={["#d8c3a5", "#cbb6d9", "#c6d8ef", "#c4d7b2"][(cell.gx + cell.gz) % 4] ?? "#d8c3a5"}
              roofColor={["#8d6e63", "#6b4f85", "#4b5d73", "#5f7a61"][(cell.gx + cell.gz) % 4] ?? "#8d6e63"}
              doorColor="#473225"
              windowColor="#f8f3c2"
            />
          );
        }
        if (cell.zone === "commercial") {
          const isTower = cell.gz <= 1 && cell.gx % 3 === 0;
          return isTower ? (
            <group key={`full-city-com-tower-${cell.gx}-${cell.gz}`}>
              <TowerBlock
                position={lotPosition}
                width={0.84}
                depth={0.84}
                height={2.5 + (cell.gx % 2) * 0.9}
                bodyColor="#e5e7eb"
                accentColor="#9ca3af"
                windowColor="#111827"
              />
              {cell.gz === 0 && cell.gx === 6 ? (
                <BuildingBillboardLabel
                  position={[x, 3.7, z]}
                  text="JIRA"
                  color="#fde68a"
                  background="#1f2937"
                />
              ) : null}
            </group>
          ) : (
            <StorefrontBlock
              key={`full-city-com-store-${cell.gx}-${cell.gz}`}
              position={lotPosition}
              rotationY={cell.gz % 2 === 0 ? 0 : Math.PI / 2}
              width={0.86}
              depth={0.74}
              height={0.9 + (cell.gx % 3) * 0.12}
              bodyColor={["#facc15", "#d6b48a", "#f3f4f6", "#f59e0b"][(cell.gx + cell.gz) % 4] ?? "#d6b48a"}
              awningColor={["#ef4444", "#2563eb", "#22c55e", "#8b5cf6"][(cell.gx + cell.gz) % 4] ?? "#ef4444"}
              trimColor="#f8fafc"
              windowColor="#dbeafe"
            />
          );
        }
        return (
          <FactoryBlock
            key={`full-city-ind-${cell.gx}-${cell.gz}`}
            position={lotPosition}
            width={0.92}
            depth={0.84}
            height={0.72 + (cell.gx % 2) * 0.14}
            bodyColor="#8b5e3c"
            roofColor="#3f3f46"
            chimneyColor="#9ca3af"
          />
        );
      })}
      {activeSceneMode !== "office" ? (
        <group
          position={hqPosition}
          onPointerOver={(event) => {
            event.stopPropagation();
            setHqHovered(true);
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            setHqHovered(false);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onEnterHeadquarters?.();
          }}
        >
          <mesh position={[0, 0.01, 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.2, 2.8]} />
            <meshBasicMaterial
              color={hqHovered ? "#fde68a" : "#bbf7d0"}
              transparent
              opacity={hqHovered ? 0.24 : 0.14}
            />
          </mesh>
          <TowerBlock
            position={[-0.52, 0, -0.26]}
            width={0.9}
            depth={0.9}
            height={3.6}
            bodyColor="#f3f4f6"
            accentColor="#9ca3af"
            windowColor="#0f172a"
          />
          <TowerBlock
            position={[0.56, 0, 0.24]}
            width={0.9}
            depth={0.9}
            height={3.1}
            bodyColor="#f3f4f6"
            accentColor="#9ca3af"
            windowColor="#0f172a"
          />
          <StorefrontBlock
            position={[0, 0, 0.92]}
            width={1.3}
            depth={0.78}
            height={0.95}
            bodyColor="#334155"
            awningColor="#22c55e"
            trimColor="#dcfce7"
            windowColor="#bfdbfe"
          />
          <mesh position={[0, 0.02, -1.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.85, 0.34]} />
            <meshBasicMaterial
              color={hqHovered ? "#fef08a" : "#e0f2fe"}
              transparent
              opacity={0.92}
            />
          </mesh>
          <mesh position={[0, 0.03, -1.02]}>
            <planeGeometry args={[1.7, 0.18]} />
            <meshBasicMaterial color="#0f172a" transparent opacity={0.98} />
          </mesh>
          <mesh position={[0, 0.04, -1.02]}>
            <planeGeometry args={[1.58, 0.12]} />
            <meshBasicMaterial
              color={hqHovered ? "#fef08a" : "#f8fafc"}
              transparent
              opacity={1}
            />
          </mesh>
        </group>
      ) : (
        <group position={hqPosition}>
          <LotCutawayBase
            position={[0, 0, 0.1]}
            width={3.25}
            depth={2.85}
            tone="grass"
          />
          {[
            [-1.42, 0, -1.12],
            [1.46, 0, -1.14],
            [-1.44, 0, 1.18],
            [1.46, 0, 1.18],
          ].map(([x, y, z], index) => (
            <StreetTree
              key={`hq-lot-tree-${index}`}
              position={[x, y, z]}
              canopyColor={index % 2 === 0 ? "#3f9142" : "#4ea34a"}
            />
          ))}
          <BuildingBillboardLabel
            position={[0, 0.55, -1.34]}
            text="HEADQUARTERS"
            color="#fef08a"
            background="#0f172a"
          />
        </group>
      )}
      <group
        position={storeAnchor}
        onClick={(event) => {
          event.stopPropagation();
          onEnterStore?.();
        }}
      >
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.22, 1.02]} />
          <meshBasicMaterial color="#fef3c7" transparent opacity={0.12} />
        </mesh>
      </group>
      <group
        position={houseAnchor}
        onClick={(event) => {
          event.stopPropagation();
          onEnterHouse?.();
        }}
      >
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.12, 1.12]} />
          <meshBasicMaterial color="#e9d5ff" transparent opacity={0.12} />
        </mesh>
      </group>
      <CityTrafficLayer
        cityRoadSpanX={CITY_GRID_CELL_SIZE * CITY_GRID_COLUMNS * 0.82}
        cityRoadSpanZ={CITY_GRID_CELL_SIZE * CITY_GRID_ROWS * 0.82}
        localOfficeCenterX={centerX}
        localOfficeCenterZ={centerZ}
        northRoadZ={trafficNorthZ}
        southRoadZ={trafficSouthZ}
        westRoadX={trafficWestX}
        eastRoadX={trafficEastX}
      />
    </group>
  );
}

type ZoneKind = "residential" | "commercial" | "industrial";
type RoadMask = {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
};

type CityGridCell = {
  gx: number;
  gz: number;
  zone: ZoneKind;
  road: boolean;
  mask: RoadMask;
};

const CITY_GRID_COLUMNS = 10;
const CITY_GRID_ROWS = 8;
const CITY_GRID_CELL_SIZE = 1.18;

const classifyZone = (gx: number, gz: number): ZoneKind => {
  if (gz <= 1) return "commercial";
  if (gz >= CITY_GRID_ROWS - 2) return "industrial";
  return gx % 2 === 0 ? "residential" : "commercial";
};

const isRoadCell = (gx: number, gz: number): boolean => {
  if (gz === 2 || gz === 5) return true;
  if (gx === 2 || gx === 7) return true;
  if ((gx === 5 && gz >= 1 && gz <= 6) || (gz === 4 && gx >= 1 && gx <= 8)) return true;
  return false;
};

const buildCityGrid = (): CityGridCell[] => {
  const cells: CityGridCell[] = [];
  const roads = new Set<string>();
  for (let gz = 0; gz < CITY_GRID_ROWS; gz += 1) {
    for (let gx = 0; gx < CITY_GRID_COLUMNS; gx += 1) {
      if (isRoadCell(gx, gz)) roads.add(`${gx}:${gz}`);
    }
  }
  for (let gz = 0; gz < CITY_GRID_ROWS; gz += 1) {
    for (let gx = 0; gx < CITY_GRID_COLUMNS; gx += 1) {
      const road = roads.has(`${gx}:${gz}`);
      const mask: RoadMask = {
        north: roads.has(`${gx}:${gz - 1}`),
        south: roads.has(`${gx}:${gz + 1}`),
        east: roads.has(`${gx + 1}:${gz}`),
        west: roads.has(`${gx - 1}:${gz}`),
      };
      cells.push({
        gx,
        gz,
        zone: classifyZone(gx, gz),
        road,
        mask,
      });
    }
  }
  return cells;
};

export const FloorAndWalls = memo(function FloorAndWalls({
  showRemoteOffice = true,
  onEnterHeadquarters,
  activeSceneMode = "city",
  onEnterStore,
  onEnterHouse,
}: {
  showRemoteOffice?: boolean;
  onEnterHeadquarters?: () => void;
  activeSceneMode?: "city" | "office" | "store" | "house";
  onEnterStore?: () => void;
  onEnterHouse?: () => void;
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
  const cityRoadOffset = 1.04;
  const cityRoadWidth = 0.8;
  const cityRoadSpanX = localOfficeWidth + 4.6;
  const cityRoadSpanZ = localOfficeHeight + 4.6;
  const northRoadZ = localNorthWallZ - cityRoadOffset;
  const southRoadZ = localSouthWallZ + cityRoadOffset;
  const westRoadX = localWestWallX - cityRoadOffset;
  const eastRoadX = localEastWallX + cityRoadOffset;
  const parkDepth = 1.95;
  const parkWidth = 2.2;
  const groundCenterX = showRemoteOffice ? districtCenterX : localOfficeCenterX;
  const groundCenterZ = showRemoteOffice ? districtCenterZ : localOfficeCenterZ;
  const groundWidth = showRemoteOffice ? districtWidth : localOfficeWidth;
  const groundHeight = showRemoteOffice ? districtHeight : localOfficeHeight;

  if (showRemoteOffice) {
    return (
      <FullCityScene
        centerX={localOfficeCenterX}
        centerZ={localOfficeCenterZ}
        onEnterHeadquarters={onEnterHeadquarters}
        onEnterStore={onEnterStore}
        onEnterHouse={onEnterHouse}
        activeSceneMode={activeSceneMode}
      />
    );
  }

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

          {[
            { x: 110, y: 740, width: 1.9, depth: 0.95, height: 1.35, body: "#6d4c41", awning: "#d97706", trim: "#fbbf24", window: "#fde68a" },
            { x: 420, y: 740, width: 2.2, depth: 1.05, height: 1.48, body: "#455a64", awning: "#0ea5e9", trim: "#dbeafe", window: "#bfdbfe" },
            { x: 790, y: 740, width: 2.05, depth: 1, height: 1.4, body: "#7c2d12", awning: "#fb7185", trim: "#fecdd3", window: "#fef3c7" },
            { x: 1130, y: 740, width: 2.15, depth: 1.02, height: 1.44, body: "#1f2937", awning: "#22c55e", trim: "#dcfce7", window: "#d1fae5" },
            { x: 1490, y: 740, width: 1.95, depth: 0.96, height: 1.36, body: "#374151", awning: "#8b5cf6", trim: "#ddd6fe", window: "#c4b5fd" },
          ].map((store) => {
            const [wx, , wz] = toWorld(store.x, store.y);
            return (
              <StorefrontBlock
                key={`storefront-${store.x}-${store.y}`}
                position={[wx, 0, wz]}
                width={store.width}
                depth={store.depth}
                height={store.height}
                bodyColor={store.body}
                awningColor={store.awning}
                trimColor={store.trim}
                windowColor={store.window}
              />
            );
          })}

          {[
            { x: 180, y: 960, width: 1.45, depth: 1.08, height: 1.18, body: "#d6b48a", roof: "#8d6e63", door: "#5b3a29", window: "#fff7c2" },
            { x: 470, y: 958, width: 1.58, depth: 1.12, height: 1.22, body: "#c4d7b2", roof: "#546e7a", door: "#2f3e46", window: "#dbeafe" },
            { x: 790, y: 962, width: 1.5, depth: 1.06, height: 1.2, body: "#d7ccc8", roof: "#6d4c41", door: "#4e342e", window: "#fef3c7" },
            { x: 1110, y: 958, width: 1.54, depth: 1.08, height: 1.24, body: "#cbb6d9", roof: "#5b4375", door: "#35263f", window: "#e9d5ff" },
            { x: 1430, y: 962, width: 1.48, depth: 1.04, height: 1.18, body: "#b7d3c6", roof: "#355c4d", door: "#254237", window: "#dcfce7" },
          ].map((house) => {
            const [wx, , wz] = toWorld(house.x, house.y);
            return (
              <TownhouseBlock
                key={`townhouse-${house.x}-${house.y}`}
                position={[wx, 0, wz]}
                rotationY={Math.PI}
                width={house.width}
                depth={house.depth}
                height={house.height}
                bodyColor={house.body}
                roofColor={house.roof}
                doorColor={house.door}
                windowColor={house.window}
              />
            );
          })}

          {[
            { x: 35, y: 865, width: 1.8, depth: 1.7, height: 2.7, body: "#334155", accent: "#0f172a", window: "#93c5fd" },
            { x: 1745, y: 865, width: 1.95, depth: 1.78, height: 3.1, body: "#1f2937", accent: "#111827", window: "#fef08a" },
            { x: 1680, y: 1080, width: 1.65, depth: 1.52, height: 2.45, body: "#475569", accent: "#1e293b", window: "#bfdbfe" },
          ].map((tower) => {
            const [wx, , wz] = toWorld(tower.x, tower.y);
            return (
              <TowerBlock
                key={`tower-${tower.x}-${tower.y}`}
                position={[wx, 0, wz]}
                width={tower.width}
                depth={tower.depth}
                height={tower.height}
                bodyColor={tower.body}
                accentColor={tower.accent}
                windowColor={tower.window}
              />
            );
          })}
        </>
      ) : null}

      {[
        { x: 120, y: -35, width: 1.7, depth: 1.55, height: 2.35, body: "#374151", accent: "#111827", window: "#c4b5fd" },
        { x: 430, y: -46, width: 1.58, depth: 1.42, height: 2.1, body: "#4b5563", accent: "#1f2937", window: "#bfdbfe" },
        { x: 880, y: -54, width: 2.2, depth: 1.8, height: 3.25, body: "#334155", accent: "#0f172a", window: "#fde68a" },
        { x: 1340, y: -42, width: 1.62, depth: 1.48, height: 2.2, body: "#475569", accent: "#1e293b", window: "#93c5fd" },
        { x: 1670, y: -28, width: 1.74, depth: 1.52, height: 2.55, body: "#3f3f46", accent: "#18181b", window: "#e9d5ff" },
      ].map((tower) => {
        const [wx, , wz] = toWorld(tower.x, tower.y);
        return (
          <TowerBlock
            key={`skyline-tower-${tower.x}-${tower.y}`}
            position={[wx, 0, wz]}
            width={tower.width}
            depth={tower.depth}
            height={tower.height}
            bodyColor={tower.body}
            accentColor={tower.accent}
            windowColor={tower.window}
          />
        );
      })}

      {[
        { x: 260, y: LOCAL_OFFICE_CANVAS_HEIGHT + 18, width: 1.35, depth: 0.98, height: 1.05, body: "#e5c9a8", roof: "#7b5e57", door: "#5d4037", window: "#fef3c7" },
        { x: 540, y: LOCAL_OFFICE_CANVAS_HEIGHT + 20, width: 1.42, depth: 1.02, height: 1.12, body: "#c4d7b2", roof: "#5f7a61", door: "#39503d", window: "#dcfce7" },
        { x: 1320, y: LOCAL_OFFICE_CANVAS_HEIGHT + 20, width: 1.4, depth: 1, height: 1.1, body: "#cdb4db", roof: "#6b4f85", door: "#433255", window: "#e9d5ff" },
        { x: 1580, y: LOCAL_OFFICE_CANVAS_HEIGHT + 18, width: 1.32, depth: 0.96, height: 1.04, body: "#c6d8ef", roof: "#4b5d73", door: "#314152", window: "#dbeafe" },
      ].map((house) => {
        const [wx, , wz] = toWorld(house.x, house.y);
        return (
          <TownhouseBlock
            key={`perimeter-townhouse-${house.x}-${house.y}`}
            position={[wx, 0, wz]}
            rotationY={Math.PI}
            width={house.width}
            depth={house.depth}
            height={house.height}
            bodyColor={house.body}
            roofColor={house.roof}
            doorColor={house.door}
            windowColor={house.window}
          />
        );
      })}

      {[
        { x: 220, y: 22, width: 1.55, depth: 0.82, height: 1.08, body: "#7c2d12", awning: "#fb7185", trim: "#fecdd3", window: "#fff7c2" },
        { x: 520, y: 26, width: 1.7, depth: 0.86, height: 1.14, body: "#334155", awning: "#38bdf8", trim: "#dbeafe", window: "#bfdbfe" },
        { x: 1280, y: 24, width: 1.62, depth: 0.84, height: 1.1, body: "#3f3f46", awning: "#22c55e", trim: "#dcfce7", window: "#d1fae5" },
        { x: 1560, y: 20, width: 1.5, depth: 0.8, height: 1.04, body: "#6d4c41", awning: "#f59e0b", trim: "#fde68a", window: "#fef3c7" },
      ].map((store) => {
        const [wx, , wz] = toWorld(store.x, store.y);
        return (
          <StorefrontBlock
            key={`north-storefront-${store.x}-${store.y}`}
            position={[wx, 0, wz]}
            width={store.width}
            depth={store.depth}
            height={store.height}
            bodyColor={store.body}
            awningColor={store.awning}
            trimColor={store.trim}
            windowColor={store.window}
          />
        );
      })}

      {([
        { kind: "tower", x: 54, z: -6.2, width: 1.4, depth: 1.28, height: 2.2, body: "#334155", accent: "#0f172a", window: "#93c5fd" },
        { kind: "store", x: 48, z: -2.6, width: 1.18, depth: 0.76, height: 1.02, body: "#7c2d12", awning: "#f97316", trim: "#fde68a", window: "#fef3c7" },
        { kind: "house", x: 47.8, z: 2.8, width: 1.02, depth: 0.96, height: 0.98, body: "#d8c3a5", roof: "#8d6e63", door: "#5d4037", window: "#fff7c2" },
        { kind: "tower", x: -6.4, z: -6.25, width: 1.32, depth: 1.24, height: 2.06, body: "#475569", accent: "#1e293b", window: "#c4b5fd" },
        { kind: "store", x: -2.2, z: -6.05, width: 1.08, depth: 0.8, height: 1.0, body: "#374151", awning: "#38bdf8", trim: "#dbeafe", window: "#bfdbfe" },
        { kind: "house", x: 2.4, z: -6.15, width: 1.0, depth: 0.94, height: 0.94, body: "#c4d7b2", roof: "#5f7a61", door: "#39503d", window: "#dcfce7" },
      ] as const).map((building) => {
        if (building.kind === "store") {
          return (
            <StorefrontBlock
              key={`perimeter-store-${building.x}-${building.z}`}
              position={[building.x, 0, building.z]}
              rotationY={building.x > 0 ? -Math.PI / 2 : Math.PI / 2}
              width={building.width}
              depth={building.depth}
              height={building.height}
              bodyColor={building.body}
              awningColor={building.awning}
              trimColor={building.trim}
              windowColor={building.window}
            />
          );
        }
        if (building.kind === "house") {
          return (
            <TownhouseBlock
              key={`perimeter-house-${building.x}-${building.z}`}
              position={[building.x, 0, building.z]}
              rotationY={building.z < 0 ? Math.PI : -Math.PI / 2}
              width={building.width}
              depth={building.depth}
              height={building.height}
              bodyColor={building.body}
              roofColor={building.roof}
              doorColor={building.door}
              windowColor={building.window}
            />
          );
        }
        return (
          <TowerBlock
            key={`perimeter-tower-${building.x}-${building.z}`}
            position={[building.x, 0, building.z]}
            width={building.width}
            depth={building.depth}
            height={building.height}
            bodyColor={building.body}
            accentColor={building.accent}
            windowColor={building.window}
          />
        );
      })}

      <mesh position={[localOfficeCenterX, 0.003, northRoadZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[cityRoadSpanX, cityRoadWidth]} />
        <meshStandardMaterial color="#4b5563" roughness={0.95} metalness={0.06} />
      </mesh>
      <mesh position={[localOfficeCenterX, 0.003, southRoadZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[cityRoadSpanX, cityRoadWidth]} />
        <meshStandardMaterial color="#4b5563" roughness={0.95} metalness={0.06} />
      </mesh>
      <mesh position={[westRoadX, 0.003, localOfficeCenterZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[cityRoadWidth, cityRoadSpanZ]} />
        <meshStandardMaterial color="#4b5563" roughness={0.95} metalness={0.06} />
      </mesh>
      <mesh position={[eastRoadX, 0.003, localOfficeCenterZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[cityRoadWidth, cityRoadSpanZ]} />
        <meshStandardMaterial color="#4b5563" roughness={0.95} metalness={0.06} />
      </mesh>

      {Array.from({ length: 12 }).map((_, index) => {
        const x = localOfficeCenterX - cityRoadSpanX / 2 + 0.55 + index * 0.78;
        return (
          <group key={`north-lane-dashes-${index}`}>
            <mesh position={[x, 0.008, northRoadZ]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.34, 0.045]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={0.85} />
            </mesh>
            <mesh position={[x, 0.008, southRoadZ]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.34, 0.045]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={0.85} />
            </mesh>
          </group>
        );
      })}

      {Array.from({ length: 10 }).map((_, index) => {
        const z = localOfficeCenterZ - cityRoadSpanZ / 2 + 0.58 + index * 0.84;
        return (
          <group key={`side-lane-dashes-${index}`}>
            <mesh position={[westRoadX, 0.008, z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.34, 0.045]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={0.85} />
            </mesh>
            <mesh position={[eastRoadX, 0.008, z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.34, 0.045]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={0.85} />
            </mesh>
          </group>
        );
      })}

      {[
        [westRoadX - 0.75, 0, northRoadZ - 0.72],
        [eastRoadX + 0.75, 0, northRoadZ - 0.72],
        [westRoadX - 0.75, 0, southRoadZ + 0.72],
        [eastRoadX + 0.75, 0, southRoadZ + 0.72],
      ].map(([x, y, z], index) => (
        <group key={`park-plot-${index}`} position={[x, y, z]}>
          <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[parkWidth, parkDepth]} />
            <meshStandardMaterial color="#4b7f41" roughness={0.98} metalness={0.01} />
          </mesh>
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
            <boxGeometry args={[parkWidth + 0.1, 0.06, parkDepth + 0.1]} />
            <meshStandardMaterial color="#3f2f1f" roughness={0.9} metalness={0.08} />
          </mesh>
        </group>
      ))}

      {[
        [westRoadX - 1.18, 0, northRoadZ - 0.95],
        [westRoadX - 0.22, 0, northRoadZ - 0.4],
        [eastRoadX + 0.22, 0, northRoadZ - 0.48],
        [eastRoadX + 1.14, 0, northRoadZ - 0.93],
        [westRoadX - 1.12, 0, southRoadZ + 0.95],
        [westRoadX - 0.22, 0, southRoadZ + 0.44],
        [eastRoadX + 0.24, 0, southRoadZ + 0.46],
        [eastRoadX + 1.15, 0, southRoadZ + 0.9],
      ].map(([x, y, z], index) => (
        <StreetTree
          key={`street-tree-${index}`}
          position={[x, y, z]}
          canopyColor={index % 2 === 0 ? "#3f9142" : "#4ea34a"}
        />
      ))}

      {[
        [localOfficeCenterX - 2.2, 0, northRoadZ + 0.05, 0, "#e53935"],
        [localOfficeCenterX + 1.1, 0, northRoadZ - 0.06, 0, "#1d4ed8"],
        [localOfficeCenterX - 1.4, 0, southRoadZ + 0.08, Math.PI, "#f59e0b"],
        [localOfficeCenterX + 2.35, 0, southRoadZ - 0.05, Math.PI, "#16a34a"],
        [westRoadX + 0.02, 0, localOfficeCenterZ - 1.7, -Math.PI / 2, "#8b5cf6"],
        [westRoadX - 0.03, 0, localOfficeCenterZ + 1.6, -Math.PI / 2, "#ef4444"],
        [eastRoadX - 0.02, 0, localOfficeCenterZ - 1.2, Math.PI / 2, "#0284c7"],
        [eastRoadX + 0.03, 0, localOfficeCenterZ + 1.95, Math.PI / 2, "#f97316"],
      ].map(([x, y, z, rotationY, bodyColor], index) => (
        <CompactCar
          key={`city-car-${index}`}
          position={[x as number, y as number, z as number]}
          rotationY={rotationY as number}
          bodyColor={bodyColor as string}
        />
      ))}

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
            <mesh position={[localOfficeCenterX, 0.5, localSouthWallZ]} receiveShadow>
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
      <mesh position={[localOfficeCenterX, 0.03, localSouthWallZ - 0.04]}>
        <boxGeometry args={[localOfficeWidth, 0.06, 0.04]} />
        <meshLambertMaterial color="#0c0c10" />
      </mesh>
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
  if (showRemoteOffice) return null;
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
