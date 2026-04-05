import { NextResponse } from "next/server";
import fs from "fs";

const AGENT_STATE_PATH =
  process.env.AGENT_STATE_PATH ||
  "C:/Projects/VOLAURA/memory/swarm/agent-state.json";

// Static roster — mirrors zeus-gateway-adapter.js
const ROSTER = [
  { id: "security-agent",                    name: "Security Agent",                       score: 9.0, session: "Core",       role: "Security Expert" },
  { id: "architecture-agent",                name: "Architecture Agent",                   score: 8.5, session: "Core",       role: "System Architect" },
  { id: "product-agent",                     name: "Product Agent",                        score: 8.0, session: "Core",       role: "Product Analyst" },
  { id: "needs-agent",                       name: "Needs Agent",                          score: 7.0, session: "Core",       role: "Process Analyst" },
  { id: "qa-engineer",                       name: "QA Engineer",                          score: 6.5, session: "Core",       role: "QA Engineer" },
  { id: "growth-agent",                      name: "Growth Agent",                         score: 5.0, session: "Core",       role: "Growth Analyst ⚠️" },
  { id: "risk-manager",                      name: "Risk Manager",                         score: null, session: "S76",       role: "Risk Manager (ISO 31000)" },
  { id: "readiness-manager",                 name: "Readiness Manager",                    score: null, session: "S76",       role: "Readiness Manager (SRE)" },
  { id: "sales-deal-strategist",             name: "Sales Deal Strategist",                score: null, session: "S57",       role: "B2B Deal Architect" },
  { id: "sales-discovery-coach",             name: "Sales Discovery Coach",                score: null, session: "S57",       role: "B2B Discovery Coach" },
  { id: "linkedin-content-creator",          name: "LinkedIn Content Creator",             score: null, session: "S57",       role: "LinkedIn & Brand Specialist" },
  { id: "cultural-intelligence-strategist",  name: "Cultural Intelligence Strategist",     score: null, session: "S57",       role: "AZ/CIS Cultural Audit 🔴" },
  { id: "accessibility-auditor",             name: "Accessibility Auditor",                score: null, session: "S57",       role: "WCAG 2.2 AA Specialist" },
  { id: "behavioral-nudge-engine",           name: "Behavioral Nudge Engine",              score: null, session: "S57",       role: "ADHD-First UX Validator 🔴" },
  { id: "assessment-science-agent",          name: "Assessment Science Agent",             score: null, session: "S82-GS",    role: "IRT/CAT Validator" },
  { id: "analytics-retention-agent",         name: "Analytics & Retention Agent",          score: null, session: "S82-GS",    role: "D0/D7/D30 Retention" },
  { id: "devops-sre-agent",                  name: "DevOps/SRE Agent",                     score: null, session: "S82-GS",    role: "Railway/Vercel/Supabase Ops" },
  { id: "financial-analyst-agent",           name: "Financial Analyst Agent",              score: null, session: "S82-GS",    role: "AZN Unit Economics" },
  { id: "ux-research-agent",                 name: "UX Research Agent",                    score: null, session: "S82-GS",    role: "JTBD & Usability Research" },
  { id: "pr-media-agent",                    name: "PR & Media Agent",                     score: null, session: "S82-GS",    role: "AZ Press Relations" },
  { id: "data-engineer-agent",               name: "Data Engineer Agent",                  score: null, session: "S82-GS",    role: "PostHog/Analytics Pipeline" },
  { id: "technical-writer-agent",            name: "Technical Writer Agent",               score: null, session: "S82-B2",    role: "API Docs & B2B Content" },
  { id: "payment-provider-agent",            name: "Payment Provider Agent",               score: null, session: "S82-B2",    role: "Paddle/Revenue Reconciliation" },
  { id: "community-manager-agent",           name: "Community Manager Agent",              score: null, session: "S82-B2",    role: "D7 Retention Playbook" },
  { id: "performance-engineer-agent",        name: "Performance Engineer Agent",           score: null, session: "S82-B2",    role: "pgvector & k6 Load Testing" },
  { id: "investor-board-agent",              name: "Investor/Board Agent",                 score: null, session: "S82-SH",    role: "VC Perspective Simulator" },
  { id: "competitor-intelligence-agent",     name: "Competitor Intelligence Agent",        score: null, session: "S82-SH",    role: "LinkedIn/TestGorilla Comp Intel" },
  { id: "university-ecosystem-partner-agent",name: "University & Ecosystem Partner Agent", score: null, session: "S82-SH",    role: "ADA/BHOS/GITA Partnerships" },
  { id: "ceo-report-agent",                  name: "CEO Report Agent",                     score: 7.0, session: "CEO",        role: "CEO Comms Translator" },
  { id: "qa-quality-agent",                  name: "QA Quality Agent",                     score: null, session: "S82-BS",    role: "Definition of Done Enforcer" },
  { id: "onboarding-specialist-agent",       name: "Onboarding Specialist Agent",          score: null, session: "S82-BS",    role: "First-5-Minute Optimizer" },
  { id: "customer-success-agent",            name: "Customer Success Agent",               score: null, session: "S82-BS",    role: "Churn Prevention Specialist" },
  { id: "trend-scout-agent",                 name: "Trend Scout Agent",                    score: null, session: "S83",       role: "Market Intelligence" },
  { id: "firuza",                            name: "Firuza",                               score: null, session: "Council",    role: "Execution Micro-Decisions (100%)" },
  { id: "nigar",                             name: "Nigar",                                score: null, session: "Council",    role: "B2B Feature Decisions (100%)" },
  { id: "communications-strategist",         name: "Communications Strategist",            score: null, session: "Support",    role: "Narrative & Content Strategy" },
  { id: "legal-advisor",                     name: "Legal Advisor",                        score: null, session: "Support",    role: "GDPR & Compliance" },
  { id: "fact-check-agent",                  name: "Fact-Check Agent",                     score: null, session: "Support",    role: "CEO Content Verification" },
  { id: "promotion-agency",                  name: "Promotion Agency",                     score: null, session: "Support",    role: "Distribution & Amplification" },
];

function loadState(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(AGENT_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed.agents || {};
  } catch {
    return {};
  }
}

export async function GET() {
  const liveState = loadState();

  const agents = ROSTER.map((agent) => {
    const live = liveState[agent.id] as Record<string, unknown> | undefined;
    return {
      ...agent,
      status: (live?.status as string) || "uninitialized",
      last_task: (live?.last_task as string) || null,
      tasks_completed: ((live?.performance as Record<string, unknown>)?.tasks_completed as number) || 0,
      quality_score: ((live?.performance as Record<string, unknown>)?.quality_score as number) || null,
      last_active: (live?.last_active as string) || null,
    };
  });

  return NextResponse.json(
    { agents, total: agents.length, live_tracked: Object.keys(liveState).length },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
