export type SyncConnectorProvider = "google_appdata" | "onedrive_approot";

export interface SyncConnectorCapabilities {
  supports_delta_cursor: boolean;
  supports_etag_conditional_write: boolean;
  default_page_size: number;
  max_page_size: number;
}

const CONNECTOR_CAPABILITIES_BY_PROVIDER: Record<
  SyncConnectorProvider,
  SyncConnectorCapabilities
> = {
  google_appdata: {
    supports_delta_cursor: false,
    supports_etag_conditional_write: true,
    default_page_size: 100,
    max_page_size: 1000,
  },
  onedrive_approot: {
    supports_delta_cursor: true,
    supports_etag_conditional_write: true,
    default_page_size: 200,
    max_page_size: 1000,
  },
};

export interface SyncConnectorRequestBoundsInput {
  limit?: number | null;
  timeout_ms?: number | null;
}

export interface SyncConnectorNormalizedRequestBounds {
  limit: number;
  timeout_ms: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

function normalizeFiniteInteger(
  value: number | null | undefined,
  input: {
    fallback: number;
    min: number;
    max: number;
  },
): number {
  if (!Number.isFinite(value)) return input.fallback;
  const normalized = Math.floor(value as number);
  if (normalized < input.min) return input.min;
  if (normalized > input.max) return input.max;
  return normalized;
}

export function getSyncConnectorCapabilities(
  provider: SyncConnectorProvider,
): SyncConnectorCapabilities {
  return CONNECTOR_CAPABILITIES_BY_PROVIDER[provider];
}

export function normalizeSyncConnectorRequestBounds(
  provider: SyncConnectorProvider,
  input: SyncConnectorRequestBoundsInput = {},
): SyncConnectorNormalizedRequestBounds {
  const capabilities = getSyncConnectorCapabilities(provider);
  return {
    limit: normalizeFiniteInteger(input.limit, {
      fallback: capabilities.default_page_size,
      min: 1,
      max: capabilities.max_page_size,
    }),
    timeout_ms: normalizeFiniteInteger(input.timeout_ms, {
      fallback: DEFAULT_TIMEOUT_MS,
      min: MIN_TIMEOUT_MS,
      max: MAX_TIMEOUT_MS,
    }),
  };
}

export interface SyncConnectorListInput extends SyncConnectorRequestBoundsInput {
  cursor?: string | null;
  prefix?: string | null;
  signal?: AbortSignal;
}

export interface SyncConnectorFileRef {
  key: string;
  etag: string | null;
  updated_at: string | null;
  size_bytes: number | null;
}

export interface SyncConnectorListResult {
  provider: SyncConnectorProvider;
  files: SyncConnectorFileRef[];
  next_cursor: string | null;
}

export interface SyncConnectorReadInput {
  key: string;
  etag?: string | null;
  signal?: AbortSignal;
  timeout_ms?: number | null;
}

export interface SyncConnectorReadResult {
  provider: SyncConnectorProvider;
  key: string;
  etag: string | null;
  not_modified: boolean;
  content: string | null;
  updated_at: string | null;
}

export interface SyncConnectorWriteInput {
  key: string;
  content: string;
  if_match_etag?: string | null;
  signal?: AbortSignal;
  timeout_ms?: number | null;
}

export interface SyncConnectorWriteResult {
  provider: SyncConnectorProvider;
  key: string;
  etag: string | null;
  updated_at: string | null;
}

export interface SyncConnectorRemoveInput {
  key: string;
  if_match_etag?: string | null;
  signal?: AbortSignal;
  timeout_ms?: number | null;
}

export interface SyncConnectorRemoveResult {
  provider: SyncConnectorProvider;
  key: string;
  removed: boolean;
}

export type SyncConnectorErrorCode =
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "not_found"
  | "conflict"
  | "invalid_request"
  | "unavailable"
  | "unknown";

export interface SyncConnectorError {
  provider: SyncConnectorProvider;
  code: SyncConnectorErrorCode;
  message: string;
  retry_after_ms: number | null;
  status: number | null;
  details: Record<string, unknown> | null;
}

interface SyncConnectorErrorLike {
  code?: unknown;
  message?: unknown;
  retry_after_ms?: unknown;
  status?: unknown;
  details?: unknown;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function asNullableFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asSyncConnectorErrorCode(value: unknown): SyncConnectorErrorCode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const supported: SyncConnectorErrorCode[] = [
    "unauthorized",
    "forbidden",
    "rate_limited",
    "not_found",
    "conflict",
    "invalid_request",
    "unavailable",
    "unknown",
  ];
  if (supported.includes(normalized as SyncConnectorErrorCode)) {
    return normalized as SyncConnectorErrorCode;
  }
  return null;
}

export function createSyncConnectorError(
  input: SyncConnectorError,
): SyncConnectorError {
  const code = asSyncConnectorErrorCode(input.code) ?? "unknown";
  const message = asNullableString(input.message) ?? "Connector request failed.";
  const retryAfterMs = asNullableFiniteNumber(input.retry_after_ms);
  const status = asNullableFiniteNumber(input.status);
  return {
    provider: input.provider,
    code,
    message,
    retry_after_ms: retryAfterMs,
    status,
    details: asObject(input.details),
  };
}

export function normalizeSyncConnectorError(
  provider: SyncConnectorProvider,
  error: unknown,
): SyncConnectorError {
  if (error instanceof Error) {
    return createSyncConnectorError({
      provider,
      code: "unknown",
      message: error.message,
      retry_after_ms: null,
      status: null,
      details: null,
    });
  }

  const objectValue = asObject(error) as SyncConnectorErrorLike | null;
  if (!objectValue) {
    return createSyncConnectorError({
      provider,
      code: "unknown",
      message: "Connector request failed.",
      retry_after_ms: null,
      status: null,
      details: null,
    });
  }

  return createSyncConnectorError({
    provider,
    code: asSyncConnectorErrorCode(objectValue.code) ?? "unknown",
    message:
      asNullableString(objectValue.message) ?? "Connector request failed.",
    retry_after_ms: asNullableFiniteNumber(objectValue.retry_after_ms),
    status: asNullableFiniteNumber(objectValue.status),
    details: asObject(objectValue.details),
  });
}

export interface SyncConnectorAdapter {
  readonly provider: SyncConnectorProvider;
  list(input?: SyncConnectorListInput): Promise<SyncConnectorListResult>;
  read(input: SyncConnectorReadInput): Promise<SyncConnectorReadResult>;
  write(input: SyncConnectorWriteInput): Promise<SyncConnectorWriteResult>;
  remove(input: SyncConnectorRemoveInput): Promise<SyncConnectorRemoveResult>;
}
