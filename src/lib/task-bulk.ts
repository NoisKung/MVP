import { translate } from "@/lib/i18n";
import type {
  AppLocale,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
  UpdateTaskInput,
} from "@/lib/types";

export type BulkTaskPatch = Pick<
  UpdateTaskInput,
  | "status"
  | "priority"
  | "is_important"
  | "project_id"
  | "due_at"
  | "remind_at"
  | "recurrence"
>;

interface BuildBulkUpdateConfirmationMessageInput {
  locale: AppLocale;
  selectedCount: number;
  patch: BulkTaskPatch;
  projectNameById?: Record<string, string>;
}

function normalizeTaskId(taskId: string): string {
  return taskId.trim();
}

function uniqueTaskIds(taskIds: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const taskId of taskIds) {
    const normalized = normalizeTaskId(taskId);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function normalizeSelectedTaskIdsToVisible(
  selectedTaskIds: string[],
  visibleTaskIds: string[],
): string[] {
  const visibleSet = new Set(uniqueTaskIds(visibleTaskIds));
  return uniqueTaskIds(selectedTaskIds).filter((taskId) =>
    visibleSet.has(taskId),
  );
}

export function toggleTaskSelection(
  selectedTaskIds: string[],
  taskId: string,
  nextSelected: boolean,
): string[] {
  const normalizedTaskId = normalizeTaskId(taskId);
  if (!normalizedTaskId) return uniqueTaskIds(selectedTaskIds);

  const normalizedSelected = uniqueTaskIds(selectedTaskIds);
  const hasTask = normalizedSelected.includes(normalizedTaskId);

  if (nextSelected && !hasTask) {
    return [...normalizedSelected, normalizedTaskId];
  }
  if (!nextSelected && hasTask) {
    return normalizedSelected.filter((id) => id !== normalizedTaskId);
  }
  return normalizedSelected;
}

export function toggleSelectAllVisibleTasks(
  selectedTaskIds: string[],
  visibleTaskIds: string[],
): string[] {
  const normalizedSelected = uniqueTaskIds(selectedTaskIds);
  const normalizedVisible = uniqueTaskIds(visibleTaskIds);
  if (normalizedVisible.length === 0) return normalizedSelected;

  const selectedSet = new Set(normalizedSelected);
  const areAllVisibleSelected = normalizedVisible.every((taskId) =>
    selectedSet.has(taskId),
  );
  if (areAllVisibleSelected) {
    const visibleSet = new Set(normalizedVisible);
    return normalizedSelected.filter((taskId) => !visibleSet.has(taskId));
  }

  for (const taskId of normalizedVisible) {
    selectedSet.add(taskId);
  }
  return Array.from(selectedSet);
}

export function buildBulkUpdateTaskInputs(
  selectedTaskIds: string[],
  patch: BulkTaskPatch,
): UpdateTaskInput[] {
  const normalizedPatch: BulkTaskPatch = {};
  if (patch.status !== undefined) normalizedPatch.status = patch.status;
  if (patch.priority !== undefined) normalizedPatch.priority = patch.priority;
  if (patch.is_important !== undefined) {
    normalizedPatch.is_important = patch.is_important;
  }
  if (patch.project_id !== undefined) {
    normalizedPatch.project_id = patch.project_id;
  }
  if (patch.due_at !== undefined) {
    normalizedPatch.due_at = patch.due_at;
  }
  if (patch.remind_at !== undefined) {
    normalizedPatch.remind_at = patch.remind_at;
  }
  if (patch.recurrence !== undefined) {
    normalizedPatch.recurrence = patch.recurrence;
  }

  return uniqueTaskIds(selectedTaskIds).map((taskId) => ({
    id: taskId,
    ...normalizedPatch,
  }));
}

export function hasBulkTaskPatch(patch: BulkTaskPatch): boolean {
  return (
    patch.status !== undefined ||
    patch.priority !== undefined ||
    patch.is_important !== undefined ||
    patch.project_id !== undefined ||
    patch.due_at !== undefined ||
    patch.remind_at !== undefined ||
    patch.recurrence !== undefined
  );
}

function getStatusLabel(locale: AppLocale, status: TaskStatus): string {
  if (status === "TODO") return translate(locale, "taskForm.status.todo");
  if (status === "DOING") return translate(locale, "taskForm.status.doing");
  if (status === "DONE") return translate(locale, "taskForm.status.done");
  return translate(locale, "taskForm.status.archived");
}

function getPriorityLabel(locale: AppLocale, priority: TaskPriority): string {
  if (priority === "URGENT")
    return translate(locale, "taskForm.priority.urgent");
  if (priority === "LOW") return translate(locale, "taskForm.priority.low");
  return translate(locale, "taskForm.priority.normal");
}

function getRecurrenceLabel(
  locale: AppLocale,
  recurrence: TaskRecurrence,
): string {
  if (recurrence === "DAILY")
    return translate(locale, "taskForm.recurrence.daily");
  if (recurrence === "WEEKLY")
    return translate(locale, "taskForm.recurrence.weekly");
  if (recurrence === "MONTHLY")
    return translate(locale, "taskForm.recurrence.monthly");
  return translate(locale, "taskForm.recurrence.none");
}

function formatBulkDateTime(value: string | null, locale: AppLocale): string {
  if (value === null) return translate(locale, "taskForm.changelog.emptyValue");
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return parsedDate.toLocaleString(locale === "th" ? "th-TH" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildBulkUpdateConfirmationMessage(
  input: BuildBulkUpdateConfirmationMessageInput,
): string {
  const { locale, patch, selectedCount, projectNameById } = input;
  const lines: string[] = [];

  if (patch.status !== undefined) {
    lines.push(
      `${translate(locale, "taskForm.changelog.field.status")}: ${getStatusLabel(locale, patch.status)}`,
    );
  }
  if (patch.priority !== undefined) {
    lines.push(
      `${translate(locale, "taskForm.changelog.field.priority")}: ${getPriorityLabel(locale, patch.priority)}`,
    );
  }
  if (patch.project_id !== undefined) {
    const projectLabel =
      patch.project_id === null
        ? translate(locale, "taskForm.changelog.noProject")
        : (projectNameById?.[patch.project_id] ?? patch.project_id);
    lines.push(
      `${translate(locale, "taskForm.changelog.field.project")}: ${projectLabel}`,
    );
  }
  if (patch.is_important !== undefined) {
    lines.push(
      `${translate(locale, "taskForm.field.importance")}: ${
        patch.is_important
          ? translate(locale, "taskForm.changelog.important")
          : translate(locale, "taskForm.changelog.notImportant")
      }`,
    );
  }
  if (patch.due_at !== undefined) {
    lines.push(
      `${translate(locale, "taskForm.changelog.field.dueAt")}: ${formatBulkDateTime(patch.due_at ?? null, locale)}`,
    );
  }
  if (patch.remind_at !== undefined) {
    lines.push(
      `${translate(locale, "taskForm.changelog.field.reminder")}: ${formatBulkDateTime(patch.remind_at ?? null, locale)}`,
    );
  }
  if (patch.recurrence !== undefined) {
    lines.push(
      `${translate(locale, "taskForm.changelog.field.recurrence")}: ${getRecurrenceLabel(locale, patch.recurrence)}`,
    );
  }

  return [
    translate(locale, "taskFilters.bulk.confirm.title", {
      count: selectedCount,
    }),
    ...lines.map((line) => `- ${line}`),
    "",
    translate(locale, "taskFilters.bulk.confirm.question"),
  ].join("\n");
}
