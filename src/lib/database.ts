import Database from "@tauri-apps/plugin-sql";
import type {
  AppSettingRecord,
  BackupImportResult,
  BackupPayload,
  Task,
  Project,
  SessionRecord,
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
  UpdateTaskSubtaskInput,
  UpsertTaskTemplateInput,
  UpdateTaskInput,
} from "./types";
import { v4 as uuidv4 } from "uuid";

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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_created_at
    ON task_subtasks(task_id, created_at ASC)
  `);

  await ensureTaskColumns(db);
  await ensureTaskTemplateColumns(db);
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
    throw new Error("Selected project does not exist.");
  }
}

async function insertTaskSubtask(
  db: Database,
  input: CreateTaskSubtaskInput,
  nowIso = new Date().toISOString(),
): Promise<void> {
  const normalizedTitle = normalizeSubtaskTitle(input.title);
  if (!normalizedTitle) return;

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
      uuidv4(),
      input.task_id,
      normalizedTitle,
      input.is_done ? 1 : 0,
      nowIso,
      nowIso,
    ],
  );
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
  const normalizedName = normalizeProjectName(input.name);
  if (!normalizedName) {
    throw new Error("Project name is required.");
  }

  const duplicateRows = await db.select<{ id: string }[]>(
    "SELECT id FROM projects WHERE LOWER(name) = LOWER($1) LIMIT 1",
    [normalizedName],
  );
  if (duplicateRows.length > 0) {
    throw new Error("Project name already exists.");
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
        updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      projectId,
      normalizedName,
      input.description?.trim() || null,
      input.color?.trim() || null,
      normalizeProjectStatus(input.status),
      now,
      now,
    ],
  );

  const rows = await db.select<Project[]>(
    "SELECT * FROM projects WHERE id = $1 LIMIT 1",
    [projectId],
  );
  return rows[0];
}

/** Update an existing project */
export async function updateProject(
  input: UpdateProjectInput,
): Promise<Project> {
  const db = await getDb();
  const existingRows = await db.select<Project[]>(
    "SELECT * FROM projects WHERE id = $1 LIMIT 1",
    [input.id],
  );
  const existingProject = existingRows[0];
  if (!existingProject) {
    throw new Error("Project not found.");
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    const normalizedName = normalizeProjectName(input.name);
    if (!normalizedName) {
      throw new Error("Project name is required.");
    }

    const duplicateRows = await db.select<{ id: string }[]>(
      "SELECT id FROM projects WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1",
      [normalizedName, input.id],
    );
    if (duplicateRows.length > 0) {
      throw new Error("Project name already exists.");
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

  setClauses.push(`updated_at = $${paramIndex++}`);
  params.push(new Date().toISOString());
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
  return rows[0];
}

/** Delete a project and unassign all linked tasks */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET project_id = NULL WHERE project_id = $1", [
    id,
  ]);
  await db.execute("DELETE FROM projects WHERE id = $1", [id]);
}

/** Create a new task and return it */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

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
      updated_at
    )
     VALUES ($1, $2, $3, $4, $5, 'TODO', $6, $7, $8, $9, $10, $11, $12)`,
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

  for (const subtask of subtasks) {
    await insertTaskSubtask(
      db,
      {
        task_id: id,
        title: subtask.title,
        is_done: subtask.is_done,
      },
      now,
    );
  }

  const rows = await db.select<Task[]>("SELECT * FROM tasks WHERE id = $1", [
    id,
  ]);
  return rows[0];
}

/** Update an existing task */
export async function updateTask(input: UpdateTaskInput): Promise<Task> {
  const db = await getDb();
  const now = new Date().toISOString();
  const existingRows = await db.select<Task[]>(
    "SELECT * FROM tasks WHERE id = $1",
    [input.id],
  );
  const existingTask = existingRows[0];

  if (!existingTask) {
    throw new Error("Task not found");
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
          updated_at
        )
         VALUES ($1, $2, $3, $4, $5, 'TODO', $6, $7, $8, $9, $10, $11, $12)`,
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
        ],
      );

      await insertTaskChangelog(db, {
        taskId: nextTaskId,
        action: "CREATED",
        newValue: updatedTask.title,
        createdAt: now,
      });
    }
  }

  return updatedTask;
}

/** Delete a task by ID */
export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
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
  const normalizedTitle = normalizeSubtaskTitle(input.title);
  if (!normalizedTitle) {
    throw new Error("Subtask title is required.");
  }

  const subtaskId = uuidv4();
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
      subtaskId,
      input.task_id,
      normalizedTitle,
      input.is_done ? 1 : 0,
      now,
      now,
    ],
  );

  const rows = await db.select<TaskSubtask[]>(
    "SELECT * FROM task_subtasks WHERE id = $1",
    [subtaskId],
  );
  return rows[0];
}

/** Update a checklist item */
export async function updateTaskSubtask(
  input: UpdateTaskSubtaskInput,
): Promise<TaskSubtask> {
  const db = await getDb();
  const existingRows = await db.select<TaskSubtask[]>(
    "SELECT * FROM task_subtasks WHERE id = $1",
    [input.id],
  );
  const existingSubtask = existingRows[0];

  if (!existingSubtask) {
    throw new Error("Subtask not found.");
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.title !== undefined) {
    const normalizedTitle = normalizeSubtaskTitle(input.title);
    if (!normalizedTitle) {
      throw new Error("Subtask title is required.");
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

  setClauses.push(`updated_at = $${paramIndex++}`);
  params.push(new Date().toISOString());
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
  return rows[0];
}

/** Delete a checklist item */
export async function deleteTaskSubtask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM task_subtasks WHERE id = $1", [id]);
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
  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("Template name is required.");
  }

  const normalizedDueOffset = normalizeTemplateOffset(
    input.due_offset_minutes ?? null,
  );
  const normalizedRemindOffset = normalizeTemplateOffset(
    input.remind_offset_minutes ?? null,
  );
  const normalizedRecurrence = input.recurrence ?? "NONE";

  if (normalizedRecurrence !== "NONE" && normalizedDueOffset === null) {
    throw new Error("Recurring templates require a due offset.");
  }

  if (
    normalizedDueOffset !== null &&
    normalizedRemindOffset !== null &&
    normalizedRemindOffset > normalizedDueOffset
  ) {
    throw new Error("Reminder offset must be earlier than due offset.");
  }

  const existingByNameRows = await db.select<{ id: string }[]>(
    "SELECT id FROM task_templates WHERE LOWER(name) = LOWER($1) LIMIT 1",
    [normalizedName],
  );
  const existingByNameId = existingByNameRows[0]?.id ?? null;

  if (input.id && existingByNameId && existingByNameId !== input.id) {
    throw new Error("Template name already exists.");
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
              updated_at = $9
        WHERE id = $10`,
      [
        normalizedName,
        input.title_template?.trim() || null,
        input.description?.trim() || null,
        input.priority,
        input.is_important ? 1 : 0,
        normalizedDueOffset,
        normalizedRemindOffset,
        normalizedRecurrence,
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
          updated_at
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
      ],
    );
  }

  const rows = await db.select<TaskTemplate[]>(
    "SELECT * FROM task_templates WHERE id = $1",
    [targetTemplateId],
  );
  return rows[0];
}

/** Delete a task template by id */
export async function deleteTaskTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM task_templates WHERE id = $1", [id]);
}

function normalizeBackupPayload(payload: unknown): BackupPayload {
  if (!isPlainObject(payload)) {
    throw new Error("Invalid backup payload.");
  }

  const version = payload.version;
  if (version !== 1) {
    throw new Error("Unsupported backup version.");
  }

  const rawData = payload.data;
  if (!isPlainObject(rawData)) {
    throw new Error("Invalid backup payload: missing data section.");
  }

  const rawSettings = Array.isArray(rawData.settings) ? rawData.settings : [];
  const settingsByKey = new Map<string, AppSettingRecord>();
  for (const entry of rawSettings) {
    if (!isPlainObject(entry)) continue;
    const key = asNullableString(entry.key)?.trim() ?? "";
    if (!key) continue;
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

  return {
    version: 1,
    exported_at: new Date().toISOString(),
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

/** Replace local data with a backup payload and return imported row counts */
export async function importBackupPayload(
  rawPayload: BackupPayload | unknown,
): Promise<BackupImportResult> {
  const db = await getDb();
  const backupPayload = normalizeBackupPayload(rawPayload);
  const {
    settings,
    projects,
    tasks,
    sessions,
    task_subtasks: taskSubtasks,
    task_changelogs: taskChangelogs,
    task_templates: taskTemplates,
  } = backupPayload.data;

  await db.execute("BEGIN IMMEDIATE");

  try {
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
