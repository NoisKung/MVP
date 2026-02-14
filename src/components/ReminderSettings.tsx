import { useEffect, useState } from "react";
import {
  Bell,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import {
  type NotificationPermissionState,
  getNotificationPermissionStatus,
  requestNotificationPermissionAccess,
  resetReminderPermissionAndHistory,
} from "@/hooks/use-reminder-notifications";

interface ReminderSettingsProps {
  remindersEnabled: boolean;
  onRemindersEnabledChange: (enabled: boolean) => void;
}

export function ReminderSettings({
  remindersEnabled,
  onRemindersEnabledChange,
}: ReminderSettingsProps) {
  const [permissionState, setPermissionState] =
    useState<NotificationPermissionState>("unknown");
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    void refreshPermissionState(setPermissionState);
  }, []);

  const handleRequestPermission = async () => {
    setIsBusy(true);
    setFeedback(null);
    try {
      const nextState = await requestNotificationPermissionAccess();
      setPermissionState(nextState);
      setFeedback(
        nextState === "granted"
          ? "Notifications are enabled."
          : "Permission is not granted. You may need OS settings to allow notifications.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetPermissionAndHistory = async () => {
    setIsBusy(true);
    setFeedback(null);
    try {
      const nextState = await resetReminderPermissionAndHistory();
      setPermissionState(nextState);
      setFeedback(
        "Permission cache and reminder history were reset. Existing reminders can notify again.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRefreshPermission = async () => {
    setIsBusy(true);
    setFeedback(null);
    try {
      await refreshPermissionState(setPermissionState);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="settings-wrap">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Control reminder and notification behavior</p>
      </div>

      <section className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Bell size={16} />
          </div>
          <div>
            <h2 className="settings-card-title">Task Reminders</h2>
            <p className="settings-card-desc">
              Turn reminder notifications on or off globally.
            </p>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <p className="settings-row-title">Enable reminders</p>
            <p className="settings-row-subtitle">
              When enabled, tasks with due reminders can trigger desktop notifications.
            </p>
          </div>
          <button
            type="button"
            className={`toggle-btn${remindersEnabled ? " enabled" : ""}`}
            onClick={() => onRemindersEnabledChange(!remindersEnabled)}
            aria-pressed={remindersEnabled}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <ShieldCheck size={16} />
          </div>
          <div>
            <h2 className="settings-card-title">Notification Permission</h2>
            <p className="settings-card-desc">
              Check current permission and reset permission cache/history.
            </p>
          </div>
        </div>

        <div className="permission-pill">
          {permissionState === "granted" ? (
            <>
              <CheckCircle2 size={14} />
              Granted
            </>
          ) : permissionState === "denied" ? (
            <>
              <XCircle size={14} />
              Denied
            </>
          ) : (
            <>
              <HelpCircle size={14} />
              Unknown
            </>
          )}
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={() => void handleRequestPermission()}
            disabled={isBusy}
          >
            <Bell size={14} />
            Request Permission
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={() => void handleRefreshPermission()}
            disabled={isBusy}
          >
            <RefreshCw size={14} />
            Refresh Status
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-danger"
            onClick={() => void handleResetPermissionAndHistory()}
            disabled={isBusy}
          >
            <RotateCcw size={14} />
            Reset Permission + History
          </button>
        </div>

        {feedback && <p className="settings-feedback">{feedback}</p>}
      </section>

      <style>{`
        .settings-wrap {
          max-width: 860px;
          margin: 0 auto;
          padding: 24px 28px;
        }
        .settings-header {
          margin-bottom: 20px;
        }
        .settings-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }
        .settings-subtitle {
          margin-top: 2px;
          font-size: 13px;
          color: var(--text-muted);
        }

        .settings-card {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
          padding: 16px;
          margin-bottom: 12px;
        }
        .settings-card-header {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 14px;
        }
        .settings-card-icon {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-subtle);
          color: var(--accent);
          flex-shrink: 0;
        }
        .settings-card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .settings-card-desc {
          margin-top: 2px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          padding: 12px 14px;
        }
        .settings-row-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .settings-row-subtitle {
          margin-top: 2px;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.45;
        }
        .toggle-btn {
          width: 44px;
          height: 24px;
          border-radius: 9999px;
          border: 1px solid var(--border-default);
          background: var(--bg-hover);
          display: inline-flex;
          align-items: center;
          padding: 2px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .toggle-btn.enabled {
          background: var(--accent);
          border-color: var(--accent);
        }
        .toggle-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          transform: translateX(0);
          transition: transform var(--duration) var(--ease);
        }
        .toggle-btn.enabled .toggle-thumb {
          transform: translateX(20px);
        }

        .permission-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          margin-bottom: 12px;
        }
        .settings-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .settings-btn {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          height: 32px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .settings-btn:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-strong);
        }
        .settings-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .settings-btn-primary {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }
        .settings-btn-primary:hover:not(:disabled) {
          background: var(--accent-hover);
          border-color: var(--accent-hover);
        }
        .settings-btn-danger {
          color: var(--danger);
          border-color: rgba(248, 113, 113, 0.35);
          background: var(--danger-subtle);
        }
        .settings-btn-danger:hover:not(:disabled) {
          border-color: var(--danger);
          background: rgba(248, 113, 113, 0.16);
          color: var(--danger);
        }
        .settings-feedback {
          margin-top: 10px;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.45;
        }

        @media (max-width: 640px) {
          .settings-wrap {
            padding: 8px 10px;
          }
          .settings-row {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}

async function refreshPermissionState(
  setPermissionState: (state: NotificationPermissionState) => void,
): Promise<void> {
  const latestPermissionState = await getNotificationPermissionStatus();
  setPermissionState(latestPermissionState);
}
