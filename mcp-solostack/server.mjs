import { createServer } from "node:http";
import { createMcpRequestHandler } from "./app.mjs";
import { getMcpSafeConfigSummary, loadMcpConfigFromEnv } from "./config.mjs";

function log(level, message, metadata = null) {
  const payload = {
    timestamp_iso: new Date().toISOString(),
    level,
    service: "mcp-solostack",
    message,
    ...(metadata ? { metadata } : {}),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

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
  const startedAtMs = Date.now();
  const server = createServer(
    createMcpRequestHandler({
      config,
      started_at_ms: startedAtMs,
    }),
  );

  await startServer(server, config);
  log("info", "MCP server started.", getMcpSafeConfigSummary(config));

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("info", "Shutdown signal received.", { signal });
    try {
      await closeServer(server);
      log("info", "MCP server stopped.");
      process.exit(0);
    } catch (error) {
      log("error", "Failed to close MCP server cleanly.", {
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
  log("error", "Unable to start MCP server.", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
