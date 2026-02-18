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

function createPullTaskChange(input: {
  entityId: string;
  updatedAt: string;
  idempotencyKey: string;
}): SyncPushChange {
  return {
    entity_type: "TASK",
    entity_id: input.entityId,
    operation: "UPSERT",
    updated_at: input.updatedAt,
    updated_by_device: "device-remote",
    sync_version: 2,
    payload: { title: input.entityId },
    idempotency_key: input.idempotencyKey,
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

  it("supports idempotent outbox retry across consecutive sync cycles", async () => {
    let checkpointCursor: string | null = "cursor-before";
    let outbox = [createOutboxRecord("1", { idempotency_key: "retry-1" })];
    let pushCallCount = 0;
    const markedFailures: Array<{ id: string; error: string }> = [];

    const transport = {
      push: async () => {
        pushCallCount += 1;
        if (pushCallCount === 1) {
          return {
            accepted: [],
            rejected: [
              {
                idempotency_key: "retry-1",
                reason: "CONFLICT",
                message: "transient mismatch",
              },
            ],
            server_cursor: "cursor-after-first-push",
            server_time: "2026-02-17T02:00:00.000Z",
          };
        }

        return {
          accepted: ["retry-1"],
          rejected: [],
          server_cursor: "cursor-after-second-push",
          server_time: "2026-02-17T02:01:00.000Z",
        };
      },
      pull: async () => ({
        server_cursor: "cursor-after-pull",
        server_time: "2026-02-17T03:00:00.000Z",
        has_more: false,
        changes: [],
      }),
    };

    const storage = {
      getDeviceId: async () => "device-local",
      getCheckpoint: async () => createCheckpoint(checkpointCursor),
      setCheckpoint: async (cursor: string | null) => {
        checkpointCursor = cursor;
      },
      listOutboxChanges: async () => outbox,
      removeOutboxChanges: async (ids: string[]) => {
        outbox = outbox.filter((record) => !ids.includes(record.id));
      },
      markOutboxChangeFailed: async (id: string, error: string) => {
        markedFailures.push({ id, error });
      },
      applyIncomingChange: async () => "applied" as const,
    };

    const firstSummary = await runSyncCycle({
      transport,
      storage,
    });

    expect(firstSummary.failed_outbox_changes).toBe(1);
    expect(firstSummary.removed_outbox_changes).toBe(0);
    expect(outbox).toHaveLength(1);
    expect(markedFailures).toEqual([
      { id: "1", error: "[CONFLICT] transient mismatch" },
    ]);

    const secondSummary = await runSyncCycle({
      transport,
      storage,
    });

    expect(secondSummary.failed_outbox_changes).toBe(0);
    expect(secondSummary.removed_outbox_changes).toBe(1);
    expect(outbox).toHaveLength(0);
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

  it("aggregates conflict replay outcomes across pull pages", async () => {
    let pullCallCount = 0;
    const applyOutcomes: Array<SyncPushChange["idempotency_key"]> = [];
    let replayCount = 0;

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
          if (pullCallCount === 1) {
            return {
              server_cursor: "cursor-replay-1",
              server_time: "2026-02-17T03:00:00.000Z",
              has_more: true,
              changes: [
                createPullTaskChange({
                  entityId: "task-replay",
                  updatedAt: "2026-02-17T03:00:00.000Z",
                  idempotencyKey: "remote-replay-1",
                }),
              ],
            };
          }
          if (pullCallCount === 2) {
            return {
              server_cursor: "cursor-replay-2",
              server_time: "2026-02-17T03:00:01.000Z",
              has_more: true,
              changes: [
                createPullTaskChange({
                  entityId: "task-replay",
                  updatedAt: "2026-02-17T03:00:00.000Z",
                  idempotencyKey: "remote-replay-1",
                }),
              ],
            };
          }
          return {
            server_cursor: "cursor-replay-3",
            server_time: "2026-02-17T03:00:02.000Z",
            has_more: false,
            changes: [
              createPullTaskChange({
                entityId: "task-replay",
                updatedAt: "2026-02-17T03:00:00.000Z",
                idempotencyKey: "remote-replay-1",
              }),
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
          applyOutcomes.push(change.idempotency_key);
          replayCount += 1;
          if (replayCount === 1) return "conflict";
          if (replayCount === 2) return "skipped";
          return "applied";
        },
      },
      options: {
        maxPullPages: 3,
      },
    });

    expect(pullCallCount).toBe(3);
    expect(applyOutcomes).toEqual([
      "remote-replay-1",
      "remote-replay-1",
      "remote-replay-1",
    ]);
    expect(summary.checkpoint_after).toBe("cursor-replay-3");
    expect(summary.pull).toMatchObject({
      applied: 1,
      skipped: 1,
      conflicts: 1,
      failed: 0,
      has_more: false,
    });
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
