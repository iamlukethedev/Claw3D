"use client";

import { useEffect, useRef } from "react";

type PhaserModule = typeof import("phaser");

export interface VisualLayoutItem {
  id: string;
  label: string;
  x: number;
  y: number;
  color: number;
}

export interface PhaserOfficeBuilderProps {
  items: VisualLayoutItem[];
  persistenceEnabled: boolean;
  onLayoutChange(items: VisualLayoutItem[]): void;
  onClearBrowserPreferences(): void;
  onReturnToOffice(): void;
}

function createVisualBuilderScene(
  Phaser: PhaserModule,
  readItems: () => VisualLayoutItem[],
  emitChange: (items: VisualLayoutItem[]) => void,
) {
  return class VisualBuilderScene extends Phaser.Scene {
    create() {
      const width = this.scale.width;
      const height = this.scale.height;
      this.cameras.main.setBackgroundColor("#07101d");
      const grid = this.add.graphics();
      grid.lineStyle(1, 0x20324b, 0.65);
      for (let x = 0; x <= width; x += 32) grid.lineBetween(x, 0, x, height);
      for (let y = 0; y <= height; y += 32) grid.lineBetween(0, y, width, y);

      readItems().forEach((item) => {
        const node = this.add.rectangle(item.x, item.y, 116, 64, item.color, 0.95);
        node.setStrokeStyle(2, 0xffffff, 0.2).setInteractive({ draggable: true, useHandCursor: true });
        const label = this.add.text(item.x, item.y, item.label, {
          color: "#e2e8f0",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: "13px",
        }).setOrigin(0.5);
        node.on("drag", (_pointer: unknown, dragX: number, dragY: number) => {
          const x = Math.round(dragX / 16) * 16;
          const y = Math.round(dragY / 16) * 16;
          node.setPosition(x, y);
          label.setPosition(x, y);
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
  const changeHandler = useRef(onLayoutChange);
  latestItems.current = items;
  changeHandler.current = onLayoutChange;

  useEffect(() => {
    let disposed = false;
    let game: { destroy(removeCanvas: boolean): void } | null = null;

    void import("phaser").then(({ default: Phaser }) => {
      if (disposed || !host.current) return;
      const VisualBuilderScene = createVisualBuilderScene(
        Phaser,
        () => latestItems.current,
        (next) => changeHandler.current(next),
      );

      game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: host.current,
        width: host.current.clientWidth,
        height: Math.max(520, host.current.clientHeight),
        backgroundColor: "#07101d",
        scene: VisualBuilderScene,
        render: { antialias: true, pixelArt: false },
      });
    });

    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, [items]);

  return (
    <main className="visual-builder-shell">
      <header className="visual-builder-header">
        <div>
          <p className="visual-kicker">Claw3D · Phaser layout laboratory</p>
          <h1>Visual office builder</h1>
          <span>Drag code-native objects. No publish, filesystem, or runtime mutation.</span>
        </div>
        <button type="button" className="visual-builder-return" onClick={onReturnToOffice}>Return to office</button>
      </header>
      <section className="visual-builder-layout">
        <aside className="visual-builder-panel">
          <h2>Layout objects</h2>
          {items.map((item) => (
            <div key={item.id}><span style={{ backgroundColor: `#${item.color.toString(16).padStart(6, "0")}` }} /><strong>{item.label}</strong></div>
          ))}
          <p>{persistenceEnabled ? "Local layout persistence is enabled." : "Layout persistence is disabled."}</p>
          <button type="button" onClick={onClearBrowserPreferences}>Erase browser preferences</button>
        </aside>
        <div className="visual-builder-canvas" ref={host} aria-label="Interactive Phaser office builder" />
      </section>
    </main>
  );
}
