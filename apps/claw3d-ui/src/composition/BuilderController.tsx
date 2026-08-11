"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PhaserOfficeBuilder, type VisualLayoutItem } from "@claw3d/visual-react";
import { createBrowserStoragePort } from "./browserStorage";

const DEFAULT_LAYOUT: VisualLayoutItem[] = [
  { id: "research", label: "Research desk", x: 170, y: 150, color: 0x0891b2 },
  { id: "build", label: "Build desk", x: 390, y: 280, color: 0x7c3aed },
  { id: "quality", label: "Quality desk", x: 650, y: 155, color: 0xe11d48 },
  { id: "lounge", label: "Read-only lounge", x: 790, y: 390, color: 0xd97706 },
];

export function BuilderController({ persistenceEnabled }: { persistenceEnabled: boolean }) {
  const router = useRouter();
  const storage = useMemo(() => createBrowserStoragePort(persistenceEnabled), [persistenceEnabled]);
  const [items, setItems] = useState<VisualLayoutItem[]>(() => {
    const raw = storage.get("builder.layout");
    if (!raw) return DEFAULT_LAYOUT;
    try {
      const value = JSON.parse(raw) as unknown;
      return Array.isArray(value) ? value as VisualLayoutItem[] : DEFAULT_LAYOUT;
    } catch {
      return DEFAULT_LAYOUT;
    }
  });

  const change = useCallback((next: VisualLayoutItem[]) => {
    setItems(next);
    storage.set("builder.layout", JSON.stringify(next));
  }, [storage]);

  const clear = useCallback(() => {
    storage.clearNamespace();
    setItems(DEFAULT_LAYOUT);
  }, [storage]);

  return (
    <PhaserOfficeBuilder
      items={items}
      persistenceEnabled={persistenceEnabled}
      onLayoutChange={change}
      onClearBrowserPreferences={clear}
      onReturnToOffice={() => router.push("/office")}
    />
  );
}
