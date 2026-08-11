"use client";

import { Children, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";

export interface LocalSceneTextProps {
  children?: ReactNode;
  color?: string;
  fontSize?: number;
  lineHeight?: number;
  maxWidth?: number;
  anchorX?: "left" | "center" | "right" | number;
  anchorY?: "top" | "top-baseline" | "middle" | "bottom-baseline" | "bottom" | number;
  outlineColor?: string;
  outlineWidth?: number;
  position?: readonly [number, number, number];
  renderOrder?: number;
  rotation?: readonly [number, number, number];
  textAlign?: "left" | "center" | "right" | "justify";
  visible?: boolean;
  [property: string]: unknown;
}

/**
 * Network-free replacement for Drei's remote-font-backed Text primitive. A
 * canvas texture keeps labels inside the Three scene graph, so parent
 * visibility, transforms and disposal retain their normal semantics.
 */
export function LocalSceneText({
  children,
  anchorX = "center",
  anchorY = "middle",
  color = "#ffffff",
  fontSize = 0.1,
  lineHeight = 1.15,
  maxWidth,
  outlineColor = "transparent",
  outlineWidth = 0,
  position,
  renderOrder,
  rotation,
  textAlign = "center",
  visible = true,
  ...materialProperties
}: LocalSceneTextProps) {
  const text = useMemo(() => Children.toArray(children).join(""), [children]);
  const lines = useMemo(() => text.split("\n"), [text]);
  const width = Math.max(fontSize, maxWidth ?? Math.max(...lines.map((line) => line.length), 1) * fontSize * 0.62);
  const height = Math.max(fontSize * lineHeight, lines.length * fontSize * lineHeight);
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    const scale = 512 / Math.max(width, height);
    canvas.width = Math.max(64, Math.ceil(width * scale));
    canvas.height = Math.max(32, Math.ceil(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    const pixelSize = Math.max(14, fontSize * scale * 0.86);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `700 ${pixelSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    context.textAlign = textAlign === "justify" ? "left" : textAlign;
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.strokeStyle = outlineColor;
    context.lineWidth = Math.max(0, outlineWidth * scale * 2);
    const x = textAlign === "left" || textAlign === "justify"
      ? 2
      : textAlign === "right"
        ? canvas.width - 2
        : canvas.width / 2;
    lines.forEach((line, index) => {
      const y = canvas.height / 2 + (index - (lines.length - 1) / 2) * pixelSize * lineHeight;
      if (context.lineWidth > 0) context.strokeText(line, x, y);
      context.fillText(line, x, y);
    });
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.minFilter = THREE.LinearFilter;
    next.magFilter = THREE.LinearFilter;
    next.needsUpdate = true;
    return next;
  }, [color, fontSize, height, lineHeight, lines, outlineColor, outlineWidth, textAlign, width]);
  useEffect(() => () => texture?.dispose(), [texture]);

  if (!visible || !texture) return null;
  const basePosition = position ? [...position] as [number, number, number] : [0, 0, 0] as [number, number, number];
  if (anchorX === "left") basePosition[0] += width / 2;
  else if (anchorX === "right") basePosition[0] -= width / 2;
  if (anchorY === "top" || anchorY === "top-baseline") basePosition[1] -= height / 2;
  else if (anchorY === "bottom" || anchorY === "bottom-baseline") basePosition[1] += height / 2;
  const depthTest = materialProperties["material-depthTest"] !== false;
  const depthWrite = materialProperties["material-depthWrite"] !== false;
  return (
    <mesh
      position={basePosition}
      rotation={rotation ? [...rotation] : undefined}
      renderOrder={renderOrder}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        toneMapped={false}
        depthTest={depthTest}
        depthWrite={depthWrite}
      />
    </mesh>
  );
}
