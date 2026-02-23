import type { SyncConnectorProvider } from "@/lib/sync-connector-contract";

const DEFAULT_TOKEN_TYPE = "Bearer";
const DEFAULT_REFRESH_TIMEOUT_MS = 15_000;
const REFRESH_EXPIRY_SKEW_MS = 30_000;

export interface SyncProviderAuthState {
  access_token: string;
  token_type: string;
  refresh_token: string | null;
  token_refresh_url: string | null;
  expires_at: string | null;
  scope: string | null;
  client_id: string | null;
  client_secret: string | null;
}

interface ParseSyncProviderAuthStateOptions {
  allowMissingAccessToken?: boolean;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function asOptionalPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  if (normalized <= 0) return null;
  return normalized;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toIsoFromExpiresInSeconds(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1_000).toISOString();
}

export function parseSyncProviderAuthState(
  value: unknown,
  options: ParseSyncProviderAuthStateOptions = {},
): SyncProviderAuthState | null {
  const objectValue = asObject(value);
  if (!objectValue) return null;

  const accessToken = asNullableString(objectValue.access_token);
  if (!options.allowMissingAccessToken && !accessToken) {
    return null;
  }

  return {
    access_token: accessToken ?? "",
    token_type: asNullableString(objectValue.token_type) ?? DEFAULT_TOKEN_TYPE,
    refresh_token: asNullableString(objectValue.refresh_token),
    token_refresh_url: asNullableString(objectValue.token_refresh_url),
    expires_at: asNullableString(objectValue.expires_at),
    scope: asNullableString(objectValue.scope),
    client_id: asNullableString(objectValue.client_id),
    client_secret: asNullableString(objectValue.client_secret),
  };
}

export function isSyncProviderAccessTokenExpired(
  auth: SyncProviderAuthState,
  nowMs = Date.now(),
  skewMs = REFRESH_EXPIRY_SKEW_MS,
): boolean {
  const expiresAt = asNullableString(auth.expires_at);
  if (!expiresAt) return false;
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return false;
  return nowMs + Math.max(0, skewMs) >= expiresAtMs;
}

export function canRefreshSyncProviderAccessToken(
  auth: SyncProviderAuthState,
): boolean {
  return Boolean(auth.refresh_token && auth.token_refresh_url);
}

export function buildSyncProviderAuthorizationHeader(
  auth: SyncProviderAuthState,
): string | null {
  const token = asNullableString(auth.access_token);
  if (!token) return null;
  const tokenType = asNullableString(auth.token_type) ?? DEFAULT_TOKEN_TYPE;
  return `${tokenType} ${token}`;
}

export interface RefreshSyncProviderAccessTokenInput {
  provider: SyncConnectorProvider;
  auth: SyncProviderAuthState;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface RefreshTokenSuccessPayload {
  access_token: unknown;
  token_type?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  error_description?: unknown;
  message?: unknown;
}

async function parseJsonObjectResponse(response: Response): Promise<{
  payload: Record<string, unknown> | null;
  rawText: string | null;
}> {
  const text = await response.text();
  if (!text.trim()) {
    return {
      payload: null,
      rawText: null,
    };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    return {
      payload: asObject(parsed),
      rawText: text,
    };
  } catch {
    return {
      payload: null,
      rawText: text,
    };
  }
}

export async function refreshSyncProviderAccessToken(
  input: RefreshSyncProviderAccessTokenInput,
): Promise<SyncProviderAuthState> {
  const refreshUrl = asNullableString(input.auth.token_refresh_url);
  if (!refreshUrl) {
    throw new Error(
      `[${input.provider}] token_refresh_url is required for refresh flow.`,
    );
  }

  const refreshToken = asNullableString(input.auth.refresh_token);
  if (!refreshToken) {
    throw new Error(
      `[${input.provider}] refresh_token is required for refresh flow.`,
    );
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs =
    typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs)
      ? Math.max(1_000, Math.floor(input.timeoutMs))
      : DEFAULT_REFRESH_TIMEOUT_MS;

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  if (input.auth.scope) body.set("scope", input.auth.scope);
  if (input.auth.client_id) body.set("client_id", input.auth.client_id);
  if (input.auth.client_secret) {
    body.set("client_secret", input.auth.client_secret);
  }

  const controller = new AbortController();
  const timeoutHandle = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  if (input.signal) {
    if (input.signal.aborted) {
      globalThis.clearTimeout(timeoutHandle);
      throw new DOMException("Aborted", "AbortError");
    }
    input.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    const response = await fetchImpl(refreshUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: controller.signal,
    });

    const parsed = await parseJsonObjectResponse(response);
    const payload = parsed.payload as RefreshTokenSuccessPayload | null;

    if (!response.ok) {
      const message =
        asNullableString(payload?.error_description) ??
        asNullableString(payload?.message) ??
        parsed.rawText ??
        `HTTP ${response.status}`;
      throw new Error(
        `[${input.provider}] token refresh failed (${response.status}): ${message}`,
      );
    }

    const accessToken = asNullableString(payload?.access_token);
    if (!accessToken) {
      throw new Error(
        `[${input.provider}] token refresh response did not include access_token.`,
      );
    }

    const expiresInSeconds = asOptionalPositiveInteger(payload?.expires_in);

    return {
      access_token: accessToken,
      token_type:
        asNullableString(payload?.token_type) ??
        asNullableString(input.auth.token_type) ??
        DEFAULT_TOKEN_TYPE,
      refresh_token:
        asNullableString(payload?.refresh_token) ??
        input.auth.refresh_token ??
        null,
      token_refresh_url: input.auth.token_refresh_url,
      expires_at: expiresInSeconds
        ? toIsoFromExpiresInSeconds(expiresInSeconds)
        : input.auth.expires_at,
      scope: asNullableString(payload?.scope) ?? input.auth.scope,
      client_id: input.auth.client_id,
      client_secret: input.auth.client_secret,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `[${input.provider}] token refresh timed out after ${timeoutMs}ms.`,
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutHandle);
  }
}
