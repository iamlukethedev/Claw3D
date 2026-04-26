import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/office/events/route";

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const sign = (body: string, secret: string, timestamp: string) =>
  `sha256=${crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;

const makeSignedRequest = (body: unknown, secret = "test-secret") => {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  return new Request("http://localhost/api/office/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-claw3d-signature": sign(rawBody, secret, timestamp),
      "x-claw3d-timestamp": timestamp,
    },
    body: rawBody,
  });
};

describe("office events route", () => {
  const priorStateDir = process.env.OPENCLAW_STATE_DIR;
  const priorSecret = process.env.CLAW3D_OFFICE_EVENTS_SECRET;
  let tempDir: string | null = null;

  afterEach(() => {
    process.env.OPENCLAW_STATE_DIR = priorStateDir;
    process.env.CLAW3D_OFFICE_EVENTS_SECRET = priorSecret;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("stores signed office events and returns recent events", async () => {
    tempDir = makeTempDir("office-events-route-store");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    process.env.CLAW3D_OFFICE_EVENTS_SECRET = "test-secret";

    const response = await POST(
      makeSignedRequest({
        source: "hubspot",
        eventType: "deal.closed",
        title: "Deal closed",
        message: "Automotive account signed.",
        effect: "confetti",
      }),
    );
    const body = (await response.json()) as {
      event?: { id?: string; source?: string; effect?: string };
    };

    expect(response.status).toBe(201);
    expect(body.event).toEqual(
      expect.objectContaining({
        source: "hubspot",
        effect: "confetti",
      }),
    );

    const getResponse = await GET();
    const getBody = (await getResponse.json()) as {
      events?: Array<{ title?: string; message?: string }>;
    };
    expect(getResponse.status).toBe(200);
    expect(getBody.events?.[0]).toEqual(
      expect.objectContaining({
        title: "Deal closed",
        message: "Automotive account signed.",
      }),
    );
  });

  it("rejects missing or invalid signatures when a secret is configured", async () => {
    tempDir = makeTempDir("office-events-route-signature");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    process.env.CLAW3D_OFFICE_EVENTS_SECRET = "test-secret";

    const missing = await POST(
      new Request("http://localhost/api/office/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: "ci.failed" }),
      }),
    );
    expect(missing.status).toBe(401);

    const invalid = await POST(
      new Request("http://localhost/api/office/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-claw3d-signature": "sha256=bad",
        },
        body: JSON.stringify({ eventType: "ci.failed" }),
      }),
    );
    expect(invalid.status).toBe(401);
  });

  it("returns 400 for invalid payloads", async () => {
    tempDir = makeTempDir("office-events-route-invalid");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    process.env.CLAW3D_OFFICE_EVENTS_SECRET = "test-secret";

    const response = await POST(makeSignedRequest({ source: "ci" }));
    expect(response.status).toBe(400);
  });
});
