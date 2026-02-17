import {
  buildManualMergeDiffRows,
  buildManualMergeDiffRowsFromConflict,
  buildManualMergeInitialText,
  buildManualMergeResolutionPayload,
  getManualMergeTextSources,
  normalizeManualMergeText,
} from "@/lib/manual-merge";
import type { SyncConflictRecord } from "@/lib/types";

function createConflictFixture(
  overrides?: Partial<SyncConflictRecord>,
): SyncConflictRecord {
  return {
    id: "conflict-1",
    incoming_idempotency_key: "incoming-1",
    entity_type: "TASK",
    entity_id: "task-1",
    operation: "UPSERT",
    conflict_type: "notes_collision",
    reason_code: "FIELD_CONFLICT",
    message: "Task notes collided.",
    local_payload_json: JSON.stringify({
      title: "Local task",
      notes_markdown: "Local notes",
    }),
    remote_payload_json: JSON.stringify({
      title: "Remote task",
      notes_markdown: "Remote notes",
    }),
    base_payload_json: null,
    status: "open",
    resolution_strategy: null,
    resolution_payload_json: null,
    resolved_by_device: null,
    detected_at: "2026-02-17T00:00:00.000Z",
    resolved_at: null,
    created_at: "2026-02-17T00:00:00.000Z",
    updated_at: "2026-02-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("manual-merge helpers", () => {
  it("builds initial text with local/remote sections when both differ", () => {
    const text = buildManualMergeInitialText(createConflictFixture());

    expect(text).toContain("LOCAL");
    expect(text).toContain("Local notes");
    expect(text).toContain("REMOTE");
    expect(text).toContain("Remote notes");
  });

  it("extracts local/remote text sources using preferred merge keys", () => {
    const conflict = createConflictFixture({
      local_payload_json: JSON.stringify({
        title: "Task title local",
        notes_markdown: "Alpha\nBravo",
      }),
      remote_payload_json: JSON.stringify({
        title: "Task title remote",
        notes_markdown: "Alpha\nCharlie",
      }),
    });

    const sources = getManualMergeTextSources(conflict);
    expect(sources).toEqual({
      localText: "Alpha\nBravo",
      remoteText: "Alpha\nCharlie",
    });
  });

  it("falls back to payload JSON when no merge text field is present", () => {
    const text = buildManualMergeInitialText(
      createConflictFixture({
        local_payload_json: JSON.stringify({ priority: "URGENT", score: 7 }),
        remote_payload_json: JSON.stringify({ priority: "LOW", score: 5 }),
      }),
    );

    expect(text).toContain('"priority": "URGENT"');
    expect(text).toContain('"score": 7');
  });

  it("builds side-by-side diff rows with changed and side-only entries", () => {
    const rows = buildManualMergeDiffRows({
      localText: [
        "line-1",
        "line-local",
        "line-3",
        "line-local-only-a",
        "line-local-only-b",
      ].join("\n"),
      remoteText: [
        "line-1",
        "line-remote",
        "line-3",
        "line-remote-only-a",
      ].join("\n"),
    });

    expect(rows.some((row) => row.kind === "changed")).toBe(true);
    expect(
      rows.some(
        (row) => row.kind === "local_only" || row.kind === "remote_only",
      ),
    ).toBe(true);
    expect(rows.some((row) => row.kind === "unchanged")).toBe(true);
  });

  it("builds diff rows directly from conflict payloads", () => {
    const conflict = createConflictFixture();
    const rows = buildManualMergeDiffRowsFromConflict(conflict);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.local_line_number).not.toBeNull();
    expect(rows[0]?.remote_line_number).not.toBeNull();
  });

  it("normalizes manual merge text before building resolution payload", () => {
    const conflict = createConflictFixture();
    const payload = buildManualMergeResolutionPayload({
      conflict,
      mergedText: "  final merged note  ",
      source: "test-suite",
    });

    expect(payload).toEqual({
      merged_text: "final merged note",
      conflict_type: "notes_collision",
      source: "test-suite",
    });
  });

  it("normalizes blank merge text to empty string", () => {
    expect(normalizeManualMergeText("   ")).toBe("");
  });
});
