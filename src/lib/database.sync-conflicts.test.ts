// @vitest-environment node

import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { SyncPushChange } from "@/lib/types";
import { createSyncIdempotencyKey } from "@/lib/sync-contract";
import { runSyncCycle } from "@/lib/sync-runner";

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
    path.join(os.tmpdir(), "solostack-sync-conflicts-test-"),
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

function createIncomingTaskChange(
  overrides: Partial<SyncPushChange> = {},
): SyncPushChange {
  const entityId = overrides.entity_id ?? `task-${randomUUID()}`;
  const idempotencyKey =
    overrides.idempotency_key ?? `incoming-${randomUUID()}`;

  return {
    entity_type: "TASK",
    entity_id: entityId,
    operation: "UPSERT",
    updated_at: "2026-02-17T12:00:00.000Z",
    updated_by_device: "device-remote",
    sync_version: 1,
    payload: {},
    idempotency_key: idempotencyKey,
    ...overrides,
  };
}

describe("database sync conflict persistence", () => {
  it("returns built-in conflict strategy defaults when not configured yet", async () => {
    const defaults = await database.getSyncConflictStrategyDefaults();

    expect(defaults).toEqual({
      field_conflict: "keep_local",
      delete_vs_update: "keep_local",
      notes_collision: "manual_merge",
      validation_error: "keep_local",
    });
  });

  it("updates conflict strategy defaults and keeps unspecified values", async () => {
    const first = await database.updateSyncConflictStrategyDefaults({
      notes_collision: "keep_remote",
    });
    expect(first).toEqual({
      field_conflict: "keep_local",
      delete_vs_update: "keep_local",
      notes_collision: "keep_remote",
      validation_error: "keep_local",
    });

    const second = await database.updateSyncConflictStrategyDefaults({
      field_conflict: "manual_merge",
    });
    expect(second).toEqual({
      field_conflict: "manual_merge",
      delete_vs_update: "keep_local",
      notes_collision: "keep_remote",
      validation_error: "keep_local",
    });

    const reloaded = await database.getSyncConflictStrategyDefaults();
    expect(reloaded).toEqual(second);
  });

  it("persists field_conflict when incoming task title is missing", async () => {
    const change = createIncomingTaskChange({
      payload: {
        description: "remote payload without title",
      },
    });

    const result = await database.applyIncomingSyncChange(change);
    expect(result).toBe("conflict");

    const openConflicts = await database.listSyncConflicts({
      status: "open",
      limit: 500,
    });
    const conflict = openConflicts.find(
      (item) =>
        item.entity_id === change.entity_id &&
        item.incoming_idempotency_key === change.idempotency_key,
    );

    expect(conflict).toBeTruthy();
    expect(conflict?.conflict_type).toBe("field_conflict");
    expect(conflict?.reason_code).toBe("MISSING_TASK_TITLE");

    const events = await database.listSyncConflictEvents(conflict!.id, 50);
    expect(events.some((item) => item.event_type === "detected")).toBe(true);
  });

  it("persists delete_vs_update when incoming task references missing project", async () => {
    const change = createIncomingTaskChange({
      payload: {
        title: "Incoming remote task",
        project_id: `project-missing-${randomUUID()}`,
      },
    });

    const result = await database.applyIncomingSyncChange(change);
    expect(result).toBe("conflict");

    const openConflicts = await database.listSyncConflicts({
      status: "open",
      limit: 500,
    });
    const conflict = openConflicts.find(
      (item) =>
        item.entity_id === change.entity_id &&
        item.incoming_idempotency_key === change.idempotency_key,
    );

    expect(conflict).toBeTruthy();
    expect(conflict?.conflict_type).toBe("delete_vs_update");
    expect(conflict?.reason_code).toBe("TASK_PROJECT_NOT_FOUND");
  });

  it("persists notes_collision when task notes diverge at the same version timestamp", async () => {
    const sharedEntityId = `task-notes-${randomUUID()}`;
    const sharedUpdatedAt = "2026-02-17T14:00:00.000Z";

    const seedChange = createIncomingTaskChange({
      entity_id: sharedEntityId,
      idempotency_key: `seed-${randomUUID()}`,
      updated_at: sharedUpdatedAt,
      updated_by_device: "device-alpha",
      payload: {
        title: "Task with local notes",
        notes_markdown: "Local notes body",
      },
    });
    expect(await database.applyIncomingSyncChange(seedChange)).toBe("applied");

    const collisionChange = createIncomingTaskChange({
      entity_id: sharedEntityId,
      idempotency_key: `collision-${randomUUID()}`,
      updated_at: sharedUpdatedAt,
      updated_by_device: "device-bravo",
      payload: {
        title: "Task with local notes",
        notes_markdown: "Remote notes body",
      },
    });
    expect(await database.applyIncomingSyncChange(collisionChange)).toBe(
      "conflict",
    );

    const openConflicts = await database.listSyncConflicts({
      status: "open",
      limit: 500,
    });
    const conflict = openConflicts.find(
      (item) =>
        item.entity_id === sharedEntityId &&
        item.incoming_idempotency_key === collisionChange.idempotency_key,
    );

    expect(conflict).toBeTruthy();
    expect(conflict?.conflict_type).toBe("notes_collision");
    expect(conflict?.reason_code).toBe("TASK_NOTES_COLLISION");
  });

  it("skips replay when the same incoming idempotency key is already resolved", async () => {
    const change = createIncomingTaskChange({
      payload: {
        description: "still missing title",
      },
    });

    const firstResult = await database.applyIncomingSyncChange(change);
    expect(firstResult).toBe("conflict");

    const createdConflict = (
      await database.listSyncConflicts({
        status: "open",
        limit: 500,
      })
    ).find(
      (item) =>
        item.entity_id === change.entity_id &&
        item.incoming_idempotency_key === change.idempotency_key,
    );
    expect(createdConflict).toBeTruthy();

    await database.resolveSyncConflict({
      conflict_id: createdConflict!.id,
      strategy: "keep_local",
    });

    const replayResult = await database.applyIncomingSyncChange(change);
    expect(replayResult).toBe("skipped");

    const replayEvents = await database.listSyncConflictEvents(
      createdConflict!.id,
      100,
    );
    const retriedEvent = replayEvents.find(
      (item) => item.event_type === "retried",
    );
    expect(retriedEvent).toBeTruthy();
    expect(retriedEvent?.event_payload_json).toContain(
      "incoming_change_repeated",
    );
  });

  it("marks open conflict resolved with retry strategy after incoming replay applies", async () => {
    const idempotencyKey = `incoming-retry-${randomUUID()}`;
    const entityId = `task-replay-${randomUUID()}`;

    const conflictChange = createIncomingTaskChange({
      entity_id: entityId,
      idempotency_key: idempotencyKey,
      payload: {
        description: "missing title to force conflict",
      },
    });
    expect(await database.applyIncomingSyncChange(conflictChange)).toBe(
      "conflict",
    );

    const existingConflict = (
      await database.listSyncConflicts({
        status: "open",
        limit: 500,
      })
    ).find(
      (item) =>
        item.entity_id === entityId &&
        item.incoming_idempotency_key === idempotencyKey,
    );
    expect(existingConflict).toBeTruthy();

    const replayChange = createIncomingTaskChange({
      entity_id: entityId,
      idempotency_key: idempotencyKey,
      payload: {
        title: "Recovered remote title",
      },
    });
    expect(await database.applyIncomingSyncChange(replayChange)).toBe(
      "applied",
    );

    const resolvedConflict = await database.getSyncConflict(
      existingConflict!.id,
    );
    expect(resolvedConflict?.status).toBe("resolved");
    expect(resolvedConflict?.resolution_strategy).toBe("retry");
    expect(resolvedConflict?.resolved_by_device).toBe("device-remote");
  });

  it("reaches conflict-free sync after manual resolve when transport replays the same incoming change", async () => {
    const entityId = `task-transport-${randomUUID()}`;
    const incomingIdempotencyKey = `incoming-transport-${randomUUID()}`;
    const recordedPushChanges: Array<
      Array<{ entity_id: string; idempotency_key: string }>
    > = [];
    let pushCallCount = 0;
    let pullCallCount = 0;

    const storage = {
      getDeviceId: database.getOrCreateDeviceId,
      getCheckpoint: database.getSyncCheckpoint,
      setCheckpoint: database.setSyncCheckpoint,
      listOutboxChanges: database.listSyncOutboxChanges,
      removeOutboxChanges: database.removeSyncOutboxChanges,
      markOutboxChangeFailed: database.markSyncOutboxChangeFailed,
      applyIncomingChange: database.applyIncomingSyncChange,
    };

    const transport = {
      push: async (payload: unknown) => {
        pushCallCount += 1;
        const rawChanges = Array.isArray(
          (payload as { changes?: unknown })?.changes,
        )
          ? ((payload as { changes: unknown[] }).changes ?? [])
          : [];
        const changes = rawChanges
          .map((change) => {
            if (typeof change !== "object" || change === null) return null;
            const entityIdValue = (change as { entity_id?: unknown }).entity_id;
            const idempotencyKeyValue = (
              change as { idempotency_key?: unknown }
            ).idempotency_key;
            if (
              typeof entityIdValue !== "string" ||
              typeof idempotencyKeyValue !== "string"
            ) {
              return null;
            }
            return {
              entity_id: entityIdValue,
              idempotency_key: idempotencyKeyValue,
            };
          })
          .filter(
            (
              change,
            ): change is { entity_id: string; idempotency_key: string } =>
              change !== null,
          );
        recordedPushChanges.push(changes);

        return {
          accepted: changes.map((change) => change.idempotency_key),
          rejected: [],
          server_cursor: `cursor-push-${pushCallCount}`,
          server_time: `2026-02-17T02:0${Math.min(pushCallCount, 9)}:00.000Z`,
        };
      },
      pull: async () => {
        pullCallCount += 1;
        const replayChange = createIncomingTaskChange({
          entity_id: entityId,
          idempotency_key: incomingIdempotencyKey,
          payload: {
            description: "missing title to trigger conflict during pull",
          },
        });

        return {
          server_cursor: `cursor-pull-${pullCallCount}`,
          server_time: `2026-02-17T03:0${Math.min(pullCallCount, 9)}:00.000Z`,
          has_more: false,
          changes: pullCallCount <= 2 ? [replayChange] : [],
        };
      },
    };

    const firstSummary = await runSyncCycle({
      transport,
      storage,
    });
    expect(firstSummary.pull?.conflicts).toBe(1);

    const createdConflict = (
      await database.listSyncConflicts({
        status: "open",
        limit: 500,
      })
    ).find(
      (item) =>
        item.entity_id === entityId &&
        item.incoming_idempotency_key === incomingIdempotencyKey,
    );
    expect(createdConflict).toBeTruthy();

    await database.resolveSyncConflict({
      conflict_id: createdConflict!.id,
      strategy: "keep_local",
      resolved_by_device: "device-resolver",
    });

    const secondSummary = await runSyncCycle({
      transport,
      storage,
    });

    expect(secondSummary.failed_outbox_changes).toBe(0);
    expect(secondSummary.pull?.conflicts).toBe(0);
    expect(secondSummary.pull?.skipped).toBeGreaterThanOrEqual(1);

    const resolvedConflict = await database.getSyncConflict(
      createdConflict!.id,
    );
    expect(resolvedConflict?.status).toBe("resolved");
    expect(resolvedConflict?.resolution_strategy).toBe("keep_local");

    const hasResolutionOutboxPush = recordedPushChanges.some((changes) =>
      changes.some(
        (change) =>
          change.entity_id ===
          `local.sync.conflict_resolution.${createdConflict!.id}`,
      ),
    );
    expect(hasResolutionOutboxPush).toBe(true);
  });

  it("enqueues idempotent outbox record when resolving conflict", async () => {
    const conflictChange = createIncomingTaskChange({
      payload: {
        description: "missing title to trigger conflict",
      },
    });
    expect(await database.applyIncomingSyncChange(conflictChange)).toBe(
      "conflict",
    );

    const conflict = (
      await database.listSyncConflicts({
        status: "open",
        limit: 500,
      })
    ).find(
      (item) =>
        item.entity_id === conflictChange.entity_id &&
        item.incoming_idempotency_key === conflictChange.idempotency_key,
    );
    expect(conflict).toBeTruthy();

    const resolvedByDevice = "device-resolver";
    await database.resolveSyncConflict({
      conflict_id: conflict!.id,
      strategy: "keep_local",
      resolved_by_device: resolvedByDevice,
    });
    await database.resolveSyncConflict({
      conflict_id: conflict!.id,
      strategy: "keep_local",
      resolved_by_device: resolvedByDevice,
    });

    const outboxRows = await database.listSyncOutboxChanges(1000);
    const expectedEntityId = `local.sync.conflict_resolution.${conflict!.id}`;
    const matchingRows = outboxRows.filter(
      (row) =>
        row.entity_type === "SETTING" && row.entity_id === expectedEntityId,
    );
    expect(matchingRows).toHaveLength(1);

    const expectedIdempotencyKey = createSyncIdempotencyKey(
      resolvedByDevice,
      `conflict-resolution:${conflict!.id}:keep_local`,
    );
    expect(matchingRows[0]?.idempotency_key).toBe(expectedIdempotencyKey);
  });

  it("retains only latest conflict events within policy window", async () => {
    const change = createIncomingTaskChange({
      payload: {
        description: "missing title for retention test",
      },
    });
    expect(await database.applyIncomingSyncChange(change)).toBe("conflict");

    const conflict = (
      await database.listSyncConflicts({
        status: "open",
        limit: 500,
      })
    ).find(
      (item) =>
        item.entity_id === change.entity_id &&
        item.incoming_idempotency_key === change.idempotency_key,
    );
    expect(conflict).toBeTruthy();

    for (let index = 0; index < 220; index += 1) {
      const strategy = index % 2 === 0 ? "retry" : "keep_local";
      await database.resolveSyncConflict({
        conflict_id: conflict!.id,
        strategy,
        resolved_by_device: "device-retention",
      });
    }

    const events = await database.listSyncConflictEvents(conflict!.id, 1000);
    expect(events.length).toBeLessThanOrEqual(200);
    expect(events[0]).toBeTruthy();
  });
});
