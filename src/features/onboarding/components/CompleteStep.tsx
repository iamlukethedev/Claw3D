"use client";

/**
 * CompleteStep — Final wizard screen before entering the office.
 */
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Building2, Rocket } from "lucide-react";

export const CompleteStep = ({
  companyCreated = false,
  companyName = null,
}: {
  companyCreated?: boolean;
  companyName?: string | null;
}) => {
  const hasFiredConfettiRef = useRef(false);

  useEffect(() => {
    if (!companyCreated || hasFiredConfettiRef.current) return;
    hasFiredConfettiRef.current = true;
    const defaults = {
      spread: 68,
      startVelocity: 32,
      ticks: 220,
      gravity: 1.05,
      zIndex: 100130,
      colors: ["#67e8f9", "#fbbf24", "#fde047", "#f472b6", "#c4b5fd"],
    };
    void confetti({
      ...defaults,
      particleCount: 90,
      origin: { x: 0.5, y: 0.35 },
    });
    window.setTimeout(() => {
      void confetti({
        ...defaults,
        particleCount: 70,
        angle: 60,
        origin: { x: 0.15, y: 0.45 },
      });
      void confetti({
        ...defaults,
        particleCount: 70,
        angle: 120,
        origin: { x: 0.85, y: 0.45 },
      });
    }, 180);
  }, [companyCreated]);

  return (
    <div className="relative flex flex-col items-center justify-center gap-5 py-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15">
        <Rocket className="h-7 w-7 text-amber-300" />
      </div>

      <div className="space-y-2 text-center">
        <p className="text-base font-semibold text-white">
          {companyCreated
            ? `${companyName?.trim() || "Your company"} created successfully`
            : "Welcome to your AI office"}
        </p>
        <p className="max-w-sm text-sm text-white/60">
          {companyCreated
            ? `${companyName?.trim() || "Your company"} is ready. Your new team has been created in the connected runtime and placed into the office.`
            : "Your gateway is connected and your agents are ready. Step inside and explore the 3D workspace where your AI team operates."}
        </p>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
          <Building2 className="h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <p className="text-xs font-medium text-white">
              {companyCreated ? "Meet Your New Team" : "Explore the Office"}
            </p>
            <p className="text-[10px] text-white/45">
              {companyCreated
                ? "Walk the office, inspect the new roles, and start delegating work."
                : "Navigate rooms, watch agents, and interact"}
            </p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-white/35">
        You can always re-run onboarding from Studio settings.
      </p>
    </div>
  );
};
