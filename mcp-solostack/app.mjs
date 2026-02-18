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
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
}

export function createMcpRequestHandler(input) {
  const config = input.config;
  const startedAtMs = input.started_at_ms ?? Date.now();

  return function handleRequest(request, response) {
    const corsHeaders = buildCorsHeaders(config.enable_cors);
    const method = (request.method ?? "GET").toUpperCase();
    const url = new URL(request.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    if (method === "OPTIONS") {
      response.writeHead(204, corsHeaders);
      response.end();
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
          uptime_seconds: Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
          timestamp_iso: new Date().toISOString(),
          ready: true,
          mode: config.read_only ? "read_only" : "read_write",
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
        available_routes: ["/", "/health", "/healthz"],
      },
      corsHeaders,
    );
  };
}
