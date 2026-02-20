/** Valid task statuses matching the SQLite CHECK constraint */
export type TaskStatus = "TODO" | "DOING" | "DONE" | "ARCHIVED";

/** Valid task priorities matching the SQLite CHECK constraint */
export type TaskPriority = "URGENT" | "NORMAL" | "LOW";

/** Valid recurrence rules matching the SQLite CHECK constraint */
export type TaskRecurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

/** Valid project statuses matching the SQLite CHECK constraint */
export type ProjectStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";

/** Dashboard metrics derived from tasks and changelog records */
export interface TaskDashboardStats {
  TODO: number;
  DOING: number;
  DONE: number;
  dueToday: number;
  overdue: number;
  completedThisWeek: number;
}

/** Completed task entry captured in a weekly review window */
export interface WeeklyReviewCompletedTask {
  task: Task;
  completedAt: string;
}

/** Aggregated weekly review snapshot */
export interface WeeklyReviewSnapshot {
  weekStart: string;
  weekEnd: string;
  periodEnd: string;
  completedCount: number;
  createdCount: number;
  pendingCount: number;
  overdueCount: number;
  carryOverCount: number;
  dueThisWeekOpenCount: number;
  completedTasks: WeeklyReviewCompletedTask[];
  pendingTasks: Task[];
  overdueTasks: Task[];
}

/** Task change event types */
export type TaskChangelogAction = "CREATED" | "UPDATED" | "STATUS_CHANGED";

/** A task entity from the database */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  notes_markdown: string | null;
  project_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  is_important: number; // SQLite stores booleans as 0/1
  due_at: string | null;
  remind_at: string | null;
  recurrence: TaskRecurrence;
  created_at: string;
  updated_at: string;
  sync_version?: number;
  updated_by_device?: string | null;
}

/** Input for creating a new task */
export interface CreateTaskInput {
  title: string;
  description?: string;
  notes_markdown?: string | null;
  project_id?: string | null;
  priority: TaskPriority;
  is_important: boolean;
  due_at?: string | null;
  remind_at?: string | null;
  recurrence?: TaskRecurrence;
  subtasks?: Array<{
    title: string;
    is_done?: boolean;
  }>;
}

/** Input for updating an existing task */
export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string | null;
  notes_markdown?: string | null;
  project_id?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  is_important?: boolean;
  due_at?: string | null;
  remind_at?: string | null;
  recurrence?: TaskRecurrence;
}

/** A reusable preset for creating tasks quickly */
export interface TaskTemplate {
  id: string;
  name: string;
  title_template: string | null;
  description: string | null;
  priority: TaskPriority;
  is_important: number; // SQLite stores booleans as 0/1
  due_offset_minutes: number | null;
  remind_offset_minutes: number | null;
  recurrence: TaskRecurrence;
  created_at: string;
  updated_at: string;
  sync_version?: number;
  updated_by_device?: string | null;
}

/** A completed focus/work session linked to a task */
export interface SessionRecord {
  id: string;
  task_id: string | null;
  duration_minutes: number;
  completed_at: string;
}

/** Input for recording a completed focus/work session */
export interface CreateSessionInput {
  task_id?: string | null;
  duration_minutes: number;
  completed_at?: string;
}

/** A generic key-value app setting stored in SQLite */
export interface AppSettingRecord {
  key: string;
  value: string;
}

/** Supported UI locales for app chrome/system strings */
export type AppLocale = "en" | "th";

/** Persisted app locale setting (null means fallback to system locale) */
export interface AppLocaleSetting {
  locale: AppLocale | null;
}

/** Input for updating persisted app locale setting */
export interface UpdateAppLocaleSettingInput {
  locale: AppLocale;
}

/** A project entity from the database */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  sync_version?: number;
  updated_by_device?: string | null;
}

/** Input for creating a new project */
export interface CreateProjectInput {
  name: string;
  description?: string | null;
  color?: string | null;
  status?: ProjectStatus;
}

/** Input for updating an existing project */
export interface UpdateProjectInput {
  id: string;
  name?: string;
  description?: string | null;
  color?: string | null;
  status?: ProjectStatus;
}

/** Input for creating/updating a task template */
export interface UpsertTaskTemplateInput {
  id?: string;
  name: string;
  title_template?: string | null;
  description?: string | null;
  priority: TaskPriority;
  is_important: boolean;
  due_offset_minutes?: number | null;
  remind_offset_minutes?: number | null;
  recurrence?: TaskRecurrence;
}

/** A checklist item under a task */
export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  is_done: number; // SQLite stores booleans as 0/1
  created_at: string;
  updated_at: string;
  sync_version?: number;
  updated_by_device?: string | null;
}

/** Aggregated checklist progress per task */
export interface TaskSubtaskStats {
  task_id: string;
  done_count: number;
  total_count: number;
}

/** Input for creating a task subtask */
export interface CreateTaskSubtaskInput {
  task_id: string;
  title: string;
  is_done?: boolean;
}

/** Input for updating a task subtask */
export interface UpdateTaskSubtaskInput {
  id: string;
  title?: string;
  is_done?: boolean;
}

/** A single changelog record for a task */
export interface TaskChangelog {
  id: string;
  task_id: string;
  action: TaskChangelogAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

/** Structured backup payload for local export/import */
export interface BackupPayload {
  version: 1;
  exported_at: string;
  data: {
    settings: AppSettingRecord[];
    projects: Project[];
    tasks: Task[];
    sessions: SessionRecord[];
    task_subtasks: TaskSubtask[];
    task_changelogs: TaskChangelog[];
    task_templates: TaskTemplate[];
  };
}

/** Row counts imported during restore */
export interface BackupImportResult {
  settings: number;
  projects: number;
  tasks: number;
  sessions: number;
  task_subtasks: number;
  task_changelogs: number;
  task_templates: number;
}

/** Options for restore/backup import guardrails */
export interface BackupImportOptions {
  force?: boolean;
  source?: "file" | "latest_backup";
}

/** Restore guardrails for backup recovery */
export interface BackupRestorePreflight {
  pending_outbox_changes: number;
  open_conflicts: number;
  has_latest_backup: boolean;
  latest_backup_exported_at: string | null;
  latest_backup_summary: BackupImportResult | null;
  requires_force_restore: boolean;
}

export type SyncEntityType =
  | "PROJECT"
  | "TASK"
  | "TASK_SUBTASK"
  | "TASK_TEMPLATE"
  | "SETTING";

export type SyncOperation = "UPSERT" | "DELETE";

export type SyncStatus =
  | "SYNCED"
  | "SYNCING"
  | "OFFLINE"
  | "CONFLICT"
  | "LOCAL_ONLY";

/** Startup migration diagnostics stored in settings */
export interface MigrationDiagnosticsSetting {
  last_status: string;
  last_error: string | null;
  legacy_path_detected: boolean;
  sync_write_blocked: boolean;
}

export interface SyncSessionDiagnostics {
  total_cycles: number;
  successful_cycles: number;
  failed_cycles: number;
  conflict_cycles: number;
  consecutive_failures: number;
  success_rate_percent: number;
  last_cycle_duration_ms: number | null;
  average_cycle_duration_ms: number | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  selected_provider: SyncProvider | null;
  runtime_profile: SyncRuntimeProfileSetting | null;
  provider_selected_events: number;
  runtime_profile_changed_events: number;
  validation_rejected_events: number;
  last_warning: string | null;
}

export interface SyncCheckpoint {
  id: 1;
  last_sync_cursor: string | null;
  last_synced_at: string | null;
  updated_at: string;
}

export interface SyncEndpointSettings {
  push_url: string | null;
  pull_url: string | null;
}

export interface UpdateSyncEndpointSettingsInput {
  push_url: string | null;
  pull_url: string | null;
}

export type SyncProvider =
  | "provider_neutral"
  | "google_appdata"
  | "onedrive_approot"
  | "icloud_cloudkit"
  | "solostack_cloud_aws";

export interface SyncProviderSettings {
  provider: SyncProvider;
  provider_config: Record<string, unknown> | null;
}

export interface UpdateSyncProviderSettingsInput {
  provider: SyncProvider;
  provider_config?: Record<string, unknown> | null;
}

export type SyncRuntimeProfilePreset = "desktop" | "mobile";
export type SyncRuntimeProfileSetting = "desktop" | "mobile_beta" | "custom";

export interface SyncRuntimeProfileSettings {
  runtime_profile: SyncRuntimeProfileSetting;
}

export interface SyncRuntimeSettings {
  auto_sync_interval_seconds: number;
  background_sync_interval_seconds: number;
  push_limit: number;
  pull_limit: number;
  max_pull_pages: number;
}

export interface UpdateSyncRuntimeSettingsInput {
  auto_sync_interval_seconds: number;
  background_sync_interval_seconds: number;
  push_limit: number;
  pull_limit: number;
  max_pull_pages: number;
  runtime_profile?: SyncRuntimeProfileSetting;
}

export interface SyncOutboxRecord {
  id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperation;
  payload_json: string | null;
  idempotency_key: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeletedRecord {
  id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  deleted_at: string;
  deleted_by_device: string | null;
  created_at: string;
  updated_at: string;
}

export type SyncConflictType =
  | "field_conflict"
  | "delete_vs_update"
  | "notes_collision"
  | "validation_error";

export type SyncConflictStatus = "open" | "resolved" | "ignored";

export type SyncConflictResolutionStrategy =
  | "keep_local"
  | "keep_remote"
  | "manual_merge"
  | "retry";

export type SyncConflictDefaultStrategy =
  | "keep_local"
  | "keep_remote"
  | "manual_merge";

export interface SyncConflictStrategyDefaults {
  field_conflict: SyncConflictDefaultStrategy;
  delete_vs_update: SyncConflictDefaultStrategy;
  notes_collision: SyncConflictDefaultStrategy;
  validation_error: SyncConflictDefaultStrategy;
}

export interface UpdateSyncConflictStrategyDefaultsInput {
  field_conflict?: SyncConflictDefaultStrategy;
  delete_vs_update?: SyncConflictDefaultStrategy;
  notes_collision?: SyncConflictDefaultStrategy;
  validation_error?: SyncConflictDefaultStrategy;
}

export type SyncConflictEventType =
  | "detected"
  | "resolved"
  | "ignored"
  | "retried"
  | "exported";

export interface SyncConflictRecord {
  id: string;
  incoming_idempotency_key: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperation;
  conflict_type: SyncConflictType;
  reason_code: string;
  message: string;
  local_payload_json: string | null;
  remote_payload_json: string | null;
  base_payload_json: string | null;
  status: SyncConflictStatus;
  resolution_strategy: SyncConflictResolutionStrategy | null;
  resolution_payload_json: string | null;
  resolved_by_device: string | null;
  detected_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncConflictEventRecord {
  id: string;
  conflict_id: string;
  event_type: SyncConflictEventType;
  event_payload_json: string | null;
  created_at: string;
}

export interface ResolveSyncConflictInput {
  conflict_id: string;
  strategy: SyncConflictResolutionStrategy;
  resolved_by_device?: string | null;
  resolution_payload?: Record<string, unknown> | null;
}

export interface SyncConflictReportItem {
  conflict: SyncConflictRecord;
  events: SyncConflictEventRecord[];
}

export interface SyncConflictReportPayload {
  version: 1;
  exported_at: string;
  total_conflicts: number;
  status_filter: SyncConflictStatus | "all";
  items: SyncConflictReportItem[];
}

export interface SyncConflictObservabilityCounters {
  total_conflicts: number;
  open_conflicts: number;
  resolved_conflicts: number;
  ignored_conflicts: number;
  retried_events: number;
  exported_events: number;
  resolution_rate_percent: number;
  median_resolution_time_ms: number | null;
  latest_detected_at: string | null;
  latest_resolved_at: string | null;
}

export interface SyncPushChange {
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperation;
  updated_at: string;
  updated_by_device: string;
  sync_version: number;
  payload: Record<string, unknown> | null;
  idempotency_key: string;
}

export interface SyncPushRequest {
  schema_version: 1;
  device_id: string;
  base_cursor: string | null;
  changes: SyncPushChange[];
}

export interface SyncRejectedChange {
  idempotency_key: string;
  reason:
    | "INVALID_ENTITY"
    | "INVALID_OPERATION"
    | "SCHEMA_MISMATCH"
    | "CONFLICT"
    | "VALIDATION_ERROR";
  message: string;
}

export interface SyncPushResponse {
  accepted: string[];
  rejected: SyncRejectedChange[];
  server_cursor: string;
  server_time: string;
}

export type SyncApiErrorCode =
  | "SCHEMA_MISMATCH"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INVALID_CURSOR"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "UNAVAILABLE";

export interface SyncApiError {
  code: SyncApiErrorCode;
  message: string;
  retry_after_ms: number | null;
  details: Record<string, unknown> | null;
}

export interface SyncPullRequest {
  schema_version: 1;
  device_id: string;
  cursor: string | null;
  limit?: number;
}

export interface SyncPullResponse {
  server_cursor: string;
  server_time: string;
  changes: SyncPushChange[];
  has_more: boolean;
}

export interface SyncBootstrapResponse {
  schema_version: 1;
  server_cursor: string;
  server_time: string;
  data: {
    settings: AppSettingRecord[];
    projects: Project[];
    tasks: Task[];
    task_subtasks: TaskSubtask[];
    task_templates: TaskTemplate[];
  };
}

/** Kanban column definition */
export interface KanbanColumn {
  status: TaskStatus;
  label: string;
  color: string;
}

/** Due-date filter buckets */
export type TaskDueFilter =
  | "ALL"
  | "OVERDUE"
  | "TODAY"
  | "NEXT_7_DAYS"
  | "NO_DUE";

/** Task sort options for list and board ordering */
export type TaskSortBy =
  | "CREATED_DESC"
  | "UPDATED_DESC"
  | "DUE_ASC"
  | "PRIORITY_DESC"
  | "TITLE_ASC";

/** Views that support independent sort preference */
export type TaskSortableView = "board" | "today" | "upcoming";

/** Per-view sort preference map */
export type TaskViewSortPreferences = Record<TaskSortableView, TaskSortBy>;

/** Per-view filter state map */
export type TaskViewFilterPreferences = Record<
  TaskSortableView,
  TaskFilterState
>;

/** Search/filter state for task lists */
export interface TaskFilterState {
  search: string;
  projectIds: string[];
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  importantOnly: boolean;
  dueFilter: TaskDueFilter;
  sortBy: TaskSortBy;
}

/** User-saved filter preset */
export interface SavedTaskView {
  id: string;
  name: string;
  scope: TaskSortableView;
  filters: TaskFilterState;
  created_at: string;
  updated_at: string;
}

/** Selected saved-view ids per sortable task view */
export type TaskActiveSavedViewIds = Record<TaskSortableView, string | null>;

/** Project view status filter options */
export type ProjectViewStatusFilter = "ALL" | "ACTIVE" | "COMPLETED";

/** Project view task section filter options */
export type ProjectViewTaskSectionFilter = "ALL" | "TODO" | "DOING" | "DONE";

/** Persisted project view context used for resume-last-context */
export interface ProjectViewContextState {
  selectedProjectId: string | null;
  projectSearch: string;
  projectStatusFilter: ProjectViewStatusFilter;
  taskSectionFilter: ProjectViewTaskSectionFilter;
}

/** Task detail focus modes persisted for resume-last-context */
export type TaskDetailFocusMode = "IDLE" | "CREATE" | "EDIT";

/** Persisted task detail focus state (form mode + target ids) */
export interface TaskDetailFocusState {
  mode: TaskDetailFocusMode;
  taskId: string | null;
  projectId: string | null;
}

/** Application view modes */
export type ViewMode =
  | "board"
  | "projects"
  | "calendar"
  | "today"
  | "upcoming"
  | "conflicts"
  | "review"
  | "dashboard"
  | "settings";
