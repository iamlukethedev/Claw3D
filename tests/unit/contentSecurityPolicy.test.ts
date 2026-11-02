import { afterEach, describe, expect, it, vi } from "vitest";

// next.config.ts builds its headers when it is loaded, so each case loads it fresh under the NODE_ENV it checks.
const scriptSrc = async (nodeEnv: string) => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  const config = (await import("../../next.config")).default;
  const routes = (await config.headers?.()) ?? [];
  const csp = routes
    .flatMap((route) => route.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;
  return csp?.split("; ").find((directive) => directive.startsWith("script-src ")) ?? "";
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Content-Security-Policy script-src", () => {
  it("lets production compile WebAssembly (the Meshopt/Draco model decoders) without allowing eval", async () => {
    const directive = await scriptSrc("production");
    expect(directive).toContain("'wasm-unsafe-eval'");
    expect(directive).not.toContain("'unsafe-eval'");
  });

  it("keeps 'unsafe-eval' in development for Next.js dev tooling", async () => {
    expect(await scriptSrc("development")).toContain("'unsafe-eval'");
  });
});
