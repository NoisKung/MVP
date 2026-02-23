import {
  createSyncConnectorError,
  normalizeSyncConnectorRequestBounds,
  type SyncConnectorAdapter,
  type SyncConnectorErrorCode,
  type SyncConnectorFileRef,
  type SyncConnectorListInput,
  type SyncConnectorListResult,
  type SyncConnectorProvider,
  type SyncConnectorReadInput,
  type SyncConnectorReadResult,
  type SyncConnectorRemoveInput,
  type SyncConnectorRemoveResult,
  type SyncConnectorWriteInput,
  type SyncConnectorWriteResult,
} from "@/lib/sync-connector-contract";
import {
  buildSyncProviderAuthorizationHeader,
  canRefreshSyncProviderAccessToken,
  isSyncProviderAccessTokenExpired,
  refreshSyncProviderAccessToken,
  type SyncProviderAuthState,
} from "@/lib/sync-provider-auth";

const DEFAULT_CONNECTOR_TIMEOUT_MS = 15_000;

interface ConnectorJsonResponse {
  payload: Record<string, unknown> | null;
  raw_text: string | null;
}

interface ManagedSyncConnectorAdapterInput {
  provider: SyncConnectorProvider;
  base_url: string;
  auth?: SyncProviderAuthState | null;
  default_timeout_ms?: number;
  fetch_impl?: typeof fetch;
  on_auth_refresh?: (nextAuth: SyncProviderAuthState) => Promise<void> | void;
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isUnauthorizedConnectorError(error: unknown): boolean {
  const objectValue = asObject(error);
  if (!objectValue) return false;
  if (objectValue.code === "unauthorized") return true;
  if (objectValue.status === 401) return true;
  return false;
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Connector base_url is required.");
  }
  const parsed = new URL(normalized);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Connector base_url must use http or https.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function normalizeConnectorTimeoutMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_CONNECTOR_TIMEOUT_MS;
  }
  return Math.max(1_000, Math.floor(value));
}

function parseRetryAfterMs(
  retryAfterHeader: string | null,
  details: Record<string, unknown> | null,
): number | null {
  if (retryAfterHeader) {
    const seconds = Number.parseFloat(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.floor(seconds * 1_000);
    }
  }
  const retryAfterMs = asNullableFiniteNumber(details?.retry_after_ms);
  if (retryAfterMs === null) return null;
  return Math.max(0, Math.floor(retryAfterMs));
}

function mapHttpStatusToConnectorErrorCode(
  statusCode: number,
): SyncConnectorErrorCode {
  if (statusCode === 400) return "invalid_request";
  if (statusCode === 401) return "unauthorized";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 404) return "not_found";
  if (statusCode === 409) return "conflict";
  if (statusCode === 429) return "rate_limited";
  if (statusCode >= 500 && statusCode <= 599) return "unavailable";
  return "unknown";
}

function normalizeFileRef(value: unknown): SyncConnectorFileRef | null {
  const objectValue = asObject(value);
  if (!objectValue) return null;
  const key = asNullableString(objectValue.key);
  if (!key) return null;
  return {
    key,
    etag: asNullableString(objectValue.etag),
    updated_at: asNullableString(objectValue.updated_at),
    size_bytes: asNullableFiniteNumber(objectValue.size_bytes),
  };
}

async function parseConnectorJsonResponse(
  response: Response,
): Promise<ConnectorJsonResponse> {
  const text = await response.text();
  if (!text.trim()) {
    return {
      payload: null,
      raw_text: null,
    };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    return {
      payload: asObject(parsed),
      raw_text: text,
    };
  } catch {
    return {
      payload: null,
      raw_text: text,
    };
  }
}

interface ManagedConnectorRequestInput {
  method: "GET" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string>;
  if_match_etag?: string | null;
  if_none_match_etag?: string | null;
  body_json?: unknown;
  timeout_ms?: number | null;
  signal?: AbortSignal;
  allow_not_modified?: boolean;
}

class ManagedSyncConnectorAdapter implements SyncConnectorAdapter {
  readonly provider: SyncConnectorProvider;
  private readonly baseUrl: string;
  private readonly pathPrefix: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultTimeoutMs: number;
  private readonly onAuthRefresh:
    | ((nextAuth: SyncProviderAuthState) => Promise<void> | void)
    | null;
  private authState: SyncProviderAuthState | null;

  constructor(input: ManagedSyncConnectorAdapterInput) {
    this.provider = input.provider;
    this.baseUrl = normalizeBaseUrl(input.base_url);
    this.pathPrefix =
      input.provider === "google_appdata"
        ? "/google/appdata"
        : "/onedrive/approot";
    this.fetchImpl = input.fetch_impl ?? fetch;
    this.defaultTimeoutMs = normalizeConnectorTimeoutMs(
      input.default_timeout_ms,
    );
    this.authState = input.auth ?? null;
    this.onAuthRefresh = input.on_auth_refresh ?? null;
  }

  async list(
    input: SyncConnectorListInput = {},
  ): Promise<SyncConnectorListResult> {
    const bounds = normalizeSyncConnectorRequestBounds(this.provider, input);
    const query: Record<string, string> = {
      limit: String(bounds.limit),
    };
    if (input.cursor) query.cursor = input.cursor;
    if (input.prefix) query.prefix = input.prefix;

    const response = await this.request({
      method: "GET",
      path: "/files",
      query,
      timeout_ms: bounds.timeout_ms,
      signal: input.signal,
    });

    const filesRaw = Array.isArray(response.payload?.files)
      ? response.payload?.files
      : [];
    const files = filesRaw
      .map((entry) => normalizeFileRef(entry))
      .filter((entry): entry is SyncConnectorFileRef => Boolean(entry));

    return {
      provider: this.provider,
      files,
      next_cursor: asNullableString(response.payload?.next_cursor),
    };
  }

  async read(input: SyncConnectorReadInput): Promise<SyncConnectorReadResult> {
    const timeoutMs =
      typeof input.timeout_ms === "number" ? input.timeout_ms : null;
    const response = await this.request({
      method: "GET",
      path: `/files/${encodeURIComponent(input.key)}`,
      if_none_match_etag: input.etag ?? null,
      timeout_ms: timeoutMs,
      signal: input.signal,
      allow_not_modified: true,
    });

    if (response.status_code === 304) {
      return {
        provider: this.provider,
        key: input.key,
        etag: asNullableString(response.headers.get("etag")),
        not_modified: true,
        content: null,
        updated_at: asNullableString(response.headers.get("last-modified")),
      };
    }

    return {
      provider: this.provider,
      key: input.key,
      etag:
        asNullableString(response.payload?.etag) ??
        asNullableString(response.headers.get("etag")),
      not_modified: false,
      content: asNullableString(response.payload?.content),
      updated_at:
        asNullableString(response.payload?.updated_at) ??
        asNullableString(response.headers.get("last-modified")),
    };
  }

  async write(
    input: SyncConnectorWriteInput,
  ): Promise<SyncConnectorWriteResult> {
    const timeoutMs =
      typeof input.timeout_ms === "number" ? input.timeout_ms : null;
    const response = await this.request({
      method: "PUT",
      path: `/files/${encodeURIComponent(input.key)}`,
      if_match_etag: input.if_match_etag ?? null,
      body_json: {
        content: input.content,
      },
      timeout_ms: timeoutMs,
      signal: input.signal,
    });

    return {
      provider: this.provider,
      key: input.key,
      etag:
        asNullableString(response.payload?.etag) ??
        asNullableString(response.headers.get("etag")),
      updated_at:
        asNullableString(response.payload?.updated_at) ??
        asNullableString(response.headers.get("last-modified")),
    };
  }

  async remove(
    input: SyncConnectorRemoveInput,
  ): Promise<SyncConnectorRemoveResult> {
    const timeoutMs =
      typeof input.timeout_ms === "number" ? input.timeout_ms : null;
    const response = await this.request({
      method: "DELETE",
      path: `/files/${encodeURIComponent(input.key)}`,
      if_match_etag: input.if_match_etag ?? null,
      timeout_ms: timeoutMs,
      signal: input.signal,
    });

    return {
      provider: this.provider,
      key: input.key,
      removed:
        response.status_code === 204 ||
        response.payload?.removed === true ||
        response.ok,
    };
  }

  private async request(input: ManagedConnectorRequestInput): Promise<{
    ok: boolean;
    status_code: number;
    headers: Headers;
    payload: Record<string, unknown> | null;
  }> {
    const timeoutMs =
      typeof input.timeout_ms === "number" && Number.isFinite(input.timeout_ms)
        ? Math.max(1_000, Math.floor(input.timeout_ms))
        : this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutHandle = globalThis.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    if (input.signal) {
      if (input.signal.aborted) {
        globalThis.clearTimeout(timeoutHandle);
        throw createSyncConnectorError({
          provider: this.provider,
          code: "unavailable",
          message: `${this.provider} request aborted.`,
          retry_after_ms: null,
          status: null,
          details: null,
        });
      }
      input.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    try {
      return await this.requestWithAuthRetry(input, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw createSyncConnectorError({
          provider: this.provider,
          code: "unavailable",
          message: `${this.provider} connector request timed out after ${timeoutMs}ms.`,
          retry_after_ms: null,
          status: null,
          details: null,
        });
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeoutHandle);
    }
  }

  private async requestWithAuthRetry(
    input: ManagedConnectorRequestInput,
    signal: AbortSignal,
  ): Promise<{
    ok: boolean;
    status_code: number;
    headers: Headers;
    payload: Record<string, unknown> | null;
  }> {
    try {
      return await this.executeRequest(input, signal, false);
    } catch (error) {
      if (
        isUnauthorizedConnectorError(error) &&
        this.authState &&
        canRefreshSyncProviderAccessToken(this.authState)
      ) {
        await this.refreshAuthState(signal);
        return this.executeRequest(input, signal, true);
      }
      throw error;
    }
  }

  private async executeRequest(
    input: ManagedConnectorRequestInput,
    signal: AbortSignal,
    skipProactiveRefresh: boolean,
  ): Promise<{
    ok: boolean;
    status_code: number;
    headers: Headers;
    payload: Record<string, unknown> | null;
  }> {
    const authState = await this.ensureValidAuthState(
      skipProactiveRefresh,
      signal,
    );
    const authHeader = buildSyncProviderAuthorizationHeader(authState);
    if (!authHeader) {
      throw createSyncConnectorError({
        provider: this.provider,
        code: "unauthorized",
        message: `${this.provider} connector requires access token.`,
        retry_after_ms: null,
        status: 401,
        details: null,
      });
    }

    const url = new URL(`${this.pathPrefix}${input.path}`, this.baseUrl);
    if (input.query) {
      for (const [key, value] of Object.entries(input.query)) {
        url.searchParams.set(key, value);
      }
    }

    const headers = new Headers();
    headers.set("authorization", authHeader);
    if (input.if_match_etag) headers.set("if-match", input.if_match_etag);
    if (input.if_none_match_etag) {
      headers.set("if-none-match", input.if_none_match_etag);
    }
    if (typeof input.body_json !== "undefined") {
      headers.set("content-type", "application/json");
    }

    const response = await this.fetchImpl(url.toString(), {
      method: input.method,
      headers,
      body:
        typeof input.body_json !== "undefined"
          ? JSON.stringify(input.body_json)
          : undefined,
      signal,
    });

    if (response.status === 304 && input.allow_not_modified) {
      return {
        ok: true,
        status_code: 304,
        headers: response.headers,
        payload: null,
      };
    }

    const parsed = await parseConnectorJsonResponse(response);
    if (!response.ok) {
      throw createSyncConnectorError({
        provider: this.provider,
        code: mapHttpStatusToConnectorErrorCode(response.status),
        message:
          asNullableString(parsed.payload?.message) ??
          parsed.raw_text ??
          `${this.provider} connector request failed with status ${response.status}.`,
        retry_after_ms: parseRetryAfterMs(
          response.headers.get("retry-after"),
          parsed.payload,
        ),
        status: response.status,
        details: parsed.payload,
      });
    }

    return {
      ok: true,
      status_code: response.status,
      headers: response.headers,
      payload: parsed.payload,
    };
  }

  private async ensureValidAuthState(
    skipProactiveRefresh: boolean,
    signal: AbortSignal,
  ): Promise<SyncProviderAuthState> {
    if (!this.authState) {
      throw createSyncConnectorError({
        provider: this.provider,
        code: "unauthorized",
        message: `${this.provider} connector auth state is missing.`,
        retry_after_ms: null,
        status: 401,
        details: null,
      });
    }

    if (
      !skipProactiveRefresh &&
      isSyncProviderAccessTokenExpired(this.authState)
    ) {
      if (!canRefreshSyncProviderAccessToken(this.authState)) {
        throw createSyncConnectorError({
          provider: this.provider,
          code: "unauthorized",
          message: `${this.provider} connector access token expired and refresh flow is unavailable.`,
          retry_after_ms: null,
          status: 401,
          details: null,
        });
      }
      await this.refreshAuthState(signal);
    }

    return this.authState;
  }

  private async refreshAuthState(signal: AbortSignal): Promise<void> {
    if (!this.authState) {
      throw createSyncConnectorError({
        provider: this.provider,
        code: "unauthorized",
        message: `${this.provider} connector auth state is missing.`,
        retry_after_ms: null,
        status: 401,
        details: null,
      });
    }
    const refreshed = await refreshSyncProviderAccessToken({
      provider: this.provider,
      auth: this.authState,
      fetchImpl: this.fetchImpl,
      signal,
    });
    this.authState = refreshed;
    if (this.onAuthRefresh) {
      await Promise.resolve(this.onAuthRefresh(refreshed));
    }
  }
}

export function createManagedSyncConnectorAdapter(
  input: ManagedSyncConnectorAdapterInput,
): SyncConnectorAdapter {
  return new ManagedSyncConnectorAdapter(input);
}

export function createGoogleAppDataConnectorAdapter(
  input: Omit<ManagedSyncConnectorAdapterInput, "provider">,
): SyncConnectorAdapter {
  return new ManagedSyncConnectorAdapter({
    ...input,
    provider: "google_appdata",
  });
}

export function createOneDriveAppRootConnectorAdapter(
  input: Omit<ManagedSyncConnectorAdapterInput, "provider">,
): SyncConnectorAdapter {
  return new ManagedSyncConnectorAdapter({
    ...input,
    provider: "onedrive_approot",
  });
}
