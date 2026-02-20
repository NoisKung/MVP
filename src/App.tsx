import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import { TaskBoard } from "./components/TaskBoard";
import { TaskForm } from "./components/TaskForm";
import { QuickCapture } from "./components/QuickCapture";
import { Dashboard } from "./components/Dashboard";
import { TaskScheduleView } from "./components/TaskScheduleView";
import { ProjectView } from "./components/ProjectView";
import { CalendarView } from "./components/CalendarView";
import { ConflictCenterView } from "./components/ConflictCenterView";
import { WeeklyReviewView } from "./components/WeeklyReviewView";
import { ReminderSettings } from "./components/ReminderSettings";
import { TaskFiltersBar } from "./components/TaskFiltersBar";
import { CommandPalette } from "./components/CommandPalette";
import { GlobalUndoBar } from "./components/GlobalUndoBar";
import { ShortcutHelpModal } from "./components/ShortcutHelpModal";
import {
  useAppLocaleSetting,
  useMigrationDiagnosticsSetting,
  useTasks,
  useProjects,
  useTodayTasks,
  useUpcomingTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useDeleteProject,
  useImportBackup,
  useResolveSyncConflict,
  useRestoreLatestBackup,
  useSyncConflicts,
  useSyncProviderSettings,
  useSyncRuntimeProfileSettings,
  useSyncRuntimeSettings,
  useSyncSettings,
  useUpdateSyncProviderSettings,
  useUpdateSyncRuntimeSettings,
  useUpdateSyncSettings,
  useUpdateAppLocaleSetting,
} from "./hooks/use-tasks";
import { useReminderNotifications } from "./hooks/use-reminder-notifications";
import { useQuickCaptureShortcut } from "./hooks/use-quick-capture-shortcut";
import { useTaskFilters } from "./hooks/use-task-filters";
import { useSync } from "./hooks/use-sync";
import { useAppStore } from "./store/app-store";
import type {
  AppLocale,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  Task,
  SyncConflictRecord,
  ResolveSyncConflictInput,
  SyncPushChange,
  SyncProvider,
  SyncRuntimeProfileSetting,
  SyncStatus,
  UpdateSyncEndpointSettingsInput,
  UpdateSyncProviderSettingsInput,
  UpdateSyncRuntimeSettingsInput,
} from "./lib/types";
import { I18nProvider, detectSystemAppLocale, translate } from "./lib/i18n";
import {
  getRemindersEnabledPreference,
  setRemindersEnabledPreference,
} from "./lib/reminder-settings";
import { applyTaskFilters } from "./lib/task-filters";
import { detectSyncRuntimeProfilePreset } from "./lib/runtime-platform";
import { installE2EBridge } from "./lib/e2e-bridge";
import {
  buildSyncPullRequest,
  buildSyncPushRequest,
  parseSyncPullResponse,
  parseSyncPushResponse,
} from "./lib/sync-contract";
import { localizeErrorMessage } from "./lib/error-message";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds — local DB is fast
      retry: 1,
    },
  },
});

function getErrorMessage(error: unknown, locale: AppLocale = "en"): string {
  return localizeErrorMessage(error, locale, "app.error.unexpected");
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function formatRelativeSyncTime(
  value: string | null,
  locale: AppLocale,
): string | null {
  if (!value) return null;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const diffMs = Date.now() - parsedDate.getTime();
  if (diffMs < 0) return translate(locale, "sync.time.justNow");

  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;

  if (diffMs < minuteMs) return translate(locale, "sync.time.justNow");
  if (diffMs < hourMs) {
    const minutes = Math.floor(diffMs / minuteMs);
    return translate(locale, "sync.time.minutesAgo", { count: minutes });
  }
  if (diffMs < 24 * hourMs) {
    const hours = Math.floor(diffMs / hourMs);
    return translate(locale, "sync.time.hoursAgo", { count: hours });
  }
  const days = Math.floor(diffMs / (24 * hourMs));
  return translate(locale, "sync.time.daysAgo", { count: days });
}

function getSyncStatusLabel(input: {
  status: SyncStatus;
  isOnline: boolean;
  lastSyncedAt: string | null;
  locale: AppLocale;
}): string {
  if (input.status === "LOCAL_ONLY") {
    return translate(input.locale, "sync.status.localOnly");
  }
  if (input.status === "SYNCING") {
    return translate(input.locale, "sync.status.syncing");
  }
  if (input.status === "SYNCED") {
    const relativeTime = formatRelativeSyncTime(
      input.lastSyncedAt,
      input.locale,
    );
    return relativeTime
      ? translate(input.locale, "sync.status.syncedAgo", { time: relativeTime })
      : translate(input.locale, "sync.status.synced");
  }
  if (input.status === "OFFLINE") {
    if (!input.isOnline) return translate(input.locale, "sync.status.offline");
    return translate(input.locale, "sync.status.paused");
  }
  return translate(input.locale, "sync.status.attention");
}

type AutosaveStatus = "ready" | "saving" | "saved" | "error";

interface AutosaveIndicator {
  status: AutosaveStatus;
  label: string;
  detail: string | null;
}

interface UndoQueueItem {
  id: string;
  label: string;
  timeoutMs: number;
  dedupeKey: string | null;
  execute: () => Promise<void>;
  onExecuteError?: (error: unknown) => void;
}

interface EnqueueUndoActionInput {
  label: string;
  timeoutMs?: number;
  dedupeKey?: string;
  execute: () => Promise<void>;
  onExecuteError?: (error: unknown) => void;
}

interface DeleteProjectRequest {
  projectId: string;
  projectName: string;
}

interface DeleteProjectQueueResult {
  queued: boolean;
  undoWindowMs: number;
}

const DEFAULT_UNDO_WINDOW_MS = 5_000;

function createUndoQueueItemId(): string {
  return `undo-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function getAutosaveIndicator(input: {
  isSaving: boolean;
  lastSavedAt: string | null;
  lastError: string | null;
  locale: AppLocale;
}): AutosaveIndicator {
  if (input.isSaving) {
    return {
      status: "saving",
      label: translate(input.locale, "autosave.saving"),
      detail: translate(input.locale, "autosave.detail.saving"),
    };
  }

  if (input.lastError) {
    return {
      status: "error",
      label: translate(input.locale, "autosave.failed"),
      detail: input.lastError,
    };
  }

  if (input.lastSavedAt) {
    const relativeTime = formatRelativeSyncTime(
      input.lastSavedAt,
      input.locale,
    );
    const localeTag = input.locale === "th" ? "th-TH" : "en-US";
    return {
      status: "saved",
      label: relativeTime
        ? translate(input.locale, "autosave.savedAgo", { time: relativeTime })
        : translate(input.locale, "autosave.saved"),
      detail: translate(input.locale, "autosave.detail.savedAt", {
        time: new Date(input.lastSavedAt).toLocaleString(localeTag),
      }),
    };
  }

  return {
    status: "ready",
    label: translate(input.locale, "autosave.ready"),
    detail: translate(input.locale, "autosave.detail.waiting"),
  };
}

function isE2EBridgeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("e2e") === "1";
}

function isE2ETransportModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("e2e_transport") === "1";
}

const E2E_SYNC_DEVICE_ID = "e2e-local-device";
const APP_ERROR_CODES = {
  UNDO_BACKUP_RESTORE_PENDING: "APP_UNDO_BACKUP_RESTORE_PENDING",
  UNDO_BACKUP_IMPORT_PENDING: "APP_UNDO_BACKUP_IMPORT_PENDING",
  UNDO_CONFLICT_PENDING: "APP_UNDO_CONFLICT_PENDING",
  UNDO_TASK_PENDING: "APP_UNDO_TASK_PENDING",
  UNDO_PROJECT_PENDING: "APP_UNDO_PROJECT_PENDING",
} as const;
const E2E_ERROR_CODES = {
  TRANSPORT_INVALID_JSON: "E2E_TRANSPORT_INVALID_JSON",
  TRANSPORT_REQUEST_FAILED: "E2E_TRANSPORT_REQUEST_FAILED",
  TRANSPORT_REMOTE_ERROR: "E2E_TRANSPORT_REMOTE_ERROR",
} as const;

function normalizeE2EEndpointUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

async function postE2ETransportJson(input: {
  url: string;
  payload: unknown;
}): Promise<unknown> {
  const response = await fetch(input.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input.payload),
  });
  const responseText = await response.text();

  let responsePayload: unknown = {};
  if (responseText.trim()) {
    try {
      responsePayload = JSON.parse(responseText) as unknown;
    } catch {
      throw new Error(E2E_ERROR_CODES.TRANSPORT_INVALID_JSON);
    }
  }

  if (!response.ok) {
    if (typeof responsePayload === "object" && responsePayload !== null) {
      const code = (responsePayload as { code?: unknown }).code;
      const message = (responsePayload as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        const normalizedCode =
          typeof code === "string" && /^[A-Z0-9_]+$/.test(code.trim())
            ? code.trim()
            : E2E_ERROR_CODES.TRANSPORT_REMOTE_ERROR;
        throw new Error(`[${normalizedCode}] ${message.trim()}`);
      }
    }
    throw new Error(
      `${E2E_ERROR_CODES.TRANSPORT_REQUEST_FAILED}:${response.status}`,
    );
  }

  return responsePayload;
}

function createE2EConflictFixture(): SyncConflictRecord {
  const nowIso = new Date().toISOString();
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const entityId = `e2e-task-${uniqueSuffix}`;
  const conflictId = `e2e-conflict-${uniqueSuffix}`;

  return {
    id: conflictId,
    incoming_idempotency_key: `incoming-${conflictId}`,
    entity_type: "TASK",
    entity_id: entityId,
    operation: "UPSERT",
    conflict_type: "field_conflict",
    reason_code: "MISSING_TASK_TITLE",
    message: "Task title is required in incoming payload.",
    local_payload_json: JSON.stringify({
      title: "Local task title",
      description: "Existing local payload",
    }),
    remote_payload_json: JSON.stringify({
      description: "Incoming remote payload without title",
    }),
    base_payload_json: null,
    status: "open",
    resolution_strategy: null,
    resolution_payload_json: null,
    resolved_by_device: null,
    detected_at: nowIso,
    resolved_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

function createE2EConflictFixtureFromIncomingChange(
  change: SyncPushChange,
): SyncConflictRecord {
  const nowIso = new Date().toISOString();
  const conflictId = `e2e-conflict-${Date.now()}-${Math.floor(
    Math.random() * 1_000_000,
  )}`;
  return {
    id: conflictId,
    incoming_idempotency_key: change.idempotency_key,
    entity_type: change.entity_type,
    entity_id: change.entity_id,
    operation: change.operation,
    conflict_type: "field_conflict",
    reason_code: "MISSING_TASK_TITLE",
    message: "Task title is required in incoming payload.",
    local_payload_json: null,
    remote_payload_json: JSON.stringify(change.payload ?? {}),
    base_payload_json: null,
    status: "open",
    resolution_strategy: null,
    resolution_payload_json: null,
    resolved_by_device: null,
    detected_at: nowIso,
    resolved_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

function createE2EConflictResolutionOutboxChange(input: {
  conflictId: string;
  strategy: ResolveSyncConflictInput["strategy"];
  resolutionPayload: ResolveSyncConflictInput["resolution_payload"];
}): SyncPushChange {
  const nowIso = new Date().toISOString();
  const entityId = `local.sync.conflict_resolution.${input.conflictId}`;
  return {
    entity_type: "SETTING",
    entity_id: entityId,
    operation: "UPSERT",
    updated_at: nowIso,
    updated_by_device: E2E_SYNC_DEVICE_ID,
    sync_version: 1,
    payload: {
      conflict_id: input.conflictId,
      strategy: input.strategy,
      resolution_payload: input.resolutionPayload ?? null,
      resolved_by_device: E2E_SYNC_DEVICE_ID,
      resolved_at: nowIso,
    },
    idempotency_key: `e2e-conflict-resolution:${input.conflictId}:${input.strategy}`,
  };
}

function buildE2EConflictMessage(
  conflictCount: number,
  locale: AppLocale,
): string {
  const normalizedCount = Math.max(0, Math.floor(conflictCount));
  if (normalizedCount <= 0) {
    return translate(locale, "app.e2e.syncNeedsAttention");
  }
  return translate(locale, "app.e2e.conflictsDetected", {
    count: normalizedCount,
  });
}

function buildE2EMigrationSyncWriteBlockedMessage(
  locale: AppLocale,
  reason: string | null | undefined,
): string {
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";
  if (normalizedReason) {
    return translate(locale, "sync.migration.writeBlockedWithError", {
      error: normalizedReason,
    });
  }
  return translate(locale, "sync.migration.writeBlocked");
}

function AppContent() {
  const e2eBridgeEnabled = useMemo(() => isE2EBridgeEnabled(), []);
  const e2eTransportModeEnabled = useMemo(
    () => isE2ETransportModeEnabled(),
    [],
  );
  const syncRuntimePreset = useMemo(() => detectSyncRuntimeProfilePreset(), []);
  const {
    activeView,
    setActiveView,
    editingTask,
    setEditingTask,
    isCreateOpen,
    setIsCreateOpen,
  } = useAppStore();
  const {
    data: allTasks = [],
    isLoading: isLoadingAllTasks,
    isError: isAllTasksError,
    error: allTasksError,
    refetch: refetchAllTasks,
  } = useTasks();
  const { data: projects = [] } = useProjects();
  const {
    data: todayTasks = [],
    isLoading: isLoadingTodayTasks,
    isError: isTodayTasksError,
    error: todayTasksError,
    refetch: refetchTodayTasks,
  } = useTodayTasks();
  const {
    data: upcomingTasks = [],
    isLoading: isLoadingUpcomingTasks,
    isError: isUpcomingTasksError,
    error: upcomingTasksError,
    refetch: refetchUpcomingTasks,
  } = useUpcomingTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteProject = useDeleteProject();
  const importBackup = useImportBackup();
  const restoreLatestBackup = useRestoreLatestBackup();
  const { data: syncConflicts = [], isLoading: isSyncConflictsLoading } =
    useSyncConflicts("open", 50);
  const resolveSyncConflict = useResolveSyncConflict();
  const {
    data: syncProviderSettings,
    isLoading: isSyncProviderSettingsLoading,
  } = useSyncProviderSettings();
  const updateSyncProviderSettings = useUpdateSyncProviderSettings();
  const {
    data: syncRuntimeProfileSettings,
    isLoading: isSyncRuntimeProfileSettingsLoading,
  } = useSyncRuntimeProfileSettings(syncRuntimePreset);
  const { data: syncRuntimeSettings, isLoading: isSyncRuntimeSettingsLoading } =
    useSyncRuntimeSettings(syncRuntimePreset);
  const updateSyncRuntimeSettings = useUpdateSyncRuntimeSettings();
  const { data: syncSettings, isLoading: isSyncSettingsLoading } =
    useSyncSettings();
  const updateSyncSettings = useUpdateSyncSettings();
  const { data: appLocaleSetting } = useAppLocaleSetting();
  const {
    data: migrationDiagnosticsSetting,
    isLoading: isMigrationDiagnosticsSettingLoading,
  } = useMigrationDiagnosticsSetting();
  const updateAppLocaleSetting = useUpdateAppLocaleSetting();
  const [appLocale, setAppLocale] = useState<AppLocale>(() =>
    detectSystemAppLocale(),
  );
  const {
    filters,
    savedViews,
    activeSavedViewId,
    hasActiveFilters,
    setSearch,
    toggleProject,
    toggleStatus,
    togglePriority,
    setImportantOnly,
    setDueFilter,
    setSortBy,
    clearFilters,
    saveCurrentFiltersAsView,
    applySavedView,
    deleteSavedView,
  } = useTaskFilters(activeView);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickCaptureError, setQuickCaptureError] = useState<string | null>(
    null,
  );
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [lastAutosaveError, setLastAutosaveError] = useState<string | null>(
    null,
  );
  const [autosaveClock, setAutosaveClock] = useState(0);
  const [undoQueue, setUndoQueue] = useState<UndoQueueItem[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [createModalProjectId, setCreateModalProjectId] = useState<
    string | null
  >(null);
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(() =>
    getRemindersEnabledPreference(),
  );
  const [e2eOpenConflicts, setE2eOpenConflicts] = useState<
    SyncConflictRecord[]
  >([]);
  const e2eOpenConflictsRef = useRef<SyncConflictRecord[]>([]);
  const [e2eTransportPushUrl, setE2ETransportPushUrl] = useState<string | null>(
    null,
  );
  const [e2eTransportPullUrl, setE2ETransportPullUrl] = useState<string | null>(
    null,
  );
  const [e2eSyncProvider, setE2ESyncProvider] =
    useState<SyncProvider>("provider_neutral");
  const [e2eSyncProviderConfig, setE2ESyncProviderConfig] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [e2eSyncRuntimeProfile, setE2ESyncRuntimeProfile] =
    useState<SyncRuntimeProfileSetting>(() =>
      syncRuntimePreset === "mobile" ? "mobile_beta" : "desktop",
    );
  const [e2eSyncRuntimeSettings, setE2ESyncRuntimeSettings] = useState({
    auto_sync_interval_seconds: 60,
    background_sync_interval_seconds: 300,
    push_limit: 200,
    pull_limit: 200,
    max_pull_pages: 5,
  });
  const e2eTransportCursorRef = useRef<string | null>(null);
  const e2eTransportOutboxRef = useRef<SyncPushChange[]>([]);
  const e2eResolvedIncomingKeysRef = useRef<Set<string>>(new Set());
  const [isE2EConflictResolving, setIsE2EConflictResolving] = useState(false);
  const e2eSyncFailureBudgetRef = useRef(0);
  const [e2eMigrationSyncWriteBlocked, setE2EMigrationSyncWriteBlocked] =
    useState(false);
  const [
    e2eMigrationSyncWriteBlockedReason,
    setE2EMigrationSyncWriteBlockedReason,
  ] = useState<string | null>(null);
  const [e2eSyncStatus, setE2ESyncStatus] = useState<SyncStatus>(() =>
    e2eBridgeEnabled && e2eTransportModeEnabled ? "LOCAL_ONLY" : "SYNCED",
  );
  const [e2eSyncLastSyncedAt, setE2ESyncLastSyncedAt] = useState<string | null>(
    null,
  );
  const [e2eSyncLastError, setE2ESyncLastError] = useState<string | null>(null);
  const [isE2ESyncRunning, setIsE2ESyncRunning] = useState(false);
  const undoQueueRef = useRef<UndoQueueItem[]>([]);
  const undoTimerRef = useRef<number | null>(null);
  const effectiveSyncProvider =
    e2eBridgeEnabled && e2eTransportModeEnabled
      ? e2eSyncProvider
      : (syncProviderSettings?.provider ?? "provider_neutral");
  const effectiveSyncProviderConfig =
    e2eBridgeEnabled && e2eTransportModeEnabled
      ? e2eSyncProviderConfig
      : (syncProviderSettings?.provider_config ?? null);
  const effectiveSyncRuntimeProfile =
    e2eBridgeEnabled && e2eTransportModeEnabled
      ? e2eSyncRuntimeProfile
      : (syncRuntimeProfileSettings?.runtime_profile ??
        (syncRuntimePreset === "mobile" ? "mobile_beta" : "desktop"));
  const effectiveSyncRuntimeSettings =
    e2eBridgeEnabled && e2eTransportModeEnabled
      ? e2eSyncRuntimeSettings
      : {
          auto_sync_interval_seconds:
            syncRuntimeSettings?.auto_sync_interval_seconds ?? 60,
          background_sync_interval_seconds:
            syncRuntimeSettings?.background_sync_interval_seconds ?? 300,
          push_limit: syncRuntimeSettings?.push_limit ?? 200,
          pull_limit: syncRuntimeSettings?.pull_limit ?? 200,
          max_pull_pages: syncRuntimeSettings?.max_pull_pages ?? 5,
        };
  const effectiveSyncWriteBlocked = e2eBridgeEnabled
    ? e2eMigrationSyncWriteBlocked
    : (migrationDiagnosticsSetting?.sync_write_blocked ?? false);
  const effectiveSyncWriteBlockedReason = e2eBridgeEnabled
    ? e2eMigrationSyncWriteBlockedReason
    : (migrationDiagnosticsSetting?.last_error ?? null);
  const sync = useSync({
    pushUrl:
      e2eBridgeEnabled && e2eTransportModeEnabled
        ? e2eTransportPushUrl
        : (syncSettings?.push_url ?? null),
    pullUrl:
      e2eBridgeEnabled && e2eTransportModeEnabled
        ? e2eTransportPullUrl
        : (syncSettings?.pull_url ?? null),
    provider: effectiveSyncProvider,
    providerConfig: effectiveSyncProviderConfig,
    runtimeProfile: effectiveSyncRuntimeProfile,
    configReady:
      e2eBridgeEnabled && e2eTransportModeEnabled
        ? true
        : !isSyncSettingsLoading &&
          !isMigrationDiagnosticsSettingLoading &&
          !isSyncRuntimeSettingsLoading &&
          !isSyncProviderSettingsLoading &&
          !isSyncRuntimeProfileSettingsLoading,
    autoSyncIntervalMs:
      effectiveSyncRuntimeSettings.auto_sync_interval_seconds * 1000,
    backgroundSyncIntervalMs:
      effectiveSyncRuntimeSettings.background_sync_interval_seconds * 1000,
    pushLimit: effectiveSyncRuntimeSettings.push_limit,
    pullLimit: effectiveSyncRuntimeSettings.pull_limit,
    maxPullPages: effectiveSyncRuntimeSettings.max_pull_pages,
    syncWriteBlocked: effectiveSyncWriteBlocked,
    syncWriteBlockedReason: effectiveSyncWriteBlockedReason,
    locale: appLocale,
  });
  const visibleSyncStatus = e2eBridgeEnabled ? e2eSyncStatus : sync.status;
  const visibleSyncLastSyncedAt = e2eBridgeEnabled
    ? e2eSyncLastSyncedAt
    : sync.lastSyncedAt;
  const visibleSyncLastError = e2eBridgeEnabled
    ? e2eSyncLastError
    : sync.lastError;
  const visibleSyncIsRunning = e2eBridgeEnabled
    ? isE2ESyncRunning
    : sync.isSyncing;
  const e2eHasTransport = e2eTransportModeEnabled
    ? Boolean(e2eTransportPushUrl && e2eTransportPullUrl)
    : true;
  const visibleSyncHasTransport = e2eBridgeEnabled
    ? e2eHasTransport && !e2eMigrationSyncWriteBlocked
    : sync.hasTransport;
  const visibleSyncIsOnline = e2eBridgeEnabled ? true : sync.isOnline;
  const visibleSyncPushUrl =
    e2eBridgeEnabled && e2eTransportModeEnabled
      ? e2eTransportPushUrl
      : (syncSettings?.push_url ?? null);
  const visibleSyncPullUrl =
    e2eBridgeEnabled && e2eTransportModeEnabled
      ? e2eTransportPullUrl
      : (syncSettings?.pull_url ?? null);
  useEffect(() => {
    const persistedLocale = appLocaleSetting?.locale;
    if (!persistedLocale) return;
    setAppLocale((currentLocale) =>
      currentLocale === persistedLocale ? currentLocale : persistedLocale,
    );
  }, [appLocaleSetting?.locale]);
  const syncStatusLabel = useMemo(
    () =>
      getSyncStatusLabel({
        status: visibleSyncStatus,
        isOnline: visibleSyncIsOnline,
        lastSyncedAt: visibleSyncLastSyncedAt,
        locale: appLocale,
      }),
    [
      appLocale,
      visibleSyncIsOnline,
      visibleSyncLastSyncedAt,
      visibleSyncStatus,
    ],
  );
  const markAutosaveSuccess = useCallback(() => {
    setLastAutosaveError(null);
    setLastAutosavedAt(new Date().toISOString());
    setAutosaveClock((previous) => previous + 1);
  }, []);
  const markAutosaveFailure = useCallback((error: unknown) => {
    setLastAutosaveError(getErrorMessage(error, appLocale));
    setAutosaveClock((previous) => previous + 1);
  }, []);
  const enqueueUndoAction = useCallback((input: EnqueueUndoActionInput) => {
    const dedupeKey = input.dedupeKey ?? null;
    if (
      dedupeKey &&
      undoQueueRef.current.some((action) => action.dedupeKey === dedupeKey)
    ) {
      return false;
    }

    const action: UndoQueueItem = {
      id: createUndoQueueItemId(),
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_UNDO_WINDOW_MS,
      dedupeKey,
      execute: input.execute,
      onExecuteError: input.onExecuteError,
    };
    const nextQueue = [...undoQueueRef.current, action];
    undoQueueRef.current = nextQueue;
    setUndoQueue(nextQueue);
    return true;
  }, []);
  const undoNextQueuedAction = useCallback(() => {
    const currentQueue = undoQueueRef.current;
    if (currentQueue.length === 0) return;
    const nextQueue = currentQueue.slice(1);
    undoQueueRef.current = nextQueue;
    setUndoQueue(nextQueue);
  }, []);
  const hasPendingConflictUndo = useMemo(
    () =>
      undoQueue.some((action) =>
        action.dedupeKey?.startsWith("conflict-resolution:"),
      ),
    [undoQueue],
  );
  const pendingProjectDeleteUndoIds = useMemo(() => {
    const projectIds = new Set<string>();
    for (const action of undoQueue) {
      if (!action.dedupeKey?.startsWith("project-delete:")) continue;
      const projectId = action.dedupeKey.slice("project-delete:".length).trim();
      if (!projectId) continue;
      projectIds.add(projectId);
    }
    return Array.from(projectIds);
  }, [undoQueue]);
  const hasPendingBackupRestoreUndo = useMemo(
    () =>
      undoQueue.some((action) =>
        action.dedupeKey?.startsWith("backup-restore-latest"),
      ),
    [undoQueue],
  );
  const hasPendingBackupImportUndo = useMemo(
    () =>
      undoQueue.some((action) => action.dedupeKey?.startsWith("backup-import")),
    [undoQueue],
  );
  const isAutosaveSaving =
    createTask.isPending ||
    updateTask.isPending ||
    deleteTask.isPending ||
    deleteProject.isPending ||
    importBackup.isPending ||
    restoreLatestBackup.isPending ||
    (e2eBridgeEnabled
      ? isE2EConflictResolving
      : resolveSyncConflict.isPending) ||
    updateAppLocaleSetting.isPending ||
    updateSyncProviderSettings.isPending ||
    updateSyncSettings.isPending ||
    updateSyncRuntimeSettings.isPending;
  const autosaveIndicator = useMemo(
    () =>
      getAutosaveIndicator({
        isSaving: isAutosaveSaving,
        lastSavedAt: lastAutosavedAt,
        lastError: lastAutosaveError,
        locale: appLocale,
      }),
    [
      appLocale,
      autosaveClock,
      isAutosaveSaving,
      lastAutosaveError,
      lastAutosavedAt,
    ],
  );
  useEffect(() => {
    if (!lastAutosavedAt || lastAutosaveError || isAutosaveSaving) return;
    const timer = window.setInterval(() => {
      setAutosaveClock((previous) => previous + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [isAutosaveSaving, lastAutosaveError, lastAutosavedAt]);
  useEffect(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    const nextAction = undoQueue[0];
    if (!nextAction) return;

    undoTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await nextAction.execute();
        } catch (error) {
          nextAction.onExecuteError?.(error);
        } finally {
          const currentQueue = undoQueueRef.current;
          const nextQueue =
            currentQueue[0]?.id === nextAction.id
              ? currentQueue.slice(1)
              : currentQueue.filter((action) => action.id !== nextAction.id);
          undoQueueRef.current = nextQueue;
          setUndoQueue(nextQueue);
        }
      })();
    }, nextAction.timeoutMs);

    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, [undoQueue]);
  const handleSaveAppLocale = useCallback(
    async (locale: AppLocale): Promise<void> => {
      const previousLocale = appLocale;
      if (locale === previousLocale && appLocaleSetting?.locale === locale) {
        return;
      }

      setAppLocale(locale);
      if (e2eBridgeEnabled) return;

      try {
        await updateAppLocaleSetting.mutateAsync({ locale });
      } catch (error) {
        setAppLocale(previousLocale);
        throw error;
      }
    },
    [
      appLocale,
      appLocaleSetting?.locale,
      e2eBridgeEnabled,
      updateAppLocaleSetting,
    ],
  );
  const handleSaveSyncSettings = useCallback(
    async (input: UpdateSyncEndpointSettingsInput): Promise<void> => {
      if (e2eBridgeEnabled && e2eTransportModeEnabled) {
        const nextPushUrl = normalizeE2EEndpointUrl(input.push_url);
        const nextPullUrl = normalizeE2EEndpointUrl(input.pull_url);
        setE2ETransportPushUrl(nextPushUrl);
        setE2ETransportPullUrl(nextPullUrl);
        e2eTransportCursorRef.current = null;

        if (!nextPushUrl || !nextPullUrl) {
          setE2ESyncStatus("LOCAL_ONLY");
          setE2ESyncLastError(null);
          markAutosaveSuccess();
          return;
        }

        const openConflictCount = e2eOpenConflictsRef.current.length;
        if (openConflictCount > 0) {
          setE2ESyncStatus("CONFLICT");
          setE2ESyncLastError(
            buildE2EConflictMessage(openConflictCount, appLocale),
          );
          markAutosaveSuccess();
          return;
        }

        setE2ESyncStatus("SYNCED");
        setE2ESyncLastError(null);
        markAutosaveSuccess();
        return;
      }

      try {
        await updateSyncSettings.mutateAsync(input);
        markAutosaveSuccess();
      } catch (error) {
        markAutosaveFailure(error);
        throw error;
      }
    },
    [
      appLocale,
      e2eBridgeEnabled,
      e2eTransportModeEnabled,
      markAutosaveFailure,
      markAutosaveSuccess,
      setE2ETransportPullUrl,
      setE2ETransportPushUrl,
      updateSyncSettings,
    ],
  );
  const handleE2ESyncNow = useCallback(async (): Promise<void> => {
    if (e2eMigrationSyncWriteBlocked) {
      setE2ESyncStatus("OFFLINE");
      setE2ESyncLastError(
        buildE2EMigrationSyncWriteBlockedMessage(
          appLocale,
          e2eMigrationSyncWriteBlockedReason,
        ),
      );
      setIsE2ESyncRunning(false);
      return;
    }

    setIsE2ESyncRunning(true);
    setE2ESyncStatus("SYNCING");
    setE2ESyncLastError(null);

    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 80);
    });

    if (!e2eTransportModeEnabled) {
      if (e2eSyncFailureBudgetRef.current > 0) {
        e2eSyncFailureBudgetRef.current -= 1;
        setE2ESyncStatus("CONFLICT");
        setE2ESyncLastError(translate(appLocale, "app.e2e.simulatedFailure"));
        setIsE2ESyncRunning(false);
        return;
      }

      const openConflictCount = e2eOpenConflictsRef.current.length;
      if (openConflictCount > 0) {
        setE2ESyncStatus("CONFLICT");
        setE2ESyncLastError(
          buildE2EConflictMessage(openConflictCount, appLocale),
        );
        setIsE2ESyncRunning(false);
        return;
      }

      const nowIso = new Date().toISOString();
      setE2ESyncStatus("SYNCED");
      setE2ESyncLastSyncedAt(nowIso);
      setE2ESyncLastError(null);
      setIsE2ESyncRunning(false);
      return;
    }

    const pushUrl = e2eTransportPushUrl;
    const pullUrl = e2eTransportPullUrl;
    if (!pushUrl || !pullUrl) {
      setE2ESyncStatus("LOCAL_ONLY");
      setE2ESyncLastError(null);
      setIsE2ESyncRunning(false);
      return;
    }

    try {
      const pushRequest = buildSyncPushRequest({
        deviceId: E2E_SYNC_DEVICE_ID,
        baseCursor: e2eTransportCursorRef.current,
        changes: e2eTransportOutboxRef.current,
      });
      const rawPushResponse = await postE2ETransportJson({
        url: pushUrl,
        payload: pushRequest,
      });
      const pushResponse = parseSyncPushResponse(rawPushResponse);
      e2eTransportCursorRef.current = pushResponse.server_cursor;

      if (pushResponse.accepted.length > 0) {
        const acceptedKeys = new Set(pushResponse.accepted);
        e2eTransportOutboxRef.current = e2eTransportOutboxRef.current.filter(
          (change) => !acceptedKeys.has(change.idempotency_key),
        );
      }

      const pullRequest = buildSyncPullRequest({
        deviceId: E2E_SYNC_DEVICE_ID,
        cursor: e2eTransportCursorRef.current,
      });
      const rawPullResponse = await postE2ETransportJson({
        url: pullUrl,
        payload: pullRequest,
      });
      const pullResponse = parseSyncPullResponse(rawPullResponse);
      e2eTransportCursorRef.current = pullResponse.server_cursor;

      let nextConflicts = [...e2eOpenConflictsRef.current];
      for (const change of pullResponse.changes) {
        if (
          change.updated_by_device.trim().toLowerCase() ===
          E2E_SYNC_DEVICE_ID.toLowerCase()
        ) {
          continue;
        }
        if (e2eResolvedIncomingKeysRef.current.has(change.idempotency_key)) {
          continue;
        }

        const isTaskUpsert =
          change.entity_type === "TASK" && change.operation === "UPSERT";
        const taskPayload =
          change.payload && typeof change.payload === "object"
            ? (change.payload as Record<string, unknown>)
            : null;
        const taskTitle =
          typeof taskPayload?.title === "string"
            ? taskPayload.title.trim()
            : "";

        if (isTaskUpsert && !taskTitle) {
          const existingConflictIndex = nextConflicts.findIndex(
            (conflict) =>
              conflict.incoming_idempotency_key === change.idempotency_key,
          );
          if (existingConflictIndex >= 0) {
            const nowIso = new Date().toISOString();
            const existing = nextConflicts[existingConflictIndex];
            nextConflicts[existingConflictIndex] = {
              ...existing,
              status: "open",
              resolution_strategy: null,
              resolved_by_device: null,
              resolved_at: null,
              remote_payload_json: JSON.stringify(change.payload ?? {}),
              updated_at: nowIso,
            };
          } else {
            nextConflicts = [
              createE2EConflictFixtureFromIncomingChange(change),
              ...nextConflicts,
            ];
          }
          continue;
        }

        nextConflicts = nextConflicts.filter(
          (conflict) =>
            conflict.incoming_idempotency_key !== change.idempotency_key,
        );
      }

      e2eOpenConflictsRef.current = nextConflicts;
      setE2eOpenConflicts(nextConflicts);

      const openConflictCount = nextConflicts.length;
      if (openConflictCount > 0) {
        setE2ESyncStatus("CONFLICT");
        setE2ESyncLastError(
          buildE2EConflictMessage(openConflictCount, appLocale),
        );
        return;
      }

      const nowIso = new Date().toISOString();
      setE2ESyncStatus("SYNCED");
      setE2ESyncLastSyncedAt(nowIso);
      setE2ESyncLastError(null);
    } catch (error) {
      setE2ESyncStatus("CONFLICT");
      setE2ESyncLastError(getErrorMessage(error, appLocale));
    } finally {
      setIsE2ESyncRunning(false);
    }
  }, [
    appLocale,
    e2eMigrationSyncWriteBlocked,
    e2eMigrationSyncWriteBlockedReason,
    e2eTransportModeEnabled,
    e2eTransportPullUrl,
    e2eTransportPushUrl,
  ]);

  const handleE2ESetSyncFailureBudget = useCallback((count: number) => {
    const normalizedCount = Number.isFinite(count)
      ? Math.max(0, Math.floor(count))
      : 0;
    e2eSyncFailureBudgetRef.current = normalizedCount;
  }, []);
  const handleE2ESetMigrationSyncWriteBlocked = useCallback(
    (blocked: boolean, reason?: string | null) => {
      const normalizedBlocked = Boolean(blocked);
      const normalizedReason =
        typeof reason === "string" && reason.trim() ? reason.trim() : null;
      setE2EMigrationSyncWriteBlocked(normalizedBlocked);
      setE2EMigrationSyncWriteBlockedReason(normalizedReason);

      if (normalizedBlocked) {
        setE2ESyncStatus("OFFLINE");
        setE2ESyncLastError(
          buildE2EMigrationSyncWriteBlockedMessage(appLocale, normalizedReason),
        );
        return;
      }

      const openConflictCount = e2eOpenConflictsRef.current.length;
      if (openConflictCount > 0) {
        setE2ESyncStatus("CONFLICT");
        setE2ESyncLastError(
          buildE2EConflictMessage(openConflictCount, appLocale),
        );
        return;
      }

      if (e2eTransportModeEnabled) {
        const hasTransportEndpoints = Boolean(
          e2eTransportPushUrl && e2eTransportPullUrl,
        );
        setE2ESyncStatus(hasTransportEndpoints ? "SYNCED" : "LOCAL_ONLY");
        setE2ESyncLastError(null);
        return;
      }

      setE2ESyncStatus("SYNCED");
      setE2ESyncLastError(null);
    },
    [
      appLocale,
      e2eTransportModeEnabled,
      e2eTransportPullUrl,
      e2eTransportPushUrl,
    ],
  );
  const visibleSyncNow = e2eBridgeEnabled ? handleE2ESyncNow : sync.syncNow;
  const handleE2ERetryLastFailedSync =
    useCallback(async (): Promise<boolean> => {
      if (!e2eSyncLastError || isE2ESyncRunning) return false;
      await handleE2ESyncNow();
      return true;
    }, [e2eSyncLastError, handleE2ESyncNow, isE2ESyncRunning]);
  const visibleRetryLastFailedSync = e2eBridgeEnabled
    ? handleE2ERetryLastFailedSync
    : sync.retryLastFailedSync;
  const handleQueueRestoreLatestBackup = useCallback(
    async (input: { force: boolean }) => {
      const queued = enqueueUndoAction({
        label: translate(appLocale, "app.undo.restoreLatestBackup"),
        dedupeKey: "backup-restore-latest",
        execute: async () => {
          await restoreLatestBackup.mutateAsync({
            force: input.force,
          });
          if (visibleSyncHasTransport) {
            await visibleSyncNow();
          }
          markAutosaveSuccess();
        },
        onExecuteError: (error) => {
          setActionError(getErrorMessage(error, appLocale));
          markAutosaveFailure(error);
        },
      });
      if (!queued) {
        throw new Error(APP_ERROR_CODES.UNDO_BACKUP_RESTORE_PENDING);
      }
    },
    [
      appLocale,
      enqueueUndoAction,
      markAutosaveFailure,
      markAutosaveSuccess,
      restoreLatestBackup,
      setActionError,
      visibleSyncHasTransport,
      visibleSyncNow,
    ],
  );
  const handleQueueImportBackup = useCallback(
    async (input: {
      payload: unknown;
      force: boolean;
      sourceName?: string;
    }) => {
      const label = input.sourceName?.trim()
        ? translate(appLocale, "app.undo.importBackupNamed", {
            name: input.sourceName.trim(),
          })
        : translate(appLocale, "app.undo.importBackupFile");

      const queued = enqueueUndoAction({
        label,
        dedupeKey: "backup-import",
        execute: async () => {
          await importBackup.mutateAsync({
            payload: input.payload,
            force: input.force,
          });
          if (visibleSyncHasTransport) {
            await visibleSyncNow();
          }
          markAutosaveSuccess();
        },
        onExecuteError: (error) => {
          setActionError(getErrorMessage(error, appLocale));
          markAutosaveFailure(error);
        },
      });
      if (!queued) {
        throw new Error(APP_ERROR_CODES.UNDO_BACKUP_IMPORT_PENDING);
      }
    },
    [
      appLocale,
      enqueueUndoAction,
      importBackup,
      markAutosaveFailure,
      markAutosaveSuccess,
      setActionError,
      visibleSyncHasTransport,
      visibleSyncNow,
    ],
  );

  const handleResolveSyncConflict = useCallback(
    async (input: ResolveSyncConflictInput): Promise<void> => {
      if (e2eBridgeEnabled) {
        setIsE2EConflictResolving(true);
        try {
          const nowIso = new Date().toISOString();
          const targetConflict = e2eOpenConflictsRef.current.find(
            (conflict) => conflict.id === input.conflict_id,
          );

          if (e2eTransportModeEnabled) {
            const resolutionChange = createE2EConflictResolutionOutboxChange({
              conflictId: input.conflict_id,
              strategy: input.strategy,
              resolutionPayload: input.resolution_payload ?? null,
            });
            e2eTransportOutboxRef.current = [
              resolutionChange,
              ...e2eTransportOutboxRef.current.filter(
                (change) => change.entity_id !== resolutionChange.entity_id,
              ),
            ];
          }

          if (input.strategy === "retry") {
            const nextConflictCount = Math.max(
              1,
              e2eOpenConflictsRef.current.length,
            );
            setE2eOpenConflicts((previous) => {
              const next = previous.map((conflict) =>
                conflict.id === input.conflict_id
                  ? {
                      ...conflict,
                      resolution_strategy: "retry" as const,
                      resolved_by_device: "e2e-local-device",
                      resolved_at: null,
                      updated_at: nowIso,
                    }
                  : conflict,
              );
              e2eOpenConflictsRef.current = next;
              return next;
            });
            setE2ESyncStatus("CONFLICT");
            setE2ESyncLastError(
              buildE2EConflictMessage(nextConflictCount, appLocale),
            );
            markAutosaveSuccess();
            return;
          }

          if (
            e2eTransportModeEnabled &&
            targetConflict?.incoming_idempotency_key
          ) {
            e2eResolvedIncomingKeysRef.current.add(
              targetConflict.incoming_idempotency_key,
            );
          }

          const nextConflictCount = e2eOpenConflictsRef.current.filter(
            (conflict) => conflict.id !== input.conflict_id,
          ).length;
          setE2eOpenConflicts((previous) => {
            const next = previous.filter(
              (conflict) => conflict.id !== input.conflict_id,
            );
            e2eOpenConflictsRef.current = next;
            return next;
          });
          setE2ESyncStatus("CONFLICT");
          setE2ESyncLastError(
            nextConflictCount > 0
              ? buildE2EConflictMessage(nextConflictCount, appLocale)
              : translate(appLocale, "app.sync.conflictsResolvedLocally"),
          );
          markAutosaveSuccess();
          return;
        } finally {
          setIsE2EConflictResolving(false);
        }
      }

      const queued = enqueueUndoAction({
        label:
          input.strategy === "retry"
            ? translate(appLocale, "app.undo.retryConflict", {
                id: input.conflict_id.slice(0, 8),
              })
            : translate(appLocale, "app.undo.resolveConflict", {
                id: input.conflict_id.slice(0, 8),
              }),
        dedupeKey: `conflict-resolution:${input.conflict_id}`,
        execute: async () => {
          await resolveSyncConflict.mutateAsync(input);
          await sync.syncNow();
          markAutosaveSuccess();
        },
        onExecuteError: (error) => {
          setActionError(getErrorMessage(error, appLocale));
          markAutosaveFailure(error);
        },
      });
      if (!queued) {
        throw new Error(APP_ERROR_CODES.UNDO_CONFLICT_PENDING);
      }
    },
    [
      appLocale,
      enqueueUndoAction,
      e2eBridgeEnabled,
      e2eTransportModeEnabled,
      markAutosaveFailure,
      markAutosaveSuccess,
      resolveSyncConflict,
      setActionError,
      sync,
    ],
  );
  const handleSaveSyncRuntimeSettings = useCallback(
    async (input: UpdateSyncRuntimeSettingsInput): Promise<void> => {
      if (e2eBridgeEnabled && e2eTransportModeEnabled) {
        setE2ESyncRuntimeSettings({
          auto_sync_interval_seconds: input.auto_sync_interval_seconds,
          background_sync_interval_seconds:
            input.background_sync_interval_seconds,
          push_limit: input.push_limit,
          pull_limit: input.pull_limit,
          max_pull_pages: input.max_pull_pages,
        });
        setE2ESyncRuntimeProfile(input.runtime_profile ?? "custom");
        markAutosaveSuccess();
        return;
      }
      try {
        await updateSyncRuntimeSettings.mutateAsync(input);
        markAutosaveSuccess();
      } catch (error) {
        markAutosaveFailure(error);
        throw error;
      }
    },
    [
      e2eBridgeEnabled,
      e2eTransportModeEnabled,
      markAutosaveFailure,
      markAutosaveSuccess,
      updateSyncRuntimeSettings,
    ],
  );
  const handleSaveSyncProviderSettings = useCallback(
    async (input: UpdateSyncProviderSettingsInput): Promise<void> => {
      if (e2eBridgeEnabled && e2eTransportModeEnabled) {
        setE2ESyncProvider(input.provider);
        setE2ESyncProviderConfig(input.provider_config ?? null);
        markAutosaveSuccess();
        return;
      }
      try {
        await updateSyncProviderSettings.mutateAsync(input);
        markAutosaveSuccess();
      } catch (error) {
        markAutosaveFailure(error);
        throw error;
      }
    },
    [
      e2eBridgeEnabled,
      e2eTransportModeEnabled,
      markAutosaveFailure,
      markAutosaveSuccess,
      updateSyncProviderSettings,
    ],
  );

  const closeQuickCapture = useCallback(() => {
    setQuickCaptureError(null);
    setIsQuickCaptureOpen(false);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
  }, []);
  const closeShortcutHelp = useCallback(() => {
    setIsShortcutHelpOpen(false);
  }, []);
  const openShortcutHelp = useCallback(() => {
    setIsShortcutHelpOpen(true);
  }, []);

  const openQuickCapture = useCallback(() => {
    setActionError(null);
    setQuickCaptureError(null);
    setIsCommandPaletteOpen(false);
    setEditingTask(null);
    setCreateModalProjectId(null);
    setIsCreateOpen(false);
    setIsQuickCaptureOpen(true);
  }, [setEditingTask, setIsCreateOpen]);

  useQuickCaptureShortcut(openQuickCapture);

  const openCreateModal = useCallback(
    (projectId: string | null = null) => {
      closeQuickCapture();
      setIsCommandPaletteOpen(false);
      setEditingTask(null);
      setCreateModalProjectId(projectId);
      setIsCreateOpen(true);
    },
    [closeQuickCapture, setEditingTask, setIsCreateOpen],
  );

  const handleRemindersEnabledChange = useCallback((enabled: boolean) => {
    setRemindersEnabled(enabled);
    setRemindersEnabledPreference(enabled);
  }, []);

  const handleE2EResetSyncState = useCallback(() => {
    e2eOpenConflictsRef.current = [];
    setE2eOpenConflicts([]);
    setE2ETransportPushUrl(null);
    setE2ETransportPullUrl(null);
    setE2ESyncProvider("provider_neutral");
    setE2ESyncProviderConfig(null);
    setE2ESyncRuntimeProfile(
      syncRuntimePreset === "mobile" ? "mobile_beta" : "desktop",
    );
    setE2ESyncRuntimeSettings({
      auto_sync_interval_seconds: 60,
      background_sync_interval_seconds: 300,
      push_limit: 200,
      pull_limit: 200,
      max_pull_pages: 5,
    });
    e2eTransportCursorRef.current = null;
    e2eTransportOutboxRef.current = [];
    e2eResolvedIncomingKeysRef.current = new Set();
    e2eSyncFailureBudgetRef.current = 0;
    setE2EMigrationSyncWriteBlocked(false);
    setE2EMigrationSyncWriteBlockedReason(null);
    setE2ESyncStatus(e2eTransportModeEnabled ? "LOCAL_ONLY" : "SYNCED");
    setE2ESyncLastSyncedAt(null);
    setE2ESyncLastError(null);
    setIsE2ESyncRunning(false);
  }, [e2eTransportModeEnabled, syncRuntimePreset]);

  const handleE2ESeedTaskFieldConflict = useCallback(() => {
    const fixture = createE2EConflictFixture();
    const nextConflictCount = e2eOpenConflictsRef.current.length + 1;
    setE2eOpenConflicts((previous) => {
      const next = [fixture, ...previous];
      e2eOpenConflictsRef.current = next;
      return next;
    });
    setE2ESyncStatus("CONFLICT");
    setE2ESyncLastError(buildE2EConflictMessage(nextConflictCount, appLocale));
    return {
      conflict_id: fixture.id,
      entity_id: fixture.entity_id,
    };
  }, [appLocale]);

  const handleE2EListOpenConflictIds = useCallback(
    () => e2eOpenConflictsRef.current.map((conflict) => conflict.id),
    [],
  );

  useEffect(() => {
    installE2EBridge({
      enabled: e2eBridgeEnabled,
      onResetSyncState: handleE2EResetSyncState,
      onSeedTaskFieldConflict: handleE2ESeedTaskFieldConflict,
      onListOpenConflictIds: handleE2EListOpenConflictIds,
      onSetSyncFailureBudget: handleE2ESetSyncFailureBudget,
      onSetMigrationSyncWriteBlocked: handleE2ESetMigrationSyncWriteBlocked,
    });
  }, [
    e2eBridgeEnabled,
    handleE2EListOpenConflictIds,
    handleE2EResetSyncState,
    handleE2ESetMigrationSyncWriteBlocked,
    handleE2ESetSyncFailureBudget,
    handleE2ESeedTaskFieldConflict,
  ]);

  const handleTaskNotificationOpen = useCallback(
    (taskId: string) => {
      const matchedTask = allTasks.find((task) => task.id === taskId);
      if (!matchedTask) return;

      closeQuickCapture();
      setCreateModalProjectId(null);
      setIsCreateOpen(false);
      setEditingTask(matchedTask);
      setActiveView("board");
    },
    [
      allTasks,
      closeQuickCapture,
      setActiveView,
      setCreateModalProjectId,
      setEditingTask,
      setIsCreateOpen,
    ],
  );

  const handleEditTask = useCallback(
    (task: Task) => {
      closeQuickCapture();
      setEditingTask(task);
    },
    [closeQuickCapture, setEditingTask],
  );

  useReminderNotifications(
    allTasks,
    remindersEnabled && !isLoadingAllTasks && !isAllTasksError,
    appLocale,
    handleTaskNotificationOpen,
  );

  useEffect(() => {
    const handleCreateShortcut = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== "n"
      ) {
        return;
      }

      event.preventDefault();
      openCreateModal();
    };

    window.addEventListener("keydown", handleCreateShortcut);
    return () => window.removeEventListener("keydown", handleCreateShortcut);
  }, [openCreateModal]);

  useEffect(() => {
    const handlePaletteShortcut = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }

      if (isCreateOpen || editingTask || isQuickCaptureOpen) {
        return;
      }

      event.preventDefault();
      setIsCommandPaletteOpen((previousState) => !previousState);
    };

    window.addEventListener("keydown", handlePaletteShortcut);
    return () => window.removeEventListener("keydown", handlePaletteShortcut);
  }, [editingTask, isCreateOpen, isQuickCaptureOpen]);

  useEffect(() => {
    const handlePowerShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (isEditableEventTarget(event.target)) return;

      const isQuestionMarkShortcut =
        event.key === "?" || (event.key === "/" && event.shiftKey);
      if (
        isQuestionMarkShortcut &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        openShortcutHelp();
        return;
      }

      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      const key = event.key.toLowerCase();
      if (!event.shiftKey && key === ",") {
        event.preventDefault();
        setActiveView("settings");
        return;
      }

      if (event.shiftKey && key === "c") {
        event.preventDefault();
        setActiveView("conflicts");
        return;
      }

      if (event.shiftKey && key === "s") {
        if (!visibleSyncHasTransport || visibleSyncIsRunning) return;
        event.preventDefault();
        void visibleSyncNow();
      }
    };

    window.addEventListener("keydown", handlePowerShortcut);
    return () => window.removeEventListener("keydown", handlePowerShortcut);
  }, [
    openShortcutHelp,
    setActiveView,
    visibleSyncHasTransport,
    visibleSyncIsRunning,
    visibleSyncNow,
  ]);

  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    if (isCreateOpen || editingTask || isQuickCaptureOpen) {
      setIsCommandPaletteOpen(false);
    }
  }, [editingTask, isCommandPaletteOpen, isCreateOpen, isQuickCaptureOpen]);

  useEffect(() => {
    if (!isShortcutHelpOpen) return;
    if (
      isCreateOpen ||
      editingTask ||
      isQuickCaptureOpen ||
      isCommandPaletteOpen
    ) {
      setIsShortcutHelpOpen(false);
    }
  }, [
    editingTask,
    isCommandPaletteOpen,
    isCreateOpen,
    isQuickCaptureOpen,
    isShortcutHelpOpen,
  ]);

  const handleCreate = async (input: CreateTaskInput | UpdateTaskInput) => {
    setActionError(null);
    try {
      await createTask.mutateAsync(input as CreateTaskInput);
      markAutosaveSuccess();
      setIsCreateOpen(false);
      setCreateModalProjectId(null);
    } catch (error) {
      setActionError(getErrorMessage(error, appLocale));
      markAutosaveFailure(error);
    }
  };

  const handleUpdate = async (input: CreateTaskInput | UpdateTaskInput) => {
    setActionError(null);
    try {
      await updateTask.mutateAsync(input as UpdateTaskInput);
      markAutosaveSuccess();
      setEditingTask(null);
    } catch (error) {
      setActionError(getErrorMessage(error, appLocale));
      markAutosaveFailure(error);
    }
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setActionError(null);
    void updateTask
      .mutateAsync({ id: taskId, status: newStatus })
      .then(() => {
        markAutosaveSuccess();
      })
      .catch((error) => {
        setActionError(getErrorMessage(error, appLocale));
        markAutosaveFailure(error);
      });
  };

  const handleDelete = (taskId: string) => {
    setActionError(null);
    const matchedTask = allTasks.find((task) => task.id === taskId);
    const label = matchedTask?.title?.trim()
      ? translate(appLocale, "app.undo.deleteTaskNamed", {
          name: matchedTask.title.trim(),
        })
      : translate(appLocale, "app.undo.deleteTask");

    const queued = enqueueUndoAction({
      label,
      dedupeKey: `task-delete:${taskId}`,
      execute: async () => {
        await deleteTask.mutateAsync(taskId);
        markAutosaveSuccess();
      },
      onExecuteError: (error) => {
        setActionError(getErrorMessage(error, appLocale));
        markAutosaveFailure(error);
      },
    });
    if (!queued) {
      setActionError(
        getErrorMessage(APP_ERROR_CODES.UNDO_TASK_PENDING, appLocale),
      );
    }
  };
  const handleDeleteProject = useCallback(
    (input: DeleteProjectRequest): DeleteProjectQueueResult => {
      setActionError(null);

      const queued = enqueueUndoAction({
        label: translate(appLocale, "app.undo.deleteProjectNamed", {
          name: input.projectName,
        }),
        dedupeKey: `project-delete:${input.projectId}`,
        execute: async () => {
          await deleteProject.mutateAsync(input.projectId);
          markAutosaveSuccess();
        },
        onExecuteError: (error) => {
          setActionError(getErrorMessage(error, appLocale));
          markAutosaveFailure(error);
        },
      });
      if (!queued) {
        setActionError(
          getErrorMessage(APP_ERROR_CODES.UNDO_PROJECT_PENDING, appLocale),
        );
      }
      return { queued, undoWindowMs: DEFAULT_UNDO_WINDOW_MS };
    },
    [
      appLocale,
      deleteProject,
      enqueueUndoAction,
      markAutosaveFailure,
      markAutosaveSuccess,
      setActionError,
    ],
  );

  const handleQuickCaptureCreate = useCallback(
    async (title: string): Promise<void> => {
      setQuickCaptureError(null);
      try {
        await createTask.mutateAsync({
          title,
          project_id: null,
          priority: "NORMAL",
          is_important: false,
          due_at: null,
          remind_at: null,
          recurrence: "NONE",
        });
        markAutosaveSuccess();
        setIsQuickCaptureOpen(false);
      } catch (error) {
        setQuickCaptureError(getErrorMessage(error, appLocale));
        markAutosaveFailure(error);
      }
    },
    [createTask, markAutosaveFailure, markAutosaveSuccess],
  );

  const taskViewState =
    activeView === "board"
      ? {
          tasks: allTasks,
          isLoading: isLoadingAllTasks,
          isError: isAllTasksError,
          error: allTasksError,
          refetch: refetchAllTasks,
        }
      : activeView === "today"
        ? {
            tasks: todayTasks,
            isLoading: isLoadingTodayTasks,
            isError: isTodayTasksError,
            error: todayTasksError,
            refetch: refetchTodayTasks,
          }
        : activeView === "upcoming"
          ? {
              tasks: upcomingTasks,
              isLoading: isLoadingUpcomingTasks,
              isError: isUpcomingTasksError,
              error: upcomingTasksError,
              refetch: refetchUpcomingTasks,
            }
          : null;

  const filteredTaskViewTasks = useMemo(() => {
    if (!taskViewState) return [];
    return applyTaskFilters(taskViewState.tasks, filters);
  }, [taskViewState, filters]);

  const availableProjects = useMemo(
    () => projects.map((project) => ({ id: project.id, name: project.name })),
    [projects],
  );
  const projectNameById = useMemo(() => {
    return Object.fromEntries(
      projects.map((project) => [project.id, project.name]),
    ) as Record<string, string>;
  }, [projects]);
  const visibleSyncConflicts = e2eBridgeEnabled
    ? e2eOpenConflicts
    : syncConflicts;
  const visibleSyncConflictsLoading = e2eBridgeEnabled
    ? false
    : isSyncConflictsLoading;
  const visibleSyncConflictResolving = e2eBridgeEnabled
    ? isE2EConflictResolving
    : resolveSyncConflict.isPending || hasPendingConflictUndo;
  const activeUndoAction = undoQueue[0] ?? null;

  const content = taskViewState?.isLoading ? (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid var(--border-default)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  ) : taskViewState?.isError ? (
    <div
      style={{
        margin: 24,
        padding: "16px 18px",
        border: "1px solid var(--danger)",
        borderRadius: 10,
        background: "var(--danger-subtle)",
      }}
    >
      <h2
        style={{
          fontSize: 16,
          marginBottom: 6,
          color: "var(--text-primary)",
        }}
      >
        {translate(appLocale, "app.error.failedLoadTasks")}
      </h2>
      <p
        style={{
          fontSize: 13,
          marginBottom: 12,
          color: "var(--text-secondary)",
        }}
      >
        {getErrorMessage(taskViewState.error, appLocale)}
      </p>
      <button
        style={{
          padding: "7px 12px",
          border: "1px solid var(--border-strong)",
          borderRadius: 8,
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          fontSize: 12,
          cursor: "pointer",
        }}
        onClick={() => void taskViewState?.refetch()}
      >
        {translate(appLocale, "common.retry")}
      </button>
    </div>
  ) : activeView === "board" ? (
    <TaskBoard
      tasks={filteredTaskViewTasks}
      projectNameById={projectNameById}
      onEdit={handleEditTask}
      onStatusChange={handleStatusChange}
      onDelete={handleDelete}
      onCreateClick={() => openCreateModal(null)}
    />
  ) : activeView === "today" || activeView === "upcoming" ? (
    <TaskScheduleView
      view={activeView}
      tasks={filteredTaskViewTasks}
      projectNameById={projectNameById}
      onEdit={handleEditTask}
      onStatusChange={handleStatusChange}
      onDelete={handleDelete}
      onCreateClick={() => openCreateModal(null)}
    />
  ) : activeView === "projects" ? (
    <ProjectView
      tasks={allTasks}
      projectNameById={projectNameById}
      isLoadingTasks={isLoadingAllTasks}
      isTasksError={isAllTasksError}
      tasksError={allTasksError}
      onEdit={handleEditTask}
      onStatusChange={handleStatusChange}
      onDelete={handleDelete}
      onCreateClick={openCreateModal}
      onDeleteProject={handleDeleteProject}
      isDeleteProjectPending={deleteProject.isPending}
      pendingDeleteProjectIds={pendingProjectDeleteUndoIds}
    />
  ) : activeView === "calendar" ? (
    isLoadingAllTasks ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-muted)",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid var(--border-default)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    ) : isAllTasksError ? (
      <div
        style={{
          margin: 24,
          padding: "16px 18px",
          border: "1px solid var(--danger)",
          borderRadius: 10,
          background: "var(--danger-subtle)",
        }}
      >
        <h2
          style={{
            fontSize: 16,
            marginBottom: 6,
            color: "var(--text-primary)",
          }}
        >
          {translate(appLocale, "app.error.failedLoadCalendar")}
        </h2>
        <p
          style={{
            fontSize: 13,
            marginBottom: 12,
            color: "var(--text-secondary)",
          }}
        >
          {getErrorMessage(allTasksError, appLocale)}
        </p>
        <button
          style={{
            padding: "7px 12px",
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            fontSize: 12,
            cursor: "pointer",
          }}
          onClick={() => void refetchAllTasks()}
        >
          {translate(appLocale, "common.retry")}
        </button>
      </div>
    ) : (
      <CalendarView
        tasks={allTasks}
        projectNameById={projectNameById}
        onEdit={handleEditTask}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onCreateClick={() => openCreateModal(null)}
      />
    )
  ) : activeView === "review" ? (
    <WeeklyReviewView
      projectNameById={projectNameById}
      onEdit={handleEditTask}
      onStatusChange={handleStatusChange}
      onCreateClick={() => openCreateModal(null)}
    />
  ) : activeView === "conflicts" ? (
    <ConflictCenterView
      syncConflicts={visibleSyncConflicts}
      syncConflictsLoading={visibleSyncConflictsLoading}
      syncConflictResolving={visibleSyncConflictResolving}
      onResolveSyncConflict={handleResolveSyncConflict}
      onOpenSyncSettings={() => setActiveView("settings")}
    />
  ) : activeView === "settings" ? (
    <ReminderSettings
      remindersEnabled={remindersEnabled}
      onRemindersEnabledChange={handleRemindersEnabledChange}
      appLocale={appLocale}
      appLocaleSaving={
        e2eBridgeEnabled ? false : updateAppLocaleSetting.isPending
      }
      onSaveAppLocale={handleSaveAppLocale}
      syncStatus={visibleSyncStatus}
      syncStatusLabel={syncStatusLabel}
      syncLastSyncedAt={visibleSyncLastSyncedAt}
      syncLastError={visibleSyncLastError}
      syncIsRunning={visibleSyncIsRunning}
      syncHasTransport={visibleSyncHasTransport}
      onSyncNow={visibleSyncNow}
      onRetryLastFailedSync={visibleRetryLastFailedSync}
      syncPushUrl={visibleSyncPushUrl}
      syncPullUrl={visibleSyncPullUrl}
      syncProvider={effectiveSyncProvider}
      syncProviderConfig={effectiveSyncProviderConfig}
      syncProviderLoading={
        e2eBridgeEnabled && e2eTransportModeEnabled
          ? false
          : isSyncProviderSettingsLoading
      }
      syncProviderSaving={
        e2eBridgeEnabled && e2eTransportModeEnabled
          ? false
          : updateSyncProviderSettings.isPending
      }
      onSaveSyncProviderSettings={handleSaveSyncProviderSettings}
      syncConfigSaving={
        e2eBridgeEnabled && e2eTransportModeEnabled
          ? false
          : updateSyncSettings.isPending
      }
      onSaveSyncSettings={handleSaveSyncSettings}
      syncAutoIntervalSeconds={
        effectiveSyncRuntimeSettings.auto_sync_interval_seconds
      }
      syncBackgroundIntervalSeconds={
        effectiveSyncRuntimeSettings.background_sync_interval_seconds
      }
      syncPushLimit={effectiveSyncRuntimeSettings.push_limit}
      syncPullLimit={effectiveSyncRuntimeSettings.pull_limit}
      syncMaxPullPages={effectiveSyncRuntimeSettings.max_pull_pages}
      syncRuntimePreset={syncRuntimePreset}
      syncRuntimeProfileSetting={effectiveSyncRuntimeProfile}
      syncRuntimeProfileLoading={
        e2eBridgeEnabled && e2eTransportModeEnabled
          ? false
          : isSyncRuntimeProfileSettingsLoading
      }
      syncDiagnostics={sync.diagnostics}
      syncRuntimeSaving={
        e2eBridgeEnabled && e2eTransportModeEnabled
          ? false
          : updateSyncRuntimeSettings.isPending
      }
      onSaveSyncRuntimeSettings={handleSaveSyncRuntimeSettings}
      syncConflicts={visibleSyncConflicts}
      syncConflictsLoading={visibleSyncConflictsLoading}
      syncConflictResolving={visibleSyncConflictResolving}
      onResolveSyncConflict={handleResolveSyncConflict}
      backupRestoreLatestBusy={
        restoreLatestBackup.isPending || hasPendingBackupRestoreUndo
      }
      backupImportBusy={importBackup.isPending || hasPendingBackupImportUndo}
      onQueueRestoreLatestBackup={handleQueueRestoreLatestBackup}
      onQueueImportBackup={handleQueueImportBackup}
    />
  ) : (
    <Dashboard />
  );

  return (
    <I18nProvider locale={appLocale}>
      <AppShell
        onCreateClick={() => openCreateModal(null)}
        syncStatus={visibleSyncStatus}
        syncStatusLabel={syncStatusLabel}
        autosaveStatus={autosaveIndicator.status}
        autosaveStatusLabel={autosaveIndicator.label}
        autosaveStatusDetail={autosaveIndicator.detail}
        onOpenConflictCenter={() => setActiveView("conflicts")}
        onOpenShortcutHelp={openShortcutHelp}
      >
        {taskViewState &&
          !taskViewState.isLoading &&
          !taskViewState.isError && (
            <TaskFiltersBar
              filters={filters}
              availableProjects={availableProjects}
              savedViews={savedViews}
              activeSavedViewId={activeSavedViewId}
              hasActiveFilters={hasActiveFilters}
              visibleTasks={filteredTaskViewTasks.length}
              totalTasks={taskViewState.tasks.length}
              onSearchChange={setSearch}
              onToggleProject={toggleProject}
              onToggleStatus={toggleStatus}
              onTogglePriority={togglePriority}
              onSetImportantOnly={setImportantOnly}
              onSetDueFilter={setDueFilter}
              onSetSortBy={setSortBy}
              onClearFilters={clearFilters}
              onSaveCurrentView={saveCurrentFiltersAsView}
              onApplySavedView={applySavedView}
              onDeleteSavedView={deleteSavedView}
            />
          )}
        {actionError && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "10px 12px",
              border: "1px solid var(--danger)",
              borderRadius: 8,
              background: "var(--danger-subtle)",
              color: "var(--danger)",
              fontSize: 12,
            }}
          >
            {actionError}
          </div>
        )}
        {content}
        {activeUndoAction && (
          <GlobalUndoBar
            actionLabel={activeUndoAction.label}
            pendingCount={undoQueue.length}
            undoWindowMs={activeUndoAction.timeoutMs}
            onUndo={undoNextQueuedAction}
          />
        )}

        <CommandPalette
          isOpen={isCommandPaletteOpen}
          activeView={activeView}
          tasks={allTasks}
          onClose={closeCommandPalette}
          onOpenCreate={() => openCreateModal(null)}
          onOpenQuickCapture={openQuickCapture}
          onEditTask={handleEditTask}
          onChangeTaskStatus={handleStatusChange}
          onChangeView={setActiveView}
        />
        <ShortcutHelpModal
          isOpen={isShortcutHelpOpen}
          onClose={closeShortcutHelp}
        />

        {isQuickCaptureOpen && (
          <QuickCapture
            isSubmitting={createTask.isPending}
            error={quickCaptureError}
            onSubmit={handleQuickCaptureCreate}
            onClose={closeQuickCapture}
          />
        )}

        {/* Create Task Modal */}
        {isCreateOpen && (
          <TaskForm
            initialProjectId={createModalProjectId}
            onSubmit={handleCreate}
            onClose={() => {
              setIsCreateOpen(false);
              setCreateModalProjectId(null);
            }}
          />
        )}

        {/* Edit Task Modal */}
        {editingTask && (
          <TaskForm
            task={editingTask}
            onSubmit={handleUpdate}
            onClose={() => setEditingTask(null)}
          />
        )}
      </AppShell>
    </I18nProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
