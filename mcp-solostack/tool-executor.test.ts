// @vitest-environment node

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { ToolExecutionError } from "./tools.mjs";
import { createToolExecutor } from "./tool-executor.mjs";

function createFixtureDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "solostack-mcp-executor-test-"));
  const dbPath = path.join(dir, "fixture.db");
  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();

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

  const projectId = `project-${randomUUID()}`;
  db.prepare(
    `INSERT INTO projects (id, name, description, color, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(projectId, "SoloStack", "Main project", "#3B82F6", "ACTIVE", now, now);
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
  return dbPath;
}

describe("mcp-solostack tool executor", () => {
  it("uses direct mode when timeout strategy is soft", async () => {
    const executor = createToolExecutor(
      {
        timeout_guard_enabled: true,
        timeout_strategy: "soft",
        tool_timeout_ms: 500,
      },
      {
        execute_read_tool: () => ({
          tool: "get_tasks",
          data: { items: [], next_cursor: null },
          duration_ms: 1,
        }),
      },
    );

    expect(executor.mode).toBe("direct");
    const result = await executor.execute({
      tool: "get_tasks",
      args: {},
      db_path: "/tmp/any.db",
    });
    expect(result.tool).toBe("get_tasks");
  });

  it("executes tool in worker_hard mode", async () => {
    const dbPath = createFixtureDb();
    const executor = createToolExecutor({
      timeout_guard_enabled: true,
      timeout_strategy: "worker_hard",
      tool_timeout_ms: 1000,
    });

    expect(executor.mode).toBe("worker_hard");
    const result = await executor.execute({
      tool: "get_tasks",
      args: {
        limit: 5,
      },
      db_path: dbPath,
    });
    expect(result.tool).toBe("get_tasks");
    expect(Array.isArray(result.data.items)).toBe(true);
  });

  it("terminates worker and returns TIMEOUT when worker does not reply", async () => {
    const hangWorkerUrl = new URL(
      "./test-fixtures/hang-worker.mjs",
      import.meta.url,
    );
    const executor = createToolExecutor(
      {
        timeout_guard_enabled: true,
        timeout_strategy: "worker_hard",
        tool_timeout_ms: 100,
      },
      {
        worker_module_url: hangWorkerUrl,
      },
    );

    await expect(
      executor.execute({
        tool: "get_tasks",
        args: {},
        db_path: "/tmp/irrelevant.db",
      }),
    ).rejects.toMatchObject<ToolExecutionError>({
      code: "TIMEOUT",
      status: 504,
    });
  });
});
