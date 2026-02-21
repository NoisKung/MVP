import { describe, expect, it } from "vitest";
import {
  buildBulkUpdateConfirmationMessage,
  buildBulkUpdateTaskInputs,
  hasBulkTaskPatch,
  normalizeSelectedTaskIdsToVisible,
  toggleSelectAllVisibleTasks,
  toggleTaskSelection,
} from "@/lib/task-bulk";

describe("task bulk helpers", () => {
  it("normalizes selection to currently visible task ids", () => {
    expect(
      normalizeSelectedTaskIdsToVisible(
        [" task-1 ", "task-2", "task-2", "task-hidden"],
        ["task-2", "task-1"],
      ),
    ).toEqual(["task-1", "task-2"]);
  });

  it("toggles one task selection deterministically", () => {
    expect(toggleTaskSelection(["task-1"], "task-2", true)).toEqual([
      "task-1",
      "task-2",
    ]);
    expect(toggleTaskSelection(["task-1", "task-2"], "task-1", false)).toEqual([
      "task-2",
    ]);
  });

  it("toggles select-all against visible task set", () => {
    expect(toggleSelectAllVisibleTasks([], ["task-1", "task-2"])).toEqual([
      "task-1",
      "task-2",
    ]);
    expect(
      toggleSelectAllVisibleTasks(
        ["task-1", "task-2", "task-3"],
        ["task-1", "task-2"],
      ),
    ).toEqual(["task-3"]);
  });

  it("builds bulk update payload for each selected task", () => {
    expect(
      buildBulkUpdateTaskInputs(["task-1", "task-2"], {
        status: "DOING",
        priority: "URGENT",
        is_important: true,
        project_id: null,
      }),
    ).toEqual([
      {
        id: "task-1",
        status: "DOING",
        priority: "URGENT",
        is_important: true,
        project_id: null,
      },
      {
        id: "task-2",
        status: "DOING",
        priority: "URGENT",
        is_important: true,
        project_id: null,
      },
    ]);
  });

  it("detects if a bulk patch has at least one field", () => {
    expect(hasBulkTaskPatch({})).toBe(false);
    expect(hasBulkTaskPatch({ due_at: null })).toBe(true);
  });

  it("builds confirmation message with changed fields", () => {
    const message = buildBulkUpdateConfirmationMessage({
      locale: "en",
      selectedCount: 3,
      projectNameById: {
        "project-1": "Core",
      },
      patch: {
        project_id: "project-1",
        recurrence: "WEEKLY",
        is_important: false,
      },
    });

    expect(message).toContain("Apply changes to 3 selected task(s)?");
    expect(message).toContain("- Project: Core");
    expect(message).toContain("- Repeat: Weekly");
    expect(message).toContain("- Importance: Not important");
  });
});
