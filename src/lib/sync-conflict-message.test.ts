import { describe, expect, it } from "vitest";
import type { SyncConflictRecord } from "@/lib/types";
import {
  localizeSyncConflictEntityLabel,
  localizeSyncConflictMessage,
} from "@/lib/sync-conflict-message";

function createConflict(
  overrides: Partial<Pick<SyncConflictRecord, "reason_code" | "message">> = {},
): Pick<SyncConflictRecord, "reason_code" | "message"> {
  return {
    reason_code: "MISSING_TASK_TITLE",
    message: "Task title is required in incoming payload.",
    ...overrides,
  };
}

describe("localizeSyncConflictMessage", () => {
  it("maps known reason codes to localized messages", () => {
    expect(localizeSyncConflictMessage(createConflict(), "en")).toBe(
      "Task title is missing in incoming payload.",
    );
    expect(localizeSyncConflictMessage(createConflict(), "th")).toBe(
      "ข้อมูลขาเข้าไม่มีชื่องาน",
    );
  });

  it("falls back to raw message for unknown reason codes", () => {
    expect(
      localizeSyncConflictMessage(
        createConflict({
          reason_code: "UNKNOWN_REASON_CODE",
          message: "Server provided custom conflict message.",
        }),
        "en",
      ),
    ).toBe("Server provided custom conflict message.");
  });

  it("falls back to localized unknown when reason/message are empty", () => {
    expect(
      localizeSyncConflictMessage(
        createConflict({
          reason_code: "  ",
          message: "  ",
        }),
        "th",
      ),
    ).toBe("ไม่ทราบ");
  });
});

describe("localizeSyncConflictEntityLabel", () => {
  it("maps known entity types to localized labels", () => {
    const conflict = {
      entity_type: "TASK",
      entity_id: "task-123",
    } satisfies Pick<SyncConflictRecord, "entity_type" | "entity_id">;

    expect(localizeSyncConflictEntityLabel(conflict, "en")).toBe(
      "Task:task-123",
    );
    expect(localizeSyncConflictEntityLabel(conflict, "th")).toBe(
      "งาน:task-123",
    );
  });

  it("falls back to raw entity type when not mapped", () => {
    const conflict = {
      entity_type: "CUSTOM_ENTITY",
      entity_id: "entity-1",
    } as Pick<SyncConflictRecord, "entity_type" | "entity_id">;

    expect(localizeSyncConflictEntityLabel(conflict, "en")).toBe(
      "CUSTOM_ENTITY:entity-1",
    );
  });
});
