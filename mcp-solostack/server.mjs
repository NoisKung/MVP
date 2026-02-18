import { createServer } from "node:http";
import { createMcpRequestHandler } from "./app.mjs";
import { getMcpSafeConfigSummary, loadMcpConfigFromEnv } from "./config.mjs";
import { createMcpLogger } from "./logger.mjs";

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
  const logger = createMcpLogger({
    service_name: config.service_name,
    log_level: config.log_level,
  });
  const startedAtMs = Date.now();
  const server = createServer(
    createMcpRequestHandler({
      config,
      started_at_ms: startedAtMs,
      on_tool_call: (auditPayload) => {
        logger.auditToolCall(auditPayload);
      },
    }),
  );

  await startServer(server, config);
  logger.info("MCP server started.", getMcpSafeConfigSummary(config));

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
