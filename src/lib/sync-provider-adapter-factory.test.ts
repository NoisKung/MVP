import { describe, expect, it, vi } from "vitest";
import {
  createManagedSyncConnectorAdapterFromSettings,
  extractManagedConnectorDraftFromProviderConfig,
  mergeManagedConnectorDraftIntoProviderConfig,
  supportsManagedConnectorAdapter,
} from "@/lib/sync-provider-adapter-factory";

describe("sync-provider-adapter-factory", () => {
  it("detects providers that support managed connector adapters", () => {
    expect(supportsManagedConnectorAdapter("google_appdata")).toBe(true);
    expect(supportsManagedConnectorAdapter("onedrive_approot")).toBe(true);
    expect(supportsManagedConnectorAdapter("provider_neutral")).toBe(false);
    expect(supportsManagedConnectorAdapter("icloud_cloudkit")).toBe(false);
  });

  it("extracts managed connector draft from provider config", () => {
    expect(
      extractManagedConnectorDraftFromProviderConfig({
        managed_base_url: "https://connector.example.com",
        managed_auth: {
          access_token: "access-1",
          token_type: "Bearer",
          refresh_token: "refresh-1",
          token_refresh_url: "https://auth.example.com/token",
          expires_at: "2026-01-01T00:00:00.000Z",
          scope: "drive.file",
          client_id: "client-id",
          client_secret: "client-secret",
        },
      }),
    ).toEqual({
      base_url: "https://connector.example.com",
      access_token: "access-1",
      token_type: "Bearer",
      refresh_token: "refresh-1",
      token_refresh_url: "https://auth.example.com/token",
      expires_at: "2026-01-01T00:00:00.000Z",
      scope: "drive.file",
      client_id: "client-id",
      client_secret: "client-secret",
    });
  });

  it("merges managed connector draft into provider config", () => {
    const merged = mergeManagedConnectorDraftIntoProviderConfig({
      existingProviderConfig: {
        endpoint_mode: "managed",
      },
      draft: {
        base_url: "https://connector.example.com",
        access_token: "access-1",
        token_type: "Bearer",
        refresh_token: "refresh-1",
        token_refresh_url: "https://auth.example.com/token",
        expires_at: "2026-01-01T00:00:00.000Z",
        scope: "drive.file",
        client_id: "client-id",
        client_secret: "client-secret",
      },
    });

    expect(merged).toMatchObject({
      endpoint_mode: "managed",
      managed_base_url: "https://connector.example.com",
      managed_auth: {
        access_token: "access-1",
        token_type: "Bearer",
        refresh_token: "refresh-1",
        expires_at: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("creates connector adapter from managed settings and calls list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          files: [],
          next_cursor: null,
        }),
        { status: 200 },
      ),
    );

    const adapter = createManagedSyncConnectorAdapterFromSettings({
      provider: "google_appdata",
      providerConfig: {
        managed_base_url: "https://connector.example.com",
        managed_auth: {
          access_token: "access-1",
          token_type: "Bearer",
        },
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(adapter).toBeTruthy();
    const result = await adapter!.list({ limit: 10 });
    expect(result.provider).toBe("google_appdata");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when provider does not support managed connector adapters", () => {
    const adapter = createManagedSyncConnectorAdapterFromSettings({
      provider: "provider_neutral",
      providerConfig: {
        managed_base_url: "https://connector.example.com",
      },
    });
    expect(adapter).toBeNull();
  });
});
