import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriCoreMock = vi.hoisted(() => ({
  isTauri: vi.fn<() => boolean>(),
  invoke:
    vi.fn<
      (command: string, args?: Record<string, unknown>) => Promise<unknown>
    >(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: tauriCoreMock.isTauri,
  invoke: tauriCoreMock.invoke,
}));

import {
  runSyncProviderSecureStoreSelfTest,
  readSyncProviderSecureAuth,
  writeSyncProviderSecureAuth,
} from "@/lib/sync-provider-secure-store";

describe("sync-provider-secure-store", () => {
  beforeEach(() => {
    tauriCoreMock.isTauri.mockReset();
    tauriCoreMock.invoke.mockReset();
    tauriCoreMock.isTauri.mockReturnValue(false);
  });

  it("returns null when runtime is not tauri", async () => {
    const auth = await readSyncProviderSecureAuth("google_appdata");
    expect(auth).toBeNull();
    expect(tauriCoreMock.invoke).not.toHaveBeenCalled();
  });

  it("reads secure auth via tauri command", async () => {
    tauriCoreMock.isTauri.mockReturnValue(true);
    tauriCoreMock.invoke.mockResolvedValueOnce(
      JSON.stringify({
        access_token: "access-1",
        token_type: "Bearer",
        refresh_token: "refresh-1",
      }),
    );

    const auth = await readSyncProviderSecureAuth("google_appdata");
    expect(tauriCoreMock.invoke).toHaveBeenCalledWith(
      "get_sync_provider_secure_auth",
      { provider: "google_appdata" },
    );
    expect(auth).toMatchObject({
      access_token: "access-1",
      refresh_token: "refresh-1",
    });
  });

  it("writes secure auth via tauri command", async () => {
    tauriCoreMock.isTauri.mockReturnValue(true);
    tauriCoreMock.invoke.mockResolvedValue(undefined);

    await writeSyncProviderSecureAuth({
      provider: "google_appdata",
      auth: {
        access_token: "access-1",
        token_type: "Bearer",
        refresh_token: "refresh-1",
        token_refresh_url: "https://auth.example.com/token",
        expires_at: null,
        scope: null,
        client_id: null,
        client_secret: "client-secret",
      },
    });

    expect(tauriCoreMock.invoke).toHaveBeenCalledTimes(1);
    expect(tauriCoreMock.invoke).toHaveBeenCalledWith(
      "set_sync_provider_secure_auth",
      expect.objectContaining({
        provider: "google_appdata",
      }),
    );
  });

  it("clears secure auth when auth payload is missing", async () => {
    tauriCoreMock.isTauri.mockReturnValue(true);
    tauriCoreMock.invoke.mockResolvedValue(undefined);

    await writeSyncProviderSecureAuth({
      provider: "google_appdata",
      auth: null,
    });

    expect(tauriCoreMock.invoke).toHaveBeenCalledWith(
      "delete_sync_provider_secure_auth",
      { provider: "google_appdata" },
    );
  });

  it("returns unavailable self-test result when runtime is not tauri", async () => {
    const result = await runSyncProviderSecureStoreSelfTest();

    expect(result).toMatchObject({
      runtime: "non_tauri",
      backend: "unsupported",
      available: false,
      roundtrip_ok: false,
    });
    expect(tauriCoreMock.invoke).not.toHaveBeenCalled();
  });

  it("runs secure store self-test via tauri command", async () => {
    tauriCoreMock.isTauri.mockReturnValue(true);
    tauriCoreMock.invoke.mockResolvedValueOnce({
      runtime: "tauri",
      backend: "keyring",
      available: true,
      write_ok: true,
      read_ok: true,
      delete_ok: true,
      roundtrip_ok: true,
      detail: null,
    });

    const result = await runSyncProviderSecureStoreSelfTest();

    expect(tauriCoreMock.invoke).toHaveBeenCalledWith(
      "run_sync_provider_secure_store_self_test",
    );
    expect(result).toMatchObject({
      runtime: "tauri",
      backend: "keyring",
      available: true,
      write_ok: true,
      read_ok: true,
      delete_ok: true,
      roundtrip_ok: true,
      detail: null,
    });
  });

  it("maps tauri self-test command failures to unavailable result", async () => {
    tauriCoreMock.isTauri.mockReturnValue(true);
    tauriCoreMock.invoke.mockRejectedValueOnce(
      new Error("secure store self-test failed"),
    );

    const result = await runSyncProviderSecureStoreSelfTest();

    expect(result.available).toBe(false);
    expect(result.roundtrip_ok).toBe(false);
    expect(result.detail).toContain("secure store self-test failed");
  });
});
