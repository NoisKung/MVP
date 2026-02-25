import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  DEFAULT_HOSTED_PROFILE_CONFIG_PATH,
  asOptionalString,
} from "./mcp-hosted-profile.mjs";

function parseArgs(argv) {
  const args = {
    preflightOut: "docs/mcp-load-matrix-hosted-preflight-v0.1.md",
    hostedOut: "docs/mcp-load-matrix-hosted-staging-v0.1.md",
    compareOut: "docs/mcp-load-matrix-hosted-compare-v0.1.md",
    pipelineOut: "docs/mcp-load-matrix-hosted-pipeline-v0.1.md",
    baseline: "docs/mcp-load-matrix-v0.1.md",
    baselineProfile: "medium",
    configPath: DEFAULT_HOSTED_PROFILE_CONFIG_PATH,
    profileName: "",
    baseUrl: "",
    authToken: "",
    iterations: "",
    skipHealthProbe: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--preflight-out") {
      args.preflightOut = argv[index + 1] ?? args.preflightOut;
      index += 1;
      continue;
    }
    if (token === "--hosted-out") {
      args.hostedOut = argv[index + 1] ?? args.hostedOut;
      index += 1;
      continue;
    }
    if (token === "--compare-out") {
      args.compareOut = argv[index + 1] ?? args.compareOut;
      index += 1;
      continue;
    }
    if (token === "--pipeline-out") {
      args.pipelineOut = argv[index + 1] ?? args.pipelineOut;
      index += 1;
      continue;
    }
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
    if (token === "--base-url") {
      args.baseUrl = argv[index + 1] ?? args.baseUrl;
      index += 1;
      continue;
    }
    if (token === "--config") {
      args.configPath = argv[index + 1] ?? args.configPath;
      index += 1;
      continue;
    }
    if (token === "--profile") {
      args.profileName = argv[index + 1] ?? args.profileName;
      index += 1;
      continue;
    }
    if (token === "--auth-token") {
      args.authToken = argv[index + 1] ?? args.authToken;
      index += 1;
      continue;
    }
    if (token === "--iterations") {
      args.iterations = argv[index + 1] ?? args.iterations;
      index += 1;
      continue;
    }
    if (token === "--skip-health-probe") {
      args.skipHealthProbe = true;
      continue;
    }
  }

  return args;
}

function renderCodeBlock(value) {
  const text = asOptionalString(value) ?? "(empty)";
  return `\`\`\`text\n${text}\n\`\`\``;
}

function runNodeScript(scriptPath, scriptArgs) {
  const startedAt = Date.now();
  const command = ["node", "--no-warnings", scriptPath, ...scriptArgs];
  const result = spawnSync(command[0], command.slice(1), {
    encoding: "utf8",
    stdio: "pipe",
  });
  const endedAt = Date.now();
  return {
    command: command.join(" "),
    exitCode: result.status ?? 1,
    durationMs: Math.max(0, endedAt - startedAt),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function buildReport(input) {
  const lines = [
    "# MCP Hosted Pipeline Run v0.1",
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Status: ${input.success ? "PASS" : "FAIL"}`,
    "",
    "## Steps",
    "",
    "| Step | Exit Code | Duration (ms) |",
    "| --- | ---: | ---: |",
  ];

  for (const step of input.steps) {
    lines.push(
      `| ${step.name} | ${step.result.exitCode} | ${step.result.durationMs} |`,
    );
  }

  lines.push("");
  lines.push("## Environment Snapshot");
  lines.push("");
  lines.push(`- \`SOLOSTACK_MCP_HOSTED_BASE_URL\`: ${input.baseUrlLabel}`);
  lines.push(`- \`SOLOSTACK_MCP_HOSTED_AUTH_TOKEN\`: ${input.authTokenLabel}`);
  lines.push(`- \`profile\`: ${input.profileLabel}`);
  lines.push(`- \`config_path\`: ${input.configPathLabel}`);
  lines.push(`- \`iterations\`: ${input.iterationsLabel}`);
  lines.push(
    `- \`skip_health_probe\`: ${input.skipHealthProbe ? "true" : "false"}`,
  );
  lines.push("");
  lines.push("## Detail");
  lines.push("");

  for (const step of input.steps) {
    lines.push(`### ${step.name}`);
    lines.push("");
    lines.push(`Command: \`${step.result.command}\``);
    lines.push("");
    lines.push(`Exit code: ${step.result.exitCode}`);
    lines.push("");
    lines.push("stdout:");
    lines.push(renderCodeBlock(step.result.stdout));
    lines.push("");
    lines.push("stderr:");
    lines.push(renderCodeBlock(step.result.stderr));
    lines.push("");
  }

  if (!input.success) {
    lines.push("## Next Actions");
    lines.push("");
    lines.push("1. Resolve failures in the first non-zero step above.");
    lines.push(
      "2. Re-run `npm run mcp:load-matrix:hosted:pipeline` after environment is ready.",
    );
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sharedHostedArgs = [];
  if (asOptionalString(args.configPath)) {
    sharedHostedArgs.push("--config", args.configPath);
  }
  if (asOptionalString(args.profileName)) {
    sharedHostedArgs.push("--profile", args.profileName);
  }
  if (asOptionalString(args.baseUrl)) {
    sharedHostedArgs.push("--base-url", args.baseUrl);
  }
  if (asOptionalString(args.authToken)) {
    sharedHostedArgs.push("--auth-token", args.authToken);
  }

  const preflightArgs = ["--out", args.preflightOut, ...sharedHostedArgs];
  if (args.skipHealthProbe) {
    preflightArgs.push("--skip-health-probe");
  }
  const preflightStep = {
    name: "Preflight",
    result: runNodeScript(
      "scripts/mcp-load-matrix-hosted-preflight.mjs",
      preflightArgs,
    ),
  };

  const steps = [preflightStep];
  let success = preflightStep.result.exitCode === 0;

  if (success) {
    const hostedArgs = ["--out", args.hostedOut, ...sharedHostedArgs];
    if (asOptionalString(args.iterations)) {
      hostedArgs.push("--iterations", args.iterations);
    }
    const hostedStep = {
      name: "Hosted matrix",
      result: runNodeScript("scripts/mcp-load-matrix-hosted.mjs", hostedArgs),
    };
    steps.push(hostedStep);
    success = hostedStep.result.exitCode === 0;
  }

  if (success) {
    const compareArgs = [
      "--baseline",
      args.baseline,
      "--baseline-profile",
      args.baselineProfile,
      "--hosted",
      args.hostedOut,
      "--out",
      args.compareOut,
    ];
    const compareStep = {
      name: "Compare matrix",
      result: runNodeScript("scripts/mcp-load-matrix-compare.mjs", compareArgs),
    };
    steps.push(compareStep);
    success = compareStep.result.exitCode === 0;
  }

  const report = buildReport({
    success,
    steps,
    baseUrlLabel:
      asOptionalString(args.baseUrl) ??
      asOptionalString(process.env.SOLOSTACK_MCP_HOSTED_BASE_URL) ??
      "not_set",
    authTokenLabel:
      (asOptionalString(args.authToken) ??
      asOptionalString(process.env.SOLOSTACK_MCP_HOSTED_AUTH_TOKEN))
        ? "set"
        : "not_set",
    profileLabel: asOptionalString(args.profileName) ?? "auto",
    configPathLabel:
      asOptionalString(args.configPath) ?? DEFAULT_HOSTED_PROFILE_CONFIG_PATH,
    iterationsLabel:
      asOptionalString(args.iterations) ??
      asOptionalString(process.env.SOLOSTACK_MCP_HOSTED_ITERATIONS) ??
      "default",
    skipHealthProbe: args.skipHealthProbe,
  });
  writeFileSync(args.pipelineOut, report, "utf8");

  // eslint-disable-next-line no-console
  console.log(`Hosted pipeline report generated: ${args.pipelineOut}`);
  if (!success) {
    process.exitCode = 1;
  }
}

main();
