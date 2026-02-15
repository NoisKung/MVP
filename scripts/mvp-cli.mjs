#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

const APP_IDENTIFIER = "com.antigravity.solostack";
const DB_FILE_NAME = "solostack.db";
const TASK_STATUSES = new Set(["TODO", "DOING", "DONE", "ARCHIVED"]);
const TASK_PRIORITIES = new Set(["URGENT", "NORMAL", "LOW"]);
const TASK_RECURRENCES = new Set(["NONE", "DAILY", "WEEKLY", "MONTHLY"]);
const PROJECT_STATUSES = new Set(["ACTIVE", "COMPLETED", "ARCHIVED"]);

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

function printHelp() {
  console.log(`
SoloStack MVP CLI

Usage:
  npm run mvp-cli -- <command> [subcommand] [options]

Commands:
  db-path
      Print the resolved SQLite database path.

  quick-capture <title>
      Create a task quickly with default values.

  task list [--status TODO|DOING|DONE|ARCHIVED] [--project <id|name>] [--limit <n>] [--all] [--json]
  task create --title "<text>" [--priority URGENT|NORMAL|LOW] [--project <id|name>]
              [--description "<text>"] [--due <date|iso>] [--remind <date|iso>]
              [--recurrence NONE|DAILY|WEEKLY|MONTHLY] [--important[=true|false]] [--json]
  task update --id <task-id> [--title "<text>"] [--description "<text>"|--clear-description]
              [--status TODO|DOING|DONE|ARCHIVED] [--priority URGENT|NORMAL|LOW]
              [--project <id|name>|--clear-project]
              [--due <date|iso>|--clear-due] [--remind <date|iso>|--clear-remind]
              [--recurrence NONE|DAILY|WEEKLY|MONTHLY] [--important <true|false>] [--json]
  task done --id <task-id> [--json]

  project list [--all] [--json]
  project create --name "<name>" [--description "<text>"] [--color "#RRGGBB"]
                 [--status ACTIVE|COMPLETED|ARCHIVED] [--json]

Global options:
  --db <path>      Use a specific SQLite file path.
  --json           Output JSON format for supported commands.

Examples:
  npm run mvp-cli -- task list --status TODO
  npm run mvp-cli -- quick-capture "Follow up client feedback"
  npm run mvp-cli -- project create --name "Q2 Launch" --color "#7C69FF"
`.trim());
}

function parseGlobalOptions(argv) {
  let dbPathOverride = null;
  let jsonOutput = false;
  const rest = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--db") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new CliError("Missing value for --db");
      }
      dbPathOverride = value;
      index += 1;
      continue;
    }
    if (token.startsWith("--db=")) {
      dbPathOverride = token.slice("--db=".length);
      continue;
    }
    if (token === "--json") {
      jsonOutput = true;
      continue;
    }
    rest.push(token);
  }

  return { dbPathOverride, jsonOutput, rest };
}

function parseCommandArgs(tokens) {
  const flags = new Map();
  const positional = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    if (token.includes("=")) {
      const separatorIndex = token.indexOf("=");
      const key = token.slice(2, separatorIndex);
      const value = token.slice(separatorIndex + 1);
      flags.set(key, value === "" ? true : value);
      continue;
    }

    const key = token.slice(2);
    const next = tokens[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      index += 1;
    } else {
      flags.set(key, true);
    }
  }

  return { flags, positional };
}

function resolveDatabasePath(dbPathOverride) {
  if (dbPathOverride) {
    return path.resolve(dbPathOverride);
  }

  if (process.env.SOLOSTACK_DB_PATH) {
    return path.resolve(process.env.SOLOSTACK_DB_PATH);
  }

  const candidates = getDefaultDatabaseCandidates();
  const existingPath = candidates.find((candidatePath) =>
    fs.existsSync(candidatePath),
  );

  return existingPath ?? candidates[0] ?? path.resolve(process.cwd(), DB_FILE_NAME);
}

function getDefaultDatabaseCandidates() {
  const homeDir = os.homedir();
  const list = [];
  const pushUnique = (value) => {
    if (!value) return;
    if (!list.includes(value)) list.push(value);
  };

  if (process.platform === "darwin") {
    const base = path.join(homeDir, "Library", "Application Support");
    pushUnique(path.join(base, APP_IDENTIFIER, DB_FILE_NAME));
    pushUnique(path.join(base, "solostack", DB_FILE_NAME));
  } else if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      pushUnique(path.join(appData, APP_IDENTIFIER, DB_FILE_NAME));
      pushUnique(path.join(appData, "solostack", DB_FILE_NAME));
    }
  } else {
    const xdgDataHome =
      process.env.XDG_DATA_HOME || path.join(homeDir, ".local", "share");
    pushUnique(path.join(xdgDataHome, APP_IDENTIFIER, DB_FILE_NAME));
    pushUnique(path.join(xdgDataHome, "solostack", DB_FILE_NAME));
  }

  pushUnique(path.resolve(process.cwd(), DB_FILE_NAME));
  return list;
}

function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  initializeSchema(db);
  return db;
}

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status_updated_at
    ON projects(status, updated_at DESC);

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
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);

    CREATE TABLE IF NOT EXISTS task_changelogs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('CREATED', 'UPDATED', 'STATUS_CHANGED')),
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_task_changelogs_task_created_at
    ON task_changelogs(task_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      duration_minutes INTEGER NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS task_subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_done BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_created_at
    ON task_subtasks(task_id, created_at ASC);
  `);

  ensureColumn(db, "tasks", "due_at", "ALTER TABLE tasks ADD COLUMN due_at DATETIME");
  ensureColumn(
    db,
    "tasks",
    "remind_at",
    "ALTER TABLE tasks ADD COLUMN remind_at DATETIME",
  );
  ensureColumn(
    db,
    "tasks",
    "recurrence",
    "ALTER TABLE tasks ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'NONE' CHECK(recurrence IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY'))",
  );
  ensureColumn(
    db,
    "tasks",
    "project_id",
    "ALTER TABLE tasks ADD COLUMN project_id TEXT",
  );
  ensureColumn(
    db,
    "tasks",
    "notes_markdown",
    "ALTER TABLE tasks ADD COLUMN notes_markdown TEXT",
  );
}

function ensureColumn(db, tableName, columnName, alterSql) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }
  db.exec(alterSql);
}

function normalizeEnum(value, validSet, label) {
  const normalized = String(value).trim().toUpperCase();
  if (!validSet.has(normalized)) {
    throw new CliError(`Invalid ${label}: ${value}`);
  }
  return normalized;
}

function parseInteger(value, label, fallbackValue) {
  if (value === undefined || value === null || value === true) {
    return fallbackValue;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function parseBoolean(value, label, fallbackValue = null) {
  if (value === undefined) return fallbackValue;
  if (value === true) return true;

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new CliError(`Invalid ${label}: ${value}`);
}

function parseDateInput(value, label) {
  if (value === undefined || value === null || value === true) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  let parsed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    parsed = new Date(`${raw}T09:00:00`);
  } else {
    parsed = new Date(raw);
  }

  if (Number.isNaN(parsed.getTime())) {
    throw new CliError(`Invalid ${label} datetime: ${value}`);
  }
  return parsed.toISOString();
}

function parseColorInput(value) {
  if (value === undefined || value === null || value === true) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (!/^#[0-9a-fA-F]{6}$/.test(raw)) {
    throw new CliError("Color must be in #RRGGBB format.");
  }
  return raw;
}

function nowIso() {
  return new Date().toISOString();
}

function insertTaskChangelog(
  db,
  {
    taskId,
    action,
    fieldName = null,
    oldValue = null,
    newValue = null,
    createdAt = nowIso(),
  },
) {
  db.prepare(
    `INSERT INTO task_changelogs (
      id,
      task_id,
      action,
      field_name,
      old_value,
      new_value,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    taskId,
    action,
    fieldName,
    oldValue,
    newValue,
    createdAt,
  );
}

function getTaskById(db, taskId) {
  return (
    db.prepare(
      "SELECT * FROM tasks WHERE id = ? LIMIT 1",
    ).get(taskId) ?? null
  );
}

function getProjectByRef(db, ref) {
  if (!ref) return null;
  const normalizedRef = String(ref).trim();
  if (!normalizedRef) return null;

  const byId =
    db.prepare("SELECT * FROM projects WHERE id = ? LIMIT 1").get(normalizedRef) ??
    null;
  if (byId) return byId;

  return (
    db.prepare("SELECT * FROM projects WHERE LOWER(name) = LOWER(?) LIMIT 1").get(
      normalizedRef,
    ) ?? null
  );
}

function requireProjectId(db, projectRef) {
  const project = getProjectByRef(db, projectRef);
  if (!project) {
    throw new CliError(`Project not found: ${projectRef}`);
  }
  return project.id;
}

function getNextRecurringDueAt(currentDueAt, recurrence) {
  if (!currentDueAt || recurrence === "NONE") return null;
  const dueDate = new Date(currentDueAt);
  if (Number.isNaN(dueDate.getTime())) return null;

  if (recurrence === "DAILY") dueDate.setDate(dueDate.getDate() + 1);
  if (recurrence === "WEEKLY") dueDate.setDate(dueDate.getDate() + 7);
  if (recurrence === "MONTHLY") dueDate.setMonth(dueDate.getMonth() + 1);
  return dueDate.toISOString();
}

function shiftReminderWithDueDate(currentRemindAt, currentDueAt, nextDueAt) {
  if (!currentRemindAt || !currentDueAt || !nextDueAt) return null;

  const remindDate = new Date(currentRemindAt);
  const dueDate = new Date(currentDueAt);
  const nextDueDate = new Date(nextDueAt);

  if (
    Number.isNaN(remindDate.getTime()) ||
    Number.isNaN(dueDate.getTime()) ||
    Number.isNaN(nextDueDate.getTime())
  ) {
    return null;
  }

  const offset = remindDate.getTime() - dueDate.getTime();
  return new Date(nextDueDate.getTime() + offset).toISOString();
}

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function printTaskRows(rows) {
  if (rows.length === 0) {
    console.log("No tasks found.");
    return;
  }

  for (const row of rows) {
    const important = row.is_important ? " !important" : "";
    const dueLabel = formatDateTime(row.due_at);
    const projectLabel = row.project_name ? ` | project: ${row.project_name}` : "";
    console.log(
      `${row.id} | [${row.status}] [${row.priority}]${important} ${row.title} | due: ${dueLabel}${projectLabel}`,
    );
  }
}

function printProjectRows(rows) {
  if (rows.length === 0) {
    console.log("No projects found.");
    return;
  }

  for (const row of rows) {
    const description = row.description ? ` | ${row.description}` : "";
    const color = row.color ? ` | ${row.color}` : "";
    console.log(`${row.id} | [${row.status}] ${row.name}${color}${description}`);
  }
}

function outputPayload(payload, jsonOutput, printer) {
  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  printer(payload);
}

function handleQuickCapture(db, tokens, jsonOutput) {
  const { flags, positional } = parseCommandArgs(tokens);
  const titleFromFlag = typeof flags.get("title") === "string" ? flags.get("title") : "";
  const titleFromPositional = positional.join(" ").trim();
  const title = (titleFromFlag || titleFromPositional).trim();
  if (!title) {
    throw new CliError('Missing title. Example: quick-capture "Plan sprint retrospective"');
  }

  const now = nowIso();
  const taskId = crypto.randomUUID();

  db.prepare(
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
    ) VALUES (?, ?, NULL, NULL, NULL, 'TODO', 'NORMAL', 0, NULL, NULL, 'NONE', ?, ?)`,
  ).run(taskId, title, now, now);

  insertTaskChangelog(db, {
    taskId,
    action: "CREATED",
    newValue: title,
    createdAt: now,
  });

  const task = getTaskById(db, taskId);
  outputPayload(
    task,
    jsonOutput,
    (item) => {
      console.log(`Created task ${item.id}`);
      printTaskRows([{ ...item, project_name: null }]);
    },
  );
}

function handleProjectCommand(db, subcommand, tokens, jsonOutput) {
  if (subcommand === "list") {
    const { flags } = parseCommandArgs(tokens);
    const includeArchived = Boolean(flags.get("all"));

    const rows = db
      .prepare(
        `SELECT id, name, description, color, status, created_at, updated_at
           FROM projects
          ${includeArchived ? "" : "WHERE status != 'ARCHIVED'"}
          ORDER BY
            CASE status
              WHEN 'ACTIVE' THEN 0
              WHEN 'COMPLETED' THEN 1
              ELSE 2
            END ASC,
            updated_at DESC,
            name COLLATE NOCASE ASC`,
      )
      .all();

    outputPayload(rows, jsonOutput, printProjectRows);
    return;
  }

  if (subcommand === "create") {
    const { flags, positional } = parseCommandArgs(tokens);
    const nameFlag = typeof flags.get("name") === "string" ? flags.get("name") : "";
    const nameFromPositional = positional.join(" ").trim();
    const name = (nameFlag || nameFromPositional).trim();
    if (!name) {
      throw new CliError("Project name is required. Use --name.");
    }

    const description =
      typeof flags.get("description") === "string"
        ? flags.get("description").trim() || null
        : null;
    const color = parseColorInput(flags.get("color"));
    const statusValue = flags.get("status");
    const status =
      statusValue === undefined || statusValue === true
        ? "ACTIVE"
        : normalizeEnum(statusValue, PROJECT_STATUSES, "project status");

    const duplicate = db
      .prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?) LIMIT 1")
      .get(name);
    if (duplicate) {
      throw new CliError(`Project name already exists: ${name}`);
    }

    const now = nowIso();
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO projects (
        id,
        name,
        description,
        color,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, description, color, status, now, now);

    const createdProject = db
      .prepare("SELECT * FROM projects WHERE id = ? LIMIT 1")
      .get(id);
    outputPayload(
      createdProject,
      jsonOutput,
      (project) => {
        console.log(`Created project ${project.id}`);
        printProjectRows([project]);
      },
    );
    return;
  }

  throw new CliError(`Unknown project subcommand: ${subcommand}`);
}

function handleTaskList(db, tokens, jsonOutput) {
  const { flags } = parseCommandArgs(tokens);
  const includeArchived = Boolean(flags.get("all"));
  const limit = parseInteger(flags.get("limit"), "limit", 30);

  const conditions = [];
  const params = [];

  if (!includeArchived) {
    conditions.push("t.status != 'ARCHIVED'");
  }

  const statusRaw = flags.get("status");
  if (statusRaw && statusRaw !== true) {
    conditions.push("t.status = ?");
    params.push(normalizeEnum(statusRaw, TASK_STATUSES, "task status"));
  }

  const projectRaw = flags.get("project");
  if (projectRaw && projectRaw !== true) {
    const projectId = requireProjectId(db, projectRaw);
    conditions.push("t.project_id = ?");
    params.push(projectId);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `
    SELECT
      t.id,
      t.title,
      t.status,
      t.priority,
      t.is_important,
      t.due_at,
      t.project_id,
      t.updated_at,
      p.name AS project_name
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    ${whereClause}
    ORDER BY
      CASE t.status
        WHEN 'TODO' THEN 0
        WHEN 'DOING' THEN 1
        WHEN 'DONE' THEN 2
        ELSE 3
      END ASC,
      CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END ASC,
      t.due_at ASC,
      t.updated_at DESC
    LIMIT ?
  `;
  params.push(limit);

  const rows = db.prepare(query).all(...params);
  outputPayload(rows, jsonOutput, printTaskRows);
}

function normalizeTaskPatch(db, existingTask, flags) {
  const patch = {};

  if (typeof flags.get("title") === "string") {
    const title = flags.get("title").trim();
    if (!title) throw new CliError("Task title cannot be empty.");
    patch.title = title;
  }

  if (flags.has("description")) {
    if (flags.get("description") === true) {
      patch.description = null;
    } else {
      const description = String(flags.get("description")).trim();
      patch.description = description ? description : null;
    }
  }
  if (flags.has("clear-description")) {
    patch.description = null;
  }

  if (flags.has("status")) {
    patch.status = normalizeEnum(
      flags.get("status"),
      TASK_STATUSES,
      "task status",
    );
  }
  if (flags.has("priority")) {
    patch.priority = normalizeEnum(
      flags.get("priority"),
      TASK_PRIORITIES,
      "task priority",
    );
  }
  if (flags.has("recurrence")) {
    patch.recurrence = normalizeEnum(
      flags.get("recurrence"),
      TASK_RECURRENCES,
      "task recurrence",
    );
  }

  if (flags.has("important")) {
    patch.is_important = parseBoolean(flags.get("important"), "important flag");
  }

  if (flags.has("due")) {
    patch.due_at = parseDateInput(flags.get("due"), "due");
  }
  if (flags.has("clear-due")) {
    patch.due_at = null;
  }

  if (flags.has("remind")) {
    patch.remind_at = parseDateInput(flags.get("remind"), "remind");
  }
  if (flags.has("clear-remind")) {
    patch.remind_at = null;
  }

  if (flags.has("project")) {
    const projectValue = flags.get("project");
    patch.project_id =
      projectValue === true ? null : requireProjectId(db, projectValue);
  }
  if (flags.has("clear-project")) {
    patch.project_id = null;
  }

  if (
    patch.remind_at &&
    patch.due_at &&
    new Date(patch.remind_at).getTime() > new Date(patch.due_at).getTime()
  ) {
    throw new CliError("Reminder must be earlier than due datetime.");
  }

  if (
    patch.recurrence &&
    patch.recurrence !== "NONE" &&
    (patch.due_at ?? existingTask.due_at) === null
  ) {
    throw new CliError("Recurring task requires a due datetime.");
  }

  return patch;
}

function applyTaskUpdate(db, existingTask, patch) {
  const changedFields = [];
  const setClauses = [];
  const values = [];

  const comparableFields = [
    "title",
    "description",
    "project_id",
    "status",
    "priority",
    "is_important",
    "due_at",
    "remind_at",
    "recurrence",
  ];

  for (const field of comparableFields) {
    if (!(field in patch)) continue;
    const nextValue =
      field === "is_important"
        ? patch[field]
          ? 1
          : 0
        : patch[field];
    const previousValue = existingTask[field];
    if ((previousValue ?? null) === (nextValue ?? null)) continue;

    setClauses.push(`${field} = ?`);
    values.push(nextValue);
    changedFields.push({
      field,
      oldValue: previousValue ?? null,
      newValue: nextValue ?? null,
    });
  }

  if (setClauses.length === 0) {
    return { changedFields: [], updatedTask: existingTask, now: nowIso() };
  }

  const now = nowIso();
  setClauses.push("updated_at = ?");
  values.push(now);
  values.push(existingTask.id);

  db.prepare(`UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ?`).run(
    ...values,
  );

  const updatedTask = getTaskById(db, existingTask.id);
  if (!updatedTask) {
    throw new CliError("Task update failed.");
  }

  for (const change of changedFields) {
    const action = change.field === "status" ? "STATUS_CHANGED" : "UPDATED";
    insertTaskChangelog(db, {
      taskId: existingTask.id,
      action,
      fieldName: change.field,
      oldValue: change.oldValue === null ? null : String(change.oldValue),
      newValue: change.newValue === null ? null : String(change.newValue),
      createdAt: now,
    });
  }

  if (
    existingTask.status !== "DONE" &&
    updatedTask.status === "DONE" &&
    updatedTask.recurrence !== "NONE" &&
    updatedTask.due_at
  ) {
    createNextRecurringTask(db, updatedTask, now);
  }

  return { changedFields, updatedTask, now };
}

function createNextRecurringTask(db, completedTask, createdAt) {
  const nextDueAt = getNextRecurringDueAt(
    completedTask.due_at,
    completedTask.recurrence,
  );
  if (!nextDueAt) return;

  const nextRemindAt = shiftReminderWithDueDate(
    completedTask.remind_at,
    completedTask.due_at,
    nextDueAt,
  );

  const nextTaskId = crypto.randomUUID();
  db.prepare(
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
    ) VALUES (?, ?, ?, ?, ?, 'TODO', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nextTaskId,
    completedTask.title,
    completedTask.description ?? null,
    completedTask.notes_markdown ?? null,
    completedTask.project_id ?? null,
    completedTask.priority,
    completedTask.is_important ? 1 : 0,
    nextDueAt,
    nextRemindAt,
    completedTask.recurrence,
    createdAt,
    createdAt,
  );

  insertTaskChangelog(db, {
    taskId: nextTaskId,
    action: "CREATED",
    newValue: completedTask.title,
    createdAt,
  });
}

function handleTaskCreate(db, tokens, jsonOutput) {
  const { flags, positional } = parseCommandArgs(tokens);
  const titleFlag = typeof flags.get("title") === "string" ? flags.get("title") : "";
  const titlePositional = positional.join(" ").trim();
  const title = (titleFlag || titlePositional).trim();
  if (!title) {
    throw new CliError("Task title is required. Use --title.");
  }

  const priorityValue = flags.get("priority");
  const priority =
    priorityValue === undefined || priorityValue === true
      ? "NORMAL"
      : normalizeEnum(priorityValue, TASK_PRIORITIES, "task priority");

  const recurrenceValue = flags.get("recurrence");
  const recurrence =
    recurrenceValue === undefined || recurrenceValue === true
      ? "NONE"
      : normalizeEnum(recurrenceValue, TASK_RECURRENCES, "task recurrence");

  const isImportant = parseBoolean(flags.get("important"), "important flag", false);
  const dueAt = parseDateInput(flags.get("due"), "due");
  const remindAt = parseDateInput(flags.get("remind"), "remind");
  const description =
    typeof flags.get("description") === "string"
      ? flags.get("description").trim() || null
      : null;
  const projectId = flags.has("project")
    ? requireProjectId(db, flags.get("project"))
    : null;

  if (recurrence !== "NONE" && !dueAt) {
    throw new CliError("Recurring task requires --due.");
  }

  if (
    remindAt &&
    dueAt &&
    new Date(remindAt).getTime() > new Date(dueAt).getTime()
  ) {
    throw new CliError("Reminder must be earlier than due datetime.");
  }

  const now = nowIso();
  const taskId = crypto.randomUUID();
  db.prepare(
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
    ) VALUES (?, ?, ?, NULL, ?, 'TODO', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    taskId,
    title,
    description,
    projectId,
    priority,
    isImportant ? 1 : 0,
    dueAt,
    remindAt,
    recurrence,
    now,
    now,
  );

  insertTaskChangelog(db, {
    taskId,
    action: "CREATED",
    newValue: title,
    createdAt: now,
  });

  const createdTask = getTaskById(db, taskId);
  outputPayload(
    createdTask,
    jsonOutput,
    (task) => {
      console.log(`Created task ${task.id}`);
      const projectName = task.project_id
        ? getProjectByRef(db, task.project_id)?.name ?? null
        : null;
      printTaskRows([{ ...task, project_name: projectName }]);
    },
  );
}

function resolveTaskId(flags, positional) {
  if (typeof flags.get("id") === "string") return flags.get("id").trim();
  if (positional.length > 0) return positional[0].trim();
  return "";
}

function handleTaskUpdate(db, tokens, jsonOutput) {
  const { flags, positional } = parseCommandArgs(tokens);
  const taskId = resolveTaskId(flags, positional);
  if (!taskId) {
    throw new CliError("Task id is required. Use --id <task-id>.");
  }

  const existingTask = getTaskById(db, taskId);
  if (!existingTask) {
    throw new CliError(`Task not found: ${taskId}`);
  }

  const patch = normalizeTaskPatch(db, existingTask, flags);
  const { changedFields, updatedTask } = applyTaskUpdate(db, existingTask, patch);
  outputPayload(
    {
      task: updatedTask,
      changedFields: changedFields.map((item) => item.field),
    },
    jsonOutput,
    (result) => {
      if (result.changedFields.length === 0) {
        console.log("No changes applied.");
      } else {
        console.log(
          `Updated task ${result.task.id} (${result.changedFields.join(", ")})`,
        );
      }
      const projectName = result.task.project_id
        ? getProjectByRef(db, result.task.project_id)?.name ?? null
        : null;
      printTaskRows([{ ...result.task, project_name: projectName }]);
    },
  );
}

function handleTaskDone(db, tokens, jsonOutput) {
  const { flags, positional } = parseCommandArgs(tokens);
  const taskId = resolveTaskId(flags, positional);
  if (!taskId) {
    throw new CliError("Task id is required. Use --id <task-id>.");
  }

  const existingTask = getTaskById(db, taskId);
  if (!existingTask) {
    throw new CliError(`Task not found: ${taskId}`);
  }

  const { updatedTask, changedFields } = applyTaskUpdate(db, existingTask, {
    status: "DONE",
  });
  outputPayload(
    {
      task: updatedTask,
      changed: changedFields.length > 0,
    },
    jsonOutput,
    (result) => {
      if (!result.changed) {
        console.log(`Task ${result.task.id} was already DONE.`);
      } else {
        console.log(`Marked task ${result.task.id} as DONE.`);
      }
      const projectName = result.task.project_id
        ? getProjectByRef(db, result.task.project_id)?.name ?? null
        : null;
      printTaskRows([{ ...result.task, project_name: projectName }]);
    },
  );
}

function handleTaskCommand(db, subcommand, tokens, jsonOutput) {
  if (subcommand === "list") {
    handleTaskList(db, tokens, jsonOutput);
    return;
  }
  if (subcommand === "create") {
    handleTaskCreate(db, tokens, jsonOutput);
    return;
  }
  if (subcommand === "update") {
    handleTaskUpdate(db, tokens, jsonOutput);
    return;
  }
  if (subcommand === "done") {
    handleTaskDone(db, tokens, jsonOutput);
    return;
  }

  throw new CliError(`Unknown task subcommand: ${subcommand}`);
}

function run() {
  const { dbPathOverride, jsonOutput, rest } = parseGlobalOptions(
    process.argv.slice(2),
  );

  if (rest.length === 0 || rest[0] === "help" || rest[0] === "--help") {
    printHelp();
    return;
  }

  const command = rest[0];
  const subcommand = rest[1];
  const remaining = rest.slice(2);
  const dbPath = resolveDatabasePath(dbPathOverride);

  if (command === "db-path") {
    console.log(dbPath);
    return;
  }

  const db = openDatabase(dbPath);
  try {
    if (command === "quick-capture" || command === "capture") {
      handleQuickCapture(db, rest.slice(1), jsonOutput);
      return;
    }

    if (command === "task") {
      if (!subcommand) {
        throw new CliError("Missing task subcommand.");
      }
      handleTaskCommand(db, subcommand, remaining, jsonOutput);
      return;
    }

    if (command === "project") {
      if (!subcommand) {
        throw new CliError("Missing project subcommand.");
      }
      handleProjectCommand(db, subcommand, remaining, jsonOutput);
      return;
    }

    throw new CliError(`Unknown command: ${command}`);
  } finally {
    db.close();
  }
}

try {
  run();
} catch (error) {
  if (error instanceof CliError) {
    console.error(`Error: ${error.message}`);
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error("Error: Unknown failure");
  }
  process.exit(1);
}
