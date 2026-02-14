import type {
  SavedTaskView,
  Task,
  TaskDueFilter,
  TaskFilterState,
  TaskPriority,
  TaskSortBy,
  TaskStatus,
} from "./types";

export const TASK_FILTERS_STORAGE_KEY = "solostack.task-filters";
export const SAVED_TASK_VIEWS_STORAGE_KEY = "solostack.saved-task-views";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const ALLOWED_STATUSES: TaskStatus[] = ["TODO", "DOING", "DONE", "ARCHIVED"];
const ALLOWED_PRIORITIES: TaskPriority[] = ["URGENT", "NORMAL", "LOW"];
const ALLOWED_DUE_FILTERS: TaskDueFilter[] = [
  "ALL",
  "OVERDUE",
  "TODAY",
  "NEXT_7_DAYS",
  "NO_DUE",
];
const ALLOWED_SORT_OPTIONS: TaskSortBy[] = [
  "CREATED_DESC",
  "UPDATED_DESC",
  "DUE_ASC",
  "PRIORITY_DESC",
  "TITLE_ASC",
];

export const DEFAULT_TASK_FILTERS: TaskFilterState = {
  search: "",
  statuses: [],
  priorities: [],
  importantOnly: false,
  dueFilter: "ALL",
  sortBy: "CREATED_DESC",
};

const PRIORITY_RANKING: Record<TaskPriority, number> = {
  URGENT: 3,
  NORMAL: 2,
  LOW: 1,
};

function parseDateTime(value: string | null): Date | null {
  if (!value) return null;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

function getStartOfDay(referenceDate: Date): Date {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0,
  );
}

function getEndOfDay(referenceDate: Date): Date {
  return new Date(getStartOfDay(referenceDate).getTime() + DAY_IN_MILLISECONDS);
}

function normalizeStatuses(statuses: unknown): TaskStatus[] {
  if (!Array.isArray(statuses)) return [];
  return statuses.filter((status): status is TaskStatus =>
    ALLOWED_STATUSES.includes(status as TaskStatus),
  );
}

function normalizePriorities(priorities: unknown): TaskPriority[] {
  if (!Array.isArray(priorities)) return [];
  return priorities.filter((priority): priority is TaskPriority =>
    ALLOWED_PRIORITIES.includes(priority as TaskPriority),
  );
}

export function normalizeTaskFilters(input: unknown): TaskFilterState {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_TASK_FILTERS };
  }

  const maybeFilters = input as Partial<TaskFilterState>;
  const normalizedDueFilter = ALLOWED_DUE_FILTERS.includes(
    maybeFilters.dueFilter as TaskDueFilter,
  )
    ? (maybeFilters.dueFilter as TaskDueFilter)
    : DEFAULT_TASK_FILTERS.dueFilter;
  const normalizedSortBy = ALLOWED_SORT_OPTIONS.includes(
    maybeFilters.sortBy as TaskSortBy,
  )
    ? (maybeFilters.sortBy as TaskSortBy)
    : DEFAULT_TASK_FILTERS.sortBy;

  return {
    search:
      typeof maybeFilters.search === "string"
        ? maybeFilters.search.trimStart()
        : DEFAULT_TASK_FILTERS.search,
    statuses: normalizeStatuses(maybeFilters.statuses),
    priorities: normalizePriorities(maybeFilters.priorities),
    importantOnly: Boolean(maybeFilters.importantOnly),
    dueFilter: normalizedDueFilter,
    sortBy: normalizedSortBy,
  };
}

function matchesDueFilter(
  task: Task,
  dueFilter: TaskDueFilter,
  referenceDate: Date,
): boolean {
  if (dueFilter === "ALL") return true;

  const dueDate = parseDateTime(task.due_at);
  if (dueFilter === "NO_DUE") return dueDate === null;
  if (!dueDate) return false;

  const startOfToday = getStartOfDay(referenceDate);
  const endOfToday = getEndOfDay(referenceDate);
  const endOfNext7Days = new Date(
    endOfToday.getTime() + 7 * DAY_IN_MILLISECONDS,
  );

  if (dueFilter === "OVERDUE") {
    return (
      task.status !== "DONE" &&
      task.status !== "ARCHIVED" &&
      dueDate.getTime() < referenceDate.getTime()
    );
  }
  if (dueFilter === "TODAY") {
    return dueDate >= startOfToday && dueDate < endOfToday;
  }
  if (dueFilter === "NEXT_7_DAYS") {
    return dueDate >= endOfToday && dueDate < endOfNext7Days;
  }
  return true;
}

export function applyTaskFilters(
  tasks: Task[],
  filters: TaskFilterState,
  referenceDate = new Date(),
): Task[] {
  const normalizedFilters = normalizeTaskFilters(filters);
  const normalizedQuery = normalizedFilters.search.trim().toLowerCase();

  const filteredTasks = tasks.filter((task) => {
    if (
      normalizedFilters.statuses.length > 0 &&
      !normalizedFilters.statuses.includes(task.status)
    ) {
      return false;
    }

    if (
      normalizedFilters.priorities.length > 0 &&
      !normalizedFilters.priorities.includes(task.priority)
    ) {
      return false;
    }

    if (normalizedFilters.importantOnly && !Boolean(task.is_important)) {
      return false;
    }

    if (!matchesDueFilter(task, normalizedFilters.dueFilter, referenceDate)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return filteredTasks.sort((leftTask, rightTask) =>
    compareTasksBySort(leftTask, rightTask, normalizedFilters.sortBy),
  );
}

function compareTasksBySort(
  leftTask: Task,
  rightTask: Task,
  sortBy: TaskSortBy,
): number {
  if (sortBy === "TITLE_ASC") {
    const byTitle = leftTask.title.localeCompare(rightTask.title, undefined, {
      sensitivity: "base",
    });
    if (byTitle !== 0) return byTitle;
    return compareByCreatedDesc(leftTask, rightTask);
  }

  if (sortBy === "PRIORITY_DESC") {
    const byPriority =
      PRIORITY_RANKING[rightTask.priority] -
      PRIORITY_RANKING[leftTask.priority];
    if (byPriority !== 0) return byPriority;
    return compareByCreatedDesc(leftTask, rightTask);
  }

  if (sortBy === "UPDATED_DESC") {
    const byUpdated = compareDateDesc(
      leftTask.updated_at,
      rightTask.updated_at,
    );
    if (byUpdated !== 0) return byUpdated;
    return compareByCreatedDesc(leftTask, rightTask);
  }

  if (sortBy === "DUE_ASC") {
    const leftDueDate = parseDateTime(leftTask.due_at);
    const rightDueDate = parseDateTime(rightTask.due_at);

    if (leftDueDate && rightDueDate) {
      const byDueDate = leftDueDate.getTime() - rightDueDate.getTime();
      if (byDueDate !== 0) return byDueDate;
      return compareByCreatedDesc(leftTask, rightTask);
    }
    if (leftDueDate) return -1;
    if (rightDueDate) return 1;
    return compareByCreatedDesc(leftTask, rightTask);
  }

  return compareByCreatedDesc(leftTask, rightTask);
}

function compareDateDesc(leftDate: string, rightDate: string): number {
  const leftTimestamp = parseDateTime(leftDate)?.getTime() ?? 0;
  const rightTimestamp = parseDateTime(rightDate)?.getTime() ?? 0;
  return rightTimestamp - leftTimestamp;
}

function compareByCreatedDesc(leftTask: Task, rightTask: Task): number {
  return compareDateDesc(leftTask.created_at, rightTask.created_at);
}

export function loadTaskFiltersFromStorage(): TaskFilterState {
  if (typeof window === "undefined") {
    return { ...DEFAULT_TASK_FILTERS };
  }

  try {
    const raw = window.localStorage.getItem(TASK_FILTERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TASK_FILTERS };
    const parsed = JSON.parse(raw);
    return normalizeTaskFilters(parsed);
  } catch {
    return { ...DEFAULT_TASK_FILTERS };
  }
}

export function saveTaskFiltersToStorage(filters: TaskFilterState): void {
  if (typeof window === "undefined") return;
  try {
    const normalizedFilters = normalizeTaskFilters(filters);
    window.localStorage.setItem(
      TASK_FILTERS_STORAGE_KEY,
      JSON.stringify(normalizedFilters),
    );
  } catch {
    // Ignore storage quota and serialization errors.
  }
}

function isSavedTaskView(value: unknown): value is SavedTaskView {
  if (!value || typeof value !== "object") return false;
  const maybeView = value as Partial<SavedTaskView>;
  return (
    typeof maybeView.id === "string" &&
    typeof maybeView.name === "string" &&
    typeof maybeView.created_at === "string" &&
    typeof maybeView.updated_at === "string" &&
    Boolean(maybeView.filters)
  );
}

export function loadSavedTaskViewsFromStorage(): SavedTaskView[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SAVED_TASK_VIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isSavedTaskView).map((savedView) => ({
      ...savedView,
      filters: normalizeTaskFilters(savedView.filters),
    }));
  } catch {
    return [];
  }
}

export function saveSavedTaskViewsToStorage(savedViews: SavedTaskView[]): void {
  if (typeof window === "undefined") return;
  try {
    const normalizedViews = savedViews.map((savedView) => ({
      ...savedView,
      filters: normalizeTaskFilters(savedView.filters),
    }));
    window.localStorage.setItem(
      SAVED_TASK_VIEWS_STORAGE_KEY,
      JSON.stringify(normalizedViews),
    );
  } catch {
    // Ignore storage quota and serialization errors.
  }
}
