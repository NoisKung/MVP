import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllTasks,
  getProjects,
  getTodayTasks,
  getUpcomingTasks,
  createProject,
  createTask,
  updateProject,
  updateTask,
  deleteProject,
  deleteTask,
  getTaskSubtasks,
  getTaskSubtaskStats,
  createTaskSubtask,
  updateTaskSubtask,
  deleteTaskSubtask,
  getTaskTemplates,
  upsertTaskTemplate,
  deleteTaskTemplate,
  getTaskDashboardStats,
  getTaskChangelogs,
  getWeeklyReviewSnapshot,
  exportBackupPayload,
  exportSyncConflictReport,
  getBackupRestorePreflight,
  getSyncConflictObservabilityCounters,
  importBackupPayload,
  listSyncConflicts,
  listSyncConflictEvents,
  restoreLatestBackupPayload,
  getSyncEndpointSettings,
  getSyncProviderSettings,
  getSyncRuntimeProfileSettings,
  ensureSyncRuntimeSettingsSeeded,
  resolveSyncConflict,
  updateSyncEndpointSettings,
  updateSyncProviderSettings,
  updateSyncRuntimeSettings,
} from "@/lib/database";
import type {
  BackupRestorePreflight,
  BackupPayload,
  CreateProjectInput,
  CreateTaskInput,
  CreateTaskSubtaskInput,
  UpdateProjectInput,
  ResolveSyncConflictInput,
  SyncConflictObservabilityCounters,
  SyncConflictReportPayload,
  SyncConflictStatus,
  UpdateSyncEndpointSettingsInput,
  UpdateSyncProviderSettingsInput,
  SyncRuntimeProfilePreset,
  UpdateSyncRuntimeSettingsInput,
  UpdateTaskSubtaskInput,
  UpdateTaskInput,
  SyncEndpointSettings,
  SyncProviderSettings,
  SyncRuntimeSettings,
  UpsertTaskTemplateInput,
} from "@/lib/types";

const TASKS_KEY = ["tasks"] as const;
const TODAY_TASKS_KEY = ["tasks", "today"] as const;
const UPCOMING_TASKS_KEY = ["tasks", "upcoming"] as const;
const STATS_KEY = ["task-stats"] as const;
const WEEKLY_REVIEW_KEY = ["weekly-review"] as const;
const CHANGELOGS_KEY = ["task-changelogs"] as const;
const TASK_SUBTASKS_KEY = ["task-subtasks"] as const;
const TASK_SUBTASK_STATS_KEY = ["task-subtask-stats"] as const;
const TASK_TEMPLATES_KEY = ["task-templates"] as const;
const PROJECTS_KEY = ["projects"] as const;
const SYNC_SETTINGS_KEY = ["sync-settings"] as const;
const SYNC_PROVIDER_SETTINGS_KEY = ["sync-provider-settings"] as const;
const SYNC_RUNTIME_SETTINGS_KEY = ["sync-runtime-settings"] as const;
const SYNC_RUNTIME_PROFILE_SETTINGS_KEY = [
  "sync-runtime-profile-settings",
] as const;
const SYNC_CONFLICTS_KEY = ["sync-conflicts"] as const;
const SYNC_CONFLICT_EVENTS_KEY = ["sync-conflict-events"] as const;
const SYNC_CONFLICT_OBSERVABILITY_KEY = [
  "sync-conflict-observability",
] as const;
const BACKUP_RESTORE_PREFLIGHT_KEY = ["backup-restore-preflight"] as const;

/** Fetch all active/completed projects */
export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: getProjects,
  });
}

/** Fetch all tasks */
export function useTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: getAllTasks,
  });
}

/** Fetch open tasks due today or overdue */
export function useTodayTasks() {
  return useQuery({
    queryKey: TODAY_TASKS_KEY,
    queryFn: () => getTodayTasks(),
  });
}

/** Fetch open tasks due in the next 7 days (excluding today) */
export function useUpcomingTasks() {
  return useQuery({
    queryKey: UPCOMING_TASKS_KEY,
    queryFn: () => getUpcomingTasks(7),
  });
}

/** Fetch task stats (counts by status) */
export function useTaskStats() {
  return useQuery({
    queryKey: STATS_KEY,
    queryFn: () => getTaskDashboardStats(),
  });
}

/** Fetch current-week review summary and focus lists */
export function useWeeklyReview() {
  return useQuery({
    queryKey: WEEKLY_REVIEW_KEY,
    queryFn: () => getWeeklyReviewSnapshot(),
  });
}

/** Fetch changelog history for a specific task */
export function useTaskChangelogs(taskId?: string) {
  return useQuery({
    queryKey: [...CHANGELOGS_KEY, taskId],
    queryFn: () => getTaskChangelogs(taskId as string),
    enabled: Boolean(taskId),
  });
}

/** Fetch checklist items for a specific task */
export function useTaskSubtasks(taskId?: string, enabled = true) {
  return useQuery({
    queryKey: [...TASK_SUBTASKS_KEY, taskId],
    queryFn: () => getTaskSubtasks(taskId as string),
    enabled: Boolean(taskId) && enabled,
  });
}

/** Fetch checklist progress stats for a task list */
export function useTaskSubtaskStats(taskIds: string[], enabled = true) {
  const normalizedTaskIds = Array.from(
    new Set(taskIds.map((taskId) => taskId.trim()).filter(Boolean)),
  ).sort();

  return useQuery({
    queryKey: [...TASK_SUBTASK_STATS_KEY, normalizedTaskIds.join(",")],
    queryFn: () => getTaskSubtaskStats(normalizedTaskIds),
    enabled: enabled && normalizedTaskIds.length > 0,
  });
}

/** Create a new task */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: UPCOMING_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: WEEKLY_REVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: CHANGELOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
    },
  });
}

/** Create a new project */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

/** Update an existing project */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

/** Delete a project */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: UPCOMING_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: WEEKLY_REVIEW_KEY });
    },
  });
}

/** Update an existing task */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTaskInput) => updateTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: UPCOMING_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: WEEKLY_REVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: CHANGELOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
    },
  });
}

/** Delete a task */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: UPCOMING_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: WEEKLY_REVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: CHANGELOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
    },
  });
}

/** Create a checklist item */
export function useCreateTaskSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskSubtaskInput) => createTaskSubtask(input),
    onSuccess: (subtask) => {
      queryClient.invalidateQueries({
        queryKey: [...TASK_SUBTASKS_KEY, subtask.task_id],
      });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
    },
  });
}

/** Update a checklist item */
export function useUpdateTaskSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTaskSubtaskInput) => updateTaskSubtask(input),
    onSuccess: (subtask) => {
      queryClient.invalidateQueries({
        queryKey: [...TASK_SUBTASKS_KEY, subtask.task_id],
      });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
    },
  });
}

/** Delete a checklist item */
export function useDeleteTaskSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; taskId: string }) => {
      await deleteTaskSubtask(input.id);
      return input;
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({
        queryKey: [...TASK_SUBTASKS_KEY, payload.taskId],
      });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
    },
  });
}

/** Fetch reusable task templates */
export function useTaskTemplates(enabled = true) {
  return useQuery({
    queryKey: TASK_TEMPLATES_KEY,
    queryFn: getTaskTemplates,
    enabled,
  });
}

/** Create or update a task template */
export function useUpsertTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertTaskTemplateInput) => upsertTaskTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_TEMPLATES_KEY });
    },
  });
}

/** Delete a task template */
export function useDeleteTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTaskTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_TEMPLATES_KEY });
    },
  });
}

/** Read sync endpoint settings stored in local SQLite */
export function useSyncSettings() {
  return useQuery({
    queryKey: SYNC_SETTINGS_KEY,
    queryFn: getSyncEndpointSettings,
  });
}

/** Update sync endpoint settings in local SQLite */
export function useUpdateSyncSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSyncEndpointSettingsInput) =>
      updateSyncEndpointSettings(input),
    onSuccess: (_result: SyncEndpointSettings) => {
      queryClient.invalidateQueries({ queryKey: SYNC_SETTINGS_KEY });
    },
  });
}

/** Read sync provider settings stored in local SQLite */
export function useSyncProviderSettings() {
  return useQuery({
    queryKey: SYNC_PROVIDER_SETTINGS_KEY,
    queryFn: getSyncProviderSettings,
  });
}

/** Update sync provider settings in local SQLite */
export function useUpdateSyncProviderSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSyncProviderSettingsInput) =>
      updateSyncProviderSettings(input),
    onSuccess: (_result: SyncProviderSettings) => {
      queryClient.invalidateQueries({ queryKey: SYNC_PROVIDER_SETTINGS_KEY });
    },
  });
}

/** Read selected sync runtime profile setting */
export function useSyncRuntimeProfileSettings(
  preset: SyncRuntimeProfilePreset = "desktop",
) {
  return useQuery({
    queryKey: [...SYNC_RUNTIME_PROFILE_SETTINGS_KEY, preset],
    queryFn: () => getSyncRuntimeProfileSettings(preset),
  });
}

/** Read sync runtime settings (intervals + limits) */
export function useSyncRuntimeSettings(
  preset: SyncRuntimeProfilePreset = "desktop",
) {
  return useQuery({
    queryKey: [...SYNC_RUNTIME_SETTINGS_KEY, preset],
    queryFn: () => ensureSyncRuntimeSettingsSeeded(preset),
  });
}

/** Update sync runtime settings (intervals + limits) */
export function useUpdateSyncRuntimeSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSyncRuntimeSettingsInput) =>
      updateSyncRuntimeSettings(input),
    onSuccess: (_result: SyncRuntimeSettings) => {
      queryClient.invalidateQueries({ queryKey: SYNC_RUNTIME_SETTINGS_KEY });
      queryClient.invalidateQueries({
        queryKey: SYNC_RUNTIME_PROFILE_SETTINGS_KEY,
      });
    },
  });
}

/** Fetch sync conflicts for conflict center surfaces */
export function useSyncConflicts(
  status: SyncConflictStatus | "all" = "open",
  limit = 100,
) {
  return useQuery({
    queryKey: [...SYNC_CONFLICTS_KEY, status, limit],
    queryFn: () =>
      listSyncConflicts({
        status,
        limit,
      }),
  });
}

/** Fetch event timeline for one sync conflict */
export function useSyncConflictEvents(conflictId?: string, limit = 100) {
  return useQuery({
    queryKey: [...SYNC_CONFLICT_EVENTS_KEY, conflictId, limit],
    queryFn: () => listSyncConflictEvents(conflictId as string, limit),
    enabled: Boolean(conflictId),
  });
}

/** Fetch aggregate observability counters for conflict lifecycle */
export function useSyncConflictObservability() {
  return useQuery({
    queryKey: SYNC_CONFLICT_OBSERVABILITY_KEY,
    queryFn: (): Promise<SyncConflictObservabilityCounters> =>
      getSyncConflictObservabilityCounters(),
  });
}

/** Resolve an open sync conflict with explicit strategy */
export function useResolveSyncConflict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ResolveSyncConflictInput) => resolveSyncConflict(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SYNC_CONFLICTS_KEY });
      queryClient.invalidateQueries({ queryKey: SYNC_CONFLICT_EVENTS_KEY });
      queryClient.invalidateQueries({
        queryKey: SYNC_CONFLICT_OBSERVABILITY_KEY,
      });
    },
  });
}

/** Export conflict report with conflict + timeline events */
export function useExportSyncConflictReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: {
      status?: SyncConflictStatus | "all";
      limit?: number;
      eventsPerConflict?: number;
    }): Promise<SyncConflictReportPayload> => exportSyncConflictReport(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SYNC_CONFLICT_EVENTS_KEY });
      queryClient.invalidateQueries({
        queryKey: SYNC_CONFLICT_OBSERVABILITY_KEY,
      });
    },
  });
}

/** Export full local data payload for backup */
export function useExportBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => exportBackupPayload(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUP_RESTORE_PREFLIGHT_KEY });
    },
  });
}

/** Inspect restore preflight guardrails (outbox/conflicts/latest snapshot) */
export function useBackupRestorePreflight() {
  return useQuery({
    queryKey: BACKUP_RESTORE_PREFLIGHT_KEY,
    queryFn: (): Promise<BackupRestorePreflight> => getBackupRestorePreflight(),
  });
}

/** Import backup payload and replace local data */
export function useImportBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      payload: BackupPayload | unknown;
      force?: boolean;
    }) => importBackupPayload(input.payload, { force: input.force }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: UPCOMING_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: WEEKLY_REVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: CHANGELOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_TEMPLATES_KEY });
      queryClient.invalidateQueries({ queryKey: SYNC_CONFLICTS_KEY });
      queryClient.invalidateQueries({ queryKey: SYNC_CONFLICT_EVENTS_KEY });
      queryClient.invalidateQueries({
        queryKey: SYNC_CONFLICT_OBSERVABILITY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: BACKUP_RESTORE_PREFLIGHT_KEY });
    },
  });
}

/** Restore the latest local exported snapshot with optional force guardrail */
export function useRestoreLatestBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: { force?: boolean }) =>
      restoreLatestBackupPayload({ force: input?.force }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: UPCOMING_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: WEEKLY_REVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: CHANGELOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_TEMPLATES_KEY });
      queryClient.invalidateQueries({ queryKey: SYNC_CONFLICTS_KEY });
      queryClient.invalidateQueries({ queryKey: SYNC_CONFLICT_EVENTS_KEY });
      queryClient.invalidateQueries({
        queryKey: SYNC_CONFLICT_OBSERVABILITY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: BACKUP_RESTORE_PREFLIGHT_KEY });
    },
  });
}
