/**
 * AgentsStep — Shows discovered agents after gateway connection.
 */
import { Bot, Users, WifiOff } from "lucide-react";

export type AgentsStepProps = {
  agentCount: number;
  connected: boolean;
};

export const AgentsStep = ({ agentCount, connected }: AgentsStepProps) => {
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <WifiOff className="h-8 w-8 text-white/30" />
        <p className="text-sm text-white/60">
          Connect to your gateway first to discover agents.
        </p>
      </div>
    );
  }

  if (agentCount === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            <Bot className="h-6 w-6 text-white/40" />
          </div>
          <p className="text-sm font-medium text-white">No agents found</p>
          <p className="max-w-xs text-center text-xs text-white/55">
            Your gateway is connected, but no agents are configured yet.
            You can create agents from the Claw3D fleet sidebar after
            completing this wizard.
          </p>
        </div>

        <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
          <p className="text-xs font-medium text-white/80">Quick start:</p>
          <ol className="mt-2 space-y-1.5 text-[11px] text-white/55">
            <li>1. Click the + button in the fleet sidebar</li>
            <li>2. Choose a name and model for your agent</li>
            <li>3. Configure skills and personality</li>
            <li>4. Watch your agent appear at their desk!</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
        <Users className="h-5 w-5 text-amber-300" />
        <div>
          <p className="text-sm font-semibold text-white">
            {agentCount} agent{agentCount !== 1 ? "s" : ""} discovered
          </p>
          <p className="text-[11px] text-white/55">
            Your AI team is ready and waiting in the office.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-white/70">
          What you can do with agents:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Chat", desc: "Send messages and get responses" },
            { label: "Approve", desc: "Review and approve exec commands" },
            { label: "Configure", desc: "Edit brain files and settings" },
            { label: "Monitor", desc: "Watch runtime activity in real time" },
          ].map(({ label, desc }) => (
            <div
              key={label}
              className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <p className="text-[11px] font-semibold text-white">{label}</p>
              <p className="text-[10px] text-white/45">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
