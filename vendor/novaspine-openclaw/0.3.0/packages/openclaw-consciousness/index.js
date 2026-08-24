import { createHash } from "node:crypto";

const DEFAULT_BASE_URL = "http://127.0.0.1:4111";
const DEFAULT_GUIDANCE = [
  "Nova Consciousness Suite is wired in passively.",
  "It tracks continuity, goals, decisions, learning, and confidence in the background.",
  "Do not narrate internal artifacts unless they materially improve the answer or the user asks.",
  "If the user asks what is being tracked, what the current thread is, or why you resumed something, use the Nova Consciousness tools.",
].join("\n");
const BENCHMARK_CASE_PATTERN = /__(?:LME|LOCOMO)_CASE_\d+__/i;
const BENCHMARK_QA_HINT_PATTERN = /reply with only the shortest direct answer|use any available memory tools if needed/i;
const CONTINUITY_QUERY_PATTERN = /\b(open loop|next action|rollout thread|continuity|follow-?up|thread)\b/i;

const promptCooldowns = new Map();
const recentToolUsageByScope = new Map();

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringValue(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function booleanValue(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function integerValue(value, fallback, min, max) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function resolveConfig(api) {
  const pluginConfig = asObject(api.pluginConfig);
  return {
    baseUrl: stringValue(pluginConfig.baseUrl, DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiToken: stringValue(pluginConfig.apiToken),
    requestTimeoutMs: integerValue(pluginConfig.requestTimeoutMs, 5000, 250, 30000),
    passiveCapture: booleanValue(pluginConfig.passiveCapture, true),
    injectContinuity: booleanValue(pluginConfig.injectContinuity, true),
    injectDashboard: booleanValue(pluginConfig.injectDashboard, false),
    guidance: booleanValue(pluginConfig.guidance, true),
    maxRecentMessages: integerValue(pluginConfig.maxRecentMessages, 6, 1, 12),
    maxRecentMessageChars: integerValue(pluginConfig.maxRecentMessageChars, 280, 80, 800),
    maxConversationContextChars: integerValue(pluginConfig.maxConversationContextChars, 2800, 0, 5000),
    maxMessageChars: integerValue(pluginConfig.maxMessageChars, 4800, 256, 5000),
    maxInjectedOpenLoops: integerValue(pluginConfig.maxInjectedOpenLoops, 3, 0, 6),
    maxInjectedNextActions: integerValue(pluginConfig.maxInjectedNextActions, 3, 0, 6),
    maxInjectedFacts: integerValue(pluginConfig.maxInjectedFacts, 3, 0, 6),
    benchmarkSafe: booleanValue(pluginConfig.benchmarkSafe, false),
  };
}

function formatTool(details) {
  return {
    content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
    details,
  };
}

async function jsonRequest(config, route, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const headers = {};
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (config.apiToken) headers.Authorization = `Bearer ${config.apiToken}`;
    const response = await fetch(`${config.baseUrl}${route}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const raw = await response.text();
    let data = {};
    if (raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { raw };
      }
    }
    if (!response.ok) {
      const detail = typeof data.error === "string"
        ? data.error
        : typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data);
      throw new Error(`HTTP ${response.status}: ${detail}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function deriveScopeKey(ctx = {}) {
  if (ctx.channelId && (ctx.conversationId || ctx.accountId)) {
    return `conversation:${ctx.channelId}:${ctx.conversationId || ctx.accountId}`;
  }
  if (ctx.workspaceDir && ctx.agentId) {
    return `workspace:${ctx.agentId}:${ctx.workspaceDir}`;
  }
  if (ctx.workspaceDir) {
    return `workspace:${ctx.workspaceDir}`;
  }
  if (ctx.sessionKey) {
    return `session:${ctx.sessionKey}`;
  }
  if (ctx.sessionId) {
    return `session-id:${ctx.sessionId}`;
  }
  return "";
}

function shouldSkipPassiveCapture(event, ctx) {
  const prompt = stringValue(event?.prompt);
  if (!prompt || prompt.length < 3) return true;
  if (prompt.startsWith("/")) return true;
  if (["heartbeat", "cron", "memory"].includes(stringValue(ctx?.trigger).toLowerCase())) return true;
  return false;
}

function promptDigest(prompt) {
  return createHash("sha256").update(prompt).digest("hex");
}

function shouldProcessPrompt(scopeKey, sessionKey, prompt) {
  const digest = promptDigest(prompt);
  const now = Date.now();
  const dedupeKey = `${sessionKey || scopeKey || "global"}:${digest}`;
  const lastSeenAt = promptCooldowns.get(dedupeKey) ?? 0;
  if (lastSeenAt && now - lastSeenAt < 15_000) {
    return false;
  }
  promptCooldowns.set(dedupeKey, now);
  prunePromptCooldowns(now);
  return true;
}

function prunePromptCooldowns(now = Date.now()) {
  for (const [key, timestamp] of promptCooldowns) {
    if (now - timestamp > 5 * 60_000) {
      promptCooldowns.delete(key);
    }
  }
}

function recordToolUsage(scopeKey, toolName) {
  if (!scopeKey || !toolName) return;
  const current = recentToolUsageByScope.get(scopeKey) ?? [];
  current.push({ toolName, at: Date.now() });
  recentToolUsageByScope.set(scopeKey, current.slice(-12));
  pruneRecentToolUsage();
}

function consumeToolUsage(scopeKey, limit = 8) {
  if (!scopeKey) return [];
  const items = recentToolUsageByScope.get(scopeKey) ?? [];
  recentToolUsageByScope.delete(scopeKey);
  return [...new Set(items.map((item) => item.toolName).filter(Boolean))].slice(-limit);
}

function pruneRecentToolUsage(now = Date.now()) {
  for (const [scopeKey, items] of recentToolUsageByScope) {
    const fresh = items.filter((item) => now - item.at < 6 * 60 * 60_000);
    if (fresh.length === 0) {
      recentToolUsageByScope.delete(scopeKey);
      continue;
    }
    if (fresh.length !== items.length) {
      recentToolUsageByScope.set(scopeKey, fresh);
    }
  }
}

function extractRecentMessages(messages, currentPrompt, limit, maxLength) {
  if (!Array.isArray(messages)) return [];
  const normalizedCurrent = normalizeComparableText(currentPrompt);
  const extracted = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const text = extractMessageText(message);
    if (!text) continue;
    if (!extracted.length && normalizeComparableText(text) === normalizedCurrent) {
      continue;
    }
    const role = extractMessageRole(message);
    extracted.push(`${role}: ${truncateText(text, maxLength)}`);
    if (extracted.length >= limit) break;
  }
  return extracted.reverse();
}

function extractMessageRole(message) {
  if (!message || typeof message !== "object") return "unknown";
  return stringValue(message.role, stringValue(message.type, "message")).toLowerCase();
}

function extractMessageText(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => extractMessageText(item))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (!value || typeof value !== "object") {
    return "";
  }

  if (typeof value.text === "string" && value.text.trim()) {
    return value.text.trim();
  }
  if (typeof value.content === "string" && value.content.trim()) {
    return value.content.trim();
  }
  if (Array.isArray(value.content)) {
    return extractMessageText(value.content);
  }
  if (Array.isArray(value.parts)) {
    return extractMessageText(value.parts);
  }
  if (Array.isArray(value.items)) {
    return extractMessageText(value.items);
  }
  if (Array.isArray(value.messages)) {
    return extractMessageText(value.messages);
  }
  if (typeof value.summary === "string" && value.summary.trim()) {
    return value.summary.trim();
  }
  if (typeof value.raw === "string" && value.raw.trim()) {
    return value.raw.trim();
  }
  return "";
}

function truncateText(value, maxLength) {
  const text = stringValue(value);
  if (!text) return "";
  if (!Number.isFinite(maxLength) || maxLength < 1) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeComparableText(value) {
  return stringValue(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function buildConversationContext(recentMessages) {
  if (!recentMessages.length) return "";
  return recentMessages.join("\n");
}

function buildInteractionPayload(config, ctx, prompt, recentMessages, scopeKey) {
  const message = truncateText(prompt, config.maxMessageChars);
  const conversationContext = truncateText(
    buildConversationContext(recentMessages),
    config.maxConversationContextChars
  );

  return {
    message,
    conversationContext,
    recentMessages,
    actor: "user",
    source: stringValue(ctx?.channelId, "openclaw"),
    sessionId: stringValue(ctx?.sessionId) || undefined,
    threadKey: scopeKey || undefined,
    remember: shouldRememberPrompt(prompt),
    toolsUsed: consumeToolUsage(scopeKey),
    tags: buildTags(ctx),
    metadata: {
      sessionKey: stringValue(ctx?.sessionKey),
      workspaceDir: stringValue(ctx?.workspaceDir),
      conversationId: stringValue(ctx?.conversationId),
      agentId: stringValue(ctx?.agentId),
      trigger: stringValue(ctx?.trigger),
    },
  };
}

function shouldRememberPrompt(prompt) {
  return /\b(remember|don't forget|important|keep in mind|note this|save this)\b/i.test(prompt);
}

function isBenchmarkEvalPrompt(prompt) {
  const text = stringValue(prompt);
  return BENCHMARK_CASE_PATTERN.test(text) || BENCHMARK_QA_HINT_PATTERN.test(text);
}

function buildTags(ctx) {
  const tags = [];
  if (ctx.channelId) tags.push(`channel:${ctx.channelId}`);
  if (ctx.agentId) tags.push(`agent:${ctx.agentId}`);
  if (ctx.trigger) tags.push(`trigger:${ctx.trigger}`);
  return tags;
}

function buildContinuityContext(resume, config) {
  const thread = asObject(resume?.thread);
  const snapshot = asObject(resume?.snapshot);
  const lines = ["Consciousness continuity context:"];
  if (thread.title) lines.push(`- Thread: ${thread.title}`);
  if (thread.objective) lines.push(`- Objective: ${thread.objective}`);

  const openLoops = Array.isArray(snapshot.openLoops)
    ? snapshot.openLoops.filter(Boolean).slice(0, config.maxInjectedOpenLoops)
    : [];
  if (openLoops.length) {
    lines.push(`- Open loops: ${openLoops.join(" | ")}`);
  }

  const nextActions = Array.isArray(snapshot.nextActions)
    ? snapshot.nextActions.filter(Boolean).slice(0, config.maxInjectedNextActions)
    : [];
  if (nextActions.length) {
    lines.push(`- Next actions: ${nextActions.join(" | ")}`);
  }

  const pinnedFacts = Array.isArray(snapshot.pinnedFacts)
    ? snapshot.pinnedFacts.filter(Boolean).slice(0, config.maxInjectedFacts)
    : [];
  if (pinnedFacts.length) {
    lines.push(`- Pinned facts: ${pinnedFacts.join(" | ")}`);
  }

  if (stringValue(resume?.restartHint)) {
    lines.push(`- Restart hint: ${resume.restartHint}`);
  }

  return lines.length > 1 ? lines.join("\n") : "";
}

function buildDashboardContext(dashboard) {
  const goals = Array.isArray(dashboard?.goals?.goals) ? dashboard.goals.goals : [];
  const topGoals = goals
    .slice(0, 3)
    .map((goal) => stringValue(goal?.title))
    .filter(Boolean);
  if (!topGoals.length) return "";
  return [
    "Current consciousness goals:",
    ...topGoals.map((goal) => `- ${goal}`),
  ].join("\n");
}

function registerCommands(api, readConfig) {
  api.registerCommand({
    name: "novaconsciousness",
    description: "Nova Consciousness Suite status and dashboard commands.",
    acceptsArgs: true,
    handler: async (ctx) => {
      const args = stringValue(ctx.args).trim();
      const command = args.split(/\s+/)[0] || "status";
      const config = readConfig();
      try {
        if (command === "dashboard") {
          const payload = await jsonRequest(config, "/api/dashboard");
          const dashboard = asObject(payload.dashboard);
          const interactionCount = Array.isArray(dashboard.interactions) ? dashboard.interactions.length : 0;
          const goalCount = Array.isArray(dashboard.goals?.goals) ? dashboard.goals.goals.length : 0;
          return {
            text: [
              "Nova Consciousness Suite dashboard",
              `Interactions tracked: ${interactionCount}`,
              `Goals tracked: ${goalCount}`,
              `Active threads: ${dashboard.moduleStatus?.context?.activeThreads ?? "unknown"}`,
            ].join("\n"),
          };
        }
        const [health, modules] = await Promise.all([
          jsonRequest(config, "/health"),
          jsonRequest(config, "/api/modules/status"),
        ]);
        return {
          text: [
            `Nova Consciousness Suite: ok (${config.baseUrl})`,
            `Threads tracked: ${health.status?.interactionsTracked ?? "unknown"}`,
            `Context threads: ${modules.status?.context?.threadsTracked ?? "unknown"}`,
            `Memory bridge ready: ${modules.status?.memory?.ok === false ? "no" : "yes"}`,
          ].join("\n"),
        };
      } catch (error) {
        return {
          text: `Nova Consciousness Suite unavailable at ${config.baseUrl}: ${error.message}`,
        };
      }
    },
  });
}

const plugin = {
  id: "nova-consciousness",
  name: "Nova Consciousness",
  description: "Passive continuity, learning, goal, decision, and confidence wiring for OpenClaw via the Nova Consciousness Suite.",
  register(api) {
    const readConfig = () => resolveConfig(api);
    registerCommands(api, readConfig);

    api.registerTool({
      name: "nova_consciousness_status",
      label: "Nova Consciousness Status",
      description: "Check Nova Consciousness Suite health and module readiness.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      execute: async () => {
        const config = readConfig();
        try {
          const [health, modules] = await Promise.all([
            jsonRequest(config, "/health"),
            jsonRequest(config, "/api/modules/status"),
          ]);
          return formatTool({
            ok: true,
            base_url: config.baseUrl,
            health,
            modules: modules.status,
          });
        } catch (error) {
          return formatTool({
            ok: false,
            base_url: config.baseUrl,
            error: error.message,
          });
        }
      },
    });

    api.registerTool({
      name: "nova_consciousness_dashboard",
      label: "Nova Consciousness Dashboard",
      description: "Inspect the current consciousness dashboard: threads, goals, decisions, reflections, and module status.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      execute: async () => {
        const config = readConfig();
        try {
          const payload = await jsonRequest(config, "/api/dashboard");
          return formatTool({
            ok: true,
            dashboard: payload.dashboard,
          });
        } catch (error) {
          return formatTool({
            ok: false,
            error: error.message,
          });
        }
      },
    });

    api.registerTool({
      name: "nova_consciousness_resume",
      label: "Nova Consciousness Resume",
      description: "Get the compact continuity/resume pack for a thread key.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          thread_key: {
            type: "string",
            description: "Stable thread key, usually conversation/channel/workspace scoped.",
          },
        },
        required: ["thread_key"],
      },
      execute: async (_id, params) => {
        const config = readConfig();
        try {
          const threadKey = encodeURIComponent(String(params.thread_key || "").trim());
          const payload = await jsonRequest(config, `/api/threads/${threadKey}/resume`);
          return formatTool({
            ok: true,
            resume: payload,
          });
        } catch (error) {
          return formatTool({
            ok: false,
            error: error.message,
          });
        }
      },
    });

    api.registerTool({
      name: "nova_consciousness_interaction",
      label: "Nova Consciousness Interaction",
      description: "Fetch a recorded interaction by id from the consciousness suite.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          interaction_id: {
            type: "string",
            description: "Interaction identifier from a prior dashboard or process result.",
          },
        },
        required: ["interaction_id"],
      },
      execute: async (_id, params) => {
        const config = readConfig();
        try {
          const interactionId = encodeURIComponent(String(params.interaction_id || "").trim());
          const payload = await jsonRequest(config, `/api/interactions/${interactionId}`);
          return formatTool({
            ok: true,
            interaction: payload.interaction,
          });
        } catch (error) {
          return formatTool({
            ok: false,
            error: error.message,
          });
        }
      },
    });

    api.on("before_prompt_build", async (event, ctx) => {
      const config = readConfig();
      const result = {};
      if (config.guidance) {
        result.appendSystemContext = DEFAULT_GUIDANCE;
      }

      const scopeKey = deriveScopeKey(ctx);
      const prompt = stringValue(event?.prompt);
      const benchmarkSafeMode = config.benchmarkSafe && isBenchmarkEvalPrompt(prompt) && !CONTINUITY_QUERY_PATTERN.test(prompt);
      if (benchmarkSafeMode) {
        return undefined;
      }
      if ((!config.passiveCapture && !config.injectContinuity) || shouldSkipPassiveCapture(event, ctx)) {
        return Object.keys(result).length ? result : undefined;
      }

      const recentMessages = extractRecentMessages(
        event?.messages,
        prompt,
        config.maxRecentMessages,
        config.maxRecentMessageChars
      );
      let processed = null;
      if (config.passiveCapture && shouldProcessPrompt(scopeKey, stringValue(ctx?.sessionKey), prompt)) {
        try {
          processed = await jsonRequest(config, "/api/process-interaction", {
            method: "POST",
            body: buildInteractionPayload(config, ctx, prompt, recentMessages, scopeKey),
          });
        } catch (error) {
          api.logger.warn?.(`[nova-consciousness] Passive processing skipped: ${error.message}`);
        }
      }

      if (!config.injectContinuity) {
        return Object.keys(result).length ? result : undefined;
      }

      let resumePayload = processed?.resume ? processed.resume : null;
      const isNewThread = Boolean(processed?.interaction?.isNewThread);
      if (!resumePayload && scopeKey) {
        try {
          resumePayload = await jsonRequest(config, `/api/threads/${encodeURIComponent(scopeKey)}/resume`);
        } catch {
          resumePayload = null;
        }
      }

      if (!resumePayload || isNewThread) {
        return Object.keys(result).length ? result : undefined;
      }

      const continuityContext = buildContinuityContext(resumePayload, config);
      const parts = [continuityContext];
      if (config.injectDashboard) {
        try {
          const dashboardPayload = await jsonRequest(config, "/api/dashboard");
          parts.push(buildDashboardContext(dashboardPayload.dashboard));
        } catch {
          // ignore dashboard failures for prompt injection
        }
      }

      const prependContext = parts.filter(Boolean).join("\n\n").trim();
      if (prependContext) {
        result.prependContext = prependContext;
      }

      return Object.keys(result).length ? result : undefined;
    });

    api.on("after_tool_call", async (event, ctx) => {
      const scopeKey = deriveScopeKey(ctx);
      const toolName = stringValue(event?.toolName);
      if (!scopeKey || !toolName) return;
      if (toolName.startsWith("nova_consciousness_")) return;
      recordToolUsage(scopeKey, toolName);
    });

    api.on("before_reset", async (_event, ctx) => {
      const scopeKey = deriveScopeKey(ctx);
      if (!scopeKey) return;
      pruneRecentToolUsage();
      prunePromptCooldowns();
    });
  },
};

export default plugin;
