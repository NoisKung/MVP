import type { Task } from "@/lib/types";

const DEFAULT_CREATED_AT = "2026-02-15T10:00:00.000Z";
const DEFAULT_UPDATED_AT = "2026-02-15T10:00:00.000Z";

export function createTaskFixture(
  overrides: Partial<Task> & Pick<Task, "id" | "title">,
): Task {
  return {
    id: overrides.id,
    title: overrides.title,
    description: null,
    notes_markdown: null,
    project_id: null,
    status: "TODO",
    priority: "NORMAL",
    is_important: 0,
    due_at: null,
    remind_at: null,
    recurrence: "NONE",
    created_at: DEFAULT_CREATED_AT,
    updated_at: DEFAULT_UPDATED_AT,
    ...overrides,
  };
}
