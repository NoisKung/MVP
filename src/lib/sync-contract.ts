import type {
  SyncEntityType,
  SyncOperation,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushChange,
  SyncPushRequest,
} from "./types";

export const SYNC_SCHEMA_VERSION = 1 as const;
export const DEFAULT_SYNC_PULL_LIMIT = 200;
export const MAX_SYNC_PULL_LIMIT = 500;

const SYNC_ENTITY_TYPE_SET: ReadonlySet<SyncEntityType> = new Set([
  "PROJECT",
  "TASK",
  "TASK_SUBTASK",
  "TASK_TEMPLATE",
  "SETTING",
]);

const SYNC_OPERATION_SET: ReadonlySet<SyncOperation> = new Set([
  "UPSERT",
  "DELETE",
]);

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asIsoDateString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return fallback;
  return parsedDate.toISOString();
}

function normalizePushChange(input: SyncPushChange): SyncPushChange {
  return {
    ...input,
    updated_at: asIsoDateString(input.updated_at, new Date(0).toISOString()),
    payload: input.operation === "DELETE" ? null : (input.payload ?? {}),
    sync_version:
      Number.isFinite(input.sync_version) && input.sync_version > 0
        ? Math.floor(input.sync_version)
        : 1,
  };
}

export function isSyncEntityType(value: unknown): value is SyncEntityType {
  return typeof value === "string" && SYNC_ENTITY_TYPE_SET.has(value as SyncEntityType);
}

export function isSyncOperation(value: unknown): value is SyncOperation {
  return typeof value === "string" && SYNC_OPERATION_SET.has(value as SyncOperation);
}

export function clampSyncPullLimit(
  value: number | undefined,
  fallback = DEFAULT_SYNC_PULL_LIMIT,
): number {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value as number);
  if (normalized <= 0) return fallback;
  if (normalized > MAX_SYNC_PULL_LIMIT) return MAX_SYNC_PULL_LIMIT;
  return normalized;
}

export function createSyncIdempotencyKey(
  deviceId: string,
  changeId: string,
): string {
  const normalizedDeviceId = deviceId.trim().toLowerCase();
  const normalizedChangeId = changeId.trim().toLowerCase();
  if (!normalizedDeviceId || !normalizedChangeId) {
    throw new Error("deviceId and changeId are required for idempotency key.");
  }
  return `${normalizedDeviceId}:${normalizedChangeId}`;
}

export function buildSyncPushRequest(input: {
  deviceId: string;
  baseCursor: string | null;
  changes: SyncPushChange[];
}): SyncPushRequest {
  const normalizedDeviceId = input.deviceId.trim();
  if (!normalizedDeviceId) {
    throw new Error("deviceId is required.");
  }

  const normalizedChanges = input.changes
    .map(normalizePushChange)
    .sort((left, right) => {
      const byTime = left.updated_at.localeCompare(right.updated_at);
      if (byTime !== 0) return byTime;
      return left.idempotency_key.localeCompare(right.idempotency_key);
    });

  return {
    schema_version: SYNC_SCHEMA_VERSION,
    device_id: normalizedDeviceId,
    base_cursor: input.baseCursor,
    changes: normalizedChanges,
  };
}

export function buildSyncPullRequest(input: {
  deviceId: string;
  cursor: string | null;
  limit?: number;
}): SyncPullRequest {
  const normalizedDeviceId = input.deviceId.trim();
  if (!normalizedDeviceId) {
    throw new Error("deviceId is required.");
  }

  return {
    schema_version: SYNC_SCHEMA_VERSION,
    device_id: normalizedDeviceId,
    cursor: input.cursor,
    limit: clampSyncPullLimit(input.limit),
  };
}

export function parseSyncPullResponse(payload: unknown): SyncPullResponse {
  if (!isPlainObject(payload)) {
    throw new Error("Invalid sync pull response.");
  }

  const serverCursor = asNullableString(payload.server_cursor);
  const serverTime = asNullableString(payload.server_time);
  if (!serverCursor || !serverTime) {
    throw new Error("Invalid sync pull response metadata.");
  }

  const rawChanges = Array.isArray(payload.changes) ? payload.changes : [];
  const normalizedChanges: SyncPushChange[] = [];

  for (const rawChange of rawChanges) {
    if (!isPlainObject(rawChange)) continue;
    if (!isSyncEntityType(rawChange.entity_type)) continue;
    if (!isSyncOperation(rawChange.operation)) continue;

    const entityId = asNullableString(rawChange.entity_id);
    const updatedByDevice = asNullableString(rawChange.updated_by_device);
    const idempotencyKey = asNullableString(rawChange.idempotency_key);
    if (!entityId || !updatedByDevice || !idempotencyKey) continue;

    normalizedChanges.push(
      normalizePushChange({
        entity_type: rawChange.entity_type,
        entity_id: entityId,
        operation: rawChange.operation,
        updated_at: asIsoDateString(rawChange.updated_at, new Date(0).toISOString()),
        updated_by_device: updatedByDevice,
        sync_version:
          Number.isFinite(rawChange.sync_version) &&
          Number(rawChange.sync_version) > 0
            ? Math.floor(Number(rawChange.sync_version))
            : 1,
        payload: isPlainObject(rawChange.payload)
          ? rawChange.payload
          : rawChange.payload === null
            ? null
            : {},
        idempotency_key: idempotencyKey,
      }),
    );
  }

  return {
    server_cursor: serverCursor,
    server_time: asIsoDateString(serverTime, new Date(0).toISOString()),
    changes: normalizedChanges,
    has_more: Boolean(payload.has_more),
  };
}
