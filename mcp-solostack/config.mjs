export const MCP_SERVICE_NAME = "mcp-solostack";
export const MCP_SERVICE_VERSION = "0.1.0";

const SUPPORTED_LOG_LEVELS = new Set(["debug", "info", "warn", "error"]);
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

const DEFAULTS = Object.freeze({
  host: "127.0.0.1",
  port: 8799,
  log_level: "info",
  read_only: true,
  enable_cors: false,
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

export function loadMcpConfigFromEnv(env = process.env) {
  const host = asOptionalString(env.SOLOSTACK_MCP_HOST) ?? DEFAULTS.host;
  const dbPath = asOptionalString(env.SOLOSTACK_MCP_DB_PATH);

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
    db_path_set: Boolean(config.db_path),
  };
}
