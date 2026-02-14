export const REMINDERS_ENABLED_STORAGE_KEY = "solostack.reminders-enabled";
export const REMINDER_HISTORY_STORAGE_KEY = "solostack.reminder-history";

const DEFAULT_REMINDERS_ENABLED = true;

export function getRemindersEnabledPreference(): boolean {
  if (typeof window === "undefined") return DEFAULT_REMINDERS_ENABLED;

  const rawValue = window.localStorage.getItem(REMINDERS_ENABLED_STORAGE_KEY);
  if (rawValue === null) return DEFAULT_REMINDERS_ENABLED;
  return rawValue !== "false";
}

export function setRemindersEnabledPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    REMINDERS_ENABLED_STORAGE_KEY,
    enabled ? "true" : "false",
  );
}

export function clearReminderHistoryStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REMINDER_HISTORY_STORAGE_KEY);
}
