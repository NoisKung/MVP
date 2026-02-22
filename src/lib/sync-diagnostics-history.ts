import type {
  AppLocale,
  SyncRuntimePresetDetectionSource,
  SyncSessionDiagnosticsSnapshot,
} from "./types";

export type SyncDiagnosticsHistorySourceFilter =
  | "all"
  | SyncRuntimePresetDetectionSource;

interface FilterSyncSessionDiagnosticsHistoryInput {
  snapshots: SyncSessionDiagnosticsSnapshot[];
  sourceFilter: SyncDiagnosticsHistorySourceFilter;
  query: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
}

export interface FilterSyncSessionDiagnosticsHistoryResult {
  items: SyncSessionDiagnosticsSnapshot[];
  total_filtered: number;
  date_range_invalid: boolean;
}

export interface SyncSessionDiagnosticsHistoryExportPayload {
  version: 1;
  report_type: "sync_diagnostics_history";
  exported_at: string;
  app_locale: AppLocale;
  filters: {
    source_filter: SyncDiagnosticsHistorySourceFilter;
    query: string;
    date_from: string | null;
    date_to: string | null;
    limit: number;
    date_range_invalid: boolean;
  };
  total_snapshots: number;
  total_filtered: number;
  total_exported: number;
  items: SyncSessionDiagnosticsSnapshot[];
}

interface BuildSyncSessionDiagnosticsHistoryExportPayloadInput {
  locale: AppLocale;
  snapshots: SyncSessionDiagnosticsSnapshot[];
  sourceFilter: SyncDiagnosticsHistorySourceFilter;
  query: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
  exportedAt?: string;
}

function normalizeLimit(limit: number): number {
  return Math.max(1, Math.min(200, Math.trunc(limit)));
}

function normalizeDateStartMs(dateOnly: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function normalizeDateEndMs(dateOnly: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const parsed = new Date(`${dateOnly}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function normalizeSearchText(snapshot: SyncSessionDiagnosticsSnapshot): string {
  const diagnostics = snapshot.diagnostics;
  return [
    snapshot.captured_at,
    diagnostics.selected_provider ?? "",
    diagnostics.runtime_profile ?? "",
    diagnostics.runtime_preset_source ?? "",
    diagnostics.last_warning ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function filterSyncSessionDiagnosticsHistory(
  input: FilterSyncSessionDiagnosticsHistoryInput,
): FilterSyncSessionDiagnosticsHistoryResult {
  const normalizedLimit = normalizeLimit(input.limit);
  const normalizedQuery = input.query.trim().toLowerCase();
  const normalizedDateFromMs = normalizeDateStartMs(input.dateFrom);
  const normalizedDateToMs = normalizeDateEndMs(input.dateTo);
  const dateRangeInvalid =
    normalizedDateFromMs !== null &&
    normalizedDateToMs !== null &&
    normalizedDateFromMs > normalizedDateToMs;

  if (dateRangeInvalid) {
    return {
      items: [],
      total_filtered: 0,
      date_range_invalid: true,
    };
  }

  const filtered = input.snapshots.filter((snapshot) => {
    if (
      input.sourceFilter !== "all" &&
      snapshot.diagnostics.runtime_preset_source !== input.sourceFilter
    ) {
      return false;
    }

    if (normalizedDateFromMs !== null || normalizedDateToMs !== null) {
      const capturedAtMs = new Date(snapshot.captured_at).getTime();
      if (!Number.isFinite(capturedAtMs)) return false;
      if (
        normalizedDateFromMs !== null &&
        capturedAtMs < normalizedDateFromMs
      ) {
        return false;
      }
      if (normalizedDateToMs !== null && capturedAtMs > normalizedDateToMs) {
        return false;
      }
    }

    if (normalizedQuery) {
      const searchText = normalizeSearchText(snapshot);
      if (!searchText.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });

  return {
    items: filtered.slice(0, normalizedLimit),
    total_filtered: filtered.length,
    date_range_invalid: false,
  };
}

export function buildSyncSessionDiagnosticsHistoryExportPayload(
  input: BuildSyncSessionDiagnosticsHistoryExportPayloadInput,
): SyncSessionDiagnosticsHistoryExportPayload {
  const normalizedLimit = normalizeLimit(input.limit);
  const normalizedQuery = input.query.trim();
  const normalizedDateFrom = input.dateFrom.trim();
  const normalizedDateTo = input.dateTo.trim();
  const filtered = filterSyncSessionDiagnosticsHistory({
    snapshots: input.snapshots,
    sourceFilter: input.sourceFilter,
    query: normalizedQuery,
    dateFrom: normalizedDateFrom,
    dateTo: normalizedDateTo,
    limit: normalizedLimit,
  });

  return {
    version: 1,
    report_type: "sync_diagnostics_history",
    exported_at: input.exportedAt ?? new Date().toISOString(),
    app_locale: input.locale,
    filters: {
      source_filter: input.sourceFilter,
      query: normalizedQuery,
      date_from: normalizedDateFrom || null,
      date_to: normalizedDateTo || null,
      limit: normalizedLimit,
      date_range_invalid: filtered.date_range_invalid,
    },
    total_snapshots: input.snapshots.length,
    total_filtered: filtered.total_filtered,
    total_exported: filtered.items.length,
    items: filtered.items.map((snapshot) => ({
      captured_at: snapshot.captured_at,
      diagnostics: {
        ...snapshot.diagnostics,
      },
    })),
  };
}
