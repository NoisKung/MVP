import {
  parseSyncProviderAuthState,
  type SyncProviderAuthState,
} from "@/lib/sync-provider-auth";
import type { SyncProvider } from "@/lib/types";

export type SyncProviderTokenStoragePolicy =
  | "desktop_secure_keystore"
  | "mobile_secure_keystore"
  | "browser_secure_keystore"
  | "desktop_session_only"
  | "mobile_session_only"
  | "browser_session_only";

interface SanitizeSyncProviderConfigResult {
  provider_config: Record<string, unknown> | null;
  session_auth: SyncProviderAuthState | null;
  redacted: boolean;
  storage_policy: SyncProviderTokenStoragePolicy | null;
}

const LEGACY_MANAGED_AUTH_KEYS = [
  "managed_access_token",
  "managed_token_type",
  "managed_refresh_token",
  "managed_token_refresh_url",
  "managed_expires_at",
  "managed_scope",
  "managed_client_id",
  "managed_client_secret",
] as const;

const syncProviderSessionAuthStore = new Map<
  SyncProvider,
  SyncProviderAuthState
>();

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

function isLikelyMobileUserAgent(value: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(value);
}

function hasTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

function normalizeAuthState(
  value: SyncProviderAuthState | null | undefined,
): SyncProviderAuthState | null {
  if (!value) return null;
  const normalized = parseSyncProviderAuthState(value, {
    allowMissingAccessToken: true,
  });
  return normalized;
}

function hasAnyManagedAuthSignal(
  value: Record<string, unknown> | null | undefined,
): boolean {
  if (!value) return false;
  const candidateKeys: Array<keyof SyncProviderAuthState> = [
    "access_token",
    "token_type",
    "refresh_token",
    "token_refresh_url",
    "expires_at",
    "scope",
    "client_id",
    "client_secret",
  ];
  return candidateKeys.some((key) => asNullableString(value[key]) !== null);
}

function pickPreferredString(
  primary: unknown,
  fallback: unknown,
): string | null {
  const first = asNullableString(primary);
  if (first) return first;
  return asNullableString(fallback);
}

function mergeManagedAuthStates(
  primary: SyncProviderAuthState | null,
  fallback: SyncProviderAuthState | null,
): SyncProviderAuthState | null {
  if (!primary && !fallback) return null;
  return {
    access_token:
      pickPreferredString(primary?.access_token, fallback?.access_token) ?? "",
    token_type:
      pickPreferredString(primary?.token_type, fallback?.token_type) ??
      "Bearer",
    refresh_token: pickPreferredString(
      primary?.refresh_token,
      fallback?.refresh_token,
    ),
    token_refresh_url: pickPreferredString(
      primary?.token_refresh_url,
      fallback?.token_refresh_url,
    ),
    expires_at: pickPreferredString(primary?.expires_at, fallback?.expires_at),
    scope: pickPreferredString(primary?.scope, fallback?.scope),
    client_id: pickPreferredString(primary?.client_id, fallback?.client_id),
    client_secret: pickPreferredString(
      primary?.client_secret,
      fallback?.client_secret,
    ),
  };
}

function hasSensitiveManagedAuthFields(
  auth: SyncProviderAuthState | null | undefined,
): boolean {
  if (!auth) return false;
  return Boolean(
    asNullableString(auth.access_token) ||
    asNullableString(auth.refresh_token) ||
    asNullableString(auth.client_secret),
  );
}

function buildPersistedManagedAuth(
  auth: SyncProviderAuthState | null,
): Record<string, unknown> | null {
  if (!auth) return null;

  const persisted: Record<string, unknown> = {};
  const tokenType = asNullableString(auth.token_type);
  if (tokenType) persisted.token_type = tokenType;
  const refreshUrl = asNullableString(auth.token_refresh_url);
  if (refreshUrl) persisted.token_refresh_url = refreshUrl;
  const expiresAt = asNullableString(auth.expires_at);
  if (expiresAt) persisted.expires_at = expiresAt;
  const scope = asNullableString(auth.scope);
  if (scope) persisted.scope = scope;
  const clientId = asNullableString(auth.client_id);
  if (clientId) persisted.client_id = clientId;

  return Object.keys(persisted).length > 0 ? persisted : null;
}

function cloneAuthState(auth: SyncProviderAuthState): SyncProviderAuthState {
  return {
    access_token: auth.access_token,
    token_type: auth.token_type,
    refresh_token: auth.refresh_token,
    token_refresh_url: auth.token_refresh_url,
    expires_at: auth.expires_at,
    scope: auth.scope,
    client_id: auth.client_id,
    client_secret: auth.client_secret,
  };
}

export function detectSyncProviderTokenStoragePolicy(): SyncProviderTokenStoragePolicy {
  const tauriRuntimeAvailable = hasTauriRuntime();
  if (tauriRuntimeAvailable) {
    if (
      typeof navigator !== "undefined" &&
      navigator.userAgent &&
      isLikelyMobileUserAgent(navigator.userAgent)
    ) {
      return "mobile_secure_keystore";
    }
    return "desktop_secure_keystore";
  }

  if (typeof navigator !== "undefined" && navigator.userAgent) {
    if (isLikelyMobileUserAgent(navigator.userAgent)) {
      return "mobile_session_only";
    }
  }
  if (typeof window === "undefined") {
    return "desktop_secure_keystore";
  }
  return "browser_session_only";
}

export function sanitizeSyncProviderConfigForPersistence(
  value: unknown,
): SanitizeSyncProviderConfigResult {
  const source = asObject(value);
  if (!source) {
    return {
      provider_config: null,
      session_auth: null,
      redacted: false,
      storage_policy: null,
    };
  }

  const next: Record<string, unknown> = {
    ...source,
  };
  const nestedAuthInput = asObject(next.managed_auth);
  const nestedAuth =
    nestedAuthInput && hasAnyManagedAuthSignal(nestedAuthInput)
      ? normalizeAuthState(
          parseSyncProviderAuthState(nestedAuthInput, {
            allowMissingAccessToken: true,
          }),
        )
      : null;
  const legacyAuthInput: Record<string, unknown> = {
    access_token: next.managed_access_token,
    token_type: next.managed_token_type,
    refresh_token: next.managed_refresh_token,
    token_refresh_url: next.managed_token_refresh_url,
    expires_at: next.managed_expires_at,
    scope: next.managed_scope,
    client_id: next.managed_client_id,
    client_secret: next.managed_client_secret,
  };
  const legacyAuth = hasAnyManagedAuthSignal(legacyAuthInput)
    ? normalizeAuthState(
        parseSyncProviderAuthState(legacyAuthInput, {
          allowMissingAccessToken: true,
        }),
      )
    : null;

  const mergedAuth = mergeManagedAuthStates(nestedAuth, legacyAuth);
  const sessionAuth = hasSensitiveManagedAuthFields(mergedAuth)
    ? mergedAuth
    : null;
  const persistedManagedAuth = buildPersistedManagedAuth(mergedAuth);
  if (persistedManagedAuth) {
    next.managed_auth = persistedManagedAuth;
  } else {
    delete next.managed_auth;
  }

  for (const key of LEGACY_MANAGED_AUTH_KEYS) {
    delete next[key];
  }

  const hasManagedContext = Boolean(
    asNullableString(next.managed_base_url) ||
    asNullableString(next.connector_base_url) ||
    asNullableString(next.endpoint_mode) === "managed" ||
    persistedManagedAuth ||
    sessionAuth,
  );
  let storagePolicy: SyncProviderTokenStoragePolicy | null = null;
  if (hasManagedContext) {
    storagePolicy = detectSyncProviderTokenStoragePolicy();
    next.managed_auth_storage_policy = storagePolicy;
  } else {
    delete next.managed_auth_storage_policy;
  }

  return {
    provider_config: next,
    session_auth: sessionAuth,
    redacted: JSON.stringify(source) !== JSON.stringify(next),
    storage_policy: storagePolicy,
  };
}

export function hydrateSyncProviderConfigWithSessionAuth(input: {
  provider_config: Record<string, unknown> | null | undefined;
  session_auth: SyncProviderAuthState | null | undefined;
}): Record<string, unknown> | null {
  const providerConfig = asObject(input.provider_config);
  if (!providerConfig) return null;

  const sessionAuth = normalizeAuthState(input.session_auth);
  if (!sessionAuth || !hasSensitiveManagedAuthFields(sessionAuth)) {
    return {
      ...providerConfig,
    };
  }

  const existingAuth = normalizeAuthState(
    parseSyncProviderAuthState(providerConfig.managed_auth, {
      allowMissingAccessToken: true,
    }),
  );
  const mergedAuth = mergeManagedAuthStates(sessionAuth, existingAuth);
  const next: Record<string, unknown> = {
    ...providerConfig,
  };
  if (mergedAuth) {
    next.managed_auth = mergedAuth;
  }
  if (!asNullableString(next.managed_auth_storage_policy)) {
    next.managed_auth_storage_policy = detectSyncProviderTokenStoragePolicy();
  }
  return next;
}

export function getSyncProviderSessionAuth(
  provider: SyncProvider,
): SyncProviderAuthState | null {
  const value = syncProviderSessionAuthStore.get(provider);
  return value ? cloneAuthState(value) : null;
}

export function setSyncProviderSessionAuth(input: {
  provider: SyncProvider;
  auth: SyncProviderAuthState | null | undefined;
}): void {
  const normalized = normalizeAuthState(input.auth);
  if (!normalized || !hasSensitiveManagedAuthFields(normalized)) {
    syncProviderSessionAuthStore.delete(input.provider);
    return;
  }
  syncProviderSessionAuthStore.set(input.provider, cloneAuthState(normalized));
}

export function clearSyncProviderSessionAuthForTests(): void {
  syncProviderSessionAuthStore.clear();
}
