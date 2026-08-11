import { describe, expect, it } from "vitest";
import { readVisualRuntimeConfig } from "../../apps/claw3d-ui/src/composition/config";

describe("visual runtime configuration", () => {
  it("selects mock explicitly without enabling the private connector", () => {
    expect(readVisualRuntimeConfig({ VISUAL_ADAPTER: "mock" })).toMatchObject({
      adapter: "mock",
      connectorEnabled: false,
    });
  });

  it("fails closed for missing or invalid values", () => {
    expect(readVisualRuntimeConfig({}).adapter).toBe("null");
    expect(readVisualRuntimeConfig({ VISUAL_ADAPTER: "surprise" }).adapter).toBe("null");
    expect(
      readVisualRuntimeConfig({
        VISUAL_ADAPTER: "jarvis-readonly",
        JARVIS_CONNECTOR_ENABLED: "TRUE",
      }).adapter,
    ).toBe("null");
  });

  it("requires an exact true connector flag", () => {
    expect(
      readVisualRuntimeConfig({
        VISUAL_ADAPTER: "jarvis-readonly",
        JARVIS_CONNECTOR_ENABLED: "true",
      }),
    ).toMatchObject({ adapter: "jarvis-readonly", connectorEnabled: true });
  });
});
