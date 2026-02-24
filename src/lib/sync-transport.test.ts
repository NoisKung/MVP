import {
  createHttpSyncTransport,
  createSyncTransportFromConfig,
  resolveSyncTransportConfig,
  SYNC_TRANSPORT_ERROR_CODES,
} from "@/lib/sync-transport";

describe("sync-transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends JSON payloads to push and pull endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accepted: [],
            rejected: [],
            server_cursor: "cursor-1",
            server_time: "2026-02-17T00:00:00.000Z",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            server_cursor: "cursor-2",
            server_time: "2026-02-17T00:00:01.000Z",
            changes: [],
            has_more: false,
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const transport = createHttpSyncTransport({
      pushUrl: "https://sync.example.com/push",
      pullUrl: "https://sync.example.com/pull",
      timeoutMs: 10_000,
    });

    const pushPayload = { test: "push" };
    const pullPayload = { test: "pull" };
    await transport.push(pushPayload);
    await transport.pull(pullPayload);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://sync.example.com/push",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://sync.example.com/pull",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );

    const firstBody = (fetchMock.mock.calls[0][1] as RequestInit).body;
    const secondBody = (fetchMock.mock.calls[1][1] as RequestInit).body;
    expect(firstBody).toBe(JSON.stringify(pushPayload));
    expect(secondBody).toBe(JSON.stringify(pullPayload));
  });

  it("surfaces parsed sync API errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "VALIDATION_ERROR",
          message: "Invalid request",
        }),
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const transport = createHttpSyncTransport({
      pushUrl: "https://sync.example.com/push",
      pullUrl: "https://sync.example.com/pull",
    });

    await expect(transport.push({})).rejects.toThrow(
      "[VALIDATION_ERROR] Invalid request",
    );
  });

  it("fails with timeout when fetch aborts", async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const transport = createHttpSyncTransport({
      pushUrl: "https://sync.example.com/push",
      pullUrl: "https://sync.example.com/pull",
      timeoutMs: 10,
    });

    await expect(transport.push({ test: true })).rejects.toThrow(
      SYNC_TRANSPORT_ERROR_CODES.TIMEOUT,
    );
  });

  it("returns null when sync config is incomplete", () => {
    expect(
      createSyncTransportFromConfig({
        pushUrl: "https://sync.example.com/v1/sync/push",
        pullUrl: null,
      }),
    ).toBeNull();
    expect(
      createSyncTransportFromConfig({
        pushUrl: null,
        pullUrl: "https://sync.example.com/v1/sync/pull",
      }),
    ).toBeNull();
  });

  it("resolves provider transport as ready when config is valid", () => {
    const resolved = resolveSyncTransportConfig({
      provider: "provider_neutral",
      pushUrl: "https://sync.example.com/v1/sync/push",
      pullUrl: "https://sync.example.com/v1/sync/pull",
    });

    expect(resolved.status).toBe("ready");
    expect(resolved.transport).toBeTruthy();
    expect(resolved.warning).toBeNull();
  });

  it("returns invalid_config when endpoint pair is incomplete", () => {
    const resolved = resolveSyncTransportConfig({
      provider: "provider_neutral",
      pushUrl: "https://sync.example.com/v1/sync/push",
      pullUrl: null,
    });

    expect(resolved.status).toBe("invalid_config");
    expect(resolved.transport).toBeNull();
    expect(resolved.warning).toContain("Push and Pull URLs");
  });

  it("returns provider_unavailable for managed provider without endpoints", () => {
    const resolved = resolveSyncTransportConfig({
      provider: "google_appdata",
      pushUrl: null,
      pullUrl: null,
    });

    expect(resolved.status).toBe("provider_unavailable");
    expect(resolved.transport).toBeNull();
    expect(resolved.warning).toContain("connector is not configured");
  });

  it("resolves managed provider as ready via connector settings and executes push/pull RPC", async () => {
    const pushResponsePayload = {
      accepted: [],
      rejected: [],
      server_cursor: "cursor-1",
      server_time: "2026-02-23T00:00:00.000Z",
    };
    const pullResponsePayload = {
      server_cursor: "cursor-2",
      server_time: "2026-02-23T00:00:01.000Z",
      changes: [],
      has_more: false,
    };

    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string | URL, init?: RequestInit) => {
        const method = (init?.method ?? "GET").toUpperCase();
        const href = typeof url === "string" ? url : url.toString();

        if (method === "PUT") {
          return new Response(
            JSON.stringify({
              etag: "request-etag",
            }),
            { status: 200 },
          );
        }

        if (method === "GET") {
          const rawKey = href.split("/google/appdata/files/")[1] ?? "";
          const decodedKey = decodeURIComponent(rawKey);
          if (decodedKey.includes("/responses/push-")) {
            return new Response(
              JSON.stringify({
                content: JSON.stringify(pushResponsePayload),
                etag: "response-push",
              }),
              { status: 200 },
            );
          }
          if (decodedKey.includes("/responses/pull-")) {
            return new Response(
              JSON.stringify({
                content: JSON.stringify(pullResponsePayload),
                etag: "response-pull",
              }),
              { status: 200 },
            );
          }
        }

        if (method === "DELETE") {
          return new Response("", { status: 204 });
        }

        return new Response(
          JSON.stringify({
            message: "unexpected request",
          }),
          { status: 500 },
        );
      });
    vi.stubGlobal("fetch", fetchMock);

    const resolved = resolveSyncTransportConfig({
      provider: "google_appdata",
      providerConfig: {
        managed_base_url: "https://connector.example.com",
        managed_auth: {
          access_token: "access-1",
          token_type: "Bearer",
        },
      },
      pushUrl: null,
      pullUrl: null,
    });

    expect(resolved.status).toBe("ready");
    expect(resolved.transport).toBeTruthy();

    const pushResult = await resolved.transport!.push({ test: "push" });
    const pullResult = await resolved.transport!.pull({ test: "pull" });
    expect(pushResult).toEqual(pushResponsePayload);
    expect(pullResult).toEqual(pullResponsePayload);

    const writeCalls = fetchMock.mock.calls.filter(
      ([, init]) =>
        ((init as RequestInit | undefined)?.method ?? "GET") === "PUT",
    );
    expect(writeCalls.length).toBeGreaterThanOrEqual(2);
    const firstWriteHeaders = writeCalls[0][1] as RequestInit;
    expect(firstWriteHeaders.headers).toBeInstanceOf(Headers);
    expect((firstWriteHeaders.headers as Headers).get("authorization")).toBe(
      "Bearer access-1",
    );
  });

  it("returns provider_unavailable when managed provider is flagged unavailable", () => {
    const resolved = resolveSyncTransportConfig({
      provider: "onedrive_approot",
      pushUrl: "https://sync.example.com/v1/sync/push",
      pullUrl: "https://sync.example.com/v1/sync/pull",
      providerConfig: {
        managed_available: false,
      },
    });

    expect(resolved.status).toBe("provider_unavailable");
    expect(resolved.transport).toBeNull();
    expect(resolved.warning).toContain("unavailable");
  });
});
