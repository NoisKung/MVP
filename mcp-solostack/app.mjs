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

function getClientIp(request) {
  const rawForwardedFor = request.headers["x-forwarded-for"];
  const forwardedFor = Array.isArray(rawForwardedFor)
    ? rawForwardedFor[0]
    : rawForwardedFor;
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  if (typeof request.socket?.remoteAddress === "string") {
    return request.socket.remoteAddress;
  }
  return null;
}

function createFixedWindowRateLimiter(input) {
  const buckets = new Map();

  return {
    consume(key, nowMs = Date.now()) {
      const normalizedKey = key || "unknown";
      const windowStartThreshold = nowMs - input.window_ms;
      const currentBucket = buckets.get(normalizedKey);

      if (
        !currentBucket ||
        currentBucket.window_started_at_ms <= windowStartThreshold
      ) {
        buckets.set(normalizedKey, {
          window_started_at_ms: nowMs,
          count: 1,
        });
        return {
          allowed: true,
          retry_after_ms: null,
          remaining: Math.max(0, input.max_requests - 1),
        };
      }

      if (currentBucket.count >= input.max_requests) {
        const retryAfterMs = Math.max(
          1,
          currentBucket.window_started_at_ms + input.window_ms - nowMs,
        );
        return {
          allowed: false,
          retry_after_ms: retryAfterMs,
          remaining: 0,
        };
      }

      currentBucket.count += 1;
      return {
        allowed: true,
        retry_after_ms: null,
        remaining: Math.max(0, input.max_requests - currentBucket.count),
      };
    },
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
  const executeTool =
    typeof input.execute_tool === "function"
      ? input.execute_tool
      : executeReadTool;
  const onToolCall =
    typeof input.on_tool_call === "function" ? input.on_tool_call : null;
  const rateLimiter = config.rate_limit_enabled
    ? createFixedWindowRateLimiter({
        window_ms: config.rate_limit_window_ms,
        max_requests: config.rate_limit_max_requests,
      })
    : null;

  function emitToolCallAudit(payload) {
    if (!onToolCall) return;
    try {
      onToolCall(payload);
    } catch {
      // Best-effort logging only; never block request path.
    }
  }

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
      const requestStartedAtMs = Date.now();
      const clientIp = getClientIp(request);
      let rateLimitState = null;
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

        if (rateLimiter) {
          rateLimitState = rateLimiter.consume(clientIp);
          if (!rateLimitState.allowed) {
            throw new ToolExecutionError({
              code: "RATE_LIMITED",
              status: 429,
              message: "Rate limit exceeded for tool calls.",
              retry_after_ms: rateLimitState.retry_after_ms,
              details: {
                window_ms: config.rate_limit_window_ms,
                max_requests: config.rate_limit_max_requests,
              },
            });
          }
        }

        const result = await Promise.resolve(
          executeTool({
            tool: toolName,
            args,
            db_path: config.db_path,
          }),
        );

        if (
          config.timeout_guard_enabled &&
          config.timeout_strategy !== "worker_hard" &&
          result.duration_ms > config.tool_timeout_ms
        ) {
          throw new ToolExecutionError({
            code: "TIMEOUT",
            status: 504,
            message: `Tool execution exceeded timeout guard (${config.tool_timeout_ms}ms).`,
            retry_after_ms: 250,
            details: {
              duration_ms: result.duration_ms,
              timeout_limit_ms: config.tool_timeout_ms,
            },
          });
        }

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
        emitToolCallAudit({
          request_id: requestId,
          tool: result.tool,
          ok: true,
          status_code: 200,
          error_code: null,
          route: pathname,
          method,
          client_ip: clientIp,
          duration_ms: Math.max(0, Date.now() - requestStartedAtMs),
          tool_duration_ms: result.duration_ms,
          next_cursor: result.data.next_cursor ?? null,
          rate_limit_remaining: rateLimitState?.remaining ?? null,
        });
      } catch (error) {
        if (error instanceof ToolExecutionError) {
          emitToolCallAudit({
            request_id: requestId,
            tool: toolName,
            ok: false,
            status_code: error.status,
            error_code: error.code,
            route: pathname,
            method,
            client_ip: clientIp,
            duration_ms: Math.max(0, Date.now() - requestStartedAtMs),
            tool_duration_ms: null,
            next_cursor: null,
            retry_after_ms: error.retry_after_ms,
            rate_limit_remaining: rateLimitState?.remaining ?? null,
          });
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

        emitToolCallAudit({
          request_id: requestId,
          tool: toolName,
          ok: false,
          status_code: 400,
          error_code: "INVALID_ARGUMENT",
          route: pathname,
          method,
          client_ip: clientIp,
          duration_ms: Math.max(0, Date.now() - requestStartedAtMs),
          tool_duration_ms: null,
          next_cursor: null,
          retry_after_ms: null,
          rate_limit_remaining: rateLimitState?.remaining ?? null,
        });
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
          guardrails: {
            rate_limit_enabled: config.rate_limit_enabled,
            rate_limit_window_ms: config.rate_limit_window_ms,
            rate_limit_max_requests: config.rate_limit_max_requests,
            timeout_guard_enabled: config.timeout_guard_enabled,
            timeout_strategy: config.timeout_strategy,
            tool_timeout_ms: config.tool_timeout_ms,
          },
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
