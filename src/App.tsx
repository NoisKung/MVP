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
import { ShortcutHelpModal } from "./components/ShortcutHelpModal";
import {
  useTasks,
  useProjects,
  useTodayTasks,
  useUpcomingTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useResolveSyncConflict,
  useSyncConflicts,
  useSyncRuntimeSettings,
  useSyncSettings,
  useUpdateSyncRuntimeSettings,
  useUpdateSyncSettings,
} from "./hooks/use-tasks";
import { useReminderNotifications } from "./hooks/use-reminder-notifications";
import { useQuickCaptureShortcut } from "./hooks/use-quick-capture-shortcut";
import { useTaskFilters } from "./hooks/use-task-filters";
import { useSync } from "./hooks/use-sync";
import { useAppStore } from "./store/app-store";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  Task,
  SyncConflictRecord,
  ResolveSyncConflictInput,
  SyncPushChange,
  SyncStatus,
  UpdateSyncEndpointSettingsInput,
  UpdateSyncRuntimeSettingsInput,
} from "./lib/types";
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
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds — local DB is fast
      retry: 1,
    },
  },
});

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  return "An unexpected error occurred. Please try again.";
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function formatRelativeSyncTime(value: string | null): string | null {
  if (!value) return null;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const diffMs = Date.now() - parsedDate.getTime();
  if (diffMs < 0) return "just now";

  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;

  if (diffMs < minuteMs) return "just now";
  if (diffMs < hourMs) {
    const minutes = Math.floor(diffMs / minuteMs);
    return `${minutes}m ago`;
  }
  if (diffMs < 24 * hourMs) {
    const hours = Math.floor(diffMs / hourMs);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffMs / (24 * hourMs));
  return `${days}d ago`;
}

function getSyncStatusLabel(input: {
  status: SyncStatus;
  isOnline: boolean;
  lastSyncedAt: string | null;
}): string {
  if (input.status === "LOCAL_ONLY") {
    return "Local only";
  }
  if (input.status === "SYNCING") {
    return "Syncing...";
  }
  if (input.status === "SYNCED") {
    const relativeTime = formatRelativeSyncTime(input.lastSyncedAt);
    return relativeTime ? `Synced ${relativeTime}` : "Synced";
  }
  if (input.status === "OFFLINE") {
    if (!input.isOnline) return "Offline";
    return "Sync paused";
  }
  return "Needs attention";
}

type AutosaveStatus = "ready" | "saving" | "saved" | "error";

interface AutosaveIndicator {
  status: AutosaveStatus;
  label: string;
  detail: string | null;
}

function getAutosaveIndicator(input: {
  isSaving: boolean;
  lastSavedAt: string | null;
  lastError: string | null;
}): AutosaveIndicator {
  if (input.isSaving) {
    return {
      status: "saving",
      label: "Autosaving...",
      detail: "Saving local changes.",
    };
  }

  if (input.lastError) {
    return {
      status: "error",
      label: "Autosave failed",
      detail: input.lastError,
    };
  }

  if (input.lastSavedAt) {
    const relativeTime = formatRelativeSyncTime(input.lastSavedAt);
    return {
      status: "saved",
      label: relativeTime ? `Saved ${relativeTime}` : "Saved",
      detail: `Last autosave at ${new Date(input.lastSavedAt).toLocaleString()}.`,
    };
  }

  return {
    status: "ready",
    label: "Autosave ready",
    detail: "Waiting for local changes.",
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
      throw new Error("E2E transport returned invalid JSON.");
    }
  }

  if (!response.ok) {
    if (typeof responsePayload === "object" && responsePayload !== null) {
      const message = (responsePayload as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        throw new Error(message);
      }
    }
    throw new Error(`E2E transport request failed (${response.status}).`);
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

function buildE2EConflictMessage(conflictCount: number): string {
  const normalizedCount = Math.max(0, Math.floor(conflictCount));
  if (normalizedCount <= 0) return "Sync requires attention.";
  return `${normalizedCount} conflict(s) detected.`;
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
  const { data: syncConflicts = [], isLoading: isSyncConflictsLoading } =
    useSyncConflicts("open", 50);
  const resolveSyncConflict = useResolveSyncConflict();
  const { data: syncRuntimeSettings, isLoading: isSyncRuntimeSettingsLoading } =
    useSyncRuntimeSettings(syncRuntimePreset);
  const updateSyncRuntimeSettings = useUpdateSyncRuntimeSettings();
  const { data: syncSettings, isLoading: isSyncSettingsLoading } =
    useSyncSettings();
  const updateSyncSettings = useUpdateSyncSettings();
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
  const e2eTransportCursorRef = useRef<string | null>(null);
  const e2eTransportOutboxRef = useRef<SyncPushChange[]>([]);
  const e2eResolvedIncomingKeysRef = useRef<Set<string>>(new Set());
  const [isE2EConflictResolving, setIsE2EConflictResolving] = useState(false);
  const e2eSyncFailureBudgetRef = useRef(0);
  const [e2eSyncStatus, setE2ESyncStatus] = useState<SyncStatus>(() =>
    e2eBridgeEnabled && e2eTransportModeEnabled ? "LOCAL_ONLY" : "SYNCED",
  );
  const [e2eSyncLastSyncedAt, setE2ESyncLastSyncedAt] = useState<string | null>(
    null,
  );
  const [e2eSyncLastError, setE2ESyncLastError] = useState<string | null>(null);
  const [isE2ESyncRunning, setIsE2ESyncRunning] = useState(false);
  const sync = useSync({
    pushUrl: syncSettings?.push_url ?? null,
    pullUrl: syncSettings?.pull_url ?? null,
    configReady: !isSyncSettingsLoading && !isSyncRuntimeSettingsLoading,
    autoSyncIntervalMs:
      (syncRuntimeSettings?.auto_sync_interval_seconds ?? 60) * 1000,
    backgroundSyncIntervalMs:
      (syncRuntimeSettings?.background_sync_interval_seconds ?? 300) * 1000,
    pushLimit: syncRuntimeSettings?.push_limit ?? 200,
    pullLimit: syncRuntimeSettings?.pull_limit ?? 200,
    maxPullPages: syncRuntimeSettings?.max_pull_pages ?? 5,
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
    ? e2eHasTransport
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
  const syncStatusLabel = useMemo(
    () =>
      getSyncStatusLabel({
        status: visibleSyncStatus,
        isOnline: visibleSyncIsOnline,
        lastSyncedAt: visibleSyncLastSyncedAt,
      }),
    [visibleSyncIsOnline, visibleSyncLastSyncedAt, visibleSyncStatus],
  );
  const markAutosaveSuccess = useCallback(() => {
    setLastAutosaveError(null);
    setLastAutosavedAt(new Date().toISOString());
    setAutosaveClock((previous) => previous + 1);
  }, []);
  const markAutosaveFailure = useCallback((error: unknown) => {
    setLastAutosaveError(getErrorMessage(error));
    setAutosaveClock((previous) => previous + 1);
  }, []);
  const isAutosaveSaving =
    createTask.isPending ||
    updateTask.isPending ||
    deleteTask.isPending ||
    (e2eBridgeEnabled
      ? isE2EConflictResolving
      : resolveSyncConflict.isPending) ||
    updateSyncSettings.isPending ||
    updateSyncRuntimeSettings.isPending;
  const autosaveIndicator = useMemo(
    () =>
      getAutosaveIndicator({
        isSaving: isAutosaveSaving,
        lastSavedAt: lastAutosavedAt,
        lastError: lastAutosaveError,
      }),
    [autosaveClock, isAutosaveSaving, lastAutosaveError, lastAutosavedAt],
  );
  useEffect(() => {
    if (!lastAutosavedAt || lastAutosaveError || isAutosaveSaving) return;
    const timer = window.setInterval(() => {
      setAutosaveClock((previous) => previous + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [isAutosaveSaving, lastAutosaveError, lastAutosavedAt]);
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
          setE2ESyncLastError(buildE2EConflictMessage(openConflictCount));
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
        setE2ESyncLastError("E2E simulated transport failure.");
        setIsE2ESyncRunning(false);
        return;
      }

      const openConflictCount = e2eOpenConflictsRef.current.length;
      if (openConflictCount > 0) {
        setE2ESyncStatus("CONFLICT");
        setE2ESyncLastError(buildE2EConflictMessage(openConflictCount));
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
        setE2ESyncLastError(buildE2EConflictMessage(openConflictCount));
        return;
      }

      const nowIso = new Date().toISOString();
      setE2ESyncStatus("SYNCED");
      setE2ESyncLastSyncedAt(nowIso);
      setE2ESyncLastError(null);
    } catch (error) {
      setE2ESyncStatus("CONFLICT");
      setE2ESyncLastError(getErrorMessage(error));
    } finally {
      setIsE2ESyncRunning(false);
    }
  }, [e2eTransportModeEnabled, e2eTransportPullUrl, e2eTransportPushUrl]);

  const handleE2ESetSyncFailureBudget = useCallback((count: number) => {
    const normalizedCount = Number.isFinite(count)
      ? Math.max(0, Math.floor(count))
      : 0;
    e2eSyncFailureBudgetRef.current = normalizedCount;
  }, []);
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
            setE2ESyncLastError(buildE2EConflictMessage(nextConflictCount));
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
              ? buildE2EConflictMessage(nextConflictCount)
              : "Conflicts resolved locally. Run Sync now to confirm.",
          );
          markAutosaveSuccess();
          return;
        } finally {
          setIsE2EConflictResolving(false);
        }
      }

      try {
        await resolveSyncConflict.mutateAsync(input);
        await sync.syncNow();
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
      resolveSyncConflict,
      sync,
    ],
  );
  const handleSaveSyncRuntimeSettings = useCallback(
    async (input: UpdateSyncRuntimeSettingsInput): Promise<void> => {
      try {
        await updateSyncRuntimeSettings.mutateAsync(input);
        markAutosaveSuccess();
      } catch (error) {
        markAutosaveFailure(error);
        throw error;
      }
    },
    [markAutosaveFailure, markAutosaveSuccess, updateSyncRuntimeSettings],
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
    e2eTransportCursorRef.current = null;
    e2eTransportOutboxRef.current = [];
    e2eResolvedIncomingKeysRef.current = new Set();
    e2eSyncFailureBudgetRef.current = 0;
    setE2ESyncStatus(e2eTransportModeEnabled ? "LOCAL_ONLY" : "SYNCED");
    setE2ESyncLastSyncedAt(null);
    setE2ESyncLastError(null);
    setIsE2ESyncRunning(false);
  }, [e2eTransportModeEnabled]);

  const handleE2ESeedTaskFieldConflict = useCallback(() => {
    const fixture = createE2EConflictFixture();
    const nextConflictCount = e2eOpenConflictsRef.current.length + 1;
    setE2eOpenConflicts((previous) => {
      const next = [fixture, ...previous];
      e2eOpenConflictsRef.current = next;
      return next;
    });
    setE2ESyncStatus("CONFLICT");
    setE2ESyncLastError(buildE2EConflictMessage(nextConflictCount));
    return {
      conflict_id: fixture.id,
      entity_id: fixture.entity_id,
    };
  }, []);

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
    });
  }, [
    e2eBridgeEnabled,
    handleE2EListOpenConflictIds,
    handleE2EResetSyncState,
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
      setActionError(getErrorMessage(error));
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
      setActionError(getErrorMessage(error));
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
        setActionError(getErrorMessage(error));
        markAutosaveFailure(error);
      });
  };

  const handleDelete = (taskId: string) => {
    setActionError(null);
    void deleteTask
      .mutateAsync(taskId)
      .then(() => {
        markAutosaveSuccess();
      })
      .catch((error) => {
        setActionError(getErrorMessage(error));
        markAutosaveFailure(error);
      });
  };

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
        setQuickCaptureError(getErrorMessage(error));
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
    : resolveSyncConflict.isPending;

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
        Failed to load tasks
      </h2>
      <p
        style={{
          fontSize: 13,
          marginBottom: 12,
          color: "var(--text-secondary)",
        }}
      >
        {getErrorMessage(taskViewState.error)}
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
        Retry
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
          Failed to load calendar
        </h2>
        <p
          style={{
            fontSize: 13,
            marginBottom: 12,
            color: "var(--text-secondary)",
          }}
        >
          {getErrorMessage(allTasksError)}
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
          Retry
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
      syncConfigSaving={
        e2eBridgeEnabled && e2eTransportModeEnabled
          ? false
          : updateSyncSettings.isPending
      }
      onSaveSyncSettings={handleSaveSyncSettings}
      syncAutoIntervalSeconds={
        syncRuntimeSettings?.auto_sync_interval_seconds ?? 60
      }
      syncBackgroundIntervalSeconds={
        syncRuntimeSettings?.background_sync_interval_seconds ?? 300
      }
      syncPushLimit={syncRuntimeSettings?.push_limit ?? 200}
      syncPullLimit={syncRuntimeSettings?.pull_limit ?? 200}
      syncMaxPullPages={syncRuntimeSettings?.max_pull_pages ?? 5}
      syncRuntimePreset={syncRuntimePreset}
      syncDiagnostics={sync.diagnostics}
      syncRuntimeSaving={updateSyncRuntimeSettings.isPending}
      onSaveSyncRuntimeSettings={handleSaveSyncRuntimeSettings}
      syncConflicts={visibleSyncConflicts}
      syncConflictsLoading={visibleSyncConflictsLoading}
      syncConflictResolving={visibleSyncConflictResolving}
      onResolveSyncConflict={handleResolveSyncConflict}
    />
  ) : (
    <Dashboard />
  );

  return (
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
      {taskViewState && !taskViewState.isLoading && !taskViewState.isError && (
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
