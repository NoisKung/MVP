import { useEffect, useState } from "react";
import { AlertTriangle, Download, RefreshCw, Settings2 } from "lucide-react";
import { translate, useI18n } from "@/lib/i18n";
import { localizeErrorMessage } from "@/lib/error-message";
import {
  useExportSyncConflictReport,
  useSyncConflictEvents,
} from "@/hooks/use-tasks";
import {
  buildManualMergeInitialText,
  buildManualMergeResolutionPayload,
  normalizeManualMergeText,
} from "@/lib/manual-merge";
import type {
  SyncConflictDefaultStrategy,
  ResolveSyncConflictInput,
  SyncConflictEventRecord,
  SyncConflictRecord,
  SyncConflictResolutionStrategy,
  SyncConflictStrategyDefaults,
} from "@/lib/types";
import { ManualMergeEditor } from "./ManualMergeEditor";

interface ConflictCenterViewProps {
  syncConflicts: SyncConflictRecord[];
  syncConflictsLoading: boolean;
  syncConflictResolving: boolean;
  syncConflictStrategyDefaults: SyncConflictStrategyDefaults;
  onResolveSyncConflict: (input: ResolveSyncConflictInput) => Promise<void>;
  onOpenSyncSettings: () => void;
}

function getErrorMessage(error: unknown, locale: "en" | "th"): string {
  return localizeErrorMessage(error, locale, "common.error.unableRequest");
}

function formatSyncDateTime(value: string | null, locale: "en" | "th"): string {
  if (!value) return translate(locale, "common.never");
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime()))
    return translate(locale, "common.unknown");
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function formatConflictTypeLabel(
  conflictType: SyncConflictRecord["conflict_type"],
  locale: "en" | "th",
) {
  if (conflictType === "delete_vs_update") {
    return translate(locale, "conflictCenter.type.deleteVsUpdate");
  }
  if (conflictType === "notes_collision") {
    return translate(locale, "conflictCenter.type.notesCollision");
  }
  if (conflictType === "validation_error") {
    return translate(locale, "conflictCenter.type.validationError");
  }
  return translate(locale, "conflictCenter.type.fieldConflict");
}

function formatConflictEventLabel(
  eventType: SyncConflictEventRecord["event_type"],
  locale: "en" | "th",
) {
  if (eventType === "detected")
    return translate(locale, "conflictCenter.event.detected");
  if (eventType === "resolved")
    return translate(locale, "conflictCenter.event.resolved");
  if (eventType === "ignored")
    return translate(locale, "conflictCenter.event.ignored");
  if (eventType === "retried")
    return translate(locale, "conflictCenter.event.retried");
  return translate(locale, "conflictCenter.event.exported");
}

function formatConflictResolutionStrategyLabel(
  strategy: SyncConflictDefaultStrategy,
  locale: "en" | "th",
) {
  if (strategy === "keep_remote") {
    return translate(locale, "conflictCenter.strategy.keepRemote");
  }
  if (strategy === "manual_merge") {
    return translate(locale, "conflictCenter.strategy.manualMerge");
  }
  return translate(locale, "conflictCenter.strategy.keepLocal");
}

function formatPayloadJson(
  payloadJson: string | null,
  locale: "en" | "th",
): string {
  if (!payloadJson) return translate(locale, "conflictCenter.payload.empty");
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return payloadJson;
  }
}

export function ConflictCenterView({
  syncConflicts,
  syncConflictsLoading,
  syncConflictResolving,
  syncConflictStrategyDefaults,
  onResolveSyncConflict,
  onOpenSyncSettings,
}: ConflictCenterViewProps) {
  const { locale, t } = useI18n();
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(
    null,
  );
  const [manualMergeConflictId, setManualMergeConflictId] = useState<
    string | null
  >(null);
  const [manualMergeDraft, setManualMergeDraft] = useState("");
  const [conflictFeedback, setConflictFeedback] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const exportSyncConflicts = useExportSyncConflictReport();
  const selectedConflict =
    syncConflicts.find((conflict) => conflict.id === selectedConflictId) ??
    null;
  const manualMergeConflict =
    syncConflicts.find((conflict) => conflict.id === manualMergeConflictId) ??
    null;
  const {
    data: selectedConflictEvents = [],
    isLoading: isConflictEventsLoading,
  } = useSyncConflictEvents(selectedConflict?.id, 100);

  useEffect(() => {
    if (syncConflicts.length === 0) {
      setSelectedConflictId(null);
      return;
    }

    if (!selectedConflictId) {
      setSelectedConflictId(syncConflicts[0].id);
      return;
    }

    const stillExists = syncConflicts.some(
      (conflict) => conflict.id === selectedConflictId,
    );
    if (!stillExists) {
      setSelectedConflictId(syncConflicts[0].id);
    }
  }, [selectedConflictId, syncConflicts]);

  useEffect(() => {
    if (!manualMergeConflictId) return;
    const stillExists = syncConflicts.some(
      (conflict) => conflict.id === manualMergeConflictId,
    );
    if (stillExists) return;
    setManualMergeConflictId(null);
    setManualMergeDraft("");
  }, [manualMergeConflictId, syncConflicts]);

  const handleResolveConflict = async (
    conflictId: string,
    strategy: SyncConflictResolutionStrategy,
    resolutionPayload?: Record<string, unknown> | null,
  ): Promise<boolean> => {
    setConflictFeedback(null);
    setConflictError(null);
    try {
      await onResolveSyncConflict({
        conflict_id: conflictId,
        strategy,
        resolution_payload: resolutionPayload ?? null,
      });
      setConflictFeedback(
        strategy === "retry"
          ? t("conflictCenter.feedback.retryQueued")
          : t("conflictCenter.feedback.resolveQueued"),
      );
      return true;
    } catch (error) {
      setConflictError(getErrorMessage(error, locale));
      return false;
    }
  };

  const handleRetryConflict = async (conflictId: string) => {
    if (!window.confirm(t("conflictCenter.confirm.retry"))) {
      return;
    }

    await handleResolveConflict(conflictId, "retry");
  };

  const handleOpenManualMergeEditor = (conflict: SyncConflictRecord) => {
    setConflictError(null);
    setConflictFeedback(null);
    setManualMergeConflictId(conflict.id);
    setManualMergeDraft(buildManualMergeInitialText(conflict));
  };

  const handleApplyDefaultStrategy = async (conflict: SyncConflictRecord) => {
    const defaultStrategy =
      syncConflictStrategyDefaults[conflict.conflict_type];
    if (defaultStrategy === "manual_merge") {
      handleOpenManualMergeEditor(conflict);
      return;
    }

    await handleResolveConflict(conflict.id, defaultStrategy, {
      default_applied: true,
      source: "dedicated_conflict_center",
    });
  };

  const handleCancelManualMerge = () => {
    setManualMergeConflictId(null);
    setManualMergeDraft("");
  };

  const handleSubmitManualMerge = async () => {
    if (!manualMergeConflict) return;

    const normalizedDraft = normalizeManualMergeText(manualMergeDraft);
    if (!normalizedDraft) {
      setConflictError(t("conflictCenter.error.mergeEmpty"));
      return;
    }

    const isSuccess = await handleResolveConflict(
      manualMergeConflict.id,
      "manual_merge",
      buildManualMergeResolutionPayload({
        conflict: manualMergeConflict,
        mergedText: normalizedDraft,
        source: "dedicated_conflict_center",
      }),
    );
    if (!isSuccess) return;

    handleCancelManualMerge();
  };

  const handleExportConflictReport = async () => {
    setConflictFeedback(null);
    setConflictError(null);

    try {
      const payload = await exportSyncConflicts.mutateAsync({
        status: "all",
        limit: 1000,
        eventsPerConflict: 100,
      });
      const reportText = JSON.stringify(payload, null, 2);
      const blob = new Blob([reportText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const safeTimestamp = payload.exported_at.replace(/[:.]/g, "-");
      const filename = `solostack-conflicts-${safeTimestamp}.json`;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);

      setConflictFeedback(
        t("conflictCenter.feedback.exported", {
          count: payload.total_conflicts,
        }),
      );
    } catch (error) {
      setConflictError(getErrorMessage(error, locale));
    }
  };

  return (
    <div className="conflict-center-view">
      <div className="conflict-center-header">
        <h1 className="conflict-center-title">{t("conflictCenter.title")}</h1>
        <p className="conflict-center-subtitle">
          {t("conflictCenter.subtitle")}
        </p>
      </div>

      <div className="conflict-center-top-actions">
        <button
          type="button"
          className="conflict-center-btn"
          onClick={onOpenSyncSettings}
        >
          <Settings2 size={14} />
          {t("conflictCenter.action.openSyncSettings")}
        </button>
        <button
          type="button"
          className="conflict-center-btn"
          onClick={() => void handleExportConflictReport()}
          disabled={exportSyncConflicts.isPending}
        >
          <Download size={14} />
          {exportSyncConflicts.isPending
            ? t("conflictCenter.action.exporting")
            : t("conflictCenter.action.exportReport")}
        </button>
      </div>

      {syncConflictsLoading ? (
        <div className="conflict-center-state">
          <RefreshCw size={16} className="conflict-spin" />
          <span>{t("conflictCenter.loading")}</span>
        </div>
      ) : syncConflicts.length === 0 ? (
        <div className="conflict-center-empty">
          <AlertTriangle size={16} />
          <div>
            <p className="conflict-center-empty-title">
              {t("conflictCenter.empty.title")}
            </p>
            <p className="conflict-center-empty-subtitle">
              {t("conflictCenter.empty.subtitle")}
            </p>
          </div>
        </div>
      ) : (
        <div className="conflict-center-layout">
          <div className="conflict-center-list">
            {syncConflicts.map((conflict) => (
              <div className="conflict-center-item" key={conflict.id}>
                <div className="conflict-center-item-head">
                  <span className="conflict-center-type">
                    {formatConflictTypeLabel(conflict.conflict_type, locale)}
                  </span>
                  <span className="conflict-center-entity">
                    {conflict.entity_type}:{conflict.entity_id}
                  </span>
                  {selectedConflictId === conflict.id && (
                    <span className="conflict-center-selected">
                      {t("conflictCenter.selected")}
                    </span>
                  )}
                </div>
                <p className="conflict-center-message">{conflict.message}</p>
                <p className="conflict-center-meta">
                  {t("conflictCenter.meta.detected")}:{" "}
                  {formatSyncDateTime(conflict.detected_at, locale)}
                </p>
                <p className="conflict-center-meta">
                  {t("conflictCenter.defaultStrategy", {
                    strategy: formatConflictResolutionStrategyLabel(
                      syncConflictStrategyDefaults[conflict.conflict_type],
                      locale,
                    ),
                  })}
                </p>
                <div className="conflict-center-actions">
                  <button
                    type="button"
                    className="conflict-center-btn conflict-center-btn-primary"
                    onClick={() => void handleApplyDefaultStrategy(conflict)}
                    disabled={syncConflictResolving}
                  >
                    {t("conflictCenter.action.applyDefault")}
                  </button>
                  <button
                    type="button"
                    className="conflict-center-btn"
                    onClick={() =>
                      void handleResolveConflict(conflict.id, "keep_local")
                    }
                    disabled={syncConflictResolving}
                  >
                    {t("conflictCenter.action.keepLocal")}
                  </button>
                  <button
                    type="button"
                    className="conflict-center-btn"
                    onClick={() =>
                      void handleResolveConflict(conflict.id, "keep_remote")
                    }
                    disabled={syncConflictResolving}
                  >
                    {t("conflictCenter.action.keepRemote")}
                  </button>
                  <button
                    type="button"
                    className="conflict-center-btn"
                    onClick={() => void handleRetryConflict(conflict.id)}
                    disabled={syncConflictResolving}
                  >
                    {t("common.retry")}
                  </button>
                  <button
                    type="button"
                    className="conflict-center-btn"
                    onClick={() => handleOpenManualMergeEditor(conflict)}
                    disabled={syncConflictResolving}
                  >
                    {t("conflictCenter.action.manualMerge")}
                  </button>
                  <button
                    type="button"
                    className="conflict-center-btn"
                    onClick={() => setSelectedConflictId(conflict.id)}
                  >
                    {t("conflictCenter.action.details")}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selectedConflict && (
            <div className="conflict-center-detail">
              <p className="conflict-center-section-title">
                {t("conflictCenter.detail.title")}
              </p>
              <p className="conflict-center-meta">
                {selectedConflict.entity_type}:{selectedConflict.entity_id} ·{" "}
                {formatConflictTypeLabel(
                  selectedConflict.conflict_type,
                  locale,
                )}
              </p>
              <div className="conflict-center-payload-grid">
                <div>
                  <span className="conflict-center-field-label">
                    {t("conflictCenter.detail.localPayload")}
                  </span>
                  <pre className="conflict-center-payload">
                    {formatPayloadJson(
                      selectedConflict.local_payload_json,
                      locale,
                    )}
                  </pre>
                </div>
                <div>
                  <span className="conflict-center-field-label">
                    {t("conflictCenter.detail.remotePayload")}
                  </span>
                  <pre className="conflict-center-payload">
                    {formatPayloadJson(
                      selectedConflict.remote_payload_json,
                      locale,
                    )}
                  </pre>
                </div>
              </div>

              <p className="conflict-center-section-title">
                {t("conflictCenter.detail.timeline")}
              </p>
              {isConflictEventsLoading ? (
                <p className="conflict-center-meta">
                  {t("conflictCenter.detail.loadingTimeline")}
                </p>
              ) : selectedConflictEvents.length === 0 ? (
                <p className="conflict-center-meta">
                  {t("conflictCenter.detail.noEvents")}
                </p>
              ) : (
                <div className="conflict-center-timeline">
                  {selectedConflictEvents.map((event) => (
                    <div
                      className="conflict-center-timeline-item"
                      key={event.id}
                    >
                      <span className="conflict-center-event-pill">
                        {formatConflictEventLabel(event.event_type, locale)}
                      </span>
                      <span className="conflict-center-meta">
                        {formatSyncDateTime(event.created_at, locale)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {manualMergeConflict && (
        <ManualMergeEditor
          conflict={manualMergeConflict}
          draft={manualMergeDraft}
          isSaving={syncConflictResolving}
          onDraftChange={setManualMergeDraft}
          onCancel={handleCancelManualMerge}
          onSubmit={() => void handleSubmitManualMerge()}
        />
      )}

      {conflictFeedback && (
        <p className="conflict-center-feedback">{conflictFeedback}</p>
      )}
      {conflictError && (
        <p className="conflict-center-feedback conflict-center-feedback-error">
          {conflictError}
        </p>
      )}

      <style>{`
        .conflict-center-view {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 18px;
        }
        .conflict-center-header {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .conflict-center-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          letter-spacing: -0.4px;
        }
        .conflict-center-subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
        }
        .conflict-center-top-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .conflict-center-state,
        .conflict-center-empty {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          color: var(--text-secondary);
          padding: 10px 12px;
        }
        .conflict-center-empty-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }
        .conflict-center-empty-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          margin: 2px 0 0;
        }
        .conflict-center-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 10px;
        }
        .conflict-center-list {
          display: grid;
          gap: 8px;
        }
        .conflict-center-item {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          padding: 10px;
        }
        .conflict-center-item-head {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin-bottom: 4px;
        }
        .conflict-center-type {
          display: inline-flex;
          align-items: center;
          border-radius: var(--radius-full);
          border: 1px solid rgba(248, 113, 113, 0.45);
          background: var(--danger-subtle);
          color: var(--danger);
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }
        .conflict-center-entity {
          font-size: 11px;
          color: var(--text-muted);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        }
        .conflict-center-selected {
          font-size: 11px;
          color: var(--accent);
          font-weight: 700;
        }
        .conflict-center-message {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 0 0 6px;
          line-height: 1.45;
        }
        .conflict-center-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .conflict-center-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 30px;
          padding: 0 10px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .conflict-center-btn:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .conflict-center-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .conflict-center-btn-primary {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }
        .conflict-center-btn-primary:hover:not(:disabled) {
          background: var(--accent-hover);
          border-color: var(--accent-hover);
          color: #fff;
        }
        .conflict-center-detail {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          padding: 10px;
        }
        .conflict-center-section-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 6px;
          text-transform: uppercase;
          letter-spacing: 0.25px;
        }
        .conflict-center-meta {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.4;
        }
        .conflict-center-payload-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 8px;
          margin-bottom: 10px;
        }
        .conflict-center-field-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }
        .conflict-center-payload {
          margin: 4px 0 0;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 11px;
          line-height: 1.4;
          padding: 8px;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 180px;
          overflow: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        }
        .conflict-center-timeline {
          display: grid;
          gap: 6px;
          margin-top: 6px;
        }
        .conflict-center-timeline-item {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .conflict-center-event-pill {
          display: inline-flex;
          align-items: center;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-default);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }
        .conflict-center-feedback {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 0;
        }
        .conflict-center-feedback-error {
          color: var(--danger);
        }
        .conflict-spin {
          animation: conflict-spin 0.8s linear infinite;
        }
        @keyframes conflict-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 900px) {
          .conflict-center-payload-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
