import { describe, expect, it, vi } from "vitest";
import {
  createGoogleAppDataConnectorAdapter,
  createOneDriveAppRootConnectorAdapter,
} from "@/lib/sync-provider-adapters";
import type { SyncProviderAuthState } from "@/lib/sync-provider-auth";

function createAuth(
  overrides: Partial<SyncProviderAuthState> = {},
): SyncProviderAuthState {
  return {
    access_token: "access-1",
    token_type: "Bearer",
    refresh_token: "refresh-1",
    token_refresh_url: "https://auth.example.com/token",
    expires_at: null,
    scope: null,
    client_id: null,
    client_secret: null,
    ...overrides,
  };
}

describe("sync-provider-adapters", () => {
  it("calls Google connector list endpoint with auth header and bounds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          files: [
            {
              key: "changes/a.json",
              etag: "etag-1",
              updated_at: "2026-02-23T00:00:00.000Z",
              size_bytes: 10,
            },
          ],
          next_cursor: "cursor-1",
        }),
        { status: 200 },
      ),
    );
    const adapter = createGoogleAppDataConnectorAdapter({
      base_url: "https://connector.example.com/",
      auth: createAuth(),
      fetch_impl: fetchMock as unknown as typeof fetch,
    });

    const result = await adapter.list({
      limit: 25,
      cursor: "cursor-0",
      prefix: "changes/",
    });

    expect(result).toEqual({
      provider: "google_appdata",
      files: [
        {
          key: "changes/a.json",
          etag: "etag-1",
          updated_at: "2026-02-23T00:00:00.000Z",
          size_bytes: 10,
        },
      ],
      next_cursor: "cursor-1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(parsedUrl.pathname).toBe("/google/appdata/files");
    expect(parsedUrl.searchParams.get("limit")).toBe("25");
    expect(parsedUrl.searchParams.get("cursor")).toBe("cursor-0");
    expect(parsedUrl.searchParams.get("prefix")).toBe("changes/");
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer access-1");
  });

  it("refreshes expired access token before OneDrive request and persists callback", async () => {
    const persistedAuthStates: SyncProviderAuthState[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-2",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [],
            next_cursor: null,
          }),
          { status: 200 },
        ),
      );

    const adapter = createOneDriveAppRootConnectorAdapter({
      base_url: "https://connector.example.com",
      auth: createAuth({
        access_token: "access-1",
        expires_at: "2020-01-01T00:00:00.000Z",
      }),
      fetch_impl: fetchMock as unknown as typeof fetch,
      on_auth_refresh: (nextAuth) => {
        persistedAuthStates.push(nextAuth);
      },
    });

    await adapter.list({
      limit: 10,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [refreshUrl, refreshInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(refreshUrl).toBe("https://auth.example.com/token");
    expect(refreshInit.method).toBe("POST");

    const [listUrl, listInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(new URL(listUrl).pathname).toBe("/onedrive/approot/files");
    const headers = listInit.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer access-2");
    expect(persistedAuthStates).toHaveLength(1);
    expect(persistedAuthStates[0]?.access_token).toBe("access-2");
  });

  it("maps rate-limited responses to connector error payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Too many requests",
        }),
        {
          status: 429,
          headers: {
            "retry-after": "2",
          },
        },
      ),
    );
    const adapter = createGoogleAppDataConnectorAdapter({
      base_url: "https://connector.example.com",
      auth: createAuth(),
      fetch_impl: fetchMock as unknown as typeof fetch,
    });

    await expect(adapter.list({ limit: 10 })).rejects.toMatchObject({
      provider: "google_appdata",
      code: "rate_limited",
      retry_after_ms: 2000,
      status: 429,
    });
  });

  it("retries once with refreshed token when connector returns 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "expired token",
          }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-2",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [],
            next_cursor: null,
          }),
          { status: 200 },
        ),
      );

    const adapter = createGoogleAppDataConnectorAdapter({
      base_url: "https://connector.example.com",
      auth: createAuth({
        access_token: "access-1",
      }),
      fetch_impl: fetchMock as unknown as typeof fetch,
    });

    const result = await adapter.list({
      limit: 10,
    });

    expect(result.files).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [retryUrl, retryInit] = fetchMock.mock.calls[2] as [
      string,
      RequestInit,
    ];
    expect(new URL(retryUrl).pathname).toBe("/google/appdata/files");
    const retryHeaders = retryInit.headers as Headers;
    expect(retryHeaders.get("authorization")).toBe("Bearer access-2");
  });

  it("returns read result as not_modified on 304", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 304,
        headers: {
          etag: "etag-2",
          "last-modified": "2026-02-23T00:00:00.000Z",
        },
      }),
    );
    const adapter = createGoogleAppDataConnectorAdapter({
      base_url: "https://connector.example.com",
      auth: createAuth(),
      fetch_impl: fetchMock as unknown as typeof fetch,
    });

    const result = await adapter.read({
      key: "changes/a.json",
      etag: "etag-1",
    });

    expect(result).toEqual({
      provider: "google_appdata",
      key: "changes/a.json",
      etag: "etag-2",
      not_modified: true,
      content: null,
      updated_at: "2026-02-23T00:00:00.000Z",
    });
  });
});
