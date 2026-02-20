// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { SyncPushChange } from "@/lib/types";
import { resolveSyncTransportConfig } from "@/lib/sync-transport";

const TEMP_ROOT = fs.mkdtempSync(
  path.join(os.tmpdir(), "solostack-db-migration-test-"),
);

function seedLegacySchema(db: import("node:sqlite").DatabaseSync): void {
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
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      is_important BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_changelogs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      duration_minutes INTEGER NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_done BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      title_template TEXT,
      description TEXT,
      priority TEXT NOT NULL,
      is_important BOOLEAN DEFAULT 0,
      recurrence TEXT NOT NULL DEFAULT 'NONE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.prepare(
    `INSERT INTO tasks (
        id,
        title,
        description,
        status,
        priority,
        is_important,
        created_at,
        updated_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "legacy-task-1",
    "Legacy Task",
    "Created on old schema",
    "TODO",
    "NORMAL",
    0,
    "2026-02-17T01:00:00.000Z",
    "2026-02-17T01:00:00.000Z",
  );
}

vi.mock("@tauri-apps/plugin-sql", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const instances = new Map<string, InstanceType<typeof DatabaseSync>>();

  class NodeSqliteAdapter {
    #db: InstanceType<typeof DatabaseSync>;

    constructor(filePath: string) {
      this.#db = new DatabaseSync(filePath);
      this.#db.exec("PRAGMA foreign_keys = ON");
    }

    seedLegacyV0() {
      seedLegacySchema(this.#db);
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

  return {
    default: {
      async load(databaseName: string) {
        const resolvedName = databaseName.startsWith("sqlite:")
          ? databaseName.slice("sqlite:".length)
          : databaseName;
        const namespace =
          process.env.SOLOSTACK_MIGRATION_TEST_NAMESPACE ?? "default";
        const preseedMode =
          process.env.SOLOSTACK_MIGRATION_TEST_PRESEED ?? "none";
        const filePath = path.join(TEMP_ROOT, namespace, resolvedName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });

        const existing = instances.get(filePath);
        if (existing) return existing;

        const created = new NodeSqliteAdapter(filePath);
        if (preseedMode === "legacy_v0") {
          created.seedLegacyV0();
        }
        instances.set(filePath, created);
        return created;
      },
    },
  };
});

async function loadDatabaseModule(input: {
  namespace: string;
  preseed?: "none" | "legacy_v0";
}) {
  process.env.SOLOSTACK_MIGRATION_TEST_NAMESPACE = input.namespace;
  process.env.SOLOSTACK_MIGRATION_TEST_PRESEED = input.preseed ?? "none";
  vi.resetModules();
  return import("@/lib/database");
}

function createIncomingConflictChange(): SyncPushChange {
  return {
    entity_type: "TASK",
    entity_id: `task-migration-${randomUUID()}`,
    operation: "UPSERT",
    updated_at: "2026-02-17T12:00:00.000Z",
    updated_by_device: "device-remote",
    sync_version: 1,
    payload: { description: "missing title" },
    idempotency_key: `migration-${randomUUID()}`,
  };
}

afterAll(() => {
  delete process.env.SOLOSTACK_MIGRATION_TEST_NAMESPACE;
  delete process.env.SOLOSTACK_MIGRATION_TEST_PRESEED;
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
});

describe("database migration", () => {
  it("creates schema and sync metadata on a fresh database", async () => {
    const database = await loadDatabaseModule({
      namespace: `fresh-${randomUUID()}`,
      preseed: "none",
    });

    const checkpoint = await database.getSyncCheckpoint();
    expect(checkpoint.id).toBe(1);
    expect(checkpoint.last_sync_cursor).toBeNull();

    const createdTask = await database.createTask({
      title: "Fresh DB task",
      notes_markdown: "hello",
      priority: "NORMAL",
      is_important: false,
      recurrence: "NONE",
    });
    expect(createdTask.title).toBe("Fresh DB task");
    expect(createdTask.notes_markdown).toBe("hello");

    const openConflicts = await database.listSyncConflicts({
      status: "open",
      limit: 20,
    });
    expect(openConflicts).toHaveLength(0);
  });

  it("upgrades legacy schema and keeps existing data compatible", async () => {
    const database = await loadDatabaseModule({
      namespace: `legacy-${randomUUID()}`,
      preseed: "legacy_v0",
    });

    const tasksBefore = await database.getAllTasks();
    const legacyTask = tasksBefore.find((task) => task.id === "legacy-task-1");
    expect(legacyTask?.title).toBe("Legacy Task");

    const updatedLegacyTask = await database.updateTask({
      id: "legacy-task-1",
      notes_markdown: "Migrated notes",
      recurrence: "WEEKLY",
    });
    expect(updatedLegacyTask.notes_markdown).toBe("Migrated notes");
    expect(updatedLegacyTask.recurrence).toBe("WEEKLY");
    expect(updatedLegacyTask.sync_version).toBeGreaterThan(0);
    expect(updatedLegacyTask.updated_by_device).toBeTruthy();

    const checkpoint = await database.getSyncCheckpoint();
    expect(checkpoint.id).toBe(1);

    const conflictResult = await database.applyIncomingSyncChange(
      createIncomingConflictChange(),
    );
    expect(conflictResult).toBe("conflict");

    const openConflicts = await database.listSyncConflicts({
      status: "open",
      limit: 20,
    });
    expect(openConflicts.length).toBeGreaterThan(0);
  });

  it("seeds provider and runtime profile defaults for desktop preset", async () => {
    const database = await loadDatabaseModule({
      namespace: `runtime-desktop-${randomUUID()}`,
      preseed: "none",
    });

    const runtime = await database.ensureSyncRuntimeSettingsSeeded("desktop");
    expect(runtime).toEqual({
      auto_sync_interval_seconds: 60,
      background_sync_interval_seconds: 300,
      push_limit: 200,
      pull_limit: 200,
      max_pull_pages: 5,
    });

    const providerSettings = await database.getSyncProviderSettings();
    expect(providerSettings).toEqual({
      provider: "provider_neutral",
      provider_config: null,
    });

    const runtimeProfile =
      await database.getSyncRuntimeProfileSettings("desktop");
    expect(runtimeProfile.runtime_profile).toBe("desktop");
  });

  it("seeds mobile runtime profile default for legacy users", async () => {
    const database = await loadDatabaseModule({
      namespace: `runtime-mobile-${randomUUID()}`,
      preseed: "legacy_v0",
    });

    const runtime = await database.ensureSyncRuntimeSettingsSeeded("mobile");
    expect(runtime).toEqual({
      auto_sync_interval_seconds: 120,
      background_sync_interval_seconds: 600,
      push_limit: 120,
      pull_limit: 120,
      max_pull_pages: 3,
    });

    const runtimeProfile =
      await database.getSyncRuntimeProfileSettings("desktop");
    expect(runtimeProfile.runtime_profile).toBe("mobile_beta");
  });

  it("persists provider config and runtime profile updates", async () => {
    const database = await loadDatabaseModule({
      namespace: `provider-persist-${randomUUID()}`,
      preseed: "none",
    });

    await database.ensureSyncRuntimeSettingsSeeded("desktop");

    const updatedProvider = await database.updateSyncProviderSettings({
      provider: "google_appdata",
      provider_config: {
        mode: "managed",
        scope: "appdata",
      },
    });
    expect(updatedProvider.provider).toBe("google_appdata");
    expect(updatedProvider.provider_config).toEqual({
      mode: "managed",
      scope: "appdata",
    });

    const readBackProvider = await database.getSyncProviderSettings();
    expect(readBackProvider).toEqual(updatedProvider);

    await database.updateSyncRuntimeSettings({
      auto_sync_interval_seconds: 45,
      background_sync_interval_seconds: 120,
      push_limit: 150,
      pull_limit: 140,
      max_pull_pages: 6,
      runtime_profile: "mobile_beta",
    });
    let runtimeProfile =
      await database.getSyncRuntimeProfileSettings("desktop");
    expect(runtimeProfile.runtime_profile).toBe("mobile_beta");

    await database.updateSyncRuntimeSettings({
      auto_sync_interval_seconds: 45,
      background_sync_interval_seconds: 120,
      push_limit: 150,
      pull_limit: 140,
      max_pull_pages: 6,
    });
    runtimeProfile = await database.getSyncRuntimeProfileSettings("desktop");
    expect(runtimeProfile.runtime_profile).toBe("custom");
  });

  it("keeps provider/runtime/checkpoint/outbox stable across restart", async () => {
    const namespace = `restart-stability-${randomUUID()}`;
    const database = await loadDatabaseModule({
      namespace,
      preseed: "none",
    });

    await database.ensureSyncRuntimeSettingsSeeded("desktop");
    await database.updateSyncEndpointSettings({
      push_url: "https://sync.example.com/v1/sync/push",
      pull_url: "https://sync.example.com/v1/sync/pull",
    });
    await database.updateSyncProviderSettings({
      provider: "google_appdata",
      provider_config: {
        endpoint_mode: "managed",
        managed_available: true,
      },
    });
    await database.updateSyncRuntimeSettings({
      auto_sync_interval_seconds: 120,
      background_sync_interval_seconds: 600,
      push_limit: 140,
      pull_limit: 130,
      max_pull_pages: 4,
      runtime_profile: "mobile_beta",
    });
    await database.setSyncCheckpoint(
      "cursor-before-restart",
      "2026-02-19T00:00:00.000Z",
    );
    await database.createTask({
      title: "Restart stability task",
      priority: "NORMAL",
      is_important: false,
      recurrence: "NONE",
    });

    const outboxBefore = await database.listSyncOutboxChanges(100);
    expect(outboxBefore.length).toBeGreaterThan(0);
    const checkpointBefore = await database.getSyncCheckpoint();
    expect(checkpointBefore.last_sync_cursor).toBe("cursor-before-restart");

    const restartedDatabase = await loadDatabaseModule({
      namespace,
      preseed: "none",
    });

    const provider = await restartedDatabase.getSyncProviderSettings();
    expect(provider).toEqual({
      provider: "google_appdata",
      provider_config: {
        endpoint_mode: "managed",
        managed_available: true,
      },
    });
    const runtimeProfile =
      await restartedDatabase.getSyncRuntimeProfileSettings("desktop");
    expect(runtimeProfile.runtime_profile).toBe("mobile_beta");
    const runtime = await restartedDatabase.getSyncRuntimeSettings();
    expect(runtime).toEqual({
      auto_sync_interval_seconds: 120,
      background_sync_interval_seconds: 600,
      push_limit: 140,
      pull_limit: 130,
      max_pull_pages: 4,
    });
    const endpoints = await restartedDatabase.getSyncEndpointSettings();
    expect(endpoints).toEqual({
      push_url: "https://sync.example.com/v1/sync/push",
      pull_url: "https://sync.example.com/v1/sync/pull",
    });

    const resolvedTransport = resolveSyncTransportConfig({
      provider: provider.provider,
      providerConfig: provider.provider_config,
      pushUrl: endpoints.push_url,
      pullUrl: endpoints.pull_url,
    });
    expect(resolvedTransport.status).toBe("ready");
    expect(resolvedTransport.transport).toBeTruthy();

    await restartedDatabase.updateSyncProviderSettings({
      provider: "provider_neutral",
      provider_config: {
        endpoint_mode: "custom",
      },
    });
    const checkpointAfterSwitch = await restartedDatabase.getSyncCheckpoint();
    expect(checkpointAfterSwitch.last_sync_cursor).toBe(
      "cursor-before-restart",
    );
    const outboxAfterSwitch =
      await restartedDatabase.listSyncOutboxChanges(100);
    expect(outboxAfterSwitch.map((change) => change.id)).toEqual(
      outboxBefore.map((change) => change.id),
    );
  });
});
