// @vitest-environment node

import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
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
    path.join(os.tmpdir(), "solostack-sync-conflict-perf-test-"),
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

function createConflictSeedChange(index: number): SyncPushChange {
  return {
    entity_type: "TASK",
    entity_id: `task-perf-${index}-${randomUUID()}`,
    operation: "UPSERT",
    updated_at: "2026-02-17T15:00:00.000Z",
    updated_by_device: "device-remote",
    sync_version: 1,
    payload: {
      description: `payload-${index}`,
    },
    idempotency_key: `perf-${index}-${randomUUID()}`,
  };
}

describe("database conflict performance", () => {
  it("keeps conflict list/detail queries responsive for large sets", async () => {
    const totalConflicts = 500;

    for (let index = 0; index < totalConflicts; index += 1) {
      const result = await database.applyIncomingSyncChange(
        createConflictSeedChange(index),
      );
      expect(result).toBe("conflict");
    }

    const listStartedAt = performance.now();
    const openConflicts = await database.listSyncConflicts({
      status: "open",
      limit: totalConflicts,
    });
    const listDurationMs = performance.now() - listStartedAt;

    expect(openConflicts.length).toBe(totalConflicts);
    expect(listDurationMs).toBeLessThan(300);

    const firstConflict = openConflicts[0];
    expect(firstConflict).toBeTruthy();

    const detailStartedAt = performance.now();
    const detail = await database.getSyncConflict(firstConflict!.id);
    const events = await database.listSyncConflictEvents(firstConflict!.id, 50);
    const detailDurationMs = performance.now() - detailStartedAt;

    expect(detail).toBeTruthy();
    expect(events.length).toBeGreaterThan(0);
    expect(detailDurationMs).toBeLessThan(200);
  });
});
