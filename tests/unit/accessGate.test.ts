// @vitest-environment node

import { describe, expect, it } from "vitest";

describe("createAccessGate", () => {
  it("allows when token is unset", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "" });
    expect(gate.allowUpgrade({ headers: {} })).toBe(true);
  });

  it("rejects /api requests without cookie when enabled", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });

    let statusCode = 0;
    let ended = false;
    const res = {
      setHeader: () => {},
      end: () => {
        ended = true;
      },
      get statusCode() {
        return statusCode;
      },
      set statusCode(value: number) {
        statusCode = value;
      },
    };

    const handled = gate.handleHttp(
      { url: "/api/studio", headers: { host: "example.test" } },
      res
    );

    expect(handled).toBe(true);
    expect(statusCode).toBe(401);
    expect(ended).toBe(true);
  });

  it("allows upgrades when cookie matches", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });
    expect(
      gate.allowUpgrade({ headers: { cookie: "studio_access=abc" } })
    ).toBe(true);
  });

  it("returns 429 after repeated failed attempts", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });

    const createResponse = () => {
      let statusCode = 0;
      let body = "";
      return {
        setHeader: () => {},
        end: (value?: string) => {
          body = value ?? "";
        },
        get statusCode() {
          return statusCode;
        },
        set statusCode(value: number) {
          statusCode = value;
        },
        get body() {
          return body;
        },
      };
    };

    for (let index = 0; index < 9; index++) {
      const res = createResponse();
      gate.handleHttp(
        { url: "/api/studio", headers: {}, socket: { remoteAddress: "127.0.0.1" } },
        res
      );
      expect(res.statusCode).toBe(401);
    }

    const limited = createResponse();
    gate.handleHttp(
      { url: "/api/studio", headers: {}, socket: { remoteAddress: "127.0.0.1" } },
      limited
    );

    expect(limited.statusCode).toBe(429);
    expect(limited.body).toContain("Too many failed studio access attempts");
  });

  it("recovers immediately when a valid cookie is sent after throttling", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });

    const createResponse = () => {
      let statusCode = 0;
      let body = "";
      return {
        setHeader: () => {},
        end: (value?: string) => {
          body = value ?? "";
        },
        get statusCode() {
          return statusCode;
        },
        set statusCode(value: number) {
          statusCode = value;
        },
        get body() {
          return body;
        },
      };
    };

    for (let index = 0; index < 10; index++) {
      const res = createResponse();
      gate.handleHttp(
        { url: "/api/studio", headers: {}, socket: { remoteAddress: "127.0.0.1" } },
        res
      );
    }

    expect(
      gate.allowUpgrade({
        headers: { cookie: "studio_access=abc" },
        socket: { remoteAddress: "127.0.0.1" },
      })
    ).toBe(true);

    const recovered = createResponse();
    gate.handleHttp(
      {
        url: "/api/studio",
        headers: { cookie: "studio_access=abc" },
        socket: { remoteAddress: "127.0.0.1" },
      },
      recovered
    );

    expect(recovered.statusCode).toBe(0);

    const afterReset = createResponse();
    gate.handleHttp(
      { url: "/api/studio", headers: {}, socket: { remoteAddress: "127.0.0.1" } },
      afterReset
    );

    expect(afterReset.statusCode).toBe(401);
    expect(afterReset.body).toContain("Studio access token required");
  });
});
