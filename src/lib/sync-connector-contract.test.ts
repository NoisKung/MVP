import { describe, expect, it } from "vitest";
import {
  createSyncConnectorError,
  getSyncConnectorCapabilities,
  normalizeSyncConnectorError,
  normalizeSyncConnectorRequestBounds,
} from "@/lib/sync-connector-contract";

describe("sync-connector-contract", () => {
  it("exposes provider capabilities", () => {
    expect(getSyncConnectorCapabilities("google_appdata")).toEqual({
      supports_delta_cursor: false,
      supports_etag_conditional_write: true,
      default_page_size: 100,
      max_page_size: 1000,
    });
    expect(getSyncConnectorCapabilities("onedrive_approot")).toEqual({
      supports_delta_cursor: true,
      supports_etag_conditional_write: true,
      default_page_size: 200,
      max_page_size: 1000,
    });
  });

  it("normalizes request bounds by provider capability limits", () => {
    expect(
      normalizeSyncConnectorRequestBounds("google_appdata", {
        limit: 5_000,
        timeout_ms: 99,
      }),
    ).toEqual({
      limit: 1000,
      timeout_ms: 1000,
    });
    expect(
      normalizeSyncConnectorRequestBounds("onedrive_approot", {
        limit: -1,
        timeout_ms: 90_000,
      }),
    ).toEqual({
      limit: 1,
      timeout_ms: 60000,
    });
  });

  it("normalizes connector error payloads and falls back safely", () => {
    expect(
      normalizeSyncConnectorError("google_appdata", {
        code: "rate_limited",
        message: "Too many requests",
        retry_after_ms: 2500,
        status: 429,
        details: { endpoint: "list" },
      }),
    ).toEqual({
      provider: "google_appdata",
      code: "rate_limited",
      message: "Too many requests",
      retry_after_ms: 2500,
      status: 429,
      details: { endpoint: "list" },
    });

    expect(normalizeSyncConnectorError("onedrive_approot", null)).toEqual({
      provider: "onedrive_approot",
      code: "unknown",
      message: "Connector request failed.",
      retry_after_ms: null,
      status: null,
      details: null,
    });

    expect(
      createSyncConnectorError({
        provider: "google_appdata",
        code: "unknown",
        message: "  ",
        retry_after_ms: Number.NaN,
        status: Number.NaN,
        details: ["invalid"],
      }),
    ).toEqual({
      provider: "google_appdata",
      code: "unknown",
      message: "Connector request failed.",
      retry_after_ms: null,
      status: null,
      details: null,
    });
  });
});
