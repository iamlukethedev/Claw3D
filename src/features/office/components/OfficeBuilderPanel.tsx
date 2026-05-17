"use client";

import { useMemo, useState } from "react";
import { T, useTranslation } from "@/lib/i18n/TranslationProvider";

import { OfficePhaserCanvas } from "@/features/office/components/OfficePhaserCanvas";
import { useOfficeBuilderStore } from "@/features/office/state/useOfficeBuilderStore";
import type { OfficeMap } from "@/lib/office/schema";

type OfficeBuilderPanelProps = {
  initialMap: OfficeMap;
  workspaceId: string;
  officeId: string;
};

const nextId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;

export function OfficeBuilderPanel({ initialMap, workspaceId, officeId }: OfficeBuilderPanelProps) {
  const { t } = useTranslation();
  const store = useOfficeBuilderStore(initialMap);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("");
  const [showDebug, setShowDebug] = useState(true);
  const [lightingEnabled, setLightingEnabled] = useState(true);
  const [ambienceEnabled, setAmbienceEnabled] = useState(true);
  const [thoughtEnabled, setThoughtEnabled] = useState(true);

  const saveVersion = async () => {
    const versionId = `v${Date.now()}`;
    const response = await fetch("/api/office", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveVersion",
        workspaceId,
        officeId,
        versionId,
        createdBy: "studio",
        notes: "builder save",
        map: store.map,
      }),
    });
    if (!response.ok) {
      setMessage(t("builder.save_failed", "儲存失敗"));
      return;
    }
    setMessage(t("builder.saved", "已儲存 %{id}").replace("%{id}", versionId));
  };

  const publishLatest = async () => {
    const response = await fetch("/api/office/publish", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        officeId,
        publishedBy: "studio",
      }),
    });
    if (!response.ok) {
      setMessage(t("builder.publish_failed", "發布失敗"));
      return;
    }
    setMessage(t("builder.published", "已發布"));
  };

  const debug = useMemo(
    () => ({
      showZones: showDebug,
      showAnchors: showDebug,
      showEmitterBounds: showDebug,
      showLightBounds: showDebug,
      showMetrics: true,
    }),
    [showDebug]
  );

  return (
    <div className="flex h-full w-full gap-3">
      <aside className="ui-panel w-72 shrink-0 overflow-y-auto p-3">
        <div className="font-mono text-[11px] text-muted-foreground"><T id="builder.controls" fallback="建構器控制項" /></div>
        <div className="mt-3 flex flex-col gap-2">
          <button type="button" className="ui-btn-secondary px-2 py-1 text-left text-xs" onClick={store.undo}>
            <T id="builder.undo" fallback="復原" />
          </button>
          <button type="button" className="ui-btn-secondary px-2 py-1 text-left text-xs" onClick={store.redo}>
            <T id="builder.redo" fallback="重做" />
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() => store.rotateSelected(90)}
          >
            <T id="builder.rotate" fallback="旋轉選取物件" />
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() => store.flipSelected("x")}
          >
            <T id="builder.flip_x" fallback="水平翻轉選取物件" />
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() => store.flipSelected("y")}
          >
            <T id="builder.flip_y" fallback="垂直翻轉選取物件" />
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() =>
              store.addLight({
                id: nextId("light"),
                preset: "ceiling_lamp",
                animationPreset: "soft_flicker",
                x: 220,
                y: 180,
                radius: 120,
                baseIntensity: 0.45,
                enabled: true,
              })
            }
          >
            <T id="builder.add_light" fallback="新增光源" />
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() =>
              store.addEmitter({
                id: nextId("emitter"),
                preset: "coffee_steam",
                zoneId: store.map.zones[0]?.id ?? "",
                enabled: true,
                maxParticles: 12,
                spawnRate: 0.15,
              })
            }
          >
            <T id="builder.add_emitter" fallback="新增粒子發射器" />
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() =>
              store.addInteractionPoint({
                id: nextId("interaction"),
                kind: "tv_watch",
                x: 260,
                y: 220,
                tags: [],
              })
            }
          >
            <T id="builder.add_interaction" fallback="新增互動點" />
          </button>
          <button type="button" className="ui-btn-primary px-2 py-1 text-left text-xs" onClick={saveVersion}>
            <T id="builder.save_version" fallback="儲存版本" />
          </button>
          <button type="button" className="ui-btn-primary px-2 py-1 text-left text-xs" onClick={publishLatest}>
            <T id="builder.publish" fallback="發布目前版本" />
          </button>
        </div>
        <div className="mt-4 border-t border-border/50 pt-3">
          <div className="font-mono text-[11px] text-muted-foreground"><T id="builder.simulation" fallback="模擬切換" /></div>
          <div className="mt-2 flex flex-col gap-2 text-xs">
            <label className="flex items-center justify-between">
              <span><T id="builder.debug" fallback="偵錯" /></span>
              <input type="checkbox" checked={showDebug} onChange={(event) => setShowDebug(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between">
              <span><T id="builder.lighting" fallback="燈光" /></span>
              <input
                type="checkbox"
                checked={lightingEnabled}
                onChange={(event) => setLightingEnabled(event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between">
              <span><T id="builder.ambience" fallback="環境" /></span>
              <input
                type="checkbox"
                checked={ambienceEnabled}
                onChange={(event) => setAmbienceEnabled(event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between">
              <span><T id="builder.thought_bubbles" fallback="對話泡泡" /></span>
              <input
                type="checkbox"
                checked={thoughtEnabled}
                onChange={(event) => setThoughtEnabled(event.target.checked)}
              />
            </label>
          </div>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          {t("builder.selected", "已選取 %{n}").replace("%{n}", String(selectedIds.length))}
        </div>
        {message ? <div className="mt-2 text-xs text-muted-foreground">{message}</div> : null}
      </aside>
      <div className="ui-panel min-h-0 flex-1 overflow-hidden p-2">
        <OfficePhaserCanvas
          mode="builder"
          map={store.map}
          presence={[]}
          debug={debug}
          runtime={{
            enableLighting: lightingEnabled,
            enableAmbience: ambienceEnabled,
            enableThoughtBubbles: thoughtEnabled,
          }}
          onObjectMoved={(id, x, y) => {
            store.moveObject(id, x, y);
          }}
          onSelectionChange={(ids) => {
            store.select(ids);
            setSelectedIds(ids);
          }}
        />
      </div>
    </div>
  );
}
