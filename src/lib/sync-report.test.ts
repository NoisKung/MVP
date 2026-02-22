import { describe, expect, it } from "vitest";
import { attachSyncSessionDiagnosticsToConflictReport } from "./sync-report";
import type {
  SyncConflictReportPayload,
  SyncSessionDiagnostics,
  SyncSessionDiagnosticsSnapshot,
} from "./types";

function createReportFixture(): SyncConflictReportPayload {
  return {
    version: 1,
    exported_at: "2026-02-22T00:00:00.000Z",
    total_conflicts: 0,
    status_filter: "all",
    items: [],
  };
}

function createDiagnosticsFixture(): SyncSessionDiagnostics {
  return {
    total_cycles: 4,
    successful_cycles: 3,
    failed_cycles: 1,
    conflict_cycles: 1,
    consecutive_failures: 0,
    success_rate_percent: 75,
    last_cycle_duration_ms: 420,
    average_cycle_duration_ms: 500,
    last_attempt_at: "2026-02-22T00:00:00.000Z",
    last_success_at: "2026-02-21T23:59:00.000Z",
    selected_provider: "provider_neutral",
    runtime_profile: "mobile_beta",
    runtime_preset_source: "user_agent_data_mobile",
    provider_selected_events: 1,
    runtime_profile_changed_events: 1,
    validation_rejected_events: 0,
    last_warning: null,
  };
}

function createHistoryFixture(): SyncSessionDiagnosticsSnapshot[] {
  return [
    {
      captured_at: "2026-02-22T00:00:00.000Z",
      diagnostics: createDiagnosticsFixture(),
    },
    {
      captured_at: "2026-02-21T23:50:00.000Z",
      diagnostics: {
        ...createDiagnosticsFixture(),
        total_cycles: 3,
        runtime_preset_source: "fallback_desktop",
      },
    },
  ];
}

describe("sync support report payload", () => {
  it("attaches diagnostics metadata while keeping legacy conflict report keys", () => {
    const report = createReportFixture();
    const diagnostics = createDiagnosticsFixture();
    const history = createHistoryFixture();

    const payload = attachSyncSessionDiagnosticsToConflictReport({
      report,
      exportSource: "settings_sync",
      locale: "th",
      sessionDiagnostics: diagnostics,
      sessionDiagnosticsHistory: history,
    });

    expect(payload).toMatchObject({
      version: 1,
      exported_at: report.exported_at,
      total_conflicts: 0,
      status_filter: "all",
      report_type: "sync_conflict_support",
      export_source: "settings_sync",
      app_locale: "th",
      session_diagnostics: {
        runtime_preset_source: "user_agent_data_mobile",
      },
    });
    expect(payload.session_diagnostics_history).toHaveLength(2);
    expect(payload.session_diagnostics_history[0].captured_at).toBe(
      "2026-02-22T00:00:00.000Z",
    );
  });

  it("stores null diagnostics when session snapshot is unavailable", () => {
    const payload = attachSyncSessionDiagnosticsToConflictReport({
      report: createReportFixture(),
      exportSource: "conflict_center",
      locale: "en",
      sessionDiagnostics: null,
      sessionDiagnosticsHistory: createHistoryFixture(),
    });

    expect(payload.export_source).toBe("conflict_center");
    expect(payload.session_diagnostics).not.toBeNull();
    expect(payload.session_diagnostics?.runtime_preset_source).toBe(
      "user_agent_data_mobile",
    );
    expect(payload.session_diagnostics_history).toHaveLength(2);
  });
});
