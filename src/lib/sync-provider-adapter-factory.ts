import {
  createGoogleAppDataConnectorAdapter,
  createOneDriveAppRootConnectorAdapter,
} from "@/lib/sync-provider-adapters";
import {
  parseSyncProviderAuthState,
  type SyncProviderAuthState,
} from "@/lib/sync-provider-auth";
import type { SyncConnectorAdapter } from "@/lib/sync-connector-contract";
import type { SyncProvider } from "@/lib/types";

export interface SyncProviderManagedConnectorDraft {
  base_url: string;
  access_token: string;
  token_type: string;
  refresh_token: string;
  token_refresh_url: string;
  expires_at: string;
  scope: string;
  client_id: string;
  client_secret: string;
}

interface CreateManagedConnectorAdapterInput {
  provider: SyncProvider;
  providerConfig: Record<string, unknown> | null | undefined;
  fetchImpl?: typeof fetch;
  onAuthRefresh?: (nextAuth: SyncProviderAuthState) => Promise<void> | void;
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

function readManagedBaseUrl(
  providerConfig: Record<string, unknown> | null | undefined,
): string | null {
  if (!providerConfig) return null;
  const managedBaseUrl = asNullableString(providerConfig.managed_base_url);
  if (managedBaseUrl) return managedBaseUrl;
  return asNullableString(providerConfig.connector_base_url);
}

function readManagedAuthState(
  providerConfig: Record<string, unknown> | null | undefined,
): SyncProviderAuthState | null {
  if (!providerConfig) return null;
  const nestedAuth = parseSyncProviderAuthState(providerConfig.managed_auth, {
    allowMissingAccessToken: true,
  });
  if (nestedAuth) return nestedAuth;

  return parseSyncProviderAuthState(
    {
      access_token: providerConfig.managed_access_token,
      token_type: providerConfig.managed_token_type,
      refresh_token: providerConfig.managed_refresh_token,
      token_refresh_url: providerConfig.managed_token_refresh_url,
      expires_at: providerConfig.managed_expires_at,
      scope: providerConfig.managed_scope,
      client_id: providerConfig.managed_client_id,
      client_secret: providerConfig.managed_client_secret,
    },
    { allowMissingAccessToken: true },
  );
}

export function supportsManagedConnectorAdapter(
  provider: SyncProvider,
): boolean {
  return provider === "google_appdata" || provider === "onedrive_approot";
}

export function extractManagedConnectorDraftFromProviderConfig(
  providerConfig: Record<string, unknown> | null | undefined,
): SyncProviderManagedConnectorDraft {
  const baseUrl = readManagedBaseUrl(providerConfig) ?? "";
  const authState = readManagedAuthState(providerConfig);
  return {
    base_url: baseUrl,
    access_token: authState?.access_token ?? "",
    token_type: authState?.token_type ?? "Bearer",
    refresh_token: authState?.refresh_token ?? "",
    token_refresh_url: authState?.token_refresh_url ?? "",
    expires_at: authState?.expires_at ?? "",
    scope: authState?.scope ?? "",
    client_id: authState?.client_id ?? "",
    client_secret: authState?.client_secret ?? "",
  };
}

export function mergeManagedConnectorDraftIntoProviderConfig(input: {
  existingProviderConfig: Record<string, unknown> | null | undefined;
  draft: SyncProviderManagedConnectorDraft;
}): Record<string, unknown> {
  const existing = asObject(input.existingProviderConfig) ?? {};
  const next: Record<string, unknown> = {
    ...existing,
  };
  const baseUrl = asNullableString(input.draft.base_url);
  if (baseUrl) {
    next.managed_base_url = baseUrl;
  } else {
    delete next.managed_base_url;
  }

  const nestedAuth = parseSyncProviderAuthState(
    {
      access_token: input.draft.access_token,
      token_type: input.draft.token_type,
      refresh_token: input.draft.refresh_token,
      token_refresh_url: input.draft.token_refresh_url,
      expires_at: input.draft.expires_at,
      scope: input.draft.scope,
      client_id: input.draft.client_id,
      client_secret: input.draft.client_secret,
    },
    { allowMissingAccessToken: true },
  );

  const hasAuthPayload = Boolean(
    nestedAuth &&
    (nestedAuth.access_token ||
      nestedAuth.refresh_token ||
      nestedAuth.token_refresh_url ||
      nestedAuth.expires_at ||
      nestedAuth.client_id ||
      nestedAuth.client_secret),
  );
  if (hasAuthPayload && nestedAuth) {
    next.managed_auth = nestedAuth;
  } else {
    delete next.managed_auth;
  }

  return next;
}

export function createManagedSyncConnectorAdapterFromSettings(
  input: CreateManagedConnectorAdapterInput,
): SyncConnectorAdapter | null {
  if (!supportsManagedConnectorAdapter(input.provider)) {
    return null;
  }

  const baseUrl = readManagedBaseUrl(input.providerConfig);
  if (!baseUrl) return null;
  const auth = readManagedAuthState(input.providerConfig);

  if (input.provider === "google_appdata") {
    return createGoogleAppDataConnectorAdapter({
      base_url: baseUrl,
      auth,
      fetch_impl: input.fetchImpl,
      on_auth_refresh: input.onAuthRefresh,
    });
  }

  return createOneDriveAppRootConnectorAdapter({
    base_url: baseUrl,
    auth,
    fetch_impl: input.fetchImpl,
    on_auth_refresh: input.onAuthRefresh,
  });
}
