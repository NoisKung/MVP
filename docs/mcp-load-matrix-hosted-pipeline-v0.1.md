# MCP Hosted Pipeline Run v0.1

Date: 2026-02-24
Status: FAIL

## Steps

| Step | Exit Code | Duration (ms) |
| --- | ---: | ---: |
| Preflight | 1 | 70 |

## Environment Snapshot

- `SOLOSTACK_MCP_HOSTED_BASE_URL`: not_set
- `SOLOSTACK_MCP_HOSTED_AUTH_TOKEN`: not_set
- `iterations`: default
- `skip_health_probe`: false

## Detail

### Preflight

Command: `node --no-warnings scripts/mcp-load-matrix-hosted-preflight.mjs --out docs/mcp-load-matrix-hosted-preflight-v0.1.md`

Exit code: 1

stdout:
```text
Hosted preflight report generated: docs/mcp-load-matrix-hosted-preflight-v0.1.md
```

stderr:
```text
(empty)
```

## Next Actions

1. Resolve failures in the first non-zero step above.
2. Re-run `npm run mcp:load-matrix:hosted:pipeline` after environment is ready.
