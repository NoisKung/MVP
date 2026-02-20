import { translate, type TranslationKey } from "@/lib/i18n";
import type { AppLocale } from "@/lib/types";

const ERROR_CODE_TO_TRANSLATION_KEY: Record<string, TranslationKey> = {
  APP_UNDO_BACKUP_RESTORE_PENDING: "app.undo.error.backupRestorePending",
  APP_UNDO_BACKUP_IMPORT_PENDING: "app.undo.error.backupImportPending",
  APP_UNDO_CONFLICT_PENDING: "app.undo.error.conflictPending",
  APP_UNDO_TASK_PENDING: "app.undo.error.taskPending",
  APP_UNDO_PROJECT_PENDING: "app.undo.error.projectPending",
  DB_UNSUPPORTED_SYNC_ENTITY_TYPE: "app.error.unsupportedSyncEntityType",
  DB_UNSUPPORTED_SYNC_OPERATION: "app.error.unsupportedSyncOperation",
  DB_UNSUPPORTED_SYNC_CONFLICT_EVENT_TYPE:
    "app.error.unsupportedSyncConflictEventType",
  DB_SELECTED_PROJECT_MISSING: "app.error.selectedProjectMissing",
  DB_UNSUPPORTED_APP_LOCALE: "app.error.unsupportedLocale",
  DB_SYNC_ENDPOINTS_REQUIRE_BOTH: "settings.sync.config.error.requireBoth",
  DB_SYNC_ENDPOINTS_INVALID_URLS: "sync.transport.error.invalidUrls",
  DB_CONFLICT_ID_REQUIRED: "app.error.conflictIdRequired",
  DB_CONFLICT_NOT_FOUND: "app.error.conflictNotFound",
  DB_CONFLICT_STRATEGY_INVALID: "app.error.invalidConflictResolutionStrategy",
  DB_MANUAL_MERGE_PAYLOAD_REQUIRED: "app.error.manualMergePayloadRequired",
  DB_PROJECT_NAME_REQUIRED: "projectView.error.projectNameRequired",
  DB_PROJECT_NAME_EXISTS: "app.error.projectNameExists",
  DB_PROJECT_NOT_FOUND: "app.error.projectNotFound",
  DB_TASK_NOT_FOUND: "app.error.taskNotFound",
  DB_SUBTASK_TITLE_REQUIRED: "app.error.subtaskTitleRequired",
  DB_SUBTASK_NOT_FOUND: "app.error.subtaskNotFound",
  DB_TEMPLATE_NAME_REQUIRED: "app.error.templateNameRequired",
  DB_RECURRING_TEMPLATE_DUE_OFFSET_REQUIRED:
    "app.error.recurringTemplateDueOffsetRequired",
  DB_REMINDER_OFFSET_MUST_BE_EARLIER: "app.error.reminderOffsetMustBeEarlier",
  DB_TEMPLATE_NAME_EXISTS: "app.error.templateNameExists",
  DB_BACKUP_PAYLOAD_INVALID: "app.error.invalidBackupPayload",
  DB_BACKUP_VERSION_UNSUPPORTED: "app.error.unsupportedBackupVersion",
  DB_BACKUP_PAYLOAD_MISSING_DATA: "app.error.invalidBackupPayloadMissingData",
  DB_LATEST_BACKUP_NOT_FOUND: "app.error.noLatestBackupSnapshot",
  DB_LATEST_BACKUP_CORRUPTED: "app.error.latestBackupSnapshotCorrupted",
  SYNC_IDEMPOTENCY_KEY_REQUIRES_IDS:
    "sync.contract.error.idempotencyKeyRequiresIds",
  SYNC_DEVICE_ID_REQUIRED: "sync.contract.error.deviceIdRequired",
  SYNC_PULL_RESPONSE_INVALID: "sync.contract.error.invalidPullResponse",
  SYNC_PULL_RESPONSE_METADATA_INVALID:
    "sync.contract.error.invalidPullMetadata",
  SYNC_PUSH_RESPONSE_INVALID: "sync.contract.error.invalidPushResponse",
  SYNC_PUSH_RESPONSE_METADATA_INVALID:
    "sync.contract.error.invalidPushMetadata",
  SYNC_ENGINE_SERVER_CURSOR_REQUIRED: "sync.engine.error.serverCursorRequired",
  SYNC_TRANSPORT_INVALID_JSON: "sync.transport.error.invalidJson",
  SYNC_TRANSPORT_TIMEOUT: "sync.transport.error.timeout",
  SYNC_TRANSPORT_REQUIRE_BOTH_URLS: "sync.transport.error.requireBothUrls",
  SYNC_TRANSPORT_UNEXPECTED: "sync.transport.error.unexpected",
} as const;

const SYNC_API_ERROR_CODE_TO_TRANSLATION_KEY: Record<string, TranslationKey> = {
  SCHEMA_MISMATCH: "sync.api.error.schemaMismatch",
  UNAUTHORIZED: "sync.api.error.unauthorized",
  FORBIDDEN: "sync.api.error.forbidden",
  RATE_LIMITED: "sync.api.error.rateLimited",
  INVALID_CURSOR: "sync.api.error.invalidCursor",
  VALIDATION_ERROR: "sync.api.error.validation",
  INTERNAL_ERROR: "sync.api.error.internal",
  UNAVAILABLE: "sync.api.error.unavailable",
} as const;

function extractErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage.trim();
    }
  }
  return null;
}

function localizeRestoreBlockedReason(
  reasonRaw: string,
  locale: AppLocale,
): string {
  const reasonParts = reasonRaw
    .split(/\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const pendingOutboxMatch = part.match(
        /^(\d+)\s+pending outbox change\(s\)$/i,
      );
      if (pendingOutboxMatch) {
        return `${pendingOutboxMatch[1]} ${translate(locale, "settings.backup.reason.pendingOutbox")}`;
      }

      const openConflictsMatch = part.match(/^(\d+)\s+open conflict\(s\)$/i);
      if (openConflictsMatch) {
        return `${openConflictsMatch[1]} ${translate(locale, "settings.backup.reason.openConflicts")}`;
      }

      if (/^active restore guardrails$/i.test(part)) {
        return translate(locale, "settings.backup.reason.activeGuardrails");
      }

      return part;
    });

  return reasonParts.length > 1
    ? reasonParts.join(` ${translate(locale, "settings.backup.reason.and")} `)
    : (reasonParts[0] ?? reasonRaw);
}

function resolveLocalizedErrorMessage(
  message: string,
  locale: AppLocale,
): string | null {
  const normalized = message.trim();
  if (!normalized) return null;

  const restoreBlockedCodeMatch = normalized.match(/^DB_RESTORE_BLOCKED:(.+)$/);
  if (restoreBlockedCodeMatch) {
    const reasonRaw = restoreBlockedCodeMatch[1].trim();
    return translate(locale, "app.error.restoreBlocked", {
      reason: localizeRestoreBlockedReason(reasonRaw, locale),
    });
  }

  const translationKey = ERROR_CODE_TO_TRANSLATION_KEY[normalized];
  if (translationKey) {
    return translate(locale, translationKey);
  }

  const syncApiCodeMatch = normalized.match(/^\[([A-Z_]+)\]\s+(.+)$/);
  if (syncApiCodeMatch) {
    const code = syncApiCodeMatch[1];
    const messagePart = syncApiCodeMatch[2]?.trim() ?? "";
    const syncApiTranslationKey = SYNC_API_ERROR_CODE_TO_TRANSLATION_KEY[code];
    if (syncApiTranslationKey) {
      return translate(locale, syncApiTranslationKey);
    }
    return messagePart || normalized;
  }

  if (normalized === "E2E_TRANSPORT_INVALID_JSON") {
    return translate(locale, "app.e2e.transport.invalidJson");
  }
  const e2eStatusCodeMatch = normalized.match(
    /^E2E_TRANSPORT_REQUEST_FAILED:(\d+)$/,
  );
  if (e2eStatusCodeMatch) {
    return translate(locale, "app.e2e.transport.requestFailed", {
      status: e2eStatusCodeMatch[1],
    });
  }

  if (
    normalized === "Unknown sync error." ||
    /^\[[A-Z_]+\]\s+Unknown sync error\.$/.test(normalized)
  ) {
    return translate(locale, "sync.contract.error.unknown");
  }

  return null;
}

export function localizeErrorMessage(
  error: unknown,
  locale: AppLocale,
  fallbackKey: TranslationKey = "common.error.unableRequest",
): string {
  const resolvedMessage = extractErrorMessage(error);
  if (!resolvedMessage) {
    return translate(locale, fallbackKey);
  }
  return (
    resolveLocalizedErrorMessage(resolvedMessage, locale) ?? resolvedMessage
  );
}
