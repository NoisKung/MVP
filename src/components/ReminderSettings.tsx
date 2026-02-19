import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Bell,
  ShieldCheck,
  HardDrive,
  Cloud,
  CloudOff,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  Upload,
  Database,
} from "lucide-react";
import {
  type NotificationPermissionState,
  getNotificationPermissionStatus,
  requestNotificationPermissionAccess,
  resetReminderPermissionAndHistory,
} from "@/hooks/use-reminder-notifications";
import {
  useBackupRestorePreflight,
  useExportBackup,
  useExportSyncConflictReport,
  useSyncConflictEvents,
  useSyncConflictObservability,
} from "@/hooks/use-tasks";
import {
  buildManualMergeInitialText,
  buildManualMergeResolutionPayload,
  normalizeManualMergeText,
} from "@/lib/manual-merge";
import type {
  BackupRestorePreflight,
  ResolveSyncConflictInput,
  SyncConflictEventRecord,
  SyncConflictRecord,
  SyncConflictResolutionStrategy,
  SyncProvider,
  SyncRuntimeProfilePreset,
  SyncRuntimeProfileSetting,
  SyncSessionDiagnostics,
  SyncStatus,
  UpdateSyncEndpointSettingsInput,
  UpdateSyncProviderSettingsInput,
  UpdateSyncRuntimeSettingsInput,
} from "@/lib/types";
import { ManualMergeEditor } from "./ManualMergeEditor";

interface ReminderSettingsProps {
  remindersEnabled: boolean;
  onRemindersEnabledChange: (enabled: boolean) => void;
  syncStatus: SyncStatus;
  syncStatusLabel: string;
  syncLastSyncedAt: string | null;
  syncLastError: string | null;
  syncIsRunning: boolean;
  syncHasTransport: boolean;
  onSyncNow: () => Promise<void>;
  onRetryLastFailedSync: () => Promise<boolean>;
  syncProvider: SyncProvider;
  syncProviderConfig: Record<string, unknown> | null;
  syncProviderLoading: boolean;
  syncProviderSaving: boolean;
  onSaveSyncProviderSettings: (
    input: UpdateSyncProviderSettingsInput,
  ) => Promise<void>;
  syncPushUrl: string | null;
  syncPullUrl: string | null;
  syncConfigSaving: boolean;
  onSaveSyncSettings: (input: UpdateSyncEndpointSettingsInput) => Promise<void>;
  syncAutoIntervalSeconds: number;
  syncBackgroundIntervalSeconds: number;
  syncPushLimit: number;
  syncPullLimit: number;
  syncMaxPullPages: number;
  syncRuntimePreset: SyncRuntimeProfilePreset;
  syncRuntimeProfileSetting: SyncRuntimeProfileSetting;
  syncRuntimeProfileLoading: boolean;
  syncDiagnostics: SyncSessionDiagnostics;
  syncRuntimeSaving: boolean;
  onSaveSyncRuntimeSettings: (
    input: UpdateSyncRuntimeSettingsInput,
  ) => Promise<void>;
  syncConflicts: SyncConflictRecord[];
  syncConflictsLoading: boolean;
  syncConflictResolving: boolean;
  onResolveSyncConflict: (input: ResolveSyncConflictInput) => Promise<void>;
  backupRestoreLatestBusy: boolean;
  backupImportBusy: boolean;
  onQueueRestoreLatestBackup: (input: { force: boolean }) => Promise<void>;
  onQueueImportBackup: (input: {
    payload: unknown;
    force: boolean;
    sourceName?: string;
  }) => Promise<void>;
}

interface SyncProviderCapability {
  label: string;
  summary: string;
  authRequirement: string;
  endpointMode: "custom" | "managed";
  warnings: string[];
}

const DESKTOP_RUNTIME_DEFAULTS = {
  auto_sync_interval_seconds: 60,
  background_sync_interval_seconds: 300,
  push_limit: 200,
  pull_limit: 200,
  max_pull_pages: 5,
} as const;

const MOBILE_RUNTIME_DEFAULTS = {
  auto_sync_interval_seconds: 120,
  background_sync_interval_seconds: 600,
  push_limit: 120,
  pull_limit: 120,
  max_pull_pages: 3,
} as const;

const SYNC_RUNTIME_PROFILE_OPTIONS: Array<{
  value: SyncRuntimeProfileSetting;
  label: string;
}> = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile_beta", label: "Mobile Beta" },
  { value: "custom", label: "Custom" },
];

const SYNC_PROVIDER_CAPABILITIES: Record<SyncProvider, SyncProviderCapability> =
  {
    provider_neutral: {
      label: "Provider Neutral",
      summary: "Use custom push/pull endpoints you control.",
      authRequirement: "No provider account required",
      endpointMode: "custom",
      warnings: [
        "You must set both Push URL and Pull URL.",
        "Best fit for self-hosted sync gateways.",
      ],
    },
    google_appdata: {
      label: "Google AppData",
      summary: "Managed Google Drive appDataFolder connector.",
      authRequirement: "Google OAuth required",
      endpointMode: "managed",
      warnings: [
        "Managed connector rollout is in progress; custom URLs are still used now.",
        "Subject to Google API quota/rate limits.",
      ],
    },
    onedrive_approot: {
      label: "Microsoft OneDrive AppRoot",
      summary: "Managed OneDrive AppRoot connector.",
      authRequirement: "Microsoft OAuth required",
      endpointMode: "managed",
      warnings: [
        "Managed connector rollout is in progress; custom URLs are still used now.",
        "Graph API throttling may delay sync retries.",
      ],
    },
    icloud_cloudkit: {
      label: "Apple iCloud CloudKit",
      summary: "Managed CloudKit-backed connector.",
      authRequirement: "Apple ID + iCloud permission required",
      endpointMode: "managed",
      warnings: [
        "Managed connector rollout is in progress; custom URLs are still used now.",
        "Platform/account constraints may apply outside Apple ecosystem.",
      ],
    },
    solostack_cloud_aws: {
      label: "SoloStack Cloud (AWS)",
      summary: "Managed SoloStack-hosted cloud endpoints.",
      authRequirement: "SoloStack Cloud account required",
      endpointMode: "managed",
      warnings: [
        "Availability may vary by region during rollout.",
        "Network outages fall back to local-only retries.",
      ],
    },
  };

function getRuntimeDefaultsByProfile(
  profile: SyncRuntimeProfileSetting,
  detectedPreset: SyncRuntimeProfilePreset,
) {
  if (profile === "desktop") return DESKTOP_RUNTIME_DEFAULTS;
  if (profile === "mobile_beta") return MOBILE_RUNTIME_DEFAULTS;
  return detectedPreset === "mobile"
    ? MOBILE_RUNTIME_DEFAULTS
    : DESKTOP_RUNTIME_DEFAULTS;
}

function getRuntimeProfileLabel(profile: SyncRuntimeProfileSetting): string {
  if (profile === "mobile_beta") return "Mobile Beta";
  if (profile === "custom") return "Custom";
  return "Desktop";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unable to complete this request.";
}

function renderSyncStatusIcon(status: SyncStatus) {
  if (status === "LOCAL_ONLY") {
    return <HardDrive size={14} />;
  }
  if (status === "SYNCING") {
    return <RefreshCw size={14} className="sync-spin" />;
  }
  if (status === "OFFLINE") {
    return <CloudOff size={14} />;
  }
  if (status === "CONFLICT") {
    return <AlertTriangle size={14} />;
  }
  return <CheckCircle2 size={14} />;
}

function formatSyncDateTime(value: string | null): string {
  if (!value) return "Never";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function formatDurationMs(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function formatResolutionDurationMs(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  if (value < 1000) return `${value} ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)} h`;
}

function normalizeUrlDraft(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseIntegerDraft(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
}

function formatConflictTypeLabel(
  conflictType: SyncConflictRecord["conflict_type"],
) {
  if (conflictType === "delete_vs_update") return "Delete vs Update";
  if (conflictType === "notes_collision") return "Notes Collision";
  if (conflictType === "validation_error") return "Validation Error";
  return "Field Conflict";
}

function formatConflictEventLabel(
  eventType: SyncConflictEventRecord["event_type"],
) {
  if (eventType === "detected") return "Detected";
  if (eventType === "resolved") return "Resolved";
  if (eventType === "ignored") return "Ignored";
  if (eventType === "retried") return "Retried";
  return "Exported";
}

function formatPayloadJson(payloadJson: string | null): string {
  if (!payloadJson) return "(empty)";
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return payloadJson;
  }
}

function buildRestoreConfirmationMessage(preflight: BackupRestorePreflight) {
  const forceReasonSegments: string[] = [];
  if (preflight.pending_outbox_changes > 0) {
    forceReasonSegments.push(
      `${preflight.pending_outbox_changes} pending outbox change(s)`,
    );
  }
  if (preflight.open_conflicts > 0) {
    forceReasonSegments.push(`${preflight.open_conflicts} open conflict(s)`);
  }

  if (forceReasonSegments.length === 0) {
    return "Restore will replace all local data and reset sync state (outbox/conflicts). Continue?";
  }

  return [
    `Restore requires force because ${forceReasonSegments.join(" and ")} currently exist.`,
    "Force restore will discard pending outbox changes and clear open conflicts.",
    "Continue with force restore?",
  ].join("\n");
}

function buildRestoreForceReasonLabel(
  preflight: BackupRestorePreflight,
): string {
  const reasonSegments: string[] = [];
  if (preflight.pending_outbox_changes > 0) {
    reasonSegments.push("pending outbox changes");
  }
  if (preflight.open_conflicts > 0) {
    reasonSegments.push("open conflicts");
  }
  if (reasonSegments.length === 0) {
    return "active restore guardrails";
  }
  if (reasonSegments.length === 1) {
    return reasonSegments[0];
  }
  return `${reasonSegments[0]} and ${reasonSegments[1]}`;
}

export function ReminderSettings({
  remindersEnabled,
  onRemindersEnabledChange,
  syncStatus,
  syncStatusLabel,
  syncLastSyncedAt,
  syncLastError,
  syncIsRunning,
  syncHasTransport,
  onSyncNow,
  onRetryLastFailedSync,
  syncProvider,
  syncProviderConfig,
  syncProviderLoading,
  syncProviderSaving,
  onSaveSyncProviderSettings,
  syncPushUrl,
  syncPullUrl,
  syncConfigSaving,
  onSaveSyncSettings,
  syncAutoIntervalSeconds,
  syncBackgroundIntervalSeconds,
  syncPushLimit,
  syncPullLimit,
  syncMaxPullPages,
  syncRuntimePreset,
  syncRuntimeProfileSetting,
  syncRuntimeProfileLoading,
  syncDiagnostics,
  syncRuntimeSaving,
  onSaveSyncRuntimeSettings,
  syncConflicts,
  syncConflictsLoading,
  syncConflictResolving,
  onResolveSyncConflict,
  backupRestoreLatestBusy,
  backupImportBusy,
  onQueueRestoreLatestBackup,
  onQueueImportBackup,
}: ReminderSettingsProps) {
  const [permissionState, setPermissionState] =
    useState<NotificationPermissionState>("unknown");
  const [isBusy, setIsBusy] = useState(false);
  const [permissionFeedback, setPermissionFeedback] = useState<string | null>(
    null,
  );
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [syncProviderDraft, setSyncProviderDraft] =
    useState<SyncProvider>("provider_neutral");
  const [syncPushUrlDraft, setSyncPushUrlDraft] = useState<string>("");
  const [syncPullUrlDraft, setSyncPullUrlDraft] = useState<string>("");
  const [syncRuntimeProfileDraft, setSyncRuntimeProfileDraft] =
    useState<SyncRuntimeProfileSetting>("desktop");
  const [syncAutoIntervalDraft, setSyncAutoIntervalDraft] =
    useState<string>("");
  const [syncBackgroundIntervalDraft, setSyncBackgroundIntervalDraft] =
    useState<string>("");
  const [syncPushLimitDraft, setSyncPushLimitDraft] = useState<string>("");
  const [syncPullLimitDraft, setSyncPullLimitDraft] = useState<string>("");
  const [syncMaxPullPagesDraft, setSyncMaxPullPagesDraft] =
    useState<string>("");
  const [syncConfigFeedback, setSyncConfigFeedback] = useState<string | null>(
    null,
  );
  const [syncConfigError, setSyncConfigError] = useState<string | null>(null);
  const [syncProviderFeedback, setSyncProviderFeedback] = useState<
    string | null
  >(null);
  const [syncProviderError, setSyncProviderError] = useState<string | null>(
    null,
  );
  const [syncRuntimeFeedback, setSyncRuntimeFeedback] = useState<string | null>(
    null,
  );
  const [syncRuntimeError, setSyncRuntimeError] = useState<string | null>(null);
  const [conflictFeedback, setConflictFeedback] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(
    null,
  );
  const [manualMergeConflictId, setManualMergeConflictId] = useState<
    string | null
  >(null);
  const [manualMergeDraft, setManualMergeDraft] = useState("");
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const backupRestorePreflight = useBackupRestorePreflight();
  const exportBackup = useExportBackup();
  const exportSyncConflicts = useExportSyncConflictReport();
  const isBackupBusy =
    exportBackup.isPending || backupImportBusy || backupRestoreLatestBusy;
  const selectedConflict =
    syncConflicts.find((conflict) => conflict.id === selectedConflictId) ??
    null;
  const manualMergeConflict =
    syncConflicts.find((conflict) => conflict.id === manualMergeConflictId) ??
    null;
  const {
    data: selectedConflictEvents = [],
    isLoading: isConflictEventsLoading,
  } = useSyncConflictEvents(selectedConflict?.id, 100);
  const syncConflictObservability = useSyncConflictObservability();
  const conflictObservability = syncConflictObservability.data;
  const backupPreflight = backupRestorePreflight.data;
  const selectedProviderCapability = useMemo(
    () =>
      SYNC_PROVIDER_CAPABILITIES[syncProviderDraft] ??
      SYNC_PROVIDER_CAPABILITIES.provider_neutral,
    [syncProviderDraft],
  );
  const runtimeDraftNumbers = useMemo(
    () => ({
      autoSyncIntervalSeconds: parseIntegerDraft(syncAutoIntervalDraft),
      backgroundSyncIntervalSeconds: parseIntegerDraft(
        syncBackgroundIntervalDraft,
      ),
      pushLimit: parseIntegerDraft(syncPushLimitDraft),
      pullLimit: parseIntegerDraft(syncPullLimitDraft),
      maxPullPages: parseIntegerDraft(syncMaxPullPagesDraft),
    }),
    [
      syncAutoIntervalDraft,
      syncBackgroundIntervalDraft,
      syncPushLimitDraft,
      syncPullLimitDraft,
      syncMaxPullPagesDraft,
    ],
  );
  const runtimeInlineError = useMemo(() => {
    const autoSyncIntervalSeconds = runtimeDraftNumbers.autoSyncIntervalSeconds;
    const backgroundSyncIntervalSeconds =
      runtimeDraftNumbers.backgroundSyncIntervalSeconds;
    const pushLimit = runtimeDraftNumbers.pushLimit;
    const pullLimit = runtimeDraftNumbers.pullLimit;
    const maxPullPages = runtimeDraftNumbers.maxPullPages;

    if (
      autoSyncIntervalSeconds === null ||
      backgroundSyncIntervalSeconds === null ||
      pushLimit === null ||
      pullLimit === null ||
      maxPullPages === null
    ) {
      return "All runtime fields must be valid integers.";
    }
    if (autoSyncIntervalSeconds < 15 || autoSyncIntervalSeconds > 3600) {
      return "Foreground interval must be between 15 and 3600 seconds.";
    }
    if (
      backgroundSyncIntervalSeconds < 30 ||
      backgroundSyncIntervalSeconds > 7200
    ) {
      return "Background interval must be between 30 and 7200 seconds.";
    }
    if (backgroundSyncIntervalSeconds < autoSyncIntervalSeconds) {
      return "Background interval must be >= foreground interval.";
    }
    if (pushLimit < 20 || pushLimit > 500) {
      return "Push limit must be between 20 and 500.";
    }
    if (pullLimit < 20 || pullLimit > 500) {
      return "Pull limit must be between 20 and 500.";
    }
    if (maxPullPages < 1 || maxPullPages > 20) {
      return "Max pull pages must be between 1 and 20.";
    }

    return null;
  }, [runtimeDraftNumbers]);
  const runtimeImpactHint = useMemo(() => {
    const foreground = runtimeDraftNumbers.autoSyncIntervalSeconds ?? 60;
    const background = runtimeDraftNumbers.backgroundSyncIntervalSeconds ?? 300;
    const loadPerCycle =
      (runtimeDraftNumbers.pushLimit ?? 200) +
      (runtimeDraftNumbers.pullLimit ?? 200) *
        Math.max(1, runtimeDraftNumbers.maxPullPages ?? 5);

    if (foreground <= 30 || background <= 120) {
      return "High battery/network impact: short intervals can drain battery faster.";
    }
    if (loadPerCycle >= 1200) {
      return "High data load: large push/pull limits can increase transfer cost.";
    }
    if (foreground <= 60 || background <= 300) {
      return "Balanced profile: good responsiveness with moderate resource usage.";
    }
    return "Low impact profile: fewer sync cycles with slower propagation.";
  }, [runtimeDraftNumbers]);

  useEffect(() => {
    void refreshPermissionState(setPermissionState);
  }, []);

  useEffect(() => {
    setSyncProviderDraft(syncProvider);
  }, [syncProvider]);

  useEffect(() => {
    setSyncPushUrlDraft(syncPushUrl ?? "");
  }, [syncPushUrl]);

  useEffect(() => {
    setSyncPullUrlDraft(syncPullUrl ?? "");
  }, [syncPullUrl]);

  useEffect(() => {
    setSyncRuntimeProfileDraft(syncRuntimeProfileSetting);
  }, [syncRuntimeProfileSetting]);

  useEffect(() => {
    setSyncAutoIntervalDraft(String(syncAutoIntervalSeconds));
  }, [syncAutoIntervalSeconds]);

  useEffect(() => {
    setSyncBackgroundIntervalDraft(String(syncBackgroundIntervalSeconds));
  }, [syncBackgroundIntervalSeconds]);

  useEffect(() => {
    setSyncPushLimitDraft(String(syncPushLimit));
  }, [syncPushLimit]);

  useEffect(() => {
    setSyncPullLimitDraft(String(syncPullLimit));
  }, [syncPullLimit]);

  useEffect(() => {
    setSyncMaxPullPagesDraft(String(syncMaxPullPages));
  }, [syncMaxPullPages]);

  useEffect(() => {
    if (syncConflicts.length === 0) {
      setSelectedConflictId(null);
      return;
    }

    if (!selectedConflictId) {
      setSelectedConflictId(syncConflicts[0].id);
      return;
    }

    const stillExists = syncConflicts.some(
      (conflict) => conflict.id === selectedConflictId,
    );
    if (!stillExists) {
      setSelectedConflictId(syncConflicts[0].id);
    }
  }, [selectedConflictId, syncConflicts]);

  useEffect(() => {
    if (!manualMergeConflictId) return;
    const stillExists = syncConflicts.some(
      (conflict) => conflict.id === manualMergeConflictId,
    );
    if (stillExists) return;
    setManualMergeConflictId(null);
    setManualMergeDraft("");
  }, [manualMergeConflictId, syncConflicts]);

  const handleRequestPermission = async () => {
    setIsBusy(true);
    setPermissionFeedback(null);
    try {
      const nextState = await requestNotificationPermissionAccess();
      setPermissionState(nextState);
      setPermissionFeedback(
        nextState === "granted"
          ? "Notifications are enabled."
          : "Permission is not granted. You may need OS settings to allow notifications.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetPermissionAndHistory = async () => {
    setIsBusy(true);
    setPermissionFeedback(null);
    try {
      const nextState = await resetReminderPermissionAndHistory();
      setPermissionState(nextState);
      setPermissionFeedback(
        "Permission cache and reminder history were reset. Existing reminders can notify again.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRefreshPermission = async () => {
    setIsBusy(true);
    setPermissionFeedback(null);
    try {
      await refreshPermissionState(setPermissionState);
    } finally {
      setIsBusy(false);
    }
  };

  const loadLatestRestorePreflight =
    async (): Promise<BackupRestorePreflight | null> => {
      const refreshed = await backupRestorePreflight.refetch();
      return refreshed.data ?? backupRestorePreflight.data ?? null;
    };

  const confirmRestoreWithPreflight = async (): Promise<{
    force: boolean;
  } | null> => {
    const preflight = await loadLatestRestorePreflight();
    if (!preflight) {
      setBackupError("Restore preflight is unavailable. Please try again.");
      return null;
    }

    const confirmMessage = buildRestoreConfirmationMessage(preflight);
    if (!window.confirm(confirmMessage)) {
      return null;
    }

    return {
      force: preflight.requires_force_restore,
    };
  };

  const handleExportBackup = async () => {
    setBackupError(null);
    setBackupFeedback(null);
    try {
      const payload = await exportBackup.mutateAsync();
      const backupText = JSON.stringify(payload, null, 2);
      const blob = new Blob([backupText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const safeTimestamp = payload.exported_at.replace(/[:.]/g, "-");
      const filename = `solostack-backup-${safeTimestamp}.json`;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);

      setBackupFeedback(
        `Backup exported successfully (${payload.data.tasks.length} tasks, ${payload.data.projects.length} projects).`,
      );
    } catch (error) {
      setBackupError(getErrorMessage(error));
    }
  };

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    setBackupError(null);
    setBackupFeedback(null);
    try {
      const confirmation = await confirmRestoreWithPreflight();
      if (!confirmation) return;

      const fileContent = await selectedFile.text();
      const parsedPayload = JSON.parse(fileContent) as unknown;
      await onQueueImportBackup({
        payload: parsedPayload,
        force: confirmation.force,
        sourceName: selectedFile.name,
      });
      setBackupFeedback(
        "Restore from file queued. Undo is available for 5 seconds.",
      );
    } catch (error) {
      setBackupError(getErrorMessage(error));
    }
  };

  const handleRestoreLatestBackup = async () => {
    setBackupError(null);
    setBackupFeedback(null);

    try {
      const confirmation = await confirmRestoreWithPreflight();
      if (!confirmation) return;

      await onQueueRestoreLatestBackup({
        force: confirmation.force,
      });
      setBackupFeedback(
        "Restore latest backup queued. Undo is available for 5 seconds.",
      );
    } catch (error) {
      setBackupError(getErrorMessage(error));
    }
  };

  const handleOpenBackupFilePicker = () => {
    if (isBackupBusy) return;
    backupInputRef.current?.click();
  };

  const handleSaveSyncSettings = async () => {
    setSyncConfigFeedback(null);
    setSyncConfigError(null);

    const nextPushUrl = normalizeUrlDraft(syncPushUrlDraft);
    const nextPullUrl = normalizeUrlDraft(syncPullUrlDraft);
    const hasPushUrl = Boolean(nextPushUrl);
    const hasPullUrl = Boolean(nextPullUrl);

    if (hasPushUrl !== hasPullUrl) {
      setSyncConfigError(
        "Set both push URL and pull URL, or leave both empty.",
      );
      return;
    }

    if (nextPushUrl && !isValidHttpUrl(nextPushUrl)) {
      setSyncConfigError("Push URL must be a valid http(s) URL.");
      return;
    }
    if (nextPullUrl && !isValidHttpUrl(nextPullUrl)) {
      setSyncConfigError("Pull URL must be a valid http(s) URL.");
      return;
    }

    try {
      await onSaveSyncSettings({
        push_url: nextPushUrl,
        pull_url: nextPullUrl,
      });
      setSyncConfigFeedback(
        nextPushUrl
          ? "Sync endpoints were saved."
          : "Sync endpoints were cleared. App is now local-only.",
      );
    } catch (error) {
      setSyncConfigError(getErrorMessage(error));
    }
  };

  const applyRuntimeDefaults = (profile: SyncRuntimeProfileSetting) => {
    const defaults = getRuntimeDefaultsByProfile(profile, syncRuntimePreset);
    setSyncRuntimeProfileDraft(profile);
    setSyncRuntimeFeedback(null);
    setSyncRuntimeError(null);
    setSyncAutoIntervalDraft(String(defaults.auto_sync_interval_seconds));
    setSyncBackgroundIntervalDraft(
      String(defaults.background_sync_interval_seconds),
    );
    setSyncPushLimitDraft(String(defaults.push_limit));
    setSyncPullLimitDraft(String(defaults.pull_limit));
    setSyncMaxPullPagesDraft(String(defaults.max_pull_pages));
  };

  const handleSaveSyncProvider = async () => {
    setSyncProviderFeedback(null);
    setSyncProviderError(null);

    const providerCapability =
      SYNC_PROVIDER_CAPABILITIES[syncProviderDraft] ??
      SYNC_PROVIDER_CAPABILITIES.provider_neutral;
    const nextProviderConfig: Record<string, unknown> = {
      ...(syncProviderConfig ?? {}),
      endpoint_mode: providerCapability.endpointMode,
      auth_requirement: providerCapability.authRequirement,
    };

    try {
      await onSaveSyncProviderSettings({
        provider: syncProviderDraft,
        provider_config: nextProviderConfig,
      });
      setSyncProviderFeedback("Sync provider was saved.");
    } catch (error) {
      setSyncProviderError(getErrorMessage(error));
    }
  };

  const handleApplyDesktopSyncPreset = () => {
    applyRuntimeDefaults("desktop");
  };

  const handleApplyMobileSyncPreset = () => {
    applyRuntimeDefaults("mobile_beta");
  };

  const handleResetRecommendedRuntime = () => {
    const recommendedProfile =
      syncRuntimePreset === "mobile" ? "mobile_beta" : "desktop";
    applyRuntimeDefaults(recommendedProfile);
    setSyncRuntimeFeedback(
      `Runtime reset to recommended ${getRuntimeProfileLabel(
        recommendedProfile,
      )} profile.`,
    );
  };

  const handleSaveSyncRuntimeProfile = async () => {
    setSyncRuntimeFeedback(null);
    setSyncRuntimeError(null);

    if (runtimeInlineError) {
      setSyncRuntimeError(runtimeInlineError);
      return;
    }

    const autoSyncIntervalSeconds = runtimeDraftNumbers.autoSyncIntervalSeconds;
    const backgroundSyncIntervalSeconds =
      runtimeDraftNumbers.backgroundSyncIntervalSeconds;
    const pushLimit = runtimeDraftNumbers.pushLimit;
    const pullLimit = runtimeDraftNumbers.pullLimit;
    const maxPullPages = runtimeDraftNumbers.maxPullPages;

    if (
      autoSyncIntervalSeconds === null ||
      backgroundSyncIntervalSeconds === null ||
      pushLimit === null ||
      pullLimit === null ||
      maxPullPages === null
    ) {
      setSyncRuntimeError("Runtime values are incomplete.");
      return;
    }

    try {
      await onSaveSyncRuntimeSettings({
        auto_sync_interval_seconds: autoSyncIntervalSeconds,
        background_sync_interval_seconds: backgroundSyncIntervalSeconds,
        push_limit: pushLimit,
        pull_limit: pullLimit,
        max_pull_pages: maxPullPages,
        runtime_profile: syncRuntimeProfileDraft,
      });
      setSyncRuntimeFeedback(
        `Sync runtime profile (${getRuntimeProfileLabel(
          syncRuntimeProfileDraft,
        )}) was saved.`,
      );
    } catch (error) {
      setSyncRuntimeError(getErrorMessage(error));
    }
  };

  const handleResolveConflict = async (
    conflictId: string,
    strategy: SyncConflictResolutionStrategy,
    resolutionPayload?: Record<string, unknown> | null,
  ): Promise<boolean> => {
    setConflictFeedback(null);
    setConflictError(null);
    try {
      await onResolveSyncConflict({
        conflict_id: conflictId,
        strategy,
        resolution_payload: resolutionPayload ?? null,
      });
      setConflictFeedback(
        strategy === "retry"
          ? "Conflict retry queued. Undo is available for 5 seconds."
          : "Conflict resolution queued. Undo is available for 5 seconds.",
      );
      return true;
    } catch (error) {
      setConflictError(getErrorMessage(error));
      return false;
    }
  };

  const handleRetryConflict = async (conflictId: string) => {
    if (
      !window.confirm(
        "Retry will re-queue this conflict in the next sync cycle. Continue?",
      )
    ) {
      return;
    }

    await handleResolveConflict(conflictId, "retry");
  };

  const handleOpenManualMergeEditor = (conflict: SyncConflictRecord) => {
    setConflictError(null);
    setConflictFeedback(null);
    setManualMergeConflictId(conflict.id);
    setManualMergeDraft(buildManualMergeInitialText(conflict));
  };

  const handleCancelManualMerge = () => {
    setManualMergeConflictId(null);
    setManualMergeDraft("");
  };

  const handleSubmitManualMerge = async () => {
    if (!manualMergeConflict) return;

    const normalizedDraft = normalizeManualMergeText(manualMergeDraft);
    if (!normalizedDraft) {
      setConflictError("Merged content must not be empty.");
      return;
    }

    const isSuccess = await handleResolveConflict(
      manualMergeConflict.id,
      "manual_merge",
      buildManualMergeResolutionPayload({
        conflict: manualMergeConflict,
        mergedText: normalizedDraft,
        source: "settings_conflict_center",
      }),
    );
    if (!isSuccess) return;

    handleCancelManualMerge();
  };

  const handleExportConflictReport = async () => {
    setConflictFeedback(null);
    setConflictError(null);

    try {
      const payload = await exportSyncConflicts.mutateAsync({
        status: "all",
        limit: 1000,
        eventsPerConflict: 100,
      });
      const reportText = JSON.stringify(payload, null, 2);
      const blob = new Blob([reportText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const safeTimestamp = payload.exported_at.replace(/[:.]/g, "-");
      const filename = `solostack-conflicts-${safeTimestamp}.json`;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);

      setConflictFeedback(
        `Conflict report exported (${payload.total_conflicts} conflict record(s)).`,
      );
    } catch (error) {
      setConflictError(getErrorMessage(error));
    }
  };

  return (
    <div className="settings-wrap">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">
          Control reminders, notification access, and local data safety
        </p>
      </div>

      <section className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Bell size={16} />
          </div>
          <div>
            <h2 className="settings-card-title">Task Reminders</h2>
            <p className="settings-card-desc">
              Turn reminder notifications on or off globally.
            </p>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <p className="settings-row-title">Enable reminders</p>
            <p className="settings-row-subtitle">
              When enabled, tasks with due reminders can trigger desktop
              notifications.
            </p>
          </div>
          <button
            type="button"
            className={`toggle-btn${remindersEnabled ? " enabled" : ""}`}
            onClick={() => onRemindersEnabledChange(!remindersEnabled)}
            aria-pressed={remindersEnabled}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <ShieldCheck size={16} />
          </div>
          <div>
            <h2 className="settings-card-title">Notification Permission</h2>
            <p className="settings-card-desc">
              Check current permission and reset permission cache/history.
            </p>
          </div>
        </div>

        <div className="permission-pill">
          {permissionState === "granted" ? (
            <>
              <CheckCircle2 size={14} />
              Granted
            </>
          ) : permissionState === "denied" ? (
            <>
              <XCircle size={14} />
              Denied
            </>
          ) : (
            <>
              <HelpCircle size={14} />
              Unknown
            </>
          )}
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={() => void handleRequestPermission()}
            disabled={isBusy}
          >
            <Bell size={14} />
            Request Permission
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={() => void handleRefreshPermission()}
            disabled={isBusy}
          >
            <RefreshCw size={14} />
            Refresh Status
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-danger"
            onClick={() => void handleResetPermissionAndHistory()}
            disabled={isBusy}
          >
            <RotateCcw size={14} />
            Reset Permission + History
          </button>
        </div>

        {permissionFeedback && (
          <p className="settings-feedback">{permissionFeedback}</p>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Cloud size={16} />
          </div>
          <div>
            <h2 className="settings-card-title">Sync</h2>
            <p className="settings-card-desc">
              Manually sync now and check latest sync health.
            </p>
          </div>
        </div>

        <div
          className={`sync-pill sync-pill-${syncStatus.toLowerCase()}`}
          role="status"
          aria-live="polite"
        >
          {renderSyncStatusIcon(syncStatus)}
          <span>{syncStatusLabel}</span>
        </div>

        <div className="sync-meta">
          <p className="settings-row-subtitle">
            Last synced: {formatSyncDateTime(syncLastSyncedAt)}
          </p>
          {syncLastError && (
            <p className="settings-feedback settings-feedback-error">
              {syncLastError}
            </p>
          )}
          {syncStatus === "LOCAL_ONLY" && (
            <p className="settings-feedback">
              Local-only mode is active. Server is not required for
              single-device usage.
            </p>
          )}
          {!syncHasTransport && syncStatus !== "LOCAL_ONLY" && (
            <p className="settings-feedback settings-feedback-warn">
              To sync across devices, set both endpoints below.
            </p>
          )}
        </div>

        <div className="sync-conflicts">
          <div className="sync-conflicts-head">
            <p className="settings-row-title">Conflict Center</p>
            <button
              type="button"
              className="settings-btn"
              onClick={() => void handleExportConflictReport()}
              disabled={exportSyncConflicts.isPending}
            >
              <Download size={14} />
              {exportSyncConflicts.isPending ? "Exporting..." : "Export Report"}
            </button>
          </div>
          {syncConflictsLoading ? (
            <p className="settings-row-subtitle">Loading conflicts...</p>
          ) : syncConflicts.length === 0 ? (
            <p className="settings-row-subtitle">No open conflicts.</p>
          ) : (
            <div className="sync-conflict-list">
              {syncConflicts.map((conflict) => (
                <div className="sync-conflict-item" key={conflict.id}>
                  <div className="sync-conflict-item-head">
                    <span className="sync-conflict-type">
                      {formatConflictTypeLabel(conflict.conflict_type)}
                    </span>
                    <span className="sync-conflict-entity">
                      {conflict.entity_type}:{conflict.entity_id}
                    </span>
                    {selectedConflictId === conflict.id && (
                      <span className="sync-conflict-selected">Selected</span>
                    )}
                  </div>
                  <p className="sync-conflict-message">{conflict.message}</p>
                  <p className="settings-row-subtitle">
                    Detected: {formatSyncDateTime(conflict.detected_at)}
                  </p>
                  <div className="settings-actions">
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() =>
                        void handleResolveConflict(conflict.id, "keep_local")
                      }
                      disabled={syncConflictResolving}
                    >
                      Keep Local
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() =>
                        void handleResolveConflict(conflict.id, "keep_remote")
                      }
                      disabled={syncConflictResolving}
                    >
                      Keep Remote
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() => void handleRetryConflict(conflict.id)}
                      disabled={syncConflictResolving}
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() => handleOpenManualMergeEditor(conflict)}
                      disabled={syncConflictResolving}
                    >
                      Manual Merge
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() => setSelectedConflictId(conflict.id)}
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedConflict && (
            <div className="sync-conflict-detail">
              <p className="settings-row-title">Conflict Detail</p>
              <p className="settings-row-subtitle">
                {selectedConflict.entity_type}:{selectedConflict.entity_id} ·{" "}
                {formatConflictTypeLabel(selectedConflict.conflict_type)}
              </p>
              <div className="sync-conflict-payload-grid">
                <div>
                  <span className="settings-field-label">Local payload</span>
                  <pre className="sync-conflict-payload">
                    {formatPayloadJson(selectedConflict.local_payload_json)}
                  </pre>
                </div>
                <div>
                  <span className="settings-field-label">Remote payload</span>
                  <pre className="sync-conflict-payload">
                    {formatPayloadJson(selectedConflict.remote_payload_json)}
                  </pre>
                </div>
              </div>

              <p className="settings-row-title sync-conflict-timeline-title">
                Timeline
              </p>
              {isConflictEventsLoading ? (
                <p className="settings-row-subtitle">Loading timeline...</p>
              ) : selectedConflictEvents.length === 0 ? (
                <p className="settings-row-subtitle">No events yet.</p>
              ) : (
                <div className="sync-conflict-timeline">
                  {selectedConflictEvents.map((event) => (
                    <div className="sync-conflict-timeline-item" key={event.id}>
                      <span className="sync-conflict-event-pill">
                        {formatConflictEventLabel(event.event_type)}
                      </span>
                      <span className="settings-row-subtitle">
                        {formatSyncDateTime(event.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {manualMergeConflict && (
            <ManualMergeEditor
              conflict={manualMergeConflict}
              draft={manualMergeDraft}
              isSaving={syncConflictResolving}
              onDraftChange={setManualMergeDraft}
              onCancel={handleCancelManualMerge}
              onSubmit={() => void handleSubmitManualMerge()}
            />
          )}

          {conflictFeedback && (
            <p className="settings-feedback">{conflictFeedback}</p>
          )}
          {conflictError && (
            <p className="settings-feedback settings-feedback-error">
              {conflictError}
            </p>
          )}
        </div>

        <div className="sync-provider-card">
          <div className="sync-provider-head">
            <p className="settings-row-title">Sync Provider</p>
            <p className="settings-row-subtitle">
              Select provider from UI. Core sync contract remains
              provider-neutral.
            </p>
          </div>

          <div className="sync-provider-grid">
            <label className="settings-field">
              <span className="settings-field-label">Provider</span>
              <select
                className="settings-input settings-select"
                value={syncProviderDraft}
                onChange={(event) => {
                  setSyncProviderFeedback(null);
                  setSyncProviderError(null);
                  setSyncProviderDraft(event.target.value as SyncProvider);
                }}
                disabled={syncProviderSaving || syncProviderLoading}
              >
                {Object.entries(SYNC_PROVIDER_CAPABILITIES).map(
                  ([providerKey, capability]) => (
                    <option value={providerKey} key={providerKey}>
                      {capability.label}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <div className="sync-provider-capability-card">
            <p className="settings-row-subtitle">
              {selectedProviderCapability.summary}
            </p>
            <p className="settings-row-subtitle">
              Auth requirement: {selectedProviderCapability.authRequirement}
            </p>
            <p className="settings-row-subtitle">
              Endpoint mode:{" "}
              {selectedProviderCapability.endpointMode === "managed"
                ? "Managed"
                : "Custom"}
            </p>
            <div className="sync-provider-warning-list">
              {selectedProviderCapability.warnings.map((warning) => (
                <p className="settings-row-subtitle" key={warning}>
                  - {warning}
                </p>
              ))}
            </div>
          </div>

          <div className="settings-actions">
            <button
              type="button"
              className="settings-btn settings-btn-primary"
              onClick={() => void handleSaveSyncProvider()}
              disabled={syncProviderSaving || syncProviderLoading}
            >
              {syncProviderSaving ? "Saving..." : "Save Provider"}
            </button>
          </div>

          {syncProviderFeedback && (
            <p className="settings-feedback">{syncProviderFeedback}</p>
          )}
          {syncProviderError && (
            <p className="settings-feedback settings-feedback-error">
              {syncProviderError}
            </p>
          )}
        </div>

        <p className="settings-row-subtitle">
          Endpoint mode:{" "}
          {selectedProviderCapability.endpointMode === "managed"
            ? "Managed provider selected (custom URLs are still used in current build)."
            : "Custom endpoints required."}
        </p>

        <div className="sync-endpoint-grid">
          <label className="settings-field">
            <span className="settings-field-label">Push URL</span>
            <input
              className="settings-input"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://sync.example.com/v1/sync/push"
              value={syncPushUrlDraft}
              onChange={(event) => setSyncPushUrlDraft(event.target.value)}
              disabled={syncConfigSaving || syncProviderLoading}
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Pull URL</span>
            <input
              className="settings-input"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://sync.example.com/v1/sync/pull"
              value={syncPullUrlDraft}
              onChange={(event) => setSyncPullUrlDraft(event.target.value)}
              disabled={syncConfigSaving || syncProviderLoading}
            />
          </label>
        </div>

        <div className="sync-runtime-card">
          <div className="sync-runtime-head">
            <p className="settings-row-title">Sync Runtime Profile</p>
            <p className="settings-row-subtitle">
              Tune sync behavior for desktop/mobile beta workloads.
            </p>
          </div>
          <div className="sync-runtime-grid">
            <label className="settings-field">
              <span className="settings-field-label">Profile</span>
              <select
                className="settings-input settings-select"
                value={syncRuntimeProfileDraft}
                onChange={(event) => {
                  setSyncRuntimeFeedback(null);
                  setSyncRuntimeError(null);
                  setSyncRuntimeProfileDraft(
                    event.target.value as SyncRuntimeProfileSetting,
                  );
                }}
                disabled={syncRuntimeSaving || syncRuntimeProfileLoading}
              >
                {SYNC_RUNTIME_PROFILE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span className="settings-field-label">
                Foreground Interval (s)
              </span>
              <input
                className="settings-input"
                type="number"
                min={15}
                max={3600}
                step={1}
                value={syncAutoIntervalDraft}
                onChange={(event) => {
                  setSyncRuntimeFeedback(null);
                  setSyncRuntimeError(null);
                  setSyncAutoIntervalDraft(event.target.value);
                  setSyncRuntimeProfileDraft("custom");
                }}
                disabled={syncRuntimeSaving}
              />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">
                Background Interval (s)
              </span>
              <input
                className="settings-input"
                type="number"
                min={30}
                max={7200}
                step={1}
                value={syncBackgroundIntervalDraft}
                onChange={(event) => {
                  setSyncRuntimeFeedback(null);
                  setSyncRuntimeError(null);
                  setSyncBackgroundIntervalDraft(event.target.value);
                  setSyncRuntimeProfileDraft("custom");
                }}
                disabled={syncRuntimeSaving}
              />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">Push Limit</span>
              <input
                className="settings-input"
                type="number"
                min={20}
                max={500}
                step={1}
                value={syncPushLimitDraft}
                onChange={(event) => {
                  setSyncRuntimeFeedback(null);
                  setSyncRuntimeError(null);
                  setSyncPushLimitDraft(event.target.value);
                  setSyncRuntimeProfileDraft("custom");
                }}
                disabled={syncRuntimeSaving}
              />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">Pull Limit</span>
              <input
                className="settings-input"
                type="number"
                min={20}
                max={500}
                step={1}
                value={syncPullLimitDraft}
                onChange={(event) => {
                  setSyncRuntimeFeedback(null);
                  setSyncRuntimeError(null);
                  setSyncPullLimitDraft(event.target.value);
                  setSyncRuntimeProfileDraft("custom");
                }}
                disabled={syncRuntimeSaving}
              />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">Max Pull Pages</span>
              <input
                className="settings-input"
                type="number"
                min={1}
                max={20}
                step={1}
                value={syncMaxPullPagesDraft}
                onChange={(event) => {
                  setSyncRuntimeFeedback(null);
                  setSyncRuntimeError(null);
                  setSyncMaxPullPagesDraft(event.target.value);
                  setSyncRuntimeProfileDraft("custom");
                }}
                disabled={syncRuntimeSaving}
              />
            </label>
          </div>
          <p className="settings-row-subtitle">{runtimeImpactHint}</p>
          {runtimeInlineError && (
            <p className="settings-feedback settings-feedback-error">
              {runtimeInlineError}
            </p>
          )}
          <div className="settings-actions">
            <button
              type="button"
              className="settings-btn"
              onClick={handleApplyDesktopSyncPreset}
              disabled={syncRuntimeSaving}
            >
              Desktop Preset
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={handleApplyMobileSyncPreset}
              disabled={syncRuntimeSaving}
            >
              Mobile Beta Preset
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={handleResetRecommendedRuntime}
              disabled={syncRuntimeSaving}
            >
              Reset Recommended
            </button>
            <button
              type="button"
              className="settings-btn settings-btn-primary"
              onClick={() => void handleSaveSyncRuntimeProfile()}
              disabled={syncRuntimeSaving}
            >
              {syncRuntimeSaving ? "Saving..." : "Save Runtime"}
            </button>
          </div>
          {syncRuntimeFeedback && (
            <p className="settings-feedback">{syncRuntimeFeedback}</p>
          )}
          {syncRuntimeError && (
            <p className="settings-feedback settings-feedback-error">
              {syncRuntimeError}
            </p>
          )}
          <div>
            <p className="settings-row-title">Sync Diagnostics (Session)</p>
            <p className="settings-row-subtitle">
              Runtime preset:{" "}
              {syncRuntimePreset === "mobile"
                ? "Mobile Beta (detected)"
                : "Desktop (detected)"}
            </p>
            <p className="settings-row-subtitle">
              Runtime profile: {getRuntimeProfileLabel(syncRuntimeProfileDraft)}
            </p>
            <p className="settings-row-subtitle">
              Provider (sync loop):{" "}
              {syncDiagnostics.selected_provider
                ? (SYNC_PROVIDER_CAPABILITIES[syncDiagnostics.selected_provider]
                    ?.label ?? syncDiagnostics.selected_provider)
                : "Not selected yet"}
            </p>
            <p className="settings-row-subtitle">
              Success rate: {syncDiagnostics.success_rate_percent.toFixed(1)}% (
              {syncDiagnostics.successful_cycles}/{syncDiagnostics.total_cycles}
              )
            </p>
            <p className="settings-row-subtitle">
              Last cycle duration:{" "}
              {formatDurationMs(syncDiagnostics.last_cycle_duration_ms)}
            </p>
            <p className="settings-row-subtitle">
              Average cycle duration:{" "}
              {formatDurationMs(syncDiagnostics.average_cycle_duration_ms)}
            </p>
            <p className="settings-row-subtitle">
              Failed cycles: {syncDiagnostics.failed_cycles} (streak:{" "}
              {syncDiagnostics.consecutive_failures})
            </p>
            <p className="settings-row-subtitle">
              Conflict cycles: {syncDiagnostics.conflict_cycles}
            </p>
            <p className="settings-row-subtitle">
              Provider selected events:{" "}
              {syncDiagnostics.provider_selected_events}
            </p>
            <p className="settings-row-subtitle">
              Runtime profile change events:{" "}
              {syncDiagnostics.runtime_profile_changed_events}
            </p>
            <p className="settings-row-subtitle">
              Validation rejected events:{" "}
              {syncDiagnostics.validation_rejected_events}
            </p>
            {syncDiagnostics.last_warning && (
              <p className="settings-row-subtitle">
                Last warning: {syncDiagnostics.last_warning}
              </p>
            )}
          </div>
          <div className="sync-observability-card">
            <p className="settings-row-title">Conflict Observability</p>
            {syncConflictObservability.isLoading ? (
              <p className="settings-row-subtitle">Loading counters...</p>
            ) : conflictObservability ? (
              <>
                <p className="settings-row-subtitle">
                  Total conflicts: {conflictObservability.total_conflicts}
                </p>
                <p className="settings-row-subtitle">
                  Open/Resolved/Ignored: {conflictObservability.open_conflicts}/
                  {conflictObservability.resolved_conflicts}/
                  {conflictObservability.ignored_conflicts}
                </p>
                <p className="settings-row-subtitle">
                  Resolution rate:{" "}
                  {conflictObservability.resolution_rate_percent.toFixed(1)}%
                </p>
                <p className="settings-row-subtitle">
                  Median time to resolve:{" "}
                  {formatResolutionDurationMs(
                    conflictObservability.median_resolution_time_ms,
                  )}
                </p>
                <p className="settings-row-subtitle">
                  Retried events: {conflictObservability.retried_events}
                </p>
                <p className="settings-row-subtitle">
                  Exported events: {conflictObservability.exported_events}
                </p>
                <p className="settings-row-subtitle">
                  Last detected:{" "}
                  {formatSyncDateTime(conflictObservability.latest_detected_at)}
                </p>
                <p className="settings-row-subtitle">
                  Last resolved:{" "}
                  {formatSyncDateTime(conflictObservability.latest_resolved_at)}
                </p>
              </>
            ) : (
              <p className="settings-row-subtitle">
                Conflict observability is unavailable.
              </p>
            )}
            {syncConflictObservability.isError && (
              <p className="settings-feedback settings-feedback-error">
                Unable to load conflict observability counters.
              </p>
            )}
          </div>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={() => void onSyncNow()}
            disabled={syncIsRunning || !syncHasTransport}
          >
            <RefreshCw size={14} className={syncIsRunning ? "sync-spin" : ""} />
            {syncIsRunning ? "Syncing..." : "Sync now"}
          </button>
          {syncLastError && (
            <button
              type="button"
              className="settings-btn"
              onClick={() => void onRetryLastFailedSync()}
              disabled={syncIsRunning || !syncHasTransport}
            >
              Retry Last Failed Sync
            </button>
          )}
          <button
            type="button"
            className="settings-btn"
            onClick={() => void handleSaveSyncSettings()}
            disabled={syncConfigSaving}
          >
            {syncConfigSaving ? "Saving..." : "Save Endpoints"}
          </button>
        </div>
        {syncConfigFeedback && (
          <p className="settings-feedback">{syncConfigFeedback}</p>
        )}
        {syncConfigError && (
          <p className="settings-feedback settings-feedback-error">
            {syncConfigError}
          </p>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Database size={16} />
          </div>
          <div>
            <h2 className="settings-card-title">Data Backup & Restore</h2>
            <p className="settings-card-desc">
              Export all local data to JSON and restore it later on this or
              another machine.
            </p>
          </div>
        </div>

        <p className="settings-row-subtitle settings-danger-text">
          Restore will replace all current local data.
        </p>

        {backupRestorePreflight.isLoading ? (
          <p className="settings-row-subtitle">Checking restore preflight...</p>
        ) : backupPreflight ? (
          <div className="backup-preflight">
            <p className="settings-row-subtitle">
              Latest internal backup:{" "}
              {formatSyncDateTime(backupPreflight.latest_backup_exported_at)}
            </p>
            <p className="settings-row-subtitle">
              Pending outbox changes: {backupPreflight.pending_outbox_changes}
            </p>
            <p className="settings-row-subtitle">
              Open conflicts: {backupPreflight.open_conflicts}
            </p>
            {backupPreflight.requires_force_restore && (
              <p className="settings-feedback settings-feedback-warn">
                Restore currently requires force because{" "}
                {buildRestoreForceReasonLabel(backupPreflight)} are present.
              </p>
            )}
          </div>
        ) : null}
        {backupRestorePreflight.isError && (
          <p className="settings-feedback settings-feedback-error">
            Unable to load restore preflight details.
          </p>
        )}

        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={() => void handleExportBackup()}
            disabled={isBackupBusy}
          >
            <Download size={14} />
            {exportBackup.isPending ? "Exporting..." : "Export Backup"}
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={() => void handleRestoreLatestBackup()}
            disabled={isBackupBusy || !backupPreflight?.has_latest_backup}
          >
            <RotateCcw size={14} />
            {backupRestoreLatestBusy
              ? "Restore Queued..."
              : "Restore Latest Backup"}
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={handleOpenBackupFilePicker}
            disabled={isBackupBusy}
          >
            <Upload size={14} />
            {backupImportBusy ? "Restore Queued..." : "Restore from File"}
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json"
            onChange={(event) => void handleImportBackup(event)}
            style={{ display: "none" }}
          />
        </div>

        {backupFeedback && (
          <p className="settings-feedback">{backupFeedback}</p>
        )}
        {backupError && (
          <p className="settings-feedback settings-feedback-error">
            {backupError}
          </p>
        )}
      </section>

      <style>{`
        .settings-wrap {
          max-width: 860px;
          margin: 0 auto;
          padding: 24px 28px;
        }
        .settings-header {
          margin-bottom: 20px;
        }
        .settings-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }
        .settings-subtitle {
          margin-top: 2px;
          font-size: 13px;
          color: var(--text-muted);
        }

        .settings-card {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
          padding: 16px;
          margin-bottom: 12px;
        }
        .settings-card-header {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 14px;
        }
        .settings-card-icon {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-subtle);
          color: var(--accent);
          flex-shrink: 0;
        }
        .settings-card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .settings-card-desc {
          margin-top: 2px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          padding: 12px 14px;
        }
        .settings-row-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .settings-row-subtitle {
          margin-top: 2px;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.45;
        }
        .settings-danger-text {
          margin-top: -2px;
          margin-bottom: 10px;
          color: var(--danger);
        }
        .backup-preflight {
          margin-bottom: 10px;
        }
        .toggle-btn {
          width: 44px;
          height: 24px;
          border-radius: 9999px;
          border: 1px solid var(--border-default);
          background: var(--bg-hover);
          display: inline-flex;
          align-items: center;
          padding: 2px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .toggle-btn.enabled {
          background: var(--accent);
          border-color: var(--accent);
        }
        .toggle-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          transform: translateX(0);
          transition: transform var(--duration) var(--ease);
        }
        .toggle-btn.enabled .toggle-thumb {
          transform: translateX(20px);
        }

        .permission-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          margin-bottom: 12px;
        }
        .settings-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .settings-btn {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          height: 32px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .settings-btn:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-strong);
        }
        .settings-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .settings-btn-primary {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }
        .settings-btn-primary:hover:not(:disabled) {
          background: var(--accent-hover);
          border-color: var(--accent-hover);
        }
        .settings-btn-danger {
          color: var(--danger);
          border-color: rgba(248, 113, 113, 0.35);
          background: var(--danger-subtle);
        }
        .settings-btn-danger:hover:not(:disabled) {
          border-color: var(--danger);
          background: rgba(248, 113, 113, 0.16);
          color: var(--danger);
        }
        .settings-feedback {
          margin-top: 10px;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.45;
        }
        .settings-feedback-error {
          color: var(--danger);
        }
        .settings-feedback-warn {
          color: #f59e0b;
        }
        .sync-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          margin-bottom: 10px;
        }
        .sync-pill-synced {
          color: #22c55e;
        }
        .sync-pill-syncing {
          color: var(--accent);
        }
        .sync-pill-offline {
          color: #f59e0b;
        }
        .sync-pill-conflict {
          color: var(--danger);
        }
        .sync-pill-local_only {
          color: var(--text-muted);
        }
        .sync-meta {
          margin-bottom: 8px;
        }
        .sync-conflicts {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          padding: 10px;
          margin-bottom: 10px;
        }
        .sync-conflicts-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .sync-conflict-list {
          display: grid;
          gap: 8px;
          margin-top: 6px;
        }
        .sync-conflict-item {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          padding: 10px;
        }
        .sync-conflict-item-head {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin-bottom: 4px;
        }
        .sync-conflict-type {
          display: inline-flex;
          align-items: center;
          border-radius: var(--radius-full);
          border: 1px solid rgba(248, 113, 113, 0.45);
          background: var(--danger-subtle);
          color: var(--danger);
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }
        .sync-conflict-entity {
          font-size: 11px;
          color: var(--text-muted);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        }
        .sync-conflict-selected {
          font-size: 11px;
          color: var(--accent);
          font-weight: 700;
        }
        .sync-conflict-message {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 6px;
          line-height: 1.45;
        }
        .sync-conflict-detail {
          margin-top: 10px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          padding: 10px;
        }
        .sync-conflict-payload-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 8px;
        }
        .sync-conflict-payload {
          margin-top: 4px;
          margin-bottom: 0;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 11px;
          line-height: 1.4;
          padding: 8px;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 180px;
          overflow: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        }
        .sync-conflict-timeline-title {
          margin-top: 10px;
        }
        .sync-conflict-timeline {
          display: grid;
          gap: 6px;
          margin-top: 6px;
        }
        .sync-conflict-timeline-item {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .sync-conflict-event-pill {
          display: inline-flex;
          align-items: center;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-default);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }
        .sync-runtime-card {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          padding: 10px;
          margin-bottom: 10px;
        }
        .sync-provider-card {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          padding: 10px;
          margin-bottom: 10px;
        }
        .sync-provider-head {
          margin-bottom: 8px;
        }
        .sync-provider-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 8px;
        }
        .sync-provider-capability-card {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          padding: 8px;
          margin-bottom: 10px;
        }
        .sync-provider-warning-list {
          display: grid;
          gap: 2px;
          margin-top: 4px;
        }
        .sync-observability-card {
          border-top: 1px solid var(--border-default);
          margin-top: 10px;
          padding-top: 10px;
        }
        .sync-runtime-head {
          margin-bottom: 8px;
        }
        .sync-runtime-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }
        .sync-endpoint-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }
        .settings-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .settings-field-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .settings-input {
          height: 34px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-primary);
          font-size: 12px;
          padding: 0 10px;
          font-family: inherit;
        }
        .settings-select {
          appearance: none;
        }
        .settings-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent);
        }
        .settings-input:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .sync-spin {
          animation: sync-rotate 0.8s linear infinite;
        }
        @keyframes sync-rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .settings-wrap {
            padding: 8px 10px;
          }
          .settings-row {
            align-items: flex-start;
          }
          .sync-conflicts-head {
            align-items: flex-start;
            flex-direction: column;
          }
          .sync-conflict-payload-grid {
            grid-template-columns: 1fr;
          }
          .sync-runtime-grid {
            grid-template-columns: 1fr;
          }
          .sync-provider-grid {
            grid-template-columns: 1fr;
          }
          .sync-endpoint-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

async function refreshPermissionState(
  setPermissionState: (state: NotificationPermissionState) => void,
): Promise<void> {
  const latestPermissionState = await getNotificationPermissionStatus();
  setPermissionState(latestPermissionState);
}
