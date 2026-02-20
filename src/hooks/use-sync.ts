import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSyncCheckpoint } from "@/lib/database";
import { runLocalSyncCycle } from "@/lib/sync-service";
import { resolveSyncTransportConfig } from "@/lib/sync-transport";
import { translate } from "@/lib/i18n";
import { localizeErrorMessage } from "@/lib/error-message";
import type { RunSyncCycleSummary } from "@/lib/sync-runner";
import type {
  AppLocale,
  SyncProvider,
  SyncRuntimeProfileSetting,
  SyncSessionDiagnostics,
  SyncStatus,
} from "@/lib/types";

const DEFAULT_AUTO_SYNC_INTERVAL_MS = 60_000;
const DEFAULT_BACKGROUND_SYNC_INTERVAL_MS = 300_000;
const DEFAULT_SYNC_PUSH_LIMIT = 200;
const DEFAULT_SYNC_PULL_LIMIT = 200;
const DEFAULT_SYNC_MAX_PULL_PAGES = 5;
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
  provider: SyncProvider;
  providerConfig?: Record<string, unknown> | null;
  runtimeProfile: SyncRuntimeProfileSetting;
  timeoutMs?: number;
  configReady?: boolean;
  autoSyncIntervalMs?: number;
  backgroundSyncIntervalMs?: number;
  pushLimit?: number;
  pullLimit?: number;
  maxPullPages?: number;
  locale?: AppLocale;
}

interface SyncRuntimeProfileInput {
  autoSyncIntervalMs?: number;
  backgroundSyncIntervalMs?: number;
  pushLimit?: number;
  pullLimit?: number;
  maxPullPages?: number;
}

interface NormalizedSyncRuntimeProfileResult {
  profile: SyncRuntimeProfile;
  validationRejected: boolean;
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

interface SyncConfigurationDiagnosticsInput {
  provider: SyncProvider;
  runtimeProfile: SyncRuntimeProfileSetting;
  warning: string | null;
  providerChanged: boolean;
  runtimeProfileChanged: boolean;
  validationRejected: boolean;
}

function getErrorMessage(error: unknown, locale: AppLocale): string {
  return localizeErrorMessage(error, locale, "sync.error.unexpected");
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
  return normalizeSyncRuntimeProfileWithValidation(input).profile;
}

export function normalizeSyncRuntimeProfileWithValidation(
  input: SyncRuntimeProfileInput,
): NormalizedSyncRuntimeProfileResult {
  let validationRejected = false;
  const autoSyncIntervalMs = normalizeNumberWithinRange(
    input.autoSyncIntervalMs,
    {
      min: 15_000,
      max: 3_600_000,
      fallback: DEFAULT_AUTO_SYNC_INTERVAL_MS,
    },
  );
  if (
    Number.isFinite(input.autoSyncIntervalMs) &&
    Math.floor(input.autoSyncIntervalMs as number) !== autoSyncIntervalMs
  ) {
    validationRejected = true;
  }

  const normalizedBackgroundSyncIntervalMs = normalizeNumberWithinRange(
    input.backgroundSyncIntervalMs,
    {
      min: 30_000,
      max: 7_200_000,
      fallback: DEFAULT_BACKGROUND_SYNC_INTERVAL_MS,
    },
  );
  if (
    Number.isFinite(input.backgroundSyncIntervalMs) &&
    Math.floor(input.backgroundSyncIntervalMs as number) !==
      normalizedBackgroundSyncIntervalMs
  ) {
    validationRejected = true;
  }
  const backgroundSyncIntervalMs = Math.max(
    autoSyncIntervalMs,
    normalizedBackgroundSyncIntervalMs,
  );
  if (backgroundSyncIntervalMs !== normalizedBackgroundSyncIntervalMs) {
    validationRejected = true;
  }

  const pushLimit = normalizeNumberWithinRange(input.pushLimit, {
    min: 20,
    max: 500,
    fallback: DEFAULT_SYNC_PUSH_LIMIT,
  });
  if (
    Number.isFinite(input.pushLimit) &&
    Math.floor(input.pushLimit as number) !== pushLimit
  ) {
    validationRejected = true;
  }

  const pullLimit = normalizeNumberWithinRange(input.pullLimit, {
    min: 20,
    max: 500,
    fallback: DEFAULT_SYNC_PULL_LIMIT,
  });
  if (
    Number.isFinite(input.pullLimit) &&
    Math.floor(input.pullLimit as number) !== pullLimit
  ) {
    validationRejected = true;
  }

  const maxPullPages = normalizeNumberWithinRange(input.maxPullPages, {
    min: 1,
    max: 20,
    fallback: DEFAULT_SYNC_MAX_PULL_PAGES,
  });
  if (
    Number.isFinite(input.maxPullPages) &&
    Math.floor(input.maxPullPages as number) !== maxPullPages
  ) {
    validationRejected = true;
  }

  return {
    profile: {
      autoSyncIntervalMs,
      backgroundSyncIntervalMs,
      pushLimit,
      pullLimit,
      maxPullPages,
    },
    validationRejected,
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
    selected_provider: null,
    runtime_profile: null,
    provider_selected_events: 0,
    runtime_profile_changed_events: 0,
    validation_rejected_events: 0,
    last_warning: null,
  };
}

export function applySyncConfigurationDiagnostics(
  previous: SyncSessionDiagnostics,
  input: SyncConfigurationDiagnosticsInput,
): SyncSessionDiagnostics {
  return {
    ...previous,
    selected_provider: input.provider,
    runtime_profile: input.runtimeProfile,
    provider_selected_events:
      previous.provider_selected_events + (input.providerChanged ? 1 : 0),
    runtime_profile_changed_events:
      previous.runtime_profile_changed_events +
      (input.runtimeProfileChanged ? 1 : 0),
    validation_rejected_events:
      previous.validation_rejected_events + (input.validationRejected ? 1 : 0),
    last_warning: input.warning,
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
    ...previous,
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

function buildConflictMessage(
  summary: RunSyncCycleSummary,
  locale: AppLocale,
): string {
  const parts: string[] = [];
  if (summary.failed_outbox_changes > 0) {
    parts.push(
      translate(locale, "sync.conflict.part.outboxFailed", {
        count: summary.failed_outbox_changes,
      }),
    );
  }
  if (summary.pull?.failed && summary.pull.failed > 0) {
    parts.push(
      translate(locale, "sync.conflict.part.incomingFailed", {
        count: summary.pull.failed,
      }),
    );
  }
  if (summary.pull?.conflicts && summary.pull.conflicts > 0) {
    parts.push(
      translate(locale, "sync.conflict.part.detected", {
        count: summary.pull.conflicts,
      }),
    );
  }

  if (parts.length === 0) {
    return translate(locale, "sync.status.attention");
  }
  return `${parts.join(", ")}.`;
}

export function useSync(options: UseSyncOptions): UseSyncState {
  const locale = options.locale ?? "en";
  const isConfigReady = options.configReady ?? true;
  const runtimeProfileNormalization = useMemo(
    () =>
      normalizeSyncRuntimeProfileWithValidation({
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
  const runtimeProfile = runtimeProfileNormalization.profile;
  const runtimeValidationRejected =
    runtimeProfileNormalization.validationRejected;
  const { pushLimit, pullLimit, maxPullPages } = runtimeProfile;
  const queryClient = useQueryClient();
  const resolvedTransportConfig = useMemo(
    () =>
      isConfigReady
        ? resolveSyncTransportConfig({
            provider: options.provider,
            providerConfig: options.providerConfig,
            pushUrl: options.pushUrl,
            pullUrl: options.pullUrl,
            timeoutMs: options.timeoutMs,
            locale,
          })
        : {
            status: "disabled",
            provider: options.provider,
            transport: null,
            warning: null,
          },
    [
      isConfigReady,
      locale,
      options.provider,
      options.providerConfig,
      options.pullUrl,
      options.pushUrl,
      options.timeoutMs,
    ],
  );
  const [lastKnownGoodTransport, setLastKnownGoodTransport] =
    useState<ReturnType<typeof resolveSyncTransportConfig>["transport"]>(null);
  const effectiveTransport =
    resolvedTransportConfig.status === "ready"
      ? resolvedTransportConfig.transport
      : resolvedTransportConfig.status === "invalid_config"
        ? lastKnownGoodTransport
        : null;
  const usesLastKnownGoodTransport =
    resolvedTransportConfig.status === "invalid_config" &&
    Boolean(lastKnownGoodTransport);
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
    if (resolvedTransportConfig.status === "provider_unavailable") {
      return "OFFLINE";
    }
    if (!effectiveTransport) return "LOCAL_ONLY";
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
  const lastProviderRef = useRef<SyncProvider | null>(null);
  const lastRuntimeProfileRef = useRef<SyncRuntimeProfileSetting | null>(null);
  const lastValidationEventKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (resolvedTransportConfig.status !== "ready") return;
    if (!resolvedTransportConfig.transport) return;
    setLastKnownGoodTransport(resolvedTransportConfig.transport);
  }, [resolvedTransportConfig.status, resolvedTransportConfig.transport]);

  useEffect(() => {
    const providerChanged = lastProviderRef.current !== options.provider;
    const runtimeProfileChanged =
      lastRuntimeProfileRef.current !== options.runtimeProfile;
    const warning = resolvedTransportConfig.warning;
    const validationRejected =
      runtimeValidationRejected ||
      resolvedTransportConfig.status === "invalid_config";
    const nextValidationEventKey = validationRejected
      ? [
          options.provider,
          options.runtimeProfile,
          resolvedTransportConfig.status,
          warning ?? "",
        ].join("|")
      : null;
    const shouldIncrementValidationRejected =
      validationRejected &&
      nextValidationEventKey !== null &&
      nextValidationEventKey !== lastValidationEventKeyRef.current;

    setDiagnostics((previous) =>
      applySyncConfigurationDiagnostics(previous, {
        provider: options.provider,
        runtimeProfile: options.runtimeProfile,
        warning,
        providerChanged,
        runtimeProfileChanged,
        validationRejected: shouldIncrementValidationRejected,
      }),
    );

    lastProviderRef.current = options.provider;
    lastRuntimeProfileRef.current = options.runtimeProfile;
    lastValidationEventKeyRef.current = nextValidationEventKey;
  }, [
    options.provider,
    options.runtimeProfile,
    resolvedTransportConfig.status,
    resolvedTransportConfig.warning,
    runtimeValidationRejected,
  ]);

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

      if (resolvedTransportConfig.status === "provider_unavailable") {
        setStatus("OFFLINE");
        setLastError(
          resolvedTransportConfig.warning ??
            translate(locale, "sync.warning.providerUnavailable"),
        );
        return;
      }

      if (!effectiveTransport) {
        setStatus("LOCAL_ONLY");
        if (resolvedTransportConfig.status === "invalid_config") {
          setLastError(
            resolvedTransportConfig.warning ??
              translate(locale, "sync.warning.invalidConfigNoLastKnownGood"),
          );
        } else {
          setLastError(null);
        }
        return;
      }

      if (!isOnline) {
        setStatus("OFFLINE");
        setLastError(translate(locale, "sync.offline.retryNetworkReturn"));
        return;
      }

      inFlightRef.current = true;
      setIsSyncing(true);
      setStatus("SYNCING");
      setLastError(
        usesLastKnownGoodTransport
          ? translate(locale, "sync.warning.usingLastKnownGood", {
              warning: resolvedTransportConfig.warning ?? "",
            }).trim()
          : null,
      );
      const attemptStartedAt = Date.now();

      try {
        const summary = await runLocalSyncCycle(effectiveTransport, {
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
        if (hasConflict) {
          setLastError(buildConflictMessage(summary, locale));
        } else if (usesLastKnownGoodTransport) {
          setLastError(
            translate(locale, "sync.warning.completedWithLastKnownGood", {
              warning: resolvedTransportConfig.warning ?? "",
            }).trim(),
          );
        } else {
          setLastError(null);
        }

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
        const message = getErrorMessage(error, locale);
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
      effectiveTransport,
      isConfigReady,
      isOnline,
      maxPullPages,
      pullLimit,
      pushLimit,
      queryClient,
      resolvedTransportConfig.status,
      resolvedTransportConfig.warning,
      usesLastKnownGoodTransport,
      locale,
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

    if (resolvedTransportConfig.status === "provider_unavailable") {
      setStatus("OFFLINE");
      setLastError(
        resolvedTransportConfig.warning ??
          translate(locale, "sync.warning.providerUnavailable"),
      );
      return;
    }

    if (!effectiveTransport) {
      setStatus("LOCAL_ONLY");
      if (resolvedTransportConfig.status === "invalid_config") {
        setLastError(
          resolvedTransportConfig.warning ??
            translate(locale, "sync.warning.invalidConfigNoLastKnownGood"),
        );
      } else {
        setLastError(null);
      }
      return;
    }

    if (!isOnline) {
      setStatus("OFFLINE");
      setLastError(
        (previousError) =>
          previousError ?? translate(locale, "sync.offline.retryNetworkReturn"),
      );
      return;
    }

    void runSync(false);
  }, [
    effectiveTransport,
    isConfigReady,
    isOnline,
    locale,
    resolvedTransportConfig.status,
    resolvedTransportConfig.warning,
    runSync,
  ]);

  useEffect(() => {
    if (!isConfigReady || !effectiveTransport) return;
    if (resolvedTransportConfig.status === "provider_unavailable") return;

    const activeIntervalMs = getAutoSyncIntervalMsForVisibility(
      isDocumentVisible,
      runtimeProfile,
    );
    const intervalId = window.setInterval(() => {
      void runSync(false);
    }, activeIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [
    effectiveTransport,
    isConfigReady,
    isDocumentVisible,
    resolvedTransportConfig.status,
    runSync,
    runtimeProfile,
  ]);

  useEffect(() => {
    if (!isDocumentVisible) return;
    if (!isConfigReady || !effectiveTransport || !isOnline) return;
    if (resolvedTransportConfig.status === "provider_unavailable") return;
    void runSync(false);
  }, [
    effectiveTransport,
    isConfigReady,
    isDocumentVisible,
    isOnline,
    resolvedTransportConfig.status,
    runSync,
  ]);

  return {
    status,
    isSyncing,
    isOnline,
    hasTransport: Boolean(effectiveTransport),
    lastSyncedAt,
    lastError,
    diagnostics,
    syncNow,
    retryLastFailedSync,
  };
}
