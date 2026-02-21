import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Bell,
  ShieldCheck,
  HardDrive,
  Globe2,
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
  AppLocale,
  BackupImportResult,
  BackupRestorePreflight,
  ResolveSyncConflictInput,
  SyncConflictDefaultStrategy,
  SyncConflictEventRecord,
  SyncConflictRecord,
  SyncConflictResolutionStrategy,
  SyncConflictStrategyDefaults,
  SyncProvider,
  SyncRuntimeProfilePreset,
  SyncRuntimeProfileSetting,
  SyncSessionDiagnostics,
  SyncStatus,
  UpdateSyncConflictStrategyDefaultsInput,
  UpdateSyncEndpointSettingsInput,
  UpdateSyncProviderSettingsInput,
  UpdateSyncRuntimeSettingsInput,
} from "@/lib/types";
import { summarizeUnknownBackupPayload } from "@/lib/backup-summary";
import { translate, useI18n } from "@/lib/i18n";
import { localizeErrorMessage } from "@/lib/error-message";
import { ManualMergeEditor } from "./ManualMergeEditor";

interface ReminderSettingsProps {
  remindersEnabled: boolean;
  onRemindersEnabledChange: (enabled: boolean) => void;
  appLocale: AppLocale;
  appLocaleSaving: boolean;
  onSaveAppLocale: (locale: AppLocale) => Promise<void>;
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
  syncConflictStrategyDefaults: SyncConflictStrategyDefaults;
  syncConflictStrategyDefaultsLoading: boolean;
  syncConflictStrategyDefaultsSaving: boolean;
  onSaveSyncConflictStrategyDefaults: (
    input: UpdateSyncConflictStrategyDefaultsInput,
  ) => Promise<void>;
  focusTarget?: "sync_diagnostics" | "backup_preflight" | null;
  focusRequestId?: number;
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

const SYNC_RUNTIME_PROFILE_OPTION_VALUES: SyncRuntimeProfileSetting[] = [
  "desktop",
  "mobile_beta",
  "custom",
];

const SYNC_CONFLICT_DEFAULT_OPTION_VALUES: SyncConflictDefaultStrategy[] = [
  "keep_local",
  "keep_remote",
  "manual_merge",
];

const SYNC_CONFLICT_DEFAULT_TYPE_VALUES: Array<
  keyof SyncConflictStrategyDefaults
> = [
  "field_conflict",
  "delete_vs_update",
  "notes_collision",
  "validation_error",
];

function getSyncProviderCapabilities(
  locale: AppLocale,
): Record<SyncProvider, SyncProviderCapability> {
  return {
    provider_neutral: {
      label: translate(
        locale,
        "settings.sync.provider.capability.provider_neutral.label",
      ),
      summary: translate(
        locale,
        "settings.sync.provider.capability.provider_neutral.summary",
      ),
      authRequirement: translate(
        locale,
        "settings.sync.provider.capability.provider_neutral.auth",
      ),
      endpointMode: "custom",
      warnings: [
        translate(
          locale,
          "settings.sync.provider.capability.provider_neutral.warning1",
        ),
        translate(
          locale,
          "settings.sync.provider.capability.provider_neutral.warning2",
        ),
      ],
    },
    google_appdata: {
      label: translate(
        locale,
        "settings.sync.provider.capability.google_appdata.label",
      ),
      summary: translate(
        locale,
        "settings.sync.provider.capability.google_appdata.summary",
      ),
      authRequirement: translate(
        locale,
        "settings.sync.provider.capability.google_appdata.auth",
      ),
      endpointMode: "managed",
      warnings: [
        translate(
          locale,
          "settings.sync.provider.capability.google_appdata.warning1",
        ),
        translate(
          locale,
          "settings.sync.provider.capability.google_appdata.warning2",
        ),
      ],
    },
    onedrive_approot: {
      label: translate(
        locale,
        "settings.sync.provider.capability.onedrive_approot.label",
      ),
      summary: translate(
        locale,
        "settings.sync.provider.capability.onedrive_approot.summary",
      ),
      authRequirement: translate(
        locale,
        "settings.sync.provider.capability.onedrive_approot.auth",
      ),
      endpointMode: "managed",
      warnings: [
        translate(
          locale,
          "settings.sync.provider.capability.onedrive_approot.warning1",
        ),
        translate(
          locale,
          "settings.sync.provider.capability.onedrive_approot.warning2",
        ),
      ],
    },
    icloud_cloudkit: {
      label: translate(
        locale,
        "settings.sync.provider.capability.icloud_cloudkit.label",
      ),
      summary: translate(
        locale,
        "settings.sync.provider.capability.icloud_cloudkit.summary",
      ),
      authRequirement: translate(
        locale,
        "settings.sync.provider.capability.icloud_cloudkit.auth",
      ),
      endpointMode: "managed",
      warnings: [
        translate(
          locale,
          "settings.sync.provider.capability.icloud_cloudkit.warning1",
        ),
        translate(
          locale,
          "settings.sync.provider.capability.icloud_cloudkit.warning2",
        ),
      ],
    },
    solostack_cloud_aws: {
      label: translate(
        locale,
        "settings.sync.provider.capability.solostack_cloud_aws.label",
      ),
      summary: translate(
        locale,
        "settings.sync.provider.capability.solostack_cloud_aws.summary",
      ),
      authRequirement: translate(
        locale,
        "settings.sync.provider.capability.solostack_cloud_aws.auth",
      ),
      endpointMode: "managed",
      warnings: [
        translate(
          locale,
          "settings.sync.provider.capability.solostack_cloud_aws.warning1",
        ),
        translate(
          locale,
          "settings.sync.provider.capability.solostack_cloud_aws.warning2",
        ),
      ],
    },
  };
}

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

function getRuntimeProfileLabel(
  profile: SyncRuntimeProfileSetting,
  locale: AppLocale,
): string {
  if (profile === "mobile_beta") {
    return translate(locale, "settings.sync.runtime.profile.mobile");
  }
  if (profile === "custom") {
    return translate(locale, "settings.sync.runtime.profile.custom");
  }
  return translate(locale, "settings.sync.runtime.profile.desktop");
}

function getErrorMessage(error: unknown, locale: AppLocale): string {
  return localizeErrorMessage(error, locale, "common.error.unableRequest");
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

function formatSyncDateTime(value: string | null, locale: AppLocale): string {
  if (!value) return translate(locale, "common.never");
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return translate(locale, "common.unknown");
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function formatDurationMs(value: number | null, locale: AppLocale): string {
  if (value === null || !Number.isFinite(value)) {
    return translate(locale, "settings.sync.duration.na");
  }
  if (value < 1000) {
    return translate(locale, "settings.sync.duration.ms", { value });
  }
  return translate(locale, "settings.sync.duration.seconds", {
    value: (value / 1000).toFixed(2),
  });
}

function formatResolutionDurationMs(
  value: number | null,
  locale: AppLocale,
): string {
  if (value === null || !Number.isFinite(value)) {
    return translate(locale, "settings.sync.duration.na");
  }
  if (value < 1000) {
    return translate(locale, "settings.sync.duration.ms", { value });
  }
  const seconds = value / 1000;
  if (seconds < 60) {
    return translate(locale, "settings.sync.duration.seconds", {
      value: seconds.toFixed(1),
    });
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return translate(locale, "settings.sync.duration.minutes", {
      value: minutes.toFixed(1),
    });
  }
  const hours = minutes / 60;
  return translate(locale, "settings.sync.duration.hours", {
    value: hours.toFixed(1),
  });
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
  locale: AppLocale,
) {
  if (conflictType === "delete_vs_update") {
    return translate(locale, "conflictCenter.type.deleteVsUpdate");
  }
  if (conflictType === "notes_collision") {
    return translate(locale, "conflictCenter.type.notesCollision");
  }
  if (conflictType === "validation_error") {
    return translate(locale, "conflictCenter.type.validationError");
  }
  return translate(locale, "conflictCenter.type.fieldConflict");
}

function formatConflictEventLabel(
  eventType: SyncConflictEventRecord["event_type"],
  locale: AppLocale,
) {
  if (eventType === "detected") {
    return translate(locale, "conflictCenter.event.detected");
  }
  if (eventType === "resolved") {
    return translate(locale, "conflictCenter.event.resolved");
  }
  if (eventType === "ignored") {
    return translate(locale, "conflictCenter.event.ignored");
  }
  if (eventType === "retried") {
    return translate(locale, "conflictCenter.event.retried");
  }
  return translate(locale, "conflictCenter.event.exported");
}

function formatConflictResolutionStrategyLabel(
  strategy: SyncConflictDefaultStrategy,
  locale: AppLocale,
) {
  if (strategy === "keep_remote") {
    return translate(locale, "conflictCenter.strategy.keepRemote");
  }
  if (strategy === "manual_merge") {
    return translate(locale, "conflictCenter.strategy.manualMerge");
  }
  return translate(locale, "conflictCenter.strategy.keepLocal");
}

function formatPayloadJson(
  payloadJson: string | null,
  locale: AppLocale,
): string {
  if (!payloadJson) return translate(locale, "conflictCenter.payload.empty");
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return payloadJson;
  }
}

interface RestoreDryRunSummaryInput {
  source_label: string;
  payload_summary: BackupImportResult | null;
}

function buildRestoreDryRunDataSummaryLabel(
  summary: BackupImportResult | null,
  locale: AppLocale,
): string {
  if (!summary) {
    return translate(locale, "settings.backup.confirm.dryRunDataUnknown");
  }
  return translate(locale, "settings.backup.confirm.dryRunData", {
    projects: summary.projects,
    tasks: summary.tasks,
    templates: summary.task_templates,
  });
}

function buildRestoreConfirmationMessage(
  preflight: BackupRestorePreflight,
  locale: AppLocale,
  dryRunSummary: RestoreDryRunSummaryInput,
) {
  const forceReasonSegments: string[] = [];
  if (preflight.pending_outbox_changes > 0) {
    forceReasonSegments.push(
      `${preflight.pending_outbox_changes} ${translate(
        locale,
        "settings.backup.reason.pendingOutbox",
      )}`,
    );
  }
  if (preflight.open_conflicts > 0) {
    forceReasonSegments.push(
      `${preflight.open_conflicts} ${translate(
        locale,
        "settings.backup.reason.openConflicts",
      )}`,
    );
  }

  const dryRunLines = [
    translate(locale, "settings.backup.confirm.dryRunTitle"),
    dryRunSummary.source_label,
    buildRestoreDryRunDataSummaryLabel(dryRunSummary.payload_summary, locale),
    translate(locale, "settings.backup.confirm.dryRunClears", {
      outbox: preflight.pending_outbox_changes,
      conflicts: preflight.open_conflicts,
    }),
  ];

  if (forceReasonSegments.length === 0) {
    return [
      ...dryRunLines,
      translate(locale, "settings.backup.confirm.replaceData"),
    ].join("\n");
  }

  return [
    ...dryRunLines,
    translate(locale, "settings.backup.confirm.forceReason", {
      reason: forceReasonSegments.join(
        ` ${translate(locale, "settings.backup.reason.and")} `,
      ),
    }),
    translate(locale, "settings.backup.confirm.forceDiscard"),
    translate(locale, "settings.backup.confirm.forceContinue"),
  ].join("\n");
}

function buildRestoreForceReasonLabel(
  preflight: BackupRestorePreflight,
  locale: AppLocale,
): string {
  const reasonSegments: string[] = [];
  if (preflight.pending_outbox_changes > 0) {
    reasonSegments.push(
      translate(locale, "settings.backup.reason.pendingOutbox"),
    );
  }
  if (preflight.open_conflicts > 0) {
    reasonSegments.push(
      translate(locale, "settings.backup.reason.openConflicts"),
    );
  }
  if (reasonSegments.length === 0) {
    return translate(locale, "settings.backup.reason.activeGuardrails");
  }
  if (reasonSegments.length === 1) {
    return reasonSegments[0];
  }
  return `${reasonSegments[0]} ${translate(locale, "settings.backup.reason.and")} ${reasonSegments[1]}`;
}

export function ReminderSettings({
  remindersEnabled,
  onRemindersEnabledChange,
  appLocale,
  appLocaleSaving,
  onSaveAppLocale,
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
  syncConflictStrategyDefaults,
  syncConflictStrategyDefaultsLoading,
  syncConflictStrategyDefaultsSaving,
  onSaveSyncConflictStrategyDefaults,
  focusTarget,
  focusRequestId,
  backupRestoreLatestBusy,
  backupImportBusy,
  onQueueRestoreLatestBackup,
  onQueueImportBackup,
}: ReminderSettingsProps) {
  const { locale, t } = useI18n();
  const [permissionState, setPermissionState] =
    useState<NotificationPermissionState>("unknown");
  const [isBusy, setIsBusy] = useState(false);
  const [appLocaleDraft, setAppLocaleDraft] = useState<AppLocale>("en");
  const [appLocaleFeedback, setAppLocaleFeedback] = useState<string | null>(
    null,
  );
  const [appLocaleError, setAppLocaleError] = useState<string | null>(null);
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
  const [
    syncConflictStrategyDefaultsDraft,
    setSyncConflictStrategyDefaultsDraft,
  ] = useState<SyncConflictStrategyDefaults>(syncConflictStrategyDefaults);
  const [syncConflictDefaultsFeedback, setSyncConflictDefaultsFeedback] =
    useState<string | null>(null);
  const [syncConflictDefaultsError, setSyncConflictDefaultsError] = useState<
    string | null
  >(null);
  const [conflictFeedback, setConflictFeedback] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(
    null,
  );
  const [manualMergeConflictId, setManualMergeConflictId] = useState<
    string | null
  >(null);
  const [manualMergeDraft, setManualMergeDraft] = useState("");
  const syncDiagnosticsRef = useRef<HTMLDivElement | null>(null);
  const backupPreflightRef = useRef<HTMLDivElement | null>(null);
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
  const syncProviderCapabilities = useMemo(
    () => getSyncProviderCapabilities(locale),
    [locale],
  );
  const selectedProviderCapability = useMemo(
    () =>
      syncProviderCapabilities[syncProviderDraft] ??
      syncProviderCapabilities.provider_neutral,
    [syncProviderCapabilities, syncProviderDraft],
  );
  const runtimeProfileOptions = useMemo(
    () =>
      SYNC_RUNTIME_PROFILE_OPTION_VALUES.map((value) => ({
        value,
        label: getRuntimeProfileLabel(value, locale),
      })),
    [locale],
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
      return t("settings.sync.runtime.validation.invalidInt");
    }
    if (autoSyncIntervalSeconds < 15 || autoSyncIntervalSeconds > 3600) {
      return t("settings.sync.runtime.validation.foregroundRange");
    }
    if (
      backgroundSyncIntervalSeconds < 30 ||
      backgroundSyncIntervalSeconds > 7200
    ) {
      return t("settings.sync.runtime.validation.backgroundRange");
    }
    if (backgroundSyncIntervalSeconds < autoSyncIntervalSeconds) {
      return t("settings.sync.runtime.validation.backgroundGte");
    }
    if (pushLimit < 20 || pushLimit > 500) {
      return t("settings.sync.runtime.validation.pushRange");
    }
    if (pullLimit < 20 || pullLimit > 500) {
      return t("settings.sync.runtime.validation.pullRange");
    }
    if (maxPullPages < 1 || maxPullPages > 20) {
      return t("settings.sync.runtime.validation.maxPullPagesRange");
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
      return t("settings.sync.runtime.impact.highBattery");
    }
    if (loadPerCycle >= 1200) {
      return t("settings.sync.runtime.impact.highData");
    }
    if (foreground <= 60 || background <= 300) {
      return t("settings.sync.runtime.impact.balanced");
    }
    return t("settings.sync.runtime.impact.low");
  }, [runtimeDraftNumbers, t]);

  useEffect(() => {
    void refreshPermissionState(setPermissionState);
  }, []);

  useEffect(() => {
    setAppLocaleDraft(appLocale);
  }, [appLocale]);

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
    setSyncConflictStrategyDefaultsDraft(syncConflictStrategyDefaults);
  }, [syncConflictStrategyDefaults]);

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

  useEffect(() => {
    if (!focusTarget) return;

    if (focusTarget === "sync_diagnostics") {
      syncDiagnosticsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    if (focusTarget === "backup_preflight") {
      backupPreflightRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [focusTarget, focusRequestId]);

  const handleRequestPermission = async () => {
    setIsBusy(true);
    setPermissionFeedback(null);
    try {
      const nextState = await requestNotificationPermissionAccess();
      setPermissionState(nextState);
      setPermissionFeedback(
        nextState === "granted"
          ? t("settings.permission.feedback.enabled")
          : t("settings.permission.feedback.notGranted"),
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
      setPermissionFeedback(t("settings.permission.feedback.reset"));
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

  const confirmRestoreWithPreflight = async (input?: {
    sourceLabel?: string;
    payloadSummary?: BackupImportResult | null;
  }): Promise<{
    force: boolean;
  } | null> => {
    const preflight = await loadLatestRestorePreflight();
    if (!preflight) {
      setBackupError(t("settings.backup.preflight.unavailable"));
      return null;
    }

    const latestSourceLabel = preflight.latest_backup_exported_at
      ? t("settings.backup.confirm.source.latest", {
          time: formatSyncDateTime(preflight.latest_backup_exported_at, locale),
        })
      : t("settings.backup.confirm.source.latestUnknown");
    const confirmMessage = buildRestoreConfirmationMessage(preflight, locale, {
      source_label: input?.sourceLabel ?? latestSourceLabel,
      payload_summary:
        input?.payloadSummary ?? preflight.latest_backup_summary ?? null,
    });
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
        t("settings.backup.feedback.exported", {
          tasks: payload.data.tasks.length,
          projects: payload.data.projects.length,
        }),
      );
    } catch (error) {
      setBackupError(getErrorMessage(error, locale));
    }
  };

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    setBackupError(null);
    setBackupFeedback(null);
    try {
      const fileContent = await selectedFile.text();
      const parsedPayload = JSON.parse(fileContent) as unknown;
      const payloadSummary = summarizeUnknownBackupPayload(parsedPayload);
      const confirmation = await confirmRestoreWithPreflight({
        sourceLabel: t("settings.backup.confirm.source.file", {
          name: selectedFile.name,
        }),
        payloadSummary,
      });
      if (!confirmation) return;

      await onQueueImportBackup({
        payload: parsedPayload,
        force: confirmation.force,
        sourceName: selectedFile.name,
      });
      setBackupFeedback(t("settings.backup.feedback.restoreFileQueued"));
    } catch (error) {
      setBackupError(getErrorMessage(error, locale));
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
      setBackupFeedback(t("settings.backup.feedback.restoreLatestQueued"));
    } catch (error) {
      setBackupError(getErrorMessage(error, locale));
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
      setSyncConfigError(t("settings.sync.config.error.requireBoth"));
      return;
    }

    if (nextPushUrl && !isValidHttpUrl(nextPushUrl)) {
      setSyncConfigError(t("settings.sync.config.error.invalidPush"));
      return;
    }
    if (nextPullUrl && !isValidHttpUrl(nextPullUrl)) {
      setSyncConfigError(t("settings.sync.config.error.invalidPull"));
      return;
    }

    try {
      await onSaveSyncSettings({
        push_url: nextPushUrl,
        pull_url: nextPullUrl,
      });
      setSyncConfigFeedback(
        nextPushUrl
          ? t("settings.sync.config.feedback.saved")
          : t("settings.sync.config.feedback.cleared"),
      );
    } catch (error) {
      setSyncConfigError(getErrorMessage(error, locale));
    }
  };

  const handleSaveAppLocaleDraft = async () => {
    setAppLocaleFeedback(null);
    setAppLocaleError(null);

    if (appLocaleDraft === appLocale) {
      setAppLocaleError(t("settings.language.error.same"));
      return;
    }

    try {
      await onSaveAppLocale(appLocaleDraft);
      setAppLocaleFeedback(t("settings.language.saved"));
    } catch (error) {
      setAppLocaleError(getErrorMessage(error, locale));
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
      syncProviderCapabilities[syncProviderDraft] ??
      syncProviderCapabilities.provider_neutral;
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
      setSyncProviderFeedback(t("settings.sync.provider.feedback.saved"));
    } catch (error) {
      setSyncProviderError(getErrorMessage(error, locale));
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
      t("settings.sync.runtime.feedback.resetRecommended", {
        profile: getRuntimeProfileLabel(recommendedProfile, locale),
      }),
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
      setSyncRuntimeError(t("settings.sync.runtime.validation.incomplete"));
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
        t("settings.sync.runtime.feedback.saved", {
          profile: getRuntimeProfileLabel(syncRuntimeProfileDraft, locale),
        }),
      );
    } catch (error) {
      setSyncRuntimeError(getErrorMessage(error, locale));
    }
  };

  const handleChangeConflictDefaultStrategy = (
    conflictType: keyof SyncConflictStrategyDefaults,
    strategy: SyncConflictDefaultStrategy,
  ) => {
    setSyncConflictDefaultsFeedback(null);
    setSyncConflictDefaultsError(null);
    setSyncConflictStrategyDefaultsDraft((previous) => ({
      ...previous,
      [conflictType]: strategy,
    }));
  };

  const handleSaveConflictStrategyDefaults = async () => {
    setSyncConflictDefaultsFeedback(null);
    setSyncConflictDefaultsError(null);

    try {
      await onSaveSyncConflictStrategyDefaults(
        syncConflictStrategyDefaultsDraft,
      );
      setSyncConflictDefaultsFeedback(
        t("settings.sync.conflictDefaults.feedback.saved"),
      );
    } catch (error) {
      setSyncConflictDefaultsError(getErrorMessage(error, locale));
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
          ? t("conflictCenter.feedback.retryQueued")
          : t("conflictCenter.feedback.resolveQueued"),
      );
      return true;
    } catch (error) {
      setConflictError(getErrorMessage(error, locale));
      return false;
    }
  };

  const handleRetryConflict = async (conflictId: string) => {
    if (!window.confirm(t("conflictCenter.confirm.retry"))) {
      return;
    }

    await handleResolveConflict(conflictId, "retry");
  };

  const handleApplyDefaultStrategy = async (conflict: SyncConflictRecord) => {
    const defaultStrategy =
      syncConflictStrategyDefaults[conflict.conflict_type];
    if (defaultStrategy === "manual_merge") {
      handleOpenManualMergeEditor(conflict);
      return;
    }

    await handleResolveConflict(conflict.id, defaultStrategy, {
      default_applied: true,
      source: "settings_conflict_center",
    });
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
      setConflictError(t("conflictCenter.error.mergeEmpty"));
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
        t("conflictCenter.feedback.exported", {
          count: payload.total_conflicts,
        }),
      );
    } catch (error) {
      setConflictError(getErrorMessage(error, locale));
    }
  };

  return (
    <div className="settings-wrap">
      <div className="settings-header">
        <h1 className="settings-title">{t("settings.title")}</h1>
        <p className="settings-subtitle">{t("settings.subtitle")}</p>
      </div>

      <section className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Globe2 size={16} />
          </div>
          <div>
            <h2 className="settings-card-title">
              {t("settings.language.title")}
            </h2>
            <p className="settings-card-desc">{t("settings.language.desc")}</p>
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-field">
            <span className="settings-field-label">
              {t("settings.language.field")}
            </span>
            <select
              className="settings-input settings-select"
              value={appLocaleDraft}
              onChange={(event) => {
                setAppLocaleFeedback(null);
                setAppLocaleError(null);
                setAppLocaleDraft(event.target.value as AppLocale);
              }}
              disabled={appLocaleSaving}
            >
              <option value="en">{t("settings.language.option.en")}</option>
              <option value="th">{t("settings.language.option.th")}</option>
            </select>
          </label>
        </div>

        <div className="settings-actions settings-actions-single">
          <button
            type="button"
            className="settings-btn settings-btn-primary settings-btn-provider"
            onClick={() => void handleSaveAppLocaleDraft()}
            disabled={appLocaleSaving}
          >
            <span className="settings-btn-label">
              {appLocaleSaving
                ? t("settings.language.saving")
                : t("settings.language.save")}
            </span>
          </button>
        </div>

        {appLocaleFeedback && (
          <p className="settings-feedback">{appLocaleFeedback}</p>
        )}
        {appLocaleError && (
          <p className="settings-feedback settings-feedback-error">
            {appLocaleError}
          </p>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Bell size={16} />
          </div>
          <div>
            <h2 className="settings-card-title">
              {t("settings.reminders.title")}
            </h2>
            <p className="settings-card-desc">{t("settings.reminders.desc")}</p>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <p className="settings-row-title">
              {t("settings.reminders.toggle.title")}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.reminders.toggle.desc")}
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
            <h2 className="settings-card-title">
              {t("settings.permission.title")}
            </h2>
            <p className="settings-card-desc">
              {t("settings.permission.desc")}
            </p>
          </div>
        </div>

        <div className="permission-pill">
          {permissionState === "granted" ? (
            <>
              <CheckCircle2 size={14} />
              {t("settings.permission.state.granted")}
            </>
          ) : permissionState === "denied" ? (
            <>
              <XCircle size={14} />
              {t("settings.permission.state.denied")}
            </>
          ) : (
            <>
              <HelpCircle size={14} />
              {t("common.unknown")}
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
            {t("settings.permission.action.request")}
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={() => void handleRefreshPermission()}
            disabled={isBusy}
          >
            <RefreshCw size={14} />
            {t("settings.permission.action.refresh")}
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-danger"
            onClick={() => void handleResetPermissionAndHistory()}
            disabled={isBusy}
          >
            <RotateCcw size={14} />
            {t("settings.permission.action.reset")}
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
            <h2 className="settings-card-title">{t("settings.sync.title")}</h2>
            <p className="settings-card-desc">{t("settings.sync.desc")}</p>
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
            {t("settings.sync.lastSynced", {
              time: formatSyncDateTime(syncLastSyncedAt, locale),
            })}
          </p>
          {syncLastError && (
            <p className="settings-feedback settings-feedback-error">
              {syncLastError}
            </p>
          )}
          {syncStatus === "LOCAL_ONLY" && (
            <p className="settings-feedback">
              {t("settings.sync.localOnlyHint")}
            </p>
          )}
          {!syncHasTransport && syncStatus !== "LOCAL_ONLY" && (
            <p className="settings-feedback settings-feedback-warn">
              {t("settings.sync.transportHint")}
            </p>
          )}
        </div>

        <div className="sync-conflicts">
          <div className="sync-conflicts-head">
            <p className="settings-row-title">{t("conflictCenter.title")}</p>
            <button
              type="button"
              className="settings-btn"
              onClick={() => void handleExportConflictReport()}
              disabled={exportSyncConflicts.isPending}
            >
              <Download size={14} />
              {exportSyncConflicts.isPending
                ? t("conflictCenter.action.exporting")
                : t("conflictCenter.action.exportReport")}
            </button>
          </div>

          <div className="sync-conflict-defaults">
            <p className="settings-row-title">
              {t("settings.sync.conflictDefaults.title")}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.conflictDefaults.desc")}
            </p>
            {syncConflictStrategyDefaultsLoading ? (
              <p className="settings-row-subtitle">
                {t("settings.sync.conflictDefaults.loading")}
              </p>
            ) : (
              <div className="sync-conflict-defaults-grid">
                {SYNC_CONFLICT_DEFAULT_TYPE_VALUES.map((conflictType) => (
                  <label className="settings-field" key={conflictType}>
                    <span className="settings-field-label">
                      {formatConflictTypeLabel(conflictType, locale)}
                    </span>
                    <select
                      className="settings-input settings-select"
                      value={syncConflictStrategyDefaultsDraft[conflictType]}
                      onChange={(event) =>
                        handleChangeConflictDefaultStrategy(
                          conflictType,
                          event.target.value as SyncConflictDefaultStrategy,
                        )
                      }
                      disabled={
                        syncConflictStrategyDefaultsLoading ||
                        syncConflictStrategyDefaultsSaving
                      }
                    >
                      {SYNC_CONFLICT_DEFAULT_OPTION_VALUES.map((strategy) => (
                        <option value={strategy} key={strategy}>
                          {formatConflictResolutionStrategyLabel(
                            strategy,
                            locale,
                          )}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <div className="settings-actions settings-actions-single">
              <button
                type="button"
                className="settings-btn settings-btn-primary settings-btn-provider"
                onClick={() => void handleSaveConflictStrategyDefaults()}
                disabled={
                  syncConflictStrategyDefaultsLoading ||
                  syncConflictStrategyDefaultsSaving
                }
              >
                <span className="settings-btn-label">
                  {syncConflictStrategyDefaultsSaving
                    ? t("settings.sync.action.saving")
                    : t("settings.sync.conflictDefaults.save")}
                </span>
              </button>
            </div>
            {syncConflictDefaultsFeedback && (
              <p className="settings-feedback">
                {syncConflictDefaultsFeedback}
              </p>
            )}
            {syncConflictDefaultsError && (
              <p className="settings-feedback settings-feedback-error">
                {syncConflictDefaultsError}
              </p>
            )}
          </div>

          {syncConflictsLoading ? (
            <p className="settings-row-subtitle">
              {t("conflictCenter.loading")}
            </p>
          ) : syncConflicts.length === 0 ? (
            <p className="settings-row-subtitle">
              {t("conflictCenter.empty.title")}
            </p>
          ) : (
            <div className="sync-conflict-list">
              {syncConflicts.map((conflict) => (
                <div className="sync-conflict-item" key={conflict.id}>
                  <div className="sync-conflict-item-head">
                    <span className="sync-conflict-type">
                      {formatConflictTypeLabel(conflict.conflict_type, locale)}
                    </span>
                    <span className="sync-conflict-entity">
                      {conflict.entity_type}:{conflict.entity_id}
                    </span>
                    {selectedConflictId === conflict.id && (
                      <span className="sync-conflict-selected">
                        {t("conflictCenter.selected")}
                      </span>
                    )}
                  </div>
                  <p className="sync-conflict-message">{conflict.message}</p>
                  <p className="settings-row-subtitle">
                    {t("conflictCenter.meta.detected")}:{" "}
                    {formatSyncDateTime(conflict.detected_at, locale)}
                  </p>
                  <p className="settings-row-subtitle">
                    {t("conflictCenter.defaultStrategy", {
                      strategy: formatConflictResolutionStrategyLabel(
                        syncConflictStrategyDefaults[conflict.conflict_type],
                        locale,
                      ),
                    })}
                  </p>
                  <div className="settings-actions">
                    <button
                      type="button"
                      className="settings-btn settings-btn-primary"
                      onClick={() => void handleApplyDefaultStrategy(conflict)}
                      disabled={syncConflictResolving}
                    >
                      {t("conflictCenter.action.applyDefault")}
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() =>
                        void handleResolveConflict(conflict.id, "keep_local")
                      }
                      disabled={syncConflictResolving}
                    >
                      {t("conflictCenter.action.keepLocal")}
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() =>
                        void handleResolveConflict(conflict.id, "keep_remote")
                      }
                      disabled={syncConflictResolving}
                    >
                      {t("conflictCenter.action.keepRemote")}
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() => void handleRetryConflict(conflict.id)}
                      disabled={syncConflictResolving}
                    >
                      {t("common.retry")}
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() => handleOpenManualMergeEditor(conflict)}
                      disabled={syncConflictResolving}
                    >
                      {t("conflictCenter.action.manualMerge")}
                    </button>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={() => setSelectedConflictId(conflict.id)}
                    >
                      {t("conflictCenter.action.details")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedConflict && (
            <div className="sync-conflict-detail">
              <p className="settings-row-title">
                {t("conflictCenter.detail.title")}
              </p>
              <p className="settings-row-subtitle">
                {selectedConflict.entity_type}:{selectedConflict.entity_id} ·{" "}
                {formatConflictTypeLabel(
                  selectedConflict.conflict_type,
                  locale,
                )}
              </p>
              <div className="sync-conflict-payload-grid">
                <div>
                  <span className="settings-field-label">
                    {t("conflictCenter.detail.localPayload")}
                  </span>
                  <pre className="sync-conflict-payload">
                    {formatPayloadJson(
                      selectedConflict.local_payload_json,
                      locale,
                    )}
                  </pre>
                </div>
                <div>
                  <span className="settings-field-label">
                    {t("conflictCenter.detail.remotePayload")}
                  </span>
                  <pre className="sync-conflict-payload">
                    {formatPayloadJson(
                      selectedConflict.remote_payload_json,
                      locale,
                    )}
                  </pre>
                </div>
              </div>

              <p className="settings-row-title sync-conflict-timeline-title">
                {t("conflictCenter.detail.timeline")}
              </p>
              {isConflictEventsLoading ? (
                <p className="settings-row-subtitle">
                  {t("conflictCenter.detail.loadingTimeline")}
                </p>
              ) : selectedConflictEvents.length === 0 ? (
                <p className="settings-row-subtitle">
                  {t("conflictCenter.detail.noEvents")}
                </p>
              ) : (
                <div className="sync-conflict-timeline">
                  {selectedConflictEvents.map((event) => (
                    <div className="sync-conflict-timeline-item" key={event.id}>
                      <span className="sync-conflict-event-pill">
                        {formatConflictEventLabel(event.event_type, locale)}
                      </span>
                      <span className="settings-row-subtitle">
                        {formatSyncDateTime(event.created_at, locale)}
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
            <p className="settings-row-title">
              {t("settings.sync.provider.title")}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.provider.desc")}
            </p>
          </div>

          <div className="sync-provider-grid">
            <label className="settings-field">
              <span className="settings-field-label">
                {t("settings.sync.provider.field")}
              </span>
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
                {Object.entries(syncProviderCapabilities).map(
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
              {t("settings.sync.provider.authRequirement", {
                value: selectedProviderCapability.authRequirement,
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.provider.endpointMode", {
                value:
                  selectedProviderCapability.endpointMode === "managed"
                    ? t("settings.sync.provider.endpointMode.managed")
                    : t("settings.sync.provider.endpointMode.custom"),
              })}
            </p>
            <div className="sync-provider-warning-list">
              {selectedProviderCapability.warnings.map((warning) => (
                <p className="settings-row-subtitle" key={warning}>
                  - {warning}
                </p>
              ))}
            </div>
          </div>

          <div className="settings-actions settings-actions-single">
            <button
              type="button"
              className="settings-btn settings-btn-primary settings-btn-provider"
              onClick={() => void handleSaveSyncProvider()}
              disabled={syncProviderSaving || syncProviderLoading}
            >
              <span className="settings-btn-label">
                {syncProviderSaving
                  ? t("settings.sync.action.saving")
                  : t("settings.sync.provider.save")}
              </span>
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
          {t("settings.sync.provider.endpointMode", {
            value:
              selectedProviderCapability.endpointMode === "managed"
                ? t("settings.sync.provider.endpointModeHint.managed")
                : t("settings.sync.provider.endpointModeHint.custom"),
          })}
        </p>

        <div className="sync-endpoint-grid">
          <label className="settings-field">
            <span className="settings-field-label">
              {t("settings.sync.provider.pushUrl")}
            </span>
            <input
              className="settings-input"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("settings.sync.provider.pushPlaceholder")}
              value={syncPushUrlDraft}
              onChange={(event) => setSyncPushUrlDraft(event.target.value)}
              disabled={syncConfigSaving || syncProviderLoading}
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">
              {t("settings.sync.provider.pullUrl")}
            </span>
            <input
              className="settings-input"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("settings.sync.provider.pullPlaceholder")}
              value={syncPullUrlDraft}
              onChange={(event) => setSyncPullUrlDraft(event.target.value)}
              disabled={syncConfigSaving || syncProviderLoading}
            />
          </label>
        </div>

        <div className="sync-runtime-card">
          <div className="sync-runtime-head">
            <p className="settings-row-title">
              {t("settings.sync.runtime.title")}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.runtime.desc")}
            </p>
          </div>
          <div className="sync-runtime-grid">
            <label className="settings-field">
              <span className="settings-field-label">
                {t("settings.sync.runtime.field.profile")}
              </span>
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
                {runtimeProfileOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span className="settings-field-label">
                {t("settings.sync.runtime.field.foreground")}
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
                {t("settings.sync.runtime.field.background")}
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
              <span className="settings-field-label">
                {t("settings.sync.runtime.field.pushLimit")}
              </span>
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
              <span className="settings-field-label">
                {t("settings.sync.runtime.field.pullLimit")}
              </span>
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
              <span className="settings-field-label">
                {t("settings.sync.runtime.field.maxPullPages")}
              </span>
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
              {t("settings.sync.runtime.action.desktopPreset")}
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={handleApplyMobileSyncPreset}
              disabled={syncRuntimeSaving}
            >
              {t("settings.sync.runtime.action.mobilePreset")}
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={handleResetRecommendedRuntime}
              disabled={syncRuntimeSaving}
            >
              {t("settings.sync.runtime.action.resetRecommended")}
            </button>
            <button
              type="button"
              className="settings-btn settings-btn-primary"
              onClick={() => void handleSaveSyncRuntimeProfile()}
              disabled={syncRuntimeSaving}
            >
              {syncRuntimeSaving
                ? t("settings.sync.action.saving")
                : t("settings.sync.runtime.action.save")}
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
          <div ref={syncDiagnosticsRef}>
            <p className="settings-row-title">
              {t("settings.sync.diagnostics.title")}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.runtimePreset", {
                preset:
                  syncRuntimePreset === "mobile"
                    ? t("settings.sync.runtime.profile.mobile")
                    : t("settings.sync.runtime.profile.desktop"),
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.runtimeProfile", {
                profile: getRuntimeProfileLabel(
                  syncRuntimeProfileDraft,
                  locale,
                ),
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.provider", {
                provider: syncDiagnostics.selected_provider
                  ? (syncProviderCapabilities[syncDiagnostics.selected_provider]
                      ?.label ?? syncDiagnostics.selected_provider)
                  : t("settings.sync.diagnostics.notSelectedYet"),
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.successRate", {
                rate: syncDiagnostics.success_rate_percent.toFixed(1),
                success: syncDiagnostics.successful_cycles,
                total: syncDiagnostics.total_cycles,
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.lastCycleDuration", {
                value: formatDurationMs(
                  syncDiagnostics.last_cycle_duration_ms,
                  locale,
                ),
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.averageCycleDuration", {
                value: formatDurationMs(
                  syncDiagnostics.average_cycle_duration_ms,
                  locale,
                ),
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.failedCycles", {
                failed: syncDiagnostics.failed_cycles,
                streak: syncDiagnostics.consecutive_failures,
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.conflictCycles", {
                count: syncDiagnostics.conflict_cycles,
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.providerEvents", {
                count: syncDiagnostics.provider_selected_events,
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.profileChangeEvents", {
                count: syncDiagnostics.runtime_profile_changed_events,
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.sync.diagnostics.validationRejectedEvents", {
                count: syncDiagnostics.validation_rejected_events,
              })}
            </p>
            {syncDiagnostics.last_warning && (
              <p className="settings-row-subtitle">
                {t("settings.sync.diagnostics.lastWarning", {
                  value: syncDiagnostics.last_warning,
                })}
              </p>
            )}
          </div>
          <div className="sync-observability-card">
            <p className="settings-row-title">
              {t("settings.sync.observability.title")}
            </p>
            {syncConflictObservability.isLoading ? (
              <p className="settings-row-subtitle">
                {t("settings.sync.observability.loading")}
              </p>
            ) : conflictObservability ? (
              <>
                <p className="settings-row-subtitle">
                  {t("settings.sync.observability.total", {
                    count: conflictObservability.total_conflicts,
                  })}
                </p>
                <p className="settings-row-subtitle">
                  {t("settings.sync.observability.openResolvedIgnored", {
                    open: conflictObservability.open_conflicts,
                    resolved: conflictObservability.resolved_conflicts,
                    ignored: conflictObservability.ignored_conflicts,
                  })}
                </p>
                <p className="settings-row-subtitle">
                  {t("settings.sync.observability.resolutionRate", {
                    rate: conflictObservability.resolution_rate_percent.toFixed(
                      1,
                    ),
                  })}
                </p>
                <p className="settings-row-subtitle">
                  {t("settings.sync.observability.medianResolve", {
                    value: formatResolutionDurationMs(
                      conflictObservability.median_resolution_time_ms,
                      locale,
                    ),
                  })}
                </p>
                <p className="settings-row-subtitle">
                  {t("settings.sync.observability.retriedEvents", {
                    count: conflictObservability.retried_events,
                  })}
                </p>
                <p className="settings-row-subtitle">
                  {t("settings.sync.observability.exportedEvents", {
                    count: conflictObservability.exported_events,
                  })}
                </p>
                <p className="settings-row-subtitle">
                  {t("settings.sync.observability.lastDetected", {
                    time: formatSyncDateTime(
                      conflictObservability.latest_detected_at,
                      locale,
                    ),
                  })}
                </p>
                <p className="settings-row-subtitle">
                  {t("settings.sync.observability.lastResolved", {
                    time: formatSyncDateTime(
                      conflictObservability.latest_resolved_at,
                      locale,
                    ),
                  })}
                </p>
              </>
            ) : (
              <p className="settings-row-subtitle">
                {t("settings.sync.observability.unavailable")}
              </p>
            )}
            {syncConflictObservability.isError && (
              <p className="settings-feedback settings-feedback-error">
                {t("settings.sync.observability.error")}
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
            {syncIsRunning
              ? t("settings.sync.action.syncing")
              : t("settings.sync.action.syncNow")}
          </button>
          {syncLastError && (
            <button
              type="button"
              className="settings-btn"
              onClick={() => void onRetryLastFailedSync()}
              disabled={syncIsRunning || !syncHasTransport}
            >
              {t("settings.sync.action.retryLastFailed")}
            </button>
          )}
          <button
            type="button"
            className="settings-btn"
            onClick={() => void handleSaveSyncSettings()}
            disabled={syncConfigSaving}
          >
            {syncConfigSaving
              ? t("settings.sync.action.saving")
              : t("settings.sync.action.saveEndpoints")}
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
            <h2 className="settings-card-title">
              {t("settings.backup.title")}
            </h2>
            <p className="settings-card-desc">{t("settings.backup.desc")}</p>
          </div>
        </div>

        <p className="settings-row-subtitle settings-danger-text">
          {t("settings.backup.warning.replaceLocal")}
        </p>

        {backupRestorePreflight.isLoading ? (
          <p className="settings-row-subtitle">
            {t("settings.backup.preflight.loading")}
          </p>
        ) : backupPreflight ? (
          <div className="backup-preflight" ref={backupPreflightRef}>
            <p className="settings-row-subtitle">
              {t("settings.backup.preflight.latestInternal", {
                time: formatSyncDateTime(
                  backupPreflight.latest_backup_exported_at,
                  locale,
                ),
              })}
            </p>
            {backupPreflight.latest_backup_summary && (
              <p className="settings-row-subtitle">
                {t("settings.backup.preflight.latestSummary", {
                  projects: backupPreflight.latest_backup_summary.projects,
                  tasks: backupPreflight.latest_backup_summary.tasks,
                  templates:
                    backupPreflight.latest_backup_summary.task_templates,
                })}
              </p>
            )}
            <p className="settings-row-subtitle">
              {t("settings.backup.preflight.pendingOutbox", {
                count: backupPreflight.pending_outbox_changes,
              })}
            </p>
            <p className="settings-row-subtitle">
              {t("settings.backup.preflight.openConflicts", {
                count: backupPreflight.open_conflicts,
              })}
            </p>
            {backupPreflight.requires_force_restore && (
              <p className="settings-feedback settings-feedback-warn">
                {t("settings.backup.preflight.requiresForce", {
                  reason: buildRestoreForceReasonLabel(backupPreflight, locale),
                })}
              </p>
            )}
          </div>
        ) : null}
        {backupRestorePreflight.isError && (
          <p className="settings-feedback settings-feedback-error">
            {t("settings.backup.preflight.error")}
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
            {exportBackup.isPending
              ? t("settings.backup.action.exporting")
              : t("settings.backup.action.export")}
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={() => void handleRestoreLatestBackup()}
            disabled={isBackupBusy || !backupPreflight?.has_latest_backup}
          >
            <RotateCcw size={14} />
            {backupRestoreLatestBusy
              ? t("settings.backup.action.restoreQueued")
              : t("settings.backup.action.restoreLatest")}
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={handleOpenBackupFilePicker}
            disabled={isBackupBusy}
          >
            <Upload size={14} />
            {backupImportBusy
              ? t("settings.backup.action.restoreQueued")
              : t("settings.backup.action.restoreFromFile")}
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
        .settings-actions-single {
          flex-wrap: nowrap;
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
          justify-content: center;
          gap: 6px;
          white-space: nowrap;
          cursor: pointer;
          transition:
            background-color var(--duration) var(--ease),
            border-color var(--duration) var(--ease),
            color var(--duration) var(--ease),
            opacity var(--duration) var(--ease),
            box-shadow var(--duration) var(--ease);
        }
        .settings-btn-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
        }
        .settings-btn-provider {
          min-width: 128px;
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
        .sync-conflict-defaults {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          padding: 10px;
          margin-bottom: 10px;
        }
        .sync-conflict-defaults-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 8px;
          margin-bottom: 10px;
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
          .sync-conflict-defaults-grid {
            grid-template-columns: 1fr;
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
