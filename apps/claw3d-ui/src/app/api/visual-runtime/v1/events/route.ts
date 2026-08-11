import { openVisualEventStream, VisualConnectorError } from "../../../../../server/jarvisConnector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const result = await openVisualEventStream(
      request.signal,
      request.headers.get("last-event-id") ?? undefined,
    );
    if (!result.stream) {
      const headers: Record<string, string> = { "cache-control": "no-store" };
      if (result.retryAfter) headers["retry-after"] = result.retryAfter;
      return Response.json({ schemaVersion: 1, error: "visual_stream_unavailable" }, {
        status: result.status,
        headers,
      });
    }
    return new Response(result.stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-store",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    const status = error instanceof VisualConnectorError ? error.status : 502;
    return Response.json({ schemaVersion: 1, error: "visual_stream_unavailable" }, {
      status,
      headers: { "cache-control": "no-store" },
    });
  }
}
