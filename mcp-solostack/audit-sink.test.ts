// @vitest-environment node

import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createFileAuditSink, createHttpAuditSink } from "./audit-sink.mjs";

describe("mcp-solostack audit sink", () => {
  it("writes audit events to day-bucket file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solostack-mcp-audit-"));
    const sink = createFileAuditSink({
      directory_path: dir,
      retention_days: 30,
      now: () => Date.parse("2026-02-23T12:00:00.000Z"),
    });

    sink.write({
      event: "mcp.tool_call",
      tool: "get_tasks",
      status_code: 200,
    });

    const files = readdirSync(dir);
    expect(files).toContain("mcp-tool-call-2026-02-23.log");
    const content = readFileSync(
      path.join(dir, "mcp-tool-call-2026-02-23.log"),
      "utf8",
    );
    expect(content).toContain('"event":"mcp.tool_call"');
    expect(content).toContain('"tool":"get_tasks"');
  });

  it("prunes files older than retention window", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solostack-mcp-audit-"));
    writeFileSync(path.join(dir, "mcp-tool-call-2025-12-01.log"), "old\n");
    writeFileSync(path.join(dir, "mcp-tool-call-2026-02-10.log"), "recent\n");

    const sink = createFileAuditSink({
      directory_path: dir,
      retention_days: 20,
      now: () => Date.parse("2026-02-23T12:00:00.000Z"),
    });
    sink.prune();

    const files = readdirSync(dir).sort();
    expect(files).not.toContain("mcp-tool-call-2025-12-01.log");
    expect(files).toContain("mcp-tool-call-2026-02-10.log");
  });

  it("sends audit payload to http sink endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
    });
    const sink = createHttpAuditSink({
      url: "https://audit.example.com/v1/events",
      timeout_ms: 2000,
      fetch_impl: fetchImpl,
      now: () => Date.parse("2026-02-23T12:00:00.000Z"),
    });

    sink.write({
      event: "mcp.tool_call",
      tool: "get_tasks",
      status_code: 200,
    });
    await Promise.resolve();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://audit.example.com/v1/events",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(payload.event).toBe("mcp.tool_call");
    expect(payload.tool).toBe("get_tasks");
    expect(payload.timestamp_iso).toBe("2026-02-23T12:00:00.000Z");
  });

  it("reports http sink failures through on_error callback", async () => {
    const onError = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });
    const sink = createHttpAuditSink({
      url: "https://audit.example.com/v1/events",
      fetch_impl: fetchImpl,
      on_error: onError,
    });

    sink.write({
      event: "mcp.tool_call",
      tool: "search_tasks",
      status_code: 503,
    });
    await Promise.resolve();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][1]).toMatchObject({
      event: "mcp.tool_call",
      tool: "search_tasks",
    });
  });
});
