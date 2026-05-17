"use client";

import { T, useTranslation } from '@/lib/i18n/TranslationProvider';

export type AgentIdentityValues = {
  name: string;
  creature: string;
  vibe: string;
  emoji: string;
};

type AgentIdentityFieldsProps = {
  values: AgentIdentityValues;
  disabled?: boolean;
  onChange: (field: keyof AgentIdentityValues, value: string) => void;
};

const inputClassName =
  "h-10 rounded-md border border-border/80 bg-background px-3 text-sm text-foreground outline-none";

export function AgentIdentityFields({
  values,
  disabled = false,
  onChange,
}: AgentIdentityFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        <T id="agent.identity.name" fallback="名稱" />
        <input
          className={inputClassName}
          value={values.name}
          placeholder={t('agent.identity.name_placeholder', '例如 小明')}
          disabled={disabled}
          onChange={(event) => {
            onChange("name", event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        <T id="agent.identity.role" fallback="角色" />
        <input
          className={inputClassName}
          value={values.creature}
          placeholder={t('agent.identity.role_placeholder', '例如 產品設計師')}
          disabled={disabled}
          onChange={(event) => {
            onChange("creature", event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        <T id="agent.identity.vibe" fallback="風格" />
        <input
          className={inputClassName}
          value={values.vibe}
          placeholder={t('agent.identity.vibe_placeholder', '例如 冷靜、敏銳、樂於助人')}
          disabled={disabled}
          onChange={(event) => {
            onChange("vibe", event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        <T id="agent.identity.emoji" fallback="表情符號" />
        <input
          className={inputClassName}
          value={values.emoji}
          placeholder={t('agent.identity.emoji_placeholder', '例如 ✨')}
          disabled={disabled}
          onChange={(event) => {
            onChange("emoji", event.target.value);
          }}
        />
      </label>
    </div>
  );
}
