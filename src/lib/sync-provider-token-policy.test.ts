import { afterEach, describe, expect, it } from "vitest";
import {
  clearSyncProviderSessionAuthForTests,
  detectSyncProviderTokenStoragePolicy,
  getSyncProviderSessionAuth,
  hydrateSyncProviderConfigWithSessionAuth,
  sanitizeSyncProviderConfigForPersistence,
  setSyncProviderSessionAuth,
} from "@/lib/sync-provider-token-policy";

describe("sync-provider-token-policy", () => {
  const originalUserAgent =
    typeof navigator !== "undefined" ? navigator.userAgent : "";

  const setUserAgent = (value: string) => {
    if (typeof navigator === "undefined") return;
    Object.defineProperty(navigator, "userAgent", {
      value,
      configurable: true,
    });
  };

  afterEach(() => {
    clearSyncProviderSessionAuthForTests();
    if (typeof window !== "undefined") {
      delete (window as Record<string, unknown>).__TAURI_INTERNALS__;
    }
    setUserAgent(originalUserAgent);
  });

  it("redacts sensitive managed auth fields from persisted provider config", () => {
    const result = sanitizeSyncProviderConfigForPersistence({
      endpoint_mode: "managed",
      managed_base_url: "https://connector.example.com",
      managed_auth: {
        access_token: "access-1",
        token_type: "Bearer",
        refresh_token: "refresh-1",
        token_refresh_url: "https://auth.example.com/token",
        client_id: "client-id",
        client_secret: "client-secret",
      },
    });

    expect(result.redacted).toBe(true);
    expect(result.session_auth?.access_token).toBe("access-1");
    expect(result.session_auth?.refresh_token).toBe("refresh-1");
    expect(result.session_auth?.client_secret).toBe("client-secret");
    expect(result.provider_config).toMatchObject({
      endpoint_mode: "managed",
      managed_base_url: "https://connector.example.com",
      managed_auth: {
        token_type: "Bearer",
        token_refresh_url: "https://auth.example.com/token",
        client_id: "client-id",
      },
    });
    expect(result.provider_config?.managed_auth).not.toHaveProperty(
      "access_token",
    );
    expect(result.provider_config?.managed_auth).not.toHaveProperty(
      "refresh_token",
    );
    expect(result.provider_config?.managed_auth).not.toHaveProperty(
      "client_secret",
    );
    expect(result.provider_config).toHaveProperty(
      "managed_auth_storage_policy",
    );
  });

  it("hydrates provider config with session auth for runtime usage", () => {
    const hydrated = hydrateSyncProviderConfigWithSessionAuth({
      provider_config: {
        endpoint_mode: "managed",
        managed_auth: {
          token_type: "Bearer",
          token_refresh_url: "https://auth.example.com/token",
        },
      },
      session_auth: {
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

    expect(hydrated?.managed_auth).toMatchObject({
      access_token: "access-1",
      refresh_token: "refresh-1",
      client_secret: "client-secret",
      token_type: "Bearer",
      token_refresh_url: "https://auth.example.com/token",
    });
  });

  it("stores session auth in memory per provider", () => {
    setSyncProviderSessionAuth({
      provider: "google_appdata",
      auth: {
        access_token: "access-1",
        token_type: "Bearer",
        refresh_token: null,
        token_refresh_url: null,
        expires_at: null,
        scope: null,
        client_id: null,
        client_secret: null,
      },
    });

    const loaded = getSyncProviderSessionAuth("google_appdata");
    expect(loaded?.access_token).toBe("access-1");
    const oneDrive = getSyncProviderSessionAuth("onedrive_approot");
    expect(oneDrive).toBeNull();
  });

  it("detects mobile secure keystore policy for tauri mobile runtime", () => {
    if (typeof window === "undefined") return;
    (window as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile",
    );

    expect(detectSyncProviderTokenStoragePolicy()).toBe(
      "mobile_secure_keystore",
    );
  });

  it("detects mobile session policy for browser runtime", () => {
    if (typeof window === "undefined") return;
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile",
    );

    expect(detectSyncProviderTokenStoragePolicy()).toBe("mobile_session_only");
  });
});
