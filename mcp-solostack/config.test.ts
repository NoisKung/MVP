// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getMcpSafeConfigSummary, loadMcpConfigFromEnv } from "./config.mjs";

describe("mcp-solostack config loader", () => {
  it("loads defaults when env is empty", () => {
    const config = loadMcpConfigFromEnv({});
    expect(config).toMatchObject({
      service_name: "mcp-solostack",
      version: "0.1.0",
      host: "127.0.0.1",
      port: 8799,
      log_level: "info",
      read_only: true,
      enable_cors: false,
      rate_limit_enabled: false,
      rate_limit_window_ms: 60000,
      rate_limit_max_requests: 120,
      timeout_guard_enabled: false,
      timeout_strategy: "soft",
      tool_timeout_ms: 2000,
      audit_sink: "stdout",
      audit_log_directory: "mcp-solostack/audit",
      audit_retention_days: 30,
      audit_http_url: null,
      audit_http_timeout_ms: 3000,
      audit_http_auth_token: null,
      db_path: null,
    });
  });

  it("parses overrides and returns redacted summary", () => {
    const config = loadMcpConfigFromEnv({
      SOLOSTACK_MCP_HOST: "0.0.0.0",
      SOLOSTACK_MCP_PORT: "8900",
      SOLOSTACK_MCP_DB_PATH: "/tmp/solostack.db",
      SOLOSTACK_MCP_LOG_LEVEL: "debug",
      SOLOSTACK_MCP_READ_ONLY: "false",
      SOLOSTACK_MCP_ENABLE_CORS: "true",
      SOLOSTACK_MCP_RATE_LIMIT_ENABLED: "true",
      SOLOSTACK_MCP_RATE_LIMIT_WINDOW_MS: "30000",
      SOLOSTACK_MCP_RATE_LIMIT_MAX_REQUESTS: "500",
      SOLOSTACK_MCP_TIMEOUT_GUARD_ENABLED: "true",
      SOLOSTACK_MCP_TIMEOUT_STRATEGY: "worker_hard",
      SOLOSTACK_MCP_TOOL_TIMEOUT_MS: "2500",
      SOLOSTACK_MCP_AUDIT_SINK: "file",
      SOLOSTACK_MCP_AUDIT_LOG_DIR: "/tmp/mcp-audit",
      SOLOSTACK_MCP_AUDIT_RETENTION_DAYS: "14",
      SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS: "2200",
    });

    expect(config).toMatchObject({
      host: "0.0.0.0",
      port: 8900,
      db_path: "/tmp/solostack.db",
      log_level: "debug",
      read_only: false,
      enable_cors: true,
      rate_limit_enabled: true,
      rate_limit_window_ms: 30000,
      rate_limit_max_requests: 500,
      timeout_guard_enabled: true,
      timeout_strategy: "worker_hard",
      tool_timeout_ms: 2500,
      audit_sink: "file",
      audit_log_directory: "/tmp/mcp-audit",
      audit_retention_days: 14,
      audit_http_url: null,
      audit_http_timeout_ms: 2200,
      audit_http_auth_token: null,
    });
    expect(getMcpSafeConfigSummary(config)).toEqual({
      host: "0.0.0.0",
      port: 8900,
      log_level: "debug",
      read_only: false,
      enable_cors: true,
      rate_limit_enabled: true,
      rate_limit_window_ms: 30000,
      rate_limit_max_requests: 500,
      timeout_guard_enabled: true,
      timeout_strategy: "worker_hard",
      tool_timeout_ms: 2500,
      audit_sink: "file",
      audit_log_directory: "/tmp/mcp-audit",
      audit_retention_days: 14,
      audit_http_url_set: false,
      audit_http_timeout_ms: 2200,
      audit_http_auth_token_set: false,
      db_path_set: true,
    });
  });

  it("loads http audit sink config with redacted summary", () => {
    const config = loadMcpConfigFromEnv({
      SOLOSTACK_MCP_AUDIT_SINK: "http",
      SOLOSTACK_MCP_AUDIT_HTTP_URL: "https://audit.example.com/v1/events",
      SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS: "5000",
      SOLOSTACK_MCP_AUDIT_HTTP_AUTH_TOKEN: "secret-token",
    });

    expect(config).toMatchObject({
      audit_sink: "http",
      audit_http_url: "https://audit.example.com/v1/events",
      audit_http_timeout_ms: 5000,
      audit_http_auth_token: "secret-token",
    });
    expect(getMcpSafeConfigSummary(config)).toMatchObject({
      audit_sink: "http",
      audit_http_url_set: true,
      audit_http_timeout_ms: 5000,
      audit_http_auth_token_set: true,
    });
  });

  it("throws on invalid values", () => {
    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_PORT: "abc",
      }),
    ).toThrow("SOLOSTACK_MCP_PORT must be an integer.");

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_LOG_LEVEL: "verbose",
      }),
    ).toThrow("SOLOSTACK_MCP_LOG_LEVEL must be one of");

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_READ_ONLY: "maybe",
      }),
    ).toThrow('Invalid boolean value "maybe".');

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_RATE_LIMIT_WINDOW_MS: "abc",
      }),
    ).toThrow("SOLOSTACK_MCP_RATE_LIMIT_WINDOW_MS must be an integer.");

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_RATE_LIMIT_MAX_REQUESTS: "0",
      }),
    ).toThrow("SOLOSTACK_MCP_RATE_LIMIT_MAX_REQUESTS must be between");

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_TOOL_TIMEOUT_MS: "90",
      }),
    ).toThrow("SOLOSTACK_MCP_TOOL_TIMEOUT_MS must be between");

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_TIMEOUT_STRATEGY: "hard_cancel",
      }),
    ).toThrow("SOLOSTACK_MCP_TIMEOUT_STRATEGY must be one of");

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_AUDIT_SINK: "kinesis",
      }),
    ).toThrow("SOLOSTACK_MCP_AUDIT_SINK must be one of");

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_AUDIT_SINK: "http",
      }),
    ).toThrow("SOLOSTACK_MCP_AUDIT_HTTP_URL is required");

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_AUDIT_SINK: "http",
        SOLOSTACK_MCP_AUDIT_HTTP_URL: "ftp://audit.example.com/events",
      }),
    ).toThrow("SOLOSTACK_MCP_AUDIT_HTTP_URL must use http:// or https://");

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS: "10",
      }),
    ).toThrow("SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS must be between");

    expect(() =>
      loadMcpConfigFromEnv({
        SOLOSTACK_MCP_AUDIT_RETENTION_DAYS: "0",
      }),
    ).toThrow("SOLOSTACK_MCP_AUDIT_RETENTION_DAYS must be between");
  });
});
