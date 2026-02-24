import type { SyncProvider } from "@/lib/types";
import {
  parseSyncProviderAuthState,
  type SyncProviderAuthState,
} from "@/lib/sync-provider-auth";

const TAURI_GET_AUTH_COMMAND = "get_sync_provider_secure_auth";
const TAURI_SET_AUTH_COMMAND = "set_sync_provider_secure_auth";
const TAURI_DELETE_AUTH_COMMAND = "delete_sync_provider_secure_auth";

type TauriInvoke = <T = unknown>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

async function resolveTauriInvoke(): Promise<TauriInvoke | null> {
  if (typeof window === "undefined") return null;

  try {
    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (!isTauri()) return null;
    return invoke as TauriInvoke;
  } catch {
    return null;
  }
}

function normalizeAuthPayload(
  value: unknown,
): SyncProviderAuthState | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseSyncProviderAuthState(parsed, {
        allowMissingAccessToken: true,
      });
    } catch {
      return null;
    }
  }

  return parseSyncProviderAuthState(value, {
    allowMissingAccessToken: true,
  });
}

export async function readSyncProviderSecureAuth(
  provider: SyncProvider,
): Promise<SyncProviderAuthState | null> {
  const invoke = await resolveTauriInvoke();
  if (!invoke) return null;

  try {
    const payload = await invoke<unknown>(TAURI_GET_AUTH_COMMAND, {
      provider,
    });
    const normalizedPayload = asNullableString(payload) ?? payload;
    return normalizeAuthPayload(normalizedPayload);
  } catch {
    return null;
  }
}

export async function writeSyncProviderSecureAuth(input: {
  provider: SyncProvider;
  auth: SyncProviderAuthState | null | undefined;
}): Promise<void> {
  const invoke = await resolveTauriInvoke();
  if (!invoke) return;

  const normalizedAuth = parseSyncProviderAuthState(input.auth, {
    allowMissingAccessToken: true,
  });

  try {
    if (!normalizedAuth) {
      await invoke(TAURI_DELETE_AUTH_COMMAND, {
        provider: input.provider,
      });
      return;
    }

    await invoke(TAURI_SET_AUTH_COMMAND, {
      provider: input.provider,
      auth: JSON.stringify(normalizedAuth),
    });
  } catch {
    // Best-effort secure storage only. Runtime in-memory auth remains available.
  }
}
