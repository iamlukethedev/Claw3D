import { describe, expect, it } from "vitest";

import {
  resolveOfficeSoundCueForExternalEvent,
  resolveOfficeSoundCueForRunTransition,
} from "@/features/office/sound/officeSound";

describe("office sound cues", () => {
  it("maps external event effects to cue ids", () => {
    expect(resolveOfficeSoundCueForExternalEvent({ effect: "confetti" })).toBe("chime");
    expect(resolveOfficeSoundCueForExternalEvent({ effect: "alarm" })).toBe("alarm");
    expect(resolveOfficeSoundCueForExternalEvent({ effect: "doorbell" })).toBe("doorbell");
    expect(resolveOfficeSoundCueForExternalEvent({ effect: null })).toBeNull();
  });

  it("maps run transitions to cue ids", () => {
    expect(
      resolveOfficeSoundCueForRunTransition({
        wasRunning: false,
        isRunning: true,
        isError: false,
      }),
    ).toBe("task-start");
    expect(
      resolveOfficeSoundCueForRunTransition({
        wasRunning: true,
        isRunning: false,
        isError: false,
      }),
    ).toBe("task-complete");
    expect(
      resolveOfficeSoundCueForRunTransition({
        wasRunning: true,
        isRunning: false,
        isError: true,
      }),
    ).toBe("alarm");
  });
});
