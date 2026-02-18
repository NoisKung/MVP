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

  const now = new Date().toISOString();
  const projectId = `project-${randomUUID()}`;
  db.prepare(
    `INSERT INTO projects (id, name, description, color, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(projectId, "SoloStack", "Main project", "#7c69ff", "ACTIVE", now, now);
  db.prepare(
    `INSERT INTO tasks (
      id, title, description, notes_markdown, project_id, status, priority,
      is_important, due_at, remind_at, recurrence, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `task-${randomUUID()}`,
    "Prepare release notes",
    "for v0.1.2",
    null,
    projectId,
    "TODO",
    "NORMAL",
    1,
    null,
    null,
    "NONE",
    now,
    now,
  );

  db.close();
  return { dbPath, projectId };
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
