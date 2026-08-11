import type { VisualRuntimeAdapter, VisualSnapshot } from "@claw3d/visual-contract";
import { FIXTURE_TIME, READ_ONLY_CAPABILITIES } from "@claw3d/visual-contract/fixtures";

export const NULL_SNAPSHOT: VisualSnapshot = {
  schemaVersion: 1,
  snapshotId: "null-snapshot-v1",
  generatedAt: FIXTURE_TIME,
  actors: [],
  tasks: [],
  notifications: [],
  system: { health: "offline", label: "Visual connector disabled", observedAt: FIXTURE_TIME },
  capabilities: { ...READ_ONLY_CAPABILITIES, actors: false, tasks: false, notifications: false },
  history: [],
};

export function createNullAdapter(): VisualRuntimeAdapter {
  return {
    id: "null",
    query: {
      async getSnapshot() {
        return NULL_SNAPSHOT;
      },
    },
    events: {
      subscribe(_options, _onEvent, onConnectionChange) {
        onConnectionChange?.({ phase: "offline", attempt: 0, label: "Connector disabled" });
        return () => undefined;
      },
    },
  };
}
