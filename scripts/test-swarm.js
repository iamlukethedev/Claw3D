#!/usr/bin/env node
// Test swarm.run coordinator
// Usage: node scripts/test-swarm.js "задача" [agent1,agent2,...]

const WebSocket = require("ws");

const task = process.argv[2] || "Что самое важное сделать команде прямо сейчас?";
const agentArg = process.argv[3];
const agents = agentArg ? agentArg.split(",") : [];

const ws = new WebSocket("ws://localhost:18789");
const reqId = "swarm-test-" + Date.now();

console.log(`[swarm] task: "${task}"`);
if (agents.length) console.log(`[swarm] agents: ${agents.join(", ")}`);
console.log("");

let connected = false;
let done = false;

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "req", id: "connect-1", method: "connect", params: {} }));
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());

  // Connect handshake
  if (!connected) {
    if (msg.type === "event" && msg.event === "connect.challenge") return;
    if (msg.type === "res" && msg.id === "connect-1") {
      connected = true;
      ws.send(JSON.stringify({
        type: "req",
        id: reqId,
        method: "swarm.run",
        params: { task, agents, synthesize: true, idempotencyKey: reqId },
      }));
      return;
    }
    return;
  }

  if (msg.type === "res" && msg.id === reqId) {
    if (!msg.ok) { console.error("[swarm] error:", msg.error); process.exit(1); }
    console.log(`[swarm] started — agents: ${msg.payload.agents.join(", ")}\n`);
    return;
  }

  if (msg.type === "event" && msg.event === "swarm") {
    const p = msg.payload;
    if (p.state === "agent_started") {
      process.stdout.write(`\n[${p.agentName}] thinking...\n`);
    } else if (p.state === "agent_done") {
      process.stdout.write(`[${p.agentName}] ✅\n`);
    } else if (p.state === "synthesizing") {
      process.stdout.write(`\n[Synthesis] combining...\n`);
    } else if (p.state === "done") {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("SWARM RESULT");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(p.synthesis);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      done = true;
      ws.close();
      process.exit(0);
    }
  }
});

ws.on("close", () => { if (!done) process.exit(1); });
ws.on("error", (e) => { console.error("[swarm] ws error:", e.message); process.exit(1); });

setTimeout(() => {
  console.error("[swarm] timeout after 120s");
  process.exit(1);
}, 120_000);
