import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BulletinTaskSignal } from "@/features/office/bulletin/bulletinBoard";
import { useBulletinBoard } from "@/features/office/bulletin/useBulletinBoard";
import type { BulletinCard } from "@/features/office/bulletin/types";
import {
  defaultStudioSettings,
  sanitizeStudioSettings,
  type StudioSettingsPatch,
  type StudioSettingsPublic,
} from "@/lib/studio/settings";

const GATEWAY = "ws://localhost:18789";
const NO_TASKS: BulletinTaskSignal[] = [];

const storedCard: BulletinCard = {
  id: "stored-1",
  type: "goal",
  title: "Ship bulletin board",
  body: "",
  createdAt: "2026-10-29T10:00:00.000Z",
  updatedAt: "2026-10-29T10:00:00.000Z",
  authorType: "human",
  authorId: null,
  authorName: null,
  agentId: null,
  sessionKey: null,
  taskId: null,
  pinned: true,
  archived: false,
  archivedBy: null,
  priority: "normal",
  tags: [],
  sourceKey: null,
};

const makeCoordinator = (settings: StudioSettingsPublic | null | Error) => {
  const patches: StudioSettingsPatch[] = [];
  return {
    patches,
    coordinator: {
      loadSettings: vi.fn(async () => {
        if (settings instanceof Error) throw settings;
        return settings;
      }),
      schedulePatch: vi.fn((patch: StudioSettingsPatch) => {
        patches.push(patch);
      }),
    },
  };
};

const settingsWithCards = (cards: BulletinCard[]): StudioSettingsPublic =>
  sanitizeStudioSettings({
    ...defaultStudioSettings(),
    bulletinBoard: { [GATEWAY]: { cards, updatedAt: null } },
  });

describe("useBulletinBoard", () => {
  it("loads_cards_for_the_current_gateway_without_echoing_a_write", async () => {
    const { coordinator, patches } = makeCoordinator(settingsWithCards([storedCard]));
    const { result } = renderHook(() =>
      useBulletinBoard({ gatewayUrl: GATEWAY, settingsCoordinator: coordinator, tasks: NO_TASKS, standupMeeting: null }),
    );

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.cards).toEqual([storedCard]);
    expect(result.current.summary.pinned).toBe(1);
    expect(patches).toHaveLength(0);
  });

  it("persists_new_cards_under_the_gateway_key", async () => {
    const { coordinator, patches } = makeCoordinator(settingsWithCards([]));
    const { result } = renderHook(() =>
      useBulletinBoard({ gatewayUrl: GATEWAY, settingsCoordinator: coordinator, tasks: NO_TASKS, standupMeeting: null }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let outcome: ReturnType<typeof result.current.addCard> | null = null;
    act(() => {
      outcome = result.current.addCard({ type: "announcement", title: "Release at 5pm" });
    });

    expect(outcome).toEqual(expect.objectContaining({ ok: true }));
    expect(result.current.cards.map((card) => card.title)).toEqual(["Release at 5pm"]);
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]?.bulletinBoard?.[GATEWAY]?.cards?.[0]?.title).toBe("Release at 5pm");
  });

  it("mirrors_blocked_tasks_onto_the_board_and_persists_them", async () => {
    const { coordinator, patches } = makeCoordinator(settingsWithCards([]));
    const tasks: BulletinTaskSignal[] = [
      {
        id: "task-9",
        title: "Fix staging auth",
        description: "",
        status: "blocked",
        assignedAgentId: null,
        isArchived: false,
      },
    ];
    const { result } = renderHook(() =>
      useBulletinBoard({ gatewayUrl: GATEWAY, settingsCoordinator: coordinator, tasks, standupMeeting: null }),
    );

    await waitFor(() => expect(result.current.summary.blockers).toBe(1));
    expect(result.current.cards[0]).toEqual(
      expect.objectContaining({ authorType: "system", taskId: "task-9" }),
    );
    await waitFor(() => expect(patches).toHaveLength(1));
  });

  it("does_not_resolve_blockers_before_the_task_board_has_loaded", async () => {
    const systemBlocker: BulletinCard = {
      ...storedCard,
      id: "sys-1",
      type: "blocker",
      pinned: false,
      authorType: "system",
      taskId: "task-9",
      title: "Blocked: Fix staging auth",
      sourceKey: "task-blocked:task-9",
    };
    const { coordinator, patches } = makeCoordinator(settingsWithCards([systemBlocker]));
    const { result, rerender } = renderHook(
      ({ tasksReady }: { tasksReady: boolean }) =>
        useBulletinBoard({
          gatewayUrl: GATEWAY,
          settingsCoordinator: coordinator,
          tasks: NO_TASKS,
          tasksReady,
          standupMeeting: null,
        }),
      { initialProps: { tasksReady: false } },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.cards[0]?.archived).toBe(false);
    expect(patches).toHaveLength(0);

    rerender({ tasksReady: true });
    expect(result.current.cards[0]).toEqual(
      expect.objectContaining({ archived: true, archivedBy: "system" }),
    );
  });

  it("stays_read_only_when_loading_fails", async () => {
    const { coordinator, patches } = makeCoordinator(new Error("disk unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() =>
      useBulletinBoard({ gatewayUrl: GATEWAY, settingsCoordinator: coordinator, tasks: NO_TASKS, standupMeeting: null }),
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("disk unavailable");
    act(() => {
      expect(result.current.addCard({ type: "goal", title: "Lost?" }).ok).toBe(false);
    });
    expect(patches).toHaveLength(0);
  });

  it("is_unavailable_without_a_gateway", () => {
    const { coordinator } = makeCoordinator(settingsWithCards([storedCard]));
    const { result } = renderHook(() =>
      useBulletinBoard({ gatewayUrl: "  ", settingsCoordinator: coordinator, tasks: NO_TASKS, standupMeeting: null }),
    );
    expect(result.current.status).toBe("unavailable");
    expect(coordinator.loadSettings).not.toHaveBeenCalled();
  });
});
