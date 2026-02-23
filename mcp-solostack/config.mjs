export const MCP_SERVICE_NAME = "mcp-solostack";
export const MCP_SERVICE_VERSION = "0.1.0";

const SUPPORTED_LOG_LEVELS = new Set(["debug", "info", "warn", "error"]);
const SUPPORTED_TIMEOUT_STRATEGIES = new Set(["soft", "worker_hard"]);
const SUPPORTED_AUDIT_SINKS = new Set(["stdout", "file"]);
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

const DEFAULTS = Object.freeze({
  host: "127.0.0.1",
  port: 8799,
  log_level: "info",
  read_only: true,
  enable_cors: false,
  rate_limit_enabled: false,
  rate_limit_window_ms: 60_000,
  rate_limit_max_requests: 120,
  timeout_guard_enabled: false,
  tool_timeout_ms: 2_000,
  timeout_strategy: "soft",
  audit_sink: "stdout",
  audit_log_directory: "mcp-solostack/audit",
  audit_retention_days: 30,
});

function asOptionalString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function parsePort(rawValue) {
  const normalized = asOptionalString(rawValue);
  if (normalized === null) return DEFAULTS.port;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || Math.floor(parsed) !== parsed) {
    throw new Error("SOLOSTACK_MCP_PORT must be an integer.");
  }
  if (parsed < 1 || parsed > 65535) {
    throw new Error("SOLOSTACK_MCP_PORT must be between 1 and 65535.");
  }
  return parsed;
}

function parseLogLevel(rawValue) {
  const normalized = asOptionalString(rawValue);
  if (normalized === null) return DEFAULTS.log_level;
  const lowerCaseValue = normalized.toLowerCase();
  if (!SUPPORTED_LOG_LEVELS.has(lowerCaseValue)) {
    throw new Error(
      "SOLOSTACK_MCP_LOG_LEVEL must be one of: debug, info, warn, error.",
    );
  }
  return lowerCaseValue;
}

function parseTimeoutStrategy(rawValue) {
  const normalized = asOptionalString(rawValue);
  if (normalized === null) return DEFAULTS.timeout_strategy;
  const lowerCaseValue = normalized.toLowerCase();
  if (!SUPPORTED_TIMEOUT_STRATEGIES.has(lowerCaseValue)) {
    throw new Error(
      "SOLOSTACK_MCP_TIMEOUT_STRATEGY must be one of: soft, worker_hard.",
    );
  }
  return lowerCaseValue;
}

function parseAuditSink(rawValue) {
  const normalized = asOptionalString(rawValue);
  if (normalized === null) return DEFAULTS.audit_sink;
  const lowerCaseValue = normalized.toLowerCase();
  if (!SUPPORTED_AUDIT_SINKS.has(lowerCaseValue)) {
    throw new Error("SOLOSTACK_MCP_AUDIT_SINK must be one of: stdout, file.");
  }
  return lowerCaseValue;
}

function parseBoolean(rawValue, fallback) {
  const normalized = asOptionalString(rawValue);
  if (normalized === null) return fallback;
  const lowerCaseValue = normalized.toLowerCase();
  if (TRUE_VALUES.has(lowerCaseValue)) return true;
  if (FALSE_VALUES.has(lowerCaseValue)) return false;
  throw new Error(
    `Invalid boolean value "${normalized}". Use true/false, 1/0, yes/no, on/off.`,
  );
}

function parseBoundedInteger(rawValue, input) {
  const normalized = asOptionalString(rawValue);
  if (normalized === null) return input.fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || Math.floor(parsed) !== parsed) {
    throw new Error(`${input.env_name} must be an integer.`);
  }
  if (parsed < input.min || parsed > input.max) {
    throw new Error(
      `${input.env_name} must be between ${input.min} and ${input.max}.`,
    );
  }
  return parsed;
}

export function loadMcpConfigFromEnv(env = process.env) {
  const host = asOptionalString(env.SOLOSTACK_MCP_HOST) ?? DEFAULTS.host;
  const dbPath = asOptionalString(env.SOLOSTACK_MCP_DB_PATH);
  const auditSink = parseAuditSink(env.SOLOSTACK_MCP_AUDIT_SINK);

  return {
    service_name: MCP_SERVICE_NAME,
    version: MCP_SERVICE_VERSION,
    host,
    port: parsePort(env.SOLOSTACK_MCP_PORT),
    log_level: parseLogLevel(env.SOLOSTACK_MCP_LOG_LEVEL),
    read_only: parseBoolean(env.SOLOSTACK_MCP_READ_ONLY, DEFAULTS.read_only),
    enable_cors: parseBoolean(
      env.SOLOSTACK_MCP_ENABLE_CORS,
      DEFAULTS.enable_cors,
    ),
    rate_limit_enabled: parseBoolean(
      env.SOLOSTACK_MCP_RATE_LIMIT_ENABLED,
      DEFAULTS.rate_limit_enabled,
    ),
    rate_limit_window_ms: parseBoundedInteger(
      env.SOLOSTACK_MCP_RATE_LIMIT_WINDOW_MS,
      {
        env_name: "SOLOSTACK_MCP_RATE_LIMIT_WINDOW_MS",
        min: 1000,
        max: 3_600_000,
        fallback: DEFAULTS.rate_limit_window_ms,
      },
    ),
    rate_limit_max_requests: parseBoundedInteger(
      env.SOLOSTACK_MCP_RATE_LIMIT_MAX_REQUESTS,
      {
        env_name: "SOLOSTACK_MCP_RATE_LIMIT_MAX_REQUESTS",
        min: 1,
        max: 100_000,
        fallback: DEFAULTS.rate_limit_max_requests,
      },
    ),
    timeout_guard_enabled: parseBoolean(
      env.SOLOSTACK_MCP_TIMEOUT_GUARD_ENABLED,
      DEFAULTS.timeout_guard_enabled,
    ),
    timeout_strategy: parseTimeoutStrategy(env.SOLOSTACK_MCP_TIMEOUT_STRATEGY),
    tool_timeout_ms: parseBoundedInteger(env.SOLOSTACK_MCP_TOOL_TIMEOUT_MS, {
      env_name: "SOLOSTACK_MCP_TOOL_TIMEOUT_MS",
      min: 100,
      max: 60_000,
      fallback: DEFAULTS.tool_timeout_ms,
    }),
    audit_sink: auditSink,
    audit_log_directory:
      asOptionalString(env.SOLOSTACK_MCP_AUDIT_LOG_DIR) ??
      DEFAULTS.audit_log_directory,
    audit_retention_days: parseBoundedInteger(
      env.SOLOSTACK_MCP_AUDIT_RETENTION_DAYS,
      {
        env_name: "SOLOSTACK_MCP_AUDIT_RETENTION_DAYS",
        min: 1,
        max: 3650,
        fallback: DEFAULTS.audit_retention_days,
      },
    ),
    db_path: dbPath,
  };
}

export function getMcpSafeConfigSummary(config) {
  return {
    host: config.host,
    port: config.port,
    log_level: config.log_level,
    read_only: config.read_only,
    enable_cors: config.enable_cors,
    rate_limit_enabled: config.rate_limit_enabled,
    rate_limit_window_ms: config.rate_limit_window_ms,
    rate_limit_max_requests: config.rate_limit_max_requests,
    timeout_guard_enabled: config.timeout_guard_enabled,
    timeout_strategy: config.timeout_strategy,
    tool_timeout_ms: config.tool_timeout_ms,
    audit_sink: config.audit_sink,
    audit_log_directory: config.audit_log_directory,
    audit_retention_days: config.audit_retention_days,
    db_path_set: Boolean(config.db_path),
  };
}
