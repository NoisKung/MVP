// @vitest-environment node

import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { SyncPushChange } from "@/lib/types";

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
    path.join(os.tmpdir(), "solostack-sync-observability-test-"),
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
    entity_id: overrides.entity_id ?? `task-${randomUUID()}`,
    operation: "UPSERT",
    updated_at: "2026-02-18T08:00:00.000Z",
    updated_by_device: "device-remote",
    sync_version: 1,
    payload: {
      description: "missing title should trigger field conflict",
    },
    idempotency_key: overrides.idempotency_key ?? `incoming-${randomUUID()}`,
    ...overrides,
  };
}

describe("database sync conflict observability counters", () => {
  it("returns zero counters for fresh state", async () => {
    const counters = await database.getSyncConflictObservabilityCounters();
    expect(counters).toEqual({
      total_conflicts: 0,
      open_conflicts: 0,
      resolved_conflicts: 0,
      ignored_conflicts: 0,
      retried_events: 0,
      exported_events: 0,
      resolution_rate_percent: 0,
      median_resolution_time_ms: null,
      latest_detected_at: null,
      latest_resolved_at: null,
    });
  });

  it("tracks resolution rate, retry/export event counts, and median resolve time", async () => {
    const firstChange = createIncomingConflictChange({
      entity_id: `task-obsv-a-${randomUUID()}`,
      idempotency_key: `incoming-obsv-a-${randomUUID()}`,
    });
    expect(await database.applyIncomingSyncChange(firstChange)).toBe("conflict");

    const secondChange = createIncomingConflictChange({
      entity_id: `task-obsv-b-${randomUUID()}`,
      idempotency_key: `incoming-obsv-b-${randomUUID()}`,
    });
    expect(await database.applyIncomingSyncChange(secondChange)).toBe("conflict");

    const allConflicts = await database.listSyncConflicts({
      status: "all",
      limit: 50,
    });
    const firstConflict = allConflicts.find(
      (conflict) =>
        conflict.entity_id === firstChange.entity_id &&
        conflict.incoming_idempotency_key === firstChange.idempotency_key,
    );
    const secondConflict = allConflicts.find(
      (conflict) =>
        conflict.entity_id === secondChange.entity_id &&
        conflict.incoming_idempotency_key === secondChange.idempotency_key,
    );
    expect(firstConflict).toBeTruthy();
    expect(secondConflict).toBeTruthy();

    await database.resolveSyncConflict({
      conflict_id: firstConflict!.id,
      strategy: "keep_local",
      resolved_by_device: "device-obsv",
    });
    await database.resolveSyncConflict({
      conflict_id: secondConflict!.id,
      strategy: "retry",
      resolved_by_device: "device-obsv",
    });
    await database.exportSyncConflictReport({
      status: "all",
      limit: 100,
      eventsPerConflict: 100,
    });

    const counters = await database.getSyncConflictObservabilityCounters();
    expect(counters.total_conflicts).toBe(2);
    expect(counters.open_conflicts).toBe(1);
    expect(counters.resolved_conflicts).toBe(1);
    expect(counters.ignored_conflicts).toBe(0);
    expect(counters.retried_events).toBe(1);
    expect(counters.exported_events).toBe(2);
    expect(counters.resolution_rate_percent).toBe(50);
    expect(counters.median_resolution_time_ms).not.toBeNull();
    expect(counters.median_resolution_time_ms).toBeGreaterThanOrEqual(0);
    expect(counters.latest_detected_at).not.toBeNull();
    expect(counters.latest_resolved_at).not.toBeNull();
  });
});
