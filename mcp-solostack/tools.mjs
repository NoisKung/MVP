import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const TASK_STATUSES = new Set(["TODO", "DOING", "DONE", "ARCHIVED"]);
const PROJECT_STATUSES = new Set(["ACTIVE", "COMPLETED", "ARCHIVED"]);
const SUPPORTED_TOOLS = new Set(["get_tasks", "get_projects"]);

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
        supported_tools: Array.from(SUPPORTED_TOOLS),
      },
    });
  }
  return normalized;
}

function normalizeTaskArgs(rawArgs) {
  const args = asOptionalPlainObject(rawArgs) ?? {};
  const status = asOptionalString(args.status);
  if (status && !TASK_STATUSES.has(status)) {
    throw new ToolExecutionError({
      code: "INVALID_ARGUMENT",
      status: 400,
      message: "status must be one of TODO, DOING, DONE, ARCHIVED.",
    });
  }

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
  const status = asOptionalString(args.status);
  if (status && !PROJECT_STATUSES.has(status)) {
    throw new ToolExecutionError({
      code: "INVALID_ARGUMENT",
      status: 400,
      message: "status must be one of ACTIVE, COMPLETED, ARCHIVED.",
    });
  }

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
      "(LOWER(title) LIKE LOWER(?) OR LOWER(COALESCE(description, '')) LIKE LOWER(?))",
    );
    const keyword = `%${args.search}%`;
    params.push(keyword, keyword);
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
