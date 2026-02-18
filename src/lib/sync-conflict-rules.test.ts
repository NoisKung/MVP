import {
  isMissingTaskTitleConflict,
  isTaskNotesCollision,
  isTaskProjectNotFoundConflict,
} from "@/lib/sync-conflict-rules";

describe("sync conflict rules", () => {
  it("detects missing task title conflict", () => {
    expect(isMissingTaskTitleConflict("")).toBe(true);
    expect(isMissingTaskTitleConflict("   ")).toBe(true);
    expect(isMissingTaskTitleConflict("Write release notes")).toBe(false);
  });

  it("detects task project not found conflict", () => {
    expect(
      isTaskProjectNotFoundConflict({
        incoming_project_id: "project-missing",
        project_exists: false,
      }),
    ).toBe(true);
    expect(
      isTaskProjectNotFoundConflict({
        incoming_project_id: "project-ok",
        project_exists: true,
      }),
    ).toBe(false);
    expect(
      isTaskProjectNotFoundConflict({
        incoming_project_id: null,
        project_exists: false,
      }),
    ).toBe(false);
  });

  it("detects notes collision when local and incoming notes diverge at same timestamp", () => {
    expect(
      isTaskNotesCollision({
        existing_updated_at: "2026-02-17T10:00:00.000Z",
        existing_updated_by_device: "device-a",
        existing_notes_markdown: "Local draft",
        incoming_updated_at: "2026-02-17T10:00:00.000Z",
        incoming_updated_by_device: "device-b",
        incoming_notes_markdown: "Remote draft",
        incoming_touches_notes_markdown: true,
      }),
    ).toBe(true);
  });

  it("does not detect notes collision for non-collision conditions", () => {
    expect(
      isTaskNotesCollision({
        existing_updated_at: "2026-02-17T10:00:00.000Z",
        existing_updated_by_device: "device-a",
        existing_notes_markdown: "Shared note",
        incoming_updated_at: "2026-02-17T10:00:00.000Z",
        incoming_updated_by_device: "device-b",
        incoming_notes_markdown: "Shared note",
        incoming_touches_notes_markdown: true,
      }),
    ).toBe(false);

    expect(
      isTaskNotesCollision({
        existing_updated_at: "2026-02-17T10:00:00.000Z",
        existing_updated_by_device: "device-a",
        existing_notes_markdown: "Local draft",
        incoming_updated_at: "2026-02-17T10:00:01.000Z",
        incoming_updated_by_device: "device-b",
        incoming_notes_markdown: "Remote draft",
        incoming_touches_notes_markdown: true,
      }),
    ).toBe(false);

    expect(
      isTaskNotesCollision({
        existing_updated_at: "2026-02-17T10:00:00.000Z",
        existing_updated_by_device: "device-a",
        existing_notes_markdown: "Local draft",
        incoming_updated_at: "2026-02-17T10:00:00.000Z",
        incoming_updated_by_device: "device-a",
        incoming_notes_markdown: "Remote draft",
        incoming_touches_notes_markdown: true,
      }),
    ).toBe(false);

    expect(
      isTaskNotesCollision({
        existing_updated_at: "2026-02-17T10:00:00.000Z",
        existing_updated_by_device: "device-a",
        existing_notes_markdown: "Local draft",
        incoming_updated_at: "2026-02-17T10:00:00.000Z",
        incoming_updated_by_device: "device-b",
        incoming_notes_markdown: "Remote draft",
        incoming_touches_notes_markdown: false,
      }),
    ).toBe(false);
  });
});
