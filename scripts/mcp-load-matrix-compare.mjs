import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const args = {
    baseline: "docs/mcp-load-matrix-v0.1.md",
    baselineProfile: "medium",
    hosted: "docs/mcp-load-matrix-hosted-staging-v0.1.md",
    out: "docs/mcp-load-matrix-hosted-compare-v0.1.md",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--baseline") {
      args.baseline = argv[index + 1] ?? args.baseline;
      index += 1;
      continue;
    }
    if (token === "--baseline-profile") {
      args.baselineProfile = argv[index + 1] ?? args.baselineProfile;
      index += 1;
      continue;
    }
    if (token === "--hosted") {
      args.hosted = argv[index + 1] ?? args.hosted;
      index += 1;
      continue;
    }
    if (token === "--out") {
      args.out = argv[index + 1] ?? args.out;
      index += 1;
    }
  }

  return args;
}

function parseMatrixRows(markdown) {
  const rows = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (trimmed.includes("---")) continue;
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((entry) => entry.trim());
    if (cells.length < 6) continue;
    const [profile, tool, avg, p50, p95, max] = cells;
    if (!profile || !tool || profile.toLowerCase() === "profile") continue;
    rows.push({
      profile,
      tool,
      avg_ms: Number.parseFloat(avg),
      p50_ms: Number.parseFloat(p50),
      p95_ms: Number.parseFloat(p95),
      max_ms: Number.parseFloat(max),
    });
  }
  return rows.filter(
    (row) =>
      Number.isFinite(row.avg_ms) &&
      Number.isFinite(row.p50_ms) &&
      Number.isFinite(row.p95_ms) &&
      Number.isFinite(row.max_ms),
  );
}

function ratio(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100) / 100;
}

function buildReport(input) {
  const lines = [
    "# MCP Hosted vs Local Baseline Comparison v0.1",
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Baseline file: ${input.baselineFile}`,
    `Hosted file: ${input.hostedFile}`,
    `Baseline profile: ${input.baselineProfile}`,
    "",
    "## Comparison Matrix",
    "",
    "| Tool | Baseline P95 (ms) | Hosted P95 (ms) | P95 Ratio | Baseline Avg (ms) | Hosted Avg (ms) | Avg Ratio | Status |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const row of input.rows) {
    const p95Ratio = ratio(row.hosted.p95_ms, row.baseline.p95_ms);
    const avgRatio = ratio(row.hosted.avg_ms, row.baseline.avg_ms);
    const status =
      row.hosted.p95_ms <= 2000 && (p95Ratio === null || p95Ratio <= 2)
        ? "PASS"
        : "REVIEW";
    lines.push(
      `| ${row.tool} | ${row.baseline.p95_ms} | ${row.hosted.p95_ms} | ${p95Ratio ?? "n/a"} | ${row.baseline.avg_ms} | ${row.hosted.avg_ms} | ${avgRatio ?? "n/a"} | ${status} |`,
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- `PASS` = hosted p95 <= 2000ms และ p95 ratio เทียบ baseline <= 2.0",
  );
  lines.push(
    "- `REVIEW` = เกิน threshold อย่างน้อยหนึ่งข้อ (ควรตรวจ query plan / infrastructure limits)",
  );
  lines.push("");

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baselineRows = parseMatrixRows(readFileSync(args.baseline, "utf8"));
  const hostedRows = parseMatrixRows(readFileSync(args.hosted, "utf8"));

  const baselineByTool = new Map(
    baselineRows
      .filter((row) => row.profile === args.baselineProfile)
      .map((row) => [row.tool, row]),
  );
  const hostedByTool = new Map(hostedRows.map((row) => [row.tool, row]));

  const comparableTools = [...hostedByTool.keys()].filter((tool) =>
    baselineByTool.has(tool),
  );
  if (comparableTools.length === 0) {
    throw new Error(
      "No comparable tools found between baseline and hosted reports.",
    );
  }

  const rows = comparableTools
    .sort((left, right) => left.localeCompare(right))
    .map((tool) => ({
      tool,
      baseline: baselineByTool.get(tool),
      hosted: hostedByTool.get(tool),
    }));

  const markdown = buildReport({
    baselineFile: args.baseline,
    hostedFile: args.hosted,
    baselineProfile: args.baselineProfile,
    rows,
  });
  writeFileSync(args.out, markdown, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Hosted comparison report generated: ${args.out}`);
}

try {
  main();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(
    error instanceof Error ? error.message : "Hosted comparison failed.",
  );
  process.exit(1);
}
