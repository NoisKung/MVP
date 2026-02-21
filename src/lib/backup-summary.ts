import type { BackupImportResult, BackupPayload } from "./types";

const EMPTY_BACKUP_IMPORT_SUMMARY: BackupImportResult = {
  settings: 0,
  projects: 0,
  tasks: 0,
  sessions: 0,
  task_subtasks: 0,
  task_changelogs: 0,
  task_templates: 0,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function countItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/** Build row-count summary from a normalized backup payload */
export function summarizeBackupPayload(
  payload: Pick<BackupPayload, "data">,
): BackupImportResult {
  return {
    settings: payload.data.settings.length,
    projects: payload.data.projects.length,
    tasks: payload.data.tasks.length,
    sessions: payload.data.sessions.length,
    task_subtasks: payload.data.task_subtasks.length,
    task_changelogs: payload.data.task_changelogs.length,
    task_templates: payload.data.task_templates.length,
  };
}

/**
 * Best-effort summary for arbitrary payload input.
 * Returns null when payload does not include a data object.
 */
export function summarizeUnknownBackupPayload(
  payload: unknown,
): BackupImportResult | null {
  const payloadObject = asRecord(payload);
  const data = asRecord(payloadObject?.data);
  if (!data) return null;

  return {
    ...EMPTY_BACKUP_IMPORT_SUMMARY,
    settings: countItems(data.settings),
    projects: countItems(data.projects),
    tasks: countItems(data.tasks),
    sessions: countItems(data.sessions),
    task_subtasks: countItems(data.task_subtasks),
    task_changelogs: countItems(data.task_changelogs),
    task_templates: countItems(data.task_templates),
  };
}
