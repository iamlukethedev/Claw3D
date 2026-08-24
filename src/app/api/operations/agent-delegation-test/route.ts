import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = "/Users/escobarjr/EscobarOS/workspace";
const SMOKE_SCRIPT = `${WORKSPACE_ROOT}/scripts/openclaw-agent-delegation-smoke.mjs`;

function isValidAgentId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,80}$/.test(value);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const agentId = String(form.get("agentId") || "").trim();

  if (!isValidAgentId(agentId)) {
    return NextResponse.json({ error: "agentId invalido" }, { status: 400 });
  }

  try {
    const { stdout } = await execFileAsync("node", [SMOKE_SCRIPT, "--agent-id", agentId], {
      cwd: WORKSPACE_ROOT,
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
    });

    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json(JSON.parse(stdout));
    }
  } catch (error) {
    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "Falha ao testar agente",
      }, { status: 500 });
    }
  }

  return NextResponse.redirect(new URL("/operations#delegacao-real", request.url), 303);
}
