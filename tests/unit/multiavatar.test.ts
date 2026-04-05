import { describe, expect, it } from "vitest";

import { buildAvatarDataUrl, buildAvatarSvg } from "@/lib/avatars/multiavatar";

describe("multiavatar helpers", () => {
  it("buildAvatarSvg returns svg markup", () => {
    const svg = buildAvatarSvg("Agent A");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("AA");
    expect(svg).toContain("bunny avatar");
    expect(svg).toContain('data-bunny="true"');
  });

  it("buildAvatarDataUrl returns a data url", () => {
    const url = buildAvatarDataUrl("Agent A");
    expect(url.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    expect(url).toContain("%3Csvg");
  });

  it("is deterministic for the same seed", () => {
    expect(buildAvatarSvg("Agent A")).toBe(buildAvatarSvg("Agent A"));
  });

  it("varies across different seeds", () => {
    expect(buildAvatarSvg("Agent A")).not.toBe(buildAvatarSvg("Agent B"));
  });
});
