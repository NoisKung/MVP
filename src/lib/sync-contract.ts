import type {
  SyncApiError,
  SyncApiErrorCode,
  SyncEntityType,
  SyncOperation,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushResponse,
  SyncRejectedChange,
  SyncPushChange,
  SyncPushRequest,
} from "./types";

export const SYNC_SCHEMA_VERSION = 1 as const;
export const DEFAULT_SYNC_PULL_LIMIT = 200;
export const MAX_SYNC_PULL_LIMIT = 500;
export const SYNC_ERROR_CODES = {
  IDEMPOTENCY_KEY_REQUIRES_IDS: "SYNC_IDEMPOTENCY_KEY_REQUIRES_IDS",
  DEVICE_ID_REQUIRED: "SYNC_DEVICE_ID_REQUIRED",
  PULL_RESPONSE_INVALID: "SYNC_PULL_RESPONSE_INVALID",
  PULL_RESPONSE_METADATA_INVALID: "SYNC_PULL_RESPONSE_METADATA_INVALID",
  PUSH_RESPONSE_INVALID: "SYNC_PUSH_RESPONSE_INVALID",
  PUSH_RESPONSE_METADATA_INVALID: "SYNC_PUSH_RESPONSE_METADATA_INVALID",
} as const;

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
const SYNC_REJECTION_REASON_SET: ReadonlySet<SyncRejectedChange["reason"]> =
  new Set([
    "INVALID_ENTITY",
    "INVALID_OPERATION",
    "SCHEMA_MISMATCH",
    "CONFLICT",
    "VALIDATION_ERROR",
  ]);
const SYNC_API_ERROR_CODE_SET: ReadonlySet<SyncApiErrorCode> = new Set([
  "SCHEMA_MISMATCH",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "INVALID_CURSOR",
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
  "UNAVAILABLE",
]);
const SYNC_ENTITY_PRIORITY: Record<SyncPushChange["entity_type"], number> = {
  PROJECT: 0,
  TASK: 1,
  TASK_SUBTASK: 2,
  TASK_TEMPLATE: 3,
  SETTING: 4,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
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
  return (
    typeof value === "string" &&
    SYNC_ENTITY_TYPE_SET.has(value as SyncEntityType)
  );
}

export function isSyncOperation(value: unknown): value is SyncOperation {
  return (
    typeof value === "string" && SYNC_OPERATION_SET.has(value as SyncOperation)
  );
}

export function isSyncRejectedReason(
  value: unknown,
): value is SyncRejectedChange["reason"] {
  return (
    typeof value === "string" &&
    SYNC_REJECTION_REASON_SET.has(value as SyncRejectedChange["reason"])
  );
}

export function isSyncApiErrorCode(value: unknown): value is SyncApiErrorCode {
  return (
    typeof value === "string" &&
    SYNC_API_ERROR_CODE_SET.has(value as SyncApiErrorCode)
  );
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
    throw new Error(SYNC_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRES_IDS);
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
    throw new Error(SYNC_ERROR_CODES.DEVICE_ID_REQUIRED);
  }

  const normalizedChanges = input.changes
    .map(normalizePushChange)
    .sort((left, right) => {
      const byTime = left.updated_at.localeCompare(right.updated_at);
      if (byTime !== 0) return byTime;
      const byEntityPriority =
        SYNC_ENTITY_PRIORITY[left.entity_type] -
        SYNC_ENTITY_PRIORITY[right.entity_type];
      if (byEntityPriority !== 0) return byEntityPriority;
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
    throw new Error(SYNC_ERROR_CODES.DEVICE_ID_REQUIRED);
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
    throw new Error(SYNC_ERROR_CODES.PULL_RESPONSE_INVALID);
  }

  const serverCursor = asNullableString(payload.server_cursor);
  const serverTime = asNullableString(payload.server_time);
  if (!serverCursor || !serverTime) {
    throw new Error(SYNC_ERROR_CODES.PULL_RESPONSE_METADATA_INVALID);
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
        updated_at: asIsoDateString(
          rawChange.updated_at,
          new Date(0).toISOString(),
        ),
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

export function parseSyncPushResponse(payload: unknown): SyncPushResponse {
  if (!isPlainObject(payload)) {
    throw new Error(SYNC_ERROR_CODES.PUSH_RESPONSE_INVALID);
  }

  const serverCursor = asNullableString(payload.server_cursor);
  const serverTime = asNullableString(payload.server_time);
  if (!serverCursor || !serverTime) {
    throw new Error(SYNC_ERROR_CODES.PUSH_RESPONSE_METADATA_INVALID);
  }

  const accepted = Array.isArray(payload.accepted)
    ? payload.accepted
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];

  const rejectedEntries = Array.isArray(payload.rejected)
    ? payload.rejected
    : [];
  const rejected: SyncRejectedChange[] = [];

  for (const entry of rejectedEntries) {
    if (!isPlainObject(entry)) continue;
    const idempotencyKey = asNullableString(entry.idempotency_key);
    const reason = entry.reason;
    if (!idempotencyKey || !isSyncRejectedReason(reason)) continue;
    rejected.push({
      idempotency_key: idempotencyKey,
      reason,
      message: asNullableString(entry.message) ?? "Rejected by sync server.",
    });
  }

  return {
    accepted,
    rejected,
    server_cursor: serverCursor,
    server_time: asIsoDateString(serverTime, new Date(0).toISOString()),
  };
}

export function parseSyncApiError(payload: unknown): SyncApiError {
  if (!isPlainObject(payload)) {
    return {
      code: "INTERNAL_ERROR",
      message: "Unknown sync error.",
      retry_after_ms: null,
      details: null,
    };
  }

  const code = isSyncApiErrorCode(payload.code)
    ? payload.code
    : "INTERNAL_ERROR";
  const message = asNullableString(payload.message) ?? "Unknown sync error.";
  const retryAfterRaw = Number(payload.retry_after_ms);
  const retryAfterMs =
    Number.isFinite(retryAfterRaw) && retryAfterRaw >= 0
      ? Math.floor(retryAfterRaw)
      : null;

  return {
    code,
    message,
    retry_after_ms: retryAfterMs,
    details: isPlainObject(payload.details) ? payload.details : null,
  };
}
