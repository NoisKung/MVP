import {
  createHttpSyncTransport,
  createSyncTransportFromConfig,
  resolveSyncTransportConfig,
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
      "Sync request timed out.",
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
