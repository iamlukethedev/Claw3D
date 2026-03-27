import { describe, expect, it } from "vitest";
import {
  getNextStep,
  getPrevStep,
  getStepIndex,
  ONBOARDING_STEPS,
} from "@/features/onboarding/types";

describe("ONBOARDING_STEPS", () => {
  it("has at least 3 steps", () => {
    expect(ONBOARDING_STEPS.length).toBeGreaterThanOrEqual(3);
  });

  it("starts with welcome and ends with complete", () => {
    expect(ONBOARDING_STEPS[0].id).toBe("welcome");
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].id).toBe("complete");
  });

  it("has unique step IDs", () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every step has a non-empty title and description", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });
});

describe("getStepIndex", () => {
  it("returns 0 for welcome", () => {
    expect(getStepIndex("welcome")).toBe(0);
  });

  it("returns last index for complete", () => {
    expect(getStepIndex("complete")).toBe(ONBOARDING_STEPS.length - 1);
  });

  it("returns correct index for connect", () => {
    const idx = ONBOARDING_STEPS.findIndex((s) => s.id === "connect");
    expect(getStepIndex("connect")).toBe(idx);
  });

  it("includes the company step before completion", () => {
    const companyIndex = getStepIndex("company");
    const completeIndex = getStepIndex("complete");
    expect(companyIndex).toBeGreaterThan(getStepIndex("agents"));
    expect(companyIndex).toBe(completeIndex - 1);
  });
});

describe("getNextStep", () => {
  it("returns prerequisites after welcome", () => {
    expect(getNextStep("welcome")).toBe("prerequisites");
  });

  it("returns null after complete", () => {
    expect(getNextStep("complete")).toBeNull();
  });

  it("advances through all steps in order", () => {
    let current = ONBOARDING_STEPS[0].id;
    const visited: string[] = [current];
    let next = getNextStep(current);
    while (next) {
      visited.push(next);
      current = next;
      next = getNextStep(current);
    }
    expect(visited).toEqual(ONBOARDING_STEPS.map((s) => s.id));
  });
});

describe("getPrevStep", () => {
  it("returns null for welcome", () => {
    expect(getPrevStep("welcome")).toBeNull();
  });

  it("returns prerequisites for connect", () => {
    expect(getPrevStep("connect")).toBe("prerequisites");
  });

  it("navigates backward through all steps", () => {
    let current = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].id;
    const visited: string[] = [current];
    let prev = getPrevStep(current);
    while (prev) {
      visited.push(prev);
      current = prev;
      prev = getPrevStep(current);
    }
    visited.reverse();
    expect(visited).toEqual(ONBOARDING_STEPS.map((s) => s.id));
  });
});
