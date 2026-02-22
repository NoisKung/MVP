import { translate, type TranslationKey } from "@/lib/i18n";
import type { AppLocale, SyncConflictRecord } from "@/lib/types";

const CONFLICT_REASON_CODE_TRANSLATION_KEY: Record<string, TranslationKey> = {
  MISSING_PROJECT_NAME: "conflictCenter.reason.missingProjectName",
  MISSING_TASK_TITLE: "conflictCenter.reason.missingTaskTitle",
  TASK_NOTES_COLLISION: "conflictCenter.reason.taskNotesCollision",
  TASK_PROJECT_NOT_FOUND: "conflictCenter.reason.taskProjectNotFound",
  INVALID_SUBTASK_PAYLOAD: "conflictCenter.reason.invalidSubtaskPayload",
  SUBTASK_TASK_NOT_FOUND: "conflictCenter.reason.subtaskTaskNotFound",
  MISSING_TEMPLATE_NAME: "conflictCenter.reason.missingTemplateName",
};

const CONFLICT_ENTITY_TYPE_TRANSLATION_KEY: Record<string, TranslationKey> = {
  PROJECT: "conflictCenter.entity.project",
  TASK: "conflictCenter.entity.task",
  TASK_SUBTASK: "conflictCenter.entity.taskSubtask",
  TASK_TEMPLATE: "conflictCenter.entity.taskTemplate",
  SETTING: "conflictCenter.entity.setting",
};

export function localizeSyncConflictMessage(
  conflict: Pick<SyncConflictRecord, "reason_code" | "message">,
  locale: AppLocale,
): string {
  const normalizedReasonCode = conflict.reason_code.trim().toUpperCase();
  const translationKey =
    CONFLICT_REASON_CODE_TRANSLATION_KEY[normalizedReasonCode];
  if (translationKey) {
    return translate(locale, translationKey);
  }

  const rawMessage = conflict.message.trim();
  if (rawMessage) return rawMessage;
  return translate(locale, "common.unknown");
}

export function localizeSyncConflictEntityLabel(
  conflict: Pick<SyncConflictRecord, "entity_type" | "entity_id">,
  locale: AppLocale,
): string {
  const normalizedEntityType = conflict.entity_type.trim().toUpperCase();
  const translationKey =
    CONFLICT_ENTITY_TYPE_TRANSLATION_KEY[normalizedEntityType];
  const localizedEntityType = translationKey
    ? translate(locale, translationKey)
    : normalizedEntityType;
  return `${localizedEntityType}:${conflict.entity_id}`;
}
