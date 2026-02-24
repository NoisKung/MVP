import type { SyncProvider } from "@/lib/types";
import {
  parseSyncProviderAuthState,
  type SyncProviderAuthState,
} from "@/lib/sync-provider-auth";

const TAURI_GET_AUTH_COMMAND = "get_sync_provider_secure_auth";
const TAURI_SET_AUTH_COMMAND = "set_sync_provider_secure_auth";
const TAURI_DELETE_AUTH_COMMAND = "delete_sync_provider_secure_auth";
const TAURI_SELF_TEST_COMMAND = "run_sync_provider_secure_store_self_test";

type TauriInvoke = <T = unknown>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

export interface SyncProviderSecureStoreSelfTestResult {
  runtime: "tauri" | "non_tauri";
  backend: string;
  available: boolean;
  write_ok: boolean;
  read_ok: boolean;
  delete_ok: boolean;
  roundtrip_ok: boolean;
  detail: string | null;
}

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

function normalizeAuthPayload(value: unknown): SyncProviderAuthState | null {
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

function asBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeSelfTestResult(
  value: unknown,
): SyncProviderSecureStoreSelfTestResult {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const runtime =
    source.runtime === "tauri" || source.runtime === "non_tauri"
      ? source.runtime
      : "tauri";
  const backend = asNullableString(source.backend) ?? "unknown";
  const detail = asNullableString(source.detail);
  const available = asBoolean(source.available);
  const writeOk = asBoolean(source.write_ok);
  const readOk = asBoolean(source.read_ok);
  const deleteOk = asBoolean(source.delete_ok);
  const roundtripOk =
    asBoolean(source.roundtrip_ok) ||
    (available && writeOk && readOk && deleteOk);

  return {
    runtime,
    backend,
    available,
    write_ok: writeOk,
    read_ok: readOk,
    delete_ok: deleteOk,
    roundtrip_ok: roundtripOk,
    detail,
  };
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

export async function runSyncProviderSecureStoreSelfTest(): Promise<SyncProviderSecureStoreSelfTestResult> {
  const invoke = await resolveTauriInvoke();
  if (!invoke) {
    return {
      runtime: "non_tauri",
      backend: "unsupported",
      available: false,
      write_ok: false,
      read_ok: false,
      delete_ok: false,
      roundtrip_ok: false,
      detail: "tauri runtime is not available",
    };
  }

  try {
    const payload = await invoke<unknown>(TAURI_SELF_TEST_COMMAND);
    return normalizeSelfTestResult(payload);
  } catch (error) {
    return {
      runtime: "tauri",
      backend: "unknown",
      available: false,
      write_ok: false,
      read_ok: false,
      delete_ok: false,
      roundtrip_ok: false,
      detail:
        error instanceof Error
          ? error.message
          : "secure store self-test command failed",
    };
  }
}
