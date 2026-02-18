const LOG_LEVEL_ORDER = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

function asOptionalPlainObject(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value;
}

function shouldLog(currentLevel, requestedLevel) {
  const current = LOG_LEVEL_ORDER[currentLevel] ?? LOG_LEVEL_ORDER.info;
  const requested = LOG_LEVEL_ORDER[requestedLevel] ?? LOG_LEVEL_ORDER.info;
  return requested >= current;
}

export function createMcpLogger(input) {
  const serviceName =
    (typeof input?.service_name === "string" && input.service_name) ||
    "mcp-solostack";
  const logLevel =
    (typeof input?.log_level === "string" && input.log_level) || "info";

  function write(level, message, metadata = null) {
    if (!shouldLog(logLevel, level)) return;
    const payload = {
      timestamp_iso: new Date().toISOString(),
      level,
      service: serviceName,
      message,
      ...(metadata ? { metadata } : {}),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  }

  return {
    debug: (message, metadata = null) => write("debug", message, metadata),
    info: (message, metadata = null) => write("info", message, metadata),
    warn: (message, metadata = null) => write("warn", message, metadata),
    error: (message, metadata = null) => write("error", message, metadata),
    auditToolCall: (metadata = null) =>
      write("info", "MCP tool call completed.", {
        event: "mcp.tool_call",
        ...asOptionalPlainObject(metadata),
      }),
  };
}
