"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { WebSocketServer } = require("ws");
const Anthropic = require("@anthropic-ai/sdk");

const ADAPTER_PORT = parseInt(process.env.ZEUS_ADAPTER_PORT || "18789", 10);
const MAIN_KEY = "main";

// ─── LLM provider config ───────────────────────────────────────────────────────
//
// Model routing by agent capability tier:
//
//  LOCAL  (Ollama, free, instant)   — qwen3:8b
//    Fast process agents: devops, qa, technical-writer, readiness, needs
//
//  NVIDIA-REASONING (DeepSeek R1)   — rigorous, finds edge cases
//    Security, architecture, risk — anything where missing something is expensive
//
//  NVIDIA-FAST (Llama 3.3 70B)      — smart generalist
//    Product, growth, analytics, finance, UX — pattern + strategy work
//
//  NVIDIA-MULTILINGUAL (Mistral Large) — RU/EN/AZ cultural nuance
//    Cultural strategist, LinkedIn, PR, communications
//
//  NVIDIA-SYNTHESIS (Nemotron 253B) — largest, /swarm synthesis only
//    Cross-agent synthesis, investor pitch, CEO reports
//
//  ANTHROPIC (Haiku)                — last resort if NVIDIA down
//
const OLLAMA_URL   = process.env.OLLAMA_URL   || "http://localhost:11434";
const NVIDIA_URL   = "https://integrate.api.nvidia.com/v1";
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";

// Keys for each NVIDIA model
const NIM = {
  fast:          "meta/llama-3.3-70b-instruct",
  reasoning:     "deepseek-ai/deepseek-r1",
  multilingual:  "mistralai/mistral-large-2-instruct",
  synthesis:     "nvidia/llama-3.1-nemotron-ultra-253b-v1",
};

// Per-agent tier assignment
// Agents NOT listed here get "local" (qwen3:8b)
const AGENT_TIER = {
  // Reasoning — security-critical, must not miss things
  "security-agent":               "reasoning",
  "architecture-agent":           "reasoning",
  "risk-manager":                 "reasoning",
  "assessment-science-agent":     "reasoning",
  "behavioral-nudge-engine":      "reasoning",  // ADHD psychology = nuanced

  // Fast generalist — strategy, product, growth
  "product-agent":                "fast",
  "growth-agent":                 "fast",
  "needs-agent":                  "fast",
  "analytics-retention-agent":    "fast",
  "financial-analyst-agent":      "fast",
  "ux-research-agent":            "fast",
  "investor-board-agent":         "fast",
  "competitor-intelligence-agent":"fast",
  "ceo-report-agent":             "fast",
  "fact-check-agent":             "fast",
  "trend-scout-agent":            "fast",

  // Multilingual / cultural / content — RU/EN/AZ nuance
  "cultural-intelligence-strategist":   "multilingual",
  "linkedin-content-creator":           "multilingual",
  "pr-media-agent":                     "multilingual",
  "communications-strategist":          "multilingual",
  "sales-deal-strategist":              "multilingual",
  "sales-discovery-coach":              "multilingual",

  // Synthesis — /swarm cross-agent, CEO reports, ecosystem summaries
  // (not per-agent; set dynamically in callAgent for synthesis calls)
};

function agentModel(agentId) {
  const tier = AGENT_TIER[agentId] || "local";
  switch (tier) {
    case "reasoning":    return { provider: "nvidia", model: NIM.reasoning };
    case "fast":         return { provider: "nvidia", model: NIM.fast };
    case "multilingual": return { provider: "nvidia", model: NIM.multilingual };
    case "synthesis":    return { provider: "nvidia", model: NIM.synthesis };
    default:             return { provider: "ollama", model: "qwen3:8b" };
  }
}

// Anthropic kept as emergency fallback if NVIDIA is down
const CLAUDE_MODEL   = "claude-haiku-4-5-20251001";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

const MODELS = [
  { id: "qwen3:8b",            name: "Qwen3 8B (local — process agents)",         provider: "ollama" },
  { id: NIM.reasoning,         name: "DeepSeek R1 (security, architecture, risk)", provider: "nvidia" },
  { id: NIM.fast,              name: "Llama 3.3 70B (product, growth, analytics)", provider: "nvidia" },
  { id: NIM.multilingual,      name: "Mistral Large (cultural, content, RU/AZ)",   provider: "nvidia" },
  { id: NIM.synthesis,         name: "Nemotron 253B (swarm synthesis)",             provider: "nvidia" },
  ...(anthropic ? [{ id: CLAUDE_MODEL, name: "Claude Haiku (emergency fallback)", provider: "anthropic" }] : []),
];

const _nim = NVIDIA_API_KEY ? "✅" : "❌ no NVIDIA_API_KEY";
console.info(`[zeus-gateway] Providers: Ollama=✅  NVIDIA=${_nim}  Anthropic=${anthropic ? "✅" : "❌"}`);

const AGENT_STATE_PATH = process.env.AGENT_STATE_PATH ||
  "C:/Projects/VOLAURA/memory/swarm/agent-state.json";

const MINDSHIFT = "C:/Users/user/Downloads/mindshift";

// ─── Security blocker 2: hardcoded file paths only, no user input ─────────────
const AGENT_FILE_MAPPING = {
  "security-agent": [
    `${MINDSHIFT}/.claude/rules/security.md`,
    `${MINDSHIFT}/.claude/rules/guardrails.md`,
  ],
  "architecture-agent": [
    `${MINDSHIFT}/.claude/rules/typescript.md`,
    `${MINDSHIFT}/docs/adr/0001-db-backed-rate-limiting.md`,
    `${MINDSHIFT}/docs/adr/0002-state-management-zustand.md`,
    `${MINDSHIFT}/docs/adr/0003-offline-first-pattern.md`,
    `${MINDSHIFT}/docs/adr/0006-ai-edge-functions-gemini.md`,
  ],
  "product-agent": [
    `${MINDSHIFT}/CLAUDE.md`,
    `${MINDSHIFT}/.claude/rules/guardrails.md`,
    `${MINDSHIFT}/.claude/rules/crystal-shop-ethics.md`,
  ],
  "qa-engineer": [
    `${MINDSHIFT}/.claude/rules/testing.md`,
    `${MINDSHIFT}/.claude/rules/guardrails.md`,
  ],
  "ux-research-agent": [
    `${MINDSHIFT}/.claude/rules/guardrails.md`,
    `${MINDSHIFT}/docs/adr/0005-adhd-safe-color-system.md`,
    `${MINDSHIFT}/docs/adr/0007-accessibility-motion-system.md`,
  ],
  "behavioral-nudge-engine": [
    `${MINDSHIFT}/.claude/rules/guardrails.md`,
    `${MINDSHIFT}/.claude/rules/crystal-shop-ethics.md`,
  ],
  "cultural-intelligence-strategist": [
    `${MINDSHIFT}/.claude/rules/guardrails.md`,
    `${MINDSHIFT}/CLAUDE.md`,
  ],
  "accessibility-auditor": [
    `${MINDSHIFT}/.claude/rules/guardrails.md`,
    `${MINDSHIFT}/docs/adr/0007-accessibility-motion-system.md`,
    `${MINDSHIFT}/docs/adr/0005-adhd-safe-color-system.md`,
  ],
  "financial-analyst-agent": [
    `${MINDSHIFT}/.claude/rules/crystal-shop-ethics.md`,
    `${MINDSHIFT}/CLAUDE.md`,
  ],
  "devops-sre-agent": [
    `${MINDSHIFT}/.claude/rules/security.md`,
    `${MINDSHIFT}/docs/adr/0004-pwa-service-worker-strategy.md`,
  ],
  "risk-manager": [
    `${MINDSHIFT}/.claude/rules/security.md`,
    `${MINDSHIFT}/.claude/rules/guardrails.md`,
    `${MINDSHIFT}/.claude/rules/crystal-shop-ethics.md`,
  ],
  "growth-agent": [
    `${MINDSHIFT}/CLAUDE.md`,
    `${MINDSHIFT}/.claude/rules/crystal-shop-ethics.md`,
  ],
  "ceo-report-agent": [
    `${MINDSHIFT}/CLAUDE.md`,
  ],
};

// ─── Security blocker 3: system prompt with constraints per agent ──────────────
function buildSystemPrompt(agent) {
  const state = loadAgentState();
  const liveState = state[agent.id];
  const stateInfo = liveState
    ? `Current status: ${liveState.status}. Last task: "${liveState.last_task || "none"}". Tasks completed: ${liveState.performance?.tasks_completed || 0}.`
    : "No tracked state yet (new agent).";

  return `You are ${agent.name}, a specialist AI agent in the ZEUS swarm for the MindShift project.

Your role: ${agent.role}
Your state: ${stateInfo}

MindShift is an ADHD-aware productivity PWA (React + TypeScript + Supabase). You are reviewing and advising on this project.

HARD CONSTRAINTS — never violate:
1. You provide analysis, recommendations, and code review only. You do NOT execute code or shell commands.
2. You stay within your domain expertise (${agent.role}).
3. You are direct and concise — no filler, no hedging. Lead with the finding.
4. You reference the project files you were given. Never invent facts.
5. If you don't know something, say "I need to see [specific file]" — don't guess.
6. Follow MindShift guardrails: no red color, ADHD-safe language, no shame mechanics.

Output format:
- For reviews: Finding → Evidence → Fix (concrete code or instruction)
- For advice: Recommendation → Why → Risk if ignored
- Keep responses under 300 words unless the task demands more.`;
}

// ─── File context loading ──────────────────────────────────────────────────────
const fileContextCache = new Map(); // sessionKey → { ts, contents }
const FILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function loadContextFiles(agentId) {
  const filePaths = AGENT_FILE_MAPPING[agentId] || [];
  if (filePaths.length === 0) return {};

  const contents = {};
  for (const filePath of filePaths) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 500_000) {
        contents[filePath] = `[FILE TOO LARGE: ${(stat.size / 1024).toFixed(0)}KB — skipped]`;
        continue;
      }
      contents[filePath] = fs.readFileSync(filePath, "utf8");
    } catch (err) {
      contents[filePath] = `[NOT FOUND: ${path.basename(filePath)}]`;
    }
  }
  return contents;
}

function getCachedContextFiles(sessionKey, agentId) {
  const now = Date.now();
  const cached = fileContextCache.get(sessionKey);
  if (cached && now - cached.ts < FILE_CACHE_TTL_MS) return cached.contents;

  const contents = loadContextFiles(agentId);
  fileContextCache.set(sessionKey, { ts: now, contents });
  return contents;
}

function buildUserPrompt(agentId, contextFiles, userMessage) {
  const fileEntries = Object.entries(contextFiles);
  if (fileEntries.length === 0) {
    return userMessage;
  }

  let context = "# Project Files (your knowledge base for this session)\n\n";
  for (const [filePath, content] of fileEntries) {
    const name = path.basename(filePath);
    context += `## ${name}\n\`\`\`\n${content.slice(0, 20_000)}\n\`\`\`\n\n`;
  }
  context += `---\n\n# Task\n\n${userMessage}`;
  return context;
}

// ─── Agent roster (39 agents from ZEUS swarm) ─────────────────────────────────
const agents = new Map([
  // Core Agents (Session 1–53)
  ["security-agent", { id: "security-agent", name: "Security Agent", role: "Security Expert (9.0/10)", workspace: "/volaura/security" }],
  ["architecture-agent", { id: "architecture-agent", name: "Architecture Agent", role: "System Architect (8.5/10)", workspace: "/volaura/architecture" }],
  ["product-agent", { id: "product-agent", name: "Product Agent", role: "Product Analyst (8.0/10)", workspace: "/volaura/product" }],
  ["needs-agent", { id: "needs-agent", name: "Needs Agent", role: "Process Analyst (7.0/10)", workspace: "/volaura/needs" }],
  ["qa-engineer", { id: "qa-engineer", name: "QA Engineer", role: "QA Engineer (6.5/10)", workspace: "/volaura/qa" }],
  ["growth-agent", { id: "growth-agent", name: "Growth Agent", role: "Growth Analyst (5.0/10) ⚠️ SURVIVAL CLOCK", workspace: "/volaura/growth" }],
  // Session 76
  ["risk-manager", { id: "risk-manager", name: "Risk Manager", role: "Risk Manager (ISO 31000)", workspace: "/volaura/risk" }],
  ["readiness-manager", { id: "readiness-manager", name: "Readiness Manager", role: "Readiness Manager (SRE/ITIL v4)", workspace: "/volaura/readiness" }],
  // Session 57
  ["sales-deal-strategist", { id: "sales-deal-strategist", name: "Sales Deal Strategist", role: "B2B Deal Architecture Specialist", workspace: "/volaura/sales/deal" }],
  ["sales-discovery-coach", { id: "sales-discovery-coach", name: "Sales Discovery Coach", role: "B2B Discovery Flow Coach", workspace: "/volaura/sales/discovery" }],
  ["linkedin-content-creator", { id: "linkedin-content-creator", name: "LinkedIn Content Creator", role: "LinkedIn & Professional Brand Specialist", workspace: "/volaura/content/linkedin" }],
  ["cultural-intelligence-strategist", { id: "cultural-intelligence-strategist", name: "Cultural Intelligence Strategist", role: "AZ/CIS Cultural Audit Specialist 🔴 CRITICAL", workspace: "/volaura/culture" }],
  ["accessibility-auditor", { id: "accessibility-auditor", name: "Accessibility Auditor", role: "WCAG 2.2 AA Accessibility Specialist", workspace: "/volaura/a11y" }],
  ["behavioral-nudge-engine", { id: "behavioral-nudge-engine", name: "Behavioral Nudge Engine", role: "ADHD-First UX Validator 🔴 CRITICAL", workspace: "/volaura/nudge" }],
  // Session 82 — Google-Scale
  ["assessment-science-agent", { id: "assessment-science-agent", name: "Assessment Science Agent", role: "IRT Parameter & Competency Framework Validator", workspace: "/volaura/assessment-science" }],
  ["analytics-retention-agent", { id: "analytics-retention-agent", name: "Analytics & Retention Agent", role: "Cohort Analysis & D0/D1/D7/D30 Retention Specialist", workspace: "/volaura/analytics" }],
  ["devops-sre-agent", { id: "devops-sre-agent", name: "DevOps/SRE Agent", role: "Railway/Vercel/Supabase Ops & Incident Response", workspace: "/volaura/devops" }],
  ["financial-analyst-agent", { id: "financial-analyst-agent", name: "Financial Analyst Agent", role: "AZN Unit Economics & LTV/CAC Specialist", workspace: "/volaura/finance" }],
  ["ux-research-agent", { id: "ux-research-agent", name: "UX Research Agent", role: "JTBD Framework & Usability Research Specialist", workspace: "/volaura/ux-research" }],
  ["pr-media-agent", { id: "pr-media-agent", name: "PR & Media Agent", role: "AZ Media Landscape & Press Relations Specialist", workspace: "/volaura/pr" }],
  ["data-engineer-agent", { id: "data-engineer-agent", name: "Data Engineer Agent", role: "PostHog/Analytics Pipeline & Event Schema Engineer", workspace: "/volaura/data-eng" }],
  // Session 82 Batch 2
  ["technical-writer-agent", { id: "technical-writer-agent", name: "Technical Writer Agent", role: "API Docs & B2B Content Specialist", workspace: "/volaura/tech-writer" }],
  ["payment-provider-agent", { id: "payment-provider-agent", name: "Payment Provider Agent", role: "Paddle Webhook Reliability & Revenue Reconciliation", workspace: "/volaura/payments" }],
  ["community-manager-agent", { id: "community-manager-agent", name: "Community Manager Agent", role: "Tribe Engagement & D7 Retention Playbook Specialist", workspace: "/volaura/community" }],
  ["performance-engineer-agent", { id: "performance-engineer-agent", name: "Performance Engineer Agent", role: "pgvector Index Audit & k6 Load Testing Specialist", workspace: "/volaura/performance" }],
  // Session 82 — Stakeholder
  ["investor-board-agent", { id: "investor-board-agent", name: "Investor/Board Agent", role: "VC & Board of Directors Perspective Simulator", workspace: "/volaura/investor" }],
  ["competitor-intelligence-agent", { id: "competitor-intelligence-agent", name: "Competitor Intelligence Agent", role: "LinkedIn/HH.ru/TestGorilla Competitive Analysis", workspace: "/volaura/competitor-intel" }],
  ["university-ecosystem-partner-agent", { id: "university-ecosystem-partner-agent", name: "University & Ecosystem Partner Agent", role: "ADA/BHOS/BSU University & GITA/KOBİA Partnership Specialist", workspace: "/volaura/ecosystem" }],
  // CEO Report
  ["ceo-report-agent", { id: "ceo-report-agent", name: "CEO Report Agent", role: "CEO Communications Translator (7.0/10)", workspace: "/volaura/ceo-report" }],
  // Session 82 BATCH-S
  ["qa-quality-agent", { id: "qa-quality-agent", name: "QA Quality Agent", role: "Definition of Done Enforcer — CTO Cannot Override", workspace: "/volaura/qa-quality" }],
  ["onboarding-specialist-agent", { id: "onboarding-specialist-agent", name: "Onboarding Specialist Agent", role: "First 5-Minute Experience Optimizer", workspace: "/volaura/onboarding" }],
  ["customer-success-agent", { id: "customer-success-agent", name: "Customer Success Agent", role: "D7 Retention & Churn Prevention Specialist", workspace: "/volaura/customer-success" }],
  // Session 83
  ["trend-scout-agent", { id: "trend-scout-agent", name: "Trend Scout Agent", role: "Market Intelligence & Technology Trend Detection", workspace: "/volaura/trend-scout" }],
  // Council
  ["firuza", { id: "firuza", name: "Firuza", role: "Council — Execution Micro-Decisions (100% accuracy)", workspace: "/volaura/council/firuza" }],
  ["nigar", { id: "nigar", name: "Nigar", role: "Council — B2B Feature Decisions (100% accuracy)", workspace: "/volaura/council/nigar" }],
  // Supporting
  ["communications-strategist", { id: "communications-strategist", name: "Communications Strategist", role: "Narrative Arc & Content Strategy Specialist", workspace: "/volaura/comms" }],
  ["legal-advisor", { id: "legal-advisor", name: "Legal Advisor", role: "Crystal Economy Compliance & GDPR Legal Review", workspace: "/volaura/legal" }],
  ["fact-check-agent", { id: "fact-check-agent", name: "Fact-Check Agent", role: "CEO Content Verification Specialist", workspace: "/volaura/fact-check" }],
  ["promotion-agency", { id: "promotion-agency", name: "Promotion Agency", role: "Distribution & Content Amplification Specialist", workspace: "/volaura/promotion" }],
]);

// ─── Live state ────────────────────────────────────────────────────────────────
let agentStateCache = {};
let agentStateCacheTs = 0;
const STATE_CACHE_TTL_MS = 60_000;

function loadAgentState() {
  const now = Date.now();
  if (now - agentStateCacheTs < STATE_CACHE_TTL_MS) return agentStateCache;
  try {
    const raw = fs.readFileSync(AGENT_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    agentStateCache = parsed.agents || {};
    agentStateCacheTs = now;
  } catch { /* silent */ }
  return agentStateCache;
}

function statusEmoji(status) {
  switch (status) {
    case "idle":    return "💤";
    case "active":  return "⚡";
    case "new":     return "🆕";
    case "running": return "🔄";
    default:        return "🤖";
  }
}

// ─── Protocol helpers ──────────────────────────────────────────────────────────
const files = new Map();
const sessionSettings = new Map();
const conversationHistory = new Map();
const activeRuns = new Map();
const activeSendEventFns = new Set();

function randomId() { return randomUUID().replace(/-/g, ""); }
function sessionKeyFor(agentId) { return `agent:${agentId}:${MAIN_KEY}`; }

function getHistory(sessionKey) {
  if (!conversationHistory.has(sessionKey)) conversationHistory.set(sessionKey, []);
  return conversationHistory.get(sessionKey);
}
function clearHistory(sessionKey) { conversationHistory.delete(sessionKey); }
function resOk(id, payload) { return { type: "res", id, ok: true, payload: payload ?? {} }; }
function resErr(id, code, message) { return { type: "res", id, ok: false, error: { code, message } }; }

function broadcastEvent(frame) {
  for (const send of activeSendEventFns) { try { send(frame); } catch {} }
}

function agentListPayload() {
  loadAgentState();
  return [...agents.values()].map((agent) => {
    const live = agentStateCache[agent.id];
    return {
      id: agent.id,
      name: agent.name,
      workspace: agent.workspace,
      identity: { name: agent.name, emoji: statusEmoji(live?.status) },
      role: agent.role,
    };
  });
}

// ─── Claude AI chat ────────────────────────────────────────────────────────────
async function callClaude(agent, sessionKey, userMessage, sendEvent, runId) {
  let seq = 0;
  const emitChat = (state, extra) => {
    sendEvent({ type: "event", event: "chat", seq: seq++, payload: { runId, sessionKey, state, ...extra } });
  };

  // Load file context (cached)
  const contextFiles = getCachedContextFiles(sessionKey, agent.id);
  const systemPrompt = buildSystemPrompt(agent);
  const userPrompt = buildUserPrompt(agent.id, contextFiles, userMessage);

  // Build conversation history for context
  const history = getHistory(sessionKey);
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userPrompt },
  ];

  let fullReply = "";

  const { provider, model } = agentModel(agent.id);
  console.info(`[zeus-gateway] ${agent.id} → ${provider}/${model}`);

  // ── helpers ──────────────────────────────────────────────────────────────────

  async function streamOllama() {
    const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        options: { num_predict: 1024, temperature: 0.5 },
      }),
    });
    if (!resp.ok) throw new Error(`Ollama ${resp.status}: ${await resp.text()}`);

    let buf = "";
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value, { stream: true }).split("\n").filter(Boolean)) {
        try {
          const token = JSON.parse(line).message?.content || "";
          buf += token; fullReply += token;
          if (buf.match(/[.!?]\s/) || buf.length >= 150) {
            emitChat("delta", { message: { role: "assistant", content: fullReply } });
            buf = "";
          }
        } catch { /* malformed chunk */ }
      }
    }
    if (buf) emitChat("delta", { message: { role: "assistant", content: fullReply } });
  }

  async function streamNvidia() {
    if (!NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY not set");
    const resp = await fetch(`${NVIDIA_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 1024,
        temperature: 0.5,
        stream: true,
      }),
    });
    if (!resp.ok) throw new Error(`NVIDIA NIM ${resp.status}: ${await resp.text()}`);

    let buf = "";
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = dec.decode(value, { stream: true }).split("\n").filter(l => l.startsWith("data: "));
      for (const line of lines) {
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;
        try {
          const token = JSON.parse(raw).choices?.[0]?.delta?.content || "";
          buf += token; fullReply += token;
          if (buf.match(/[.!?]\s/) || buf.length >= 150) {
            emitChat("delta", { message: { role: "assistant", content: fullReply } });
            buf = "";
          }
        } catch { /* malformed chunk */ }
      }
    }
    if (buf) emitChat("delta", { message: { role: "assistant", content: fullReply } });
  }

  async function streamHaiku() {
    if (!anthropic) throw new Error("ANTHROPIC_API_KEY not set");
    const stream = anthropic.messages.stream({
      model: CLAUDE_MODEL, max_tokens: 1024, system: systemPrompt, messages,
    });
    let buf = "";
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
        buf += chunk.delta.text; fullReply += chunk.delta.text;
        if (buf.match(/[.!?]\s/) || buf.length >= 150) {
          emitChat("delta", { message: { role: "assistant", content: fullReply } });
          buf = "";
        }
      }
    }
    if (buf) emitChat("delta", { message: { role: "assistant", content: fullReply } });
  }

  // ── Routing with fallback chain ───────────────────────────────────────────────
  const chain = provider === "ollama"
    ? [streamOllama, streamNvidia, streamHaiku]   // local → nvidia → anthropic
    : [streamNvidia, streamOllama, streamHaiku];   // nvidia → local → anthropic

  let lastErr;
  for (const fn of chain) {
    try {
      await fn();
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`[zeus-gateway] ${fn.name} failed: ${err.message} — trying next...`);
      fullReply = ""; // reset for next attempt
    }
  }

  if (!fullReply) {
    fullReply = `[All providers failed. Last error: ${lastErr?.message}]`;
    emitChat("delta", { message: { role: "assistant", content: fullReply } });
  }

  // Persist to history
  history.push({ role: "user", content: userMessage });
  history.push({ role: "assistant", content: fullReply });

  emitChat("final", { stopReason: "end_turn", message: { role: "assistant", content: fullReply } });
  sendEvent({
    type: "event",
    event: "presence",
    seq: seq++,
    payload: {
      sessions: {
        recent: [{ key: sessionKey, updatedAt: Date.now() }],
        byAgent: [{ agentId: agent.id, recent: [{ key: sessionKey, updatedAt: Date.now() }] }],
      },
    },
  });

  return fullReply;
}

// Static fallback when no API key
function staticReply(agent, message) {
  const state = agentStateCache[agent.id];
  return `${agent.name} (${agent.role}). Last task: "${state?.last_task || "none"}". ANTHROPIC_API_KEY not set — I'm in static mode. Set the key to get real AI responses. You asked: "${message}"`;
}

// ─── Method handler ────────────────────────────────────────────────────────────
async function handleMethod(method, params, id, sendEvent) {
  const p = params || {};

  switch (method) {
    case "agents.list":
      return resOk(id, { defaultId: "security-agent", mainKey: MAIN_KEY, agents: agentListPayload() });

    case "agents.create": {
      const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : "ZEUS Agent";
      const role = typeof p.role === "string" ? p.role.trim() : "";
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "zeus-agent";
      const agentId = `${slug}-${randomId().slice(0, 6)}`;
      agents.set(agentId, { id: agentId, name, role, workspace: `/volaura/${slug}` });
      broadcastEvent({ type: "event", event: "presence", payload: { sessions: { recent: [], byAgent: [] } } });
      return resOk(id, { agentId, name, workspace: `/volaura/${slug}` });
    }

    case "agents.update": {
      const agentId = typeof p.agentId === "string" ? p.agentId.trim() : "";
      const agent = agents.get(agentId);
      if (!agent) return resErr(id, "not_found", `Agent ${agentId} not found`);
      if (typeof p.name === "string" && p.name.trim()) agent.name = p.name.trim();
      if (typeof p.role === "string") agent.role = p.role.trim();
      return resOk(id, { ok: true, removedBindings: 0 });
    }

    case "agents.delete": {
      const agentId = typeof p.agentId === "string" ? p.agentId.trim() : "";
      if (agentId && agents.has(agentId) && agentId !== "security-agent") {
        agents.delete(agentId);
        clearHistory(sessionKeyFor(agentId));
      }
      return resOk(id, { ok: true, removedBindings: 0 });
    }

    case "agents.files.get": {
      const key = `${p.agentId || "security-agent"}/${p.name || ""}`;
      const content = files.get(key);
      return resOk(id, { file: content !== undefined ? { content } : { missing: true } });
    }

    case "agents.files.set": {
      const key = `${p.agentId || "security-agent"}/${p.name || ""}`;
      files.set(key, typeof p.content === "string" ? p.content : "");
      return resOk(id, {});
    }

    case "config.get":
      return resOk(id, { config: { gateway: { reload: { mode: "hot" } } }, hash: "zeus-gateway", exists: true, path: "/volaura/config.json" });

    case "config.patch":
    case "config.set":
      return resOk(id, { hash: "zeus-gateway" });

    case "exec.approvals.get":
      return resOk(id, { path: "", exists: true, hash: "zeus-approvals", file: { version: 1, defaults: { security: "full", ask: "off", autoAllowSkills: true }, agents: {} } });

    case "exec.approvals.set":
      return resOk(id, { hash: "zeus-approvals" });

    case "exec.approval.resolve":
      return resOk(id, { ok: true });

    case "models.list":
      return resOk(id, { models: MODELS });

    case "skills.status":
      return resOk(id, { skills: [] });

    case "cron.list":
      return resOk(id, { jobs: [] });

    case "cron.add":
    case "cron.run":
    case "cron.remove":
      return resErr(id, "unsupported_method", `ZEUS gateway does not support ${method}.`);

    case "sessions.list": {
      const sessions = [...agents.values()].map((agent) => {
        const sessionKey = sessionKeyFor(agent.id);
        const history = getHistory(sessionKey);
        const settings = sessionSettings.get(sessionKey) || {};
        return {
          key: sessionKey,
          agentId: agent.id,
          updatedAt: history.length > 0 ? Date.now() : null,
          displayName: "Main",
          origin: { label: agent.name, provider: "zeus" },
          model: settings.model || MODELS[0].id,
          modelProvider: "anthropic",
        };
      });
      return resOk(id, { sessions });
    }

    case "sessions.preview": {
      const keys = Array.isArray(p.keys) ? p.keys : [];
      const limit = typeof p.limit === "number" ? p.limit : 8;
      const maxChars = typeof p.maxChars === "number" ? p.maxChars : 240;
      const previews = keys.map((key) => {
        const history = getHistory(key);
        if (history.length === 0) return { key, status: "empty", items: [] };
        const items = history.slice(-limit).map((msg) => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          text: String(msg.content || "").slice(0, maxChars),
          timestamp: Date.now(),
        }));
        return { key, status: "ok", items };
      });
      return resOk(id, { ts: Date.now(), previews });
    }

    case "sessions.patch": {
      const key = typeof p.key === "string" ? p.key : sessionKeyFor("security-agent");
      const current = sessionSettings.get(key) || {};
      const next = { ...current };
      if (p.model !== undefined) next.model = p.model;
      if (p.thinkingLevel !== undefined) next.thinkingLevel = p.thinkingLevel;
      sessionSettings.set(key, next);
      return resOk(id, { ok: true, key, entry: { thinkingLevel: next.thinkingLevel }, resolved: { model: next.model || MODELS[0].id, modelProvider: "anthropic" } });
    }

    case "sessions.reset": {
      const key = typeof p.key === "string" ? p.key : sessionKeyFor("security-agent");
      clearHistory(key);
      fileContextCache.delete(key); // also clear context cache
      return resOk(id, { ok: true });
    }

    case "chat.send": {
      const sessionKey = typeof p.sessionKey === "string" ? p.sessionKey : sessionKeyFor("security-agent");
      const agentId = sessionKey.startsWith("agent:") ? sessionKey.split(":")[1] : "security-agent";
      const agent = agents.get(agentId) || agents.get("security-agent");
      const message = typeof p.message === "string" ? p.message.trim() : String(p.message || "").trim();
      const runId = typeof p.idempotencyKey === "string" && p.idempotencyKey ? p.idempotencyKey : randomId();
      if (!message) return resOk(id, { status: "no-op", runId });

      let aborted = false;
      activeRuns.set(runId, { runId, sessionKey, agentId, abort() { aborted = true; } });

      setImmediate(async () => {
        let seq = 0;
        const emitChat = (state, extra) => {
          sendEvent({ type: "event", event: "chat", seq: seq++, payload: { runId, sessionKey, state, ...extra } });
        };

        try {
          if (aborted) { emitChat("aborted", {}); return; }

          if (anthropic) {
            await callClaude(agent, sessionKey, message, sendEvent, runId);
          } else {
            // Static mode fallback
            const reply = staticReply(agent, message);
            const words = reply.split(" ");
            let partial = "";
            for (const word of words) {
              if (aborted) break;
              partial = partial ? `${partial} ${word}` : word;
              emitChat("delta", { message: { role: "assistant", content: partial } });
              await new Promise((r) => setTimeout(r, 40));
            }
            if (!aborted) {
              const history = getHistory(sessionKey);
              history.push({ role: "user", content: message });
              history.push({ role: "assistant", content: reply });
              emitChat("final", { stopReason: "end_turn", message: { role: "assistant", content: reply } });
              sendEvent({ type: "event", event: "presence", seq: seq++, payload: { sessions: { recent: [{ key: sessionKey, updatedAt: Date.now() }], byAgent: [{ agentId, recent: [{ key: sessionKey, updatedAt: Date.now() }] }] } } });
            } else {
              emitChat("aborted", {});
            }
          }
        } catch (error) {
          emitChat("error", { message: { role: "assistant", content: `Error: ${error.message}` } });
        } finally {
          activeRuns.delete(runId);
        }
      });

      return resOk(id, { status: "started", runId });
    }

    case "chat.abort": {
      const runId = typeof p.runId === "string" ? p.runId.trim() : "";
      const sessionKey = typeof p.sessionKey === "string" ? p.sessionKey.trim() : "";
      let aborted = 0;
      if (runId) {
        const handle = activeRuns.get(runId);
        if (handle) { handle.abort(); activeRuns.delete(runId); aborted += 1; }
      } else if (sessionKey) {
        for (const [rid, handle] of activeRuns.entries()) {
          if (handle.sessionKey !== sessionKey) continue;
          handle.abort(); activeRuns.delete(rid); aborted += 1;
        }
      }
      return resOk(id, { ok: true, aborted });
    }

    case "chat.history": {
      const sessionKey = typeof p.sessionKey === "string" ? p.sessionKey : sessionKeyFor("security-agent");
      return resOk(id, { sessionKey, messages: getHistory(sessionKey) });
    }

    case "agent.wait": {
      const runId = typeof p.runId === "string" ? p.runId : "";
      const timeoutMs = typeof p.timeoutMs === "number" ? p.timeoutMs : 30000;
      const start = Date.now();
      while (activeRuns.has(runId) && Date.now() - start < timeoutMs) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return resOk(id, { status: activeRuns.has(runId) ? "running" : "done" });
    }

    case "status": {
      loadAgentState();
      const recent = [...agents.keys()].flatMap((agentId) => {
        const key = sessionKeyFor(agentId);
        const history = getHistory(key);
        return history.length > 0 ? [{ key, updatedAt: Date.now() }] : [];
      });
      return resOk(id, {
        sessions: {
          recent,
          byAgent: [...agents.keys()].map((agentId) => ({
            agentId,
            recent: recent.filter((e) => e.key.includes(`:${agentId}:`)),
          })),
        },
      });
    }

    case "wake":
      return resOk(id, { ok: true });

    default:
      return resOk(id, {});
  }
}

// ─── Server bootstrap ──────────────────────────────────────────────────────────
function startAdapter() {
  loadAgentState();

  const httpServer = http.createServer((req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    if (req.url === "/agents" || req.url === "/api/agents") {
      loadAgentState();
      const payload = [...agents.values()].map((agent) => {
        const live = agentStateCache[agent.id];
        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: live?.status || "uninitialized",
          last_task: live?.last_task || null,
          tasks_completed: live?.performance?.tasks_completed || 0,
          quality_score: live?.performance?.quality_score || null,
          last_active: live?.last_active || null,
        };
      });
      res.writeHead(200, { "Content-Type": "application/json", ...cors });
      res.end(JSON.stringify({ agents: payload, total: payload.length }));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain", ...cors });
    res.end(`ZEUS Gateway — ${agents.size} agents — Claude ${anthropic ? "✅ active" : "⚠️ static mode"}\nREST: GET /agents\n`);
  });

  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", (ws) => {
    let connected = false;
    let globalSeq = 0;

    const send = (frame) => {
      if (ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify(frame));
    };

    const sendEventFn = (frame) => {
      if (frame.type === "event" && typeof frame.seq !== "number") frame.seq = globalSeq++;
      send(frame);
    };

    activeSendEventFns.add(sendEventFn);
    send({ type: "event", event: "connect.challenge", payload: { nonce: randomId() } });

    ws.on("message", async (raw) => {
      let frame;
      try { frame = JSON.parse(raw.toString("utf8")); } catch { return; }
      if (!frame || typeof frame !== "object" || frame.type !== "req") return;
      const { id, method, params } = frame;
      if (typeof id !== "string" || typeof method !== "string") return;

      if (method === "connect") {
        connected = true;
        send({
          type: "res", id, ok: true,
          payload: {
            type: "hello-ok",
            protocol: 3,
            adapterType: "zeus",
            features: {
              methods: ["agents.list","agents.create","agents.delete","agents.update","sessions.list","sessions.preview","sessions.patch","sessions.reset","chat.send","chat.abort","chat.history","agent.wait","status","config.get","config.set","config.patch","agents.files.get","agents.files.set","exec.approvals.get","exec.approvals.set","exec.approval.resolve","wake","skills.status","models.list","cron.list"],
              events: ["chat", "presence", "heartbeat"],
            },
            snapshot: {
              health: {
                agents: [...agents.values()].map((a) => ({ agentId: a.id, name: a.name, isDefault: a.id === "security-agent" })),
                defaultAgentId: "security-agent",
              },
              sessionDefaults: { mainKey: MAIN_KEY },
            },
            auth: { role: "operator", scopes: ["operator.admin"] },
            policy: { tickIntervalMs: 30000 },
          },
        });
        return;
      }

      if (!connected) { send(resErr(id, "not_connected", "Send connect first.")); return; }

      try {
        send(await handleMethod(method, params, id, sendEventFn));
      } catch (error) {
        send(resErr(id, "internal_error", error instanceof Error ? error.message : "Internal error"));
      }
    });

    ws.on("close", () => activeSendEventFns.delete(sendEventFn));
    ws.on("error", () => activeSendEventFns.delete(sendEventFn));
  });

  httpServer.listen(ADAPTER_PORT, "127.0.0.1", () => {
    console.log(`[zeus-gateway] Listening on ws://localhost:${ADAPTER_PORT}`);
    console.log(`[zeus-gateway] ${agents.size} ZEUS agents loaded`);
    console.log(`[zeus-gateway] Claude AI: ${anthropic ? `✅ active (${CLAUDE_MODEL})` : "⚠️  static mode — set ANTHROPIC_API_KEY"}`);
    console.log(`[zeus-gateway] MindShift context: ${MINDSHIFT}`);
  });
}

if (require.main === module) {
  startAdapter();
}

module.exports = { handleMethod, startAdapter };
