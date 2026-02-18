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
    });

    expect(config).toMatchObject({
      host: "0.0.0.0",
      port: 8900,
      db_path: "/tmp/solostack.db",
      log_level: "debug",
      read_only: false,
      enable_cors: true,
    });
    expect(getMcpSafeConfigSummary(config)).toEqual({
      host: "0.0.0.0",
      port: 8900,
      log_level: "debug",
      read_only: false,
      enable_cors: true,
      db_path_set: true,
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
  });
});
