import { Building2, Sparkles, Users, Wand2 } from "lucide-react";
import { T, useTranslation } from "@/lib/i18n/TranslationProvider";

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
  const { t } = useTranslation();
  const canOpenBuilder = connected && agentCount > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <Building2 className="h-5 w-5 text-amber-300" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white"><T id="company.bootstrap_title" fallback="用 AI 啟動您的公司" /></p>
            <p className="text-xs leading-5 text-white/60">
              <T id="company.bootstrap_desc" fallback="描述您的公司業務，Claw3D 可將其轉化為完整的組織結構，包含角色、職責與交接流程。" />
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          {
            icon: Sparkles,
            key: "improve",
            title: t("company.step_improve", "優化簡報"),
            description: t("company.step_improve_desc", "使用已連線的執行時期來強化公司提示詞。"),
          },
          {
            icon: Users,
            key: "generate",
            title: t("company.step_generate", "產生團隊"),
            description: t("company.step_generate_desc", "取得實用的組織圖，包含角色、職責與交接流程。"),
          },
          {
            icon: Wand2,
            key: "create",
            title: t("company.step_create", "建立全部"),
            description: t("company.step_create_desc", "撰寫 Agent 檔案並直接在已連線的執行時期中建立團隊。"),
          },
        ].map(({ icon: Icon, key, title, description }) => (
          <div
            key={key}
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
              <T id="company.open_builder" fallback="開啟公司建構器" />
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/80">
            <T id="company.connect_hint" fallback="請先連線到執行時期，並保留至少一個規劃 Agent 可用。" />
          </div>
        )}
      </div>
    </div>
  );
};
