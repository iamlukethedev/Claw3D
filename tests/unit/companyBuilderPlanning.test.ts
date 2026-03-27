import { describe, expect, it } from "vitest";
import {
  buildCompanyAgentBlueprints,
  buildStoredCompanySnapshot,
  parseCompanyPlanFromAssistantText,
} from "@/features/company-builder/planning";

describe("parseCompanyPlanFromAssistantText", () => {
  it("parses fenced JSON into a normalized company plan", () => {
    const plan = parseCompanyPlanFromAssistantText(`
\`\`\`json
{
  "companyName": "Orbit Threads",
  "summary": "A silly but practical clothing brand.",
  "sharedRules": ["Keep handoffs explicit"],
  "plannerNotes": ["Stay brand-consistent"],
  "roles": [
    {
          "name": "StoreManager",
      "purpose": "Owns sales and operations.",
      "soul": "Decisive and upbeat.",
      "responsibilities": ["Run the shop floor", "Track promotions"],
      "collaborators": ["Social Media Stylist"],
      "tools": ["CRM", "inventory dashboard"],
      "heartbeat": ["Check sales every morning"],
      "emoji": "🧵",
      "creature": "fox",
      "vibe": "sharp and stylish",
      "userContext": "The founder wants weekly launches.",
      "commandMode": "ask"
    }
  ]
}
\`\`\`
`);

    expect(plan.companyName).toBe("Orbit Threads");
    expect(plan.roles).toHaveLength(1);
    expect(plan.roles[0]?.title).toBe("StoreManager");
    expect(plan.roles[0]?.responsibilities).toEqual([
      "Run the shop floor",
      "Track promotions",
    ]);
  });

  it("normalizes multi-word role names into one word", () => {
    const plan = parseCompanyPlanFromAssistantText(
      JSON.stringify({
        companyName: "Orbit Threads",
        summary: "A silly but practical clothing brand.",
        roles: [
          {
            title: "Pipeline Orbit Captain",
            purpose: "Owns delivery.",
            soul: "Focused.",
          },
        ],
      }),
    );

    expect(plan.roles[0]?.title).toBe("PipelineOrbitCapta");
  });

  it("dedupes repeated generated role names", () => {
    const plan = parseCompanyPlanFromAssistantText(
      JSON.stringify({
        companyName: "Orbit Threads",
        summary: "A silly but practical clothing brand.",
        roles: [
          {
            name: "Builder",
            purpose: "Owns delivery.",
            soul: "Focused.",
          },
          {
            name: "Builder",
            purpose: "Owns quality.",
            soul: "Sharp.",
          },
          {
            name: "Builder",
            purpose: "Owns support.",
            soul: "Helpful.",
          },
        ],
      }),
    );

    expect(plan.roles.map((role) => role.title)).toEqual(["Builder", "Builder2", "Builder3"]);
    expect(plan.roles.map((role) => role.id)).toEqual(["builder", "builder-2", "builder-3"]);
  });

  it("throws when no roles are returned", () => {
    expect(() =>
      parseCompanyPlanFromAssistantText(
        JSON.stringify({
          companyName: "Empty Co",
          summary: "Missing roles.",
          roles: [],
        }),
      ),
    ).toThrow("did not return any company roles");
  });
});

describe("buildCompanyAgentBlueprints", () => {
  it("maps roles into agent file blueprints", () => {
    const plan = parseCompanyPlanFromAssistantText(
      JSON.stringify({
        companyName: "Bug Bistro",
        summary: "A software team with strong handoffs.",
        sharedRules: ["Document decisions"],
        plannerNotes: ["Stay practical"],
        roles: [
          {
            name: "Developer",
            purpose: "Ships code.",
            soul: "Calm and methodical.",
            responsibilities: ["Implement features"],
            collaborators: ["QA Lead"],
            tools: ["repo", "tests"],
            heartbeat: ["Check PR queue"],
            emoji: "🛠",
            creature: "otter",
            vibe: "focused",
            userContext: "The company ships weekly.",
            commandMode: "auto",
          },
          {
            name: "QaLead",
            purpose: "Protects quality.",
            soul: "Skeptical and helpful.",
            responsibilities: ["Review releases"],
            collaborators: ["Developer"],
            tools: ["test plans"],
            heartbeat: ["Review risk daily"],
            emoji: "🧪",
            creature: "owl",
            vibe: "precise",
            userContext: "The company ships weekly.",
            commandMode: "ask",
          },
        ],
      }),
    );

    const blueprints = buildCompanyAgentBlueprints(plan);

    expect(blueprints).toHaveLength(2);
    expect(blueprints[0]?.files["AGENTS.md"]).toContain("Bug Bistro");
    expect(blueprints[0]?.files["AGENTS.md"]).toContain("Ships code.");
    expect(blueprints[0]?.files["SOUL.md"]).toContain("Calm and methodical.");
    expect(blueprints[1]?.files["HEARTBEAT.md"]).toContain("Review risk daily.");
  });
});

describe("buildStoredCompanySnapshot", () => {
  it("stores the serialized plan for reopening later", () => {
    const plan = parseCompanyPlanFromAssistantText(
      JSON.stringify({
        companyName: "Planner Corp",
        summary: "A generated company.",
        sharedRules: [],
        plannerNotes: [],
        roles: [
          {
            title: "Planner",
            purpose: "Plans work.",
            soul: "Structured.",
            responsibilities: ["Prioritize tasks"],
            collaborators: [],
            tools: [],
            heartbeat: [],
            emoji: "📋",
            creature: "cat",
            vibe: "organized",
            userContext: "",
            commandMode: "ask",
          },
        ],
      }),
    );

    const snapshot = buildStoredCompanySnapshot({
      prompt: "Build me a software company.",
      improvedBrief: "Build a software company with planning and delivery.",
      plan,
      now: () => "2026-03-26T00:00:00.000Z",
    });

    expect(snapshot.companyName).toBe("Planner Corp");
    expect(snapshot.roleTitles).toEqual(["Planner"]);
    expect(JSON.parse(snapshot.planJson)).toMatchObject({
      companyName: "Planner Corp",
    });
  });
});
