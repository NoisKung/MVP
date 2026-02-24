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

## Audit Logging

ทุก tool call จะถูก log แบบ structured JSON:
- `event`: `mcp.tool_call`
- `request_id`
- `tool`
- `ok`
- `status_code`
- `error_code`
- `duration_ms`
- `tool_duration_ms`
- `next_cursor`

Audit sink modes:
- `stdout` (default): log ผ่าน console/stdout
- `file`: เขียน JSONL ไฟล์แบบรายวัน (`mcp-tool-call-YYYY-MM-DD.log`) พร้อม retention pruning
- `http`: ส่ง audit event ไป centralized endpoint แบบ `POST` JSON ต่อ event

Guardrails runtime:
- rate limit ต่อ `/tools*` (ปิดโดย default)
- timeout guard:
  - `soft` = ตรวจหลัง query จบจาก `duration_ms`
  - `worker_hard` = รัน query ใน worker และ terminate เมื่อ timeout เกิน

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
- `SOLOSTACK_MCP_TIMEOUT_STRATEGY` (`soft|worker_hard`, default: `soft`)
- `SOLOSTACK_MCP_TOOL_TIMEOUT_MS` (`100..60000`, default: `2000`)
- `SOLOSTACK_MCP_AUDIT_SINK` (`stdout|file|http`, default: `stdout`)
- `SOLOSTACK_MCP_AUDIT_LOG_DIR` (default: `mcp-solostack/audit`)
- `SOLOSTACK_MCP_AUDIT_RETENTION_DAYS` (`1..3650`, default: `30`)
- `SOLOSTACK_MCP_AUDIT_HTTP_URL` (required เมื่อ `SOLOSTACK_MCP_AUDIT_SINK=http`)
- `SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS` (`100..60000`, default: `3000`)
- `SOLOSTACK_MCP_AUDIT_HTTP_AUTH_TOKEN` (optional bearer token)

## Load Matrix

รัน baseline load/perf matrix (small + medium fixture):

```bash
npm run mcp:load-matrix
```

output default:
- `docs/mcp-load-matrix-v0.1.md`

Hosted staging load matrix:

```bash
SOLOSTACK_MCP_HOSTED_BASE_URL=https://<hosted-endpoint> \
SOLOSTACK_MCP_HOSTED_AUTH_TOKEN=<token> \
npm run mcp:load-matrix:hosted
```

output default:
- `docs/mcp-load-matrix-hosted-staging-v0.1.md`

Hosted staging preflight (env + health probe):

```bash
npm run mcp:load-matrix:hosted:preflight
```

output default:
- `docs/mcp-load-matrix-hosted-preflight-v0.1.md`

Compare hosted vs local baseline:

```bash
npm run mcp:load-matrix:compare
```

output default:
- `docs/mcp-load-matrix-hosted-compare-v0.1.md`
