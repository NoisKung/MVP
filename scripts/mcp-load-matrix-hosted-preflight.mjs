import { writeFileSync } from "node:fs";
import {
  DEFAULT_HOSTED_PROFILE_CONFIG_PATH,
  asOptionalString,
  isLocalhostHostedUrl,
  normalizeHostedBaseUrl,
  resolveHostedProfileSettings,
} from "./mcp-hosted-profile.mjs";

function parseBoundedInt(value, fallback, min, max) {
  const normalized = asOptionalString(value);
  if (!normalized) {
    return {
      value: fallback,
      valid: true,
      reason: null,
    };
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return {
      value: fallback,
      valid: false,
      reason: "not_number",
    };
  }
  const intValue = Math.floor(parsed);
  if (intValue < min || intValue > max) {
    return {
      value: fallback,
      valid: false,
      reason: "out_of_range",
    };
  }
  return {
    value: intValue,
    valid: true,
    reason: null,
  };
}

function parseArgs(argv) {
  const args = {
    out: "docs/mcp-load-matrix-hosted-preflight-v0.1.md",
    configPath: DEFAULT_HOSTED_PROFILE_CONFIG_PATH,
    profileName: "",
    baseUrl: "",
    authToken: "",
    auditSink: "",
    auditRetentionDays: "",
    auditHttpUrl: "",
    auditHttpTimeoutMs: "",
    skipHealthProbe: false,
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
    if (token === "--audit-sink") {
      args.auditSink = argv[index + 1] ?? args.auditSink;
      index += 1;
      continue;
    }
    if (token === "--audit-http-url") {
      args.auditHttpUrl = argv[index + 1] ?? args.auditHttpUrl;
      index += 1;
      continue;
    }
    if (token === "--audit-retention-days") {
      args.auditRetentionDays = argv[index + 1] ?? args.auditRetentionDays;
      index += 1;
      continue;
    }
    if (token === "--audit-http-timeout-ms") {
      args.auditHttpTimeoutMs = argv[index + 1] ?? args.auditHttpTimeoutMs;
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

function buildCheck(input) {
  return {
    name: input.name,
    required: Boolean(input.required),
    ok: Boolean(input.ok),
    detail: input.detail ?? "",
    action: input.action ?? "",
  };
}

function buildStatusText(check) {
  if (check.ok) return "PASS";
  return check.required ? "FAIL" : "WARN";
}

async function probeHostedHealth(input) {
  if (input.skipHealthProbe) {
    return buildCheck({
      name: "Hosted health probe (/health)",
      required: false,
      ok: true,
      detail: "Skipped by --skip-health-probe.",
      action:
        "Run preflight again without --skip-health-probe before sign-off.",
    });
  }

  if (!input.baseUrl) {
    return buildCheck({
      name: "Hosted health probe (/health)",
      required: true,
      ok: false,
      detail: "Cannot probe without SOLOSTACK_MCP_HOSTED_BASE_URL.",
      action: "Set base URL and re-run preflight.",
    });
  }

  const healthUrl = new URL("/health", input.baseUrl).toString();
  const controller = new AbortController();
  const timeoutMs = 5000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        ...(input.authToken
          ? {
              authorization: `Bearer ${input.authToken}`,
            }
          : {}),
      },
      signal: controller.signal,
    });
    if (response.ok) {
      return buildCheck({
        name: "Hosted health probe (/health)",
        required: true,
        ok: true,
        detail: `HTTP ${response.status} from ${healthUrl}`,
        action: "Proceed to hosted matrix run.",
      });
    }
    return buildCheck({
      name: "Hosted health probe (/health)",
      required: true,
      ok: false,
      detail: `HTTP ${response.status} from ${healthUrl}`,
      action: "Verify hosted deployment, route mapping, and auth policy.",
    });
  } catch (error) {
    return buildCheck({
      name: "Hosted health probe (/health)",
      required: true,
      ok: false,
      detail: error instanceof Error ? error.message : "Health probe failed.",
      action: "Verify endpoint reachability from this environment.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildReport(input) {
  const lines = [
    "# MCP Hosted Preflight v0.1",
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Status: ${input.ready ? "Ready for hosted matrix run" : "Pending configuration"}`,
    `Profile: ${input.profileLabel}`,
    `Endpoint type: ${input.endpointTypeLabel}`,
    `Config path: ${input.configPathLabel}`,
    "",
    "## Check Matrix",
    "",
    "| Check | Status | Required | Detail |",
    "| --- | --- | --- | --- |",
  ];

  for (const check of input.checks) {
    lines.push(
      `| ${check.name} | ${buildStatusText(check)} | ${
        check.required ? "yes" : "no"
      } | ${check.detail} |`,
    );
  }

  lines.push("");
  lines.push("## Next Actions");
  lines.push("");

  const failedRequired = input.checks.filter(
    (check) => check.required && !check.ok,
  );
  if (failedRequired.length === 0) {
    lines.push("1. `npm run mcp:load-matrix:hosted`");
    lines.push("2. `npm run mcp:load-matrix:compare`");
    lines.push(
      "3. Attach `docs/mcp-load-matrix-hosted-staging-v0.1.md` and compare report to release evidence.",
    );
  } else {
    for (const [index, check] of failedRequired.entries()) {
      const action = check.action || "Resolve this check and re-run preflight.";
      lines.push(`${index + 1}. ${check.name}: ${action}`);
    }
  }

  lines.push("");
  lines.push("## Environment Snapshot");
  lines.push("");
  lines.push(`- \`SOLOSTACK_MCP_HOSTED_BASE_URL\`: ${input.baseUrlLabel}`);
  lines.push(`- \`SOLOSTACK_MCP_HOSTED_AUTH_TOKEN\`: ${input.authTokenLabel}`);
  lines.push(`- \`SOLOSTACK_MCP_AUDIT_SINK\`: ${input.auditSinkLabel}`);
  lines.push(`- \`SOLOSTACK_MCP_AUDIT_HTTP_URL\`: ${input.auditHttpUrlLabel}`);
  lines.push(
    `- \`SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS\`: ${input.auditHttpTimeoutLabel}`,
  );
  lines.push(
    `- \`SOLOSTACK_MCP_AUDIT_RETENTION_DAYS\`: ${input.auditRetentionDaysLabel}`,
  );
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profileSettings = resolveHostedProfileSettings({
    configPath: args.configPath,
    profileName: args.profileName,
    baseUrl: args.baseUrl,
    authToken: args.authToken,
    skipHealthProbe: args.skipHealthProbe,
  });
  if (profileSettings.config_parse_error) {
    throw new Error(
      `Invalid hosted profile config (${profileSettings.config_path}): ${profileSettings.config_parse_error}`,
    );
  }
  if (
    profileSettings.selected_profile &&
    !profileSettings.selected_profile_found
  ) {
    throw new Error(
      `Hosted profile "${profileSettings.selected_profile}" was not found in ${profileSettings.config_path}.`,
    );
  }

  const normalizedBaseUrl = normalizeHostedBaseUrl(profileSettings.base_url);
  const normalizedAuditHttpUrl = normalizeHostedBaseUrl(
    asOptionalString(args.auditHttpUrl) ??
      process.env.SOLOSTACK_MCP_AUDIT_HTTP_URL ??
      "",
  );
  const normalizedAuthToken = asOptionalString(profileSettings.auth_token);
  const normalizedAuditSink = (
    asOptionalString(args.auditSink) ??
    process.env.SOLOSTACK_MCP_AUDIT_SINK ??
    "stdout"
  ).toLowerCase();
  const normalizedAuditHttpTimeout = parseBoundedInt(
    asOptionalString(args.auditHttpTimeoutMs) ??
      process.env.SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS ??
      "",
    3000,
    100,
    60_000,
  );
  const normalizedAuditRetentionDays = parseBoundedInt(
    asOptionalString(args.auditRetentionDays) ??
      process.env.SOLOSTACK_MCP_AUDIT_RETENTION_DAYS ??
      "",
    30,
    1,
    3650,
  );

  const endpointType =
    normalizedBaseUrl.valid && normalizedBaseUrl.value
      ? isLocalhostHostedUrl(normalizedBaseUrl.value)
        ? "localhost"
        : "cloud"
      : "cloud";
  const authRequired = endpointType === "cloud";

  const checks = [];

  checks.push(
    buildCheck({
      name: "Hosted base URL",
      required: true,
      ok: normalizedBaseUrl.valid,
      detail: normalizedBaseUrl.valid
        ? `${normalizedBaseUrl.value}${normalizedBaseUrl.inferred_scheme ? ` (inferred ${normalizedBaseUrl.inferred_scheme}://)` : ""}`
        : "Missing or invalid SOLOSTACK_MCP_HOSTED_BASE_URL.",
      action:
        "Set SOLOSTACK_MCP_HOSTED_BASE_URL to http(s) endpoint and re-run preflight.",
    }),
  );

  checks.push(
    buildCheck({
      name: "Hosted auth token",
      required: authRequired,
      ok: authRequired ? Boolean(normalizedAuthToken) : true,
      detail: authRequired
        ? normalizedAuthToken
          ? "Token is set."
          : "Missing SOLOSTACK_MCP_HOSTED_AUTH_TOKEN."
        : normalizedAuthToken
          ? "Token is set (optional for localhost endpoint)."
          : "Token is optional for localhost endpoint.",
      action: authRequired
        ? "Set SOLOSTACK_MCP_HOSTED_AUTH_TOKEN for cloud/staging endpoint validation."
        : "Optional: set auth token when local gateway enforces auth.",
    }),
  );

  checks.push(
    buildCheck({
      name: "Audit sink mode",
      required: false,
      ok: ["stdout", "file", "http"].includes(normalizedAuditSink),
      detail: `SOLOSTACK_MCP_AUDIT_SINK=${normalizedAuditSink}`,
      action: "Use stdout, file, or http.",
    }),
  );

  const stagingRetentionMinimumDays = 30;
  if (normalizedAuditSink === "stdout") {
    checks.push(
      buildCheck({
        name: "Audit retention baseline (hosted staging)",
        required: false,
        ok: false,
        detail:
          "SOLOSTACK_MCP_AUDIT_SINK=stdout (no persisted audit retention).",
        action:
          "For hosted staging sign-off, prefer file/http sink with retention >= 30 days.",
      }),
    );
  } else {
    const retentionDays = normalizedAuditRetentionDays.value;
    checks.push(
      buildCheck({
        name: "Audit retention baseline (hosted staging)",
        required: true,
        ok:
          normalizedAuditRetentionDays.valid &&
          retentionDays >= stagingRetentionMinimumDays,
        detail: normalizedAuditRetentionDays.valid
          ? `retention=${retentionDays} days`
          : "SOLOSTACK_MCP_AUDIT_RETENTION_DAYS must be 1..3650.",
        action:
          "Set SOLOSTACK_MCP_AUDIT_RETENTION_DAYS to at least 30 for hosted staging evidence.",
      }),
    );
  }

  if (normalizedAuditSink === "http") {
    checks.push(
      buildCheck({
        name: "Audit HTTP URL",
        required: true,
        ok: normalizedAuditHttpUrl.valid,
        detail: normalizedAuditHttpUrl.valid
          ? normalizedAuditHttpUrl.value
          : "Missing or invalid SOLOSTACK_MCP_AUDIT_HTTP_URL.",
        action:
          "Set SOLOSTACK_MCP_AUDIT_HTTP_URL for centralized sink delivery.",
      }),
    );
    checks.push(
      buildCheck({
        name: "Audit HTTP timeout",
        required: true,
        ok: normalizedAuditHttpTimeout.valid,
        detail: `timeout=${normalizedAuditHttpTimeout.value}ms`,
        action:
          "Set SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS between 100 and 60000.",
      }),
    );
  } else {
    checks.push(
      buildCheck({
        name: "Audit HTTP URL",
        required: false,
        ok: true,
        detail: "Not required because audit sink mode is not http.",
        action:
          "Switch SOLOSTACK_MCP_AUDIT_SINK=http when validating centralized delivery.",
      }),
    );
  }

  checks.push(
    await probeHostedHealth({
      baseUrl: normalizedBaseUrl.value,
      authToken: normalizedAuthToken,
      skipHealthProbe: profileSettings.skip_health_probe,
    }),
  );

  const ready = checks.every((check) => !check.required || check.ok);
  const markdown = buildReport({
    ready,
    checks,
    profileLabel: profileSettings.selected_profile ?? "direct",
    endpointTypeLabel: endpointType,
    configPathLabel: profileSettings.config_path,
    baseUrlLabel: normalizedBaseUrl.value ?? "not_set",
    authTokenLabel: normalizedAuthToken ? "set" : "not_set",
    auditSinkLabel: normalizedAuditSink,
    auditHttpUrlLabel: normalizedAuditHttpUrl.value ?? "not_set",
    auditHttpTimeoutLabel: String(normalizedAuditHttpTimeout.value),
    auditRetentionDaysLabel: String(normalizedAuditRetentionDays.value),
  });

  writeFileSync(args.out, markdown, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Hosted preflight report generated: ${args.out}`);
  if (!ready) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(
    error instanceof Error ? error.message : "Hosted preflight failed.",
  );
  process.exit(1);
});
