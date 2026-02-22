// @vitest-environment node

import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { SyncSessionDiagnostics } from "@/lib/types";

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
    path.join(os.tmpdir(), "solostack-sync-diagnostics-history-test-"),
  );
  const databaseName = `solostack-${randomUUID()}.db`;
  const instances = new Map<string, NodeSqliteAdapter>();

  return {
    default: {
      async load(inputName: string) {
        const resolvedName = inputName.startsWith("sqlite:")
          ? inputName.slice("sqlite:".length)
          : inputName;
        const filePath = path.join(tempDir, resolvedName || databaseName);
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

function createDiagnostics(
  overrides: Partial<SyncSessionDiagnostics> = {},
): SyncSessionDiagnostics {
  return {
    total_cycles: 0,
    successful_cycles: 0,
    failed_cycles: 0,
    conflict_cycles: 0,
    consecutive_failures: 0,
    success_rate_percent: 0,
    last_cycle_duration_ms: null,
    average_cycle_duration_ms: null,
    last_attempt_at: null,
    last_success_at: null,
    selected_provider: null,
    runtime_profile: null,
    runtime_preset_source: null,
    provider_selected_events: 0,
    runtime_profile_changed_events: 0,
    validation_rejected_events: 0,
    last_warning: null,
    ...overrides,
  };
}

describe("database sync session diagnostics history", () => {
  it("returns empty history by default", async () => {
    const history = await database.getSyncSessionDiagnosticsHistory();
    expect(history).toEqual([]);
  });

  it("persists snapshots in reverse chronological order", async () => {
    await database.appendSyncSessionDiagnosticsSnapshot(
      createDiagnostics({
        total_cycles: 1,
        successful_cycles: 1,
        success_rate_percent: 100,
        runtime_preset_source: "fallback_desktop",
      }),
      "2026-02-22T00:00:00.000Z",
    );
    await database.appendSyncSessionDiagnosticsSnapshot(
      createDiagnostics({
        total_cycles: 2,
        successful_cycles: 2,
        success_rate_percent: 100,
        runtime_preset_source: "user_agent_data_mobile",
      }),
      "2026-02-22T00:01:00.000Z",
    );

    const history = await database.getSyncSessionDiagnosticsHistory(10);
    expect(history).toHaveLength(2);
    expect(history[0].captured_at).toBe("2026-02-22T00:01:00.000Z");
    expect(history[0].diagnostics.runtime_preset_source).toBe(
      "user_agent_data_mobile",
    );
    expect(history[1].captured_at).toBe("2026-02-22T00:00:00.000Z");
  });

  it("deduplicates identical snapshot payloads", async () => {
    const snapshot = createDiagnostics({
      total_cycles: 5,
      successful_cycles: 4,
      failed_cycles: 1,
      success_rate_percent: 80,
      runtime_preset_source: "platform_pattern",
    });

    await database.appendSyncSessionDiagnosticsSnapshot(
      snapshot,
      "2026-02-22T00:05:00.000Z",
    );
    await database.appendSyncSessionDiagnosticsSnapshot(
      snapshot,
      "2026-02-22T00:05:00.000Z",
    );

    const history = await database.getSyncSessionDiagnosticsHistory(50);
    const duplicates = history.filter(
      (entry) => entry.captured_at === "2026-02-22T00:05:00.000Z",
    );
    expect(duplicates).toHaveLength(1);
  });
});
