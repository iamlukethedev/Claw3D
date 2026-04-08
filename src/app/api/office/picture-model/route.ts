import { NextResponse } from "next/server";
import { NodeGatewayClient } from "@/lib/gateway/nodeGatewayClient";
import {
  generatePictureModelViaGateway,
  MAX_PICTURE_MODEL_UPLOAD_BYTES,
} from "@/lib/office/pictureModelGeneration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gatewayClient = new NodeGatewayClient();
  try {
    const MULTIPART_OVERHEAD_ALLOWANCE = 1024;
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader !== null) {
      const contentLength = Number(contentLengthHeader);
      if (
        !Number.isNaN(contentLength) &&
        contentLength > MAX_PICTURE_MODEL_UPLOAD_BYTES + MULTIPART_OVERHEAD_ALLOWANCE
      ) {
        return NextResponse.json(
          {
            error: `Image upload exceeds the ${MAX_PICTURE_MODEL_UPLOAD_BYTES} byte limit.`,
          },
          { status: 413 },
        );
      }
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const previewDataUrl = formData.get("previewDataUrl");
    const gatewayUrl = formData.get("gatewayUrl");
    const gatewayToken = formData.get("gatewayToken");

    if (
      image === null ||
      typeof image !== "object" ||
      typeof (image as File).arrayBuffer !== "function"
    ) {
      return NextResponse.json(
        { error: "image file is required." },
        { status: 400 },
      );
    }
    if (typeof previewDataUrl !== "string" || !previewDataUrl.trim()) {
      return NextResponse.json(
        { error: "previewDataUrl is required." },
        { status: 400 },
      );
    }
    if (typeof gatewayUrl !== "string" || !gatewayUrl.trim()) {
      return NextResponse.json(
        { error: "gatewayUrl is required." },
        { status: 400 },
      );
    }

    const imageFile = image as File;
    const arrayBuffer = await imageFile.arrayBuffer();
    const byteLength = arrayBuffer.byteLength;
    if (byteLength <= 0) {
      return NextResponse.json({ error: "Image upload is empty." }, { status: 400 });
    }
    if (byteLength > MAX_PICTURE_MODEL_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `Image upload exceeds the ${MAX_PICTURE_MODEL_UPLOAD_BYTES} byte limit.`,
        },
        { status: 413 },
      );
    }

    if (!imageFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image uploads are supported." },
        { status: 400 },
      );
    }

    await gatewayClient.connect({
      gatewayUrl,
      token: typeof gatewayToken === "string" ? gatewayToken : "",
      authScopeKey: gatewayUrl,
      disableDeviceAuth: false,
    });

    const result = await generatePictureModelViaGateway({
      client: gatewayClient,
      summary: {
        fileName: imageFile.name,
        aspectRatio: imageFile.size > 0 ? 1 : 1,
        dominantColor: "#7c5c3b",
        accentColor: "#f59e0b",
        pixelWidth: 32,
        pixelHeight: 32,
        summaryText: previewDataUrl.trim(),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate the 3D model from the uploaded image.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    gatewayClient.close();
  }
}
