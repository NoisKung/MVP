// @vitest-environment node

import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFileAuditSink } from "./audit-sink.mjs";

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
});
