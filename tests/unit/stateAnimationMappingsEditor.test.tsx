import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StateAnimationMappingsEditor } from "@/features/office/components/panels/StateAnimationMappingsEditor";
import type { OfficeStateAnimationMapping } from "@/lib/office/stateMappingConfig";

const baseMapping: OfficeStateAnimationMapping = {
  id: "writing-desk",
  sourceState: "writing",
  label: "Writing",
  animationTarget: "desk",
  effect: "none",
  soundCueId: null,
  priority: 90,
  enabled: true,
};

describe("StateAnimationMappingsEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("adds starter mappings", () => {
    const onChange = vi.fn();

    render(
      createElement(StateAnimationMappingsEditor, {
        mappings: [],
        onChange,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Use starter set" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sourceState: "writing",
          animationTarget: "desk",
        }),
        expect.objectContaining({
          sourceState: "error",
          animationTarget: "server_room",
          effect: "alarm",
        }),
      ]),
    );
  });

  it("edits and removes a mapping", () => {
    const onChange = vi.fn();

    render(
      createElement(StateAnimationMappingsEditor, {
        mappings: [baseMapping],
        onChange,
      }),
    );

    fireEvent.change(screen.getByLabelText("Source state"), {
      target: { value: "syncing" },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ sourceState: "syncing", label: "Syncing" }),
    ]);

    fireEvent.change(screen.getByLabelText("Target"), {
      target: { value: "qa_lab" },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ animationTarget: "qa_lab" }),
    ]);

    const rule = screen.getByText("Rule 1").closest("div")?.parentElement?.parentElement;
    expect(rule).toBeTruthy();
    fireEvent.click(within(rule as HTMLElement).getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
