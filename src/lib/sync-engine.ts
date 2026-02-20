import {
  buildSyncPushRequest,
  createSyncIdempotencyKey,
} from "./sync-contract";
import type {
  SyncPullResponse,
  SyncPushChange,
  SyncPushRequest,
  SyncPushResponse,
  SyncOutboxRecord,
} from "./types";

export const SYNC_ENGINE_ERROR_CODES = {
  SERVER_CURSOR_REQUIRED: "SYNC_ENGINE_SERVER_CURSOR_REQUIRED",
} as const;

const SYNC_ENTITY_PRIORITY: Record<SyncPushChange["entity_type"], number> = {
  PROJECT: 0,
  TASK: 1,
  TASK_SUBTASK: 2,
  TASK_TEMPLATE: 3,
  SETTING: 4,
};

export interface PreparedPushEntry {
  outbox_id: string;
  idempotency_key: string;
}

export interface PreparedPushSkippedEntry {
  outbox_id: string;
  reason: "MISSING_ENTITY_ID" | "INVALID_PAYLOAD_JSON" | "INVALID_PAYLOAD";
}

export interface PreparedPushBatch {
  request: SyncPushRequest;
  entries: PreparedPushEntry[];
  skipped: PreparedPushSkippedEntry[];
}

export interface PushAcknowledgeSummary {
  removed_outbox_ids: string[];
  failed_outbox_ids: string[];
  pending_outbox_ids: string[];
}

export type PullApplyStatus = "applied" | "skipped" | "conflict";

export interface PullApplyResult {
  status: PullApplyStatus;
  reason?: string;
}

export interface PullApplyFailure {
  idempotency_key: string;
  error: string;
}

export interface PullBatchSummary {
  applied: number;
  skipped: number;
  conflicts: number;
  conflict_envelopes: PullConflictEnvelope[];
  skipped_self: number;
  failed: number;
  failures: PullApplyFailure[];
  server_cursor: string;
  server_time: string;
  has_more: boolean;
}

export interface PullConflictEnvelope {
  idempotency_key: string;
  entity_type: SyncPushChange["entity_type"];
  entity_id: string;
  reason: string | null;
}

interface PreparedPushCandidate {
  entry: PreparedPushEntry;
  change: SyncPushChange;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIsoDateOrFallback(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return fallback;
  return parsedDate.toISOString();
}

function normalizeSyncVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  if (value <= 0) return 1;
  return Math.floor(value);
}

function normalizeUpdatedByDevice(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function parseOutboxPayload(
  record: SyncOutboxRecord,
):
  | { ok: true; payload: Record<string, unknown> | null }
  | { ok: false; reason: PreparedPushSkippedEntry["reason"] } {
  if (record.operation === "DELETE") {
    return { ok: true, payload: null };
  }

  if (!record.payload_json) {
    return { ok: true, payload: {} };
  }

  try {
    const parsed = JSON.parse(record.payload_json) as unknown;
    if (!isPlainObject(parsed)) {
      return { ok: false, reason: "INVALID_PAYLOAD" };
    }
    return { ok: true, payload: parsed };
  } catch {
    return { ok: false, reason: "INVALID_PAYLOAD_JSON" };
  }
}

function comparePushChanges(
  left: SyncPushChange,
  right: SyncPushChange,
): number {
  const byTime = left.updated_at.localeCompare(right.updated_at);
  if (byTime !== 0) return byTime;
  const byEntityPriority =
    SYNC_ENTITY_PRIORITY[left.entity_type] -
    SYNC_ENTITY_PRIORITY[right.entity_type];
  if (byEntityPriority !== 0) return byEntityPriority;
  return left.idempotency_key.localeCompare(right.idempotency_key);
}

function normalizeApplyResult(
  result: PullApplyStatus | PullApplyResult,
): PullApplyResult {
  if (typeof result === "string") {
    return { status: result };
  }
  return result;
}

export function preparePushBatch(input: {
  deviceId: string;
  baseCursor: string | null;
  outboxChanges: SyncOutboxRecord[];
  maxChanges?: number;
}): PreparedPushBatch {
  const normalizedLimit =
    typeof input.maxChanges === "number" && Number.isFinite(input.maxChanges)
      ? Math.max(1, Math.floor(input.maxChanges))
      : Number.POSITIVE_INFINITY;

  const candidates: PreparedPushCandidate[] = [];
  const skipped: PreparedPushSkippedEntry[] = [];

  for (const record of input.outboxChanges) {
    if (candidates.length >= normalizedLimit) break;

    const entityId = record.entity_id.trim();
    if (!entityId) {
      skipped.push({ outbox_id: record.id, reason: "MISSING_ENTITY_ID" });
      continue;
    }

    const parsedPayload = parseOutboxPayload(record);
    if (!parsedPayload.ok) {
      skipped.push({ outbox_id: record.id, reason: parsedPayload.reason });
      continue;
    }

    const payload = parsedPayload.payload;
    const payloadUpdatedAt =
      payload && isPlainObject(payload) ? payload.updated_at : undefined;
    const payloadUpdatedByDevice =
      payload && isPlainObject(payload) ? payload.updated_by_device : undefined;
    const payloadSyncVersion =
      payload && isPlainObject(payload) ? payload.sync_version : undefined;

    const idempotencyKey =
      record.idempotency_key.trim() ||
      createSyncIdempotencyKey(input.deviceId, record.id);

    const change: SyncPushChange = {
      entity_type: record.entity_type,
      entity_id: entityId,
      operation: record.operation,
      updated_at: parseIsoDateOrFallback(payloadUpdatedAt, record.updated_at),
      updated_by_device: normalizeUpdatedByDevice(
        payloadUpdatedByDevice,
        input.deviceId,
      ),
      sync_version: normalizeSyncVersion(payloadSyncVersion),
      payload,
      idempotency_key: idempotencyKey,
    };

    candidates.push({
      entry: { outbox_id: record.id, idempotency_key: idempotencyKey },
      change,
    });
  }

  candidates.sort((left, right) =>
    comparePushChanges(left.change, right.change),
  );
  const changes = candidates.map((candidate) => candidate.change);

  return {
    request: buildSyncPushRequest({
      deviceId: input.deviceId,
      baseCursor: input.baseCursor,
      changes,
    }),
    entries: candidates.map((candidate) => candidate.entry),
    skipped,
  };
}

export async function acknowledgePushResult(input: {
  entries: PreparedPushEntry[];
  response: SyncPushResponse;
  removeOutboxChanges: (ids: string[]) => Promise<void>;
  markOutboxChangeFailed: (id: string, error: string) => Promise<void>;
}): Promise<PushAcknowledgeSummary> {
  const byIdempotencyKey = new Map<string, PreparedPushEntry>();
  for (const entry of input.entries) {
    byIdempotencyKey.set(entry.idempotency_key, entry);
  }

  const removedOutboxIds = new Set<string>();
  const failedOutboxIds = new Set<string>();

  for (const idempotencyKey of input.response.accepted) {
    const matchedEntry = byIdempotencyKey.get(idempotencyKey);
    if (!matchedEntry) continue;
    removedOutboxIds.add(matchedEntry.outbox_id);
  }

  for (const rejected of input.response.rejected) {
    const matchedEntry = byIdempotencyKey.get(rejected.idempotency_key);
    if (!matchedEntry) continue;
    if (removedOutboxIds.has(matchedEntry.outbox_id)) continue;
    await input.markOutboxChangeFailed(
      matchedEntry.outbox_id,
      `[${rejected.reason}] ${rejected.message}`,
    );
    failedOutboxIds.add(matchedEntry.outbox_id);
  }

  const removed = Array.from(removedOutboxIds);
  if (removed.length > 0) {
    await input.removeOutboxChanges(removed);
  }

  const pendingOutboxIds = input.entries
    .map((entry) => entry.outbox_id)
    .filter((id) => !removedOutboxIds.has(id) && !failedOutboxIds.has(id));

  return {
    removed_outbox_ids: removed,
    failed_outbox_ids: Array.from(failedOutboxIds),
    pending_outbox_ids: pendingOutboxIds,
  };
}

export async function applyPullBatch(input: {
  response: SyncPullResponse;
  localDeviceId: string;
  applyChange: (
    change: SyncPushChange,
  ) => Promise<PullApplyStatus | PullApplyResult>;
  skipSelfChanges?: boolean;
}): Promise<PullBatchSummary> {
  const skipSelfChanges = input.skipSelfChanges ?? true;
  const normalizedLocalDeviceId = input.localDeviceId.trim().toLowerCase();
  const sortedChanges = [...input.response.changes].sort(comparePushChanges);
  const seenIdempotencyKeys = new Set<string>();

  let applied = 0;
  let skipped = 0;
  let conflicts = 0;
  const conflictEnvelopes: PullConflictEnvelope[] = [];
  let skippedSelf = 0;
  let failed = 0;
  const failures: PullApplyFailure[] = [];

  for (const change of sortedChanges) {
    const idempotencyKey = change.idempotency_key.trim();
    if (seenIdempotencyKeys.has(idempotencyKey)) {
      skipped += 1;
      continue;
    }
    seenIdempotencyKeys.add(idempotencyKey);

    const fromSelf =
      skipSelfChanges &&
      change.updated_by_device.trim().toLowerCase() === normalizedLocalDeviceId;
    if (fromSelf) {
      skippedSelf += 1;
      continue;
    }

    try {
      const result = normalizeApplyResult(await input.applyChange(change));
      if (result.status === "applied") {
        applied += 1;
      } else if (result.status === "conflict") {
        conflicts += 1;
        conflictEnvelopes.push({
          idempotency_key: idempotencyKey,
          entity_type: change.entity_type,
          entity_id: change.entity_id,
          reason: result.reason ?? null,
        });
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        idempotency_key: idempotencyKey,
        error: message,
      });
    }
  }

  return {
    applied,
    skipped,
    conflicts,
    conflict_envelopes: conflictEnvelopes,
    skipped_self: skippedSelf,
    failed,
    failures,
    server_cursor: input.response.server_cursor,
    server_time: input.response.server_time,
    has_more: input.response.has_more,
  };
}

export async function advanceCursor(input: {
  serverCursor: string;
  serverTime: string;
  setCheckpoint: (cursor: string | null, syncedAt?: string) => Promise<void>;
}): Promise<{ cursor: string; synced_at: string }> {
  const normalizedCursor = input.serverCursor.trim();
  if (!normalizedCursor) {
    throw new Error(SYNC_ENGINE_ERROR_CODES.SERVER_CURSOR_REQUIRED);
  }

  const parsedServerTime = new Date(input.serverTime);
  const syncedAt = Number.isNaN(parsedServerTime.getTime())
    ? new Date().toISOString()
    : parsedServerTime.toISOString();

  await input.setCheckpoint(normalizedCursor, syncedAt);

  return {
    cursor: normalizedCursor,
    synced_at: syncedAt,
  };
}
