import Database from "@tauri-apps/plugin-sql";
import type {
  Task,
  TaskChangelog,
  TaskChangelogAction,
  TaskRecurrence,
  TaskDashboardStats,
  CreateTaskInput,
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

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('TODO', 'DOING', 'DONE', 'ARCHIVED')),
      priority TEXT NOT NULL CHECK(priority IN ('URGENT', 'NORMAL', 'LOW')),
      is_important BOOLEAN DEFAULT 0,
      due_at DATETIME,
      remind_at DATETIME,
      recurrence TEXT NOT NULL DEFAULT 'NONE' CHECK(recurrence IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  await ensureTaskColumns(db);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_tasks_due_at
    ON tasks(due_at)
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

/** Fetch all non-archived tasks, newest first */
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  const results = await db.select<Task[]>(
    "SELECT * FROM tasks WHERE status != 'ARCHIVED' ORDER BY created_at DESC",
  );
  return results;
}

/** Create a new task and return it */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO tasks (
      id,
      title,
      description,
      status,
      priority,
      is_important,
      due_at,
      remind_at,
      recurrence,
      created_at,
      updated_at
    )
     VALUES ($1, $2, $3, 'TODO', $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.title,
      input.description ?? null,
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
          status,
          priority,
          is_important,
          due_at,
          remind_at,
          recurrence,
          created_at,
          updated_at
        )
         VALUES ($1, $2, $3, 'TODO', $4, $5, $6, $7, $8, $9, $10)`,
        [
          nextTaskId,
          updatedTask.title,
          updatedTask.description ?? null,
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
