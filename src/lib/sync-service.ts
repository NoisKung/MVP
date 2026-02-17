import {
  applyIncomingSyncChange,
  getOrCreateDeviceId,
  getSyncCheckpoint,
  listSyncOutboxChanges,
  markSyncOutboxChangeFailed,
  removeSyncOutboxChanges,
  setSyncCheckpoint,
} from "./database";
import { runSyncCycle } from "./sync-runner";
import type {
  RunSyncCycleOptions,
  RunSyncCycleSummary,
  SyncTransport,
} from "./sync-runner";

export async function runLocalSyncCycle(
  transport: SyncTransport,
  options?: RunSyncCycleOptions,
): Promise<RunSyncCycleSummary> {
  return runSyncCycle({
    transport,
    storage: {
      getDeviceId: getOrCreateDeviceId,
      getCheckpoint: getSyncCheckpoint,
      setCheckpoint: setSyncCheckpoint,
      listOutboxChanges: listSyncOutboxChanges,
      removeOutboxChanges: removeSyncOutboxChanges,
      markOutboxChangeFailed: markSyncOutboxChangeFailed,
      applyIncomingChange: applyIncomingSyncChange,
    },
    options,
  });
}
