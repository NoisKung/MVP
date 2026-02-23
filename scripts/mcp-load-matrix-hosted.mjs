import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const DEFAULT_WEEK_START = "2025-01-06T00:00:00.000Z";

function parseArgs(argv) {
  const args = {
    out: "docs/mcp-load-matrix-hosted-staging-v0.1.md",
    baseUrl: process.env.SOLOSTACK_MCP_HOSTED_BASE_URL ?? "",
    authToken: process.env.SOLOSTACK_MCP_HOSTED_AUTH_TOKEN ?? "",
    iterations: 30,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out") {
      args.out = argv[index + 1] ?? args.out;
      index += 1;
      continue;
    }
    if (token === "--base-url") {
      args.baseUrl = argv[index + 1] ?? args.baseUrl;
      index += 1;
      continue;
    }
    if (token === "--auth-token") {
      args.authToken = argv[index + 1] ?? args.authToken;
      index += 1;
      continue;
    }
    if (token === "--iterations") {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed >= 3) {
        args.iterations = Math.floor(parsed);
      }
      index += 1;
    }
  }

  return args;
}

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.max(0, Math.min(sorted.length - 1, rank));
  return sorted[index];
}

function summarizeDurations(values) {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    avg_ms: roundMs(sum / values.length),
    p50_ms: roundMs(percentile(values, 50)),
    p95_ms: roundMs(percentile(values, 95)),
    max_ms: roundMs(Math.max(...values)),
  };
}

async function callTool(input) {
  const requestId = `hosted-${input.tool}-${randomUUID()}`;
  const url = new URL(`/tools/${input.tool}`, input.baseUrl).toString();
  const startedAt = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(input.authToken
        ? {
            authorization: `Bearer ${input.authToken}`,
          }
        : {}),
    },
    body: JSON.stringify({
      request_id: requestId,
      args: input.args,
    }),
  });
  const endedAt = performance.now();

  const payload = await response
    .json()
    .catch(() => ({ ok: false, error: { message: "Invalid JSON response." } }));

  if (!response.ok || !payload?.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`[${input.tool}] ${message}`);
  }

  const durationMs = Math.max(
    Number(payload?.meta?.duration_ms) || 0,
    endedAt - startedAt,
  );

  return {
    data: payload.data ?? null,
    duration_ms: durationMs,
  };
}

async function discoverSampleTaskId(input) {
  const result = await callTool({
    baseUrl: input.baseUrl,
    authToken: input.authToken,
    tool: "get_tasks",
    args: { limit: 1 },
  });
  const items = Array.isArray(result.data?.items) ? result.data.items : [];
  const firstTask = items[0];
  if (!firstTask || typeof firstTask.id !== "string" || !firstTask.id.trim()) {
    return null;
  }
  return firstTask.id.trim();
}

async function runScenario(input) {
  const durations = [];
  for (let index = 0; index < input.iterations; index += 1) {
    const result = await callTool({
      baseUrl: input.baseUrl,
      authToken: input.authToken,
      tool: input.tool,
      args: input.args,
    });
    durations.push(result.duration_ms);
  }
  return {
    profile: "hosted_staging",
    tool: input.tool,
    ...summarizeDurations(durations),
  };
}

function buildReport(input) {
  const lines = [
    "# MCP Hosted Load Matrix v0.1",
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Hosted base URL: ${input.baseUrl}`,
    `Iterations per tool: ${input.iterations}`,
    "",
    "## Result Matrix (ms)",
    "",
    "| Profile | Tool | Avg | P50 | P95 | Max |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
  ];

  for (const row of input.rows) {
    lines.push(
      `| ${row.profile} | ${row.tool} | ${row.avg_ms} | ${row.p50_ms} | ${row.p95_ms} | ${row.max_ms} |`,
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- วัดผ่าน HTTP hosted endpoint (`POST /tools/<tool>`)");
  lines.push("- duration ใช้ค่า max ระหว่าง server meta และ wall-clock ที่ฝั่ง client");
  lines.push(
    "- ใช้รายงานนี้เปรียบเทียบกับ `docs/mcp-load-matrix-v0.1.md` ด้วยสคริปต์ compare",
  );
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.baseUrl.trim();
  if (!baseUrl) {
    throw new Error(
      "Missing hosted base URL. Use --base-url or SOLOSTACK_MCP_HOSTED_BASE_URL.",
    );
  }

  const sampleTaskId = await discoverSampleTaskId({
    baseUrl,
    authToken: args.authToken,
  });

  const scenarios = [
    {
      tool: "get_tasks",
      args: { limit: 50 },
    },
    {
      tool: "get_projects",
      args: { limit: 50 },
    },
    {
      tool: "search_tasks",
      args: { query: "release", limit: 50 },
    },
    {
      tool: "get_weekly_review",
      args: { week_start_iso: DEFAULT_WEEK_START, item_limit: 20 },
    },
  ];

  if (sampleTaskId) {
    scenarios.push({
      tool: "get_task_changelogs",
      args: { task_id: sampleTaskId, limit: 50 },
    });
  }

  const rows = [];
  for (const scenario of scenarios) {
    const row = await runScenario({
      baseUrl,
      authToken: args.authToken,
      iterations: args.iterations,
      tool: scenario.tool,
      args: scenario.args,
    });
    rows.push(row);
  }

  const markdown = buildReport({
    baseUrl,
    iterations: args.iterations,
    rows,
  });
  writeFileSync(args.out, markdown, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Hosted load matrix report generated: ${args.out}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(
    error instanceof Error ? error.message : "Hosted load matrix failed.",
  );
  process.exit(1);
});
