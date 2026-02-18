import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSyncCheckpoint } from "@/lib/database";
import { runLocalSyncCycle } from "@/lib/sync-service";
import { createSyncTransportFromConfig } from "@/lib/sync-transport";
import type { RunSyncCycleSummary } from "@/lib/sync-runner";
import type { SyncSessionDiagnostics, SyncStatus } from "@/lib/types";

const DEFAULT_AUTO_SYNC_INTERVAL_MS = 60_000;
const DEFAULT_BACKGROUND_SYNC_INTERVAL_MS = 300_000;
const DEFAULT_SYNC_PUSH_LIMIT = 200;
const DEFAULT_SYNC_PULL_LIMIT = 200;
const DEFAULT_SYNC_MAX_PULL_PAGES = 5;
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
  diagnostics: SyncSessionDiagnostics;
  syncNow: () => Promise<void>;
  retryLastFailedSync: () => Promise<boolean>;
}

interface UseSyncOptions {
  pushUrl: string | null;
  pullUrl: string | null;
  timeoutMs?: number;
  configReady?: boolean;
  autoSyncIntervalMs?: number;
  backgroundSyncIntervalMs?: number;
  pushLimit?: number;
  pullLimit?: number;
  maxPullPages?: number;
}

interface SyncRuntimeProfileInput {
  autoSyncIntervalMs?: number;
  backgroundSyncIntervalMs?: number;
  pushLimit?: number;
  pullLimit?: number;
  maxPullPages?: number;
}

export interface SyncRuntimeProfile {
  autoSyncIntervalMs: number;
  backgroundSyncIntervalMs: number;
  pushLimit: number;
  pullLimit: number;
  maxPullPages: number;
}

interface SyncSessionDiagnosticsUpdateInput {
  outcome: "success" | "failure";
  attemptedAt: string;
  durationMs: number;
  hasConflict?: boolean;
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

function normalizeNumberWithinRange(
  value: number | undefined,
  input: {
    min: number;
    max: number;
    fallback: number;
  },
): number {
  if (!Number.isFinite(value)) return input.fallback;
  const normalized = Math.floor(value as number);
  if (normalized < input.min) return input.min;
  if (normalized > input.max) return input.max;
  return normalized;
}

export function normalizeSyncRuntimeProfile(
  input: SyncRuntimeProfileInput,
): SyncRuntimeProfile {
  const autoSyncIntervalMs = normalizeNumberWithinRange(
    input.autoSyncIntervalMs,
    {
      min: 15_000,
      max: 3_600_000,
      fallback: DEFAULT_AUTO_SYNC_INTERVAL_MS,
    },
  );
  const backgroundSyncIntervalMs = Math.max(
    autoSyncIntervalMs,
    normalizeNumberWithinRange(input.backgroundSyncIntervalMs, {
      min: 30_000,
      max: 7_200_000,
      fallback: DEFAULT_BACKGROUND_SYNC_INTERVAL_MS,
    }),
  );
  const pushLimit = normalizeNumberWithinRange(input.pushLimit, {
    min: 20,
    max: 500,
    fallback: DEFAULT_SYNC_PUSH_LIMIT,
  });
  const pullLimit = normalizeNumberWithinRange(input.pullLimit, {
    min: 20,
    max: 500,
    fallback: DEFAULT_SYNC_PULL_LIMIT,
  });
  const maxPullPages = normalizeNumberWithinRange(input.maxPullPages, {
    min: 1,
    max: 20,
    fallback: DEFAULT_SYNC_MAX_PULL_PAGES,
  });

  return {
    autoSyncIntervalMs,
    backgroundSyncIntervalMs,
    pushLimit,
    pullLimit,
    maxPullPages,
  };
}

export function getAutoSyncIntervalMsForVisibility(
  isDocumentVisible: boolean,
  runtimeProfile: SyncRuntimeProfile,
): number {
  return isDocumentVisible
    ? runtimeProfile.autoSyncIntervalMs
    : runtimeProfile.backgroundSyncIntervalMs;
}

export function calculateSyncBackoffMs(consecutiveFailures: number): number {
  const normalizedFailures = Math.max(0, Math.floor(consecutiveFailures));
  if (normalizedFailures <= 0) return 0;

  const exponent = Math.min(normalizedFailures - 1, 8);
  const delay = RETRY_BASE_DELAY_MS * 2 ** exponent;
  return Math.min(RETRY_MAX_DELAY_MS, delay);
}

function normalizeDurationMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function calculateSuccessRatePercent(success: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((success / total) * 1000) / 10;
}

export function createInitialSyncSessionDiagnostics(): SyncSessionDiagnostics {
  return {
    total_cycles: 0,
    successful_cycles: 0,
    failed_cycles: 0,
    conflict_cycles: 0,
    consecutive_failures: 0,
    success_rate_percent: 0,
    last_cycle_duration_ms: null,
    average_cycle_duration_ms: null,
    last_attempt_at: null,
    last_success_at: null,
  };
}

export function appendSyncSessionDiagnostics(
  previous: SyncSessionDiagnostics,
  input: SyncSessionDiagnosticsUpdateInput,
): SyncSessionDiagnostics {
  const durationMs = normalizeDurationMs(input.durationMs);
  const nextTotalCycles = previous.total_cycles + 1;
  const nextSuccessfulCycles =
    previous.successful_cycles + (input.outcome === "success" ? 1 : 0);
  const nextFailedCycles =
    previous.failed_cycles + (input.outcome === "failure" ? 1 : 0);
  const nextConflictCycles =
    previous.conflict_cycles +
    (input.outcome === "success" && input.hasConflict ? 1 : 0);
  const nextConsecutiveFailures =
    input.outcome === "failure" ? previous.consecutive_failures + 1 : 0;
  const accumulatedDurationMs =
    (previous.average_cycle_duration_ms ?? 0) * previous.total_cycles +
    durationMs;
  const nextAverageCycleDurationMs =
    nextTotalCycles > 0
      ? Math.round(accumulatedDurationMs / nextTotalCycles)
      : null;

  return {
    total_cycles: nextTotalCycles,
    successful_cycles: nextSuccessfulCycles,
    failed_cycles: nextFailedCycles,
    conflict_cycles: nextConflictCycles,
    consecutive_failures: nextConsecutiveFailures,
    success_rate_percent: calculateSuccessRatePercent(
      nextSuccessfulCycles,
      nextTotalCycles,
    ),
    last_cycle_duration_ms: durationMs,
    average_cycle_duration_ms: nextAverageCycleDurationMs,
    last_attempt_at: input.attemptedAt,
    last_success_at:
      input.outcome === "success"
        ? input.attemptedAt
        : previous.last_success_at,
  };
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
  const runtimeProfile = useMemo(
    () =>
      normalizeSyncRuntimeProfile({
        autoSyncIntervalMs: options.autoSyncIntervalMs,
        backgroundSyncIntervalMs: options.backgroundSyncIntervalMs,
        pushLimit: options.pushLimit,
        pullLimit: options.pullLimit,
        maxPullPages: options.maxPullPages,
      }),
    [
      options.autoSyncIntervalMs,
      options.backgroundSyncIntervalMs,
      options.maxPullPages,
      options.pullLimit,
      options.pushLimit,
    ],
  );
  const { pushLimit, pullLimit, maxPullPages } = runtimeProfile;
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
  const [isDocumentVisible, setIsDocumentVisible] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState !== "hidden";
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
  const [diagnostics, setDiagnostics] = useState<SyncSessionDiagnostics>(() =>
    createInitialSyncSessionDiagnostics(),
  );
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
      const attemptStartedAt = Date.now();

      try {
        const summary = await runLocalSyncCycle(transport, {
          pushLimit,
          pullLimit,
          maxPullPages,
        });
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
        setDiagnostics((previous) =>
          appendSyncSessionDiagnostics(previous, {
            outcome: "success",
            attemptedAt: new Date().toISOString(),
            durationMs: Date.now() - attemptStartedAt,
            hasConflict,
          }),
        );

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
        setDiagnostics((previous) =>
          appendSyncSessionDiagnostics(previous, {
            outcome: "failure",
            attemptedAt: new Date().toISOString(),
            durationMs: Date.now() - attemptStartedAt,
          }),
        );
      } finally {
        inFlightRef.current = false;
        setIsSyncing(false);
      }
    },
    [
      isConfigReady,
      isOnline,
      maxPullPages,
      pullLimit,
      pushLimit,
      queryClient,
      transport,
    ],
  );

  const syncNow = useCallback(async () => {
    await runSync(true);
  }, [runSync]);

  const retryLastFailedSync = useCallback(async (): Promise<boolean> => {
    if (!lastError) return false;
    if (inFlightRef.current) return false;
    await runSync(true);
    return true;
  }, [lastError, runSync]);

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
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState !== "hidden");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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

    const activeIntervalMs = getAutoSyncIntervalMsForVisibility(
      isDocumentVisible,
      runtimeProfile,
    );
    const intervalId = window.setInterval(() => {
      void runSync(false);
    }, activeIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [isConfigReady, isDocumentVisible, runSync, runtimeProfile, transport]);

  useEffect(() => {
    if (!isDocumentVisible) return;
    if (!isConfigReady || !transport || !isOnline) return;
    void runSync(false);
  }, [isConfigReady, isDocumentVisible, isOnline, runSync, transport]);

  return {
    status,
    isSyncing,
    isOnline,
    hasTransport: Boolean(transport),
    lastSyncedAt,
    lastError,
    diagnostics,
    syncNow,
    retryLastFailedSync,
  };
}
