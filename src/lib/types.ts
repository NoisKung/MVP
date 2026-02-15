/** Valid task statuses matching the SQLite CHECK constraint */
export type TaskStatus = "TODO" | "DOING" | "DONE" | "ARCHIVED";

/** Valid task priorities matching the SQLite CHECK constraint */
export type TaskPriority = "URGENT" | "NORMAL" | "LOW";

/** Valid recurrence rules matching the SQLite CHECK constraint */
export type TaskRecurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

/** Dashboard metrics derived from tasks and changelog records */
export interface TaskDashboardStats {
  TODO: number;
  DOING: number;
  DONE: number;
  dueToday: number;
  overdue: number;
  completedThisWeek: number;
}

/** Task change event types */
export type TaskChangelogAction = "CREATED" | "UPDATED" | "STATUS_CHANGED";

/** A task entity from the database */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  is_important: number; // SQLite stores booleans as 0/1
  due_at: string | null;
  remind_at: string | null;
  recurrence: TaskRecurrence;
  created_at: string;
  updated_at: string;
}

/** Input for creating a new task */
export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  is_important: boolean;
  due_at?: string | null;
  remind_at?: string | null;
  recurrence?: TaskRecurrence;
  subtasks?: Array<{
    title: string;
    is_done?: boolean;
  }>;
}

/** Input for updating an existing task */
export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  is_important?: boolean;
  due_at?: string | null;
  remind_at?: string | null;
  recurrence?: TaskRecurrence;
}

/** A reusable preset for creating tasks quickly */
export interface TaskTemplate {
  id: string;
  name: string;
  title_template: string | null;
  description: string | null;
  priority: TaskPriority;
  is_important: number; // SQLite stores booleans as 0/1
  due_offset_minutes: number | null;
  remind_offset_minutes: number | null;
  recurrence: TaskRecurrence;
  created_at: string;
  updated_at: string;
}

/** Input for creating/updating a task template */
export interface UpsertTaskTemplateInput {
  id?: string;
  name: string;
  title_template?: string | null;
  description?: string | null;
  priority: TaskPriority;
  is_important: boolean;
  due_offset_minutes?: number | null;
  remind_offset_minutes?: number | null;
  recurrence?: TaskRecurrence;
}

/** A checklist item under a task */
export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  is_done: number; // SQLite stores booleans as 0/1
  created_at: string;
  updated_at: string;
}

/** Aggregated checklist progress per task */
export interface TaskSubtaskStats {
  task_id: string;
  done_count: number;
  total_count: number;
}

/** Input for creating a task subtask */
export interface CreateTaskSubtaskInput {
  task_id: string;
  title: string;
  is_done?: boolean;
}

/** Input for updating a task subtask */
export interface UpdateTaskSubtaskInput {
  id: string;
  title?: string;
  is_done?: boolean;
}

/** A single changelog record for a task */
export interface TaskChangelog {
  id: string;
  task_id: string;
  action: TaskChangelogAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

/** Kanban column definition */
export interface KanbanColumn {
  status: TaskStatus;
  label: string;
  color: string;
}

/** Due-date filter buckets */
export type TaskDueFilter =
  | "ALL"
  | "OVERDUE"
  | "TODAY"
  | "NEXT_7_DAYS"
  | "NO_DUE";

/** Task sort options for list and board ordering */
export type TaskSortBy =
  | "CREATED_DESC"
  | "UPDATED_DESC"
  | "DUE_ASC"
  | "PRIORITY_DESC"
  | "TITLE_ASC";

/** Views that support independent sort preference */
export type TaskSortableView = "board" | "today" | "upcoming";

/** Per-view sort preference map */
export type TaskViewSortPreferences = Record<TaskSortableView, TaskSortBy>;

/** Per-view filter state map */
export type TaskViewFilterPreferences = Record<
  TaskSortableView,
  TaskFilterState
>;

/** Search/filter state for task lists */
export interface TaskFilterState {
  search: string;
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  importantOnly: boolean;
  dueFilter: TaskDueFilter;
  sortBy: TaskSortBy;
}

/** User-saved filter preset */
export interface SavedTaskView {
  id: string;
  name: string;
  scope: TaskSortableView;
  filters: TaskFilterState;
  created_at: string;
  updated_at: string;
}

/** Application view modes */
export type ViewMode =
  | "board"
  | "today"
  | "upcoming"
  | "dashboard"
  | "settings";
