// @vitest-environment node

import {
  clearReminderHistoryStorage,
  getRemindersEnabledPreference,
  setRemindersEnabledPreference,
} from "@/lib/reminder-settings";

describe("reminder-settings (node runtime)", () => {
  it("uses safe no-window fallbacks", () => {
    expect(getRemindersEnabledPreference()).toBe(true);
    expect(() => setRemindersEnabledPreference(false)).not.toThrow();
    expect(() => clearReminderHistoryStorage()).not.toThrow();
  });
});
