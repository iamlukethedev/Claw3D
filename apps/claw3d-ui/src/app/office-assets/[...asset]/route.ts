import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const ALLOWED_OFFICE_ASSETS = new Set<string>([
  "models/furniture/bookcaseClosed.glb",
  "models/furniture/chairDesk.glb",
  "models/furniture/chairModernCushion.glb",
  "models/furniture/computerScreen.glb",
  "models/furniture/desk.glb",
  "models/furniture/deskCorner.glb",
  "models/furniture/kitchenCabinet.glb",
  "models/furniture/kitchenCoffeeMachine.glb",
  "models/furniture/kitchenFridgeSmall.glb",
  "models/furniture/lampRoundFloor.glb",
  "models/furniture/loungeDesignChair.glb",
  "models/furniture/loungeSofa.glb",
  "models/furniture/plantSmall1.glb",
  "models/furniture/pottedPlant.glb",
  "models/furniture/table.glb",
  "models/furniture/tableCoffee.glb",
  "models/furniture/tableRound.glb",
]);

const assetRoot = path.resolve(process.cwd(), "../../public/office-assets");

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string[] }> },
) {
  const { asset } = await context.params;
  const relativeAsset = asset.join("/");
  if (!ALLOWED_OFFICE_ASSETS.has(relativeAsset)) {
    return new NextResponse(null, { status: 404 });
  }

  const filePath = path.resolve(assetRoot, relativeAsset);
  if (!filePath.startsWith(`${assetRoot}${path.sep}`)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const body = await readFile(filePath);
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": relativeAsset.endsWith(".png") ? "image/png" : "model/gltf-binary",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
