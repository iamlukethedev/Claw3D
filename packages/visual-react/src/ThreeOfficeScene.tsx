"use client";

import { Environment, Grid, OrbitControls, RoundedBox, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Mesh } from "three";
import type { VisualOfficeViewModel } from "@claw3d/visual-core";

type SceneActor = VisualOfficeViewModel["actors"][number];

const STATUS_COLORS: Record<SceneActor["status"], string> = {
  unknown: "#64748b",
  idle: "#94a3b8",
  working: "#22d3ee",
  voice: "#fbbf24",
  error: "#fb7185",
  offline: "#475569",
};

function ActorNode({ actor }: { actor: SceneActor }) {
  const mesh = useRef<Mesh>(null);
  const phase = useMemo(
    () => actor.id.split("").reduce((value, character) => value + character.charCodeAt(0), 0) / 10,
    [actor.id],
  );

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const active = actor.status === "working" || actor.status === "voice";
    mesh.current.position.y = 0.72 + (active ? Math.sin(clock.elapsedTime * 3 + phase) * 0.12 : 0);
    mesh.current.rotation.y = active ? clock.elapsedTime * 0.35 + phase : phase;
  });

  return (
    <group position={[actor.position.x, 0, actor.position.z]}>
      <mesh ref={mesh} castShadow>
        <capsuleGeometry args={[0.32, 0.58, 6, 12]} />
        <meshStandardMaterial
          color={actor.color}
          emissive={STATUS_COLORS[actor.status]}
          emissiveIntensity={actor.status === "working" ? 0.38 : 0.12}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0, 0.11, 0]} receiveShadow>
        <cylinderGeometry args={[0.58, 0.68, 0.12, 24]} />
        <meshStandardMaterial color={STATUS_COLORS[actor.status]} transparent opacity={0.7} />
      </mesh>
      <Text
        position={[0, 1.62, 0]}
        fontSize={0.25}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
      >
        {actor.displayName}
      </Text>
      <Text
        position={[0, 1.34, 0]}
        fontSize={0.16}
        color={STATUS_COLORS[actor.status]}
        anchorX="center"
        anchorY="middle"
      >
        {actor.status}
      </Text>
    </group>
  );
}

function Desk({ position, accent }: { position: [number, number, number]; accent: string }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.7, 0.14, 0.82]} radius={0.08} smoothness={4} castShadow>
        <meshStandardMaterial color="#24344b" roughness={0.55} />
      </RoundedBox>
      <mesh position={[-0.66, -0.48, 0]} castShadow>
        <boxGeometry args={[0.12, 0.9, 0.64]} />
        <meshStandardMaterial color="#172033" />
      </mesh>
      <mesh position={[0.66, -0.48, 0]} castShadow>
        <boxGeometry args={[0.12, 0.9, 0.64]} />
        <meshStandardMaterial color="#172033" />
      </mesh>
      <mesh position={[0, 0.45, -0.08]} castShadow>
        <boxGeometry args={[0.68, 0.45, 0.06]} />
        <meshStandardMaterial color="#07111f" emissive={accent} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

export interface ThreeOfficeSceneProps {
  viewModel: VisualOfficeViewModel;
  reducedMotion?: boolean;
}

export function ThreeOfficeScene({ viewModel, reducedMotion = false }: ThreeOfficeSceneProps) {
  return (
    <div className="visual-three-canvas" aria-label="Interactive 3D office visualization">
      <Canvas
        shadows
        camera={{ position: [8.4, 8.1, 9.2], fov: 43, near: 0.1, far: 80 }}
        dpr={[1, 1.6]}
      >
        <color attach="background" args={["#07101d"]} />
        <fog attach="fog" args={["#07101d", 14, 28]} />
        <ambientLight intensity={0.85} />
        <directionalLight
          castShadow
          intensity={2.2}
          color="#b9d8ff"
          position={[5, 9, 4]}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-5, 3, -3]} intensity={24} color="#22d3ee" distance={11} />
        <pointLight position={[5, 3, 3]} intensity={20} color="#8b5cf6" distance={10} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[14, 10]} />
          <meshStandardMaterial color="#0c1728" roughness={0.88} metalness={0.12} />
        </mesh>
        <Grid
          position={[0, 0.012, 0]}
          args={[14, 10]}
          cellSize={0.5}
          cellThickness={0.45}
          cellColor="#20324b"
          sectionSize={2}
          sectionThickness={0.9}
          sectionColor="#365170"
          fadeDistance={18}
          fadeStrength={1}
          infiniteGrid={false}
        />
        <Desk position={[-3.2, 1.08, -1.3]} accent="#22d3ee" />
        <Desk position={[0, 1.08, 1.4]} accent="#8b5cf6" />
        <Desk position={[3.2, 1.08, -1.3]} accent="#fb7185" />
        <Desk position={[0, 1.08, -3.3]} accent="#fbbf24" />
        {viewModel.actors.map((actor) => (
          <ActorNode key={actor.id} actor={reducedMotion ? { ...actor, status: actor.status === "working" ? "idle" : actor.status } : actor} />
        ))}
        <Environment preset="city" environmentIntensity={0.18} />
        <OrbitControls
          makeDefault
          enableDamping={!reducedMotion}
          minDistance={7}
          maxDistance={18}
          minPolarAngle={0.45}
          maxPolarAngle={1.28}
          target={[0, 0.5, 0]}
        />
      </Canvas>
    </div>
  );
}
