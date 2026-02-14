/** Valid task statuses matching the SQLite CHECK constraint */
export type TaskStatus = "TODO" | "DOING" | "DONE" | "ARCHIVED";

/** Valid task priorities matching the SQLite CHECK constraint */
export type TaskPriority = "URGENT" | "NORMAL" | "LOW";

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
  created_at: string;
  updated_at: string;
}

/** Input for creating a new task */
export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  is_important: boolean;
}

/** Input for updating an existing task */
export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  is_important?: boolean;
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
export type ViewMode = "board" | "dashboard";
