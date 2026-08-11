export interface ParsedSseMessage {
  id?: string;
  event?: string;
  data: string;
}

export function parseSseFrame(frame: string): ParsedSseMessage | null {
  let id: string | undefined;
  let event: string | undefined;
  const data: string[] = [];
  for (const rawLine of frame.replace(/\r/g, "").split("\n")) {
    if (!rawLine || rawLine.startsWith(":")) continue;
    const separator = rawLine.indexOf(":");
    const field = separator === -1 ? rawLine : rawLine.slice(0, separator);
    const value = separator === -1 ? "" : rawLine.slice(separator + 1).replace(/^ /, "");
    if (field === "id" && !value.includes("\u0000")) id = value;
    else if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length > 0 ? { id, event, data: data.join("\n") } : null;
}

export async function* readSseMessages(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ParsedSseMessage> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const parsed = parseSseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (parsed) yield parsed;
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    const final = parseSseFrame(buffer);
    if (final) yield final;
  } finally {
    reader.releaseLock();
  }
}
