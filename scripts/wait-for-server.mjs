import process from "node:process";

const [url, timeoutValue = "30000"] = process.argv.slice(2);
const timeoutMs = Number(timeoutValue);

if (!url || !Number.isFinite(timeoutMs) || timeoutMs < 1000) {
  console.error("Usage: node scripts/wait-for-server.mjs <url> [timeout-ms]");
  process.exit(2);
}

const deadline = Date.now() + timeoutMs;
let lastError = "aucune réponse";

while (Date.now() < deadline) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(2000),
    });
    if (response.status >= 200 && response.status < 500) {
      process.exit(0);
    }
    lastError = `HTTP ${response.status}`;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
  await new Promise((resolve) => setTimeout(resolve, 350));
}

console.error(`Claw3D n'a pas répondu avant le délai (${lastError}).`);
process.exit(1);
