// @vitest-environment node

import {
  DEFAULT_TASK_VIEW_FILTERS,
  loadSavedTaskViewsFromStorage,
  loadTaskViewFiltersFromStorage,
  saveSavedTaskViewsToStorage,
  saveTaskViewFiltersToStorage,
} from "@/lib/task-filters";

describe("task-filters (node runtime)", () => {
  it("returns safe defaults when window is unavailable", () => {
    expect(loadTaskViewFiltersFromStorage()).toEqual(DEFAULT_TASK_VIEW_FILTERS);
    expect(loadSavedTaskViewsFromStorage()).toEqual([]);
    expect(() => saveTaskViewFiltersToStorage(DEFAULT_TASK_VIEW_FILTERS)).not.toThrow();
    expect(() => saveSavedTaskViewsToStorage([])).not.toThrow();
  });
});
