// @vitest-environment node

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { ToolExecutionError, executeReadTool } from "./tools.mjs";

function createFixtureDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "solostack-mcp-tools-test-"));
  const dbPath = path.join(dir, "fixture.db");
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      notes_markdown TEXT,
      project_id TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      is_important INTEGER NOT NULL,
      due_at TEXT,
      remind_at TEXT,
      recurrence TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE task_changelogs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const projectId = `project-${randomUUID()}`;
  const weekStartIso = "2025-01-06T00:00:00.000Z";

  const todoTaskId = `task-${randomUUID()}`;
  const noDueTaskId = `task-${randomUUID()}`;
  const carryOverTaskId = `task-${randomUUID()}`;
  const doneTaskId = `task-${randomUUID()}`;

  db.prepare(
    `INSERT INTO projects (id, name, description, color, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    projectId,
    "SoloStack",
    "Main project",
    "#3B82F6",
    "ACTIVE",
    "2025-01-01T00:00:00.000Z",
    "2025-01-09T12:00:00.000Z",
  );

  const insertTask = db.prepare(
    `INSERT INTO tasks (
      id, title, description, notes_markdown, project_id, status, priority,
      is_important, due_at, remind_at, recurrence, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  insertTask.run(
    todoTaskId,
    "Prepare release notes",
    "for v0.1.2",
    "release checklist",
    projectId,
    "TODO",
    "NORMAL",
    1,
    "2025-01-10T18:00:00.000Z",
    null,
    "NONE",
    "2025-01-07T10:00:00.000Z",
    "2025-01-10T10:00:00.000Z",
  );
  insertTask.run(
    noDueTaskId,
    "Polish MCP docs",
    "add usage notes",
    "agent docs",
    projectId,
    "DOING",
    "NORMAL",
    0,
    null,
    null,
    "NONE",
    "2025-01-08T09:00:00.000Z",
    "2025-01-10T11:00:00.000Z",
  );
  insertTask.run(
    carryOverTaskId,
    "Refactor sync adapter",
    "carry over from previous sprint",
    null,
    projectId,
    "TODO",
    "URGENT",
    1,
    "2025-01-05T10:00:00.000Z",
    null,
    "NONE",
    "2024-12-31T09:30:00.000Z",
    "2025-01-10T08:00:00.000Z",
  );
  insertTask.run(
    doneTaskId,
    "Ship MCP baseline",
    "wave 1 complete",
    null,
    projectId,
    "DONE",
    "NORMAL",
    0,
    null,
    null,
    "NONE",
    "2025-01-07T08:00:00.000Z",
    "2025-01-09T13:00:00.000Z",
  );

  db.prepare(
    `INSERT INTO task_changelogs (
      id, task_id, action, field_name, old_value, new_value, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `log-${randomUUID()}`,
    doneTaskId,
    "STATUS_CHANGED",
    "status",
    "DOING",
    "DONE",
    "2025-01-09T13:00:00.000Z",
  );

  db.close();

  return {
    dbPath,
    projectId,
    weekStartIso,
    todoTaskId,
    doneTaskId,
  };
}

describe("mcp-solostack read tools", () => {
  it("returns tasks for get_tasks", () => {
    const { dbPath } = createFixtureDb();
    const result = executeReadTool({
      tool: "get_tasks",
      db_path: dbPath,
      args: {
        limit: 10,
      },
    });

    expect(result.tool).toBe("get_tasks");
    expect(result.data.items.length).toBeGreaterThan(0);
    expect(result.data.next_cursor).toBeNull();
  });

  it("returns projects for get_projects", () => {
    const { dbPath, projectId } = createFixtureDb();
    const result = executeReadTool({
      tool: "get_projects",
      db_path: dbPath,
      args: {
        limit: 10,
        status: "ACTIVE",
      },
    });

    expect(result.tool).toBe("get_projects");
    expect(result.data.items.length).toBe(1);
    expect(result.data.items[0]?.id).toBe(projectId);
  });

  it("returns filtered tasks for search_tasks", () => {
    const { dbPath, todoTaskId } = createFixtureDb();
    const result = executeReadTool({
      tool: "search_tasks",
      db_path: dbPath,
      args: {
        query: "release",
        limit: 10,
      },
    });

    expect(result.tool).toBe("search_tasks");
    expect(result.data.items.some((item) => item.id === todoTaskId)).toBe(true);
  });

  it("returns changelog items for get_task_changelogs", () => {
    const { dbPath, doneTaskId } = createFixtureDb();
    const result = executeReadTool({
      tool: "get_task_changelogs",
      db_path: dbPath,
      args: {
        task_id: doneTaskId,
        limit: 10,
      },
    });

    expect(result.tool).toBe("get_task_changelogs");
    expect(result.data.items.length).toBe(1);
    expect(result.data.items[0]?.action).toBe("STATUS_CHANGED");
  });

  it("returns weekly review counters and lists", () => {
    const { dbPath, weekStartIso } = createFixtureDb();
    const result = executeReadTool({
      tool: "get_weekly_review",
      db_path: dbPath,
      args: {
        week_start_iso: weekStartIso,
        item_limit: 10,
      },
    });

    expect(result.tool).toBe("get_weekly_review");
    expect(result.data.completed_count).toBe(1);
    expect(result.data.created_count).toBe(3);
    expect(result.data.pending_count).toBe(1);
    expect(result.data.overdue_count).toBe(2);
    expect(result.data.carry_over_count).toBe(1);
    expect(result.data.due_this_week_open_count).toBe(1);
    expect(result.data.completed_tasks.length).toBe(1);
    expect(result.data.pending_tasks.length).toBeGreaterThan(0);
  });

  it("throws validation error for missing search query", () => {
    const { dbPath } = createFixtureDb();
    expect(() =>
      executeReadTool({
        tool: "search_tasks",
        db_path: dbPath,
        args: {},
      }),
    ).toThrowError(ToolExecutionError);
  });

  it("throws ToolExecutionError when db path is missing", () => {
    expect(() =>
      executeReadTool({
        tool: "get_tasks",
        db_path: null,
        args: {},
      }),
    ).toThrowError(ToolExecutionError);
  });
});
