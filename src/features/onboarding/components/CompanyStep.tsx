import { Building2, Sparkles, Users, Wand2 } from "lucide-react";

export type CompanyStepProps = {
  connected: boolean;
  agentCount: number;
  onOpenCompanyBuilder: () => void;
};

export const CompanyStep = ({
  connected,
  agentCount,
  onOpenCompanyBuilder,
}: CompanyStepProps) => {
  const canOpenBuilder = connected && agentCount > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <Building2 className="h-5 w-5 text-amber-300" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Bootstrap your company with AI</p>
            <p className="text-xs leading-5 text-white/60">
              Describe what your company does and Claw3D can turn that into a full org structure
              with specialized agents, working files, and role instructions.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          {
            icon: Sparkles,
            title: "Improve the brief",
            description: "Use your connected runtime to sharpen the company prompt.",
          },
          {
            icon: Users,
            title: "Generate the team",
            description: "Get a practical org chart with roles, responsibilities, and handoffs.",
          },
          {
            icon: Wand2,
            title: "Create everything",
            description: "Write agent files and create the team directly in the connected runtime.",
          },
        ].map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-md border border-white/8 bg-white/[0.02] px-3 py-3"
          >
            <Icon className="h-4 w-4 text-white/70" />
            <p className="mt-2 text-[11px] font-semibold text-white">{title}</p>
            <p className="mt-1 text-[10px] leading-4 text-white/45">{description}</p>
          </div>
        ))}
      </div>

      <div className="pt-4">
        {canOpenBuilder ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-[#1a1206] transition-colors hover:bg-amber-400"
              onClick={onOpenCompanyBuilder}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Open Company Builder
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/80">
            Connect to a runtime and keep at least one planning agent available to generate the
            company with AI.
          </div>
        )}
      </div>
    </div>
  );
};
