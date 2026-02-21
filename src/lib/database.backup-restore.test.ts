// @vitest-environment node

import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { BackupPayload, SyncPushChange } from "@/lib/types";

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
    path.join(os.tmpdir(), "solostack-backup-restore-test-"),
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

function createIncomingConflictChange(
  overrides: Partial<SyncPushChange> = {},
): SyncPushChange {
  return {
    entity_type: "TASK",
    entity_id: overrides.entity_id ?? `task-backup-${randomUUID()}`,
    operation: "UPSERT",
    updated_at: "2026-02-18T10:00:00.000Z",
    updated_by_device: "device-remote",
    sync_version: 1,
    payload: {
      description: "missing title should trigger conflict",
    },
    idempotency_key:
      overrides.idempotency_key ?? `incoming-backup-${randomUUID()}`,
    ...overrides,
  };
}

function createEmptyBackupPayload(): BackupPayload {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    data: {
      settings: [],
      projects: [],
      tasks: [],
      sessions: [],
      task_subtasks: [],
      task_changelogs: [],
      task_templates: [],
    },
  };
}

async function seedOpenConflict(): Promise<void> {
  const result = await database.applyIncomingSyncChange(
    createIncomingConflictChange(),
  );
  expect(result).toBe("conflict");
}

describe("backup restore guardrails", () => {
  it("requires force restore when open conflicts exist", async () => {
    await seedOpenConflict();

    const preflight = await database.getBackupRestorePreflight();
    expect(preflight.pending_outbox_changes).toBe(0);
    expect(preflight.open_conflicts).toBeGreaterThan(0);
    expect(preflight.requires_force_restore).toBe(true);
  });

  it("blocks restore without force when open conflicts exist", async () => {
    await seedOpenConflict();

    await expect(
      database.importBackupPayload(createEmptyBackupPayload()),
    ).rejects.toThrow("open conflict(s)");
  });

  it("allows force restore and clears force-required preflight", async () => {
    await seedOpenConflict();

    const result = await database.importBackupPayload(
      createEmptyBackupPayload(),
      {
        force: true,
      },
    );
    expect(result).toEqual({
      settings: 0,
      projects: 0,
      tasks: 0,
      sessions: 0,
      task_subtasks: 0,
      task_changelogs: 0,
      task_templates: 0,
    });

    const preflightAfterRestore = await database.getBackupRestorePreflight();
    expect(preflightAfterRestore.open_conflicts).toBe(0);
    expect(preflightAfterRestore.pending_outbox_changes).toBe(0);
    expect(preflightAfterRestore.requires_force_restore).toBe(false);
  });

  it("includes latest backup summary counts in restore preflight", async () => {
    await database.importBackupPayload(createEmptyBackupPayload(), {
      force: true,
    });

    const project = await database.createProject({
      name: `Dry-run project ${randomUUID()}`,
    });
    await database.createTask({
      title: "Dry-run summary task",
      priority: "NORMAL",
      is_important: false,
      project_id: project.id,
    });
    await database.upsertTaskTemplate({
      name: `Dry-run template ${randomUUID()}`,
      priority: "NORMAL",
      is_important: false,
    });

    const exportedPayload = await database.exportBackupPayload();
    const preflight = await database.getBackupRestorePreflight();
    expect(preflight.has_latest_backup).toBe(true);
    expect(preflight.latest_backup_summary).toEqual({
      settings: exportedPayload.data.settings.length,
      projects: exportedPayload.data.projects.length,
      tasks: exportedPayload.data.tasks.length,
      sessions: exportedPayload.data.sessions.length,
      task_subtasks: exportedPayload.data.task_subtasks.length,
      task_changelogs: exportedPayload.data.task_changelogs.length,
      task_templates: exportedPayload.data.task_templates.length,
    });
  });
});
