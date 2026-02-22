import type {
  AppLocale,
  SyncConflictReportExportSource,
  SyncConflictReportPayload,
  SyncConflictSupportReportPayload,
  SyncSessionDiagnostics,
  SyncSessionDiagnosticsSnapshot,
} from "./types";

interface AttachSyncSessionDiagnosticsInput {
  report: SyncConflictReportPayload;
  exportSource: SyncConflictReportExportSource;
  locale: AppLocale;
  sessionDiagnostics: SyncSessionDiagnostics | null | undefined;
  sessionDiagnosticsHistory?: SyncSessionDiagnosticsSnapshot[] | null;
  historyLimit?: number;
}

export function attachSyncSessionDiagnosticsToConflictReport(
  input: AttachSyncSessionDiagnosticsInput,
): SyncConflictSupportReportPayload {
  const normalizedHistoryLimit = Math.max(
    0,
    Math.min(200, Math.trunc(input.historyLimit ?? 30)),
  );
  const historySource = Array.isArray(input.sessionDiagnosticsHistory)
    ? input.sessionDiagnosticsHistory
    : [];
  const sessionDiagnosticsHistory = historySource
    .slice(0, normalizedHistoryLimit)
    .map((entry) => ({
      captured_at: entry.captured_at,
      diagnostics: { ...entry.diagnostics },
    }));
  const sessionDiagnostics =
    input.sessionDiagnostics ??
    sessionDiagnosticsHistory[0]?.diagnostics ??
    null;

  return {
    ...input.report,
    report_type: "sync_conflict_support",
    export_source: input.exportSource,
    app_locale: input.locale,
    session_diagnostics: sessionDiagnostics ? { ...sessionDiagnostics } : null,
    session_diagnostics_history: sessionDiagnosticsHistory,
  };
}
