import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/office/call/route";

describe("office call route", () => {
  it("falls back to a generic callee when none is provided", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/office/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callee: "   ", message: null }),
      }),
    );

    const body = (await response.json()) as {
      scenario?: { callee?: string; promptText?: string | null; phase?: string };
    };

    expect(response.status).toBe(200);
    expect(body.scenario?.callee).toBe("Your Contact");
    expect(body.scenario?.phase).toBe("needs_message");
    expect(body.scenario?.promptText).toContain("Your Contact");
  });

  it("returns a structured validation error for invalid json", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/office/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    const body = (await response.json()) as {
      error?: string;
      code?: string;
      field?: string;
      details?: string;
    };

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: "Validation failed",
      code: "invalid_json",
      field: "body",
    });
    expect(body.details).toMatch(/Unexpected end|JSON/i);
  });
});
