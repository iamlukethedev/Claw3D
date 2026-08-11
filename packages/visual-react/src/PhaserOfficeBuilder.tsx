"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PhaserModule = typeof import("phaser");

export interface VisualLayoutItem {
  id: string;
  label: string;
  x: number;
  y: number;
  color: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  kind?: "furniture" | "light" | "emitter" | "interaction";
}

export interface PhaserOfficeBuilderProps {
  items: VisualLayoutItem[];
  persistenceEnabled: boolean;
  onLayoutChange(items: VisualLayoutItem[]): void;
  onClearBrowserPreferences(): void;
  onReturnToOffice(): void;
}

interface BuilderToggles {
  debug: boolean;
  lighting: boolean;
  ambience: boolean;
  thoughtBubbles: boolean;
}

function createVisualBuilderScene(
  Phaser: PhaserModule,
  readItems: () => VisualLayoutItem[],
  selectedId: string | null,
  toggles: BuilderToggles,
  emitChange: (items: VisualLayoutItem[]) => void,
  select: (itemId: string | null) => void,
) {
  return class VisualBuilderScene extends Phaser.Scene {
    create() {
      const width = this.scale.width;
      const height = this.scale.height;
      this.cameras.main.setBackgroundColor(toggles.ambience ? "#101a23" : "#0c141c");

      if (toggles.debug) {
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x20303d, 0.32);
        for (let x = 0; x <= width; x += 64) grid.lineBetween(x, 0, x, height);
        for (let y = 0; y <= height; y += 64) grid.lineBetween(0, y, width, y);
      }

      this.input.on("pointerdown", (_pointer: unknown, targets: unknown[]) => {
        if (targets.length === 0) select(null);
      });

      readItems().forEach((item) => {
        const active = item.id === selectedId;
        const fill = toggles.lighting ? 0x467eae : 0x365f82;
        const node = this.add.rectangle(item.x, item.y, 32, 32, item.kind ? item.color : fill, 1);
        node
          .setRotation(item.rotation ?? 0)
          .setScale(item.flipX ? -1 : 1, item.flipY ? -1 : 1)
          .setStrokeStyle(active ? 2 : 1, active ? 0x7dd3fc : 0x6da3ca, active ? 1 : 0.35)
          .setInteractive({ draggable: true, useHandCursor: true });

        if (toggles.thoughtBubbles && active) {
          this.add.circle(item.x + 18, item.y - 20, 4, 0xd9edf7, 0.8);
          this.add.circle(item.x + 24, item.y - 27, 2, 0xd9edf7, 0.65);
        }

        if (toggles.debug) {
          this.add.text(item.x + 22, item.y - 7, item.label, {
            color: "#8296a8",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: "9px",
          });
        }

        node.on("pointerdown", () => select(item.id));
        node.on("drag", (_pointer: unknown, dragX: number, dragY: number) => {
          node.setPosition(Math.round(dragX / 8) * 8, Math.round(dragY / 8) * 8);
        });
        node.on("dragend", () => {
          emitChange(
            readItems().map((candidate) =>
              candidate.id === item.id ? { ...candidate, x: node.x, y: node.y } : candidate,
            ),
          );
        });
      });
    }
  };
}

export function PhaserOfficeBuilder({
  items,
  persistenceEnabled,
  onLayoutChange,
  onClearBrowserPreferences,
  onReturnToOffice,
}: PhaserOfficeBuilderProps) {
  const host = useRef<HTMLDivElement>(null);
  const latestItems = useRef(items);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<VisualLayoutItem[][]>([]);
  const [future, setFuture] = useState<VisualLayoutItem[][]>([]);
  const [toggles, setToggles] = useState<BuilderToggles>({
    debug: true,
    lighting: true,
    ambience: true,
    thoughtBubbles: true,
  });
  latestItems.current = items;

  const commit = useCallback((next: VisualLayoutItem[]) => {
    setPast((value) => [...value, items]);
    setFuture([]);
    onLayoutChange(next);
  }, [items, onLayoutChange]);

  const updateSelected = (update: (item: VisualLayoutItem) => VisualLayoutItem) => {
    if (!selectedId) return;
    commit(items.map((item) => (item.id === selectedId ? update(item) : item)));
  };

  const addItem = (kind: NonNullable<VisualLayoutItem["kind"]>, color: number) => {
    const index = items.length + 1;
    const item: VisualLayoutItem = {
      id: `${kind}-${index}`,
      label: `${kind} ${index}`,
      x: 180 + ((index * 97) % 620),
      y: 110 + ((index * 73) % 360),
      color,
      kind,
    };
    setSelectedId(item.id);
    commit([...items, item]);
  };

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((value) => value.slice(0, -1));
    setFuture((value) => [items, ...value]);
    onLayoutChange(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((value) => value.slice(1));
    setPast((value) => [...value, items]);
    onLayoutChange(next);
  };

  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [items, selectedId]);

  useEffect(() => {
    let disposed = false;
    let game: { destroy(removeCanvas: boolean): void } | null = null;

    void import("phaser").then(({ default: Phaser }) => {
      if (disposed || !host.current) return;
      const VisualBuilderScene = createVisualBuilderScene(
        Phaser,
        () => latestItems.current,
        selectedId,
        toggles,
        commit,
        setSelectedId,
      );
      game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: host.current,
        width: host.current.clientWidth,
        height: Math.max(520, host.current.clientHeight),
        backgroundColor: "#101a23",
        scene: VisualBuilderScene,
        render: { antialias: true, pixelArt: false },
      });
    });

    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, [commit, items, selectedId, toggles]);

  const toggle = (key: keyof BuilderToggles) => {
    setToggles((value) => ({ ...value, [key]: !value[key] }));
  };

  return (
    <main className="legacy-builder-shell">
      <aside className="legacy-builder-controls" aria-label="Builder controls">
        <h1>builder controls</h1>
        <button type="button" onClick={undo} disabled={past.length === 0}>undo</button>
        <button type="button" onClick={redo} disabled={future.length === 0}>redo</button>
        <button type="button" onClick={() => updateSelected((item) => ({ ...item, rotation: (item.rotation ?? 0) + Math.PI / 2 }))} disabled={!selectedId}>rotate selected</button>
        <button type="button" onClick={() => updateSelected((item) => ({ ...item, flipX: !item.flipX }))} disabled={!selectedId}>flip selected x</button>
        <button type="button" onClick={() => updateSelected((item) => ({ ...item, flipY: !item.flipY }))} disabled={!selectedId}>flip selected y</button>
        <button type="button" onClick={() => addItem("light", 0xfacc15)}>add light</button>
        <button type="button" onClick={() => addItem("emitter", 0xa855f7)}>add emitter</button>
        <button type="button" onClick={() => addItem("interaction", 0x22d3ee)}>add interaction point</button>

        <div className="legacy-builder-divider" />
        <h2>simulation toggles</h2>
        {(Object.keys(toggles) as Array<keyof BuilderToggles>).map((key) => (
          <label key={key}>
            <span>{key === "thoughtBubbles" ? "thought bubbles" : key}</span>
            <input type="checkbox" checked={toggles[key]} onChange={() => toggle(key)} />
          </label>
        ))}
        <p>selected {selectedId ? 1 : 0}</p>

        <div className="legacy-builder-footer">
          <span>{persistenceEnabled ? "local layout enabled" : "browser persistence disabled"}</span>
          <button type="button" onClick={onClearBrowserPreferences}>erase browser preferences</button>
          <button type="button" onClick={onReturnToOffice}>return to office</button>
        </div>
      </aside>
      <section className="legacy-builder-canvas" ref={host} aria-label="Interactive Phaser office builder" />
    </main>
  );
}
