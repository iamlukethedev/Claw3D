"use client";

import { useEffect } from "react";

import { X } from "lucide-react";

import type { OfficeSkillsMarketplaceController } from "@/features/office/hooks/useOfficeSkillsMarketplace";

import { SkillsMarketplacePanel } from "./SkillsMarketplacePanel";

type SkillsMarketplaceModalProps = {
  open: boolean;
  marketplace: OfficeSkillsMarketplaceController;
  onClose: () => void;
  onSelectAgent: (agentId: string) => void;
  onOpenAgentSettings: (agentId: string) => void;
};

export function SkillsMarketplaceModal({
  open,
  marketplace,
  onClose,
  onSelectAgent,
  onOpenAgentSettings,
}: SkillsMarketplaceModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Skills marketplace"
      onClick={onClose}
    >
      <div
        className="flex h-[min(90vh,960px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-cyan-500/20 bg-[#050607]/95 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-cyan-500/10 px-5 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
              Skills Marketplace
            </div>
            <div className="mt-1 font-mono text-[11px] text-white/45">
              Discover, install, and enable gateway skills in a wider workspace.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/75 transition-colors hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <SkillsMarketplacePanel
            marketplace={marketplace}
            onSelectAgent={onSelectAgent}
            onOpenAgentSettings={onOpenAgentSettings}
          />
        </div>
      </div>
    </div>
  );
}
