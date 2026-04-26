import type { Page, Route, Request } from "@playwright/test";
import type { AgentAvatarProfile } from "@/lib/avatars/profile";

export type StudioSettingsFixture = {
  version: 1;
  gateway: { url: string; token: string } | null;
  focused: Record<string, { mode: "focused"; filter: string; selectedAgentId: string | null }>;
  avatars: Record<string, Record<string, AgentAvatarProfile>>;
  taskBoard?: Record<
    string,
    {
      cards: Array<Record<string, unknown>>;
      selectedCardId: string | null;
    }
  >;
};

const DEFAULT_SETTINGS: StudioSettingsFixture = {
  version: 1,
  gateway: null,
  focused: {},
  avatars: {},
  taskBoard: {},
};

const createStudioRoute = (initial: StudioSettingsFixture = DEFAULT_SETTINGS) => {
  let settings: StudioSettingsFixture = {
    version: 1,
    gateway: initial.gateway ?? null,
    focused: { ...(initial.focused ?? {}) },
    avatars: { ...(initial.avatars ?? {}) },
    taskBoard: { ...(initial.taskBoard ?? {}) },
  };

  return async (route: Route, request: Request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ settings }),
      });
      return;
    }
    if (request.method() !== "PUT") {
      await route.fallback();
      return;
    }

    const patch = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
    const next = { ...settings };

    if ("gateway" in patch) {
      next.gateway = (patch.gateway as StudioSettingsFixture["gateway"]) ?? null;
    }

    if (patch.focused && typeof patch.focused === "object") {
      const focusedPatch = patch.focused as Record<string, Record<string, unknown>>;
      const focusedNext = { ...next.focused };
      for (const [key, value] of Object.entries(focusedPatch)) {
        const existing = focusedNext[key] ?? {
          mode: "focused" as const,
          filter: "all",
          selectedAgentId: null,
        };
        focusedNext[key] = {
          mode: (value.mode as "focused") ?? existing.mode,
          filter: (value.filter as string) ?? existing.filter,
          selectedAgentId:
            "selectedAgentId" in value
              ? ((value.selectedAgentId as string | null) ?? null)
              : existing.selectedAgentId,
        };
      }
      next.focused = focusedNext;
    }

    if (patch.avatars && typeof patch.avatars === "object") {
      const avatarsPatch = patch.avatars as
        | Record<string, Record<string, AgentAvatarProfile | null> | null>
        | null;
      const avatarsNext: StudioSettingsFixture["avatars"] = { ...next.avatars };
      for (const [gatewayKey, gatewayPatch] of Object.entries(avatarsPatch ?? {})) {
        if (gatewayPatch === null) {
          delete avatarsNext[gatewayKey];
          continue;
        }
        const existing = avatarsNext[gatewayKey] ? { ...avatarsNext[gatewayKey] } : {};
        for (const [agentId, avatarPatch] of Object.entries(gatewayPatch)) {
          if (avatarPatch === null) {
            delete existing[agentId];
            continue;
          }
          if (
            typeof avatarPatch !== "object" ||
            avatarPatch === null ||
            typeof avatarPatch.seed !== "string" ||
            avatarPatch.seed.trim().length === 0
          ) {
            delete existing[agentId];
            continue;
          }
          existing[agentId] = avatarPatch;
        }
        avatarsNext[gatewayKey] = existing;
      }
      next.avatars = avatarsNext;
    }

    if (patch.taskBoard && typeof patch.taskBoard === "object") {
      const taskBoardPatch = patch.taskBoard as Record<
        string,
        { cards?: Array<Record<string, unknown>>; selectedCardId?: string | null } | null
      >;
      const taskBoardNext = { ...(next.taskBoard ?? {}) };
      for (const [gatewayKey, gatewayValue] of Object.entries(taskBoardPatch)) {
        if (gatewayValue === null) {
          delete taskBoardNext[gatewayKey];
          continue;
        }
        const existing = taskBoardNext[gatewayKey] ?? {
          cards: [],
          selectedCardId: null,
        };
        taskBoardNext[gatewayKey] = {
          cards: Array.isArray(gatewayValue.cards) ? gatewayValue.cards : existing.cards,
          selectedCardId:
            "selectedCardId" in gatewayValue
              ? (gatewayValue.selectedCardId ?? null)
              : existing.selectedCardId,
        };
      }
      next.taskBoard = taskBoardNext;
    }

    settings = next;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ settings }),
    });
  };
};

export const stubStudioRoute = async (
  page: Page,
  initial: StudioSettingsFixture = DEFAULT_SETTINGS
) => {
  await page.route("**/api/studio", createStudioRoute(initial));
};
