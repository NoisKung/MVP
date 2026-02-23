import { describe, expect, it, vi } from "vitest";
import {
  buildSyncProviderAuthorizationHeader,
  canRefreshSyncProviderAccessToken,
  isSyncProviderAccessTokenExpired,
  parseSyncProviderAuthState,
  refreshSyncProviderAccessToken,
} from "@/lib/sync-provider-auth";

describe("sync-provider-auth", () => {
  it("parses provider auth state with safe defaults", () => {
    expect(
      parseSyncProviderAuthState({
        access_token: "token-1",
        refresh_token: "refresh-1",
        token_refresh_url: "https://auth.example.com/token",
      }),
    ).toEqual({
      access_token: "token-1",
      token_type: "Bearer",
      refresh_token: "refresh-1",
      token_refresh_url: "https://auth.example.com/token",
      expires_at: null,
      scope: null,
      client_id: null,
      client_secret: null,
    });
  });

  it("detects refresh capability and token expiry with skew", () => {
    const auth = parseSyncProviderAuthState({
      access_token: "token-1",
      refresh_token: "refresh-1",
      token_refresh_url: "https://auth.example.com/token",
      expires_at: "2026-02-23T12:00:00.000Z",
    });

    expect(auth).toBeTruthy();
    expect(canRefreshSyncProviderAccessToken(auth!)).toBe(true);
    expect(
      isSyncProviderAccessTokenExpired(
        auth!,
        Date.parse("2026-02-23T11:59:40.000Z"),
      ),
    ).toBe(true);
    expect(
      isSyncProviderAccessTokenExpired(
        auth!,
        Date.parse("2026-02-23T11:58:00.000Z"),
      ),
    ).toBe(false);
  });

  it("builds authorization header when token is present", () => {
    const auth = parseSyncProviderAuthState({
      access_token: "token-1",
      token_type: "Bearer",
    });

    expect(buildSyncProviderAuthorizationHeader(auth!)).toBe(
      "Bearer token-1",
    );
  });

  it("refreshes provider token and keeps fallback fields", async () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.parse("2026-02-23T12:00:00.000Z"));

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "token-2",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh-2",
        }),
        { status: 200 },
      ),
    );

    const auth = parseSyncProviderAuthState({
      access_token: "token-1",
      refresh_token: "refresh-1",
      token_refresh_url: "https://auth.example.com/token",
      scope: "drive.file",
      client_id: "client-id",
    });

    const refreshed = await refreshSyncProviderAccessToken({
      provider: "google_appdata",
      auth: auth!,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.method).toBe("POST");
    expect(String(requestInit.body)).toContain("grant_type=refresh_token");
    expect(refreshed.access_token).toBe("token-2");
    expect(refreshed.refresh_token).toBe("refresh-2");
    expect(refreshed.scope).toBe("drive.file");
    expect(refreshed.client_id).toBe("client-id");
    expect(refreshed.expires_at).toBe("2026-02-23T13:00:00.000Z");

    nowSpy.mockRestore();
  });

  it("throws when refresh prerequisites are missing", async () => {
    const auth = parseSyncProviderAuthState(
      {
        access_token: "token-1",
      },
      { allowMissingAccessToken: true },
    );
    await expect(
      refreshSyncProviderAccessToken({
        provider: "onedrive_approot",
        auth: auth!,
      }),
    ).rejects.toThrow("token_refresh_url is required");
  });
});
