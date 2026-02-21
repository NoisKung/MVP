import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  onAction,
  registerActionTypes,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { PluginListener } from "@tauri-apps/api/core";
import { translate } from "@/lib/i18n";
import type { AppLocale, Task } from "@/lib/types";
import {
  clearReminderHistoryStorage,
  REMINDER_HISTORY_STORAGE_KEY,
} from "@/lib/reminder-settings";

export const REMINDER_CHECK_INTERVAL_MS = 30 * 1000;
const REMINDER_HISTORY_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const REMINDER_HISTORY_MAX_SIZE = 500;
const REMINDER_ACTION_TYPE_ID = "solostack.task-reminder";
const REMINDER_SNOOZE_ACTION_IDS = {
  MINUTES_15: "snooze_15m",
  HOUR_1: "snooze_1h",
  TOMORROW: "snooze_tomorrow",
} as const;

export type NotificationPermissionState = "unknown" | "granted" | "denied";
export type ReminderSnoozePreset =
  | "SNOOZE_15_MINUTES"
  | "SNOOZE_1_HOUR"
  | "SNOOZE_TOMORROW";

interface ReminderActionPayload {
  taskId: string;
  actionId: string;
}

interface ReminderHistoryEntry {
  notifiedAt: string;
}

type ReminderHistory = Record<string, ReminderHistoryEntry>;

let notificationPermissionState: NotificationPermissionState = "unknown";
let pendingPermissionCheck: Promise<NotificationPermissionState> | null = null;

function parseDateTime(value: string | null): Date | null {
  if (!value) return null;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getReminderSignature(task: Task): string | null {
  if (!task.remind_at) return null;
  return `${task.id}:${task.remind_at}`;
}

function isReminderEligible(task: Task): boolean {
  return (
    task.status !== "DONE" &&
    task.status !== "ARCHIVED" &&
    typeof task.remind_at === "string" &&
    task.remind_at.length > 0
  );
}

function loadReminderHistory(): ReminderHistory {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REMINDER_HISTORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ReminderHistory;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Ignore malformed localStorage payloads and reset history.
  }
  return {};
}

function saveReminderHistory(history: ReminderHistory): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      REMINDER_HISTORY_STORAGE_KEY,
      JSON.stringify(history),
    );
  } catch {
    // Ignore storage quota and serialization errors.
  }
}

function trimReminderHistory(
  history: ReminderHistory,
  activeReminderSignatures: Set<string>,
): ReminderHistory {
  const now = Date.now();
  const keptEntries: Array<[string, ReminderHistoryEntry]> = [];

  for (const [signature, entry] of Object.entries(history)) {
    const notifiedAt = parseDateTime(entry.notifiedAt);
    const isRecent =
      notifiedAt !== null &&
      now - notifiedAt.getTime() <= REMINDER_HISTORY_RETENTION_MS;
    if (activeReminderSignatures.has(signature) || isRecent) {
      keptEntries.push([signature, entry]);
    }
  }

  keptEntries.sort((leftEntry, rightEntry) => {
    const leftDate = parseDateTime(leftEntry[1].notifiedAt);
    const rightDate = parseDateTime(rightEntry[1].notifiedAt);
    return (rightDate?.getTime() ?? 0) - (leftDate?.getTime() ?? 0);
  });

  const limitedEntries = keptEntries.slice(0, REMINDER_HISTORY_MAX_SIZE);
  return Object.fromEntries(limitedEntries);
}

function parsePermissionState(permission: string): NotificationPermissionState {
  if (permission === "granted") return "granted";
  if (permission === "denied") return "denied";
  return "unknown";
}

function getWebNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unknown";
  }
  return parsePermissionState(window.Notification.permission);
}

async function ensureWebNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (window.Notification.permission === "granted") return "granted";
  if (window.Notification.permission === "denied") return "denied";
  const permission = await window.Notification.requestPermission();
  return parsePermissionState(permission);
}

export function resetReminderPermissionCache(): void {
  notificationPermissionState = "unknown";
  pendingPermissionCheck = null;
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionState> {
  try {
    const granted = await isPermissionGranted();
    if (granted) {
      notificationPermissionState = "granted";
      return "granted";
    }

    if (notificationPermissionState === "denied") {
      return "denied";
    }

    const webState = getWebNotificationPermissionState();
    if (webState === "denied") {
      notificationPermissionState = "denied";
      return "denied";
    }

    notificationPermissionState = "unknown";
    return "unknown";
  } catch {
    const webState = getWebNotificationPermissionState();
    notificationPermissionState = webState;
    return webState;
  }
}

export async function requestNotificationPermissionAccess(): Promise<NotificationPermissionState> {
  try {
    if (await isPermissionGranted()) {
      notificationPermissionState = "granted";
      return "granted";
    }

    const permission = await requestPermission();
    const permissionState = parsePermissionState(permission);
    notificationPermissionState = permissionState;
    return permissionState;
  } catch {
    const webPermissionState = await ensureWebNotificationPermission();
    notificationPermissionState = webPermissionState;
    return webPermissionState;
  }
}

export async function resetReminderPermissionAndHistory(): Promise<NotificationPermissionState> {
  clearReminderHistoryStorage();
  resetReminderPermissionCache();
  return getNotificationPermissionStatus();
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (notificationPermissionState === "granted") return true;
  if (notificationPermissionState === "denied") return false;

  if (!pendingPermissionCheck) {
    pendingPermissionCheck = (async () => {
      try {
        const existingPermission = await getNotificationPermissionStatus();
        if (
          existingPermission === "granted" ||
          existingPermission === "denied"
        ) {
          return existingPermission;
        }
        return requestNotificationPermissionAccess();
      } finally {
        pendingPermissionCheck = null;
      }
    })();
  }

  const permissionState = await pendingPermissionCheck;
  return permissionState === "granted";
}

function buildReminderBody(task: Task, locale: AppLocale): string {
  const dueDate = parseDateTime(task.due_at);
  if (!dueDate) return task.title;

  const dueLabel = dueDate.toLocaleString(locale === "th" ? "th-TH" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${task.title}\n${translate(locale, "reminder.dueAt", { dueAt: dueLabel })}`;
}

function parseReminderActionPayload(
  input: unknown,
): ReminderActionPayload | null {
  const payload = asRecord(input);
  if (!payload) return null;

  const topLevelTaskId = asNonEmptyString(
    asRecord(payload.extra)?.taskId ?? payload.taskId,
  );
  const notificationPayload = asRecord(payload.notification);
  const nestedTaskId = asNonEmptyString(
    asRecord(notificationPayload?.extra)?.taskId ??
      asRecord(notificationPayload?.data)?.taskId,
  );
  const taskId = topLevelTaskId ?? nestedTaskId;
  if (!taskId) return null;

  const actionId = asNonEmptyString(payload.actionId) ?? "tap";
  return { taskId, actionId };
}

function toSnoozePreset(actionId: string): ReminderSnoozePreset | null {
  if (actionId === REMINDER_SNOOZE_ACTION_IDS.MINUTES_15) {
    return "SNOOZE_15_MINUTES";
  }
  if (actionId === REMINDER_SNOOZE_ACTION_IDS.HOUR_1) {
    return "SNOOZE_1_HOUR";
  }
  if (actionId === REMINDER_SNOOZE_ACTION_IDS.TOMORROW) {
    return "SNOOZE_TOMORROW";
  }
  return null;
}

async function registerReminderActionTypes(locale: AppLocale): Promise<void> {
  try {
    await registerActionTypes([
      {
        id: REMINDER_ACTION_TYPE_ID,
        actions: [
          {
            id: REMINDER_SNOOZE_ACTION_IDS.MINUTES_15,
            title: translate(locale, "reminder.action.snooze15m"),
          },
          {
            id: REMINDER_SNOOZE_ACTION_IDS.HOUR_1,
            title: translate(locale, "reminder.action.snooze1h"),
          },
          {
            id: REMINDER_SNOOZE_ACTION_IDS.TOMORROW,
            title: translate(locale, "reminder.action.snoozeTomorrow"),
          },
        ],
      },
    ]);
  } catch {
    // Ignore if notification action registration is unavailable in this runtime.
  }
}

function sendWebNotification(
  title: string,
  body: string,
  taskId: string,
  onTaskNotificationClick?: (taskId: string) => void,
): void {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }
  if (window.Notification.permission !== "granted") {
    return;
  }
  const webNotification = new window.Notification(title, { body });
  webNotification.onclick = () => {
    window.focus();
    onTaskNotificationClick?.(taskId);
    webNotification.close();
  };
}

function sendTaskReminderNotification(
  task: Task,
  locale: AppLocale,
  onTaskNotificationClick?: (taskId: string) => void,
): void {
  const title = translate(locale, "reminder.title");
  const body = buildReminderBody(task, locale);
  try {
    sendNotification({
      title,
      body,
      autoCancel: true,
      actionTypeId: REMINDER_ACTION_TYPE_ID,
      extra: {
        source: "task-reminder",
        taskId: task.id,
      },
    });
  } catch {
    sendWebNotification(title, body, task.id, onTaskNotificationClick);
  }
}

async function processReminderNotifications(
  tasks: Task[],
  locale: AppLocale,
  onTaskNotificationClick?: (taskId: string) => void,
): Promise<void> {
  if (!(await ensureNotificationPermission())) return;

  const reminderHistory = loadReminderHistory();
  const activeReminderSignatures = new Set<string>();
  const now = new Date();

  for (const task of tasks) {
    if (!isReminderEligible(task)) continue;

    const signature = getReminderSignature(task);
    const reminderAt = parseDateTime(task.remind_at);
    if (!signature || !reminderAt) continue;

    activeReminderSignatures.add(signature);

    if (reminderHistory[signature]) continue;
    if (reminderAt > now) continue;

    sendTaskReminderNotification(task, locale, onTaskNotificationClick);
    reminderHistory[signature] = { notifiedAt: now.toISOString() };
  }

  const trimmedHistory = trimReminderHistory(
    reminderHistory,
    activeReminderSignatures,
  );
  saveReminderHistory(trimmedHistory);
}

export function useReminderNotifications(
  tasks: Task[],
  enabled: boolean,
  localeOrOnTaskNotificationClick:
    | AppLocale
    | ((taskId: string) => void) = "en",
  onTaskNotificationClick?: (taskId: string) => void,
  onTaskReminderSnooze?: (input: {
    taskId: string;
    preset: ReminderSnoozePreset;
  }) => void,
): void {
  const locale: AppLocale =
    typeof localeOrOnTaskNotificationClick === "function"
      ? "en"
      : localeOrOnTaskNotificationClick;
  const onTaskNotificationClickResolved =
    typeof localeOrOnTaskNotificationClick === "function"
      ? localeOrOnTaskNotificationClick
      : onTaskNotificationClick;

  const tasksRef = useRef(tasks);
  const onTaskNotificationClickRef = useRef(onTaskNotificationClickResolved);
  const onTaskReminderSnoozeRef = useRef(onTaskReminderSnooze);
  tasksRef.current = tasks;
  onTaskNotificationClickRef.current = onTaskNotificationClickResolved;
  onTaskReminderSnoozeRef.current = onTaskReminderSnooze;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let actionListener: PluginListener | null = null;
    let disposed = false;

    const registerActionListener = async () => {
      try {
        await registerReminderActionTypes(locale);
        const listener = await onAction((notification) => {
          const actionPayload = parseReminderActionPayload(notification);
          if (!actionPayload) return;

          const snoozePreset = toSnoozePreset(actionPayload.actionId);
          if (snoozePreset) {
            onTaskReminderSnoozeRef.current?.({
              taskId: actionPayload.taskId,
              preset: snoozePreset,
            });
            return;
          }

          if (actionPayload.actionId === "dismiss") return;
          onTaskNotificationClickRef.current?.(actionPayload.taskId);
        });

        if (disposed) {
          void listener.unregister();
          return;
        }

        actionListener = listener;
      } catch {
        // Ignore if the plugin event is not available in this runtime.
      }
    };

    void registerActionListener();

    return () => {
      disposed = true;
      if (actionListener) {
        void actionListener.unregister();
        actionListener = null;
      }
    };
  }, [locale]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let isCancelled = false;
    let isChecking = false;

    const checkReminders = async () => {
      if (isCancelled || isChecking) return;
      isChecking = true;
      try {
        await processReminderNotifications(
          tasksRef.current,
          locale,
          onTaskNotificationClickRef.current,
        );
      } finally {
        isChecking = false;
      }
    };

    void checkReminders();
    const intervalId = window.setInterval(() => {
      void checkReminders();
    }, REMINDER_CHECK_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, locale]);
}
