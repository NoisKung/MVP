// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { createMcpLogger } from "./logger.mjs";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mcp-solostack logger", () => {
  it("writes audit tool call payload with event metadata", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createMcpLogger({
      service_name: "mcp-solostack",
      log_level: "info",
    });

    logger.auditToolCall({
      request_id: "req-1",
      tool: "get_tasks",
      ok: true,
      status_code: 200,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const rawPayload = spy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(rawPayload)) as Record<string, unknown>;
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("MCP tool call completed.");
    const metadata = parsed.metadata as Record<string, unknown>;
    expect(metadata.event).toBe("mcp.tool_call");
    expect(metadata.tool).toBe("get_tasks");
  });

  it("respects configured log level", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createMcpLogger({
      service_name: "mcp-solostack",
      log_level: "error",
    });

    logger.info("ignored");
    logger.error("accepted");

    expect(spy).toHaveBeenCalledTimes(1);
    const rawPayload = spy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(rawPayload)) as Record<string, unknown>;
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("accepted");
  });
});
