import {
  MCP_READ_TOOLS,
  ToolExecutionError,
  executeReadTool,
} from "./tools.mjs";

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function buildCorsHeaders(enableCors) {
  if (!enableCors) return {};
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
}

async function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    const maxBytes = 256 * 1024;

    request.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new Error("Request body is too large."));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const payloadText = Buffer.concat(chunks).toString("utf-8").trim();
      if (!payloadText) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(payloadText));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", (error) => {
      reject(error);
    });
  });
}

export function createMcpRequestHandler(input) {
  const config = input.config;
  const startedAtMs = input.started_at_ms ?? Date.now();

  return async function handleRequest(request, response) {
    const corsHeaders = buildCorsHeaders(config.enable_cors);
    const method = (request.method ?? "GET").toUpperCase();
    const url = new URL(request.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    if (method === "OPTIONS") {
      response.writeHead(204, corsHeaders);
      response.end();
      return;
    }

    const isToolRoute =
      method === "POST" &&
      (pathname === "/tools" ||
        pathname === "/tools/" ||
        pathname.startsWith("/tools/"));

    if (isToolRoute) {
      let requestId = null;
      let toolName = null;
      try {
        const parsedBody = await parseJsonBody(request);
        requestId =
          (typeof parsedBody?.request_id === "string" &&
            parsedBody.request_id.trim()) ||
          null;
        const toolFromPath = pathname.startsWith("/tools/")
          ? pathname.slice("/tools/".length).trim()
          : null;
        toolName = toolFromPath || parsedBody?.tool || null;
        const args =
          parsedBody && typeof parsedBody === "object" ? parsedBody.args : null;
        const result = executeReadTool({
          tool: toolName,
          args,
          db_path: config.db_path,
        });

        sendJson(
          response,
          200,
          {
            request_id: requestId,
            tool: result.tool,
            ok: true,
            data: result.data,
            meta: {
              duration_ms: result.duration_ms,
              next_cursor: result.data.next_cursor,
            },
            error: null,
          },
          corsHeaders,
        );
      } catch (error) {
        if (error instanceof ToolExecutionError) {
          sendJson(
            response,
            error.status,
            {
              request_id: requestId,
              tool: toolName,
              ok: false,
              data: null,
              meta: null,
              error: {
                code: error.code,
                message: error.message,
                retry_after_ms: error.retry_after_ms,
                details: error.details,
              },
            },
            corsHeaders,
          );
          return;
        }

        sendJson(
          response,
          400,
          {
            request_id: requestId,
            tool: toolName,
            ok: false,
            data: null,
            meta: null,
            error: {
              code: "INVALID_ARGUMENT",
              message:
                error instanceof Error
                  ? error.message
                  : "Unable to process request.",
              retry_after_ms: null,
              details: null,
            },
          },
          corsHeaders,
        );
      }
      return;
    }

    if (method !== "GET") {
      sendJson(
        response,
        405,
        {
          status: "error",
          message: "Method not allowed.",
        },
        corsHeaders,
      );
      return;
    }

    if (pathname === "/" || pathname === "/health" || pathname === "/healthz") {
      sendJson(
        response,
        200,
        {
          status: "ok",
          service: config.service_name,
          version: config.version,
          uptime_seconds: Math.max(
            0,
            Math.floor((Date.now() - startedAtMs) / 1000),
          ),
          timestamp_iso: new Date().toISOString(),
          ready: true,
          mode: config.read_only ? "read_only" : "read_write",
          tools: MCP_READ_TOOLS,
        },
        corsHeaders,
      );
      return;
    }

    sendJson(
      response,
      404,
      {
        status: "error",
        message: "Not found.",
        available_routes: [
          "/",
          "/health",
          "/healthz",
          "/tools",
          "/tools/<tool>",
        ],
      },
      corsHeaders,
    );
  };
}
