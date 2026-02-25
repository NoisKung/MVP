import { createServer } from "node:http";
import { createMcpRequestHandler } from "./app.mjs";
import { createFileAuditSink, createHttpAuditSink } from "./audit-sink.mjs";
import { getMcpSafeConfigSummary, loadMcpConfigFromEnv } from "./config.mjs";
import { createMcpLogger } from "./logger.mjs";
import { createToolExecutor } from "./tool-executor.mjs";

async function startServer(server, config) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(config.port, config.host);
  });
}

async function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const config = loadMcpConfigFromEnv(process.env);
  const bootstrapLogger = createMcpLogger({
    service_name: config.service_name,
    log_level: config.log_level,
  });
  let auditSink = null;
  if (config.audit_sink === "file") {
    auditSink = createFileAuditSink({
      directory_path: config.audit_log_directory,
      retention_days: config.audit_retention_days,
    });
  } else if (config.audit_sink === "http") {
    auditSink = createHttpAuditSink({
      url: config.audit_http_url,
      timeout_ms: config.audit_http_timeout_ms,
      auth_token: config.audit_http_auth_token,
      on_error: (error, payload) => {
        bootstrapLogger.warn("Unable to send MCP audit payload to HTTP sink.", {
          event: "mcp.audit_sink_http_failed",
          error: error instanceof Error ? error.message : String(error),
          audit_event: payload?.event ?? null,
          tool: payload?.tool ?? null,
          status_code: payload?.status_code ?? null,
        });
      },
    });
  }
  const logger = createMcpLogger({
    service_name: config.service_name,
    log_level: config.log_level,
    audit_sink: auditSink,
  });
  const toolExecutor = createToolExecutor(config);
  const startedAtMs = Date.now();
  const server = createServer(
    createMcpRequestHandler({
      config,
      started_at_ms: startedAtMs,
      execute_tool: (toolCallInput) => toolExecutor.execute(toolCallInput),
      on_tool_call: (auditPayload) => {
        logger.auditToolCall(auditPayload);
      },
    }),
  );

  await startServer(server, config);
  logger.info("MCP server started.", {
    ...getMcpSafeConfigSummary(config),
    tool_executor_mode: toolExecutor.mode,
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutdown signal received.", { signal });
    try {
      await closeServer(server);
      logger.info("MCP server stopped.");
      process.exit(0);
    } catch (error) {
      logger.error("Failed to close MCP server cleanly.", {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error) => {
  const logger = createMcpLogger({
    service_name: "mcp-solostack",
    log_level: "error",
  });
  logger.error("Unable to start MCP server.", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
