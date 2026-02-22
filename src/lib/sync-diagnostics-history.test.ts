import { describe, expect, it } from "vitest";
import {
  buildSyncSessionDiagnosticsHistoryExportPayload,
  filterSyncSessionDiagnosticsHistory,
  type SyncDiagnosticsHistorySourceFilter,
} from "./sync-diagnostics-history";
import type { SyncSessionDiagnosticsSnapshot } from "./types";

function createSnapshot(input: {
  capturedAt: string;
  source: SyncDiagnosticsHistorySourceFilter;
  provider: string | null;
  warning?: string | null;
}): SyncSessionDiagnosticsSnapshot {
  return {
    captured_at: input.capturedAt,
    diagnostics: {
      total_cycles: 1,
      successful_cycles: 1,
      failed_cycles: 0,
      conflict_cycles: 0,
      consecutive_failures: 0,
      success_rate_percent: 100,
      last_cycle_duration_ms: 200,
      average_cycle_duration_ms: 200,
      last_attempt_at: input.capturedAt,
      last_success_at: input.capturedAt,
      selected_provider: input.provider,
      runtime_profile: "desktop",
      runtime_preset_source:
        input.source === "all" ? "fallback_desktop" : input.source,
      provider_selected_events: 1,
      runtime_profile_changed_events: 1,
      validation_rejected_events: 0,
      last_warning: input.warning ?? null,
    },
  };
}

describe("sync diagnostics history filter", () => {
  const fixtures: SyncSessionDiagnosticsSnapshot[] = [
    createSnapshot({
      capturedAt: "2026-02-22T10:30:00.000Z",
      source: "user_agent_data_mobile",
      provider: "google_appdata",
      warning: "Push URL is missing",
    }),
    createSnapshot({
      capturedAt: "2026-02-21T09:00:00.000Z",
      source: "fallback_desktop",
      provider: "provider_neutral",
    }),
    createSnapshot({
      capturedAt: "2026-02-20T08:00:00.000Z",
      source: "platform_pattern",
      provider: "onedrive_approot",
    }),
  ];

  it("filters by source", () => {
    const result = filterSyncSessionDiagnosticsHistory({
      snapshots: fixtures,
      sourceFilter: "platform_pattern",
      query: "",
      dateFrom: "",
      dateTo: "",
      limit: 30,
    });

    expect(result.date_range_invalid).toBe(false);
    expect(result.total_filtered).toBe(1);
    expect(result.items[0].diagnostics.runtime_preset_source).toBe(
      "platform_pattern",
    );
  });

  it("filters by search query across provider and warning", () => {
    const byProvider = filterSyncSessionDiagnosticsHistory({
      snapshots: fixtures,
      sourceFilter: "all",
      query: "onedrive",
      dateFrom: "",
      dateTo: "",
      limit: 30,
    });
    expect(byProvider.total_filtered).toBe(1);

    const byWarning = filterSyncSessionDiagnosticsHistory({
      snapshots: fixtures,
      sourceFilter: "all",
      query: "push url",
      dateFrom: "",
      dateTo: "",
      limit: 30,
    });
    expect(byWarning.total_filtered).toBe(1);
  });

  it("filters by inclusive date range", () => {
    const result = filterSyncSessionDiagnosticsHistory({
      snapshots: fixtures,
      sourceFilter: "all",
      query: "",
      dateFrom: "2026-02-21",
      dateTo: "2026-02-22",
      limit: 30,
    });

    expect(result.date_range_invalid).toBe(false);
    expect(result.total_filtered).toBe(2);
  });

  it("returns invalid state when date range is reversed", () => {
    const result = filterSyncSessionDiagnosticsHistory({
      snapshots: fixtures,
      sourceFilter: "all",
      query: "",
      dateFrom: "2026-02-22",
      dateTo: "2026-02-20",
      limit: 30,
    });

    expect(result.date_range_invalid).toBe(true);
    expect(result.total_filtered).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("clamps limit to a safe range", () => {
    const result = filterSyncSessionDiagnosticsHistory({
      snapshots: fixtures,
      sourceFilter: "all",
      query: "",
      dateFrom: "",
      dateTo: "",
      limit: 1,
    });

    expect(result.total_filtered).toBe(3);
    expect(result.items).toHaveLength(1);
  });

  it("builds export payload with filter metadata and cloned diagnostics items", () => {
    const payload = buildSyncSessionDiagnosticsHistoryExportPayload({
      locale: "th",
      snapshots: fixtures,
      sourceFilter: "all",
      query: "  onedrive ",
      dateFrom: "2026-02-20",
      dateTo: "2026-02-22",
      limit: 5,
      exportedAt: "2026-02-22T12:34:56.000Z",
    });

    expect(payload).toMatchObject({
      version: 1,
      report_type: "sync_diagnostics_history",
      exported_at: "2026-02-22T12:34:56.000Z",
      app_locale: "th",
      filters: {
        source_filter: "all",
        query: "onedrive",
        date_from: "2026-02-20",
        date_to: "2026-02-22",
        limit: 5,
        date_range_invalid: false,
      },
      total_snapshots: 3,
      total_filtered: 1,
      total_exported: 1,
    });
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].diagnostics.selected_provider).toBe(
      "onedrive_approot",
    );

    payload.items[0].diagnostics.total_cycles = 99;
    expect(fixtures[2].diagnostics.total_cycles).toBe(1);
  });

  it("flags date-range-invalid payload export and returns no items", () => {
    const payload = buildSyncSessionDiagnosticsHistoryExportPayload({
      locale: "en",
      snapshots: fixtures,
      sourceFilter: "all",
      query: "",
      dateFrom: "2026-02-22",
      dateTo: "2026-02-20",
      limit: 30,
      exportedAt: "2026-02-22T20:00:00.000Z",
    });

    expect(payload.filters.date_range_invalid).toBe(true);
    expect(payload.total_filtered).toBe(0);
    expect(payload.total_exported).toBe(0);
    expect(payload.items).toEqual([]);
  });
});
