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
        JARVIS_ORIGIN: "http://127.0.0.1:8000",
      }),
    ).toMatchObject({ adapter: "jarvis-readonly", connectorEnabled: true });
  });

  it("rejects a missing, credentialed, or path-bearing private origin", () => {
    expect(readVisualRuntimeConfig({
      VISUAL_ADAPTER: "jarvis-readonly",
      JARVIS_CONNECTOR_ENABLED: "true",
    }).adapter).toBe("null");
    expect(readVisualRuntimeConfig({
      VISUAL_ADAPTER: "jarvis-readonly",
      JARVIS_CONNECTOR_ENABLED: "true",
      JARVIS_ORIGIN: "https://user:secret@example.test/api",
    }).adapter).toBe("null");
  });
});
