import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const TASK_STATUSES = new Set(["TODO", "DOING", "DONE", "ARCHIVED"]);
const PROJECT_STATUSES = new Set(["ACTIVE", "COMPLETED", "ARCHIVED"]);
export const MCP_READ_TOOLS = Object.freeze([
  "get_tasks",
  "get_projects",
  "get_weekly_review",
  "search_tasks",
  "get_task_changelogs",
]);
const SUPPORTED_TOOLS = new Set(MCP_READ_TOOLS);

function asOptionalString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function asOptionalPlainObject(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value;
}

function normalizePositiveInteger(
  value,
  input = {
    min: 1,
    max: 1000,
    fallback: 50,
  },
) {
  if (!Number.isFinite(value)) return input.fallback;
  const normalized = Math.floor(value);
  if (normalized < input.min) return input.min;
  if (normalized > input.max) return input.max;
  return normalized;
}

function normalizeCursor(cursor) {
  const normalized = asOptionalString(cursor);
  if (normalized === null) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || Math.floor(parsed) !== parsed || parsed < 0) {
    throw new ToolExecutionError({
      code: "INVALID_ARGUMENT",
      status: 400,
      message: "cursor must be a non-negative integer string.",
    });
  }
  return parsed;
}

function parseIsoDate(value, fieldName) {
  const normalized = asOptionalString(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new ToolExecutionError({
      code: "INVALID_ARGUMENT",
      status: 400,
      message: `${fieldName} must be a valid ISO datetime string.`,
    });
  }
  return parsed;
}

function toUtcDayStart(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

function toUtcDayEnd(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function toIsoString(date) {
  return date.toISOString();
}

function getCurrentUtcWeekStart(now = new Date()) {
  const day = now.getUTCDay();
  const offsetToMonday = (day + 6) % 7;
  const monday = new Date(now.getTime() - offsetToMonday * 24 * 60 * 60 * 1000);
  return toUtcDayStart(monday);
}

function buildWeekWindow(rawWeekStartIso) {
  const explicitWeekStart = parseIsoDate(rawWeekStartIso, "week_start_iso");
  const weekStartDate = explicitWeekStart
    ? toUtcDayStart(explicitWeekStart)
    : getCurrentUtcWeekStart(new Date());
  const weekEndDate = toUtcDayEnd(
    new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000),
  );
  const now = new Date();
  const periodEndDate = now < weekEndDate ? now : weekEndDate;

  return {
    week_start_iso: toIsoString(weekStartDate),
    week_end_iso: toIsoString(weekEndDate),
    period_end_iso: toIsoString(periodEndDate),
  };
}

function ensureStatus(value, supportedValues, message) {
  if (!value) return null;
  if (!supportedValues.has(value)) {
    throw new ToolExecutionError({
      code: "INVALID_ARGUMENT",
      status: 400,
      message,
    });
  }
  return value;
}

function hasTable(db, tableName) {
  const row = db
    .prepare(
      `SELECT name
         FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
        LIMIT 1`,
    )
    .get(tableName);
  return typeof row?.name === "string" && row.name === tableName;
}

export class ToolExecutionError extends Error {
  constructor(input) {
    super(input.message);
    this.name = "ToolExecutionError";
    this.code = input.code;
    this.status = input.status;
    this.retry_after_ms =
      typeof input.retry_after_ms === "number" &&
      Number.isFinite(input.retry_after_ms)
        ? input.retry_after_ms
        : null;
    this.details = asOptionalPlainObject(input.details);
  }
}

function normalizeTool(toolName) {
  const normalized = asOptionalString(toolName);
  if (!normalized || !SUPPORTED_TOOLS.has(normalized)) {
    throw new ToolExecutionError({
      code: "INVALID_ARGUMENT",
      status: 400,
      message: `Unsupported tool "${toolName}".`,
      details: {
        supported_tools: MCP_READ_TOOLS,
      },
    });
  }
  return normalized;
}

function normalizeTaskArgs(rawArgs) {
  const args = asOptionalPlainObject(rawArgs) ?? {};
  const status = ensureStatus(
    asOptionalString(args.status),
    TASK_STATUSES,
    "status must be one of TODO, DOING, DONE, ARCHIVED.",
  );

  return {
    limit: normalizePositiveInteger(args.limit, {
      min: 1,
      max: 500,
      fallback: 50,
    }),
    offset: normalizeCursor(args.cursor),
    status,
    project_id: asOptionalString(args.project_id),
    search: asOptionalString(args.search),
  };
}

function normalizeProjectArgs(rawArgs) {
  const args = asOptionalPlainObject(rawArgs) ?? {};
  const status = ensureStatus(
    asOptionalString(args.status),
    PROJECT_STATUSES,
    "status must be one of ACTIVE, COMPLETED, ARCHIVED.",
  );

  return {
    limit: normalizePositiveInteger(args.limit, {
      min: 1,
      max: 200,
      fallback: 50,
    }),
    offset: normalizeCursor(args.cursor),
    status,
  };
}

function normalizeSearchArgs(rawArgs) {
  const args = asOptionalPlainObject(rawArgs) ?? {};
  const query = asOptionalString(args.query);
  if (!query) {
    throw new ToolExecutionError({
      code: "INVALID_ARGUMENT",
      status: 400,
      message: "query is required for search_tasks.",
    });
  }

  return {
    limit: normalizePositiveInteger(args.limit, {
      min: 1,
      max: 200,
      fallback: 30,
    }),
    offset: normalizeCursor(args.cursor),
    query,
    status: ensureStatus(
      asOptionalString(args.status),
      TASK_STATUSES,
      "status must be one of TODO, DOING, DONE, ARCHIVED.",
    ),
  };
}

function normalizeTaskChangelogArgs(rawArgs) {
  const args = asOptionalPlainObject(rawArgs) ?? {};
  const taskId = asOptionalString(args.task_id);
  if (!taskId) {
    throw new ToolExecutionError({
      code: "INVALID_ARGUMENT",
      status: 400,
      message: "task_id is required for get_task_changelogs.",
    });
  }

  return {
    task_id: taskId,
    limit: normalizePositiveInteger(args.limit, {
      min: 1,
      max: 200,
      fallback: 20,
    }),
    offset: normalizeCursor(args.cursor),
  };
}

function normalizeWeeklyReviewArgs(rawArgs) {
  const args = asOptionalPlainObject(rawArgs) ?? {};
  return {
    week_window: buildWeekWindow(args.week_start_iso),
    item_limit: normalizePositiveInteger(args.item_limit, {
      min: 1,
      max: 100,
      fallback: 20,
    }),
  };
}

function queryTasks(db, args) {
  const filters = [];
  const params = [];

  if (args.status) {
    filters.push("status = ?");
    params.push(args.status);
  }
  if (args.project_id) {
    filters.push("project_id = ?");
    params.push(args.project_id);
  }
  if (args.search) {
    filters.push(
      "(LOWER(title) LIKE LOWER(?) OR LOWER(COALESCE(description, '')) LIKE LOWER(?) OR LOWER(COALESCE(notes_markdown, '')) LIKE LOWER(?))",
    );
    const keyword = `%${args.search}%`;
    params.push(keyword, keyword, keyword);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  params.push(args.limit, args.offset);
  const rows = db
    .prepare(
      `SELECT
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
        FROM tasks
        ${whereClause}
        ORDER BY updated_at DESC, id DESC
        LIMIT ? OFFSET ?`,
    )
    .all(...params);

  return {
    items: rows,
    next_cursor: rows.length >= args.limit ? String(args.offset + rows.length) : null,
  };
}

function queryProjects(db, args) {
  const filters = [];
  const params = [];

  if (args.status) {
    filters.push("status = ?");
    params.push(args.status);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  params.push(args.limit, args.offset);
  const rows = db
    .prepare(
      `SELECT
          id,
          name,
          description,
          color,
          status,
          created_at,
          updated_at
        FROM projects
        ${whereClause}
        ORDER BY updated_at DESC, id DESC
        LIMIT ? OFFSET ?`,
    )
    .all(...params);

  return {
    items: rows,
    next_cursor: rows.length >= args.limit ? String(args.offset + rows.length) : null,
  };
}

function querySearchTasks(db, args) {
  const filters = [
    "(LOWER(title) LIKE LOWER(?) OR LOWER(COALESCE(description, '')) LIKE LOWER(?) OR LOWER(COALESCE(notes_markdown, '')) LIKE LOWER(?))",
  ];
  const keyword = `%${args.query}%`;
  const params = [keyword, keyword, keyword];

  if (args.status) {
    filters.push("status = ?");
    params.push(args.status);
  }

  params.push(args.limit, args.offset);
  const rows = db
    .prepare(
      `SELECT
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
        FROM tasks
        WHERE ${filters.join(" AND ")}
        ORDER BY updated_at DESC, id DESC
        LIMIT ? OFFSET ?`,
    )
    .all(...params);

  return {
    items: rows,
    next_cursor: rows.length >= args.limit ? String(args.offset + rows.length) : null,
  };
}

function queryTaskChangelogs(db, args) {
  if (!hasTable(db, "task_changelogs")) {
    return {
      items: [],
      next_cursor: null,
    };
  }

  const rows = db
    .prepare(
      `SELECT
          id,
          task_id,
          action,
          field_name,
          old_value,
          new_value,
          created_at
        FROM task_changelogs
        WHERE task_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
    )
    .all(args.task_id, args.limit, args.offset);

  return {
    items: rows,
    next_cursor: rows.length >= args.limit ? String(args.offset + rows.length) : null,
  };
}

function queryCount(db, sql, params = []) {
  const row = db.prepare(sql).get(...params);
  const count = Number(row?.count ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function queryWeeklyReview(db, args) {
  const { week_window: weekWindow, item_limit: itemLimit } = args;
  const weekStartIso = weekWindow.week_start_iso;
  const weekEndIso = weekWindow.week_end_iso;
  const periodEndIso = weekWindow.period_end_iso;

  const aggregateRow = db
    .prepare(
      `SELECT
          COALESCE(SUM(CASE
            WHEN status NOT IN ('DONE', 'ARCHIVED')
              AND created_at <= ?
              AND (due_at IS NULL OR due_at >= ?)
            THEN 1 ELSE 0 END), 0) as pending_count,
          COALESCE(SUM(CASE
            WHEN status NOT IN ('DONE', 'ARCHIVED')
              AND created_at <= ?
              AND due_at IS NOT NULL
              AND due_at < ?
            THEN 1 ELSE 0 END), 0) as overdue_count,
          COALESCE(SUM(CASE
            WHEN status NOT IN ('DONE', 'ARCHIVED')
              AND created_at < ?
            THEN 1 ELSE 0 END), 0) as carry_over_count,
          COALESCE(SUM(CASE
            WHEN status NOT IN ('DONE', 'ARCHIVED')
              AND created_at <= ?
              AND due_at IS NOT NULL
              AND due_at >= ?
              AND due_at < ?
            THEN 1 ELSE 0 END), 0) as due_this_week_open_count
        FROM tasks`,
    )
    .get(
      periodEndIso,
      periodEndIso,
      periodEndIso,
      periodEndIso,
      weekStartIso,
      periodEndIso,
      weekStartIso,
      weekEndIso,
    );

  const createdCount = queryCount(
    db,
    `SELECT COALESCE(COUNT(*), 0) as count
       FROM tasks
      WHERE created_at >= ?
        AND created_at < ?`,
    [weekStartIso, periodEndIso],
  );

  let completedCount = 0;
  let completedTasks = [];
  if (hasTable(db, "task_changelogs")) {
    completedCount = queryCount(
      db,
      `SELECT COALESCE(COUNT(DISTINCT task_id), 0) as count
         FROM task_changelogs
        WHERE action = 'STATUS_CHANGED'
          AND field_name = 'status'
          AND new_value = 'DONE'
          AND created_at >= ?
          AND created_at < ?`,
      [weekStartIso, periodEndIso],
    );

    completedTasks = db
      .prepare(
        `SELECT
            t.id,
            t.title,
            t.description,
            t.notes_markdown,
            t.project_id,
            t.status,
            t.priority,
            t.is_important,
            t.due_at,
            t.remind_at,
            t.recurrence,
            t.created_at,
            t.updated_at,
            completed_log.completed_at
          FROM tasks t
          INNER JOIN (
            SELECT task_id, MAX(created_at) as completed_at
              FROM task_changelogs
             WHERE action = 'STATUS_CHANGED'
               AND field_name = 'status'
               AND new_value = 'DONE'
               AND created_at >= ?
               AND created_at < ?
             GROUP BY task_id
          ) completed_log ON completed_log.task_id = t.id
         ORDER BY completed_log.completed_at DESC, t.id DESC
         LIMIT ?`,
      )
      .all(weekStartIso, periodEndIso, itemLimit);
  }

  const pendingTasks = db
    .prepare(
      `SELECT
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
        FROM tasks
       WHERE status NOT IN ('DONE', 'ARCHIVED')
         AND created_at <= ?
         AND (due_at IS NULL OR due_at >= ?)
       ORDER BY
          CASE WHEN due_at IS NULL THEN 1 ELSE 0 END ASC,
          due_at ASC,
          CASE priority
            WHEN 'URGENT' THEN 0
            WHEN 'NORMAL' THEN 1
            ELSE 2
          END ASC,
          updated_at DESC
       LIMIT ?`,
    )
    .all(periodEndIso, periodEndIso, itemLimit);

  const overdueTasks = db
    .prepare(
      `SELECT
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
        FROM tasks
       WHERE status NOT IN ('DONE', 'ARCHIVED')
         AND created_at <= ?
         AND due_at IS NOT NULL
         AND due_at < ?
       ORDER BY due_at ASC, updated_at DESC
       LIMIT ?`,
    )
    .all(periodEndIso, periodEndIso, itemLimit);

  return {
    week_start_iso: weekStartIso,
    week_end_iso: weekEndIso,
    period_end_iso: periodEndIso,
    completed_count: completedCount,
    created_count: createdCount,
    pending_count: Number(aggregateRow?.pending_count ?? 0),
    overdue_count: Number(aggregateRow?.overdue_count ?? 0),
    carry_over_count: Number(aggregateRow?.carry_over_count ?? 0),
    due_this_week_open_count: Number(aggregateRow?.due_this_week_open_count ?? 0),
    completed_tasks: completedTasks,
    pending_tasks: pendingTasks,
    overdue_tasks: overdueTasks,
  };
}

function ensureDbPath(dbPath) {
  const normalized = asOptionalString(dbPath);
  if (!normalized) {
    throw new ToolExecutionError({
      code: "INVALID_ARGUMENT",
      status: 400,
      message: "MCP DB path is not configured (SOLOSTACK_MCP_DB_PATH).",
    });
  }
  if (!existsSync(normalized)) {
    throw new ToolExecutionError({
      code: "NOT_FOUND",
      status: 404,
      message: `SQLite file not found: ${normalized}`,
    });
  }
  return normalized;
}

export function executeReadTool(input) {
  const startedAtMs = Date.now();
  const tool = normalizeTool(input.tool);
  const dbPath = ensureDbPath(input.db_path);
  const db = new DatabaseSync(dbPath);

  try {
    let data;
    if (tool === "get_tasks") {
      data = queryTasks(db, normalizeTaskArgs(input.args));
    } else if (tool === "get_projects") {
      data = queryProjects(db, normalizeProjectArgs(input.args));
    } else if (tool === "search_tasks") {
      data = querySearchTasks(db, normalizeSearchArgs(input.args));
    } else if (tool === "get_task_changelogs") {
      data = queryTaskChangelogs(db, normalizeTaskChangelogArgs(input.args));
    } else if (tool === "get_weekly_review") {
      data = queryWeeklyReview(db, normalizeWeeklyReviewArgs(input.args));
    } else {
      throw new ToolExecutionError({
        code: "INVALID_ARGUMENT",
        status: 400,
        message: `Unsupported tool "${tool}".`,
      });
    }

    return {
      tool,
      data,
      duration_ms: Math.max(0, Date.now() - startedAtMs),
    };
  } catch (error) {
    if (error instanceof ToolExecutionError) throw error;
    throw new ToolExecutionError({
      code: "INTERNAL_ERROR",
      status: 500,
      message:
        error instanceof Error && error.message
          ? error.message
          : "Unexpected tool execution error.",
    });
  } finally {
    db.close();
  }
}
