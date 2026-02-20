import Database from "@tauri-apps/plugin-sql";
import type {
  AppLocale,
  AppLocaleSetting,
  AppSettingRecord,
  BackupImportOptions,
  BackupImportResult,
  BackupPayload,
  BackupRestorePreflight,
  DeletedRecord,
  ResolveSyncConflictInput,
  Task,
  Project,
  SessionRecord,
  SyncCheckpoint,
  SyncConflictEventRecord,
  SyncConflictEventType,
  SyncConflictObservabilityCounters,
  SyncConflictReportPayload,
  SyncConflictRecord,
  SyncConflictResolutionStrategy,
  SyncConflictStatus,
  SyncConflictType,
  SyncEndpointSettings,
  SyncProvider,
  SyncProviderSettings,
  SyncEntityType,
  SyncOperation,
  SyncOutboxRecord,
  SyncPushChange,
  SyncRuntimeProfilePreset,
  SyncRuntimeProfileSetting,
  SyncRuntimeProfileSettings,
  SyncRuntimeSettings,
  TaskStatus,
  TaskPriority,
  TaskSubtask,
  TaskSubtaskStats,
  TaskChangelog,
  TaskChangelogAction,
  ProjectStatus,
  TaskRecurrence,
  TaskDashboardStats,
  WeeklyReviewSnapshot,
  WeeklyReviewCompletedTask,
  TaskTemplate,
  CreateProjectInput,
  CreateTaskSubtaskInput,
  CreateTaskInput,
  UpdateProjectInput,
  UpdateSyncProviderSettingsInput,
  UpdateTaskSubtaskInput,
  UpdateSyncEndpointSettingsInput,
  UpdateAppLocaleSettingInput,
  UpdateSyncRuntimeSettingsInput,
  UpsertTaskTemplateInput,
  UpdateTaskInput,
} from "./types";
import { v4 as uuidv4 } from "uuid";
import { createSyncIdempotencyKey } from "./sync-contract";
import {
  isMissingTaskTitleConflict,
  isTaskNotesCollision,
  isTaskProjectNotFoundConflict,
} from "./sync-conflict-rules";

const DATABASE_NAME = "sqlite:solostack.db";

let dbInstance: Database | null = null;

interface ChangelogInsert {
  taskId: string;
  action: TaskChangelogAction;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt?: string;
}

interface TaskChangeDiff {
  action: TaskChangelogAction;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

interface WeeklyReviewAggregateRow {
  pending_count: number;
  overdue_count: number;
  carry_over_count: number;
  due_this_week_open_count: number;
}

interface WeeklyReviewCountRow {
  count: number;
}

interface WeeklyReviewCompletedTaskRow extends Task {
  completed_at: string;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_WEEKLY_REVIEW_LIST_LIMIT = 8;
const TASK_STATUSES: TaskStatus[] = ["TODO", "DOING", "DONE", "ARCHIVED"];
const TASK_PRIORITIES: TaskPriority[] = ["URGENT", "NORMAL", "LOW"];
const PROJECT_STATUSES: ProjectStatus[] = ["ACTIVE", "COMPLETED", "ARCHIVED"];
const TASK_RECURRENCES: TaskRecurrence[] = [
  "NONE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
];
const TASK_CHANGELOG_ACTIONS: TaskChangelogAction[] = [
  "CREATED",
  "UPDATED",
  "STATUS_CHANGED",
];
const SYNC_ENTITY_TYPES: SyncEntityType[] = [
  "PROJECT",
  "TASK",
  "TASK_SUBTASK",
  "TASK_TEMPLATE",
  "SETTING",
];
const SYNC_OPERATIONS: SyncOperation[] = ["UPSERT", "DELETE"];
const SYNC_CONFLICT_TYPES: SyncConflictType[] = [
  "field_conflict",
  "delete_vs_update",
  "notes_collision",
  "validation_error",
];
const SYNC_CONFLICT_STATUSES: SyncConflictStatus[] = [
  "open",
  "resolved",
  "ignored",
];
const SYNC_CONFLICT_RESOLUTION_STRATEGIES: SyncConflictResolutionStrategy[] = [
  "keep_local",
  "keep_remote",
  "manual_merge",
  "retry",
];
const SYNC_CONFLICT_EVENT_TYPES: SyncConflictEventType[] = [
  "detected",
  "resolved",
  "ignored",
  "retried",
  "exported",
];
const SYNC_PROVIDERS: SyncProvider[] = [
  "provider_neutral",
  "google_appdata",
  "onedrive_approot",
  "icloud_cloudkit",
  "solostack_cloud_aws",
];
const SYNC_RUNTIME_PROFILE_SETTINGS: SyncRuntimeProfileSetting[] = [
  "desktop",
  "mobile_beta",
  "custom",
];
const DB_ERROR_CODES = {
  UNSUPPORTED_SYNC_ENTITY_TYPE: "DB_UNSUPPORTED_SYNC_ENTITY_TYPE",
  UNSUPPORTED_SYNC_OPERATION: "DB_UNSUPPORTED_SYNC_OPERATION",
  UNSUPPORTED_SYNC_CONFLICT_EVENT_TYPE:
    "DB_UNSUPPORTED_SYNC_CONFLICT_EVENT_TYPE",
  SELECTED_PROJECT_MISSING: "DB_SELECTED_PROJECT_MISSING",
  UNSUPPORTED_APP_LOCALE: "DB_UNSUPPORTED_APP_LOCALE",
  SYNC_ENDPOINTS_REQUIRE_BOTH: "DB_SYNC_ENDPOINTS_REQUIRE_BOTH",
  SYNC_ENDPOINTS_INVALID_URLS: "DB_SYNC_ENDPOINTS_INVALID_URLS",
  CONFLICT_ID_REQUIRED: "DB_CONFLICT_ID_REQUIRED",
  CONFLICT_NOT_FOUND: "DB_CONFLICT_NOT_FOUND",
  CONFLICT_STRATEGY_INVALID: "DB_CONFLICT_STRATEGY_INVALID",
  MANUAL_MERGE_PAYLOAD_REQUIRED: "DB_MANUAL_MERGE_PAYLOAD_REQUIRED",
  PROJECT_NAME_REQUIRED: "DB_PROJECT_NAME_REQUIRED",
  PROJECT_NAME_EXISTS: "DB_PROJECT_NAME_EXISTS",
  PROJECT_NOT_FOUND: "DB_PROJECT_NOT_FOUND",
  TASK_NOT_FOUND: "DB_TASK_NOT_FOUND",
  SUBTASK_TITLE_REQUIRED: "DB_SUBTASK_TITLE_REQUIRED",
  SUBTASK_NOT_FOUND: "DB_SUBTASK_NOT_FOUND",
  TEMPLATE_NAME_REQUIRED: "DB_TEMPLATE_NAME_REQUIRED",
  RECURRING_TEMPLATE_DUE_OFFSET_REQUIRED:
    "DB_RECURRING_TEMPLATE_DUE_OFFSET_REQUIRED",
  REMINDER_OFFSET_MUST_BE_EARLIER: "DB_REMINDER_OFFSET_MUST_BE_EARLIER",
  TEMPLATE_NAME_EXISTS: "DB_TEMPLATE_NAME_EXISTS",
  BACKUP_PAYLOAD_INVALID: "DB_BACKUP_PAYLOAD_INVALID",
  BACKUP_VERSION_UNSUPPORTED: "DB_BACKUP_VERSION_UNSUPPORTED",
  BACKUP_PAYLOAD_MISSING_DATA: "DB_BACKUP_PAYLOAD_MISSING_DATA",
  RESTORE_BLOCKED: "DB_RESTORE_BLOCKED",
  LATEST_BACKUP_NOT_FOUND: "DB_LATEST_BACKUP_NOT_FOUND",
  LATEST_BACKUP_CORRUPTED: "DB_LATEST_BACKUP_CORRUPTED",
} as const;
const SYNC_SETTINGS_DEVICE_ID_KEY = "sync.device_id";
const APP_LOCALE_KEY = "app.locale";
const APP_LOCALES: AppLocale[] = ["en", "th"];
const SYNC_SETTINGS_PUSH_URL_KEY = "local.sync.push_url";
const SYNC_SETTINGS_PULL_URL_KEY = "local.sync.pull_url";
const SYNC_SETTINGS_PROVIDER_KEY = "local.sync.provider";
const SYNC_SETTINGS_PROVIDER_CONFIG_KEY = "local.sync.provider_config";
const SYNC_SETTINGS_RUNTIME_PROFILE_KEY = "local.sync.runtime_profile";
const SYNC_SETTINGS_AUTO_INTERVAL_SECONDS_KEY =
  "local.sync.auto_interval_seconds";
const SYNC_SETTINGS_BACKGROUND_INTERVAL_SECONDS_KEY =
  "local.sync.background_interval_seconds";
const SYNC_SETTINGS_PUSH_LIMIT_KEY = "local.sync.push_limit";
const SYNC_SETTINGS_PULL_LIMIT_KEY = "local.sync.pull_limit";
const SYNC_SETTINGS_MAX_PULL_PAGES_KEY = "local.sync.max_pull_pages";
const SYNC_RUNTIME_SETTINGS_KEYS = [
  SYNC_SETTINGS_AUTO_INTERVAL_SECONDS_KEY,
  SYNC_SETTINGS_BACKGROUND_INTERVAL_SECONDS_KEY,
  SYNC_SETTINGS_PUSH_LIMIT_KEY,
  SYNC_SETTINGS_PULL_LIMIT_KEY,
  SYNC_SETTINGS_MAX_PULL_PAGES_KEY,
] as const;
const LOCAL_BACKUP_LATEST_PAYLOAD_KEY = "local.backup.latest_payload_v1";
const LOCAL_BACKUP_LATEST_EXPORTED_AT_KEY = "local.backup.latest_exported_at";
const DEFAULT_SYNC_AUTO_INTERVAL_SECONDS = 60;
const DEFAULT_SYNC_BACKGROUND_INTERVAL_SECONDS = 300;
const DEFAULT_SYNC_PUSH_LIMIT = 200;
const DEFAULT_SYNC_PULL_LIMIT = 200;
const DEFAULT_SYNC_MAX_PULL_PAGES = 5;
const MOBILE_SYNC_AUTO_INTERVAL_SECONDS = 120;
const MOBILE_SYNC_BACKGROUND_INTERVAL_SECONDS = 600;
const MOBILE_SYNC_PUSH_LIMIT = 120;
const MOBILE_SYNC_PULL_LIMIT = 120;
const MOBILE_SYNC_MAX_PULL_PAGES = 3;
const DEFAULT_SYNC_PROVIDER: SyncProvider = "provider_neutral";
const LOCAL_ONLY_SETTING_PREFIX = "local.";
const SYNC_CONFLICT_EVENT_MAX_PER_CONFLICT = 200;
const SYNC_CONFLICT_EVENT_RETENTION_DAYS = 90;

/** Get or create the database connection singleton */
async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load(DATABASE_NAME);
    await initSchema(dbInstance);
  }
  return dbInstance;
}

/** Create tables if they don't exist */
async function initSchema(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_version INTEGER NOT NULL DEFAULT 1,
      updated_by_device TEXT
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_projects_status_updated_at
    ON projects(status, updated_at DESC)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      notes_markdown TEXT,
      project_id TEXT,
      status TEXT NOT NULL CHECK(status IN ('TODO', 'DOING', 'DONE', 'ARCHIVED')),
      priority TEXT NOT NULL CHECK(priority IN ('URGENT', 'NORMAL', 'LOW')),
      is_important BOOLEAN DEFAULT 0,
      due_at DATETIME,
      remind_at DATETIME,
      recurrence TEXT NOT NULL DEFAULT 'NONE' CHECK(recurrence IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_version INTEGER NOT NULL DEFAULT 1,
      updated_by_device TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      duration_minutes INTEGER NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_changelogs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('CREATED', 'UPDATED', 'STATUS_CHANGED')),
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_task_changelogs_task_created_at
    ON task_changelogs(task_id, created_at DESC)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      title_template TEXT,
      description TEXT,
      priority TEXT NOT NULL CHECK(priority IN ('URGENT', 'NORMAL', 'LOW')),
      is_important BOOLEAN DEFAULT 0,
      due_offset_minutes INTEGER,
      remind_offset_minutes INTEGER,
      recurrence TEXT NOT NULL DEFAULT 'NONE' CHECK(recurrence IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_version INTEGER NOT NULL DEFAULT 1,
      updated_by_device TEXT
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_task_templates_updated_at
    ON task_templates(updated_at DESC)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_done BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_version INTEGER NOT NULL DEFAULT 1,
      updated_by_device TEXT,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_created_at
    ON task_subtasks(task_id, created_at ASC)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_checkpoints (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      last_sync_cursor TEXT,
      last_synced_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('PROJECT', 'TASK', 'TASK_SUBTASK', 'TASK_TEMPLATE', 'SETTING')),
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('UPSERT', 'DELETE')),
      payload_json TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_sync_outbox_created_at
    ON sync_outbox(created_at ASC)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS deleted_records (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('PROJECT', 'TASK', 'TASK_SUBTASK', 'TASK_TEMPLATE', 'SETTING')),
      entity_id TEXT NOT NULL,
      deleted_at DATETIME NOT NULL,
      deleted_by_device TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_type, entity_id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at
    ON deleted_records(deleted_at DESC)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      incoming_idempotency_key TEXT NOT NULL UNIQUE,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('PROJECT', 'TASK', 'TASK_SUBTASK', 'TASK_TEMPLATE', 'SETTING')),
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('UPSERT', 'DELETE')),
      conflict_type TEXT NOT NULL CHECK(conflict_type IN ('field_conflict', 'delete_vs_update', 'notes_collision', 'validation_error')),
      reason_code TEXT NOT NULL,
      message TEXT NOT NULL,
      local_payload_json TEXT,
      remote_payload_json TEXT,
      base_payload_json TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'ignored')),
      resolution_strategy TEXT CHECK(resolution_strategy IN ('keep_local', 'keep_remote', 'manual_merge', 'retry')),
      resolution_payload_json TEXT,
      resolved_by_device TEXT,
      detected_at DATETIME NOT NULL,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status_detected_at
    ON sync_conflicts(status, detected_at DESC)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity
    ON sync_conflicts(entity_type, entity_id, detected_at DESC)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_conflict_events (
      id TEXT PRIMARY KEY,
      conflict_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('detected', 'resolved', 'ignored', 'retried', 'exported')),
      event_payload_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(conflict_id) REFERENCES sync_conflicts(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_sync_conflict_events_conflict_created_at
    ON sync_conflict_events(conflict_id, created_at DESC)
  `);

  await ensureProjectColumns(db);
  await ensureTaskColumns(db);
  await ensureTaskTemplateColumns(db);
  await ensureTaskSubtaskColumns(db);
  await ensureSyncTablesReady(db);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_tasks_due_at
    ON tasks(due_at)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id
    ON tasks(project_id)
  `);
}

interface SQLiteTableInfoRow {
  name: string;
}

async function ensureProjectColumns(db: Database): Promise<void> {
  const tableInfo = await db.select<SQLiteTableInfoRow[]>(
    "PRAGMA table_info(projects)",
  );
  const existingColumns = new Set(tableInfo.map((column) => column.name));

  if (!existingColumns.has("sync_version")) {
    await db.execute(
      "ALTER TABLE projects ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1",
    );
  }

  if (!existingColumns.has("updated_by_device")) {
    await db.execute("ALTER TABLE projects ADD COLUMN updated_by_device TEXT");
  }
}

async function ensureTaskColumns(db: Database): Promise<void> {
  const tableInfo = await db.select<SQLiteTableInfoRow[]>(
    "PRAGMA table_info(tasks)",
  );
  const existingColumns = new Set(tableInfo.map((column) => column.name));

  if (!existingColumns.has("due_at")) {
    await db.execute("ALTER TABLE tasks ADD COLUMN due_at DATETIME");
  }

  if (!existingColumns.has("remind_at")) {
    await db.execute("ALTER TABLE tasks ADD COLUMN remind_at DATETIME");
  }

  if (!existingColumns.has("recurrence")) {
    await db.execute(
      "ALTER TABLE tasks ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'NONE' CHECK(recurrence IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY'))",
    );
  }

  if (!existingColumns.has("project_id")) {
    await db.execute("ALTER TABLE tasks ADD COLUMN project_id TEXT");
  }

  if (!existingColumns.has("notes_markdown")) {
    await db.execute("ALTER TABLE tasks ADD COLUMN notes_markdown TEXT");
  }

  if (!existingColumns.has("sync_version")) {
    await db.execute(
      "ALTER TABLE tasks ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1",
    );
  }

  if (!existingColumns.has("updated_by_device")) {
    await db.execute("ALTER TABLE tasks ADD COLUMN updated_by_device TEXT");
  }
}

async function ensureTaskTemplateColumns(db: Database): Promise<void> {
  const tableInfo = await db.select<SQLiteTableInfoRow[]>(
    "PRAGMA table_info(task_templates)",
  );
  const existingColumns = new Set(tableInfo.map((column) => column.name));

  if (!existingColumns.has("due_offset_minutes")) {
    await db.execute(
      "ALTER TABLE task_templates ADD COLUMN due_offset_minutes INTEGER",
    );
  }

  if (!existingColumns.has("remind_offset_minutes")) {
    await db.execute(
      "ALTER TABLE task_templates ADD COLUMN remind_offset_minutes INTEGER",
    );
  }

  if (!existingColumns.has("sync_version")) {
    await db.execute(
      "ALTER TABLE task_templates ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1",
    );
  }

  if (!existingColumns.has("updated_by_device")) {
    await db.execute(
      "ALTER TABLE task_templates ADD COLUMN updated_by_device TEXT",
    );
  }
}

async function ensureTaskSubtaskColumns(db: Database): Promise<void> {
  const tableInfo = await db.select<SQLiteTableInfoRow[]>(
    "PRAGMA table_info(task_subtasks)",
  );
  const existingColumns = new Set(tableInfo.map((column) => column.name));

  if (!existingColumns.has("sync_version")) {
    await db.execute(
      "ALTER TABLE task_subtasks ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1",
    );
  }

  if (!existingColumns.has("updated_by_device")) {
    await db.execute(
      "ALTER TABLE task_subtasks ADD COLUMN updated_by_device TEXT",
    );
  }
}

async function ensureSyncTablesReady(db: Database): Promise<void> {
  await db.execute(
    `INSERT OR IGNORE INTO sync_checkpoints (
        id,
        last_sync_cursor,
        last_synced_at,
        updated_at
      )
       VALUES (1, NULL, NULL, CURRENT_TIMESTAMP)`,
  );
}

async function insertTaskChangelog(
  db: Database,
  input: ChangelogInsert,
): Promise<void> {
  await db.execute(
    `INSERT INTO task_changelogs (id, task_id, action, field_name, old_value, new_value, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      uuidv4(),
      input.taskId,
      input.action,
      input.fieldName ?? null,
      input.oldValue ?? null,
      input.newValue ?? null,
      input.createdAt ?? new Date().toISOString(),
    ],
  );
}

function isTaskImportant(task: Task): boolean {
  return Boolean(task.is_important);
}

function parseDateTime(value: string | null): Date | null {
  if (!value) return null;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

function getLocalDayStart(reference: Date): Date {
  return new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
    0,
    0,
    0,
    0,
  );
}

function getLocalDayEnd(reference: Date): Date {
  return new Date(getLocalDayStart(reference).getTime() + MILLISECONDS_PER_DAY);
}

function getLocalWeekStart(reference: Date): Date {
  const weekStart = getLocalDayStart(reference);
  const dayOfWeek = weekStart.getDay(); // Sunday = 0
  const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - offsetToMonday);
  return weekStart;
}

function isOpenTask(task: Task): boolean {
  return task.status !== "DONE" && task.status !== "ARCHIVED";
}

function compareByDueDateAscending(leftTask: Task, rightTask: Task): number {
  const leftDueAt = parseDateTime(leftTask.due_at);
  const rightDueAt = parseDateTime(rightTask.due_at);

  if (leftDueAt && rightDueAt) {
    return leftDueAt.getTime() - rightDueAt.getTime();
  }
  if (leftDueAt) return -1;
  if (rightDueAt) return 1;

  return (
    new Date(rightTask.created_at).getTime() -
    new Date(leftTask.created_at).getTime()
  );
}

function getNextRecurringDueAt(
  currentDueAt: string,
  recurrence: TaskRecurrence,
): string | null {
  const currentDueDate = parseDateTime(currentDueAt);
  if (!currentDueDate || recurrence === "NONE") return null;

  const nextDueDate = new Date(currentDueDate);
  if (recurrence === "DAILY") {
    nextDueDate.setDate(nextDueDate.getDate() + 1);
  } else if (recurrence === "WEEKLY") {
    nextDueDate.setDate(nextDueDate.getDate() + 7);
  } else if (recurrence === "MONTHLY") {
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  }

  return nextDueDate.toISOString();
}

function shiftReminderWithDueDate(
  currentRemindAt: string | null,
  currentDueAt: string,
  nextDueAt: string,
): string | null {
  if (!currentRemindAt) return null;

  const remindDate = parseDateTime(currentRemindAt);
  const dueDate = parseDateTime(currentDueAt);
  const nextDueDate = parseDateTime(nextDueAt);
  if (!remindDate || !dueDate || !nextDueDate) return null;

  const offsetFromDue = remindDate.getTime() - dueDate.getTime();
  return new Date(nextDueDate.getTime() + offsetFromDue).toISOString();
}

function normalizeTemplateOffset(
  offsetInMinutes: number | null,
): number | null {
  if (offsetInMinutes === null || Number.isNaN(offsetInMinutes)) {
    return null;
  }
  return Math.max(0, Math.round(offsetInMinutes));
}

function normalizeTaskNotesMarkdown(
  notesMarkdown: string | null | undefined,
): string | null {
  if (typeof notesMarkdown !== "string") return null;

  const normalizedNotes = notesMarkdown.replace(/\r\n/g, "\n");
  if (!normalizedNotes.trim()) return null;
  return normalizedNotes;
}

function normalizeSubtaskTitle(title: string): string {
  return title.trim();
}

function normalizeProjectName(name: string): string {
  return name.trim();
}

function normalizeProjectStatus(
  status: ProjectStatus | undefined,
): ProjectStatus {
  return status ?? "ACTIVE";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  return value;
}

function asIsoDateStringOrNow(value: unknown): string {
  if (typeof value === "string" && !Number.isNaN(new Date(value).getTime())) {
    return value;
  }
  return new Date().toISOString();
}

function asBooleanSqliteNumber(value: unknown): number {
  if (value === true || value === 1 || value === "1") return 1;
  return 0;
}

function asIntegerOrDefault(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

function asNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  }
  return null;
}

function asTaskStatus(value: unknown): TaskStatus {
  if (
    typeof value === "string" &&
    TASK_STATUSES.includes(value as TaskStatus)
  ) {
    return value as TaskStatus;
  }
  return "TODO";
}

function asTaskPriority(value: unknown): TaskPriority {
  if (
    typeof value === "string" &&
    TASK_PRIORITIES.includes(value as TaskPriority)
  ) {
    return value as TaskPriority;
  }
  return "NORMAL";
}

function asProjectStatus(value: unknown): ProjectStatus {
  if (
    typeof value === "string" &&
    PROJECT_STATUSES.includes(value as ProjectStatus)
  ) {
    return value as ProjectStatus;
  }
  return "ACTIVE";
}

function asTaskRecurrence(value: unknown): TaskRecurrence {
  if (
    typeof value === "string" &&
    TASK_RECURRENCES.includes(value as TaskRecurrence)
  ) {
    return value as TaskRecurrence;
  }
  return "NONE";
}

function asTaskChangelogAction(value: unknown): TaskChangelogAction {
  if (
    typeof value === "string" &&
    TASK_CHANGELOG_ACTIONS.includes(value as TaskChangelogAction)
  ) {
    return value as TaskChangelogAction;
  }
  return "UPDATED";
}

function asSyncEntityType(value: unknown): SyncEntityType {
  if (
    typeof value === "string" &&
    SYNC_ENTITY_TYPES.includes(value as SyncEntityType)
  ) {
    return value as SyncEntityType;
  }
  throw new Error(DB_ERROR_CODES.UNSUPPORTED_SYNC_ENTITY_TYPE);
}

function asSyncOperation(value: unknown): SyncOperation {
  if (
    typeof value === "string" &&
    SYNC_OPERATIONS.includes(value as SyncOperation)
  ) {
    return value as SyncOperation;
  }
  throw new Error(DB_ERROR_CODES.UNSUPPORTED_SYNC_OPERATION);
}

function asSyncConflictType(value: unknown): SyncConflictType {
  if (
    typeof value === "string" &&
    SYNC_CONFLICT_TYPES.includes(value as SyncConflictType)
  ) {
    return value as SyncConflictType;
  }
  return "validation_error";
}

function asSyncConflictStatus(value: unknown): SyncConflictStatus {
  if (
    typeof value === "string" &&
    SYNC_CONFLICT_STATUSES.includes(value as SyncConflictStatus)
  ) {
    return value as SyncConflictStatus;
  }
  return "open";
}

function asSyncConflictResolutionStrategy(
  value: unknown,
): SyncConflictResolutionStrategy | null {
  if (
    typeof value === "string" &&
    SYNC_CONFLICT_RESOLUTION_STRATEGIES.includes(
      value as SyncConflictResolutionStrategy,
    )
  ) {
    return value as SyncConflictResolutionStrategy;
  }
  return null;
}

function asSyncConflictEventType(value: unknown): SyncConflictEventType {
  if (
    typeof value === "string" &&
    SYNC_CONFLICT_EVENT_TYPES.includes(value as SyncConflictEventType)
  ) {
    return value as SyncConflictEventType;
  }
  throw new Error(DB_ERROR_CODES.UNSUPPORTED_SYNC_CONFLICT_EVENT_TYPE);
}

function asSyncProvider(
  value: unknown,
  fallback: SyncProvider = DEFAULT_SYNC_PROVIDER,
): SyncProvider {
  if (
    typeof value === "string" &&
    SYNC_PROVIDERS.includes(value as SyncProvider)
  ) {
    return value as SyncProvider;
  }
  return fallback;
}

function asAppLocale(value: unknown): AppLocale | null {
  if (typeof value === "string" && APP_LOCALES.includes(value as AppLocale)) {
    return value as AppLocale;
  }
  return null;
}

function asSyncRuntimeProfileSetting(
  value: unknown,
  fallback: SyncRuntimeProfileSetting,
): SyncRuntimeProfileSetting {
  if (
    typeof value === "string" &&
    SYNC_RUNTIME_PROFILE_SETTINGS.includes(value as SyncRuntimeProfileSetting)
  ) {
    return value as SyncRuntimeProfileSetting;
  }
  return fallback;
}

function normalizeSyncProviderConfigObject(
  value: unknown,
): Record<string, unknown> | null {
  if (!isPlainObject(value)) return null;
  return value;
}

function parseSyncProviderConfigValue(
  value: unknown,
): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return normalizeSyncProviderConfigObject(JSON.parse(value));
  } catch {
    return null;
  }
}

async function assertProjectExists(
  db: Database,
  projectId: string | null | undefined,
): Promise<void> {
  if (!projectId) return;

  const rows = await db.select<{ id: string }[]>(
    "SELECT id FROM projects WHERE id = $1 LIMIT 1",
    [projectId],
  );
  if (rows.length === 0) {
    throw new Error(DB_ERROR_CODES.SELECTED_PROJECT_MISSING);
  }
}

async function insertTaskSubtask(
  db: Database,
  input: CreateTaskSubtaskInput,
  deviceId: string,
  nowIso = new Date().toISOString(),
): Promise<TaskSubtask | null> {
  const normalizedTitle = normalizeSubtaskTitle(input.title);
  if (!normalizedTitle) return null;

  const subtaskId = uuidv4();

  await db.execute(
    `INSERT INTO task_subtasks (
        id,
        task_id,
        title,
        is_done,
        created_at,
        updated_at,
        sync_version,
        updated_by_device
      )
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
    [
      subtaskId,
      input.task_id,
      normalizedTitle,
      input.is_done ? 1 : 0,
      nowIso,
      nowIso,
      deviceId,
    ],
  );

  const rows = await db.select<TaskSubtask[]>(
    "SELECT * FROM task_subtasks WHERE id = $1 LIMIT 1",
    [subtaskId],
  );
  return rows[0] ?? null;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const db = await getDb();
  const rows = await db.select<AppSettingRecord[]>(
    "SELECT key, value FROM settings WHERE key = $1 LIMIT 1",
    [SYNC_SETTINGS_DEVICE_ID_KEY],
  );
  const existingDeviceId = rows[0]?.value?.trim() ?? "";
  if (existingDeviceId) {
    return existingDeviceId;
  }

  const generatedDeviceId = uuidv4();
  await db.execute(
    `INSERT INTO settings (key, value)
         VALUES ($1, $2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [SYNC_SETTINGS_DEVICE_ID_KEY, generatedDeviceId],
  );
  return generatedDeviceId;
}

export async function getAppLocaleSetting(): Promise<AppLocaleSetting> {
  const db = await getDb();
  const rows = await db.select<AppSettingRecord[]>(
    "SELECT key, value FROM settings WHERE key = $1 LIMIT 1",
    [APP_LOCALE_KEY],
  );
  const locale = asAppLocale(rows[0]?.value ?? null);
  return {
    locale,
  };
}

export async function updateAppLocaleSetting(
  input: UpdateAppLocaleSettingInput,
): Promise<AppLocaleSetting> {
  const db = await getDb();
  const locale = asAppLocale(input.locale);
  if (!locale) {
    throw new Error(DB_ERROR_CODES.UNSUPPORTED_APP_LOCALE);
  }
  await db.execute(
    `INSERT INTO settings (key, value)
         VALUES ($1, $2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [APP_LOCALE_KEY, locale],
  );
  return {
    locale,
  };
}

export async function getSyncEndpointSettings(): Promise<SyncEndpointSettings> {
  const db = await getDb();
  const rows = await db.select<AppSettingRecord[]>(
    "SELECT key, value FROM settings WHERE key IN ($1, $2)",
    [SYNC_SETTINGS_PUSH_URL_KEY, SYNC_SETTINGS_PULL_URL_KEY],
  );

  let pushUrl: string | null = null;
  let pullUrl: string | null = null;
  for (const row of rows) {
    if (row.key === SYNC_SETTINGS_PUSH_URL_KEY) {
      pushUrl = normalizeSyncEndpointUrl(row.value);
    } else if (row.key === SYNC_SETTINGS_PULL_URL_KEY) {
      pullUrl = normalizeSyncEndpointUrl(row.value);
    }
  }

  return {
    push_url: pushUrl,
    pull_url: pullUrl,
  };
}

export async function updateSyncEndpointSettings(
  input: UpdateSyncEndpointSettingsInput,
): Promise<SyncEndpointSettings> {
  const db = await getDb();
  const pushUrl = normalizeSyncEndpointUrl(input.push_url);
  const pullUrl = normalizeSyncEndpointUrl(input.pull_url);
  const hasPushUrl = Boolean(pushUrl);
  const hasPullUrl = Boolean(pullUrl);

  if (hasPushUrl !== hasPullUrl) {
    throw new Error(DB_ERROR_CODES.SYNC_ENDPOINTS_REQUIRE_BOTH);
  }

  if (
    pushUrl &&
    (!isValidSyncEndpointUrl(pushUrl) || !isValidSyncEndpointUrl(pullUrl ?? ""))
  ) {
    throw new Error(DB_ERROR_CODES.SYNC_ENDPOINTS_INVALID_URLS);
  }

  await db.execute("BEGIN IMMEDIATE");
  try {
    if (pushUrl) {
      await db.execute(
        `INSERT INTO settings (key, value)
             VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [SYNC_SETTINGS_PUSH_URL_KEY, pushUrl],
      );
      await db.execute(
        `INSERT INTO settings (key, value)
             VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [SYNC_SETTINGS_PULL_URL_KEY, pullUrl],
      );
    } else {
      await db.execute("DELETE FROM settings WHERE key IN ($1, $2)", [
        SYNC_SETTINGS_PUSH_URL_KEY,
        SYNC_SETTINGS_PULL_URL_KEY,
      ]);
    }
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }

  return {
    push_url: pushUrl,
    pull_url: pullUrl,
  };
}

export async function getSyncProviderSettings(): Promise<SyncProviderSettings> {
  const db = await getDb();
  const rows = await db.select<AppSettingRecord[]>(
    "SELECT key, value FROM settings WHERE key IN ($1, $2)",
    [SYNC_SETTINGS_PROVIDER_KEY, SYNC_SETTINGS_PROVIDER_CONFIG_KEY],
  );

  let provider: SyncProvider = DEFAULT_SYNC_PROVIDER;
  let providerConfig: Record<string, unknown> | null = null;

  for (const row of rows) {
    if (row.key === SYNC_SETTINGS_PROVIDER_KEY) {
      provider = asSyncProvider(row.value, DEFAULT_SYNC_PROVIDER);
    } else if (row.key === SYNC_SETTINGS_PROVIDER_CONFIG_KEY) {
      providerConfig = parseSyncProviderConfigValue(row.value);
    }
  }

  return {
    provider,
    provider_config: providerConfig,
  };
}

export async function updateSyncProviderSettings(
  input: UpdateSyncProviderSettingsInput,
): Promise<SyncProviderSettings> {
  const db = await getDb();
  const provider = asSyncProvider(input.provider, DEFAULT_SYNC_PROVIDER);
  const providerConfig = normalizeSyncProviderConfigObject(
    input.provider_config ?? null,
  );
  const providerConfigJson = providerConfig
    ? JSON.stringify(providerConfig)
    : null;

  await db.execute("BEGIN IMMEDIATE");
  try {
    await db.execute(
      `INSERT INTO settings (key, value)
           VALUES ($1, $2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [SYNC_SETTINGS_PROVIDER_KEY, provider],
    );
    if (providerConfigJson) {
      await db.execute(
        `INSERT INTO settings (key, value)
             VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [SYNC_SETTINGS_PROVIDER_CONFIG_KEY, providerConfigJson],
      );
    } else {
      await db.execute("DELETE FROM settings WHERE key = $1", [
        SYNC_SETTINGS_PROVIDER_CONFIG_KEY,
      ]);
    }
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }

  return {
    provider,
    provider_config: providerConfig,
  };
}

function getSyncRuntimeDefaultsByPreset(
  preset: SyncRuntimeProfilePreset,
): SyncRuntimeSettings {
  if (preset === "mobile") {
    return {
      auto_sync_interval_seconds: MOBILE_SYNC_AUTO_INTERVAL_SECONDS,
      background_sync_interval_seconds: MOBILE_SYNC_BACKGROUND_INTERVAL_SECONDS,
      push_limit: MOBILE_SYNC_PUSH_LIMIT,
      pull_limit: MOBILE_SYNC_PULL_LIMIT,
      max_pull_pages: MOBILE_SYNC_MAX_PULL_PAGES,
    };
  }

  return {
    auto_sync_interval_seconds: DEFAULT_SYNC_AUTO_INTERVAL_SECONDS,
    background_sync_interval_seconds: DEFAULT_SYNC_BACKGROUND_INTERVAL_SECONDS,
    push_limit: DEFAULT_SYNC_PUSH_LIMIT,
    pull_limit: DEFAULT_SYNC_PULL_LIMIT,
    max_pull_pages: DEFAULT_SYNC_MAX_PULL_PAGES,
  };
}

function getSyncRuntimeProfileDefaultByPreset(
  preset: SyncRuntimeProfilePreset,
): SyncRuntimeProfileSetting {
  return preset === "mobile" ? "mobile_beta" : "desktop";
}

function toSyncRuntimeSettingsEntries(
  settings: SyncRuntimeSettings,
): Array<[string, string]> {
  return [
    [
      SYNC_SETTINGS_AUTO_INTERVAL_SECONDS_KEY,
      String(settings.auto_sync_interval_seconds),
    ],
    [
      SYNC_SETTINGS_BACKGROUND_INTERVAL_SECONDS_KEY,
      String(settings.background_sync_interval_seconds),
    ],
    [SYNC_SETTINGS_PUSH_LIMIT_KEY, String(settings.push_limit)],
    [SYNC_SETTINGS_PULL_LIMIT_KEY, String(settings.pull_limit)],
    [SYNC_SETTINGS_MAX_PULL_PAGES_KEY, String(settings.max_pull_pages)],
  ];
}

export async function getSyncRuntimeProfileSettings(
  preset: SyncRuntimeProfilePreset = "desktop",
): Promise<SyncRuntimeProfileSettings> {
  const db = await getDb();
  const rows = await db.select<AppSettingRecord[]>(
    "SELECT key, value FROM settings WHERE key = $1 LIMIT 1",
    [SYNC_SETTINGS_RUNTIME_PROFILE_KEY],
  );

  return {
    runtime_profile: asSyncRuntimeProfileSetting(
      rows[0]?.value,
      getSyncRuntimeProfileDefaultByPreset(preset),
    ),
  };
}

export async function ensureSyncRuntimeSettingsSeeded(
  preset: SyncRuntimeProfilePreset = "desktop",
): Promise<SyncRuntimeSettings> {
  const db = await getDb();
  const existingRows = await db.select<Array<{ key: string }>>(
    "SELECT key FROM settings WHERE key IN ($1, $2, $3, $4, $5, $6, $7) LIMIT 32",
    [
      SYNC_SETTINGS_AUTO_INTERVAL_SECONDS_KEY,
      SYNC_SETTINGS_BACKGROUND_INTERVAL_SECONDS_KEY,
      SYNC_SETTINGS_PUSH_LIMIT_KEY,
      SYNC_SETTINGS_PULL_LIMIT_KEY,
      SYNC_SETTINGS_MAX_PULL_PAGES_KEY,
      SYNC_SETTINGS_PROVIDER_KEY,
      SYNC_SETTINGS_RUNTIME_PROFILE_KEY,
    ],
  );

  const existingKeys = new Set(existingRows.map((row) => row.key));
  const hasAllRuntimeSettingKeys = SYNC_RUNTIME_SETTINGS_KEYS.every((key) =>
    existingKeys.has(key),
  );
  const requiresSeed =
    !hasAllRuntimeSettingKeys ||
    !existingKeys.has(SYNC_SETTINGS_PROVIDER_KEY) ||
    !existingKeys.has(SYNC_SETTINGS_RUNTIME_PROFILE_KEY);
  if (!requiresSeed) {
    return getSyncRuntimeSettings();
  }

  const seededSettings = getSyncRuntimeDefaultsByPreset(preset);
  const runtimeProfileDefault = getSyncRuntimeProfileDefaultByPreset(preset);

  await db.execute("BEGIN IMMEDIATE");
  try {
    for (const [key, value] of toSyncRuntimeSettingsEntries(seededSettings)) {
      if (existingKeys.has(key)) continue;
      await db.execute(
        `INSERT INTO settings (key, value)
             VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    }

    if (!existingKeys.has(SYNC_SETTINGS_PROVIDER_KEY)) {
      await db.execute(
        `INSERT INTO settings (key, value)
             VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [SYNC_SETTINGS_PROVIDER_KEY, DEFAULT_SYNC_PROVIDER],
      );
    }

    if (!existingKeys.has(SYNC_SETTINGS_RUNTIME_PROFILE_KEY)) {
      await db.execute(
        `INSERT INTO settings (key, value)
             VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [SYNC_SETTINGS_RUNTIME_PROFILE_KEY, runtimeProfileDefault],
      );
    }
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }

  return getSyncRuntimeSettings();
}

export async function getSyncRuntimeSettings(): Promise<SyncRuntimeSettings> {
  const db = await getDb();
  const rows = await db.select<AppSettingRecord[]>(
    "SELECT key, value FROM settings WHERE key IN ($1, $2, $3, $4, $5)",
    [
      SYNC_SETTINGS_AUTO_INTERVAL_SECONDS_KEY,
      SYNC_SETTINGS_BACKGROUND_INTERVAL_SECONDS_KEY,
      SYNC_SETTINGS_PUSH_LIMIT_KEY,
      SYNC_SETTINGS_PULL_LIMIT_KEY,
      SYNC_SETTINGS_MAX_PULL_PAGES_KEY,
    ],
  );

  let autoSyncIntervalSeconds = DEFAULT_SYNC_AUTO_INTERVAL_SECONDS;
  let backgroundSyncIntervalSeconds = DEFAULT_SYNC_BACKGROUND_INTERVAL_SECONDS;
  let pushLimit = DEFAULT_SYNC_PUSH_LIMIT;
  let pullLimit = DEFAULT_SYNC_PULL_LIMIT;
  let maxPullPages = DEFAULT_SYNC_MAX_PULL_PAGES;

  for (const row of rows) {
    if (row.key === SYNC_SETTINGS_AUTO_INTERVAL_SECONDS_KEY) {
      autoSyncIntervalSeconds = normalizeSyncRuntimeNumber(row.value, {
        min: 15,
        max: 3600,
        fallback: DEFAULT_SYNC_AUTO_INTERVAL_SECONDS,
      });
    } else if (row.key === SYNC_SETTINGS_BACKGROUND_INTERVAL_SECONDS_KEY) {
      backgroundSyncIntervalSeconds = normalizeSyncRuntimeNumber(row.value, {
        min: 30,
        max: 7200,
        fallback: DEFAULT_SYNC_BACKGROUND_INTERVAL_SECONDS,
      });
    } else if (row.key === SYNC_SETTINGS_PUSH_LIMIT_KEY) {
      pushLimit = normalizeSyncRuntimeNumber(row.value, {
        min: 20,
        max: 500,
        fallback: DEFAULT_SYNC_PUSH_LIMIT,
      });
    } else if (row.key === SYNC_SETTINGS_PULL_LIMIT_KEY) {
      pullLimit = normalizeSyncRuntimeNumber(row.value, {
        min: 20,
        max: 500,
        fallback: DEFAULT_SYNC_PULL_LIMIT,
      });
    } else if (row.key === SYNC_SETTINGS_MAX_PULL_PAGES_KEY) {
      maxPullPages = normalizeSyncRuntimeNumber(row.value, {
        min: 1,
        max: 20,
        fallback: DEFAULT_SYNC_MAX_PULL_PAGES,
      });
    }
  }

  return {
    auto_sync_interval_seconds: autoSyncIntervalSeconds,
    background_sync_interval_seconds: Math.max(
      autoSyncIntervalSeconds,
      backgroundSyncIntervalSeconds,
    ),
    push_limit: pushLimit,
    pull_limit: pullLimit,
    max_pull_pages: maxPullPages,
  };
}

export async function updateSyncRuntimeSettings(
  input: UpdateSyncRuntimeSettingsInput,
): Promise<SyncRuntimeSettings> {
  const db = await getDb();
  const runtimeProfile = asSyncRuntimeProfileSetting(
    input.runtime_profile,
    "custom",
  );
  const autoSyncIntervalSeconds = normalizeSyncRuntimeNumber(
    input.auto_sync_interval_seconds,
    {
      min: 15,
      max: 3600,
      fallback: DEFAULT_SYNC_AUTO_INTERVAL_SECONDS,
    },
  );
  const backgroundSyncIntervalSeconds = Math.max(
    autoSyncIntervalSeconds,
    normalizeSyncRuntimeNumber(input.background_sync_interval_seconds, {
      min: 30,
      max: 7200,
      fallback: DEFAULT_SYNC_BACKGROUND_INTERVAL_SECONDS,
    }),
  );
  const pushLimit = normalizeSyncRuntimeNumber(input.push_limit, {
    min: 20,
    max: 500,
    fallback: DEFAULT_SYNC_PUSH_LIMIT,
  });
  const pullLimit = normalizeSyncRuntimeNumber(input.pull_limit, {
    min: 20,
    max: 500,
    fallback: DEFAULT_SYNC_PULL_LIMIT,
  });
  const maxPullPages = normalizeSyncRuntimeNumber(input.max_pull_pages, {
    min: 1,
    max: 20,
    fallback: DEFAULT_SYNC_MAX_PULL_PAGES,
  });

  await db.execute("BEGIN IMMEDIATE");
  try {
    for (const [key, value] of toSyncRuntimeSettingsEntries({
      auto_sync_interval_seconds: autoSyncIntervalSeconds,
      background_sync_interval_seconds: backgroundSyncIntervalSeconds,
      push_limit: pushLimit,
      pull_limit: pullLimit,
      max_pull_pages: maxPullPages,
    })) {
      await db.execute(
        `INSERT INTO settings (key, value)
             VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    }
    await db.execute(
      `INSERT INTO settings (key, value)
           VALUES ($1, $2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [SYNC_SETTINGS_RUNTIME_PROFILE_KEY, runtimeProfile],
    );

    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }

  return {
    auto_sync_interval_seconds: autoSyncIntervalSeconds,
    background_sync_interval_seconds: backgroundSyncIntervalSeconds,
    push_limit: pushLimit,
    pull_limit: pullLimit,
    max_pull_pages: maxPullPages,
  };
}

async function enqueueEntityUpsert(
  entityType: SyncEntityType,
  entityId: string,
  payload: unknown,
  createdAt?: string,
): Promise<void> {
  const normalizedPayload = isPlainObject(payload) ? payload : {};
  await enqueueSyncOutboxChange({
    entity_type: entityType,
    entity_id: entityId,
    operation: "UPSERT",
    payload: normalizedPayload,
    created_at: createdAt,
  });
}

async function enqueueEntityDelete(
  entityType: SyncEntityType,
  entityId: string,
  deviceId: string,
  deletedAt: string,
): Promise<void> {
  await upsertDeletedRecord({
    entity_type: entityType,
    entity_id: entityId,
    deleted_by_device: deviceId,
    deleted_at: deletedAt,
  });
  await enqueueSyncOutboxChange({
    entity_type: entityType,
    entity_id: entityId,
    operation: "DELETE",
    payload: null,
    created_at: deletedAt,
  });
}

export async function getSyncCheckpoint(): Promise<SyncCheckpoint> {
  const db = await getDb();
  const rows = await db.select<SyncCheckpoint[]>(
    `SELECT
        id,
        last_sync_cursor,
        last_synced_at,
        updated_at
       FROM sync_checkpoints
      WHERE id = 1
      LIMIT 1`,
  );
  if (rows[0]) return rows[0];

  await ensureSyncTablesReady(db);
  const fallbackRows = await db.select<SyncCheckpoint[]>(
    `SELECT
        id,
        last_sync_cursor,
        last_synced_at,
        updated_at
       FROM sync_checkpoints
      WHERE id = 1
      LIMIT 1`,
  );
  return (
    fallbackRows[0] ?? {
      id: 1,
      last_sync_cursor: null,
      last_synced_at: null,
      updated_at: new Date().toISOString(),
    }
  );
}

export async function setSyncCheckpoint(
  cursor: string | null,
  syncedAt = new Date().toISOString(),
): Promise<void> {
  const db = await getDb();
  await ensureSyncTablesReady(db);
  await db.execute(
    `UPDATE sync_checkpoints
        SET last_sync_cursor = $1,
            last_synced_at = $2,
            updated_at = $2
      WHERE id = 1`,
    [cursor, syncedAt],
  );
}

export async function enqueueSyncOutboxChange(input: {
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperation;
  payload?: Record<string, unknown> | null;
  idempotency_key?: string;
  created_at?: string;
}): Promise<SyncOutboxRecord> {
  const db = await getDb();
  const nowIso = input.created_at ?? new Date().toISOString();
  const outboxId = uuidv4();
  const idempotencyKey = input.idempotency_key?.trim() || uuidv4();

  await db.execute(
    `INSERT INTO sync_outbox (
        id,
        entity_type,
        entity_id,
        operation,
        payload_json,
        idempotency_key,
        attempts,
        last_error,
        created_at,
        updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, 0, NULL, $7, $7)`,
    [
      outboxId,
      asSyncEntityType(input.entity_type),
      input.entity_id,
      asSyncOperation(input.operation),
      input.payload ? JSON.stringify(input.payload) : null,
      idempotencyKey,
      nowIso,
    ],
  );

  const rows = await db.select<SyncOutboxRecord[]>(
    "SELECT * FROM sync_outbox WHERE id = $1 LIMIT 1",
    [outboxId],
  );
  return rows[0];
}

export async function listSyncOutboxChanges(
  limit = 200,
): Promise<SyncOutboxRecord[]> {
  const db = await getDb();
  const normalizedLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
  return db.select<SyncOutboxRecord[]>(
    `SELECT *
       FROM sync_outbox
      ORDER BY created_at ASC, id ASC
      LIMIT $1`,
    [normalizedLimit],
  );
}

export async function markSyncOutboxChangeFailed(
  id: string,
  error: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE sync_outbox
        SET attempts = attempts + 1,
            last_error = $1,
            updated_at = $2
      WHERE id = $3`,
    [error, new Date().toISOString(), id],
  );
}

export async function removeSyncOutboxChanges(ids: string[]): Promise<void> {
  const db = await getDb();
  const normalizedIds = Array.from(
    new Set(ids.map((id) => id.trim()).filter(Boolean)),
  );
  if (normalizedIds.length === 0) return;

  const placeholders = normalizedIds
    .map((_, index) => `$${index + 1}`)
    .join(", ");
  await db.execute(
    `DELETE FROM sync_outbox
      WHERE id IN (${placeholders})`,
    normalizedIds,
  );
}

export async function upsertDeletedRecord(input: {
  entity_type: SyncEntityType;
  entity_id: string;
  deleted_by_device?: string | null;
  deleted_at?: string;
}): Promise<DeletedRecord> {
  const db = await getDb();
  const recordId = uuidv4();
  const deletedAt = input.deleted_at ?? new Date().toISOString();

  await db.execute(
    `INSERT INTO deleted_records (
        id,
        entity_type,
        entity_id,
        deleted_at,
        deleted_by_device,
        created_at,
        updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $4, $4)
    ON CONFLICT(entity_type, entity_id) DO UPDATE SET
      deleted_at = excluded.deleted_at,
      deleted_by_device = excluded.deleted_by_device,
      updated_at = excluded.updated_at`,
    [
      recordId,
      asSyncEntityType(input.entity_type),
      input.entity_id,
      deletedAt,
      input.deleted_by_device ?? null,
    ],
  );

  const rows = await db.select<DeletedRecord[]>(
    `SELECT *
       FROM deleted_records
      WHERE entity_type = $1 AND entity_id = $2
      LIMIT 1`,
    [input.entity_type, input.entity_id],
  );
  return rows[0];
}

export async function listDeletedRecords(
  limit = 200,
): Promise<DeletedRecord[]> {
  const db = await getDb();
  const normalizedLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
  return db.select<DeletedRecord[]>(
    `SELECT *
       FROM deleted_records
      ORDER BY deleted_at DESC, id DESC
      LIMIT $1`,
    [normalizedLimit],
  );
}

interface PersistSyncConflictInput {
  change: SyncPushChange;
  conflict_type: SyncConflictType;
  reason_code: string;
  message: string;
  local_payload: Record<string, unknown> | null;
  remote_payload: Record<string, unknown> | null;
  base_payload?: Record<string, unknown> | null;
}

function toJsonString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

async function addSyncConflictEvent(
  db: Database,
  input: {
    conflict_id: string;
    event_type: SyncConflictEventType;
    event_payload?: Record<string, unknown> | null;
    created_at?: string;
  },
): Promise<void> {
  const nowIso = input.created_at ?? new Date().toISOString();
  await db.execute(
    `INSERT INTO sync_conflict_events (
        id,
        conflict_id,
        event_type,
        event_payload_json,
        created_at
      )
       VALUES ($1, $2, $3, $4, $5)`,
    [
      uuidv4(),
      input.conflict_id,
      asSyncConflictEventType(input.event_type),
      toJsonString(input.event_payload),
      nowIso,
    ],
  );
  await pruneSyncConflictEvents(db, input.conflict_id, nowIso);
}

async function pruneSyncConflictEvents(
  db: Database,
  conflictId: string,
  retentionAnchorIso: string,
): Promise<void> {
  await db.execute(
    `DELETE FROM sync_conflict_events
      WHERE conflict_id = $1
        AND id NOT IN (
          SELECT id
            FROM sync_conflict_events
           WHERE conflict_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT $2
        )`,
    [conflictId, SYNC_CONFLICT_EVENT_MAX_PER_CONFLICT],
  );

  const retentionAnchorDate = new Date(retentionAnchorIso);
  const effectiveRetentionAnchor = Number.isNaN(retentionAnchorDate.getTime())
    ? new Date()
    : retentionAnchorDate;
  const cutoffDate = new Date(effectiveRetentionAnchor.getTime());
  cutoffDate.setUTCDate(
    cutoffDate.getUTCDate() - SYNC_CONFLICT_EVENT_RETENTION_DAYS,
  );
  const cutoffIso = cutoffDate.toISOString();

  await db.execute(
    `DELETE FROM sync_conflict_events
      WHERE created_at < $1`,
    [cutoffIso],
  );
}

async function enqueueConflictResolutionOutboxChange(
  db: Database,
  input: {
    conflict_id: string;
    strategy: SyncConflictResolutionStrategy;
    resolved_by_device: string;
    resolution_payload: Record<string, unknown> | null;
    created_at: string;
  },
): Promise<string> {
  const resolutionSettingKey = `${LOCAL_ONLY_SETTING_PREFIX}sync.conflict_resolution.${input.conflict_id}`;
  const resolutionSettingValue = JSON.stringify({
    conflict_id: input.conflict_id,
    strategy: input.strategy,
    resolved_by_device: input.resolved_by_device,
    resolved_at: input.created_at,
    resolution_payload: input.resolution_payload ?? null,
  });
  const idempotencyKey = createSyncIdempotencyKey(
    input.resolved_by_device,
    `conflict-resolution:${input.conflict_id}:${input.strategy}`,
  );
  const outboxPayload = JSON.stringify({
    key: resolutionSettingKey,
    value: resolutionSettingValue,
  });

  await db.execute(
    `INSERT INTO settings (key, value)
         VALUES ($1, $2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [resolutionSettingKey, resolutionSettingValue],
  );

  await db.execute(
    `INSERT INTO sync_outbox (
        id,
        entity_type,
        entity_id,
        operation,
        payload_json,
        idempotency_key,
        attempts,
        last_error,
        created_at,
        updated_at
      )
       VALUES ($1, 'SETTING', $2, 'UPSERT', $3, $4, 0, NULL, $5, $5)
    ON CONFLICT(idempotency_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at,
      last_error = NULL`,
    [
      uuidv4(),
      resolutionSettingKey,
      outboxPayload,
      idempotencyKey,
      input.created_at,
    ],
  );

  return idempotencyKey;
}

async function getSyncEntityPayloadSnapshot(
  db: Database,
  entityType: SyncEntityType,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  if (entityType === "PROJECT") {
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM projects WHERE id = $1 LIMIT 1",
      [entityId],
    );
    return rows[0] ?? null;
  }

  if (entityType === "TASK") {
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM tasks WHERE id = $1 LIMIT 1",
      [entityId],
    );
    return rows[0] ?? null;
  }

  if (entityType === "TASK_SUBTASK") {
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM task_subtasks WHERE id = $1 LIMIT 1",
      [entityId],
    );
    return rows[0] ?? null;
  }

  if (entityType === "TASK_TEMPLATE") {
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM task_templates WHERE id = $1 LIMIT 1",
      [entityId],
    );
    return rows[0] ?? null;
  }

  const rows = await db.select<AppSettingRecord[]>(
    "SELECT key, value FROM settings WHERE key = $1 LIMIT 1",
    [entityId],
  );
  const settingRow = rows[0];
  if (!settingRow) return null;
  return {
    key: settingRow.key,
    value: settingRow.value,
  };
}

async function persistIncomingSyncConflict(
  db: Database,
  input: PersistSyncConflictInput,
): Promise<"conflict" | "skipped"> {
  const nowIso = new Date().toISOString();
  const incomingIdempotencyKey =
    input.change.idempotency_key.trim() ||
    `${input.change.entity_type}:${input.change.entity_id}:${input.change.updated_at}`;

  const existingRows = await db.select<
    Array<{ id: string; status: SyncConflictStatus }>
  >(
    `SELECT id, status
       FROM sync_conflicts
      WHERE incoming_idempotency_key = $1
      LIMIT 1`,
    [incomingIdempotencyKey],
  );
  const existing = existingRows[0];

  if (
    existing &&
    (existing.status === "resolved" || existing.status === "ignored")
  ) {
    await addSyncConflictEvent(db, {
      conflict_id: existing.id,
      event_type: "retried",
      event_payload: {
        reason: "incoming_change_repeated",
        reason_code: input.reason_code,
      },
      created_at: nowIso,
    });
    return "skipped";
  }

  const entityId = input.change.entity_id.trim();
  const conflictId = existing?.id ?? uuidv4();
  const remotePayloadJson = toJsonString(input.remote_payload);
  const localPayloadJson = toJsonString(input.local_payload);
  const basePayloadJson = toJsonString(input.base_payload ?? null);

  if (existing) {
    await db.execute(
      `UPDATE sync_conflicts
          SET entity_type = $1,
              entity_id = $2,
              operation = $3,
              conflict_type = $4,
              reason_code = $5,
              message = $6,
              local_payload_json = $7,
              remote_payload_json = $8,
              base_payload_json = $9,
              status = 'open',
              resolution_strategy = NULL,
              resolution_payload_json = NULL,
              resolved_by_device = NULL,
              resolved_at = NULL,
              detected_at = $10,
              updated_at = $10
        WHERE id = $11`,
      [
        asSyncEntityType(input.change.entity_type),
        entityId,
        asSyncOperation(input.change.operation),
        asSyncConflictType(input.conflict_type),
        input.reason_code,
        input.message,
        localPayloadJson,
        remotePayloadJson,
        basePayloadJson,
        nowIso,
        conflictId,
      ],
    );
  } else {
    await db.execute(
      `INSERT INTO sync_conflicts (
          id,
          incoming_idempotency_key,
          entity_type,
          entity_id,
          operation,
          conflict_type,
          reason_code,
          message,
          local_payload_json,
          remote_payload_json,
          base_payload_json,
          status,
          resolution_strategy,
          resolution_payload_json,
          resolved_by_device,
          detected_at,
          resolved_at,
          created_at,
          updated_at
        )
         VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, 'open', NULL, NULL, NULL, $12, NULL, $12, $12
         )`,
      [
        conflictId,
        incomingIdempotencyKey,
        asSyncEntityType(input.change.entity_type),
        entityId,
        asSyncOperation(input.change.operation),
        asSyncConflictType(input.conflict_type),
        input.reason_code,
        input.message,
        localPayloadJson,
        remotePayloadJson,
        basePayloadJson,
        nowIso,
      ],
    );
  }

  await addSyncConflictEvent(db, {
    conflict_id: conflictId,
    event_type: "detected",
    event_payload: {
      reason_code: input.reason_code,
      message: input.message,
      entity_type: input.change.entity_type,
      entity_id: entityId,
      operation: input.change.operation,
    },
    created_at: nowIso,
  });

  return "conflict";
}

async function persistAndReturnConflict(
  db: Database,
  change: SyncPushChange,
  input: {
    conflict_type: SyncConflictType;
    reason_code: string;
    message: string;
    remote_payload: Record<string, unknown> | null;
  },
): Promise<"conflict" | "skipped"> {
  const entityId = change.entity_id.trim();
  const localPayload = entityId
    ? await getSyncEntityPayloadSnapshot(db, change.entity_type, entityId)
    : null;

  return persistIncomingSyncConflict(db, {
    change,
    conflict_type: input.conflict_type,
    reason_code: input.reason_code,
    message: input.message,
    local_payload: localPayload,
    remote_payload: input.remote_payload,
  });
}

async function markConflictResolvedByAppliedIncomingChange(
  db: Database,
  change: SyncPushChange,
): Promise<void> {
  const incomingIdempotencyKey = change.idempotency_key.trim();
  if (!incomingIdempotencyKey) return;

  const rows = await db.select<Array<{ id: string }>>(
    `SELECT id
       FROM sync_conflicts
      WHERE incoming_idempotency_key = $1
        AND status = 'open'`,
    [incomingIdempotencyKey],
  );
  if (rows.length === 0) return;

  const nowIso = new Date().toISOString();
  for (const row of rows) {
    await db.execute(
      `UPDATE sync_conflicts
          SET status = 'resolved',
              resolution_strategy = 'retry',
              resolved_by_device = $1,
              resolved_at = $2,
              updated_at = $2
        WHERE id = $3`,
      [change.updated_by_device, nowIso, row.id],
    );
    await addSyncConflictEvent(db, {
      conflict_id: row.id,
      event_type: "resolved",
      event_payload: {
        strategy: "retry",
        reason: "incoming_change_applied",
      },
      created_at: nowIso,
    });
  }
}

export async function listSyncConflicts(input?: {
  status?: SyncConflictStatus | "all";
  limit?: number;
}): Promise<SyncConflictRecord[]> {
  const db = await getDb();
  const normalizedLimit = Math.max(
    1,
    Math.min(1000, Math.trunc(input?.limit ?? 100)),
  );
  const requestedStatus = input?.status ?? "open";
  if (requestedStatus === "all") {
    return db.select<SyncConflictRecord[]>(
      `SELECT *
         FROM sync_conflicts
        ORDER BY
          CASE status
            WHEN 'open' THEN 0
            WHEN 'resolved' THEN 1
            ELSE 2
          END ASC,
          detected_at DESC,
          id DESC
        LIMIT $1`,
      [normalizedLimit],
    );
  }

  const normalizedStatus = asSyncConflictStatus(requestedStatus);
  return db.select<SyncConflictRecord[]>(
    `SELECT *
       FROM sync_conflicts
      WHERE status = $1
      ORDER BY detected_at DESC, id DESC
      LIMIT $2`,
    [normalizedStatus, normalizedLimit],
  );
}

export async function getSyncConflict(
  conflictId: string,
): Promise<SyncConflictRecord | null> {
  const db = await getDb();
  const normalizedConflictId = conflictId.trim();
  if (!normalizedConflictId) return null;

  const rows = await db.select<SyncConflictRecord[]>(
    `SELECT *
       FROM sync_conflicts
      WHERE id = $1
      LIMIT 1`,
    [normalizedConflictId],
  );
  return rows[0] ?? null;
}

export async function listSyncConflictEvents(
  conflictId: string,
  limit = 200,
): Promise<SyncConflictEventRecord[]> {
  const db = await getDb();
  const normalizedConflictId = conflictId.trim();
  if (!normalizedConflictId) return [];

  const normalizedLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
  return db.select<SyncConflictEventRecord[]>(
    `SELECT *
       FROM sync_conflict_events
      WHERE conflict_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [normalizedConflictId, normalizedLimit],
  );
}

interface SyncConflictStatusCountRow {
  status: SyncConflictStatus;
  count: number;
}

interface SyncConflictEventCountRow {
  event_type: SyncConflictEventType;
  count: number;
}

interface SyncConflictResolutionWindowRow {
  detected_at: string;
  resolved_at: string;
}

interface SyncConflictLatestTimestampsRow {
  latest_detected_at: string | null;
  latest_resolved_at: string | null;
}

function toResolutionDurationMs(input: {
  detected_at: string;
  resolved_at: string;
}): number | null {
  const detectedAtMs = Date.parse(input.detected_at);
  const resolvedAtMs = Date.parse(input.resolved_at);
  if (!Number.isFinite(detectedAtMs) || !Number.isFinite(resolvedAtMs)) {
    return null;
  }
  if (resolvedAtMs < detectedAtMs) return null;
  return Math.floor(resolvedAtMs - detectedAtMs);
}

function calculateMedianValue(values: number[]): number | null {
  if (values.length === 0) return null;
  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex];
  }
  return Math.round(
    (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2,
  );
}

function toRatePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function getSyncConflictObservabilityCounters(): Promise<SyncConflictObservabilityCounters> {
  const db = await getDb();
  await ensureSyncTablesReady(db);
  const [statusRows, eventRows, resolutionWindowRows, latestTimestampRows] =
    await Promise.all([
      db.select<SyncConflictStatusCountRow[]>(
        `SELECT status, COUNT(*) as count
         FROM sync_conflicts
        GROUP BY status`,
      ),
      db.select<SyncConflictEventCountRow[]>(
        `SELECT event_type, COUNT(*) as count
         FROM sync_conflict_events
        GROUP BY event_type`,
      ),
      db.select<SyncConflictResolutionWindowRow[]>(
        `SELECT detected_at, resolved_at
         FROM sync_conflicts
        WHERE status = 'resolved'
          AND resolved_at IS NOT NULL`,
      ),
      db.select<SyncConflictLatestTimestampsRow[]>(
        `SELECT
          (SELECT detected_at
             FROM sync_conflicts
            ORDER BY detected_at DESC, id DESC
            LIMIT 1) as latest_detected_at,
          (SELECT resolved_at
             FROM sync_conflicts
            WHERE resolved_at IS NOT NULL
            ORDER BY resolved_at DESC, id DESC
            LIMIT 1) as latest_resolved_at`,
      ),
    ]);

  const statusCounts: Record<SyncConflictStatus, number> = {
    open: 0,
    resolved: 0,
    ignored: 0,
  };
  for (const row of statusRows) {
    const status = asSyncConflictStatus(row.status);
    statusCounts[status] = Math.max(0, Number(row.count ?? 0));
  }

  const eventCounts: Record<SyncConflictEventType, number> = {
    detected: 0,
    resolved: 0,
    ignored: 0,
    retried: 0,
    exported: 0,
  };
  for (const row of eventRows) {
    const eventType = asSyncConflictEventType(row.event_type);
    eventCounts[eventType] = Math.max(0, Number(row.count ?? 0));
  }

  const totalConflicts =
    statusCounts.open + statusCounts.resolved + statusCounts.ignored;
  const medianResolutionTimeMs = calculateMedianValue(
    resolutionWindowRows
      .map((row) => toResolutionDurationMs(row))
      .filter((value): value is number => value !== null),
  );
  const latestTimestamps = latestTimestampRows[0] ?? {
    latest_detected_at: null,
    latest_resolved_at: null,
  };

  return {
    total_conflicts: totalConflicts,
    open_conflicts: statusCounts.open,
    resolved_conflicts: statusCounts.resolved,
    ignored_conflicts: statusCounts.ignored,
    retried_events: eventCounts.retried,
    exported_events: eventCounts.exported,
    resolution_rate_percent: toRatePercent(
      statusCounts.resolved,
      totalConflicts,
    ),
    median_resolution_time_ms: medianResolutionTimeMs,
    latest_detected_at: latestTimestamps.latest_detected_at,
    latest_resolved_at: latestTimestamps.latest_resolved_at,
  };
}

export async function exportSyncConflictReport(input?: {
  status?: SyncConflictStatus | "all";
  limit?: number;
  eventsPerConflict?: number;
}): Promise<SyncConflictReportPayload> {
  const db = await getDb();
  const statusFilter = input?.status ?? "all";
  const conflicts = await listSyncConflicts({
    status: statusFilter,
    limit: input?.limit ?? 500,
  });
  const eventsPerConflict = Math.max(
    1,
    Math.min(1000, Math.trunc(input?.eventsPerConflict ?? 50)),
  );
  const exportedAt = new Date().toISOString();

  for (const conflict of conflicts) {
    await addSyncConflictEvent(db, {
      conflict_id: conflict.id,
      event_type: "exported",
      event_payload: {
        report_exported_at: exportedAt,
      },
      created_at: exportedAt,
    });
  }

  const items = await Promise.all(
    conflicts.map(async (conflict) => ({
      conflict,
      events: await listSyncConflictEvents(conflict.id, eventsPerConflict),
    })),
  );

  return {
    version: 1,
    exported_at: exportedAt,
    total_conflicts: conflicts.length,
    status_filter: statusFilter,
    items,
  };
}

export async function resolveSyncConflict(
  input: ResolveSyncConflictInput,
): Promise<SyncConflictRecord> {
  const db = await getDb();
  await ensureSyncTablesReady(db);
  const conflictId = input.conflict_id.trim();
  if (!conflictId) {
    throw new Error(DB_ERROR_CODES.CONFLICT_ID_REQUIRED);
  }
  const existingConflict = await getSyncConflict(conflictId);
  if (!existingConflict) {
    throw new Error(DB_ERROR_CODES.CONFLICT_NOT_FOUND);
  }

  const strategy = asSyncConflictResolutionStrategy(input.strategy);
  if (!strategy) {
    throw new Error(DB_ERROR_CODES.CONFLICT_STRATEGY_INVALID);
  }
  if (
    strategy === "manual_merge" &&
    (!input.resolution_payload ||
      !isPlainObject(input.resolution_payload) ||
      Object.keys(input.resolution_payload).length === 0)
  ) {
    throw new Error(DB_ERROR_CODES.MANUAL_MERGE_PAYLOAD_REQUIRED);
  }

  const nowIso = new Date().toISOString();
  const resolvedByDevice =
    input.resolved_by_device?.trim() || (await getOrCreateDeviceId());
  const normalizedResolutionPayload =
    input.resolution_payload && isPlainObject(input.resolution_payload)
      ? input.resolution_payload
      : null;
  const nextStatus: SyncConflictStatus =
    strategy === "retry" ? "open" : "resolved";
  const nextResolvedAt = nextStatus === "resolved" ? nowIso : null;
  const resolutionOutboxIdempotencyKey =
    await enqueueConflictResolutionOutboxChange(db, {
      conflict_id: conflictId,
      strategy,
      resolved_by_device: resolvedByDevice,
      resolution_payload: normalizedResolutionPayload,
      created_at: nowIso,
    });

  await db.execute(
    `UPDATE sync_conflicts
        SET status = $1,
            resolution_strategy = $2,
            resolution_payload_json = $3,
            resolved_by_device = $4,
            resolved_at = $5,
            updated_at = $6
      WHERE id = $7`,
    [
      nextStatus,
      strategy,
      toJsonString(normalizedResolutionPayload),
      resolvedByDevice,
      nextResolvedAt,
      nowIso,
      conflictId,
    ],
  );

  await addSyncConflictEvent(db, {
    conflict_id: conflictId,
    event_type: strategy === "retry" ? "retried" : "resolved",
    event_payload: {
      strategy,
      resolved_by_device: resolvedByDevice,
      status: nextStatus,
      idempotency_key: resolutionOutboxIdempotencyKey,
    },
    created_at: nowIso,
  });

  const updated = await getSyncConflict(conflictId);
  if (!updated) {
    throw new Error(DB_ERROR_CODES.CONFLICT_NOT_FOUND);
  }

  return updated;
}

interface SyncEntityVersionState {
  exists: boolean;
  updated_at: string | null;
  updated_by_device: string | null;
}

function normalizeDeviceIdForLww(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function toComparableTimestamp(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate.getTime();
}

function shouldApplyIncomingLww(
  existing: SyncEntityVersionState,
  incoming: Pick<SyncPushChange, "updated_at" | "updated_by_device">,
): boolean {
  if (!existing.exists) return true;

  const incomingTime = toComparableTimestamp(incoming.updated_at);
  if (incomingTime === null) return false;

  const existingTime = toComparableTimestamp(existing.updated_at);
  if (existingTime === null) return true;

  if (incomingTime > existingTime) return true;
  if (incomingTime < existingTime) return false;

  return (
    normalizeDeviceIdForLww(incoming.updated_by_device) >=
    normalizeDeviceIdForLww(existing.updated_by_device)
  );
}

function normalizeSyncVersion(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.floor(value);
}

function normalizeOptionalText(value: unknown): string | null {
  const text = asNullableString(value)?.trim() ?? "";
  return text || null;
}

function normalizeSyncEndpointUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function isValidSyncEndpointUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSyncRuntimeNumber(
  value: unknown,
  input: {
    min: number;
    max: number;
    fallback: number;
  },
): number {
  const parsed = asIntegerOrDefault(value, input.fallback);
  if (parsed < input.min) return input.min;
  if (parsed > input.max) return input.max;
  return parsed;
}

async function getSyncEntityVersionState(
  db: Database,
  entityType: SyncEntityType,
  entityId: string,
): Promise<SyncEntityVersionState> {
  if (entityType === "PROJECT") {
    const rows = await db.select<
      Array<{ updated_at: string; updated_by_device: string | null }>
    >(
      "SELECT updated_at, updated_by_device FROM projects WHERE id = $1 LIMIT 1",
      [entityId],
    );
    const row = rows[0];
    return {
      exists: Boolean(row),
      updated_at: row?.updated_at ?? null,
      updated_by_device: row?.updated_by_device ?? null,
    };
  }

  if (entityType === "TASK") {
    const rows = await db.select<
      Array<{ updated_at: string; updated_by_device: string | null }>
    >("SELECT updated_at, updated_by_device FROM tasks WHERE id = $1 LIMIT 1", [
      entityId,
    ]);
    const row = rows[0];
    return {
      exists: Boolean(row),
      updated_at: row?.updated_at ?? null,
      updated_by_device: row?.updated_by_device ?? null,
    };
  }

  if (entityType === "TASK_SUBTASK") {
    const rows = await db.select<
      Array<{ updated_at: string; updated_by_device: string | null }>
    >(
      "SELECT updated_at, updated_by_device FROM task_subtasks WHERE id = $1 LIMIT 1",
      [entityId],
    );
    const row = rows[0];
    return {
      exists: Boolean(row),
      updated_at: row?.updated_at ?? null,
      updated_by_device: row?.updated_by_device ?? null,
    };
  }

  if (entityType === "TASK_TEMPLATE") {
    const rows = await db.select<
      Array<{ updated_at: string; updated_by_device: string | null }>
    >(
      "SELECT updated_at, updated_by_device FROM task_templates WHERE id = $1 LIMIT 1",
      [entityId],
    );
    const row = rows[0];
    return {
      exists: Boolean(row),
      updated_at: row?.updated_at ?? null,
      updated_by_device: row?.updated_by_device ?? null,
    };
  }

  const rows = await db.select<Array<{ key: string }>>(
    "SELECT key FROM settings WHERE key = $1 LIMIT 1",
    [entityId],
  );
  return {
    exists: rows.length > 0,
    updated_at: null,
    updated_by_device: null,
  };
}

export async function applyIncomingSyncChange(
  change: SyncPushChange,
): Promise<"applied" | "skipped" | "conflict"> {
  const db = await getDb();
  const entityId = change.entity_id.trim();
  if (!entityId) return "skipped";

  const isSettingEntity = change.entity_type === "SETTING";
  if (
    isSettingEntity &&
    (entityId === SYNC_SETTINGS_DEVICE_ID_KEY ||
      entityId.startsWith(LOCAL_ONLY_SETTING_PREFIX))
  ) {
    // Keep local-only settings stable per installation.
    return "skipped";
  }

  const payload =
    change.operation === "UPSERT" && isPlainObject(change.payload)
      ? change.payload
      : {};
  const remotePayload =
    change.operation === "UPSERT" && isPlainObject(change.payload)
      ? change.payload
      : null;

  if (!isSettingEntity) {
    const existingState = await getSyncEntityVersionState(
      db,
      change.entity_type,
      entityId,
    );
    if (!shouldApplyIncomingLww(existingState, change)) {
      return "skipped";
    }
  }

  const normalizedSyncVersion = normalizeSyncVersion(change.sync_version);

  if (change.operation === "UPSERT") {
    if (change.entity_type === "PROJECT") {
      const name = normalizeProjectName(asNullableString(payload.name) ?? "");
      if (!name) {
        return persistAndReturnConflict(db, change, {
          conflict_type: "field_conflict",
          reason_code: "MISSING_PROJECT_NAME",
          message: "Project name is required in incoming payload.",
          remote_payload: remotePayload,
        });
      }

      await db.execute(
        `INSERT INTO projects (
            id,
            name,
            description,
            color,
            status,
            created_at,
            updated_at,
            sync_version,
            updated_by_device
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          color = excluded.color,
          status = excluded.status,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          sync_version = excluded.sync_version,
          updated_by_device = excluded.updated_by_device`,
        [
          entityId,
          name,
          normalizeOptionalText(payload.description),
          normalizeOptionalText(payload.color),
          asProjectStatus(payload.status),
          asIsoDateStringOrNow(payload.created_at),
          change.updated_at,
          normalizedSyncVersion,
          change.updated_by_device,
        ],
      );
    } else if (change.entity_type === "TASK") {
      const title = asNullableString(payload.title)?.trim() ?? "";
      if (isMissingTaskTitleConflict(title)) {
        return persistAndReturnConflict(db, change, {
          conflict_type: "field_conflict",
          reason_code: "MISSING_TASK_TITLE",
          message: "Task title is required in incoming payload.",
          remote_payload: remotePayload,
        });
      }

      const existingTaskRows = await db.select<
        Array<{
          updated_at: string;
          updated_by_device: string | null;
          notes_markdown: string | null;
        }>
      >(
        "SELECT updated_at, updated_by_device, notes_markdown FROM tasks WHERE id = $1 LIMIT 1",
        [entityId],
      );
      const existingTask = existingTaskRows[0];
      const incomingNotesMarkdown = normalizeTaskNotesMarkdown(
        asNullableString(payload.notes_markdown),
      );
      const incomingTouchesNotesMarkdown = Object.prototype.hasOwnProperty.call(
        payload,
        "notes_markdown",
      );
      if (
        existingTask &&
        isTaskNotesCollision({
          existing_updated_at: existingTask.updated_at,
          existing_updated_by_device: existingTask.updated_by_device,
          existing_notes_markdown: normalizeTaskNotesMarkdown(
            existingTask.notes_markdown,
          ),
          incoming_updated_at: change.updated_at,
          incoming_updated_by_device: change.updated_by_device,
          incoming_notes_markdown: incomingNotesMarkdown,
          incoming_touches_notes_markdown: incomingTouchesNotesMarkdown,
        })
      ) {
        return persistAndReturnConflict(db, change, {
          conflict_type: "notes_collision",
          reason_code: "TASK_NOTES_COLLISION",
          message: "Incoming task notes collide with locally edited notes.",
          remote_payload: remotePayload,
        });
      }

      const incomingProjectId = normalizeOptionalText(payload.project_id);
      let projectId: string | null = incomingProjectId;
      if (incomingProjectId) {
        const projectRows = await db.select<Array<{ id: string }>>(
          "SELECT id FROM projects WHERE id = $1 LIMIT 1",
          [incomingProjectId],
        );
        if (
          isTaskProjectNotFoundConflict({
            incoming_project_id: incomingProjectId,
            project_exists: projectRows.length > 0,
          })
        ) {
          return persistAndReturnConflict(db, change, {
            conflict_type: "delete_vs_update",
            reason_code: "TASK_PROJECT_NOT_FOUND",
            message:
              "Incoming task references a project that does not exist locally.",
            remote_payload: remotePayload,
          });
        }
      } else {
        projectId = null;
      }

      await db.execute(
        `INSERT INTO tasks (
            id,
            title,
            description,
            notes_markdown,
            project_id,
            status,
            priority,
            is_important,
            due_at,
            remind_at,
            recurrence,
            created_at,
            updated_at,
            sync_version,
            updated_by_device
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          notes_markdown = excluded.notes_markdown,
          project_id = excluded.project_id,
          status = excluded.status,
          priority = excluded.priority,
          is_important = excluded.is_important,
          due_at = excluded.due_at,
          remind_at = excluded.remind_at,
          recurrence = excluded.recurrence,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          sync_version = excluded.sync_version,
          updated_by_device = excluded.updated_by_device`,
        [
          entityId,
          title,
          normalizeOptionalText(payload.description),
          incomingNotesMarkdown,
          projectId,
          asTaskStatus(payload.status),
          asTaskPriority(payload.priority),
          asBooleanSqliteNumber(payload.is_important),
          normalizeOptionalText(payload.due_at),
          normalizeOptionalText(payload.remind_at),
          asTaskRecurrence(payload.recurrence),
          asIsoDateStringOrNow(payload.created_at),
          change.updated_at,
          normalizedSyncVersion,
          change.updated_by_device,
        ],
      );
    } else if (change.entity_type === "TASK_SUBTASK") {
      const taskId = normalizeOptionalText(payload.task_id);
      const title = asNullableString(payload.title)?.trim() ?? "";
      if (!taskId || !title) {
        return persistAndReturnConflict(db, change, {
          conflict_type: "field_conflict",
          reason_code: "INVALID_SUBTASK_PAYLOAD",
          message: "Subtask payload requires task_id and title.",
          remote_payload: remotePayload,
        });
      }

      const taskRows = await db.select<Array<{ id: string }>>(
        "SELECT id FROM tasks WHERE id = $1 LIMIT 1",
        [taskId],
      );
      if (taskRows.length === 0) {
        return persistAndReturnConflict(db, change, {
          conflict_type: "delete_vs_update",
          reason_code: "SUBTASK_TASK_NOT_FOUND",
          message:
            "Incoming subtask references a task that does not exist locally.",
          remote_payload: remotePayload,
        });
      }

      await db.execute(
        `INSERT INTO task_subtasks (
            id,
            task_id,
            title,
            is_done,
            created_at,
            updated_at,
            sync_version,
            updated_by_device
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(id) DO UPDATE SET
          task_id = excluded.task_id,
          title = excluded.title,
          is_done = excluded.is_done,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          sync_version = excluded.sync_version,
          updated_by_device = excluded.updated_by_device`,
        [
          entityId,
          taskId,
          title,
          asBooleanSqliteNumber(payload.is_done),
          asIsoDateStringOrNow(payload.created_at),
          change.updated_at,
          normalizedSyncVersion,
          change.updated_by_device,
        ],
      );
    } else if (change.entity_type === "TASK_TEMPLATE") {
      const name = asNullableString(payload.name)?.trim() ?? "";
      if (!name) {
        return persistAndReturnConflict(db, change, {
          conflict_type: "field_conflict",
          reason_code: "MISSING_TEMPLATE_NAME",
          message: "Task template name is required in incoming payload.",
          remote_payload: remotePayload,
        });
      }

      await db.execute(
        `INSERT INTO task_templates (
            id,
            name,
            title_template,
            description,
            priority,
            is_important,
            due_offset_minutes,
            remind_offset_minutes,
            recurrence,
            created_at,
            updated_at,
            sync_version,
            updated_by_device
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          title_template = excluded.title_template,
          description = excluded.description,
          priority = excluded.priority,
          is_important = excluded.is_important,
          due_offset_minutes = excluded.due_offset_minutes,
          remind_offset_minutes = excluded.remind_offset_minutes,
          recurrence = excluded.recurrence,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          sync_version = excluded.sync_version,
          updated_by_device = excluded.updated_by_device`,
        [
          entityId,
          name,
          normalizeOptionalText(payload.title_template),
          normalizeOptionalText(payload.description),
          asTaskPriority(payload.priority),
          asBooleanSqliteNumber(payload.is_important),
          asNullableInteger(payload.due_offset_minutes),
          asNullableInteger(payload.remind_offset_minutes),
          asTaskRecurrence(payload.recurrence),
          asIsoDateStringOrNow(payload.created_at),
          change.updated_at,
          normalizedSyncVersion,
          change.updated_by_device,
        ],
      );
    } else {
      const value =
        typeof payload.value === "string"
          ? payload.value
          : payload.value === undefined || payload.value === null
            ? ""
            : JSON.stringify(payload.value);
      await db.execute(
        `INSERT INTO settings (key, value)
             VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [entityId, value],
      );
    }

    await db.execute(
      "DELETE FROM deleted_records WHERE entity_type = $1 AND entity_id = $2",
      [change.entity_type, entityId],
    );
    await markConflictResolvedByAppliedIncomingChange(db, change);
    return "applied";
  }

  if (change.entity_type === "PROJECT") {
    await db.execute("DELETE FROM projects WHERE id = $1", [entityId]);
  } else if (change.entity_type === "TASK") {
    await db.execute("DELETE FROM tasks WHERE id = $1", [entityId]);
  } else if (change.entity_type === "TASK_SUBTASK") {
    await db.execute("DELETE FROM task_subtasks WHERE id = $1", [entityId]);
  } else if (change.entity_type === "TASK_TEMPLATE") {
    await db.execute("DELETE FROM task_templates WHERE id = $1", [entityId]);
  } else {
    await db.execute("DELETE FROM settings WHERE key = $1", [entityId]);
  }

  await upsertDeletedRecord({
    entity_type: change.entity_type,
    entity_id: entityId,
    deleted_by_device: change.updated_by_device,
    deleted_at: change.updated_at,
  });
  await markConflictResolvedByAppliedIncomingChange(db, change);
  return "applied";
}

/** Fetch all non-archived tasks, newest first */
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  const results = await db.select<Task[]>(
    "SELECT * FROM tasks WHERE status != 'ARCHIVED' ORDER BY created_at DESC",
  );
  return results;
}

/** Fetch projects ordered by status and latest updates */
export async function getProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.select<Project[]>(
    `SELECT *
       FROM projects
      WHERE status != 'ARCHIVED'
      ORDER BY
        CASE status
          WHEN 'ACTIVE' THEN 0
          WHEN 'COMPLETED' THEN 1
          ELSE 2
        END ASC,
        updated_at DESC,
        name COLLATE NOCASE ASC`,
  );
}

/** Create a new project */
export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const db = await getDb();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();
  const normalizedName = normalizeProjectName(input.name);
  if (!normalizedName) {
    throw new Error(DB_ERROR_CODES.PROJECT_NAME_REQUIRED);
  }

  const duplicateRows = await db.select<{ id: string }[]>(
    "SELECT id FROM projects WHERE LOWER(name) = LOWER($1) LIMIT 1",
    [normalizedName],
  );
  if (duplicateRows.length > 0) {
    throw new Error(DB_ERROR_CODES.PROJECT_NAME_EXISTS);
  }

  const projectId = uuidv4();
  await db.execute(
    `INSERT INTO projects (
        id,
        name,
        description,
        color,
        status,
        created_at,
        updated_at,
        sync_version,
        updated_by_device
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)`,
    [
      projectId,
      normalizedName,
      input.description?.trim() || null,
      input.color?.trim() || null,
      normalizeProjectStatus(input.status),
      now,
      now,
      deviceId,
    ],
  );

  const rows = await db.select<Project[]>(
    "SELECT * FROM projects WHERE id = $1 LIMIT 1",
    [projectId],
  );
  const createdProject = rows[0];
  await enqueueEntityUpsert("PROJECT", createdProject.id, createdProject, now);
  return createdProject;
}

/** Update an existing project */
export async function updateProject(
  input: UpdateProjectInput,
): Promise<Project> {
  const db = await getDb();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();
  const existingRows = await db.select<Project[]>(
    "SELECT * FROM projects WHERE id = $1 LIMIT 1",
    [input.id],
  );
  const existingProject = existingRows[0];
  if (!existingProject) {
    throw new Error(DB_ERROR_CODES.PROJECT_NOT_FOUND);
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    const normalizedName = normalizeProjectName(input.name);
    if (!normalizedName) {
      throw new Error(DB_ERROR_CODES.PROJECT_NAME_REQUIRED);
    }

    const duplicateRows = await db.select<{ id: string }[]>(
      "SELECT id FROM projects WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1",
      [normalizedName, input.id],
    );
    if (duplicateRows.length > 0) {
      throw new Error(DB_ERROR_CODES.PROJECT_NAME_EXISTS);
    }

    setClauses.push(`name = $${paramIndex++}`);
    params.push(normalizedName);
  }

  if (input.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    params.push(input.description?.trim() || null);
  }

  if (input.color !== undefined) {
    setClauses.push(`color = $${paramIndex++}`);
    params.push(input.color?.trim() || null);
  }

  if (input.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    params.push(normalizeProjectStatus(input.status));
  }

  if (setClauses.length === 0) {
    return existingProject;
  }

  setClauses.push("sync_version = COALESCE(sync_version, 0) + 1");
  setClauses.push(`updated_by_device = $${paramIndex++}`);
  params.push(deviceId);
  setClauses.push(`updated_at = $${paramIndex++}`);
  params.push(now);
  params.push(input.id);

  await db.execute(
    `UPDATE projects
        SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}`,
    params,
  );

  const rows = await db.select<Project[]>(
    "SELECT * FROM projects WHERE id = $1 LIMIT 1",
    [input.id],
  );
  const updatedProject = rows[0];
  await enqueueEntityUpsert("PROJECT", updatedProject.id, updatedProject, now);
  return updatedProject;
}

/** Delete a project and unassign all linked tasks */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();

  const projectRows = await db.select<Project[]>(
    "SELECT * FROM projects WHERE id = $1 LIMIT 1",
    [id],
  );
  const project = projectRows[0];
  if (!project) return;

  const affectedTasks = await db.select<Task[]>(
    "SELECT * FROM tasks WHERE project_id = $1",
    [id],
  );
  await db.execute(
    `UPDATE tasks
        SET project_id = NULL,
            sync_version = COALESCE(sync_version, 0) + 1,
            updated_by_device = $2,
            updated_at = $3
      WHERE project_id = $1`,
    [id, deviceId, now],
  );
  for (const task of affectedTasks) {
    const rows = await db.select<Task[]>(
      "SELECT * FROM tasks WHERE id = $1 LIMIT 1",
      [task.id],
    );
    const updatedTask = rows[0];
    if (!updatedTask) continue;
    await enqueueEntityUpsert("TASK", updatedTask.id, updatedTask, now);
  }

  await db.execute("DELETE FROM projects WHERE id = $1", [id]);
  await enqueueEntityDelete("PROJECT", project.id, deviceId, now);
}

/** Create a new task and return it */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();

  await assertProjectExists(db, input.project_id ?? null);

  await db.execute(
    `INSERT INTO tasks (
      id,
      title,
      description,
      notes_markdown,
      project_id,
      status,
      priority,
      is_important,
      due_at,
      remind_at,
      recurrence,
      created_at,
      updated_at,
      sync_version,
      updated_by_device
    )
     VALUES ($1, $2, $3, $4, $5, 'TODO', $6, $7, $8, $9, $10, $11, $12, 1, $13)`,
    [
      id,
      input.title,
      input.description ?? null,
      normalizeTaskNotesMarkdown(input.notes_markdown ?? null),
      input.project_id ?? null,
      input.priority,
      input.is_important ? 1 : 0,
      input.due_at ?? null,
      input.remind_at ?? null,
      input.recurrence ?? "NONE",
      now,
      now,
      deviceId,
    ],
  );

  await insertTaskChangelog(db, {
    taskId: id,
    action: "CREATED",
    newValue: input.title,
    createdAt: now,
  });

  const subtasks = (input.subtasks ?? [])
    .map((subtask) => ({
      title: normalizeSubtaskTitle(subtask.title),
      is_done: Boolean(subtask.is_done),
    }))
    .filter((subtask) => subtask.title.length > 0);

  const createdSubtasks: TaskSubtask[] = [];
  for (const subtask of subtasks) {
    const createdSubtask = await insertTaskSubtask(
      db,
      {
        task_id: id,
        title: subtask.title,
        is_done: subtask.is_done,
      },
      deviceId,
      now,
    );
    if (createdSubtask) {
      createdSubtasks.push(createdSubtask);
    }
  }

  const rows = await db.select<Task[]>("SELECT * FROM tasks WHERE id = $1", [
    id,
  ]);
  const createdTask = rows[0];
  await enqueueEntityUpsert("TASK", createdTask.id, createdTask, now);
  for (const subtask of createdSubtasks) {
    await enqueueEntityUpsert("TASK_SUBTASK", subtask.id, subtask, now);
  }
  return createdTask;
}

/** Update an existing task */
export async function updateTask(input: UpdateTaskInput): Promise<Task> {
  const db = await getDb();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();
  const existingRows = await db.select<Task[]>(
    "SELECT * FROM tasks WHERE id = $1",
    [input.id],
  );
  const existingTask = existingRows[0];

  if (!existingTask) {
    throw new Error(DB_ERROR_CODES.TASK_NOT_FOUND);
  }

  // Build dynamic SET clause — only update provided fields
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  const changes: TaskChangeDiff[] = [];

  if (input.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    params.push(input.title);
    if (input.title !== existingTask.title) {
      changes.push({
        action: "UPDATED",
        fieldName: "title",
        oldValue: existingTask.title,
        newValue: input.title,
      });
    }
  }
  if (input.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    params.push(input.description);
    const oldDescription = existingTask.description ?? null;
    const newDescription = input.description ?? null;

    if (oldDescription !== newDescription) {
      changes.push({
        action: "UPDATED",
        fieldName: "description",
        oldValue: oldDescription,
        newValue: newDescription,
      });
    }
  }
  if (input.notes_markdown !== undefined) {
    const normalizedNotesMarkdown = normalizeTaskNotesMarkdown(
      input.notes_markdown,
    );
    setClauses.push(`notes_markdown = $${paramIndex++}`);
    params.push(normalizedNotesMarkdown);
    const oldNotesMarkdown = existingTask.notes_markdown ?? null;
    const newNotesMarkdown = normalizedNotesMarkdown ?? null;
    if (oldNotesMarkdown !== newNotesMarkdown) {
      changes.push({
        action: "UPDATED",
        fieldName: "notes_markdown",
        oldValue: oldNotesMarkdown,
        newValue: newNotesMarkdown,
      });
    }
  }
  if (input.project_id !== undefined) {
    await assertProjectExists(db, input.project_id ?? null);
    setClauses.push(`project_id = $${paramIndex++}`);
    params.push(input.project_id ?? null);
    const oldProjectId = existingTask.project_id ?? null;
    const newProjectId = input.project_id ?? null;
    if (oldProjectId !== newProjectId) {
      changes.push({
        action: "UPDATED",
        fieldName: "project_id",
        oldValue: oldProjectId,
        newValue: newProjectId,
      });
    }
  }
  if (input.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    params.push(input.status);
    if (input.status !== existingTask.status) {
      changes.push({
        action: "STATUS_CHANGED",
        fieldName: "status",
        oldValue: existingTask.status,
        newValue: input.status,
      });
    }
  }
  if (input.priority !== undefined) {
    setClauses.push(`priority = $${paramIndex++}`);
    params.push(input.priority);
    if (input.priority !== existingTask.priority) {
      changes.push({
        action: "UPDATED",
        fieldName: "priority",
        oldValue: existingTask.priority,
        newValue: input.priority,
      });
    }
  }
  if (input.is_important !== undefined) {
    setClauses.push(`is_important = $${paramIndex++}`);
    params.push(input.is_important ? 1 : 0);
    if (input.is_important !== isTaskImportant(existingTask)) {
      changes.push({
        action: "UPDATED",
        fieldName: "is_important",
        oldValue: String(isTaskImportant(existingTask)),
        newValue: String(input.is_important),
      });
    }
  }
  if (input.due_at !== undefined) {
    setClauses.push(`due_at = $${paramIndex++}`);
    params.push(input.due_at ?? null);
    const oldDueAt = existingTask.due_at ?? null;
    const newDueAt = input.due_at ?? null;
    if (oldDueAt !== newDueAt) {
      changes.push({
        action: "UPDATED",
        fieldName: "due_at",
        oldValue: oldDueAt,
        newValue: newDueAt,
      });
    }
  }
  if (input.remind_at !== undefined) {
    setClauses.push(`remind_at = $${paramIndex++}`);
    params.push(input.remind_at ?? null);
    const oldRemindAt = existingTask.remind_at ?? null;
    const newRemindAt = input.remind_at ?? null;
    if (oldRemindAt !== newRemindAt) {
      changes.push({
        action: "UPDATED",
        fieldName: "remind_at",
        oldValue: oldRemindAt,
        newValue: newRemindAt,
      });
    }
  }
  if (input.recurrence !== undefined) {
    setClauses.push(`recurrence = $${paramIndex++}`);
    params.push(input.recurrence);
    const oldRecurrence = (existingTask.recurrence ?? "NONE") as TaskRecurrence;
    const newRecurrence = input.recurrence;
    if (oldRecurrence !== newRecurrence) {
      changes.push({
        action: "UPDATED",
        fieldName: "recurrence",
        oldValue: oldRecurrence,
        newValue: newRecurrence,
      });
    }
  }

  setClauses.push("sync_version = COALESCE(sync_version, 0) + 1");
  setClauses.push(`updated_by_device = $${paramIndex++}`);
  params.push(deviceId);
  setClauses.push(`updated_at = $${paramIndex++}`);
  params.push(now);

  // Add the id as the final parameter
  params.push(input.id);

  await db.execute(
    `UPDATE tasks SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`,
    params,
  );

  const rows = await db.select<Task[]>("SELECT * FROM tasks WHERE id = $1", [
    input.id,
  ]);
  const updatedTask = rows[0];

  for (const change of changes) {
    await insertTaskChangelog(db, {
      taskId: input.id,
      action: change.action,
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      createdAt: now,
    });
  }

  if (
    existingTask.status !== "DONE" &&
    updatedTask.status === "DONE" &&
    updatedTask.recurrence !== "NONE" &&
    updatedTask.due_at
  ) {
    const nextDueAt = getNextRecurringDueAt(
      updatedTask.due_at,
      updatedTask.recurrence,
    );

    if (nextDueAt) {
      const nextTaskId = uuidv4();
      const nextRemindAt = shiftReminderWithDueDate(
        updatedTask.remind_at,
        updatedTask.due_at,
        nextDueAt,
      );

      await db.execute(
        `INSERT INTO tasks (
          id,
          title,
          description,
          notes_markdown,
          project_id,
          status,
          priority,
          is_important,
          due_at,
          remind_at,
          recurrence,
          created_at,
          updated_at,
          sync_version,
          updated_by_device
        )
         VALUES ($1, $2, $3, $4, $5, 'TODO', $6, $7, $8, $9, $10, $11, $12, 1, $13)`,
        [
          nextTaskId,
          updatedTask.title,
          updatedTask.description ?? null,
          updatedTask.notes_markdown ?? null,
          updatedTask.project_id ?? null,
          updatedTask.priority,
          updatedTask.is_important,
          nextDueAt,
          nextRemindAt,
          updatedTask.recurrence,
          now,
          now,
          deviceId,
        ],
      );

      await insertTaskChangelog(db, {
        taskId: nextTaskId,
        action: "CREATED",
        newValue: updatedTask.title,
        createdAt: now,
      });

      const nextTaskRows = await db.select<Task[]>(
        "SELECT * FROM tasks WHERE id = $1 LIMIT 1",
        [nextTaskId],
      );
      const nextTask = nextTaskRows[0];
      if (nextTask) {
        await enqueueEntityUpsert("TASK", nextTask.id, nextTask, now);
      }
    }
  }

  await enqueueEntityUpsert("TASK", updatedTask.id, updatedTask, now);
  return updatedTask;
}

/** Delete a task by ID */
export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();

  const taskRows = await db.select<Task[]>(
    "SELECT * FROM tasks WHERE id = $1 LIMIT 1",
    [id],
  );
  const task = taskRows[0];
  if (!task) return;

  const subtaskRows = await db.select<TaskSubtask[]>(
    "SELECT * FROM task_subtasks WHERE task_id = $1",
    [id],
  );
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
  for (const subtask of subtaskRows) {
    await enqueueEntityDelete("TASK_SUBTASK", subtask.id, deviceId, now);
  }
  await enqueueEntityDelete("TASK", task.id, deviceId, now);
}

/** Get task counts by status */
export async function getTaskStats(): Promise<Record<string, number>> {
  const db = await getDb();
  const results = await db.select<{ status: string; count: number }[]>(
    "SELECT status, COUNT(*) as count FROM tasks WHERE status != 'ARCHIVED' GROUP BY status",
  );

  const stats: Record<string, number> = { TODO: 0, DOING: 0, DONE: 0 };
  for (const row of results) {
    stats[row.status] = row.count;
  }
  return stats;
}

/** Fetch dashboard counters including due and completion momentum metrics */
export async function getTaskDashboardStats(
  referenceDate = new Date(),
): Promise<TaskDashboardStats> {
  const db = await getDb();
  const nowIso = referenceDate.toISOString();
  const startOfTodayIso = getLocalDayStart(referenceDate).toISOString();
  const endOfTodayIso = getLocalDayEnd(referenceDate).toISOString();
  const startOfWeekIso = getLocalWeekStart(referenceDate).toISOString();

  const statusRows = await db.select<{ status: string; count: number }[]>(
    "SELECT status, COUNT(*) as count FROM tasks WHERE status != 'ARCHIVED' GROUP BY status",
  );
  const statusStats: Record<string, number> = { TODO: 0, DOING: 0, DONE: 0 };
  for (const row of statusRows) {
    statusStats[row.status] = row.count;
  }

  const dueRows = await db.select<{ due_today: number; overdue: number }[]>(
    `SELECT
        COALESCE(SUM(CASE
          WHEN status NOT IN ('DONE', 'ARCHIVED')
            AND due_at IS NOT NULL
            AND due_at >= $1
            AND due_at < $2
          THEN 1 ELSE 0 END), 0) as due_today,
        COALESCE(SUM(CASE
          WHEN status NOT IN ('DONE', 'ARCHIVED')
            AND due_at IS NOT NULL
            AND due_at < $3
          THEN 1 ELSE 0 END), 0) as overdue
      FROM tasks`,
    [startOfTodayIso, endOfTodayIso, nowIso],
  );

  const completedRows = await db.select<{ count: number }[]>(
    `SELECT COALESCE(COUNT(DISTINCT task_id), 0) as count
       FROM task_changelogs
      WHERE action = 'STATUS_CHANGED'
        AND field_name = 'status'
        AND new_value = 'DONE'
        AND created_at >= $1
        AND created_at <= $2`,
    [startOfWeekIso, nowIso],
  );

  return {
    TODO: statusStats.TODO ?? 0,
    DOING: statusStats.DOING ?? 0,
    DONE: statusStats.DONE ?? 0,
    dueToday: Number(dueRows[0]?.due_today ?? 0),
    overdue: Number(dueRows[0]?.overdue ?? 0),
    completedThisWeek: Number(completedRows[0]?.count ?? 0),
  };
}

/** Fetch current-week review snapshot with momentum counters and focused task lists */
export async function getWeeklyReviewSnapshot(
  referenceDate = new Date(),
  listLimit = DEFAULT_WEEKLY_REVIEW_LIST_LIMIT,
): Promise<WeeklyReviewSnapshot> {
  const db = await getDb();
  const weekStart = getLocalWeekStart(referenceDate);
  const weekEnd = new Date(weekStart.getTime() + 7 * MILLISECONDS_PER_DAY);
  const periodEnd = new Date(Math.min(Date.now(), weekEnd.getTime()));
  const normalizedLimit = Math.max(3, Math.min(Math.trunc(listLimit), 30));

  const weekStartIso = weekStart.toISOString();
  const weekEndIso = weekEnd.toISOString();
  const periodEndIso = periodEnd.toISOString();

  const aggregateRows = await db.select<WeeklyReviewAggregateRow[]>(
    `SELECT
        COALESCE(SUM(CASE
          WHEN status NOT IN ('DONE', 'ARCHIVED')
            AND created_at <= $1
            AND (due_at IS NULL OR due_at >= $1)
          THEN 1 ELSE 0 END), 0) as pending_count,
        COALESCE(SUM(CASE
          WHEN status NOT IN ('DONE', 'ARCHIVED')
            AND created_at <= $1
            AND due_at IS NOT NULL
            AND due_at < $1
          THEN 1 ELSE 0 END), 0) as overdue_count,
        COALESCE(SUM(CASE
          WHEN status NOT IN ('DONE', 'ARCHIVED')
            AND created_at < $2
          THEN 1 ELSE 0 END), 0) as carry_over_count,
        COALESCE(SUM(CASE
          WHEN status NOT IN ('DONE', 'ARCHIVED')
            AND created_at <= $1
            AND due_at IS NOT NULL
            AND due_at >= $2
            AND due_at < $3
          THEN 1 ELSE 0 END), 0) as due_this_week_open_count
      FROM tasks`,
    [periodEndIso, weekStartIso, weekEndIso],
  );

  const createdRows = await db.select<WeeklyReviewCountRow[]>(
    `SELECT COALESCE(COUNT(*), 0) as count
       FROM tasks
      WHERE created_at >= $1
        AND created_at < $2`,
    [weekStartIso, periodEndIso],
  );

  const completedCountRows = await db.select<WeeklyReviewCountRow[]>(
    `SELECT COALESCE(COUNT(DISTINCT task_id), 0) as count
       FROM task_changelogs
      WHERE action = 'STATUS_CHANGED'
        AND field_name = 'status'
        AND new_value = 'DONE'
        AND created_at >= $1
        AND created_at < $2`,
    [weekStartIso, periodEndIso],
  );

  const completedTaskRows = await db.select<WeeklyReviewCompletedTaskRow[]>(
    `SELECT t.*, completed_log.completed_at
       FROM tasks t
       INNER JOIN (
         SELECT task_id, MAX(created_at) as completed_at
           FROM task_changelogs
          WHERE action = 'STATUS_CHANGED'
            AND field_name = 'status'
            AND new_value = 'DONE'
            AND created_at >= $1
            AND created_at < $2
          GROUP BY task_id
       ) completed_log ON completed_log.task_id = t.id
      ORDER BY completed_log.completed_at DESC
      LIMIT $3`,
    [weekStartIso, periodEndIso, normalizedLimit],
  );

  const overdueTasks = await db.select<Task[]>(
    `SELECT *
       FROM tasks
      WHERE status NOT IN ('DONE', 'ARCHIVED')
        AND created_at <= $1
        AND due_at IS NOT NULL
        AND due_at < $1
      ORDER BY due_at ASC, updated_at DESC
      LIMIT $2`,
    [periodEndIso, normalizedLimit],
  );

  const pendingTasks = await db.select<Task[]>(
    `SELECT *
       FROM tasks
      WHERE status NOT IN ('DONE', 'ARCHIVED')
        AND created_at <= $1
        AND (due_at IS NULL OR due_at >= $1)
      ORDER BY
        CASE WHEN due_at IS NULL THEN 1 ELSE 0 END ASC,
        due_at ASC,
        CASE priority
          WHEN 'URGENT' THEN 0
          WHEN 'NORMAL' THEN 1
          ELSE 2
        END ASC,
        updated_at DESC
      LIMIT $2`,
    [periodEndIso, normalizedLimit],
  );

  const completedTasks: WeeklyReviewCompletedTask[] = completedTaskRows.map(
    (row) => {
      const { completed_at: completedAt, ...task } = row;
      return {
        task: task as Task,
        completedAt,
      };
    },
  );

  return {
    weekStart: weekStartIso,
    weekEnd: weekEndIso,
    periodEnd: periodEndIso,
    completedCount: Number(completedCountRows[0]?.count ?? 0),
    createdCount: Number(createdRows[0]?.count ?? 0),
    pendingCount: Number(aggregateRows[0]?.pending_count ?? 0),
    overdueCount: Number(aggregateRows[0]?.overdue_count ?? 0),
    carryOverCount: Number(aggregateRows[0]?.carry_over_count ?? 0),
    dueThisWeekOpenCount: Number(
      aggregateRows[0]?.due_this_week_open_count ?? 0,
    ),
    completedTasks,
    pendingTasks,
    overdueTasks,
  };
}

/** Fetch changelog history for a task (latest first) */
export async function getTaskChangelogs(
  taskId: string,
  limit = 20,
): Promise<TaskChangelog[]> {
  const db = await getDb();
  return db.select<TaskChangelog[]>(
    `SELECT *
         FROM task_changelogs
         WHERE task_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
    [taskId, limit],
  );
}

/** Fetch open tasks that are due today or overdue */
export async function getTodayTasks(
  referenceDate = new Date(),
): Promise<Task[]> {
  const tasks = await getAllTasks();
  const dayEnd = getLocalDayEnd(referenceDate);

  return tasks
    .filter((task) => {
      if (!isOpenTask(task)) return false;
      const dueAt = parseDateTime(task.due_at);
      if (!dueAt) return false;
      return dueAt < dayEnd;
    })
    .sort(compareByDueDateAscending);
}

/** Fetch open tasks due after today and within the selected range */
export async function getUpcomingTasks(
  days = 7,
  referenceDate = new Date(),
): Promise<Task[]> {
  const tasks = await getAllTasks();
  const dayEnd = getLocalDayEnd(referenceDate);
  const rangeEnd = new Date(
    dayEnd.getTime() + Math.max(days, 1) * MILLISECONDS_PER_DAY,
  );

  return tasks
    .filter((task) => {
      if (!isOpenTask(task)) return false;
      const dueAt = parseDateTime(task.due_at);
      if (!dueAt) return false;
      return dueAt >= dayEnd && dueAt < rangeEnd;
    })
    .sort(compareByDueDateAscending);
}

/** Fetch checklist progress stats for a set of task ids */
export async function getTaskSubtaskStats(
  taskIds: string[],
): Promise<TaskSubtaskStats[]> {
  const normalizedTaskIds = Array.from(
    new Set(taskIds.map((taskId) => taskId.trim()).filter(Boolean)),
  );
  if (normalizedTaskIds.length === 0) return [];

  const db = await getDb();
  const placeholders = normalizedTaskIds
    .map((_, index) => `$${index + 1}`)
    .join(", ");

  return db.select<TaskSubtaskStats[]>(
    `SELECT
        task_id,
        COALESCE(SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END), 0) as done_count,
        COUNT(*) as total_count
      FROM task_subtasks
      WHERE task_id IN (${placeholders})
      GROUP BY task_id`,
    normalizedTaskIds,
  );
}

/** Fetch checklist items for a task */
export async function getTaskSubtasks(taskId: string): Promise<TaskSubtask[]> {
  const db = await getDb();
  return db.select<TaskSubtask[]>(
    `SELECT *
       FROM task_subtasks
      WHERE task_id = $1
      ORDER BY created_at ASC`,
    [taskId],
  );
}

/** Create a checklist item under a task */
export async function createTaskSubtask(
  input: CreateTaskSubtaskInput,
): Promise<TaskSubtask> {
  const db = await getDb();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();
  const normalizedTitle = normalizeSubtaskTitle(input.title);
  if (!normalizedTitle) {
    throw new Error(DB_ERROR_CODES.SUBTASK_TITLE_REQUIRED);
  }

  const subtaskId = uuidv4();
  await db.execute(
    `INSERT INTO task_subtasks (
        id,
        task_id,
        title,
        is_done,
        created_at,
        updated_at,
        sync_version,
        updated_by_device
      )
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
    [
      subtaskId,
      input.task_id,
      normalizedTitle,
      input.is_done ? 1 : 0,
      now,
      now,
      deviceId,
    ],
  );

  const rows = await db.select<TaskSubtask[]>(
    "SELECT * FROM task_subtasks WHERE id = $1",
    [subtaskId],
  );
  const createdSubtask = rows[0];
  await enqueueEntityUpsert(
    "TASK_SUBTASK",
    createdSubtask.id,
    createdSubtask,
    now,
  );
  return createdSubtask;
}

/** Update a checklist item */
export async function updateTaskSubtask(
  input: UpdateTaskSubtaskInput,
): Promise<TaskSubtask> {
  const db = await getDb();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();
  const existingRows = await db.select<TaskSubtask[]>(
    "SELECT * FROM task_subtasks WHERE id = $1",
    [input.id],
  );
  const existingSubtask = existingRows[0];

  if (!existingSubtask) {
    throw new Error(DB_ERROR_CODES.SUBTASK_NOT_FOUND);
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.title !== undefined) {
    const normalizedTitle = normalizeSubtaskTitle(input.title);
    if (!normalizedTitle) {
      throw new Error(DB_ERROR_CODES.SUBTASK_TITLE_REQUIRED);
    }
    setClauses.push(`title = $${paramIndex++}`);
    params.push(normalizedTitle);
  }

  if (input.is_done !== undefined) {
    setClauses.push(`is_done = $${paramIndex++}`);
    params.push(input.is_done ? 1 : 0);
  }

  if (setClauses.length === 0) {
    return existingSubtask;
  }

  setClauses.push("sync_version = COALESCE(sync_version, 0) + 1");
  setClauses.push(`updated_by_device = $${paramIndex++}`);
  params.push(deviceId);
  setClauses.push(`updated_at = $${paramIndex++}`);
  params.push(now);
  params.push(input.id);

  await db.execute(
    `UPDATE task_subtasks
        SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}`,
    params,
  );

  const rows = await db.select<TaskSubtask[]>(
    "SELECT * FROM task_subtasks WHERE id = $1",
    [input.id],
  );
  const updatedSubtask = rows[0];
  await enqueueEntityUpsert(
    "TASK_SUBTASK",
    updatedSubtask.id,
    updatedSubtask,
    now,
  );
  return updatedSubtask;
}

/** Delete a checklist item */
export async function deleteTaskSubtask(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();
  const rows = await db.select<TaskSubtask[]>(
    "SELECT * FROM task_subtasks WHERE id = $1 LIMIT 1",
    [id],
  );
  const subtask = rows[0];
  if (!subtask) return;
  await db.execute("DELETE FROM task_subtasks WHERE id = $1", [id]);
  await enqueueEntityDelete("TASK_SUBTASK", subtask.id, deviceId, now);
}

/** Fetch task templates ordered by latest update */
export async function getTaskTemplates(): Promise<TaskTemplate[]> {
  const db = await getDb();
  return db.select<TaskTemplate[]>(
    `SELECT *
       FROM task_templates
      ORDER BY updated_at DESC, name COLLATE NOCASE ASC`,
  );
}

/** Create or update a task template by id (or name when id is absent) */
export async function upsertTaskTemplate(
  input: UpsertTaskTemplateInput,
): Promise<TaskTemplate> {
  const db = await getDb();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();
  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error(DB_ERROR_CODES.TEMPLATE_NAME_REQUIRED);
  }

  const normalizedDueOffset = normalizeTemplateOffset(
    input.due_offset_minutes ?? null,
  );
  const normalizedRemindOffset = normalizeTemplateOffset(
    input.remind_offset_minutes ?? null,
  );
  const normalizedRecurrence = input.recurrence ?? "NONE";

  if (normalizedRecurrence !== "NONE" && normalizedDueOffset === null) {
    throw new Error(DB_ERROR_CODES.RECURRING_TEMPLATE_DUE_OFFSET_REQUIRED);
  }

  if (
    normalizedDueOffset !== null &&
    normalizedRemindOffset !== null &&
    normalizedRemindOffset > normalizedDueOffset
  ) {
    throw new Error(DB_ERROR_CODES.REMINDER_OFFSET_MUST_BE_EARLIER);
  }

  const existingByNameRows = await db.select<{ id: string }[]>(
    "SELECT id FROM task_templates WHERE LOWER(name) = LOWER($1) LIMIT 1",
    [normalizedName],
  );
  const existingByNameId = existingByNameRows[0]?.id ?? null;

  if (input.id && existingByNameId && existingByNameId !== input.id) {
    throw new Error(DB_ERROR_CODES.TEMPLATE_NAME_EXISTS);
  }

  const targetTemplateId = input.id ?? existingByNameId ?? uuidv4();
  const existingByIdRows = await db.select<{ id: string }[]>(
    "SELECT id FROM task_templates WHERE id = $1 LIMIT 1",
    [targetTemplateId],
  );
  const hasExistingTemplate = existingByIdRows.length > 0;

  if (hasExistingTemplate) {
    await db.execute(
      `UPDATE task_templates
          SET name = $1,
              title_template = $2,
              description = $3,
              priority = $4,
              is_important = $5,
              due_offset_minutes = $6,
              remind_offset_minutes = $7,
              recurrence = $8,
              sync_version = COALESCE(sync_version, 0) + 1,
              updated_by_device = $9,
              updated_at = $10
        WHERE id = $11`,
      [
        normalizedName,
        input.title_template?.trim() || null,
        input.description?.trim() || null,
        input.priority,
        input.is_important ? 1 : 0,
        normalizedDueOffset,
        normalizedRemindOffset,
        normalizedRecurrence,
        deviceId,
        now,
        targetTemplateId,
      ],
    );
  } else {
    await db.execute(
      `INSERT INTO task_templates (
          id,
          name,
          title_template,
          description,
          priority,
          is_important,
          due_offset_minutes,
          remind_offset_minutes,
          recurrence,
          created_at,
          updated_at,
          sync_version,
          updated_by_device
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12)`,
      [
        targetTemplateId,
        normalizedName,
        input.title_template?.trim() || null,
        input.description?.trim() || null,
        input.priority,
        input.is_important ? 1 : 0,
        normalizedDueOffset,
        normalizedRemindOffset,
        normalizedRecurrence,
        now,
        now,
        deviceId,
      ],
    );
  }

  const rows = await db.select<TaskTemplate[]>(
    "SELECT * FROM task_templates WHERE id = $1",
    [targetTemplateId],
  );
  const upsertedTemplate = rows[0];
  await enqueueEntityUpsert(
    "TASK_TEMPLATE",
    upsertedTemplate.id,
    upsertedTemplate,
    now,
  );
  return upsertedTemplate;
}

/** Delete a task template by id */
export async function deleteTaskTemplate(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const deviceId = await getOrCreateDeviceId();
  const rows = await db.select<TaskTemplate[]>(
    "SELECT * FROM task_templates WHERE id = $1 LIMIT 1",
    [id],
  );
  const taskTemplate = rows[0];
  if (!taskTemplate) return;
  await db.execute("DELETE FROM task_templates WHERE id = $1", [id]);
  await enqueueEntityDelete("TASK_TEMPLATE", taskTemplate.id, deviceId, now);
}

async function readLatestBackupSnapshotSettings(db: Database): Promise<{
  latestPayloadJson: string | null;
  latestExportedAt: string | null;
}> {
  const rows = await db.select<AppSettingRecord[]>(
    "SELECT key, value FROM settings WHERE key IN ($1, $2)",
    [LOCAL_BACKUP_LATEST_PAYLOAD_KEY, LOCAL_BACKUP_LATEST_EXPORTED_AT_KEY],
  );

  let latestPayloadJson: string | null = null;
  let latestExportedAt: string | null = null;
  for (const row of rows) {
    if (row.key === LOCAL_BACKUP_LATEST_PAYLOAD_KEY) {
      const normalizedPayload = row.value.trim();
      latestPayloadJson = normalizedPayload || null;
    } else if (row.key === LOCAL_BACKUP_LATEST_EXPORTED_AT_KEY) {
      latestExportedAt = asNullableString(row.value);
    }
  }

  return {
    latestPayloadJson,
    latestExportedAt,
  };
}

async function saveLatestBackupSnapshot(
  db: Database,
  payload: BackupPayload,
): Promise<void> {
  await db.execute(
    `INSERT INTO settings (key, value)
         VALUES ($1, $2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [LOCAL_BACKUP_LATEST_PAYLOAD_KEY, JSON.stringify(payload)],
  );
  await db.execute(
    `INSERT INTO settings (key, value)
         VALUES ($1, $2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [LOCAL_BACKUP_LATEST_EXPORTED_AT_KEY, payload.exported_at],
  );
}

async function getBackupRestorePreflightFromDb(
  db: Database,
): Promise<BackupRestorePreflight> {
  await ensureSyncTablesReady(db);

  const [outboxRows, conflictRows, latestBackupSettings] = await Promise.all([
    db.select<Array<{ count: number }>>(
      "SELECT COUNT(*) as count FROM sync_outbox",
    ),
    db.select<Array<{ count: number }>>(
      "SELECT COUNT(*) as count FROM sync_conflicts WHERE status = 'open'",
    ),
    readLatestBackupSnapshotSettings(db),
  ]);

  const pendingOutboxChanges = Math.max(0, Number(outboxRows[0]?.count ?? 0));
  const openConflicts = Math.max(0, Number(conflictRows[0]?.count ?? 0));
  const hasLatestBackup = Boolean(latestBackupSettings.latestPayloadJson);

  return {
    pending_outbox_changes: pendingOutboxChanges,
    open_conflicts: openConflicts,
    has_latest_backup: hasLatestBackup,
    latest_backup_exported_at: latestBackupSettings.latestExportedAt,
    requires_force_restore: pendingOutboxChanges > 0 || openConflicts > 0,
  };
}

export async function getBackupRestorePreflight(): Promise<BackupRestorePreflight> {
  const db = await getDb();
  return getBackupRestorePreflightFromDb(db);
}

function normalizeBackupPayload(payload: unknown): BackupPayload {
  if (!isPlainObject(payload)) {
    throw new Error(DB_ERROR_CODES.BACKUP_PAYLOAD_INVALID);
  }

  const version = payload.version;
  if (version !== 1) {
    throw new Error(DB_ERROR_CODES.BACKUP_VERSION_UNSUPPORTED);
  }

  const rawData = payload.data;
  if (!isPlainObject(rawData)) {
    throw new Error(DB_ERROR_CODES.BACKUP_PAYLOAD_MISSING_DATA);
  }

  const rawSettings = Array.isArray(rawData.settings) ? rawData.settings : [];
  const settingsByKey = new Map<string, AppSettingRecord>();
  for (const entry of rawSettings) {
    if (!isPlainObject(entry)) continue;
    const key = asNullableString(entry.key)?.trim() ?? "";
    if (!key) continue;
    if (
      key === LOCAL_BACKUP_LATEST_PAYLOAD_KEY ||
      key === LOCAL_BACKUP_LATEST_EXPORTED_AT_KEY
    ) {
      continue;
    }
    settingsByKey.set(key, {
      key,
      value: asNullableString(entry.value) ?? "",
    });
  }
  const settings = Array.from(settingsByKey.values());

  const rawProjects = Array.isArray(rawData.projects) ? rawData.projects : [];
  const projectsById = new Map<string, Project>();
  for (const entry of rawProjects) {
    if (!isPlainObject(entry)) continue;
    const id = asNullableString(entry.id)?.trim() ?? "";
    const name = asNullableString(entry.name)?.trim() ?? "";
    if (!id || !name) continue;
    projectsById.set(id, {
      id,
      name,
      description: asNullableString(entry.description),
      color: asNullableString(entry.color),
      status: asProjectStatus(entry.status),
      created_at: asIsoDateStringOrNow(entry.created_at),
      updated_at: asIsoDateStringOrNow(entry.updated_at),
    });
  }
  const projects = Array.from(projectsById.values());
  const projectIdSet = new Set(projects.map((project) => project.id));

  const rawTasks = Array.isArray(rawData.tasks) ? rawData.tasks : [];
  const tasksById = new Map<string, Task>();
  for (const entry of rawTasks) {
    if (!isPlainObject(entry)) continue;
    const id = asNullableString(entry.id)?.trim() ?? "";
    const title = asNullableString(entry.title)?.trim() ?? "";
    if (!id || !title) continue;

    const rawProjectId = asNullableString(entry.project_id);
    const projectId =
      rawProjectId && projectIdSet.has(rawProjectId) ? rawProjectId : null;

    tasksById.set(id, {
      id,
      title,
      description: asNullableString(entry.description),
      notes_markdown: normalizeTaskNotesMarkdown(
        asNullableString(entry.notes_markdown),
      ),
      project_id: projectId,
      status: asTaskStatus(entry.status),
      priority: asTaskPriority(entry.priority),
      is_important: asBooleanSqliteNumber(entry.is_important),
      due_at: asNullableString(entry.due_at),
      remind_at: asNullableString(entry.remind_at),
      recurrence: asTaskRecurrence(entry.recurrence),
      created_at: asIsoDateStringOrNow(entry.created_at),
      updated_at: asIsoDateStringOrNow(entry.updated_at),
    });
  }
  const tasks = Array.from(tasksById.values());
  const taskIdSet = new Set(tasks.map((task) => task.id));

  const rawSessions = Array.isArray(rawData.sessions) ? rawData.sessions : [];
  const sessionsById = new Map<string, SessionRecord>();
  for (const entry of rawSessions) {
    if (!isPlainObject(entry)) continue;
    const id = asNullableString(entry.id)?.trim() ?? "";
    if (!id) continue;

    const rawTaskId = asNullableString(entry.task_id);
    const taskId = rawTaskId && taskIdSet.has(rawTaskId) ? rawTaskId : null;
    sessionsById.set(id, {
      id,
      task_id: taskId,
      duration_minutes: Math.max(0, asIntegerOrDefault(entry.duration_minutes)),
      completed_at: asIsoDateStringOrNow(entry.completed_at),
    });
  }
  const sessions = Array.from(sessionsById.values());

  const rawTaskSubtasks = Array.isArray(rawData.task_subtasks)
    ? rawData.task_subtasks
    : [];
  const taskSubtasksById = new Map<string, TaskSubtask>();
  for (const entry of rawTaskSubtasks) {
    if (!isPlainObject(entry)) continue;
    const id = asNullableString(entry.id)?.trim() ?? "";
    const taskId = asNullableString(entry.task_id)?.trim() ?? "";
    const title = asNullableString(entry.title)?.trim() ?? "";
    if (!id || !taskId || !title || !taskIdSet.has(taskId)) continue;

    taskSubtasksById.set(id, {
      id,
      task_id: taskId,
      title,
      is_done: asBooleanSqliteNumber(entry.is_done),
      created_at: asIsoDateStringOrNow(entry.created_at),
      updated_at: asIsoDateStringOrNow(entry.updated_at),
    });
  }
  const taskSubtasks = Array.from(taskSubtasksById.values());

  const rawTaskChangelogs = Array.isArray(rawData.task_changelogs)
    ? rawData.task_changelogs
    : [];
  const taskChangelogsById = new Map<string, TaskChangelog>();
  for (const entry of rawTaskChangelogs) {
    if (!isPlainObject(entry)) continue;
    const id = asNullableString(entry.id)?.trim() ?? "";
    const taskId = asNullableString(entry.task_id)?.trim() ?? "";
    if (!id || !taskId || !taskIdSet.has(taskId)) continue;

    taskChangelogsById.set(id, {
      id,
      task_id: taskId,
      action: asTaskChangelogAction(entry.action),
      field_name: asNullableString(entry.field_name),
      old_value: asNullableString(entry.old_value),
      new_value: asNullableString(entry.new_value),
      created_at: asIsoDateStringOrNow(entry.created_at),
    });
  }
  const taskChangelogs = Array.from(taskChangelogsById.values());

  const rawTaskTemplates = Array.isArray(rawData.task_templates)
    ? rawData.task_templates
    : [];
  const taskTemplatesById = new Map<string, TaskTemplate>();
  for (const entry of rawTaskTemplates) {
    if (!isPlainObject(entry)) continue;
    const id = asNullableString(entry.id)?.trim() ?? "";
    const name = asNullableString(entry.name)?.trim() ?? "";
    if (!id || !name) continue;

    taskTemplatesById.set(id, {
      id,
      name,
      title_template: asNullableString(entry.title_template),
      description: asNullableString(entry.description),
      priority: asTaskPriority(entry.priority),
      is_important: asBooleanSqliteNumber(entry.is_important),
      due_offset_minutes: asNullableInteger(entry.due_offset_minutes),
      remind_offset_minutes: asNullableInteger(entry.remind_offset_minutes),
      recurrence: asTaskRecurrence(entry.recurrence),
      created_at: asIsoDateStringOrNow(entry.created_at),
      updated_at: asIsoDateStringOrNow(entry.updated_at),
    });
  }
  const taskTemplates = Array.from(taskTemplatesById.values());

  return {
    version: 1,
    exported_at: asIsoDateStringOrNow(payload.exported_at),
    data: {
      settings,
      projects,
      tasks,
      sessions,
      task_subtasks: taskSubtasks,
      task_changelogs: taskChangelogs,
      task_templates: taskTemplates,
    },
  };
}

/** Export all app data into a single structured payload */
export async function exportBackupPayload(): Promise<BackupPayload> {
  const db = await getDb();

  const [
    settings,
    projects,
    tasks,
    sessions,
    taskSubtasks,
    taskChangelogs,
    taskTemplates,
  ] = await Promise.all([
    db.select<AppSettingRecord[]>("SELECT key, value FROM settings"),
    db.select<Project[]>("SELECT * FROM projects ORDER BY created_at ASC"),
    db.select<Task[]>("SELECT * FROM tasks ORDER BY created_at ASC"),
    db.select<SessionRecord[]>(
      "SELECT * FROM sessions ORDER BY completed_at ASC",
    ),
    db.select<TaskSubtask[]>(
      "SELECT * FROM task_subtasks ORDER BY created_at ASC",
    ),
    db.select<TaskChangelog[]>(
      "SELECT * FROM task_changelogs ORDER BY created_at ASC",
    ),
    db.select<TaskTemplate[]>(
      "SELECT * FROM task_templates ORDER BY created_at ASC",
    ),
  ]);

  const filteredSettings = settings.filter(
    (setting) =>
      setting.key !== LOCAL_BACKUP_LATEST_PAYLOAD_KEY &&
      setting.key !== LOCAL_BACKUP_LATEST_EXPORTED_AT_KEY,
  );

  const payload: BackupPayload = {
    version: 1,
    exported_at: new Date().toISOString(),
    data: {
      settings: filteredSettings,
      projects,
      tasks,
      sessions,
      task_subtasks: taskSubtasks,
      task_changelogs: taskChangelogs,
      task_templates: taskTemplates,
    },
  };

  await saveLatestBackupSnapshot(db, payload);
  return payload;
}

/** Replace local data with a backup payload and return imported row counts */
export async function importBackupPayload(
  rawPayload: BackupPayload | unknown,
  options?: BackupImportOptions,
): Promise<BackupImportResult> {
  const db = await getDb();
  const backupPayload = normalizeBackupPayload(rawPayload);
  const preflight = await getBackupRestorePreflightFromDb(db);
  if (preflight.requires_force_restore && !options?.force) {
    const restoreBlockReasons: string[] = [];
    if (preflight.pending_outbox_changes > 0) {
      restoreBlockReasons.push(
        `${preflight.pending_outbox_changes} pending outbox change(s)`,
      );
    }
    if (preflight.open_conflicts > 0) {
      restoreBlockReasons.push(`${preflight.open_conflicts} open conflict(s)`);
    }
    const reasonLabel =
      restoreBlockReasons.length > 0
        ? restoreBlockReasons.join(" and ")
        : "active restore guardrails";
    throw new Error(`${DB_ERROR_CODES.RESTORE_BLOCKED}:${reasonLabel}`);
  }

  const preservedLocalSettings = await db.select<AppSettingRecord[]>(
    `SELECT key, value
       FROM settings
      WHERE key = $1
         OR key LIKE $2`,
    [SYNC_SETTINGS_DEVICE_ID_KEY, `${LOCAL_ONLY_SETTING_PREFIX}%`],
  );
  const {
    settings,
    projects,
    tasks,
    sessions,
    task_subtasks: taskSubtasks,
    task_changelogs: taskChangelogs,
    task_templates: taskTemplates,
  } = backupPayload.data;

  await ensureSyncTablesReady(db);
  await db.execute("BEGIN IMMEDIATE");

  try {
    await db.execute("DELETE FROM sync_conflict_events");
    await db.execute("DELETE FROM sync_conflicts");
    await db.execute("DELETE FROM sync_outbox");
    await db.execute("DELETE FROM deleted_records");

    await db.execute("DELETE FROM sessions");
    await db.execute("DELETE FROM task_subtasks");
    await db.execute("DELETE FROM task_changelogs");
    await db.execute("DELETE FROM tasks");
    await db.execute("DELETE FROM task_templates");
    await db.execute("DELETE FROM projects");
    await db.execute("DELETE FROM settings");

    for (const setting of settings) {
      await db.execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
        setting.key,
        setting.value,
      ]);
    }
    for (const setting of preservedLocalSettings) {
      await db.execute(
        `INSERT INTO settings (key, value)
             VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [setting.key, setting.value],
      );
    }

    for (const project of projects) {
      await db.execute(
        `INSERT INTO projects (
            id,
            name,
            description,
            color,
            status,
            created_at,
            updated_at
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          project.id,
          project.name,
          project.description ?? null,
          project.color ?? null,
          project.status,
          project.created_at,
          project.updated_at,
        ],
      );
    }

    for (const task of tasks) {
      await db.execute(
        `INSERT INTO tasks (
            id,
            title,
            description,
            notes_markdown,
            project_id,
            status,
            priority,
            is_important,
            due_at,
            remind_at,
            recurrence,
            created_at,
            updated_at
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          task.id,
          task.title,
          task.description ?? null,
          normalizeTaskNotesMarkdown(task.notes_markdown),
          task.project_id ?? null,
          task.status,
          task.priority,
          asBooleanSqliteNumber(task.is_important),
          task.due_at ?? null,
          task.remind_at ?? null,
          task.recurrence,
          task.created_at,
          task.updated_at,
        ],
      );
    }

    for (const session of sessions) {
      await db.execute(
        `INSERT INTO sessions (
            id,
            task_id,
            duration_minutes,
            completed_at
          )
           VALUES ($1, $2, $3, $4)`,
        [
          session.id,
          session.task_id ?? null,
          Math.max(0, asIntegerOrDefault(session.duration_minutes)),
          session.completed_at,
        ],
      );
    }

    for (const subtask of taskSubtasks) {
      await db.execute(
        `INSERT INTO task_subtasks (
            id,
            task_id,
            title,
            is_done,
            created_at,
            updated_at
          )
           VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          subtask.id,
          subtask.task_id,
          subtask.title,
          asBooleanSqliteNumber(subtask.is_done),
          subtask.created_at,
          subtask.updated_at,
        ],
      );
    }

    for (const changelog of taskChangelogs) {
      await db.execute(
        `INSERT INTO task_changelogs (
            id,
            task_id,
            action,
            field_name,
            old_value,
            new_value,
            created_at
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          changelog.id,
          changelog.task_id,
          asTaskChangelogAction(changelog.action),
          changelog.field_name ?? null,
          changelog.old_value ?? null,
          changelog.new_value ?? null,
          changelog.created_at,
        ],
      );
    }

    for (const template of taskTemplates) {
      await db.execute(
        `INSERT INTO task_templates (
            id,
            name,
            title_template,
            description,
            priority,
            is_important,
            due_offset_minutes,
            remind_offset_minutes,
            recurrence,
            created_at,
            updated_at
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          template.id,
          template.name,
          template.title_template ?? null,
          template.description ?? null,
          template.priority,
          asBooleanSqliteNumber(template.is_important),
          asNullableInteger(template.due_offset_minutes),
          asNullableInteger(template.remind_offset_minutes),
          template.recurrence,
          template.created_at,
          template.updated_at,
        ],
      );
    }

    const nowIso = new Date().toISOString();
    await db.execute(
      `UPDATE sync_checkpoints
          SET last_sync_cursor = NULL,
              last_synced_at = NULL,
              updated_at = $1
        WHERE id = 1`,
      [nowIso],
    );
    await saveLatestBackupSnapshot(db, backupPayload);

    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }

  return {
    settings: settings.length,
    projects: projects.length,
    tasks: tasks.length,
    sessions: sessions.length,
    task_subtasks: taskSubtasks.length,
    task_changelogs: taskChangelogs.length,
    task_templates: taskTemplates.length,
  };
}

/** Restore the latest exported local snapshot with preflight guardrails */
export async function restoreLatestBackupPayload(options?: {
  force?: boolean;
}): Promise<BackupImportResult> {
  const db = await getDb();
  const latestBackupSettings = await readLatestBackupSnapshotSettings(db);
  const latestPayloadJson = latestBackupSettings.latestPayloadJson;
  if (!latestPayloadJson) {
    throw new Error(DB_ERROR_CODES.LATEST_BACKUP_NOT_FOUND);
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(latestPayloadJson) as unknown;
  } catch {
    throw new Error(DB_ERROR_CODES.LATEST_BACKUP_CORRUPTED);
  }

  return importBackupPayload(parsedPayload, {
    force: options?.force,
    source: "latest_backup",
  });
}
