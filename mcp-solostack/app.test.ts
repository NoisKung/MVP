// @vitest-environment node

import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpRequestHandler } from "./app.mjs";
import { loadMcpConfigFromEnv } from "./config.mjs";

async function startServer(handler: Parameters<typeof createServer>[0]) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve test server address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

function createFixtureDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "solostack-mcp-app-test-"));
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
  const taskId = `task-${randomUUID()}`;

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

  db.prepare(
    `INSERT INTO tasks (
      id, title, description, notes_markdown, project_id, status, priority,
      is_important, due_at, remind_at, recurrence, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    taskId,
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

  db.prepare(
    `INSERT INTO task_changelogs (
      id, task_id, action, field_name, old_value, new_value, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `log-${randomUUID()}`,
    taskId,
    "STATUS_CHANGED",
    "status",
    "DOING",
    "DONE",
    "2025-01-09T13:00:00.000Z",
  );

  db.close();
  return dbPath;
}

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closers.length > 0) {
    const close = closers.pop();
    if (!close) continue;
    await close();
  }
});

describe("mcp-solostack app", () => {
  it("returns health payload for /health", async () => {
    const config = loadMcpConfigFromEnv({
      SOLOSTACK_MCP_PORT: "9000",
    });
    const { baseUrl, close } = await startServer(
      createMcpRequestHandler({
        config,
        started_at_ms: Date.now() - 2500,
      }),
    );
    closers.push(close);

    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("mcp-solostack");
    expect(payload.ready).toBe(true);
    expect(payload.mode).toBe("read_only");
    expect(Array.isArray(payload.tools)).toBe(true);
    expect((payload.tools as unknown[]).length).toBe(5);
  });

  it("returns 404 for unknown route", async () => {
    const config = loadMcpConfigFromEnv({});
    const { baseUrl, close } = await startServer(
      createMcpRequestHandler({ config }),
    );
    closers.push(close);

    const response = await fetch(`${baseUrl}/unknown`);
    expect(response.status).toBe(404);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.status).toBe("error");
    expect(payload.message).toBe("Not found.");
  });

  it("returns tool payload for /tools/get_tasks", async () => {
    const dbPath = createFixtureDb();
    const config = loadMcpConfigFromEnv({
      SOLOSTACK_MCP_DB_PATH: dbPath,
    });
    const { baseUrl, close } = await startServer(
      createMcpRequestHandler({ config }),
    );
    closers.push(close);

    const response = await fetch(`${baseUrl}/tools/get_tasks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        request_id: "req-1",
        args: {
          limit: 5,
        },
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    const data = payload.data as { items?: unknown[] } | undefined;
    expect(data?.items?.length).toBeGreaterThan(0);
  });

  it("supports generic /tools route with tool in request body", async () => {
    const dbPath = createFixtureDb();
    const config = loadMcpConfigFromEnv({
      SOLOSTACK_MCP_DB_PATH: dbPath,
    });
    const { baseUrl, close } = await startServer(
      createMcpRequestHandler({ config }),
    );
    closers.push(close);

    const response = await fetch(`${baseUrl}/tools`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        request_id: "req-2",
        tool: "search_tasks",
        args: {
          query: "release",
          limit: 5,
        },
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(payload.tool).toBe("search_tasks");
  });

  it("returns weekly review payload for /tools/get_weekly_review", async () => {
    const dbPath = createFixtureDb();
    const config = loadMcpConfigFromEnv({
      SOLOSTACK_MCP_DB_PATH: dbPath,
    });
    const { baseUrl, close } = await startServer(
      createMcpRequestHandler({ config }),
    );
    closers.push(close);

    const response = await fetch(`${baseUrl}/tools/get_weekly_review`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        request_id: "req-3",
        args: {
          week_start_iso: "2025-01-06T00:00:00.000Z",
          item_limit: 5,
        },
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(payload.tool).toBe("get_weekly_review");
    const data = payload.data as { completed_count?: number } | undefined;
    expect(data?.completed_count).toBeGreaterThanOrEqual(0);
  });
});
