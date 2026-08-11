"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type CSSProperties,
} from "react";
import * as THREE from "three";
import type { AssetResolver, VisualActor, VisualConnectionState, VisualSnapshot } from "@claw3d/visual-contract";
import {
  isRetiredPingPongLamp,
  materializeDefaults,
} from "@/features/retro-office/core/furnitureDefaults";
import {
  DISTRICT_CAMERA_POSITION,
  DISTRICT_CAMERA_TARGET,
  LOCAL_OFFICE_CANVAS_HEIGHT,
  LOCAL_OFFICE_CANVAS_WIDTH,
} from "@/features/retro-office/core/district";
import { toWorld } from "@/features/retro-office/core/geometry";
import type {
  FurnitureItem,
  OfficeAgent,
  RenderAgent,
} from "@/features/retro-office/core/types";
import { AgentModel } from "@/features/retro-office/objects/agents";
import { FloorAndWalls, WallPictures } from "@/features/retro-office/scene/environment";
import {
  CAMERA_PRESETS,
  CameraAnimator,
} from "@/features/retro-office/systems/cameraLighting";
import { HeatmapSystem, TrailSystem } from "@/features/retro-office/systems/visualSystems";
import { ReadOnlyFurnitureClone } from "./ReadOnlyFurnitureScene";

const ACTOR_ITEMS = [
  "globe",
  "books",
  "coffee",
  "palette",
  "camera",
  "waveform",
  "shield",
  "fire",
  "plant",
  "laptop",
] as const;

const SPAWN_POINTS = [
  { x: 650, y: 180, facing: 0.35 },
  { x: 520, y: 330, facing: -0.25 },
  { x: 820, y: 250, facing: 0.15 },
  { x: 700, y: 500, facing: -0.35 },
  { x: 900, y: 380, facing: 0.45 },
  { x: 420, y: 520, facing: -0.2 },
] as const;

const CAMERA_TARGET = toWorld(
  LOCAL_OFFICE_CANVAS_WIDTH / 2,
  LOCAL_OFFICE_CANVAS_HEIGHT / 2,
) as [number, number, number];

const CAMERA_POSITION: [number, number, number] = [
  CAMERA_TARGET[0] + (DISTRICT_CAMERA_POSITION[0] - DISTRICT_CAMERA_TARGET[0]),
  CAMERA_TARGET[1] + (DISTRICT_CAMERA_POSITION[1] - DISTRICT_CAMERA_TARGET[1]),
  CAMERA_TARGET[2] + (DISTRICT_CAMERA_POSITION[2] - DISTRICT_CAMERA_TARGET[2]),
];

function materializeLobby(): FurnitureItem[] {
  return materializeDefaults("lobby").filter((item) => !isRetiredPingPongLamp(item));
}

function deterministicItem(actorId: string): string {
  const value = [...actorId].reduce((total, character) => total + character.charCodeAt(0), 0);
  return ACTOR_ITEMS[value % ACTOR_ITEMS.length] ?? "laptop";
}

function mapActor(actor: VisualActor): OfficeAgent {
  return {
    id: actor.id,
    name: actor.displayName,
    subtitle: actor.role ?? null,
    status:
      actor.status === "error"
        ? "error"
        : actor.status === "working" || actor.status === "voice"
          ? "working"
          : "idle",
    color: actor.color,
    item: deterministicItem(actor.id),
    avatarProfile: null,
  };
}

function buildRenderAgents(actors: OfficeAgent[]): RenderAgent[] {
  return actors.map((actor, index) => {
    const spawn = SPAWN_POINTS[index % SPAWN_POINTS.length] ?? SPAWN_POINTS[0];
    return {
      ...actor,
      x: spawn.x + Math.floor(index / SPAWN_POINTS.length) * 38,
      y: spawn.y,
      targetX: spawn.x,
      targetY: spawn.y,
      path: [],
      facing: spawn.facing,
      frame: 0,
      walkSpeed: 0,
      phaseOffset: index * 0.7,
      state: "standing",
    };
  });
}

function CameraRig({ target }: { target: [number, number, number] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, target]);
  return null;
}

function TinyIcon({ kind }: { kind: "overview" | "desk" | "lounge" | "heat" | "trail" }) {
  if (kind === "overview") return <span aria-hidden="true">⌗</span>;
  if (kind === "desk") return <span aria-hidden="true">▰</span>;
  if (kind === "lounge") return <span aria-hidden="true">▱</span>;
  if (kind === "heat") return <span aria-hidden="true">◫</span>;
  return <span aria-hidden="true">⌖</span>;
}

export interface FaithfulThreeOfficeProps {
  assetResolver: AssetResolver;
  snapshot: VisualSnapshot | null;
  connection: VisualConnectionState;
  title?: string;
  runtimeLabel: string;
  reducedMotion?: boolean;
}

export function FaithfulThreeOffice({
  assetResolver,
  snapshot,
  connection,
  title = "Visual Headquarters",
  runtimeLabel,
}: FaithfulThreeOfficeProps) {
  const furniture = useMemo(() => materializeLobby(), []);
  const actors = useMemo(() => (snapshot?.actors ?? []).map(mapActor), [snapshot?.actors]);
  const renderAgents = useMemo(() => buildRenderAgents(actors), [actors]);
  const renderAgentsRef = useRef<RenderAgent[]>(renderAgents);
  const renderAgentLookupRef = useRef<Map<string, RenderAgent>>(new Map());
  const orbitRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const cameraPresetRef = useRef<{
    pos: [number, number, number];
    target: [number, number, number];
    zoom?: number;
  } | null>(null);
  const heatGridRef = useRef<Uint16Array | null>(null);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [trailMode, setTrailMode] = useState(false);

  useEffect(() => {
    renderAgentsRef.current = renderAgents;
    renderAgentLookupRef.current = new Map(renderAgents.map((actor) => [actor.id, actor]));
  }, [renderAgents]);
  const colorMap = useMemo(
    () => new Map(actors.map((actor) => [actor.id, actor.color])),
    [actors],
  );
  const workingCount = actors.filter((actor) => actor.status === "working").length;
  const idleCount = actors.filter((actor) => actor.status === "idle").length;
  const errorCount = actors.filter((actor) => actor.status === "error").length;
  const connectionLabel = connection.phase === "online"
    ? "connected"
    : connection.phase === "loading" || connection.phase === "reconnecting"
      ? "connecting"
      : "disconnected";

  const focusActor = (actorId: string) => {
    const actor = renderAgentLookupRef.current.get(actorId);
    if (!actor) return;
    const [x, , z] = toWorld(actor.x, actor.y);
    cameraPresetRef.current = {
      pos: [x + 3.1, 3.5, z + 3.1],
      target: [x, 0.55, z],
      zoom: 72,
    };
  };

  return (
    <div className="faithful-office-root">
      <div className="faithful-office-canvas" onDoubleClick={() => orbitRef.current?.reset()}>
        <Canvas
          orthographic
          dpr={[0.85, 1.5]}
          camera={{ position: CAMERA_POSITION, zoom: 56, near: 0.1, far: 100 }}
          shadows={{ type: THREE.PCFShadowMap }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <CameraRig target={CAMERA_TARGET} />
          <OrbitControls
            ref={orbitRef}
            target={CAMERA_TARGET}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.6}
            zoomSpeed={0.8}
            panSpeed={0.6}
            minZoom={25}
            maxZoom={120}
            maxPolarAngle={Math.PI / 2.2}
            mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
          />
          <CameraAnimator presetRef={cameraPresetRef} orbitRef={orbitRef} />
          <ambientLight intensity={0.72} color="#d8d4c8" />
          <directionalLight
            position={[8, 14, 6]}
            intensity={1.1}
            color="#f6f1e6"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0002}
            shadow-normalBias={0.02}
          />
          <directionalLight position={[-5, 8, -4]} intensity={0.4} color="#7090ff" />
          <FloorAndWalls showRemoteOffice={false} />
          <WallPictures showRemoteOffice={false} />
          <hemisphereLight args={["#f4efe6", "#12131a", 1.15]} />
          <ReadOnlyFurnitureClone furniture={furniture} assetResolver={assetResolver} />
          {renderAgents.map((actor) => (
            <AgentModel
              key={actor.id}
              agentId={actor.id}
              name={actor.name}
              subtitle={"subtitle" in actor ? actor.subtitle : null}
              status={actor.status}
              color={actor.color}
              appearance={"avatarProfile" in actor ? actor.avatarProfile : null}
              agentsRef={renderAgentsRef}
              agentLookupRef={renderAgentLookupRef}
              onClick={focusActor}
            />
          ))}
          <HeatmapSystem agentsRef={renderAgentsRef} heatmapMode={heatmapMode} heatGridRef={heatGridRef} />
          {trailMode ? <TrailSystem agentsRef={renderAgentsRef} colorMap={colorMap} /> : null}
        </Canvas>
      </div>

      <nav className="faithful-camera-controls" aria-label="Camera presets">
        {(["overview", "frontDesk", "lounge"] as const).map((preset) => (
          <button
            key={preset}
            type="button"
            title={preset === "frontDesk" ? "Front desk" : `${preset[0]?.toUpperCase()}${preset.slice(1)}`}
            onClick={() => { cameraPresetRef.current = CAMERA_PRESETS[preset]; }}
          >
            <TinyIcon kind={preset === "frontDesk" ? "desk" : preset} />
          </button>
        ))}
      </nav>

      <header className="faithful-office-title" aria-label={title}>
        <i /><strong>{title}</strong><i />
      </header>

      <div className="faithful-roster-summary">
        <div className="faithful-roster-avatars">
          {actors.slice(0, 5).map((actor) => (
            <button
              key={actor.id}
              type="button"
              title={actor.name}
              onClick={() => focusActor(actor.id)}
              style={{ "--faithful-actor": actor.color } as CSSProperties}
            >
              {actor.name.trim().slice(0, 1).toUpperCase() || "?"}
            </button>
          ))}
        </div>
        <span aria-hidden="true">♧</span>
        <strong>{actors.length} agents</strong>
      </div>

      <div className="faithful-runtime-tools">
        <span className={`faithful-runtime faithful-runtime-${connectionLabel}`}>
          {runtimeLabel} • {connectionLabel}
        </span>
        <button type="button" title="Toggle heatmap" aria-pressed={heatmapMode} onClick={() => setHeatmapMode((value) => !value)}>
          <TinyIcon kind="heat" />
        </button>
        <button type="button" title="Toggle trails" aria-pressed={trailMode} onClick={() => setTrailMode((value) => !value)}>
          <TinyIcon kind="trail" />
        </button>
      </div>

      <div className="faithful-scene-status">
        <span>{workingCount} working</span><i>·</i>
        <span>{idleCount} idle</span><i>·</i>
        <span>{errorCount} error</span><i>·</i>
        <span>{workingCount > 0 ? "buzzing" : "quiet"}</span><i>·</i>
        <span>drag · scroll · space+drag · dbl-click</span>
      </div>
    </div>
  );
}
