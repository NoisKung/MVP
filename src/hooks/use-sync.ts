import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSyncCheckpoint } from "@/lib/database";
import { runLocalSyncCycle } from "@/lib/sync-service";
import { createSyncTransportFromConfig } from "@/lib/sync-transport";
import type { RunSyncCycleSummary } from "@/lib/sync-runner";
import type { SyncStatus } from "@/lib/types";

const AUTO_SYNC_INTERVAL_MS = 60_000;
const OFFLINE_SYNC_MESSAGE = "Offline. Sync will retry when network returns.";
const RETRY_BASE_DELAY_MS = 5_000;
const RETRY_MAX_DELAY_MS = 300_000;

interface UseSyncState {
  status: SyncStatus;
  isSyncing: boolean;
  isOnline: boolean;
  hasTransport: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  syncNow: () => Promise<void>;
}

interface UseSyncOptions {
  pushUrl: string | null;
  pullUrl: string | null;
  timeoutMs?: number;
  configReady?: boolean;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Sync failed unexpectedly.";
}

function isLikelyNetworkError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("timed out") ||
    normalized.includes("offline")
  );
}

export function calculateSyncBackoffMs(consecutiveFailures: number): number {
  const normalizedFailures = Math.max(0, Math.floor(consecutiveFailures));
  if (normalizedFailures <= 0) return 0;

  const exponent = Math.min(normalizedFailures - 1, 8);
  const delay = RETRY_BASE_DELAY_MS * 2 ** exponent;
  return Math.min(RETRY_MAX_DELAY_MS, delay);
}

function buildConflictMessage(summary: RunSyncCycleSummary): string {
  const parts: string[] = [];
  if (summary.failed_outbox_changes > 0) {
    parts.push(`${summary.failed_outbox_changes} outbox change(s) failed`);
  }
  if (summary.pull?.failed && summary.pull.failed > 0) {
    parts.push(`${summary.pull.failed} incoming change(s) failed`);
  }
  if (summary.pull?.conflicts && summary.pull.conflicts > 0) {
    parts.push(`${summary.pull.conflicts} conflict(s) detected`);
  }

  if (parts.length === 0) {
    return "Sync requires attention.";
  }
  return `${parts.join(", ")}.`;
}

export function useSync(options: UseSyncOptions): UseSyncState {
  const isConfigReady = options.configReady ?? true;
  const queryClient = useQueryClient();
  const transport = useMemo(
    () =>
      isConfigReady
        ? createSyncTransportFromConfig({
            pushUrl: options.pushUrl,
            pullUrl: options.pullUrl,
            timeoutMs: options.timeoutMs,
          })
        : null,
    [isConfigReady, options.pullUrl, options.pushUrl, options.timeoutMs],
  );
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });
  const [status, setStatus] = useState<SyncStatus>(() => {
    if (!isConfigReady) return "OFFLINE";
    if (!transport) return "LOCAL_ONLY";
    if (!isOnline) return "OFFLINE";
    return "SYNCED";
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const nextAutoAttemptAtRef = useRef(0);

  const runSync = useCallback(
    async (manual: boolean) => {
      if (inFlightRef.current) return;

      if (!manual) {
        const now = Date.now();
        if (now < nextAutoAttemptAtRef.current) {
          return;
        }
      }

      if (!isConfigReady) {
        setStatus("OFFLINE");
        setLastError(null);
        return;
      }

      if (!transport) {
        setStatus("LOCAL_ONLY");
        setLastError(null);
        return;
      }

      if (!isOnline) {
        setStatus("OFFLINE");
        setLastError(OFFLINE_SYNC_MESSAGE);
        return;
      }

      inFlightRef.current = true;
      setIsSyncing(true);
      setStatus("SYNCING");
      setLastError(null);

      try {
        const summary = await runLocalSyncCycle(transport);
        const hasConflict =
          summary.failed_outbox_changes > 0 ||
          (summary.pull?.failed ?? 0) > 0 ||
          (summary.pull?.conflicts ?? 0) > 0;
        consecutiveFailuresRef.current = 0;
        nextAutoAttemptAtRef.current = 0;
        setStatus(hasConflict ? "CONFLICT" : "SYNCED");
        setLastError(hasConflict ? buildConflictMessage(summary) : null);

        const checkpoint = await getSyncCheckpoint();
        setLastSyncedAt(checkpoint.last_synced_at ?? new Date().toISOString());

        await queryClient.invalidateQueries();
      } catch (error) {
        const message = getErrorMessage(error);
        if (!manual) {
          consecutiveFailuresRef.current += 1;
          const backoffDelay = calculateSyncBackoffMs(
            consecutiveFailuresRef.current,
          );
          nextAutoAttemptAtRef.current = Date.now() + backoffDelay;
        }
        setLastError(message);
        setStatus(isLikelyNetworkError(message) ? "OFFLINE" : "CONFLICT");
      } finally {
        inFlightRef.current = false;
        setIsSyncing(false);
      }
    },
    [isConfigReady, isOnline, queryClient, transport],
  );

  const syncNow = useCallback(async () => {
    await runSync(true);
  }, [runSync]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isConfigReady) {
      setStatus("OFFLINE");
      setLastError(null);
      return;
    }

    if (!transport) {
      setStatus("LOCAL_ONLY");
      setLastError(null);
      return;
    }

    if (!isOnline) {
      setStatus("OFFLINE");
      setLastError((previousError) => previousError ?? OFFLINE_SYNC_MESSAGE);
      return;
    }

    void runSync(false);
  }, [isConfigReady, isOnline, runSync, transport]);

  useEffect(() => {
    if (!isConfigReady || !transport) return;

    const intervalId = window.setInterval(() => {
      void runSync(false);
    }, AUTO_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isConfigReady, runSync, transport]);

  return {
    status,
    isSyncing,
    isOnline,
    hasTransport: Boolean(transport),
    lastSyncedAt,
    lastError,
    syncNow,
  };
}
