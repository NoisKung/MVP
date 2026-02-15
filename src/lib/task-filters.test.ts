import {
  applyTaskFilters,
  DEFAULT_TASK_FILTERS,
  DEFAULT_TASK_VIEW_FILTERS,
  loadSavedTaskViewsFromStorage,
  loadTaskViewFiltersFromStorage,
  normalizeTaskFilters,
  SAVED_TASK_VIEWS_STORAGE_KEY,
  saveSavedTaskViewsToStorage,
  saveTaskViewFiltersToStorage,
  TASK_FILTERS_STORAGE_KEY,
  TASK_VIEW_FILTERS_STORAGE_KEY,
  TASK_VIEW_SORTS_STORAGE_KEY,
} from "@/lib/task-filters";
import type { TaskFilterState } from "@/lib/types";
import { createTaskFixture } from "@/test/fixtures";

function clearFilterStorage(): void {
  window.localStorage.removeItem(TASK_FILTERS_STORAGE_KEY);
  window.localStorage.removeItem(TASK_VIEW_SORTS_STORAGE_KEY);
  window.localStorage.removeItem(TASK_VIEW_FILTERS_STORAGE_KEY);
  window.localStorage.removeItem(SAVED_TASK_VIEWS_STORAGE_KEY);
}

describe("task-filters", () => {
  beforeEach(() => {
    clearFilterStorage();
  });

  it("normalizes malformed filter input", () => {
    expect(normalizeTaskFilters(null)).toEqual(DEFAULT_TASK_FILTERS);
    expect(
      normalizeTaskFilters({
        search: "   hello",
        projectIds: ["p1", " ", "p1", 123],
        statuses: ["TODO", "BAD"],
        priorities: ["URGENT", "NONE"],
        importantOnly: 1,
        dueFilter: "TODAY",
        sortBy: "DUE_ASC",
      }),
    ).toEqual({
      search: "hello",
      projectIds: ["p1"],
      statuses: ["TODO"],
      priorities: ["URGENT"],
      importantOnly: true,
      dueFilter: "TODAY",
      sortBy: "DUE_ASC",
    });
    expect(
      normalizeTaskFilters({
        search: 123,
        sortBy: "INVALID",
      }),
    ).toEqual({
      ...DEFAULT_TASK_FILTERS,
      search: "",
      sortBy: "CREATED_DESC",
    });
  });

  it("applies project/status/priority/search/important filters", () => {
    const tasks = [
      createTaskFixture({
        id: "t1",
        title: "Write API docs",
        project_id: "p1",
        status: "TODO",
        priority: "URGENT",
        is_important: 1,
      }),
      createTaskFixture({
        id: "t2",
        title: "Fix mobile layout",
        project_id: "p2",
        status: "DOING",
        priority: "NORMAL",
        is_important: 0,
      }),
      createTaskFixture({
        id: "t3",
        title: "Refactor filters",
        project_id: "p1",
        status: "DONE",
        priority: "LOW",
        is_important: 0,
      }),
    ];

    const filters: TaskFilterState = {
      search: "api",
      projectIds: ["p1"],
      statuses: ["TODO"],
      priorities: ["URGENT"],
      importantOnly: true,
      dueFilter: "ALL",
      sortBy: "CREATED_DESC",
    };

    const result = applyTaskFilters(tasks, filters);
    expect(result.map((task) => task.id)).toEqual(["t1"]);
  });

  it("filters out tasks with non-matching priority and important flag", () => {
    const tasks = [
      createTaskFixture({
        id: "p1",
        title: "Regular task",
        priority: "NORMAL",
        is_important: 0,
      }),
      createTaskFixture({
        id: "p2",
        title: "Important low task",
        priority: "LOW",
        is_important: 1,
      }),
    ];

    expect(
      applyTaskFilters(tasks, {
        ...DEFAULT_TASK_FILTERS,
        priorities: ["URGENT"],
      }),
    ).toEqual([]);

    expect(
      applyTaskFilters(tasks, {
        ...DEFAULT_TASK_FILTERS,
        importantOnly: true,
        priorities: ["NORMAL"],
      }),
    ).toEqual([]);
  });

  it("applies due date filters correctly", () => {
    const referenceDate = new Date(2026, 1, 15, 10, 0, 0, 0);
    const tasks = [
      createTaskFixture({
        id: "overdue-open",
        title: "Overdue open",
        due_at: new Date(2026, 1, 14, 9, 0, 0, 0).toISOString(),
        status: "TODO",
      }),
      createTaskFixture({
        id: "overdue-done",
        title: "Overdue done",
        due_at: new Date(2026, 1, 14, 9, 0, 0, 0).toISOString(),
        status: "DONE",
      }),
      createTaskFixture({
        id: "today",
        title: "Today task",
        due_at: new Date(2026, 1, 15, 18, 0, 0, 0).toISOString(),
      }),
      createTaskFixture({
        id: "next-7-days",
        title: "Soon task",
        due_at: new Date(2026, 1, 18, 12, 0, 0, 0).toISOString(),
      }),
      createTaskFixture({
        id: "no-due",
        title: "No due",
        due_at: null,
      }),
    ];

    const makeFilter = (
      dueFilter: TaskFilterState["dueFilter"],
    ): TaskFilterState => ({
      ...DEFAULT_TASK_FILTERS,
      dueFilter,
      sortBy: "TITLE_ASC",
    });

    expect(
      applyTaskFilters(tasks, makeFilter("OVERDUE"), referenceDate).map(
        (task) => task.id,
      ),
    ).toEqual(["overdue-open"]);
    expect(
      applyTaskFilters(tasks, makeFilter("TODAY"), referenceDate).map(
        (task) => task.id,
      ),
    ).toEqual(["today"]);
    expect(
      applyTaskFilters(tasks, makeFilter("NEXT_7_DAYS"), referenceDate).map(
        (task) => task.id,
      ),
    ).toEqual(["next-7-days"]);
    expect(
      applyTaskFilters(tasks, makeFilter("NO_DUE"), referenceDate).map(
        (task) => task.id,
      ),
    ).toEqual(["no-due"]);

    const invalidDueTasks = [
      createTaskFixture({
        id: "invalid-due",
        title: "Broken date",
        due_at: "not-a-date",
      }),
    ];
    expect(
      applyTaskFilters(invalidDueTasks, makeFilter("TODAY"), referenceDate),
    ).toEqual([]);

    const unknownDueFilterResult = applyTaskFilters(
      tasks,
      {
        ...DEFAULT_TASK_FILTERS,
        dueFilter: "UNKNOWN" as TaskFilterState["dueFilter"],
      },
      referenceDate,
    );
    expect(unknownDueFilterResult.length).toBe(tasks.length);
  });

  it("supports all sorting strategies", () => {
    const tasks = [
      createTaskFixture({
        id: "a",
        title: "Zeta",
        priority: "LOW",
        due_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-03T00:00:00.000Z",
      }),
      createTaskFixture({
        id: "b",
        title: "Alpha",
        priority: "URGENT",
        due_at: "2026-01-02T00:00:00.000Z",
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      }),
      createTaskFixture({
        id: "c",
        title: "Bravo",
        priority: "NORMAL",
        due_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-03T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      }),
    ];

    const sortedByTitle = applyTaskFilters(tasks, {
      ...DEFAULT_TASK_FILTERS,
      sortBy: "TITLE_ASC",
    });
    expect(sortedByTitle.map((task) => task.id)).toEqual(["b", "c", "a"]);

    const sortedByPriority = applyTaskFilters(tasks, {
      ...DEFAULT_TASK_FILTERS,
      sortBy: "PRIORITY_DESC",
    });
    expect(sortedByPriority.map((task) => task.id)).toEqual(["b", "c", "a"]);

    const sortedByUpdated = applyTaskFilters(tasks, {
      ...DEFAULT_TASK_FILTERS,
      sortBy: "UPDATED_DESC",
    });
    expect(sortedByUpdated.map((task) => task.id)).toEqual(["a", "c", "b"]);

    const sortedByDue = applyTaskFilters(tasks, {
      ...DEFAULT_TASK_FILTERS,
      sortBy: "DUE_ASC",
    });
    expect(sortedByDue.map((task) => task.id)).toEqual(["c", "b", "a"]);

    const sortedByCreatedDefault = applyTaskFilters(tasks, {
      ...DEFAULT_TASK_FILTERS,
      sortBy: "CREATED_DESC",
    });
    expect(sortedByCreatedDefault.map((task) => task.id)).toEqual([
      "c",
      "b",
      "a",
    ]);

    const tieTasks = [
      createTaskFixture({
        id: "tie-1",
        title: "Same",
        priority: "URGENT",
        due_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      }),
      createTaskFixture({
        id: "tie-2",
        title: "Same",
        priority: "URGENT",
        due_at: null,
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      }),
    ];
    expect(
      applyTaskFilters(tieTasks, {
        ...DEFAULT_TASK_FILTERS,
        sortBy: "TITLE_ASC",
      }).map((task) => task.id),
    ).toEqual(["tie-2", "tie-1"]);
    expect(
      applyTaskFilters(tieTasks, {
        ...DEFAULT_TASK_FILTERS,
        sortBy: "PRIORITY_DESC",
      }).map((task) => task.id),
    ).toEqual(["tie-2", "tie-1"]);
    expect(
      applyTaskFilters(tieTasks, {
        ...DEFAULT_TASK_FILTERS,
        sortBy: "UPDATED_DESC",
      }).map((task) => task.id),
    ).toEqual(["tie-2", "tie-1"]);
    expect(
      applyTaskFilters(tieTasks, {
        ...DEFAULT_TASK_FILTERS,
        sortBy: "DUE_ASC",
      }).map((task) => task.id),
    ).toEqual(["tie-2", "tie-1"]);

    const dueTieTasks = [
      createTaskFixture({
        id: "due-1",
        title: "Due tie one",
        due_at: "2026-01-05T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      createTaskFixture({
        id: "due-2",
        title: "Due tie two",
        due_at: "2026-01-05T00:00:00.000Z",
        created_at: "2026-01-02T00:00:00.000Z",
      }),
    ];
    expect(
      applyTaskFilters(dueTieTasks, {
        ...DEFAULT_TASK_FILTERS,
        sortBy: "DUE_ASC",
      }).map((task) => task.id),
    ).toEqual(["due-2", "due-1"]);

    const duePresenceTasks = [
      createTaskFixture({
        id: "with-due",
        due_at: "2026-01-06T00:00:00.000Z",
        created_at: "2026-01-02T00:00:00.000Z",
      }),
      createTaskFixture({
        id: "without-due",
        due_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
      }),
    ];
    expect(
      applyTaskFilters(duePresenceTasks, {
        ...DEFAULT_TASK_FILTERS,
        sortBy: "DUE_ASC",
      }).map((task) => task.id),
    ).toEqual(["with-due", "without-due"]);

    const invalidUpdatedTasks = [
      createTaskFixture({
        id: "invalid-updated-older",
        updated_at: "not-a-date",
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      createTaskFixture({
        id: "invalid-updated-newer",
        updated_at: "still-not-a-date",
        created_at: "2026-01-02T00:00:00.000Z",
      }),
    ];
    expect(
      applyTaskFilters(invalidUpdatedTasks, {
        ...DEFAULT_TASK_FILTERS,
        sortBy: "UPDATED_DESC",
      }).map((task) => task.id),
    ).toEqual(["invalid-updated-newer", "invalid-updated-older"]);
  });

  it("loads task view filters from new storage format", () => {
    const payload = {
      board: { ...DEFAULT_TASK_VIEW_FILTERS.board, sortBy: "UPDATED_DESC" },
      today: { ...DEFAULT_TASK_VIEW_FILTERS.today, sortBy: "TITLE_ASC" },
      upcoming: { ...DEFAULT_TASK_VIEW_FILTERS.upcoming, sortBy: "DUE_ASC" },
    };
    window.localStorage.setItem(
      TASK_VIEW_FILTERS_STORAGE_KEY,
      JSON.stringify(payload),
    );

    expect(loadTaskViewFiltersFromStorage()).toEqual(payload);
  });

  it("migrates from legacy storage keys when new format is missing", () => {
    window.localStorage.setItem(
      TASK_FILTERS_STORAGE_KEY,
      JSON.stringify({
        search: " migrated",
        sortBy: "DUE_ASC",
      }),
    );
    window.localStorage.setItem(
      TASK_VIEW_SORTS_STORAGE_KEY,
      JSON.stringify({
        board: "UPDATED_DESC",
        today: "TITLE_ASC",
        upcoming: "INVALID",
      }),
    );

    const migrated = loadTaskViewFiltersFromStorage();
    expect(migrated.board.search).toBe("migrated");
    expect(migrated.board.sortBy).toBe("UPDATED_DESC");
    expect(migrated.today.sortBy).toBe("TITLE_ASC");
    expect(migrated.upcoming.sortBy).toBe(
      DEFAULT_TASK_VIEW_FILTERS.upcoming.sortBy,
    );
  });

  it("falls back when current storage payload shape is invalid", () => {
    window.localStorage.setItem(
      TASK_VIEW_FILTERS_STORAGE_KEY,
      JSON.stringify({ board: {}, today: {} }),
    );
    const loaded = loadTaskViewFiltersFromStorage();
    expect(loaded).toEqual(DEFAULT_TASK_VIEW_FILTERS);

    window.localStorage.setItem(TASK_VIEW_FILTERS_STORAGE_KEY, "null");
    expect(loadTaskViewFiltersFromStorage()).toEqual(DEFAULT_TASK_VIEW_FILTERS);
  });

  it("falls back gracefully when legacy payload is malformed", () => {
    window.localStorage.setItem(TASK_FILTERS_STORAGE_KEY, "{bad-json");
    window.localStorage.setItem(TASK_VIEW_SORTS_STORAGE_KEY, "{bad-json");
    expect(loadTaskViewFiltersFromStorage()).toEqual(DEFAULT_TASK_VIEW_FILTERS);
  });

  it("saves task view filters and ignores storage failures", () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    saveTaskViewFiltersToStorage(DEFAULT_TASK_VIEW_FILTERS);
    expect(setItemSpy).toHaveBeenCalled();

    setItemSpy.mockImplementationOnce(() => {
      throw new Error("storage full");
    });
    expect(() =>
      saveTaskViewFiltersToStorage(DEFAULT_TASK_VIEW_FILTERS),
    ).not.toThrow();

    setItemSpy.mockRestore();
  });

  it("normalizes non-object scoped filters when saving task view filters", () => {
    saveTaskViewFiltersToStorage({
      board: null,
      today: "bad-input",
      upcoming: undefined,
    } as unknown as typeof DEFAULT_TASK_VIEW_FILTERS);

    const raw = window.localStorage.getItem(TASK_VIEW_FILTERS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);

    expect(parsed.board).toEqual(DEFAULT_TASK_VIEW_FILTERS.board);
    expect(parsed.today).toEqual(DEFAULT_TASK_VIEW_FILTERS.today);
    expect(parsed.upcoming).toEqual(DEFAULT_TASK_VIEW_FILTERS.upcoming);
  });

  it("loads and saves saved task views safely", () => {
    const now = new Date().toISOString();
    window.localStorage.setItem(
      SAVED_TASK_VIEWS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "view-1",
          name: "My View",
          scope: "today",
          filters: { ...DEFAULT_TASK_VIEW_FILTERS.today, sortBy: "DUE_ASC" },
          created_at: now,
          updated_at: now,
        },
        {
          id: "invalid",
          created_at: now,
        },
      ]),
    );

    const loaded = loadSavedTaskViewsFromStorage();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].scope).toBe("today");

    saveSavedTaskViewsToStorage(loaded);
    const raw = window.localStorage.getItem(SAVED_TASK_VIEWS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toHaveLength(1);
  });

  it("handles malformed saved views payload", () => {
    window.localStorage.setItem(SAVED_TASK_VIEWS_STORAGE_KEY, "{bad-json");
    expect(loadSavedTaskViewsFromStorage()).toEqual([]);

    window.localStorage.setItem(
      SAVED_TASK_VIEWS_STORAGE_KEY,
      JSON.stringify({}),
    );
    expect(loadSavedTaskViewsFromStorage()).toEqual([]);

    window.localStorage.setItem(
      SAVED_TASK_VIEWS_STORAGE_KEY,
      JSON.stringify([123, "x", null]),
    );
    expect(loadSavedTaskViewsFromStorage()).toEqual([]);
  });

  it("ignores save errors for saved views", () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    setItemSpy.mockImplementationOnce(() => {
      throw new Error("storage full");
    });
    expect(() => saveSavedTaskViewsToStorage([])).not.toThrow();
    setItemSpy.mockRestore();
  });
});
