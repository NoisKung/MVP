import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
  type Options as NotificationOptions,
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

export type NotificationPermissionState = "unknown" | "granted" | "denied";

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

function getTaskIdFromNotification(
  notification: NotificationOptions,
): string | null {
  const maybeTaskId = notification.extra?.taskId;
  if (typeof maybeTaskId === "string" && maybeTaskId.trim().length > 0) {
    return maybeTaskId;
  }
  return null;
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
  tasksRef.current = tasks;
  onTaskNotificationClickRef.current = onTaskNotificationClickResolved;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let actionListener: PluginListener | null = null;
    let disposed = false;

    const registerActionListener = async () => {
      try {
        const listener = await onAction((notification) => {
          const taskId = getTaskIdFromNotification(notification);
          if (!taskId) return;
          onTaskNotificationClickRef.current?.(taskId);
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
  }, []);

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
