/**
 * PrerequisitesStep — Tells users what they need before connecting.
 */
import { CheckCircle2, ExternalLink } from "lucide-react";
import { T, useTranslation } from '@/lib/i18n/TranslationProvider';

const prerequisites = [
  {
    labelKey: "onboarding.prerequisites.item.installed.label",
    labelFallback: "OpenClaw installed",
    detailKey: "onboarding.prerequisites.item.installed.detail",
    detailFallback: "Install via npm, pnpm, or from source",
    link: "https://docs.openclaw.ai",
    linkLabelKey: "onboarding.prerequisites.item.installed.link_label",
    linkLabelFallback: "Installation docs",
  },
  {
    labelKey: "onboarding.prerequisites.item.gateway.label",
    labelFallback: "Gateway running",
    detailKey: "onboarding.prerequisites.item.gateway.detail",
    detailFallback: "Start with: openclaw gateway start",
    command: "openclaw gateway start",
  },
  {
    labelKey: "onboarding.prerequisites.item.url_token.label",
    labelFallback: "Gateway URL and token",
    detailKey: "onboarding.prerequisites.item.url_token.detail",
    detailFallback: "Found in ~/.openclaw/openclaw.json or your remote setup",
  },
  {
    labelKey: "onboarding.prerequisites.item.nodejs.label",
    labelFallback: "Node.js 20+",
    detailKey: "onboarding.prerequisites.item.nodejs.detail",
    detailFallback: "Required for running Claw3D locally",
    link: "https://nodejs.org",
    linkLabelKey: "onboarding.prerequisites.item.nodejs.link_label",
    linkLabelFallback: "Download Node.js",
  },
] as const;

export const PrerequisitesStep = () => (
  <div className="space-y-2.5">
    <p className="text-[13px] leading-5 text-white/70">
      <T id="onboarding.prerequisites.desc" fallback="Make sure you have these ready before connecting. If you already have OpenClaw running, you can skip this step." />
    </p>

    <div className="space-y-1.5">
      {prerequisites.map(({ labelKey, labelFallback, detailKey, detailFallback, ...rest }) => (
        <div
          key={labelKey}
          className="flex gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
        >
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-white"><T id={labelKey} fallback={labelFallback} /></p>
            <p className="mt-0.5 text-[10px] leading-4 text-white/55"><T id={detailKey} fallback={detailFallback} /></p>
            {"command" in rest ? (
              <code className="mt-1 block rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                {rest.command}
              </code>
            ) : null}
            {"link" in rest && rest.link ? (
              <a
                href={rest.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[10px] leading-4 text-amber-300 hover:text-amber-200"
              >
                {"linkLabelKey" in rest ? <T id={(rest as any).linkLabelKey} fallback={(rest as any).linkLabelFallback} /> : <T id="onboarding.prerequisites.learn_more" fallback="Learn more" />}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>

    <p className="text-[10px] leading-4 text-white/40">
      <T id="onboarding.prerequisites.help_prefix" fallback="Need help? Check " />
      <a
        href="https://docs.openclaw.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-300/70 hover:text-amber-200"
      >
        docs.openclaw.ai
      </a>
      <T id="onboarding.prerequisites.help_or" fallback=" or " />
      <a
        href="https://discord.com/invite/clawd"
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-300/70 hover:text-amber-200"
      >
        <T id="onboarding.prerequisites.help_discord" fallback="join Discord" />
      </a>
      <T id="onboarding.prerequisites.help_suffix" fallback="." />
    </p>
  </div>
);
