# mcp-solostack

Local MCP server skeleton for SoloStack.

## Run

```bash
npm run mcp:dev
```

Default bind:
- host: `127.0.0.1`
- port: `8799`

Health endpoints:
- `GET /`
- `GET /health`
- `GET /healthz`

Read tool endpoints (POST JSON):
- `/tools/get_tasks`
- `/tools/get_projects`
- `/tools/get_weekly_review`
- `/tools/search_tasks`
- `/tools/get_task_changelogs`

Generic tool route:
- `/tools` (ส่งชื่อ tool ผ่าน request body)

Example:

```json
{
  "request_id": "req-1",
  "tool": "search_tasks",
  "args": {
    "query": "release",
    "limit": 20
  }
}
```

Tool endpoints require `SOLOSTACK_MCP_DB_PATH` to point to a valid SQLite file.

## Audit Logging (Baseline)

ทุก tool call จะถูก log แบบ structured JSON ผ่าน stdout:
- `event`: `mcp.tool_call`
- `request_id`
- `tool`
- `ok`
- `status_code`
- `error_code`
- `duration_ms`
- `tool_duration_ms`
- `next_cursor`

Guardrails runtime:
- rate limit ต่อ `/tools*` (ปิดโดย default)
- timeout guard (soft limit จาก `duration_ms`, ปิดโดย default)

## Environment Variables

- `SOLOSTACK_MCP_HOST` (default: `127.0.0.1`)
- `SOLOSTACK_MCP_PORT` (default: `8799`)
- `SOLOSTACK_MCP_DB_PATH` (optional)
- `SOLOSTACK_MCP_LOG_LEVEL` (`debug|info|warn|error`, default: `info`)
- `SOLOSTACK_MCP_READ_ONLY` (`true|false`, default: `true`)
- `SOLOSTACK_MCP_ENABLE_CORS` (`true|false`, default: `false`)
- `SOLOSTACK_MCP_RATE_LIMIT_ENABLED` (`true|false`, default: `false`)
- `SOLOSTACK_MCP_RATE_LIMIT_WINDOW_MS` (`1000..3600000`, default: `60000`)
- `SOLOSTACK_MCP_RATE_LIMIT_MAX_REQUESTS` (`1..100000`, default: `120`)
- `SOLOSTACK_MCP_TIMEOUT_GUARD_ENABLED` (`true|false`, default: `false`)
- `SOLOSTACK_MCP_TOOL_TIMEOUT_MS` (`100..60000`, default: `2000`)
