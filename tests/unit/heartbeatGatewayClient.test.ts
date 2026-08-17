import { describe, expect, it, vi } from "vitest";

import {
  listHeartbeatsForAgent,
  triggerHeartbeatNow,
} from "@/lib/gateway/agentConfig";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

describe("heartbeat gateway client", () => {
  it("returns_empty_list_when_agent_has_no_heartbeat", async () => {
    const client = {
      call: vi
        .fn()
        .mockResolvedValueOnce({ config: { agents: { list: [{ id: "agent-1" }] } } })
        .mockResolvedValueOnce({
          heartbeat: { agents: [{ agentId: "agent-1", enabled: false, every: "disabled" }] },
        }),
    } as unknown as GatewayClient;

    const result = await listHeartbeatsForAgent(client, "agent-1");

    expect(result.heartbeats).toEqual([]);
    expect(client.call).toHaveBeenCalledTimes(2);
    expect(client.call).toHaveBeenNthCalledWith(1, "config.get", {});
    expect(client.call).toHaveBeenNthCalledWith(2, "status", {});
  });

  it("returns_override_heartbeat_for_agent", async () => {
    const client = {
      call: vi
        .fn()
        .mockResolvedValueOnce({
          config: {
            agents: {
              defaults: { heartbeat: { every: "30m", target: "last", includeReasoning: false } },
              list: [
                {
                  id: "agent-1",
                  heartbeat: { every: "15m", target: "none", includeReasoning: true },
                },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          heartbeat: { agents: [{ agentId: "agent-1", enabled: true, every: "15m" }] },
        }),
    } as unknown as GatewayClient;

    const result = await listHeartbeatsForAgent(client, "agent-1");

    expect(result.heartbeats).toEqual([
      {
        id: "agent-1",
        agentId: "agent-1",
        source: "override",
        enabled: true,
        heartbeat: {
          every: "15m",
          target: "none",
          includeReasoning: true,
          ackMaxChars: 300,
          activeHours: null,
        },
      },
    ]);
  });

  it("triggers_wake_now_for_heartbeat", async () => {
    const client = {
      call: vi.fn(async () => ({ ok: true })),
    } as unknown as GatewayClient;

    await triggerHeartbeatNow(client, "agent-1");

    expect(client.call).toHaveBeenCalledWith("wake", {
      mode: "now",
      text: "Hermes3D heartbeat trigger (agent-1).",
    });
  });
});
