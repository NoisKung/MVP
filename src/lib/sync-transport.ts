import { parseSyncApiError } from "./sync-contract";
import type { SyncTransport } from "./sync-runner";

const DEFAULT_SYNC_TIMEOUT_MS = 15_000;

interface HttpTransportOptions {
  pushUrl: string;
  pullUrl: string;
  timeoutMs?: number;
}

interface SyncTransportConfigOptions {
  pushUrl: string | null | undefined;
  pullUrl: string | null | undefined;
  timeoutMs?: number;
}

function normalizeEndpoint(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unexpected sync transport error.";
}

async function parseJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Sync server returned invalid JSON.");
  }
}

async function postJsonWithTimeout(input: {
  url: string;
  payload: unknown;
  timeoutMs: number;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeoutHandle = window.setTimeout(() => {
    controller.abort();
  }, input.timeoutMs);

  try {
    const response = await fetch(input.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input.payload),
      signal: controller.signal,
    });

    const payload = await parseJsonPayload(response);
    if (response.ok) {
      return payload;
    }

    const parsedError = parseSyncApiError(payload);
    throw new Error(`[${parsedError.code}] ${parsedError.message}`);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Sync request timed out.");
    }
    throw new Error(getErrorMessage(error));
  } finally {
    window.clearTimeout(timeoutHandle);
  }
}

export function createHttpSyncTransport(
  options: HttpTransportOptions,
): SyncTransport {
  const pushUrl = normalizeEndpoint(options.pushUrl);
  const pullUrl = normalizeEndpoint(options.pullUrl);
  if (!pushUrl || !pullUrl) {
    throw new Error("Both pushUrl and pullUrl are required.");
  }

  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? Math.max(1_000, Math.floor(options.timeoutMs))
      : DEFAULT_SYNC_TIMEOUT_MS;

  return {
    push: async (payload: unknown) =>
      postJsonWithTimeout({
        url: pushUrl,
        payload,
        timeoutMs,
      }),
    pull: async (payload: unknown) =>
      postJsonWithTimeout({
        url: pullUrl,
        payload,
        timeoutMs,
      }),
  };
}

export function createSyncTransportFromConfig(
  options: SyncTransportConfigOptions,
): SyncTransport | null {
  const pushUrl = normalizeEndpoint(options.pushUrl);
  const pullUrl = normalizeEndpoint(options.pullUrl);
  if (!pushUrl || !pullUrl) {
    return null;
  }
  return createHttpSyncTransport({
    pushUrl,
    pullUrl,
    timeoutMs: options.timeoutMs,
  });
}
