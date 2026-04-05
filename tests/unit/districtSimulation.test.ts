import { describe, expect, it } from "vitest";
import {
  createDistrictSimulationState,
  DISTRICT_SIM_DEFAULT_DISTRICT_COUNT,
  DISTRICT_SIM_DEFAULT_MAX_AGENTS,
  getDistrictSimulationNeedEmoji,
  getDistrictSimulationRelationship,
  reconcileDistrictSimulationAgents,
  stepDistrictSimulation,
} from "@/features/retro-office/core/districtSimulation";

const makeAgents = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `agent-${index + 1}`,
    name: `Agent ${index + 1}`,
  }));

describe("districtSimulation", () => {
  it("creates deterministic state with scope defaults", () => {
    const agents = makeAgents(20);
    const state = createDistrictSimulationState({
      agents,
      seedKey: "scope-a",
    });
    expect(state.districtCount).toBe(DISTRICT_SIM_DEFAULT_DISTRICT_COUNT);
    expect(state.maxAgents).toBe(DISTRICT_SIM_DEFAULT_MAX_AGENTS);
    expect(state.agents.length).toBe(10);
    expect(state.minuteOfDay).toBe(9 * 60);
    for (const agent of state.agents) {
      expect(agent.homeDistrictId).toBeGreaterThanOrEqual(0);
      expect(agent.homeDistrictId).toBeLessThan(10);
      expect(agent.workDistrictId).toBeGreaterThanOrEqual(0);
      expect(agent.workDistrictId).toBeLessThan(10);
      expect(agent.roomsOwned).toBeGreaterThanOrEqual(1);
      expect(agent.roomsOwned).toBeLessThanOrEqual(3);
    }
  });

  it("steps needs, activity, and wallet through schedule-driven simulation", () => {
    const state = createDistrictSimulationState({
      agents: makeAgents(3),
      districtCount: 10,
      maxAgents: 10,
      seedKey: "scope-a-schedule",
    });
    const firstBefore = state.agents[0];
    expect(firstBefore).toBeTruthy();
    const stepped = stepDistrictSimulation(state, { minutes: 60 });
    const firstAfter = stepped.agents[0];
    expect(firstAfter).toBeTruthy();
    expect(stepped.minuteOfDay).toBe((9 * 60 + 60) % (24 * 60));
    expect(firstAfter.activity).toMatch(/work|sleep|socialize|eat|idle/);
    expect(firstAfter.needs.hunger).toBeGreaterThanOrEqual(0);
    expect(firstAfter.needs.hunger).toBeLessThanOrEqual(100);
    expect(firstAfter.needs.energy).toBeGreaterThanOrEqual(0);
    expect(firstAfter.needs.energy).toBeLessThanOrEqual(100);
    expect(firstAfter.needs.social).toBeGreaterThanOrEqual(0);
    expect(firstAfter.needs.social).toBeLessThanOrEqual(100);
    expect(firstAfter.needs.comfort).toBeGreaterThanOrEqual(0);
    expect(firstAfter.needs.comfort).toBeLessThanOrEqual(100);
    if (firstAfter.activity === "work") {
      expect(firstAfter.wallet).toBeGreaterThan(firstBefore.wallet);
    }
  });

  it("charges rent on day rollover based on rooms owned", () => {
    const state = createDistrictSimulationState({
      agents: makeAgents(2),
      districtCount: 10,
      maxAgents: 10,
      seedKey: "scope-a-rent",
    });
    const before = state.agents[0];
    expect(before).toBeTruthy();
    const stepped = stepDistrictSimulation(
      {
        ...state,
        minuteOfDay: 23 * 60 + 50,
      },
      { minutes: 20 },
    );
    const after = stepped.agents[0];
    expect(stepped.day).toBe(2);
    expect(after.lastRentDay).toBe(2);
    expect(after.wallet).toBeLessThan(before.wallet);
  });

  it("updates relationship score by co-location and social activity", () => {
    const state = createDistrictSimulationState({
      agents: makeAgents(2),
      districtCount: 10,
      maxAgents: 10,
      seedKey: "scope-a-relationships",
    });
    const leftId = state.agents[0]?.id ?? "";
    const rightId = state.agents[1]?.id ?? "";
    expect(leftId).not.toBe("");
    expect(rightId).not.toBe("");
    const beforeScore = getDistrictSimulationRelationship(state, leftId, rightId);
    const stepped = stepDistrictSimulation(state, { minutes: 45 });
    const afterScore = getDistrictSimulationRelationship(stepped, leftId, rightId);
    expect(afterScore).not.toBe(beforeScore);
    expect(afterScore).toBeGreaterThanOrEqual(-100);
    expect(afterScore).toBeLessThanOrEqual(100);
  });

  it("reconciles agents while keeping relationship graph consistent", () => {
    const initial = createDistrictSimulationState({
      agents: makeAgents(4),
      districtCount: 10,
      maxAgents: 10,
      seedKey: "scope-a-reconcile",
    });
    const reconciled = reconcileDistrictSimulationAgents(initial, {
      agents: [
        { id: "agent-1", name: "Agent 1" },
        { id: "agent-3", name: "Agent 3" },
        { id: "agent-5", name: "Agent 5" },
      ],
      districtCount: 10,
      maxAgents: 10,
      seedKey: "scope-a-reconcile",
    });
    expect(reconciled.agents.map((agent) => agent.id)).toEqual([
      "agent-1",
      "agent-3",
      "agent-5",
    ]);
    expect(
      getDistrictSimulationRelationship(reconciled, "agent-1", "agent-3"),
    ).toBeTypeOf("number");
    expect(
      getDistrictSimulationRelationship(reconciled, "agent-1", "agent-5"),
    ).toBeTypeOf("number");
    expect(
      getDistrictSimulationRelationship(reconciled, "agent-3", "agent-5"),
    ).toBeTypeOf("number");
  });

  it("maps lowest critical need to HUD emoji", () => {
    expect(
      getDistrictSimulationNeedEmoji({
        hunger: 20,
        energy: 70,
        social: 70,
        comfort: 70,
      }),
    ).toBe("🍔");
    expect(
      getDistrictSimulationNeedEmoji({
        hunger: 80,
        energy: 20,
        social: 70,
        comfort: 70,
      }),
    ).toBe("😴");
    expect(
      getDistrictSimulationNeedEmoji({
        hunger: 80,
        energy: 80,
        social: 20,
        comfort: 70,
      }),
    ).toBe("💬");
    expect(
      getDistrictSimulationNeedEmoji({
        hunger: 80,
        energy: 80,
        social: 70,
        comfort: 20,
      }),
    ).toBe("🛋️");
    expect(
      getDistrictSimulationNeedEmoji({
        hunger: 90,
        energy: 90,
        social: 90,
        comfort: 90,
      }),
    ).toBeNull();
  });
});
