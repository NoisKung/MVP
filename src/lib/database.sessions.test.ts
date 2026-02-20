// @vitest-environment node

import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-sql", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { DatabaseSync } = await import("node:sqlite");

  class NodeSqliteAdapter {
    #db: InstanceType<typeof DatabaseSync>;

    constructor(filePath: string) {
      this.#db = new DatabaseSync(filePath);
      this.#db.exec("PRAGMA foreign_keys = ON");
    }

    async execute(sql: string, params: unknown[] = []): Promise<void> {
      const normalizedSql = sql.replace(/\$(\d+)/g, "?$1");
      if (params.length === 0) {
        this.#db.exec(normalizedSql);
        return;
      }
      this.#db.prepare(normalizedSql).run(...params);
    }

    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      const normalizedSql = sql.replace(/\$(\d+)/g, "?$1");
      return this.#db.prepare(normalizedSql).all(...params) as T;
    }
  }

  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "solostack-db-sessions-test-"),
  );
  const instances = new Map<string, NodeSqliteAdapter>();

  return {
    default: {
      async load(databaseName: string) {
        const resolvedName = databaseName.startsWith("sqlite:")
          ? databaseName.slice("sqlite:".length)
          : databaseName;
        const filePath = path.join(tempDir, resolvedName);
        const existing = instances.get(filePath);
        if (existing) return existing;
        const created = new NodeSqliteAdapter(filePath);
        instances.set(filePath, created);
        return created;
      },
    },
  };
});

const database = await import("@/lib/database");

describe("database focus sessions", () => {
  it("creates and exports a focus session linked to a task", async () => {
    const task = await database.createTask({
      title: `Focus task ${randomUUID()}`,
      priority: "NORMAL",
      is_important: false,
      recurrence: "NONE",
    });

    const session = await database.createSession({
      task_id: task.id,
      duration_minutes: 25,
      completed_at: "2026-02-20T12:00:00.000Z",
    });

    expect(session.task_id).toBe(task.id);
    expect(session.duration_minutes).toBe(25);

    const backup = await database.exportBackupPayload();
    const exportedSession = backup.data.sessions.find(
      (item) => item.id === session.id,
    );
    expect(exportedSession).toBeTruthy();
    expect(exportedSession?.task_id).toBe(task.id);
    expect(exportedSession?.duration_minutes).toBe(25);
  });

  it("nulls session task links before deleting a task", async () => {
    const task = await database.createTask({
      title: `Task to delete ${randomUUID()}`,
      priority: "NORMAL",
      is_important: false,
      recurrence: "NONE",
    });

    const session = await database.createSession({
      task_id: task.id,
      duration_minutes: 15,
    });
    await database.deleteTask(task.id);

    const backup = await database.exportBackupPayload();
    const persistedSession = backup.data.sessions.find(
      (item) => item.id === session.id,
    );
    expect(persistedSession).toBeTruthy();
    expect(persistedSession?.task_id).toBeNull();
    expect(persistedSession?.duration_minutes).toBe(15);
  });
});
