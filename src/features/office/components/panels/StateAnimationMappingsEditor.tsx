"use client";

import {
  OFFICE_STATE_ANIMATION_TARGETS,
  OFFICE_STATE_EFFECT_IDS,
  normalizeOfficeStateToken,
  type OfficeStateAnimationMapping,
  type OfficeStateAnimationTarget,
  type OfficeStateEffectId,
} from "@/lib/office/stateMappingConfig";

type StateAnimationMappingsEditorProps = {
  mappings: OfficeStateAnimationMapping[];
  onChange: (mappings: OfficeStateAnimationMapping[]) => void;
};

const TARGET_LABELS: Record<OfficeStateAnimationTarget, string> = {
  none: "No movement",
  desk: "Desk",
  server_room: "Server room",
  gym: "Gym",
  jukebox: "Jukebox",
  qa_lab: "QA lab",
  sms_booth: "SMS booth",
  phone_booth: "Phone booth",
};

const EFFECT_LABELS: Record<OfficeStateEffectId, string> = {
  none: "No effect",
  confetti: "Confetti",
  alarm: "Alarm",
  doorbell: "Doorbell",
};

const createMappingId = (sourceState: string, index: number) =>
  `state-${sourceState}-${Date.now()}-${index}`;

const labelFromSourceState = (sourceState: string) =>
  sourceState
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const createMapping = (
  sourceState: string,
  animationTarget: OfficeStateAnimationTarget,
  params: Partial<OfficeStateAnimationMapping> = {},
): OfficeStateAnimationMapping => ({
  id: createMappingId(sourceState, params.priority ?? 50),
  sourceState,
  label: params.label ?? labelFromSourceState(sourceState),
  animationTarget,
  effect: params.effect ?? "none",
  soundCueId: params.soundCueId ?? null,
  priority: params.priority ?? 50,
  enabled: params.enabled ?? true,
});

const STARTER_MAPPINGS: OfficeStateAnimationMapping[] = [
  createMapping("writing", "desk", { label: "Writing", priority: 90 }),
  createMapping("executing", "server_room", { label: "Executing", priority: 80 }),
  createMapping("waiting", "phone_booth", {
    label: "Waiting",
    effect: "doorbell",
    soundCueId: "approval",
    priority: 70,
  }),
  createMapping("error", "server_room", {
    label: "Error",
    effect: "alarm",
    soundCueId: "alarm",
    priority: 100,
  }),
];

export function StateAnimationMappingsEditor({
  mappings,
  onChange,
}: StateAnimationMappingsEditorProps) {
  const updateMapping = (
    id: string,
    patch: Partial<OfficeStateAnimationMapping>,
  ) => {
    onChange(
      mappings.map((mapping) => {
        if (mapping.id !== id) return mapping;
        const next = { ...mapping, ...patch };
        if (
          typeof patch.sourceState === "string" &&
          mapping.label === labelFromSourceState(mapping.sourceState)
        ) {
          next.label = labelFromSourceState(patch.sourceState);
        }
        return next;
      }),
    );
  };

  const removeMapping = (id: string) => {
    onChange(mappings.filter((mapping) => mapping.id !== id));
  };

  const normalizeMappingsForSave = () => {
    onChange(
      mappings
        .map((mapping) => ({
          ...mapping,
          sourceState: normalizeOfficeStateToken(mapping.sourceState),
          label: mapping.label.trim() || mapping.sourceState.trim(),
          soundCueId: mapping.soundCueId?.trim() || null,
          priority: Math.max(0, Math.min(100, Math.round(mapping.priority))),
        }))
        .filter((mapping) => mapping.sourceState.length > 0),
    );
  };

  const addMapping = () => {
    onChange([...mappings, createMapping("writing", "desk", { label: "Writing" })]);
  };

  const addStarterMappings = () => {
    onChange([
      ...mappings,
      ...STARTER_MAPPINGS.map((mapping, index) => ({
        ...mapping,
        id: createMappingId(mapping.sourceState, mappings.length + index),
      })),
    ]);
  };

  return (
    <div className="mt-3 rounded-lg border border-cyan-500/10 bg-black/20 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium text-white">
            State animation mappings
          </div>
          <div className="mt-1 text-[10px] text-white/75">
            Map runtime states like writing, executing, waiting, or error to office movement.
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200/70">
          {mappings.length} rules
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addMapping}
          className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-50 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/15"
        >
          Add mapping
        </button>
        <button
          type="button"
          onClick={addStarterMappings}
          className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-100 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/15"
        >
          Use starter set
        </button>
        {mappings.length > 0 ? (
          <>
            <button
              type="button"
              onClick={normalizeMappingsForSave}
              className="rounded-md border border-cyan-500/20 bg-black/20 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10"
            >
              Normalize
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-rose-100 transition-colors hover:border-rose-400/40 hover:bg-rose-500/15"
            >
              Clear
            </button>
          </>
        ) : null}
      </div>

      {mappings.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-cyan-500/15 bg-black/15 px-3 py-3 text-[10px] text-white/60">
          No custom mappings yet. Add one rule or load the starter set for common fleet states.
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {mappings.map((mapping, index) => (
            <div
              key={mapping.id}
              className="rounded-lg border border-cyan-500/10 bg-black/15 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100/65">
                  Rule {index + 1}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-label={`Enable mapping ${mapping.label || mapping.sourceState}`}
                    aria-checked={mapping.enabled}
                    className={`ui-switch self-center ${mapping.enabled ? "ui-switch--on" : ""}`}
                    onClick={() =>
                      updateMapping(mapping.id, { enabled: !mapping.enabled })
                    }
                  >
                    <span className="ui-switch-thumb" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMapping(mapping.id)}
                    className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-rose-100 transition-colors hover:border-rose-400/40 hover:bg-rose-500/15"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/65">
                    Label
                  </span>
                  <input
                    type="text"
                    value={mapping.label}
                    onChange={(event) =>
                      updateMapping(mapping.id, {
                        label: event.target.value,
                      })
                    }
                    placeholder="Writing"
                    className="w-full rounded-md border border-cyan-500/10 bg-black/25 px-3 py-2 text-[11px] text-cyan-100 outline-none transition-colors placeholder:text-cyan-100/30 focus:border-cyan-400/30"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/65">
                    Source state
                  </span>
                  <input
                    type="text"
                    value={mapping.sourceState}
                    onChange={(event) =>
                      updateMapping(mapping.id, {
                        sourceState: event.target.value,
                      })
                    }
                    placeholder="writing"
                    className="w-full rounded-md border border-cyan-500/10 bg-black/25 px-3 py-2 font-mono text-[11px] text-cyan-100 outline-none transition-colors placeholder:text-cyan-100/30 focus:border-cyan-400/30"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/65">
                      Target
                    </span>
                    <select
                      value={mapping.animationTarget}
                      onChange={(event) =>
                        updateMapping(mapping.id, {
                          animationTarget: event.target
                            .value as OfficeStateAnimationTarget,
                        })
                      }
                      className="w-full rounded-md border border-cyan-500/10 bg-black/25 px-3 py-2 text-[11px] text-cyan-100 outline-none transition-colors focus:border-cyan-400/30"
                    >
                      {OFFICE_STATE_ANIMATION_TARGETS.map((target) => (
                        <option key={target} value={target}>
                          {TARGET_LABELS[target]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/65">
                      Effect
                    </span>
                    <select
                      value={mapping.effect}
                      onChange={(event) =>
                        updateMapping(mapping.id, {
                          effect: event.target.value as OfficeStateEffectId,
                        })
                      }
                      className="w-full rounded-md border border-cyan-500/10 bg-black/25 px-3 py-2 text-[11px] text-cyan-100 outline-none transition-colors focus:border-cyan-400/30"
                    >
                      {OFFICE_STATE_EFFECT_IDS.map((effect) => (
                        <option key={effect} value={effect}>
                          {EFFECT_LABELS[effect]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-[1fr_88px] gap-2">
                  <label className="grid gap-1">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/65">
                      Sound cue
                    </span>
                    <input
                      type="text"
                      value={mapping.soundCueId ?? ""}
                      onChange={(event) =>
                        updateMapping(mapping.id, {
                          soundCueId: event.target.value || null,
                        })
                      }
                      placeholder="alarm"
                      className="w-full rounded-md border border-cyan-500/10 bg-black/25 px-3 py-2 font-mono text-[11px] text-cyan-100 outline-none transition-colors placeholder:text-cyan-100/30 focus:border-cyan-400/30"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/65">
                      Priority
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={mapping.priority}
                      onChange={(event) =>
                        updateMapping(mapping.id, {
                          priority: Number.parseInt(event.target.value, 10) || 0,
                        })
                      }
                      className="w-full rounded-md border border-cyan-500/10 bg-black/25 px-3 py-2 font-mono text-[11px] text-cyan-100 outline-none transition-colors focus:border-cyan-400/30"
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 text-[10px] text-white/50">
        Source states are normalized on save, so "Writing" becomes "writing" and "approval pending" becomes "approval_pending".
      </div>
    </div>
  );
}
