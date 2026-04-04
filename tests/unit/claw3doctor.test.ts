import { describe, expect, it } from "vitest";

import {
  DOCTOR_STATUSES,
  buildGatewayWarnings,
  resolveRuntimeContext,
  shouldRunHermesChecks,
  shouldRunOpenClawChecks,
  summarizeChecks,
} from "../../scripts/lib/claw3doctor-core.mjs";

describe("claw3doctor core", () => {
  it("resolves selected runtime from settings profiles", () => {
    const runtime = resolveRuntimeContext({
      settings: {
        gateway: {
          adapterType: "hermes",
          url: "ws://localhost:18790",
          token: "",
          profiles: {
            hermes: { url: "ws://localhost:18790", token: "" },
            openclaw: { url: "ws://localhost:18789", token: "file-token" },
          },
        },
      },
      upstreamGateway: {
        url: "ws://localhost:18789",
        token: "file-token",
        adapterType: "openclaw",
      },
      env: process.env,
    });

    expect(runtime).toMatchObject({
      adapterType: "hermes",
      gatewayUrl: "ws://localhost:18790",
      tokenConfigured: false,
    });
    const profiles = runtime.profiles as Record<string, { url: string; token: string }>;
    expect(profiles.openclaw?.url).toBe("ws://localhost:18789");
  });

  it("warns on insecure remote websocket and public studio without access token", () => {
    expect(
      buildGatewayWarnings({
        gatewayUrl: "ws://pi5.example.com:18789",
        studioAccessToken: "",
        host: "pi5.example.com",
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ws://"),
        expect.stringContaining("STUDIO_ACCESS_TOKEN"),
      ]),
    );
  });

  it("summarizes checks by worst status", () => {
    expect(
      summarizeChecks([
        { status: DOCTOR_STATUSES.pass },
        { status: DOCTOR_STATUSES.warn },
      ]),
    ).toBe(DOCTOR_STATUSES.warn);
    expect(
      summarizeChecks([
        { status: DOCTOR_STATUSES.pass },
        { status: DOCTOR_STATUSES.fail },
      ]),
    ).toBe(DOCTOR_STATUSES.fail);
  });

  it("enables provider-specific checks based on runtime and local state", () => {
    expect(
      shouldRunHermesChecks({
        runtimeContext: { adapterType: "hermes" },
        env: process.env,
      }),
    ).toBe(true);
    expect(
      shouldRunOpenClawChecks({
        runtimeContext: { adapterType: "demo" },
        openclawConfigExists: true,
      }),
    ).toBe(true);
  });
});
