import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gateway/agentConfig", () => ({
  createGatewayAgent: vi.fn().mockResolvedValue({
    id: "helper-agent",
    name: "Picture Model Helper",
  }),
  removeGatewayAgentFromConfigOnly: vi.fn().mockResolvedValue({
    removed: true,
  }),
  updateGatewayAgentOverrides: vi.fn().mockResolvedValue(undefined),
}));

const {
  MAX_PICTURE_MODEL_UPLOAD_BYTES,
  buildPictureModelGatewayPrompt,
  generatePictureModelViaGateway,
} = await import("@/lib/office/pictureModelGeneration");

describe("buildPictureModelGatewayPrompt", () => {
  it("embeds the compact visual summary and strict JSON instructions", () => {
    const prompt = buildPictureModelGatewayPrompt({
      fileName: "photo.png",
      aspectRatio: 1.2,
      dominantColor: "#774433",
      accentColor: "#335577",
      pixelWidth: 32,
      pixelHeight: 28,
      summaryText:
        "Dominant warm brown block with a cool accent band and a rounded highlight near the top.",
    });

    expect(prompt).toContain("Return ONLY valid JSON");
    expect(prompt).toContain('"title"');
    expect(prompt).toContain("photo.png");
    expect(prompt).toContain("#774433");
    expect(prompt).toContain("#335577");
  });
});

describe("generatePictureModelViaGateway", () => {
  const client = {
    call: vi.fn(async (method: string) => {
      if (method === "agents.list") {
        return { mainKey: "main" };
      }
      if (method === "chat.send") {
        return { runId: "run-123" };
      }
      if (method === "agent.wait") {
        return { status: "done" };
      }
      if (method === "chat.history") {
        return {
          messages: [
            {
              role: "assistant",
              content: JSON.stringify({
                title: "Desk Mascot",
                summary: "A chunky desk mascot.",
                footprintMeters: {
                  width: 1.1,
                  depth: 0.7,
                  height: 1.3,
                },
                primitives: [
                  {
                    kind: "box",
                    size: [0.8, 0.3, 0.6],
                    position: [0, 0.15, 0],
                    material: { color: "#774433" },
                  },
                  {
                    kind: "sphere",
                    radius: 0.22,
                    position: [0, 0.72, 0.04],
                    material: { color: "#f1dfc8" },
                  },
                  {
                    kind: "box",
                    size: [0.16, 0.7, 0.12],
                    position: [0.34, 0.56, 0.02],
                    material: { color: "#335577" },
                  },
                ],
              }),
            },
          ],
        };
      }
      return {};
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a helper agent, waits for completion, and returns the recipe", async () => {
    const recipe = await generatePictureModelViaGateway({
      client: client as never,
      summary: {
        fileName: "photo.png",
        aspectRatio: 1.2,
        dominantColor: "#774433",
        accentColor: "#335577",
        pixelWidth: 32,
        pixelHeight: 28,
        summaryText:
          "Dominant warm brown block with a cool accent band and a rounded highlight near the top.",
      },
    });

    expect(recipe.title).toBe("Desk Mascot");
    expect(recipe.primitives).toHaveLength(3);
    expect(client.call).toHaveBeenCalledWith("chat.send", expect.any(Object));
    expect(client.call).toHaveBeenCalledWith("agent.wait", {
      runId: "run-123",
      timeoutMs: 120_000,
    });
  });

  it("exports the upload size constant for the route", () => {
    expect(MAX_PICTURE_MODEL_UPLOAD_BYTES).toBe(12 * 1024 * 1024);
  });
});
