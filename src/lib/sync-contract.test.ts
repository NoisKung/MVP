import {
  buildSyncPullRequest,
  buildSyncPushRequest,
  clampSyncPullLimit,
  createSyncIdempotencyKey,
  isSyncApiErrorCode,
  isSyncEntityType,
  isSyncOperation,
  isSyncRejectedReason,
  parseSyncApiError,
  parseSyncPullResponse,
  parseSyncPushResponse,
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

    expect(isSyncRejectedReason("CONFLICT")).toBe(true);
    expect(isSyncRejectedReason("NOPE")).toBe(false);
    expect(isSyncApiErrorCode("RATE_LIMITED")).toBe(true);
    expect(isSyncApiErrorCode("NOT_A_CODE")).toBe(false);
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
    expect(() => createSyncIdempotencyKey("", "x")).toThrow(/idempotency key/i);
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

  it("sorts push changes by entity priority when timestamps are equal", () => {
    const request = buildSyncPushRequest({
      deviceId: "device-a",
      baseCursor: null,
      changes: [
        {
          entity_type: "TASK_SUBTASK",
          entity_id: "subtask-1",
          operation: "UPSERT",
          updated_at: "2026-02-17T10:00:00.000Z",
          updated_by_device: "device-a",
          sync_version: 1,
          payload: {},
          idempotency_key: "c",
        },
        {
          entity_type: "PROJECT",
          entity_id: "project-1",
          operation: "UPSERT",
          updated_at: "2026-02-17T10:00:00.000Z",
          updated_by_device: "device-a",
          sync_version: 1,
          payload: {},
          idempotency_key: "a",
        },
        {
          entity_type: "TASK",
          entity_id: "task-1",
          operation: "UPSERT",
          updated_at: "2026-02-17T10:00:00.000Z",
          updated_by_device: "device-a",
          sync_version: 1,
          payload: {},
          idempotency_key: "b",
        },
      ],
    });

    expect(request.changes.map((change) => change.entity_type)).toEqual([
      "PROJECT",
      "TASK",
      "TASK_SUBTASK",
    ]);
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

  it("parses push response metadata and rejected list", () => {
    const response = parseSyncPushResponse({
      accepted: [" a ", "b", 42],
      rejected: [
        {
          idempotency_key: "k-1",
          reason: "CONFLICT",
          message: "Version mismatch",
        },
        {
          idempotency_key: "k-2",
          reason: "NOT_VALID",
          message: "ignored",
        },
      ],
      server_cursor: "cursor-3",
      server_time: "2026-02-17T00:00:00.000Z",
    });

    expect(response.accepted).toEqual(["a", "b"]);
    expect(response.rejected).toHaveLength(1);
    expect(response.rejected[0].reason).toBe("CONFLICT");
    expect(response.server_cursor).toBe("cursor-3");
  });

  it("normalizes API error payload", () => {
    const error = parseSyncApiError({
      code: "RATE_LIMITED",
      message: "Too many requests",
      retry_after_ms: 1234.8,
      details: { bucket: "sync" },
    });

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retry_after_ms).toBe(1234);
    expect(error.details).toEqual({ bucket: "sync" });
  });

  it("falls back for malformed API error payload", () => {
    const error = parseSyncApiError("bad");
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.retry_after_ms).toBeNull();
  });
});
