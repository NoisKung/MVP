import {
  clearReminderHistoryStorage,
  getRemindersEnabledPreference,
  REMINDER_HISTORY_STORAGE_KEY,
  REMINDERS_ENABLED_STORAGE_KEY,
  setRemindersEnabledPreference,
} from "@/lib/reminder-settings";

describe("reminder-settings", () => {
  beforeEach(() => {
    window.localStorage.removeItem(REMINDERS_ENABLED_STORAGE_KEY);
    window.localStorage.removeItem(REMINDER_HISTORY_STORAGE_KEY);
  });

  it("defaults reminders to enabled when storage is empty", () => {
    expect(getRemindersEnabledPreference()).toBe(true);
  });

  it("reads and writes reminder enabled preference", () => {
    setRemindersEnabledPreference(false);
    expect(getRemindersEnabledPreference()).toBe(false);

    setRemindersEnabledPreference(true);
    expect(getRemindersEnabledPreference()).toBe(true);
  });

  it("treats non-false string as enabled", () => {
    window.localStorage.setItem(REMINDERS_ENABLED_STORAGE_KEY, "invalid");
    expect(getRemindersEnabledPreference()).toBe(true);
  });

  it("clears reminder history storage", () => {
    window.localStorage.setItem(
      REMINDER_HISTORY_STORAGE_KEY,
      JSON.stringify({ a: 1 }),
    );
    clearReminderHistoryStorage();
    expect(window.localStorage.getItem(REMINDER_HISTORY_STORAGE_KEY)).toBeNull();
  });
});
