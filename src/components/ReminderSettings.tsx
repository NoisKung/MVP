import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Bell,
  ShieldCheck,
  HardDrive,
  Cloud,
  CloudOff,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  Upload,
  Database,
} from "lucide-react";
import {
  type NotificationPermissionState,
  getNotificationPermissionStatus,
  requestNotificationPermissionAccess,
  resetReminderPermissionAndHistory,
} from "@/hooks/use-reminder-notifications";
import { useExportBackup, useImportBackup } from "@/hooks/use-tasks";
import type { SyncStatus, UpdateSyncEndpointSettingsInput } from "@/lib/types";

interface ReminderSettingsProps {
  remindersEnabled: boolean;
  onRemindersEnabledChange: (enabled: boolean) => void;
  syncStatus: SyncStatus;
  syncStatusLabel: string;
  syncLastSyncedAt: string | null;
  syncLastError: string | null;
  syncIsRunning: boolean;
  syncHasTransport: boolean;
  onSyncNow: () => Promise<void>;
  syncPushUrl: string | null;
  syncPullUrl: string | null;
  syncConfigSaving: boolean;
  onSaveSyncSettings: (input: UpdateSyncEndpointSettingsInput) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unable to complete this request.";
}

function renderSyncStatusIcon(status: SyncStatus) {
  if (status === "LOCAL_ONLY") {
    return <HardDrive size={14} />;
  }
  if (status === "SYNCING") {
    return <RefreshCw size={14} className="sync-spin" />;
  }
  if (status === "OFFLINE") {
    return <CloudOff size={14} />;
  }
  if (status === "CONFLICT") {
    return <AlertTriangle size={14} />;
  }
  return <CheckCircle2 size={14} />;
}

function formatSyncDateTime(value: string | null): string {
  if (!value) return "Never";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function normalizeUrlDraft(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function ReminderSettings({
  remindersEnabled,
  onRemindersEnabledChange,
  syncStatus,
  syncStatusLabel,
  syncLastSyncedAt,
  syncLastError,
  syncIsRunning,
  syncHasTransport,
  onSyncNow,
  syncPushUrl,
  syncPullUrl,
  syncConfigSaving,
  onSaveSyncSettings,
}: ReminderSettingsProps) {
  const [permissionState, setPermissionState] =
    useState<NotificationPermissionState>("unknown");
  const [isBusy, setIsBusy] = useState(false);
  const [permissionFeedback, setPermissionFeedback] = useState<string | null>(
    null,
  );
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [syncPushUrlDraft, setSyncPushUrlDraft] = useState<string>("");
  const [syncPullUrlDraft, setSyncPullUrlDraft] = useState<string>("");
  const [syncConfigFeedback, setSyncConfigFeedback] = useState<string | null>(
    null,
  );
  const [syncConfigError, setSyncConfigError] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();
  const isBackupBusy = exportBackup.isPending || importBackup.isPending;

  useEffect(() => {
    void refreshPermissionState(setPermissionState);
  }, []);

  useEffect(() => {
    setSyncPushUrlDraft(syncPushUrl ?? "");
  }, [syncPushUrl]);

  useEffect(() => {
    setSyncPullUrlDraft(syncPullUrl ?? "");
  }, [syncPullUrl]);

  const handleRequestPermission = async () => {
    setIsBusy(true);
    setPermissionFeedback(null);
    try {
      const nextState = await requestNotificationPermissionAccess();
      setPermissionState(nextState);
      setPermissionFeedback(
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
    setPermissionFeedback(null);
    try {
      const nextState = await resetReminderPermissionAndHistory();
      setPermissionState(nextState);
      setPermissionFeedback(
        "Permission cache and reminder history were reset. Existing reminders can notify again.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRefreshPermission = async () => {
    setIsBusy(true);
    setPermissionFeedback(null);
    try {
      await refreshPermissionState(setPermissionState);
    } finally {
      setIsBusy(false);
    }
  };

  const handleExportBackup = async () => {
    setBackupError(null);
    setBackupFeedback(null);
    try {
      const payload = await exportBackup.mutateAsync();
      const backupText = JSON.stringify(payload, null, 2);
      const blob = new Blob([backupText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const safeTimestamp = payload.exported_at.replace(/[:.]/g, "-");
      const filename = `solostack-backup-${safeTimestamp}.json`;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);

      setBackupFeedback(
        `Backup exported successfully (${payload.data.tasks.length} tasks, ${payload.data.projects.length} projects).`,
      );
    } catch (error) {
      setBackupError(getErrorMessage(error));
    }
  };

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    if (
      !window.confirm(
        "Restoring backup will replace all current local data. Continue?",
      )
    ) {
      return;
    }

    setBackupError(null);
    setBackupFeedback(null);
    try {
      const fileContent = await selectedFile.text();
      const parsedPayload = JSON.parse(fileContent) as unknown;
      const result = await importBackup.mutateAsync(parsedPayload);
      setBackupFeedback(
        `Backup restored: ${result.tasks} tasks, ${result.projects} projects, ${result.task_templates} templates.`,
      );
    } catch (error) {
      setBackupError(getErrorMessage(error));
    }
  };

  const handleOpenBackupFilePicker = () => {
    if (isBackupBusy) return;
    backupInputRef.current?.click();
  };

  const handleSaveSyncSettings = async () => {
    setSyncConfigFeedback(null);
    setSyncConfigError(null);

    const nextPushUrl = normalizeUrlDraft(syncPushUrlDraft);
    const nextPullUrl = normalizeUrlDraft(syncPullUrlDraft);
    const hasPushUrl = Boolean(nextPushUrl);
    const hasPullUrl = Boolean(nextPullUrl);

    if (hasPushUrl !== hasPullUrl) {
      setSyncConfigError(
        "Set both push URL and pull URL, or leave both empty.",
      );
      return;
    }

    if (nextPushUrl && !isValidHttpUrl(nextPushUrl)) {
      setSyncConfigError("Push URL must be a valid http(s) URL.");
      return;
    }
    if (nextPullUrl && !isValidHttpUrl(nextPullUrl)) {
      setSyncConfigError("Pull URL must be a valid http(s) URL.");
      return;
    }

    try {
      await onSaveSyncSettings({
        push_url: nextPushUrl,
        pull_url: nextPullUrl,
      });
      setSyncConfigFeedback(
        nextPushUrl
          ? "Sync endpoints were saved."
          : "Sync endpoints were cleared. App is now local-only.",
      );
    } catch (error) {
      setSyncConfigError(getErrorMessage(error));
    }
  };

  return (
    <div className="settings-wrap">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">
          Control reminders, notification access, and local data safety
        </p>
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
              When enabled, tasks with due reminders can trigger desktop
              notifications.
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

        {permissionFeedback && (
          <p className="settings-feedback">{permissionFeedback}</p>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Cloud size={16} />
          </div>
          <div>
            <h2 className="settings-card-title">Sync</h2>
            <p className="settings-card-desc">
              Manually sync now and check latest sync health.
            </p>
          </div>
        </div>

        <div
          className={`sync-pill sync-pill-${syncStatus.toLowerCase()}`}
          role="status"
          aria-live="polite"
        >
          {renderSyncStatusIcon(syncStatus)}
          <span>{syncStatusLabel}</span>
        </div>

        <div className="sync-meta">
          <p className="settings-row-subtitle">
            Last synced: {formatSyncDateTime(syncLastSyncedAt)}
          </p>
          {syncLastError && (
            <p className="settings-feedback settings-feedback-error">
              {syncLastError}
            </p>
          )}
          {syncStatus === "LOCAL_ONLY" && (
            <p className="settings-feedback">
              Local-only mode is active. Server is not required for
              single-device usage.
            </p>
          )}
          {!syncHasTransport && syncStatus !== "LOCAL_ONLY" && (
            <p className="settings-feedback settings-feedback-warn">
              To sync across devices, set both endpoints below.
            </p>
          )}
        </div>

        <div className="sync-endpoint-grid">
          <label className="settings-field">
            <span className="settings-field-label">Push URL</span>
            <input
              className="settings-input"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://sync.example.com/v1/sync/push"
              value={syncPushUrlDraft}
              onChange={(event) => setSyncPushUrlDraft(event.target.value)}
              disabled={syncConfigSaving}
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Pull URL</span>
            <input
              className="settings-input"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://sync.example.com/v1/sync/pull"
              value={syncPullUrlDraft}
              onChange={(event) => setSyncPullUrlDraft(event.target.value)}
              disabled={syncConfigSaving}
            />
          </label>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={() => void onSyncNow()}
            disabled={syncIsRunning || !syncHasTransport}
          >
            <RefreshCw size={14} className={syncIsRunning ? "sync-spin" : ""} />
            {syncIsRunning ? "Syncing..." : "Sync now"}
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={() => void handleSaveSyncSettings()}
            disabled={syncConfigSaving}
          >
            {syncConfigSaving ? "Saving..." : "Save Endpoints"}
          </button>
        </div>
        {syncConfigFeedback && (
          <p className="settings-feedback">{syncConfigFeedback}</p>
        )}
        {syncConfigError && (
          <p className="settings-feedback settings-feedback-error">
            {syncConfigError}
          </p>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Database size={16} />
          </div>
          <div>
            <h2 className="settings-card-title">Data Backup & Restore</h2>
            <p className="settings-card-desc">
              Export all local data to JSON and restore it later on this or
              another machine.
            </p>
          </div>
        </div>

        <p className="settings-row-subtitle settings-danger-text">
          Restore will replace all current local data.
        </p>

        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={() => void handleExportBackup()}
            disabled={isBackupBusy}
          >
            <Download size={14} />
            {exportBackup.isPending ? "Exporting..." : "Export Backup"}
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={handleOpenBackupFilePicker}
            disabled={isBackupBusy}
          >
            <Upload size={14} />
            {importBackup.isPending ? "Restoring..." : "Restore Backup"}
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json"
            onChange={(event) => void handleImportBackup(event)}
            style={{ display: "none" }}
          />
        </div>

        {backupFeedback && (
          <p className="settings-feedback">{backupFeedback}</p>
        )}
        {backupError && (
          <p className="settings-feedback settings-feedback-error">
            {backupError}
          </p>
        )}
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
        .settings-danger-text {
          margin-top: -2px;
          margin-bottom: 10px;
          color: var(--danger);
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
        .settings-feedback-error {
          color: var(--danger);
        }
        .settings-feedback-warn {
          color: #f59e0b;
        }
        .sync-pill {
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
          margin-bottom: 10px;
        }
        .sync-pill-synced {
          color: #22c55e;
        }
        .sync-pill-syncing {
          color: var(--accent);
        }
        .sync-pill-offline {
          color: #f59e0b;
        }
        .sync-pill-conflict {
          color: var(--danger);
        }
        .sync-pill-local_only {
          color: var(--text-muted);
        }
        .sync-meta {
          margin-bottom: 8px;
        }
        .sync-endpoint-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }
        .settings-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .settings-field-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .settings-input {
          height: 34px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-primary);
          font-size: 12px;
          padding: 0 10px;
          font-family: inherit;
        }
        .settings-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent);
        }
        .settings-input:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .sync-spin {
          animation: sync-rotate 0.8s linear infinite;
        }
        @keyframes sync-rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .settings-wrap {
            padding: 8px 10px;
          }
          .settings-row {
            align-items: flex-start;
          }
          .sync-endpoint-grid {
            grid-template-columns: 1fr;
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
