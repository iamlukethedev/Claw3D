/**
 * AgentsStep — Shows discovered agents after gateway connection.
 */
import { Bot, Users, WifiOff } from "lucide-react";
import { T, useTranslation } from "@/lib/i18n/TranslationProvider";

export type AgentsStepProps = {
  agentCount: number;
  connected: boolean;
};

export const AgentsStep = ({ agentCount, connected }: AgentsStepProps) => {
  const { t } = useTranslation();

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <WifiOff className="h-8 w-8 text-white/30" />
        <p className="text-sm text-white/60">
          <T id="onboarding.agents.connect_first" fallback="請先連線到閘道器以探索 Agent。" />
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
          <p className="text-sm font-medium text-white"><T id="onboarding.agents.none_found" fallback="找不到 Agent" /></p>
          <p className="max-w-xs text-center text-xs text-white/55">
            <T id="onboarding.agents.none_found_desc" fallback="您的閘道器已連線，但尚未設定任何 Agent。" />
          </p>
        </div>

        <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
          <p className="text-xs font-medium text-white/80"><T id="onboarding.agents.quick_start" fallback="快速入門：" /></p>
          <ol className="mt-2 space-y-1.5 text-[11px] text-white/55">
            <li><T id="onboarding.agents.step1" fallback="1. 點擊艦隊側邊欄的 + 按鈕" /></li>
            <li><T id="onboarding.agents.step2" fallback="2. 選擇名稱並啟動" /></li>
            <li><T id="onboarding.agents.step3" fallback="3. 在聊天面板與您的 Agent 對話" /></li>
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
            {t("onboarding.agents.count", "已探索 %{count} 個 Agent").replace("%{count}", String(agentCount))}
          </p>
          <p className="text-[11px] text-white/55">
            <T id="onboarding.agents.ready_desc" fallback="您的 AI 團隊已準備就緒，正在辦公室中等候。" />
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-white/70">
          <T id="onboarding.agents.what_you_can_do" fallback="您可以對 Agent 做的事：" />
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "chat", label: t("onboarding.agents.action_chat", "聊天"), desc: t("onboarding.agents.action_chat_desc", "發送訊息並取得回應") },
            { id: "approve", label: t("onboarding.agents.action_approve", "核准"), desc: t("onboarding.agents.action_approve_desc", "檢視與核准執行指令") },
            { id: "configure", label: t("onboarding.agents.action_configure", "設定"), desc: t("onboarding.agents.action_configure_desc", "編輯大腦檔案與設定") },
            { id: "monitor", label: t("onboarding.agents.action_monitor", "監控"), desc: t("onboarding.agents.action_monitor_desc", "即時檢視執行時期活動") },
          ].map(({ id, label, desc }) => (
            <div
              key={id}
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
