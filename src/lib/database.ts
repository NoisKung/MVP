import Database from "@tauri-apps/plugin-sql";
import type {
  Task,
  TaskChangelog,
  TaskChangelogAction,
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
    `INSERT INTO tasks (id, title, description, status, priority, is_important, created_at, updated_at)
     VALUES ($1, $2, $3, 'TODO', $4, $5, $6, $7)`,
    [
      id,
      input.title,
      input.description ?? null,
      input.priority,
      input.is_important ? 1 : 0,
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
