// @vitest-environment node

import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpRequestHandler } from "./app.mjs";
import { loadMcpConfigFromEnv } from "./config.mjs";

async function startServer(handler: Parameters<typeof createServer>[0]) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve test server address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closers.length > 0) {
    const close = closers.pop();
    if (!close) continue;
    await close();
  }
});

describe("mcp-solostack app health routes", () => {
  it("returns health payload for /health", async () => {
    const config = loadMcpConfigFromEnv({
      SOLOSTACK_MCP_PORT: "9000",
    });
    const { baseUrl, close } = await startServer(
      createMcpRequestHandler({
        config,
        started_at_ms: Date.now() - 2500,
      }),
    );
    closers.push(close);

    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("mcp-solostack");
    expect(payload.ready).toBe(true);
    expect(payload.mode).toBe("read_only");
  });

  it("returns 404 for unknown route", async () => {
    const config = loadMcpConfigFromEnv({});
    const { baseUrl, close } = await startServer(
      createMcpRequestHandler({ config }),
    );
    closers.push(close);

    const response = await fetch(`${baseUrl}/unknown`);
    expect(response.status).toBe(404);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.status).toBe("error");
    expect(payload.message).toBe("Not found.");
  });
});
