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

/** Application view modes */
export type ViewMode =
  | "board"
  | "today"
  | "upcoming"
  | "dashboard"
  | "settings";
