import { runSyncCycle } from "@/lib/sync-runner";
import type {
  SyncCheckpoint,
  SyncOutboxRecord,
  SyncPushChange,
} from "@/lib/types";

function createCheckpoint(cursor: string | null): SyncCheckpoint {
  return {
    id: 1,
    last_sync_cursor: cursor,
    last_synced_at: null,
    updated_at: "2026-02-17T00:00:00.000Z",
  };
}

function createOutboxRecord(
  id: string,
  overrides?: Partial<SyncOutboxRecord>,
): SyncOutboxRecord {
  return {
    id,
    entity_type: "TASK",
    entity_id: `task-${id}`,
    operation: "UPSERT",
    payload_json: JSON.stringify({
      title: `Task ${id}`,
      updated_at: "2026-02-17T01:00:00.000Z",
      updated_by_device: "device-local",
      sync_version: 1,
    }),
    idempotency_key: `k-${id}`,
    attempts: 0,
    last_error: null,
    created_at: "2026-02-17T01:00:00.000Z",
    updated_at: "2026-02-17T01:00:00.000Z",
    ...overrides,
  };
}

describe("sync-runner", () => {
  it("runs push + pull cycle and advances cursor", async () => {
    const setCheckpointCalls: Array<{
      cursor: string | null;
      syncedAt?: string;
    }> = [];
    const removedIds: string[][] = [];
    const applyCalls: SyncPushChange[] = [];

    const summary = await runSyncCycle({
      transport: {
        push: async () => ({
          accepted: ["k-1"],
          rejected: [],
          server_cursor: "cursor-after-push",
          server_time: "2026-02-17T02:00:00.000Z",
        }),
        pull: async () => ({
          server_cursor: "cursor-after-pull",
          server_time: "2026-02-17T03:00:00.000Z",
          has_more: false,
          changes: [
            {
              entity_type: "TASK",
              entity_id: "task-2",
              operation: "UPSERT",
              updated_at: "2026-02-17T03:00:00.000Z",
              updated_by_device: "device-remote",
              sync_version: 2,
              payload: { title: "Remote Task" },
              idempotency_key: "remote-1",
            },
          ],
        }),
      },
      storage: {
        getDeviceId: async () => "device-local",
        getCheckpoint: async () => createCheckpoint("cursor-before"),
        setCheckpoint: async (cursor, syncedAt) => {
          setCheckpointCalls.push({ cursor, syncedAt });
        },
        listOutboxChanges: async () => [createOutboxRecord("1")],
        removeOutboxChanges: async (ids) => {
          removedIds.push(ids);
        },
        markOutboxChangeFailed: async () => undefined,
        applyIncomingChange: async (change) => {
          applyCalls.push(change);
          return "applied";
        },
      },
    });

    expect(removedIds).toEqual([["1"]]);
    expect(applyCalls).toHaveLength(1);
    expect(setCheckpointCalls).toEqual([
      {
        cursor: "cursor-after-push",
        syncedAt: "2026-02-17T02:00:00.000Z",
      },
      {
        cursor: "cursor-after-pull",
        syncedAt: "2026-02-17T03:00:00.000Z",
      },
    ]);
    expect(summary.checkpoint_before).toBe("cursor-before");
    expect(summary.checkpoint_after).toBe("cursor-after-pull");
    expect(summary.pull?.applied).toBe(1);
  });

  it("can skip pull stage", async () => {
    let pullCalled = false;

    const summary = await runSyncCycle({
      transport: {
        push: async () => ({
          accepted: [],
          rejected: [],
          server_cursor: "cursor-push",
          server_time: "2026-02-17T02:00:00.000Z",
        }),
        pull: async () => {
          pullCalled = true;
          return {};
        },
      },
      storage: {
        getDeviceId: async () => "device-local",
        getCheckpoint: async () => createCheckpoint(null),
        setCheckpoint: async () => undefined,
        listOutboxChanges: async () => [],
        removeOutboxChanges: async () => undefined,
        markOutboxChangeFailed: async () => undefined,
        applyIncomingChange: async () => "applied",
      },
      options: {
        skipPull: true,
      },
    });

    expect(pullCalled).toBe(false);
    expect(summary.pull).toBeNull();
  });

  it("marks rejected outbox item as failed", async () => {
    const failedMarks: Array<{ id: string; error: string }> = [];

    const summary = await runSyncCycle({
      transport: {
        push: async () => ({
          accepted: [],
          rejected: [
            {
              idempotency_key: "k-1",
              reason: "CONFLICT",
              message: "already newer",
            },
          ],
          server_cursor: "cursor-after-push",
          server_time: "2026-02-17T02:00:00.000Z",
        }),
        pull: async () => ({
          server_cursor: "cursor-after-pull",
          server_time: "2026-02-17T03:00:00.000Z",
          has_more: false,
          changes: [],
        }),
      },
      storage: {
        getDeviceId: async () => "device-local",
        getCheckpoint: async () => createCheckpoint("cursor-before"),
        setCheckpoint: async () => undefined,
        listOutboxChanges: async () => [createOutboxRecord("1")],
        removeOutboxChanges: async () => undefined,
        markOutboxChangeFailed: async (id, error) => {
          failedMarks.push({ id, error });
        },
        applyIncomingChange: async () => "applied",
      },
    });

    expect(failedMarks).toEqual([
      { id: "1", error: "[CONFLICT] already newer" },
    ]);
    expect(summary.failed_outbox_changes).toBe(1);
  });

  it("pulls multiple pages while has_more is true", async () => {
    const applyCalls: SyncPushChange[] = [];
    const pullRequestCursors: Array<string | null> = [];
    let pullCallCount = 0;

    const summary = await runSyncCycle({
      transport: {
        push: async () => ({
          accepted: [],
          rejected: [],
          server_cursor: "cursor-after-push",
          server_time: "2026-02-17T02:00:00.000Z",
        }),
        pull: async (payload) => {
          const request = payload as { cursor: string | null };
          pullRequestCursors.push(request.cursor);
          pullCallCount += 1;
          if (pullCallCount === 1) {
            return {
              server_cursor: "cursor-page-1",
              server_time: "2026-02-17T03:00:00.000Z",
              has_more: true,
              changes: [
                {
                  entity_type: "TASK",
                  entity_id: "task-page-1",
                  operation: "UPSERT",
                  updated_at: "2026-02-17T03:00:00.000Z",
                  updated_by_device: "device-remote",
                  sync_version: 2,
                  payload: { title: "Page 1" },
                  idempotency_key: "remote-1",
                },
              ],
            };
          }

          return {
            server_cursor: "cursor-page-2",
            server_time: "2026-02-17T03:00:01.000Z",
            has_more: false,
            changes: [
              {
                entity_type: "TASK",
                entity_id: "task-page-2",
                operation: "UPSERT",
                updated_at: "2026-02-17T03:00:01.000Z",
                updated_by_device: "device-remote",
                sync_version: 3,
                payload: { title: "Page 2" },
                idempotency_key: "remote-2",
              },
            ],
          };
        },
      },
      storage: {
        getDeviceId: async () => "device-local",
        getCheckpoint: async () => createCheckpoint("cursor-before"),
        setCheckpoint: async () => undefined,
        listOutboxChanges: async () => [],
        removeOutboxChanges: async () => undefined,
        markOutboxChangeFailed: async () => undefined,
        applyIncomingChange: async (change) => {
          applyCalls.push(change);
          return "applied";
        },
      },
    });

    expect(pullRequestCursors).toEqual(["cursor-before", "cursor-page-1"]);
    expect(applyCalls).toHaveLength(2);
    expect(summary.checkpoint_after).toBe("cursor-page-2");
    expect(summary.pull?.applied).toBe(2);
    expect(summary.pull?.has_more).toBe(false);
  });

  it("stops pulling when maxPullPages is reached", async () => {
    let pullCallCount = 0;

    const summary = await runSyncCycle({
      transport: {
        push: async () => ({
          accepted: [],
          rejected: [],
          server_cursor: "cursor-after-push",
          server_time: "2026-02-17T02:00:00.000Z",
        }),
        pull: async () => {
          pullCallCount += 1;
          return {
            server_cursor: `cursor-page-${pullCallCount}`,
            server_time: "2026-02-17T03:00:00.000Z",
            has_more: true,
            changes: [],
          };
        },
      },
      storage: {
        getDeviceId: async () => "device-local",
        getCheckpoint: async () => createCheckpoint("cursor-before"),
        setCheckpoint: async () => undefined,
        listOutboxChanges: async () => [],
        removeOutboxChanges: async () => undefined,
        markOutboxChangeFailed: async () => undefined,
        applyIncomingChange: async () => "applied",
      },
      options: {
        maxPullPages: 1,
      },
    });

    expect(pullCallCount).toBe(1);
    expect(summary.checkpoint_after).toBe("cursor-page-1");
    expect(summary.pull?.has_more).toBe(true);
  });
});
