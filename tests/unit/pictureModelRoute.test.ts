import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn(async function connect() {});
const closeMock = vi.fn(function close() {});
const gatewayClientCtorMock = vi.fn(function NodeGatewayClientMock(
  this: Record<string, unknown>,
) {
  this.connect = connectMock;
  this.close = closeMock;
});

vi.mock("@/lib/gateway/nodeGatewayClient", () => ({
  NodeGatewayClient: gatewayClientCtorMock,
}));

vi.mock("@/lib/office/pictureModelGeneration", () => ({
  generatePictureModelViaGateway: vi.fn(
    async function generatePictureModelViaGatewayMock() {
      return {
        fileName: "demo.png",
        imageDataUrl: "data:image/webp;base64,abc",
        sourceImageDataUrl: "data:image/png;base64,abc",
        aspectRatio: 1,
        dominantColor: "#7c5c3b",
        accentColor: "#f59e0b",
        pixelWidth: 32,
        pixelHeight: 32,
        provider: "openclaw-chat",
        model: "gateway-session",
        summary: "Generated through OpenClaw chat.send.",
        visualSummary: {
          palette: {
            dominantColor: "#7c5c3b",
            accentColor: "#f59e0b",
          },
          aspectRatio: 1,
          pixelWidth: 32,
          pixelHeight: 32,
          occupancyRows: ["....", ".##.", ".##.", "...."],
          featureHints: ["single centered mass", "rounded highlight"],
        },
        recipe: {
          title: "Desk sculpture",
          summary: "Chunky low-poly office object.",
          footprintMeters: { width: 1, depth: 0.7, height: 1.4 },
          primitives: [
            {
              kind: "box",
              size: [0.8, 0.4, 0.6],
              position: [0, 0.2, 0],
              material: { color: "#7c5c3b" },
            },
            {
              kind: "box",
              size: [0.4, 0.8, 0.4],
              position: [0, 0.8, 0],
              material: { color: "#f59e0b" },
            },
            {
              kind: "sphere",
              radius: 0.18,
              position: [0, 1.28, 0],
              material: { color: "#f0d7b1" },
            },
          ],
        },
      };
    },
  ),
  MAX_PICTURE_MODEL_UPLOAD_BYTES: 12 * 1024 * 1024,
}));

const { POST } = await import("@/app/api/office/picture-model/route");

function makeImageFile(byteLength: number, type = "image/png") {
  return {
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(byteLength)),
    name: "demo.png",
    type,
  };
}

function mockRequest(opts: {
  contentLength?: string;
  imageFile?: ReturnType<typeof makeImageFile> | null;
  previewDataUrl?: string | null;
  gatewayUrl?: string | null;
  gatewayToken?: string | null;
}): Request {
  const headersMap = new Map<string, string>();
  if (opts.contentLength !== undefined) {
    headersMap.set("content-length", opts.contentLength);
  }

  const image = opts.imageFile ?? null;
  const previewDataUrl =
    opts.previewDataUrl === undefined
      ? "data:image/webp;base64,preview"
      : opts.previewDataUrl;
  const gatewayUrl =
    opts.gatewayUrl === undefined ? "[REDACTED]" : opts.gatewayUrl;
  const gatewayToken =
    opts.gatewayToken === undefined ? "" : opts.gatewayToken;

  const fakeFormData = {
    get: (key: string) => {
      if (key === "image") return image;
      if (key === "previewDataUrl") return previewDataUrl;
      if (key === "gatewayUrl") return gatewayUrl;
      if (key === "gatewayToken") return gatewayToken;
      return null;
    },
  };

  return {
    headers: { get: (name: string) => headersMap.get(name) ?? null },
    formData: () => Promise.resolve(fakeFormData),
  } as unknown as Request;
}

describe("POST /api/office/picture-model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 413 for obviously oversized uploads", async () => {
    const request = mockRequest({
      contentLength: String(12 * 1024 * 1024 + 4096),
      imageFile: makeImageFile(1024),
      gatewayUrl: "[REDACTED]",
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
  });

  it("returns 400 when the upload is missing", async () => {
    const response = await POST(mockRequest({ imageFile: null }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/image file is required/i),
    });
  });

  it("returns 400 when the gateway url is missing", async () => {
    const response = await POST(
      mockRequest({
        imageFile: makeImageFile(1024),
        gatewayUrl: null,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/gatewayUrl is required/i),
    });
  });

  it("connects through the gateway and returns generated asset payload", async () => {
    const response = await POST(
      mockRequest({ imageFile: makeImageFile(2048, "image/png") }),
    );

    expect(gatewayClientCtorMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      fileName: "demo.png",
      provider: "openclaw-chat",
    });
  });
});
