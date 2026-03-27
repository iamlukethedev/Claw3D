"use client";

import type { CSSProperties } from "react";

type RunningAvatarLoaderProps = {
  size?: number;
  trackWidth?: number;
  label?: string;
  className?: string;
  labelClassName?: string;
  inline?: boolean;
};

const S = 4;

const box = (
  w: number,
  h: number,
  color: string,
  extra?: CSSProperties,
): CSSProperties => ({
  position: "absolute",
  width: w * S,
  height: h * S,
  background: color,
  borderRadius: 1,
  ...extra,
});

export function RunningAvatarLoader({
  label,
  className = "",
  labelClassName = "",
  inline = false,
}: RunningAvatarLoaderProps) {
  const charW = 14 * S;
  const charH = 22 * S;
  const totalH = charH + 8;

  return (
    <div
      className={`flex ${inline ? "items-center gap-2" : "flex-col items-center gap-3"} ${className}`}
    >
      <div
        className="relative"
        style={{ width: charW + 16, height: totalH } as CSSProperties}
      >
        {/* Shadow. */}
        <div
          className="ra-shadow absolute"
          style={{
            left: "50%",
            bottom: 0,
            width: 10 * S,
            height: 2 * S,
            marginLeft: -5 * S,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.2)",
          }}
        />

        {/* Character root — bounces. */}
        <div
          className="ra-bounce absolute"
          style={{
            left: "50%",
            bottom: 2 * S,
            marginLeft: (-7 * S),
            width: charW,
            height: charH,
          }}
        >
          {/* Left leg. */}
          <div
            className="ra-leg-l"
            style={{
              position: "absolute",
              left: 2 * S,
              bottom: 0,
              width: 3 * S,
              transformOrigin: "50% 0",
            }}
          >
            {/* Shorts. */}
            <div style={box(3, 3, "#64748b", { top: 0, left: 0 })} />
            {/* Skin. */}
            <div style={box(2, 2, "#f5c9a5", { top: 3 * S, left: 0.5 * S })} />
            {/* Shoe. */}
            <div style={box(3, 2, "#f8fafc", { top: 5 * S, left: 0 })} />
          </div>

          {/* Right leg. */}
          <div
            className="ra-leg-r"
            style={{
              position: "absolute",
              left: 8 * S,
              bottom: 0,
              width: 3 * S,
              transformOrigin: "50% 0",
            }}
          >
            <div style={box(3, 3, "#64748b", { top: 0, left: 0 })} />
            <div style={box(2, 2, "#f5c9a5", { top: 3 * S, left: 0.5 * S })} />
            <div style={box(3, 2, "#f8fafc", { top: 5 * S, left: 0 })} />
          </div>

          {/* Torso (yellow shirt). */}
          <div style={box(10, 5, "#eab308", { left: 2 * S, bottom: 7 * S })} />

          {/* Left arm. */}
          <div
            className="ra-arm-l"
            style={{
              position: "absolute",
              left: 0,
              bottom: 8 * S,
              width: 2 * S,
              transformOrigin: "50% 0",
            }}
          >
            <div style={box(2, 4, "#eab308", { top: 0, left: 0 })} />
            <div style={box(2, 2, "#f5c9a5", { top: 4 * S, left: 0 })} />
          </div>

          {/* Right arm. */}
          <div
            className="ra-arm-r"
            style={{
              position: "absolute",
              left: 12 * S,
              bottom: 8 * S,
              width: 2 * S,
              transformOrigin: "50% 0",
            }}
          >
            <div style={box(2, 4, "#eab308", { top: 0, left: 0 })} />
            <div style={box(2, 2, "#f5c9a5", { top: 4 * S, left: 0 })} />
          </div>

          {/* Neck. */}
          <div style={box(3, 1, "#f5c9a5", { left: 5 * S, bottom: 12 * S })} />

          {/* Head. */}
          <div style={box(7, 5, "#f5c9a5", { left: 3 * S, bottom: 13 * S })} />

          {/* Eyes. */}
          <div style={box(1, 1, "#1e293b", { left: 4.5 * S, bottom: 15.5 * S })} />
          <div style={box(1, 1, "#1e293b", { left: 8 * S, bottom: 15.5 * S })} />

          {/* Mouth. */}
          <div style={box(2, 0.5, "#ef4444", { left: 5.5 * S, bottom: 14 * S })} />

          {/* Hair. */}
          <div style={box(7, 1, "#111827", { left: 3 * S, bottom: 18 * S })} />

          {/* Hat brim. */}
          <div style={box(9, 1.5, "#fcd34d", { left: 2 * S, bottom: 19 * S })} />

          {/* Hat top. */}
          <div style={box(5, 1.5, "#0f172a", { left: 4 * S, bottom: 20.5 * S })} />
        </div>

        <style>{`
          @keyframes ra-bounce-kf {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-${2 * S}px); }
          }
          @keyframes ra-shadow-kf {
            0%, 100% { transform: scaleX(1); opacity: 0.2; }
            50% { transform: scaleX(0.65); opacity: 0.12; }
          }
          @keyframes ra-leg-l-kf {
            0% { transform: rotate(-25deg); }
            50% { transform: rotate(25deg); }
            100% { transform: rotate(-25deg); }
          }
          @keyframes ra-leg-r-kf {
            0% { transform: rotate(25deg); }
            50% { transform: rotate(-25deg); }
            100% { transform: rotate(25deg); }
          }
          @keyframes ra-arm-l-kf {
            0% { transform: rotate(30deg); }
            50% { transform: rotate(-30deg); }
            100% { transform: rotate(30deg); }
          }
          @keyframes ra-arm-r-kf {
            0% { transform: rotate(-30deg); }
            50% { transform: rotate(30deg); }
            100% { transform: rotate(-30deg); }
          }
          .ra-bounce {
            animation: ra-bounce-kf 0.32s ease-in-out infinite;
          }
          .ra-shadow {
            animation: ra-shadow-kf 0.32s ease-in-out infinite;
          }
          .ra-leg-l {
            animation: ra-leg-l-kf 0.32s ease-in-out infinite;
          }
          .ra-leg-r {
            animation: ra-leg-r-kf 0.32s ease-in-out infinite;
          }
          .ra-arm-l {
            animation: ra-arm-l-kf 0.32s ease-in-out infinite;
          }
          .ra-arm-r {
            animation: ra-arm-r-kf 0.32s ease-in-out infinite;
          }
        `}</style>
      </div>

      {label ? (
        <p
          className={`${inline ? "" : "text-center"} font-mono text-[11px] tracking-[0.08em] text-white/55 ${labelClassName}`}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}
