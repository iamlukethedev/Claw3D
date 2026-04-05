#!/usr/bin/env node
/**
 * ZEUS Gateway WS Test Harness
 * Usage: node scripts/test-zeus-ws.js [agentId] [message]
 * Default: product-agent / "Say WORKING in one word"
 *
 * Protocol:
 *   1. Connect to ws://localhost:18789
 *   2. Send { type:"req", id:"r0", method:"connect", params:{} }
 *   3. Send { type:"req", id:"r1", method:"chat.send", params:{ sessionKey, message, idempotencyKey } }
 *   4. Listen for { type:"event", event:"chat", payload:{ state:"delta"|"final", message:{content} } }
 */

const WebSocket = require("ws");

const GATEWAY_URL = process.env.GATEWAY_URL || "ws://localhost:18789";
const agentId = process.argv[2] || "product-agent";
const message = process.argv[3] || "Say WORKING in one word. No other text.";
const timeout = parseInt(process.env.TIMEOUT_MS || "30000", 10);

const sessionKey = `agent:${agentId}:test-${Date.now()}`;
const idempotencyKey = `test-${Date.now()}`;

console.log(`[zeus-test] → ${GATEWAY_URL}`);
console.log(`[zeus-test] agent: ${agentId}`);
console.log(`[zeus-test] message: "${message.slice(0, 80)}"`);
console.log();

const ws = new WebSocket(GATEWAY_URL);
let done = false;
let lastContent = "";
let startTime = null;

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "req", id: "r0", method: "connect", params: {} }));
  setTimeout(() => {
    ws.send(
      JSON.stringify({
        type: "req",
        id: "r1",
        method: "chat.send",
        params: { sessionKey, message, idempotencyKey },
      })
    );
    startTime = Date.now();
  }, 300);
});

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data);
    if (msg.type === "event" && msg.event === "chat") {
      const { state, message: chatMsg } = msg.payload || {};
      if (state === "delta" && chatMsg?.content) {
        const newText = chatMsg.content.slice(lastContent.length);
        process.stdout.write(newText);
        lastContent = chatMsg.content;
      }
      if (state === "final") {
        const elapsed = Date.now() - startTime;
        console.log(`\n\n[zeus-test] ✅ done in ${elapsed}ms`);
        ws.close();
        done = true;
        process.exit(0);
      }
      if (state === "error") {
        console.log(`\n[zeus-test] ❌ error: ${msg.payload?.error}`);
        ws.close();
        done = true;
        process.exit(1);
      }
    }
    if (msg.type === "res" && msg.id === "r1" && !msg.ok) {
      console.log(`\n[zeus-test] ❌ chat.send failed: ${JSON.stringify(msg)}`);
      ws.close();
      process.exit(1);
    }
  } catch (e) {
    // ignore parse errors
  }
});

ws.on("error", (e) => {
  console.error(`[zeus-test] ❌ WS error: ${e.message}`);
  process.exit(1);
});

setTimeout(() => {
  if (!done) {
    console.log(`\n[zeus-test] ⏱ timeout after ${timeout}ms`);
    console.log(`[zeus-test] Partial response: "${lastContent.slice(0, 200)}"`);
    ws.close();
    process.exit(1);
  }
}, timeout);
