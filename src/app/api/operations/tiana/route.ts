import { NextResponse } from "next/server";
import { loadTianaOperationsSnapshot } from "@/lib/operations/tianaBoard";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await loadTianaOperationsSnapshot();
  return NextResponse.json(snapshot);
}
