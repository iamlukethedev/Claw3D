import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACTIVE_FLOOR_ID,
  getOfficeFloor,
  getAdjacentEnabledOfficeFloorId,
  listEnabledOfficeFloors,
  listOfficeFloorsForProvider,
  listOfficeFloorsForZone,
  OFFICE_FLOORS,
  resolveActiveOfficeFloorId,
} from "@/lib/office/floors";

describe("office floor registry", () => {
  it("defines the canonical floor order", () => {
    expect(OFFICE_FLOORS.map((floor) => floor.id)).toEqual([
      "lobby",
      "openclaw-ground",
      "hermes-first",
      "local-runtime",
      "claw3d-runtime",
      "custom-second",
      "training",
      "traders-floor",
      "campus",
    ]);
  });

  it("looks up floors by id", () => {
    expect(getOfficeFloor("hermes-first")).toMatchObject({
      label: "Hermes Floor",
      shortLabel: "Hermes",
      provider: "hermes",
      kind: "runtime",
      zone: "building",
      enabled: true,
      sortOrder: 20,
      runtimeProfileId: "hermes-default",
    });
  });

  it("lists only enabled floors by default", () => {
    expect(listEnabledOfficeFloors().map((floor) => floor.id)).toEqual([
      "lobby",
      "openclaw-ground",
      "hermes-first",
      "local-runtime",
      "claw3d-runtime",
      "custom-second",
    ]);
  });

  it("lists floors for a provider", () => {
    expect(listOfficeFloorsForProvider("demo").map((floor) => floor.id)).toEqual([
      "lobby",
      "training",
      "traders-floor",
      "campus",
    ]);
  });

  it("groups floors by zone for building navigation", () => {
    expect(listOfficeFloorsForZone("building").map((floor) => floor.id)).toEqual([
      "lobby",
      "openclaw-ground",
      "hermes-first",
      "local-runtime",
      "claw3d-runtime",
      "custom-second",
      "training",
      "traders-floor",
    ]);
    expect(listOfficeFloorsForZone("outside").map((floor) => floor.id)).toEqual(["campus"]);
  });

  it("resolves active floor ids against enabled floors", () => {
    expect(DEFAULT_ACTIVE_FLOOR_ID).toBe("lobby");
    expect(resolveActiveOfficeFloorId("hermes-first")).toBe("hermes-first");
    expect(resolveActiveOfficeFloorId("training")).toBe("lobby");
    expect(resolveActiveOfficeFloorId(null)).toBe("lobby");
  });

  it("cycles across enabled floors only", () => {
    expect(getAdjacentEnabledOfficeFloorId("lobby", 1)).toBe("openclaw-ground");
    expect(getAdjacentEnabledOfficeFloorId("lobby", -1)).toBe("custom-second");
  });
});
