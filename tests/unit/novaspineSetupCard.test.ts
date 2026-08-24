import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { NovaSpineSetupCard } from "@/features/agents/components/NovaSpineSetupCard";

const readyStatus = {
  openclawDetected: true,
  openclawVersion: "2026.4.12",
  openclawVersionValidated: true,
  pythonDetected: true,
  pythonVersion: "3.12.3",
  pythonSupported: true,
  novaspineModuleDetected: false,
  openclawConfigPath: "/tmp/openclaw.json",
  bundledVersion: "0.3.3",
  packageSpec: "novaspine==0.3.3",
  memorySlot: null,
  contextEngineSlot: null,
  consciousnessEnabled: false,
  integrationEnabled: false,
  readiness: "ready" as const,
  messages: [],
};

const integratedStatus = {
  ...readyStatus,
  novaspineModuleDetected: true,
  memorySlot: "novaspine-memory",
  contextEngineSlot: "novaspine-context",
  consciousnessEnabled: true,
  integrationEnabled: true,
  readiness: "integrated" as const,
};

describe("NovaSpineSetupCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads and renders ready-to-install status", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ status: readyStatus }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(NovaSpineSetupCard));

    expect(await screen.findByText("Enable NovaSpine memory")).toBeInTheDocument();
    expect(screen.getByText(/OpenClaw:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable NovaSpine" })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledWith("/api/novaspine", { cache: "no-store" });
  });

  it("runs the install flow and renders the latest setup result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: readyStatus }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            status: integratedStatus,
            steps: [
              { name: "repo-sync", ok: true, detail: "ok" },
              { name: "python-package", ok: true, detail: "ok" },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(NovaSpineSetupCard));

    fireEvent.click(await screen.findByRole("button", { name: "Enable NovaSpine" }));

    await waitFor(() => {
      expect(screen.getByText("NovaSpine is active")).toBeInTheDocument();
    });
    expect(screen.getByText("Latest setup run")).toBeInTheDocument();
    expect(screen.getByText(/repo-sync/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/novaspine",
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
