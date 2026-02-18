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

Tool endpoints require `SOLOSTACK_MCP_DB_PATH` to point to a valid SQLite file.

## Environment Variables

- `SOLOSTACK_MCP_HOST` (default: `127.0.0.1`)
- `SOLOSTACK_MCP_PORT` (default: `8799`)
- `SOLOSTACK_MCP_DB_PATH` (optional)
- `SOLOSTACK_MCP_LOG_LEVEL` (`debug|info|warn|error`, default: `info`)
- `SOLOSTACK_MCP_READ_ONLY` (`true|false`, default: `true`)
- `SOLOSTACK_MCP_ENABLE_CORS` (`true|false`, default: `false`)
