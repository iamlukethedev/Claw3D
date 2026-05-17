/**
 * WelcomeStep — First onboarding screen introducing Claw3D.
 */
import { Building2, Eye, MessageSquare, Users } from "lucide-react";
import { T, useTranslation } from '@/lib/i18n/TranslationProvider';

const features = [
  {
    icon: Eye,
    titleKey: "onboarding.welcome.feature.watch.title",
    titleFallback: "Watch agents work",
    descKey: "onboarding.welcome.feature.watch.description",
    descFallback: "See your AI agents in real time in a shared 3D office",
  },
  {
    icon: Users,
    titleKey: "onboarding.welcome.feature.manage.title",
    titleFallback: "Manage your fleet",
    descKey: "onboarding.welcome.feature.manage.description",
    descFallback: "Create, configure, and monitor agents from one place",
  },
  {
    icon: MessageSquare,
    titleKey: "onboarding.welcome.feature.chat.title",
    titleFallback: "Chat and approve",
    descKey: "onboarding.welcome.feature.chat.description",
    descFallback: "Talk to agents, approve exec commands, review their work",
  },
  {
    icon: Building2,
    titleKey: "onboarding.welcome.feature.build.title",
    titleFallback: "Build your office",
    descKey: "onboarding.welcome.feature.build.description",
    descFallback: "Customize rooms, desks, and the whole office layout",
  },
] as const;

export const WelcomeStep = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-white/80">
          <T id="onboarding.welcome.intro_part1" fallback="Claw3D turns your AI automation into a " />
          <span className="font-medium text-white">
            <T id="onboarding.welcome.intro_highlight" fallback="visual workplace" />
          </span>
          <T id="onboarding.welcome.intro_part2" fallback=" — an office where your AI agents collaborate, code, test, and execute tasks in a shared 3D environment." />
        </p>
        <p className="text-sm text-white/60">
          <T id="onboarding.welcome.wizard_desc" fallback="This wizard will help you connect to your runtime gateway and get started in about two minutes." />
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {features.map(({ icon: Icon, titleKey, titleFallback, descKey, descFallback }) => (
          <div
            key={titleKey}
            className="rounded-lg border border-white/8 bg-white/[0.03] px-3.5 py-3"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="text-xs font-semibold text-white">
                <T id={titleKey} fallback={titleFallback} />
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-white/55">
              <T id={descKey} fallback={descFallback} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
