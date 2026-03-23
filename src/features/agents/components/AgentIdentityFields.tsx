"use client";

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
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        Name
        <input
          className={inputClassName}
          value={values.name}
          disabled={disabled}
          onChange={(event) => {
            onChange("name", event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        Creature
        <input
          className={inputClassName}
          value={values.creature}
          disabled={disabled}
          onChange={(event) => {
            onChange("creature", event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        Vibe
        <input
          className={inputClassName}
          value={values.vibe}
          disabled={disabled}
          onChange={(event) => {
            onChange("vibe", event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        Emoji
        <input
          className={inputClassName}
          value={values.emoji}
          disabled={disabled}
          onChange={(event) => {
            onChange("emoji", event.target.value);
          }}
        />
      </label>
    </div>
  );
}
