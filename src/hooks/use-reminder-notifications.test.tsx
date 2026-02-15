import { act, renderHook } from "@testing-library/react";
import {
  getNotificationPermissionStatus,
  REMINDER_CHECK_INTERVAL_MS,
  requestNotificationPermissionAccess,
  resetReminderPermissionAndHistory,
  resetReminderPermissionCache,
  useReminderNotifications,
} from "@/hooks/use-reminder-notifications";
import {
  REMINDER_HISTORY_STORAGE_KEY,
  REMINDERS_ENABLED_STORAGE_KEY,
} from "@/lib/reminder-settings";
import { createTaskFixture } from "@/test/fixtures";

const isPermissionGrantedMock = vi.fn();
const onActionMock = vi.fn();
const requestPermissionMock = vi.fn();
const sendNotificationMock = vi.fn();

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: (...args: unknown[]) => isPermissionGrantedMock(...args),
  onAction: (...args: unknown[]) => onActionMock(...args),
  requestPermission: (...args: unknown[]) => requestPermissionMock(...args),
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args),
}));

interface MockNotificationConstructor extends typeof Notification {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
}

function mockWebNotificationApi({
  permission = "default",
  requestPermission = async () => permission,
  onCreate,
}: {
  permission?: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
  onCreate?: (notificationInstance: {
    title: string;
    body: string;
    close: () => void;
    onclick: (() => void) | null;
  }) => void;
} = {}): void {
  class MockNotification {
    static permission: NotificationPermission = permission;
    static requestPermission = requestPermission;

    onclick: (() => void) | null = null;
    readonly close = vi.fn();

    constructor(
      public title: string,
      public options?: NotificationOptions,
    ) {
      onCreate?.({
        title,
        body: options?.body ?? "",
        close: this.close,
        onclick: this.onclick,
      });
    }
  }

  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: MockNotification as unknown as MockNotificationConstructor,
  });
}

describe("use-reminder-notifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    resetReminderPermissionCache();
    isPermissionGrantedMock.mockReset();
    onActionMock.mockReset();
    requestPermissionMock.mockReset();
    sendNotificationMock.mockReset();
    mockWebNotificationApi();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns granted permission state via plugin", async () => {
    isPermissionGrantedMock.mockResolvedValue(true);
    await expect(getNotificationPermissionStatus()).resolves.toBe("granted");
  });

  it("falls back to web notification permission state when plugin fails", async () => {
    isPermissionGrantedMock.mockRejectedValue(new Error("plugin unavailable"));
    mockWebNotificationApi({ permission: "denied" });

    await expect(getNotificationPermissionStatus()).resolves.toBe("denied");
  });

  it("requests permission from plugin first and web API as fallback", async () => {
    isPermissionGrantedMock.mockResolvedValue(false);
    requestPermissionMock.mockResolvedValue("granted");
    await expect(requestNotificationPermissionAccess()).resolves.toBe("granted");

    requestPermissionMock.mockRejectedValue(new Error("plugin unavailable"));
    mockWebNotificationApi({
      permission: "default",
      requestPermission: async () => "denied",
    });
    await expect(requestNotificationPermissionAccess()).resolves.toBe("denied");
  });

  it("resets reminder history and permission cache", async () => {
    window.localStorage.setItem(REMINDER_HISTORY_STORAGE_KEY, JSON.stringify({ a: 1 }));
    window.localStorage.setItem(REMINDERS_ENABLED_STORAGE_KEY, "false");
    isPermissionGrantedMock.mockResolvedValue(false);

    await expect(resetReminderPermissionAndHistory()).resolves.toBe("unknown");
    expect(window.localStorage.getItem(REMINDER_HISTORY_STORAGE_KEY)).toBeNull();
  });

  it("sends reminder notifications once per reminder signature and unregisters action listener", async () => {
    const now = new Date(2026, 1, 15, 12, 0, 0, 0);
    vi.setSystemTime(now);
    isPermissionGrantedMock.mockResolvedValue(true);

    const unregisterMock = vi.fn();
    let actionHandler: ((notification: { extra?: { taskId?: string } }) => void) | null =
      null;
    onActionMock.mockImplementation(async (handler: typeof actionHandler) => {
      actionHandler = handler;
      return { unregister: unregisterMock };
    });

    const onTaskNotificationClick = vi.fn();
    const task = createTaskFixture({
      id: "task-1",
      title: "Review release notes",
      remind_at: new Date(now.getTime() - 60_000).toISOString(),
      due_at: new Date(now.getTime() + 3_600_000).toISOString(),
      status: "TODO",
    });

    const { unmount } = renderHook(() =>
      useReminderNotifications([task], true, onTaskNotificationClick),
    );

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(REMINDER_CHECK_INTERVAL_MS);
    });

    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(REMINDER_HISTORY_STORAGE_KEY)).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REMINDER_CHECK_INTERVAL_MS);
    });
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);

    actionHandler?.({ extra: { taskId: "task-1" } });
    expect(onTaskNotificationClick).toHaveBeenCalledWith("task-1");

    unmount();
    expect(unregisterMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to web notification when plugin send fails", async () => {
    const now = new Date(2026, 1, 15, 12, 0, 0, 0);
    vi.setSystemTime(now);
    isPermissionGrantedMock.mockResolvedValue(true);
    onActionMock.mockResolvedValue({ unregister: vi.fn() });
    sendNotificationMock.mockImplementation(() => {
      throw new Error("plugin failed");
    });

    const createdNotifications: Array<{ title: string; body: string }> = [];
    mockWebNotificationApi({
      permission: "granted",
      onCreate: (notification) => {
        createdNotifications.push({
          title: notification.title,
          body: notification.body,
        });
      },
    });

    const task = createTaskFixture({
      id: "task-2",
      title: "Ship hotfix",
      remind_at: new Date(now.getTime() - 120_000).toISOString(),
      due_at: new Date(now.getTime() + 1_800_000).toISOString(),
    });

    renderHook(() => useReminderNotifications([task], true, vi.fn()));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(REMINDER_CHECK_INTERVAL_MS);
    });

    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(createdNotifications).toHaveLength(1);
    expect(createdNotifications[0].title).toBe("SoloStack Reminder");
    expect(createdNotifications[0].body).toContain("Ship hotfix");
  });

  it("does not schedule reminder checks when disabled", async () => {
    isPermissionGrantedMock.mockResolvedValue(true);
    onActionMock.mockResolvedValue({ unregister: vi.fn() });

    const task = createTaskFixture({
      id: "task-3",
      title: "Disabled reminder",
      remind_at: new Date(Date.now() - 1_000).toISOString(),
    });

    renderHook(() => useReminderNotifications([task], false, vi.fn()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REMINDER_CHECK_INTERVAL_MS * 2);
    });

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });
});

interface NotificationOptions {
  body?: string;
}
