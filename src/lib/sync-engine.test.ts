import {
  acknowledgePushResult,
  advanceCursor,
  applyPullBatch,
  preparePushBatch,
} from "@/lib/sync-engine";
import type {
  SyncOutboxRecord,
  SyncPullResponse,
  SyncPushResponse,
} from "@/lib/types";

function createOutboxRecord(
  partial: Partial<SyncOutboxRecord> & Pick<SyncOutboxRecord, "id">,
): SyncOutboxRecord {
  return {
    id: partial.id,
    entity_type: partial.entity_type ?? "TASK",
    entity_id: partial.entity_id ?? "entity-1",
    operation: partial.operation ?? "UPSERT",
    payload_json: partial.payload_json ?? "{}",
    idempotency_key: partial.idempotency_key ?? `ikey-${partial.id}`,
    attempts: partial.attempts ?? 0,
    last_error: partial.last_error ?? null,
    created_at: partial.created_at ?? "2026-02-17T00:00:00.000Z",
    updated_at: partial.updated_at ?? "2026-02-17T00:00:00.000Z",
  };
}

describe("sync-engine", () => {
  it("prepares push batch and skips invalid rows", () => {
    const outbox = [
      createOutboxRecord({
        id: "2",
        entity_type: "TASK",
        entity_id: "task-2",
        operation: "UPSERT",
        payload_json: JSON.stringify({
          title: "Task 2",
          updated_at: "2026-02-17T10:00:00.000Z",
          updated_by_device: "remote-a",
          sync_version: 3,
        }),
        idempotency_key: "k-2",
        updated_at: "2026-02-17T09:59:00.000Z",
      }),
      createOutboxRecord({
        id: "1",
        entity_type: "PROJECT",
        entity_id: "project-1",
        operation: "DELETE",
        payload_json: null,
        idempotency_key: "k-1",
        updated_at: "2026-02-17T09:00:00.000Z",
      }),
      createOutboxRecord({
        id: "3",
        entity_id: "",
      }),
      createOutboxRecord({
        id: "4",
        payload_json: "{bad json",
      }),
    ];

    const prepared = preparePushBatch({
      deviceId: "device-local",
      baseCursor: "cursor-1",
      outboxChanges: outbox,
    });

    expect(prepared.request.base_cursor).toBe("cursor-1");
    expect(prepared.request.changes).toHaveLength(2);
    expect(prepared.entries.map((entry) => entry.outbox_id)).toEqual([
      "1",
      "2",
    ]);
    expect(prepared.request.changes[0].entity_type).toBe("PROJECT");
    expect(prepared.request.changes[1].updated_by_device).toBe("remote-a");
    expect(prepared.request.changes[1].sync_version).toBe(3);
    expect(prepared.skipped).toEqual([
      { outbox_id: "3", reason: "MISSING_ENTITY_ID" },
      { outbox_id: "4", reason: "INVALID_PAYLOAD_JSON" },
    ]);
  });

  it("orders equal timestamps by entity dependency priority", () => {
    const prepared = preparePushBatch({
      deviceId: "device-local",
      baseCursor: null,
      outboxChanges: [
        createOutboxRecord({
          id: "1",
          entity_type: "TASK_SUBTASK",
          entity_id: "subtask-1",
          payload_json: JSON.stringify({
            task_id: "task-1",
            title: "Subtask 1",
            updated_at: "2026-02-17T10:00:00.000Z",
            updated_by_device: "device-local",
            sync_version: 1,
          }),
          updated_at: "2026-02-17T10:00:00.000Z",
          idempotency_key: "subtask",
        }),
        createOutboxRecord({
          id: "2",
          entity_type: "PROJECT",
          entity_id: "project-1",
          payload_json: JSON.stringify({
            name: "Project 1",
            updated_at: "2026-02-17T10:00:00.000Z",
            updated_by_device: "device-local",
            sync_version: 1,
          }),
          updated_at: "2026-02-17T10:00:00.000Z",
          idempotency_key: "project",
        }),
        createOutboxRecord({
          id: "3",
          entity_type: "TASK",
          entity_id: "task-1",
          payload_json: JSON.stringify({
            title: "Task 1",
            updated_at: "2026-02-17T10:00:00.000Z",
            updated_by_device: "device-local",
            sync_version: 1,
          }),
          updated_at: "2026-02-17T10:00:00.000Z",
          idempotency_key: "task",
        }),
      ],
    });

    expect(
      prepared.request.changes.map((change) => change.entity_type),
    ).toEqual(["PROJECT", "TASK", "TASK_SUBTASK"]);
  });

  it("acknowledges push response by removing accepted and marking rejected", async () => {
    const entries = [
      { outbox_id: "o-1", idempotency_key: "k-1" },
      { outbox_id: "o-2", idempotency_key: "k-2" },
      { outbox_id: "o-3", idempotency_key: "k-3" },
    ];
    const response: SyncPushResponse = {
      accepted: ["k-1"],
      rejected: [
        {
          idempotency_key: "k-2",
          reason: "CONFLICT",
          message: "Version mismatch",
        },
      ],
      server_cursor: "cursor-2",
      server_time: "2026-02-17T01:00:00.000Z",
    };

    const removedCalls: string[][] = [];
    const markedFailures: Array<{ id: string; error: string }> = [];

    const summary = await acknowledgePushResult({
      entries,
      response,
      removeOutboxChanges: async (ids) => {
        removedCalls.push(ids);
      },
      markOutboxChangeFailed: async (id, error) => {
        markedFailures.push({ id, error });
      },
    });

    expect(removedCalls).toEqual([["o-1"]]);
    expect(markedFailures).toEqual([
      { id: "o-2", error: "[CONFLICT] Version mismatch" },
    ]);
    expect(summary.removed_outbox_ids).toEqual(["o-1"]);
    expect(summary.failed_outbox_ids).toEqual(["o-2"]);
    expect(summary.pending_outbox_ids).toEqual(["o-3"]);
  });

  it("applies pull batch deterministically and skips self changes", async () => {
    const applyOrder: string[] = [];

    const response: SyncPullResponse = {
      server_cursor: "cursor-10",
      server_time: "2026-02-17T02:00:00.000Z",
      has_more: false,
      changes: [
        {
          entity_type: "TASK",
          entity_id: "t-2",
          operation: "UPSERT",
          updated_at: "2026-02-17T10:00:00.000Z",
          updated_by_device: "device-a",
          sync_version: 2,
          payload: {},
          idempotency_key: "k-2",
        },
        {
          entity_type: "TASK",
          entity_id: "t-1",
          operation: "UPSERT",
          updated_at: "2026-02-17T09:00:00.000Z",
          updated_by_device: "device-local",
          sync_version: 2,
          payload: {},
          idempotency_key: "k-1",
        },
        {
          entity_type: "TASK",
          entity_id: "t-3",
          operation: "UPSERT",
          updated_at: "2026-02-17T11:00:00.000Z",
          updated_by_device: "device-a",
          sync_version: 2,
          payload: {},
          idempotency_key: "k-3",
        },
      ],
    };

    const summary = await applyPullBatch({
      response,
      localDeviceId: "device-local",
      applyChange: async (change) => {
        applyOrder.push(change.idempotency_key);
        if (change.idempotency_key === "k-3") return "conflict";
        return "applied";
      },
    });

    expect(applyOrder).toEqual(["k-2", "k-3"]);
    expect(summary.applied).toBe(1);
    expect(summary.conflicts).toBe(1);
    expect(summary.skipped_self).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it("captures apply failures in pull batch", async () => {
    const response: SyncPullResponse = {
      server_cursor: "cursor-11",
      server_time: "2026-02-17T03:00:00.000Z",
      has_more: true,
      changes: [
        {
          entity_type: "TASK",
          entity_id: "t-1",
          operation: "UPSERT",
          updated_at: "2026-02-17T08:00:00.000Z",
          updated_by_device: "device-x",
          sync_version: 1,
          payload: {},
          idempotency_key: "k-1",
        },
      ],
    };

    const summary = await applyPullBatch({
      response,
      localDeviceId: "device-local",
      applyChange: async () => {
        throw new Error("apply failed");
      },
    });

    expect(summary.failed).toBe(1);
    expect(summary.failures).toEqual([
      { idempotency_key: "k-1", error: "apply failed" },
    ]);
  });

  it("advances cursor using normalized server time", async () => {
    const calls: Array<{
      cursor: string | null;
      syncedAt: string | undefined;
    }> = [];
    const result = await advanceCursor({
      serverCursor: " cursor-20 ",
      serverTime: "2026-02-17T04:00:00.123Z",
      setCheckpoint: async (cursor, syncedAt) => {
        calls.push({ cursor, syncedAt });
      },
    });

    expect(result).toEqual({
      cursor: "cursor-20",
      synced_at: "2026-02-17T04:00:00.123Z",
    });
    expect(calls).toEqual([
      { cursor: "cursor-20", syncedAt: "2026-02-17T04:00:00.123Z" },
    ]);
  });

  it("rejects advanceCursor when cursor is empty", async () => {
    await expect(
      advanceCursor({
        serverCursor: " ",
        serverTime: "2026-02-17T04:00:00.000Z",
        setCheckpoint: async () => undefined,
      }),
    ).rejects.toThrow(/serverCursor/i);
  });
});
