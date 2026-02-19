import { parseSyncApiError } from "./sync-contract";
import type { SyncTransport } from "./sync-runner";
import type { SyncProvider } from "./types";

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

export type ResolvedSyncTransportStatus =
  | "ready"
  | "disabled"
  | "invalid_config"
  | "provider_unavailable";

export interface ResolveSyncTransportInput extends SyncTransportConfigOptions {
  provider: SyncProvider;
  providerConfig?: Record<string, unknown> | null;
}

export interface ResolvedSyncTransportConfig {
  status: ResolvedSyncTransportStatus;
  provider: SyncProvider;
  transport: SyncTransport | null;
  warning: string | null;
}

function normalizeEndpoint(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function isManagedSyncProvider(provider: SyncProvider): boolean {
  return provider !== "provider_neutral";
}

function isManagedProviderAvailable(
  providerConfig: Record<string, unknown> | null | undefined,
): boolean {
  if (!providerConfig || typeof providerConfig !== "object") return true;
  const availabilityValue = providerConfig.managed_available;
  if (typeof availabilityValue === "boolean") {
    return availabilityValue;
  }
  return true;
}

function getProviderLabel(provider: SyncProvider): string {
  if (provider === "google_appdata") return "Google AppData";
  if (provider === "onedrive_approot") return "OneDrive AppRoot";
  if (provider === "icloud_cloudkit") return "iCloud CloudKit";
  if (provider === "solostack_cloud_aws") return "SoloStack Cloud (AWS)";
  return "Provider neutral";
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
  if (!isValidHttpUrl(pushUrl) || !isValidHttpUrl(pullUrl)) {
    return null;
  }
  return createHttpSyncTransport({
    pushUrl,
    pullUrl,
    timeoutMs: options.timeoutMs,
  });
}

export function resolveSyncTransportConfig(
  input: ResolveSyncTransportInput,
): ResolvedSyncTransportConfig {
  const pushUrl = normalizeEndpoint(input.pushUrl);
  const pullUrl = normalizeEndpoint(input.pullUrl);
  const hasPushUrl = Boolean(pushUrl);
  const hasPullUrl = Boolean(pullUrl);
  const hasAnyEndpoint = hasPushUrl || hasPullUrl;
  const providerManaged = isManagedSyncProvider(input.provider);
  const providerAvailable = providerManaged
    ? isManagedProviderAvailable(input.providerConfig)
    : true;
  const providerLabel = getProviderLabel(input.provider);

  if (!providerAvailable) {
    return {
      status: "provider_unavailable",
      provider: input.provider,
      transport: null,
      warning: `${providerLabel} is unavailable on this device/account. Sync switched to offline-safe mode.`,
    };
  }

  if (!hasAnyEndpoint) {
    if (providerManaged) {
      return {
        status: "provider_unavailable",
        provider: input.provider,
        transport: null,
        warning: `${providerLabel} connector is not configured yet. Add endpoints or switch provider.`,
      };
    }
    return {
      status: "disabled",
      provider: input.provider,
      transport: null,
      warning: null,
    };
  }

  if (!hasPushUrl || !hasPullUrl) {
    return {
      status: "invalid_config",
      provider: input.provider,
      transport: null,
      warning: "Push and Pull URLs must both be set.",
    };
  }

  const resolvedPushUrl = pushUrl as string;
  const resolvedPullUrl = pullUrl as string;

  if (!isValidHttpUrl(resolvedPushUrl) || !isValidHttpUrl(resolvedPullUrl)) {
    return {
      status: "invalid_config",
      provider: input.provider,
      transport: null,
      warning: "Push/Pull URLs must be valid http(s) URLs.",
    };
  }

  return {
    status: "ready",
    provider: input.provider,
    transport: createHttpSyncTransport({
      pushUrl: resolvedPushUrl,
      pullUrl: resolvedPullUrl,
      timeoutMs: input.timeoutMs,
    }),
    warning: null,
  };
}
