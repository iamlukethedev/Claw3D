import { describe, expect, it } from "vitest";

const { handleMethod } = await import("../../server/demo-gateway-adapter.js");

describe("demo-gateway-adapter", () => {
  it("rejects_unsupported_cron_mutations", async () => {
    await expect(handleMethod("cron.add", {}, "1", () => {})).resolves.toMatchObject({
      type: "res",
      id: "1",
      ok: false,
      error: {
        code: "unsupported_method",
      },
    });

    await expect(handleMethod("cron.run", {}, "2", () => {})).resolves.toMatchObject({
      type: "res",
      id: "2",
      ok: false,
      error: {
        code: "unsupported_method",
      },
    });

    await expect(handleMethod("cron.remove", {}, "3", () => {})).resolves.toMatchObject({
      type: "res",
      id: "3",
      ok: false,
      error: {
        code: "unsupported_method",
      },
    });
  });
});
