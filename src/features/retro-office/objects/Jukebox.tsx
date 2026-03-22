"use client";

import { useRef, useState } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { useJukeboxStore } from "@/features/spotify-jukebox/state/jukebox-store";

interface JukeboxProps {
  position?: [number, number, number];
  onInteract?: () => void;
}

// Jukebox colors
const JUKEBOX_COLORS = {
  cabinet: "#8B4513", // Saddle brown
  cabinetDark: "#5D2E0C",
  metal: "#C0C0C0", // Silver
  metalDark: "#808080",
  neon: "#FF1493", // Deep pink neon
  neonActive: "#00FF00", // Green when playing
  display: "#000000",
  displayText: "#00FF00",
  record: "#1a1a1a",
  recordLabel: "#FF1493",
};

export function Jukebox({ position = [5, 0, -3], onInteract }: JukeboxProps) {
  const groupRef = useRef<THREE.Group>(null);
  const recordRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  const { currentTrack, isPlaying, isAuthenticated } = useJukeboxStore();
  const [hovered, setHovered] = useState(false);

  // Rotate record when playing
  useFrame((_state, delta) => {
    if (recordRef.current && isPlaying) {
      recordRef.current.rotation.y += delta * 2;
    }

    // Pulse glow when playing
    if (glowRef.current && isPlaying) {
      const pulse = Math.sin(_state.clock.elapsedTime * 4) * 0.3 + 0.7;
      glowRef.current.intensity = pulse * 2;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onInteract?.();
  };

  return (
    <group ref={groupRef} position={position}>
      {/* Main cabinet */}
      <mesh
        position={[0, 0.75, 0]}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.8, 1.2, 0.6]} />
        <meshStandardMaterial
          color={JUKEBOX_COLORS.cabinet}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {/* Cabinet top dome */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.5, 0.2, 32]} />
        <meshStandardMaterial
          color={JUKEBOX_COLORS.cabinetDark}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>

      {/* Dome top */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={JUKEBOX_COLORS.metal}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>

      {/* Display screen */}
      <mesh position={[0, 1.1, 0.31]}>
        <planeGeometry args={[0.6, 0.35]} />
        <meshStandardMaterial
          color={JUKEBOX_COLORS.display}
          emissive={isPlaying ? JUKEBOX_COLORS.neonActive : JUKEBOX_COLORS.neon}
          emissiveIntensity={hovered ? 0.5 : 0.2}
        />
      </mesh>

      {/* Track info on display */}
      <Billboard position={[0, 1.1, 0.32]} follow={true}>
        <Text
          fontSize={0.08}
          color={JUKEBOX_COLORS.displayText}
          anchorX="center"
          anchorY="middle"
          maxWidth={0.55}
          textAlign="center"
        >
          {currentTrack?.name || (isAuthenticated ? "Select Music" : "Connect Spotify")}
        </Text>
        {currentTrack && (
          <Text
            position={[0, -0.12, 0]}
            fontSize={0.06}
            color="#888888"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.55}
            textAlign="center"
          >
            {currentTrack.artists.map((a) => a.name).join(", ")}
          </Text>
        )}
      </Billboard>

      {/* Record slot area */}
      <mesh position={[0, 0.7, 0.31]}>
        <boxGeometry args={[0.5, 0.08, 0.02]} />
        <meshStandardMaterial
          color={JUKEBOX_COLORS.metalDark}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* Spinning record */}
      <mesh
        ref={recordRef}
        position={[0, 0.75, 0.35]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.22, 0.22, 0.02, 32]} />
        <meshStandardMaterial
          color={JUKEBOX_COLORS.record}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Record label (visible when not playing) */}
      {!isPlaying && (
        <mesh position={[0, 0.75, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.08, 32]} />
          <meshStandardMaterial
            color={JUKEBOX_COLORS.recordLabel}
            emissive={JUKEBOX_COLORS.neon}
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      {/* Selection buttons */}
      <group position={[0, 0.5, 0.31]}>
        {[...Array(5)].map((_, i) => (
          <mesh
            key={i}
            position={[-0.15 + i * 0.075, 0, 0.01]}
          >
            <cylinderGeometry args={[0.025, 0.025, 0.02, 16]} />
            <meshStandardMaterial
              color={i === 0 ? "#FF0000" : i === 1 ? "#FFFF00" : i === 2 ? "#00FF00" : i === 3 ? "#00FFFF" : "#FF00FF"}
              emissive={i === 0 ? "#FF0000" : i === 1 ? "#FFFF00" : i === 2 ? "#00FF00" : i === 3 ? "#00FFFF" : "#FF00FF"}
              emissiveIntensity={0.5}
            />
          </mesh>
        ))}
      </group>

      {/* Side grilles */}
      <mesh position={[-0.35, 0.75, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.8, 0.6]} />
        <meshStandardMaterial
          color={JUKEBOX_COLORS.metalDark}
          roughness={0.5}
          metalness={0.4}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh position={[0.35, 0.75, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.8, 0.6]} />
        <meshStandardMaterial
          color={JUKEBOX_COLORS.metalDark}
          roughness={0.5}
          metalness={0.4}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Base */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[0.9, 0.1, 0.7]} />
        <meshStandardMaterial
          color={JUKEBOX_COLORS.cabinetDark}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Glow effect when playing */}
      {isPlaying && (
        <pointLight
          ref={glowRef}
          position={[0, 1.2, 0.5]}
          color={JUKEBOX_COLORS.neonActive}
          intensity={1}
          distance={3}
        />
      )}

      {/* Hover indicator */}
      {hovered && (
        <mesh position={[0, 1.6, 0]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial
            color="#00FF00"
            emissive="#00FF00"
            emissiveIntensity={1}
          />
        </mesh>
      )}
    </group>
  );
}
