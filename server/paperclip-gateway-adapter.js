"use strict";

const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { WebSocketServer } = require("ws");

function loadDotenvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadRuntimeEnv() {
  const cwd = process.cwd();
  loadDotenvFile(path.join(cwd, ".env.local"));
  loadDotenvFile(path.join(cwd, ".env"));
}

loadRuntimeEnv();

const PAPERCLIP_API_URL = (process.env.PAPERCLIP_API_URL || "http://localhost:3011").replace(/\/$/, "");
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY || "";
const PAPERCLIP_COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || "";
const PAPERCLIP_DEFAULT_MODEL = process.env.PAPERCLIP_DEFAULT_MODEL || "paperclip/default";
const PAPERCLIP_AGENT_POLL_LIMIT = Number.parseInt(process.env.PAPERCLIP_AGENT_POLL_LIMIT || "12", 10);
const PAPERCLIP_AGENT_LABEL = process.env.PAPERCLIP_AGENT_LABEL || "Paperclip";
const ADAPTER_PORT = Number.parseInt(process.env.PAPERCLIP_ADAPTER_PORT || "18791", 10);

const MAIN_AGENT_ID = "paperclip";
const MAIN_KEY = "main";
const MAIN_SESSION_KEY = `agent:${MAIN_AGENT_ID}:${MAIN_KEY}`;

const activeSendEventFns = new Set();
const activeRuns = new Map();
const recentMessagesBySession = new Map();
const lastRunSnapshotBySession = new Map();
let globalSeq = 0;

function randomId() {
  return randomUUID().replace(/-/g, "");
}

function sanitizeErrorMessage(error) {
  if (!error) return "Unknown error";
  const message = typeof error === "string" ? error : error.message || String(error);
  if (!PAPERCLIP_API_KEY) return message;
  return message.split(PAPERCLIP_API_KEY).join("[REDACTED]");
}

function readJsonBody(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    res.on("error", reject);
    res.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function paperclipRequest(method, routePath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${PAPERCLIP_API_URL}${routePath}`);
    const transport = url.protocol === "https:" ? https : http;
    const headers = {
      Accept: "application/json",
    };
    let bodyString = "";
    if (body !== null) {
      bodyString = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(bodyString);
    }
    if (PAPERCLIP_API_KEY) {
      headers.Authorization = `Bearer ${PAPERCLIP_API_KEY}`;
    }

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port
          ? Number.parseInt(url.port, 10)
          : url.protocol === "https:"
            ? 443
            : 80,
        path: `${url.pathname}${url.search}`,
        method,
        headers,
      },
      async (res) => {
        try {
          const payload = await readJsonBody(res);
          if ((res.statusCode || 500) >= 400) {
            const message =
              typeof payload?.error?.message === "string"
                ? payload.error.message
                : `Paperclip API HTTP ${res.statusCode}`;
            reject(new Error(message));
            return;
          }
          resolve(payload);
        } catch (error) {
          reject(error);
        }
      }
    );
    req.on("error", reject);
    if (bodyString) {
      req.write(bodyString);
    }
    req.end();
  });
}

async function resolveCompanyContext() {
  if (PAPERCLIP_COMPANY_ID) {
    return PAPERCLIP_COMPANY_ID;
  }
  const payload = await paperclipRequest("GET", "/api/companies");
  const companies = Array.isArray(payload?.companies)
    ? payload.companies
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
  const first = companies.find((entry) => typeof entry?.id === "string");
  if (!first) throw new Error("No Paperclip company available.");
  return first.id;
}

function normalizeAgent(agent) {
  const id = typeof agent?.id === "string" ? agent.id : "";
  const name = typeof agent?.name === "string" && agent.name.trim() ? agent.name.trim() : id || "Agent";
  const role = typeof agent?.role === "string" ? agent.role.trim() : "Paperclip Agent";
  return { id, name, role };
}

async function fetchCompanyAgents(companyId) {
  const payload = await paperclipRequest("GET", `/api/companies/${encodeURIComponent(companyId)}/agents`);
  const items = Array.isArray(payload?.agents)
    ? payload.agents
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
  return items.map(normalizeAgent).filter((entry) => entry.id);
}

async function listHeartbeatRuns(companyId) {
  const payload = await paperclipRequest(
    "GET",
    `/api/companies/${encodeURIComponent(companyId)}/heartbeats?limit=${encodeURIComponent(String(PAPERCLIP_AGENT_POLL_LIMIT))}`
  );
  const items = Array.isArray(payload?.runs)
    ? payload.runs
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
  return items;
}

async function getRunById(companyId, runId) {
  return await paperclipRequest(
    "GET",
    `/api/companies/${encodeURIComponent(companyId)}/heartbeats/${encodeURIComponent(runId)}`
  );
}

function summarizeRunText(run) {
  const summary =
    typeof run?.summary === "string"
      ? run.summary
      : typeof run?.output === "string"
        ? run.output
        : typeof run?.message === "string"
          ? run.message
          : "";
  return summary.trim();
}

function ensureSessionHistory(sessionKey) {
  if (!recentMessagesBySession.has(sessionKey)) {
    recentMessagesBySession.set(sessionKey, []);
  }
  return recentMessagesBySession.get(sessionKey);
}

function pushSessionMessage(sessionKey, message) {
  const history = ensureSessionHistory(sessionKey);
  history.push(message);
  if (history.length > 120) {
    history.splice(0, history.length - 120);
  }
}

function resOk(id, payload) {
  return { type: "res", id, ok: true, payload: payload ?? {} };
}

function resErr(id, code, message) {
  return { type: "res", id, ok: false, error: { code, message } };
}

function broadcastEvent(frame) {
  for (const send of activeSendEventFns) {
    try {
      send(frame);
    } catch {}
  }
}

function buildStatusSnapshot(agentIds) {
  const now = Date.now();
  const recent = [];
  const byAgent = [];
  for (const agentId of agentIds) {
    const sessionKey = `agent:${agentId}:${MAIN_KEY}`;
    const snapshot = lastRunSnapshotBySession.get(sessionKey);
    if (!snapshot) {
      byAgent.push({ agentId, recent: [] });
      continue;
    }
    const item = { key: sessionKey, updatedAt: snapshot.updatedAtMs || now };
    recent.push(item);
    byAgent.push({ agentId, recent: [item] });
  }
  return {
    sessions: {
      recent,
      byAgent,
    },
  };
}

async function handleMethod(method, params, id, sendEvent, context) {
  const p = params || {};
  const companyId = context.companyId;

  switch (method) {
    case "agents.list": {
      const agents = await fetchCompanyAgents(companyId);
      const defaultAgent = agents[0] || { id: MAIN_AGENT_ID, name: PAPERCLIP_AGENT_LABEL, role: "Paperclip" };
      return resOk(id, {
        defaultId: defaultAgent.id,
        mainKey: MAIN_KEY,
        agents: agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          workspace: `/paperclip/${agent.id}`,
          identity: { name: agent.name, emoji: "📎" },
          role: agent.role || "Paperclip Agent",
        })),
      });
    }

    case "agents.create":
    case "agents.update":
    case "agents.delete":
      return resErr(id, "not_implemented", `${method} is not implemented for Paperclip adapter.`);

    case "sessions.list": {
      const agents = await fetchCompanyAgents(companyId);
      const sessions = agents.map((agent) => {
        const key = `agent:${agent.id}:${MAIN_KEY}`;
        const snapshot = lastRunSnapshotBySession.get(key);
        return {
          key,
          agentId: agent.id,
          updatedAt: snapshot?.updatedAtMs ?? null,
          displayName: "Main",
          origin: { label: agent.name, provider: "paperclip" },
          model: snapshot?.model ?? PAPERCLIP_DEFAULT_MODEL,
          modelProvider: "paperclip",
        };
      });
      return resOk(id, { sessions });
    }

    case "sessions.preview": {
      const keys = Array.isArray(p.keys) ? p.keys : [];
      const limit = typeof p.limit === "number" ? p.limit : 8;
      const maxChars = typeof p.maxChars === "number" ? p.maxChars : 240;
      const previews = keys.map((key) => {
        const history = ensureSessionHistory(key);
        if (history.length === 0) return { key, status: "empty", items: [] };
        const items = history.slice(-limit).map((entry) => ({
          role: entry.role === "assistant" ? "assistant" : "user",
          text: String(entry.content || "").slice(0, maxChars),
          timestamp: entry.timestamp || Date.now(),
        }));
        return { key, status: "ok", items };
      });
      return resOk(id, { ts: Date.now(), previews });
    }

    case "sessions.patch": {
      const key = typeof p.key === "string" ? p.key : MAIN_SESSION_KEY;
      const snapshot = lastRunSnapshotBySession.get(key) || {};
      if (p.model !== undefined) {
        snapshot.model = p.model || PAPERCLIP_DEFAULT_MODEL;
      }
      if (p.thinkingLevel !== undefined) {
        snapshot.thinkingLevel = p.thinkingLevel || null;
      }
      snapshot.updatedAtMs = Date.now();
      lastRunSnapshotBySession.set(key, snapshot);
      return resOk(id, {
        ok: true,
        key,
        entry: { thinkingLevel: snapshot.thinkingLevel ?? null },
        resolved: { model: snapshot.model || PAPERCLIP_DEFAULT_MODEL, modelProvider: "paperclip" },
      });
    }

    case "sessions.reset": {
      const key = typeof p.key === "string" ? p.key : MAIN_SESSION_KEY;
      recentMessagesBySession.set(key, []);
      return resOk(id, { ok: true });
    }

    case "chat.send": {
      const sessionKey = typeof p.sessionKey === "string" ? p.sessionKey : MAIN_SESSION_KEY;
      const parts = sessionKey.split(":");
      const agentId = parts.length >= 2 ? parts[1] : MAIN_AGENT_ID;
      const runId = typeof p.idempotencyKey === "string" && p.idempotencyKey ? p.idempotencyKey : randomId();
      const message = typeof p.message === "string" ? p.message.trim() : String(p.message || "").trim();
      if (!message) return resOk(id, { status: "no-op", runId });

      pushSessionMessage(sessionKey, { role: "user", content: message, timestamp: Date.now() });

      let aborted = false;
      activeRuns.set(runId, {
        runId,
        sessionKey,
        abort() {
          aborted = true;
        },
      });

      setImmediate(async () => {
        let seq = 0;
        const emitChat = (state, extra) => {
          sendEvent({
            type: "event",
            event: "chat",
            seq: seq++,
            payload: {
              runId,
              sessionKey,
              state,
              ...extra,
            },
          });
        };

        emitChat("delta", { message: { role: "assistant", content: "Working with Paperclip..." } });

        try {
          const created = await paperclipRequest(
            "POST",
            `/api/companies/${encodeURIComponent(companyId)}/heartbeats`,
            { agentId, message }
          );
          const createdRunId =
            typeof created?.run?.id === "string"
              ? created.run.id
              : typeof created?.id === "string"
                ? created.id
                : null;
          const runPayload = createdRunId
            ? await getRunById(companyId, createdRunId)
            : { run: { summary: `Paperclip accepted: ${message}` } };
          const run = runPayload?.run || runPayload;
          const output = summarizeRunText(run) || "Paperclip run finished.";
          if (aborted) {
            emitChat("aborted", {});
            return;
          }

          pushSessionMessage(sessionKey, { role: "assistant", content: output, timestamp: Date.now() });
          lastRunSnapshotBySession.set(sessionKey, {
            model: PAPERCLIP_DEFAULT_MODEL,
            thinkingLevel: null,
            updatedAtMs: Date.now(),
            runId: createdRunId || runId,
          });

          emitChat("final", {
            stopReason: "end_turn",
            message: { role: "assistant", content: output },
          });

          sendEvent({
            type: "event",
            event: "presence",
            seq: seq++,
            payload: {
              sessions: {
                recent: [{ key: sessionKey, updatedAt: Date.now() }],
                byAgent: [{ agentId, recent: [{ key: sessionKey, updatedAt: Date.now() }] }],
              },
            },
          });
        } catch (error) {
          if (aborted) {
            emitChat("aborted", {});
            return;
          }
          emitChat("error", {
            errorMessage: sanitizeErrorMessage(error),
          });
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
        if (handle) {
          handle.abort();
          activeRuns.delete(runId);
          aborted += 1;
        }
      } else if (sessionKey) {
        for (const [activeRunId, handle] of activeRuns.entries()) {
          if (handle.sessionKey !== sessionKey) continue;
          handle.abort();
          activeRuns.delete(activeRunId);
          aborted += 1;
        }
      }
      return resOk(id, { ok: true, aborted });
    }

    case "chat.history": {
      const sessionKey = typeof p.sessionKey === "string" ? p.sessionKey : MAIN_SESSION_KEY;
      const messages = ensureSessionHistory(sessionKey).map((entry) => ({
        role: entry.role,
        content: entry.content,
      }));
      return resOk(id, { sessionKey, messages });
    }

    case "agent.wait": {
      const runId = typeof p.runId === "string" ? p.runId : "";
      const timeoutMs = typeof p.timeoutMs === "number" ? p.timeoutMs : 30000;
      const start = Date.now();
      while (activeRuns.has(runId) && Date.now() - start < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      return resOk(id, { status: activeRuns.has(runId) ? "running" : "done" });
    }

    case "status": {
      const agents = await fetchCompanyAgents(companyId);
      return resOk(id, buildStatusSnapshot(agents.map((agent) => agent.id)));
    }

    case "models.list":
      return resOk(id, {
        models: [{ id: PAPERCLIP_DEFAULT_MODEL, name: PAPERCLIP_DEFAULT_MODEL, provider: "paperclip" }],
      });

    case "skills.status":
      return resOk(id, { skills: [] });

    case "config.get":
      return resOk(id, {
        config: { gateway: { reload: { mode: "hot" } } },
        hash: "paperclip-adapter",
        exists: true,
        path: "/paperclip/config.json",
      });

    case "config.set":
    case "config.patch":
      return resOk(id, { hash: "paperclip-adapter" });

    case "exec.approvals.get":
      return resOk(id, {
        path: "",
        exists: true,
        hash: "paperclip-approvals",
        file: { version: 1, defaults: { security: "full", ask: "off", autoAllowSkills: true }, agents: {} },
      });

    case "exec.approvals.set":
    case "exec.approval.resolve":
      return resOk(id, { ok: true });

    case "cron.list":
      return resOk(id, { jobs: [] });

    case "cron.add":
    case "cron.patch":
    case "cron.remove":
    case "cron.run":
    case "tasks.list":
      return resErr(id, "not_implemented", `${method} is not implemented for Paperclip adapter.`);

    case "wake": {
      const runs = await listHeartbeatRuns(companyId);
      const latest = runs[0] || null;
      return resOk(id, {
        ok: true,
        latestRunId: typeof latest?.id === "string" ? latest.id : null,
      });
    }

    default:
      return resOk(id, {});
  }
}

async function startAdapter() {
  const companyId = await resolveCompanyContext();
  const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Claw3D Paperclip Gateway Adapter\n");
  });

  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", (ws) => {
    let connected = false;
    const send = (frame) => {
      if (ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify(frame));
    };

    const sendEventFn = (frame) => {
      if (frame.type === "event" && typeof frame.seq !== "number") {
        frame.seq = globalSeq++;
      }
      send(frame);
    };

    activeSendEventFns.add(sendEventFn);
    send({ type: "event", event: "connect.challenge", payload: { nonce: randomId() } });

    ws.on("message", async (raw) => {
      let frame;
      try {
        frame = JSON.parse(raw.toString("utf8"));
      } catch {
        return;
      }
      if (!frame || typeof frame !== "object" || frame.type !== "req") return;
      const { id, method, params } = frame;
      if (typeof id !== "string" || typeof method !== "string") return;

      try {
        if (method === "connect") {
          const agents = await fetchCompanyAgents(companyId);
          const defaultAgent = agents[0] || { id: MAIN_AGENT_ID, name: PAPERCLIP_AGENT_LABEL };
          connected = true;
          send({
            type: "res",
            id,
            ok: true,
            payload: {
              type: "hello-ok",
              protocol: 3,
              adapterType: "paperclip",
              features: {
                methods: [
                  "agents.list",
                  "sessions.list",
                  "sessions.preview",
                  "sessions.patch",
                  "sessions.reset",
                  "chat.send",
                  "chat.abort",
                  "chat.history",
                  "agent.wait",
                  "status",
                  "models.list",
                  "config.get",
                  "config.set",
                  "config.patch",
                  "skills.status",
                  "exec.approvals.get",
                  "exec.approvals.set",
                  "exec.approval.resolve",
                  "wake",
                  "cron.list",
                ],
                events: ["chat", "presence", "heartbeat"],
              },
              snapshot: {
                health: {
                  agents: agents.map((agent) => ({
                    agentId: agent.id,
                    name: agent.name,
                    isDefault: agent.id === defaultAgent.id,
                  })),
                  defaultAgentId: defaultAgent.id,
                },
                sessionDefaults: { mainKey: MAIN_KEY },
              },
              auth: { role: "operator", scopes: ["operator.admin"] },
              policy: { tickIntervalMs: 30000 },
            },
          });
          return;
        }

        if (!connected) {
          send(resErr(id, "not_connected", "Send connect first."));
          return;
        }

        const response = await handleMethod(
          method,
          params,
          id,
          sendEventFn,
          { companyId }
        );
        send(response);
      } catch (error) {
        if (method === "connect") {
          connected = false;
        }
        send(
          resErr(
            id,
            "internal_error",
            sanitizeErrorMessage(error)
          )
        );
      }
    });

    ws.on("close", () => activeSendEventFns.delete(sendEventFn));
    ws.on("error", () => activeSendEventFns.delete(sendEventFn));
  });

  httpServer.listen(ADAPTER_PORT, "127.0.0.1", () => {
    console.log(`[paperclip-adapter] Listening on ws://localhost:${ADAPTER_PORT}`);
    console.log(`[paperclip-adapter] Forwarding to ${PAPERCLIP_API_URL}`);
    console.log(`[paperclip-adapter] Company: ${companyId}`);
  });
}

if (require.main === module) {
  startAdapter().catch((error) => {
    console.error("[paperclip-adapter] Failed to start:", sanitizeErrorMessage(error));
    process.exit(1);
  });
}

module.exports = {
  handleMethod,
  startAdapter,
};
