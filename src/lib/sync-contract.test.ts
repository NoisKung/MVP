import {
  buildSyncPullRequest,
  buildSyncPushRequest,
  clampSyncPullLimit,
  createSyncIdempotencyKey,
  isSyncEntityType,
  isSyncOperation,
  parseSyncPullResponse,
} from "@/lib/sync-contract";
import type { SyncPushChange } from "@/lib/types";

describe("sync-contract", () => {
  it("validates entity types and operations", () => {
    expect(isSyncEntityType("TASK")).toBe(true);
    expect(isSyncEntityType("task")).toBe(false);
    expect(isSyncEntityType("NOPE")).toBe(false);

    expect(isSyncOperation("UPSERT")).toBe(true);
    expect(isSyncOperation("DELETE")).toBe(true);
    expect(isSyncOperation("PATCH")).toBe(false);
  });

  it("clamps pull limit into allowed range", () => {
    expect(clampSyncPullLimit(undefined)).toBe(200);
    expect(clampSyncPullLimit(-1)).toBe(200);
    expect(clampSyncPullLimit(0)).toBe(200);
    expect(clampSyncPullLimit(50)).toBe(50);
    expect(clampSyncPullLimit(999)).toBe(500);
  });

  it("creates deterministic idempotency keys", () => {
    expect(createSyncIdempotencyKey(" Device-A ", " Change-1 ")).toBe(
      "device-a:change-1",
    );
    expect(() => createSyncIdempotencyKey("", "x")).toThrow(
      /idempotency key/i,
    );
  });

  it("builds normalized push requests", () => {
    const changes: SyncPushChange[] = [
      {
        entity_type: "TASK",
        entity_id: "task-1",
        operation: "UPSERT",
        updated_at: "2026-02-15T10:00:00.000Z",
        updated_by_device: "device-a",
        sync_version: 2,
        payload: { title: "Task A" },
        idempotency_key: "b",
      },
      {
        entity_type: "PROJECT",
        entity_id: "project-1",
        operation: "DELETE",
        updated_at: "invalid-date",
        updated_by_device: "device-a",
        sync_version: -10,
        payload: { willBeRemoved: true },
        idempotency_key: "a",
      },
    ];

    const request = buildSyncPushRequest({
      deviceId: " device-a ",
      baseCursor: "cursor-1",
      changes,
    });

    expect(request.device_id).toBe("device-a");
    expect(request.changes).toHaveLength(2);
    expect(request.changes[0].idempotency_key).toBe("a");
    expect(request.changes[0].sync_version).toBe(1);
    expect(request.changes[0].payload).toBeNull();
    expect(request.changes[1].idempotency_key).toBe("b");
  });

  it("builds pull requests with defaults", () => {
    const pullRequest = buildSyncPullRequest({
      deviceId: " device-a ",
      cursor: null,
    });
    expect(pullRequest.device_id).toBe("device-a");
    expect(pullRequest.limit).toBe(200);
  });

  it("parses pull response and filters invalid changes", () => {
    const response = parseSyncPullResponse({
      server_cursor: "cursor-2",
      server_time: "2026-02-15T12:30:00.000Z",
      has_more: 1,
      changes: [
        {
          entity_type: "TASK",
          entity_id: "task-1",
          operation: "UPSERT",
          updated_at: "2026-02-15T12:00:00.000Z",
          updated_by_device: "device-a",
          sync_version: 3,
          payload: { title: "Task A" },
          idempotency_key: "task-1-3",
        },
        {
          entity_type: "INVALID",
          entity_id: "x",
          operation: "UPSERT",
          updated_at: "2026-02-15T12:00:00.000Z",
          updated_by_device: "device-a",
          sync_version: 1,
          payload: {},
          idempotency_key: "invalid",
        },
      ],
    });

    expect(response.server_cursor).toBe("cursor-2");
    expect(response.has_more).toBe(true);
    expect(response.changes).toHaveLength(1);
    expect(response.changes[0].entity_type).toBe("TASK");
  });

  it("rejects malformed response metadata", () => {
    expect(() =>
      parseSyncPullResponse({
        server_cursor: "",
        server_time: "",
      }),
    ).toThrow(/metadata/i);
  });
});
