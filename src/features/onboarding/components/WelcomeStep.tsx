/**
 * WelcomeStep — First onboarding screen introducing Claw3D.
 */
import { Building2, Eye, MessageSquare, Users } from "lucide-react";

const features = [
  {
    icon: Eye,
    title: "Watch agents work",
    description: "See your AI agents in real time in a shared 3D office",
  },
  {
    icon: Users,
    title: "Manage your fleet",
    description: "Create, configure, and monitor agents from one place",
  },
  {
    icon: MessageSquare,
    title: "Chat and approve",
    description: "Talk to agents, approve exec commands, review their work",
  },
  {
    icon: Building2,
    title: "Build your office",
    description: "Customize rooms, desks, and the whole office layout",
  },
] as const;

export const WelcomeStep = () => (
  <div className="space-y-5">
    <div className="space-y-2">
      <p className="text-sm leading-relaxed text-white/80">
        Claw3D turns your AI automation into a{" "}
        <span className="font-medium text-white">visual workplace</span> — an
        office where your OpenClaw agents collaborate, code, test, and execute
        tasks in a shared 3D environment.
      </p>
      <p className="text-sm text-white/60">
        This wizard will help you connect to your OpenClaw gateway and get
        started in about two minutes.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {features.map(({ icon: Icon, title, description }) => (
        <div
          key={title}
          className="rounded-lg border border-white/8 bg-white/[0.03] px-3.5 py-3"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-amber-300" />
            <span className="text-xs font-semibold text-white">{title}</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-white/55">
            {description}
          </p>
        </div>
      ))}
    </div>
  </div>
);
