import {
  buildSyncPullRequest,
  parseSyncPullResponse,
  parseSyncPushResponse,
} from "./sync-contract";
import {
  acknowledgePushResult,
  advanceCursor,
  applyPullBatch,
  preparePushBatch,
} from "./sync-engine";
import type { SyncCheckpoint, SyncOutboxRecord } from "./types";

export interface SyncTransport {
  push: (payload: unknown) => Promise<unknown>;
  pull: (payload: unknown) => Promise<unknown>;
}

export interface SyncRunnerStorage {
  getDeviceId: () => Promise<string>;
  getCheckpoint: () => Promise<SyncCheckpoint>;
  setCheckpoint: (cursor: string | null, syncedAt?: string) => Promise<void>;
  listOutboxChanges: (limit?: number) => Promise<SyncOutboxRecord[]>;
  removeOutboxChanges: (ids: string[]) => Promise<void>;
  markOutboxChangeFailed: (id: string, error: string) => Promise<void>;
  applyIncomingChange: (
    change: Parameters<typeof applyPullBatch>[0]["response"]["changes"][number],
  ) => ReturnType<Parameters<typeof applyPullBatch>[0]["applyChange"]>;
}

export interface RunSyncCycleOptions {
  pushLimit?: number;
  pullLimit?: number;
  skipPull?: boolean;
  maxPullPages?: number;
}

export interface RunSyncCycleSummary {
  device_id: string;
  checkpoint_before: string | null;
  checkpoint_after: string | null;
  prepared_push_changes: number;
  skipped_push_changes: number;
  removed_outbox_changes: number;
  failed_outbox_changes: number;
  pending_outbox_changes: number;
  pull: {
    applied: number;
    skipped: number;
    conflicts: number;
    skipped_self: number;
    failed: number;
    has_more: boolean;
  } | null;
}

export async function runSyncCycle(input: {
  transport: SyncTransport;
  storage: SyncRunnerStorage;
  options?: RunSyncCycleOptions;
}): Promise<RunSyncCycleSummary> {
  const pushLimit = input.options?.pushLimit;
  const pullLimit = input.options?.pullLimit;
  const skipPull = input.options?.skipPull ?? false;
  const maxPullPages =
    typeof input.options?.maxPullPages === "number" &&
    Number.isFinite(input.options.maxPullPages)
      ? Math.max(1, Math.floor(input.options.maxPullPages))
      : 5;

  const deviceId = await input.storage.getDeviceId();
  const checkpoint = await input.storage.getCheckpoint();
  let activeCursor = checkpoint.last_sync_cursor;

  const outboxChanges = await input.storage.listOutboxChanges(pushLimit);
  const preparedPushBatch = preparePushBatch({
    deviceId,
    baseCursor: checkpoint.last_sync_cursor,
    outboxChanges,
    maxChanges: pushLimit,
  });

  let removedOutboxChanges = 0;
  let failedOutboxChanges = 0;
  let pendingOutboxChanges = 0;

  if (preparedPushBatch.request.changes.length > 0) {
    const rawPushResponse = await input.transport.push(
      preparedPushBatch.request,
    );
    const pushResponse = parseSyncPushResponse(rawPushResponse);

    const pushSummary = await acknowledgePushResult({
      entries: preparedPushBatch.entries,
      response: pushResponse,
      removeOutboxChanges: input.storage.removeOutboxChanges,
      markOutboxChangeFailed: input.storage.markOutboxChangeFailed,
    });

    removedOutboxChanges = pushSummary.removed_outbox_ids.length;
    failedOutboxChanges = pushSummary.failed_outbox_ids.length;
    pendingOutboxChanges = pushSummary.pending_outbox_ids.length;

    const advanced = await advanceCursor({
      serverCursor: pushResponse.server_cursor,
      serverTime: pushResponse.server_time,
      setCheckpoint: input.storage.setCheckpoint,
    });
    activeCursor = advanced.cursor;
  }

  if (skipPull) {
    return {
      device_id: deviceId,
      checkpoint_before: checkpoint.last_sync_cursor,
      checkpoint_after: activeCursor,
      prepared_push_changes: preparedPushBatch.request.changes.length,
      skipped_push_changes: preparedPushBatch.skipped.length,
      removed_outbox_changes: removedOutboxChanges,
      failed_outbox_changes: failedOutboxChanges,
      pending_outbox_changes: pendingOutboxChanges,
      pull: null,
    };
  }

  let aggregatedPullSummary: RunSyncCycleSummary["pull"] = {
    applied: 0,
    skipped: 0,
    conflicts: 0,
    skipped_self: 0,
    failed: 0,
    has_more: false,
  };

  let page = 0;
  while (page < maxPullPages) {
    page += 1;

    const pullRequest = buildSyncPullRequest({
      deviceId,
      cursor: activeCursor,
      limit: pullLimit,
    });
    const rawPullResponse = await input.transport.pull(pullRequest);
    const pullResponse = parseSyncPullResponse(rawPullResponse);

    const pullSummary = await applyPullBatch({
      response: pullResponse,
      localDeviceId: deviceId,
      applyChange: input.storage.applyIncomingChange,
    });

    aggregatedPullSummary = {
      applied: aggregatedPullSummary.applied + pullSummary.applied,
      skipped: aggregatedPullSummary.skipped + pullSummary.skipped,
      conflicts: aggregatedPullSummary.conflicts + pullSummary.conflicts,
      skipped_self:
        aggregatedPullSummary.skipped_self + pullSummary.skipped_self,
      failed: aggregatedPullSummary.failed + pullSummary.failed,
      has_more: pullSummary.has_more,
    };

    const advanced = await advanceCursor({
      serverCursor: pullSummary.server_cursor,
      serverTime: pullSummary.server_time,
      setCheckpoint: input.storage.setCheckpoint,
    });
    activeCursor = advanced.cursor;

    if (!pullSummary.has_more) {
      break;
    }
  }

  return {
    device_id: deviceId,
    checkpoint_before: checkpoint.last_sync_cursor,
    checkpoint_after: activeCursor,
    prepared_push_changes: preparedPushBatch.request.changes.length,
    skipped_push_changes: preparedPushBatch.skipped.length,
    removed_outbox_changes: removedOutboxChanges,
    failed_outbox_changes: failedOutboxChanges,
    pending_outbox_changes: pendingOutboxChanges,
    pull: aggregatedPullSummary,
  };
}
