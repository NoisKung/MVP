export interface TaskNotesCollisionInput {
  existing_updated_at: string | null;
  existing_updated_by_device: string | null;
  existing_notes_markdown: string | null;
  incoming_updated_at: string;
  incoming_updated_by_device: string;
  incoming_notes_markdown: string | null;
  incoming_touches_notes_markdown: boolean;
}

function normalizeDeviceId(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function toComparableTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate.getTime();
}

export function isMissingTaskTitleConflict(title: string): boolean {
  return !title.trim();
}

export function isTaskProjectNotFoundConflict(input: {
  incoming_project_id: string | null;
  project_exists: boolean;
}): boolean {
  return Boolean(input.incoming_project_id) && !input.project_exists;
}

export function isTaskNotesCollision(input: TaskNotesCollisionInput): boolean {
  if (!input.incoming_touches_notes_markdown) return false;

  const localNotes = input.existing_notes_markdown?.trim() ?? "";
  const incomingNotes = input.incoming_notes_markdown?.trim() ?? "";
  if (!localNotes || !incomingNotes) return false;
  if (localNotes === incomingNotes) return false;

  const existingTime = toComparableTimestamp(input.existing_updated_at);
  const incomingTime = toComparableTimestamp(input.incoming_updated_at);
  if (existingTime === null || incomingTime === null) return false;
  if (existingTime !== incomingTime) return false;

  const existingDevice = normalizeDeviceId(input.existing_updated_by_device);
  const incomingDevice = normalizeDeviceId(input.incoming_updated_by_device);
  if (!existingDevice || !incomingDevice) return false;
  if (existingDevice === incomingDevice) return false;

  return true;
}
