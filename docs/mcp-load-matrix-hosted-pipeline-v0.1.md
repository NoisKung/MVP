# MCP Hosted Pipeline Run v0.1

Date: 2026-02-24
Status: FAIL

## Steps

| Step | Exit Code | Duration (ms) |
| --- | ---: | ---: |
| Preflight | 1 | 76 |

## Environment Snapshot

- `SOLOSTACK_MCP_HOSTED_BASE_URL`: not_set
- `SOLOSTACK_MCP_HOSTED_AUTH_TOKEN`: not_set
- `profile`: auto
- `config_path`: mcp-solostack/hosted-profiles.json
- `iterations`: default
- `skip_health_probe`: false

## Detail

### Preflight

Command: `node --no-warnings scripts/mcp-load-matrix-hosted-preflight.mjs --out docs/mcp-load-matrix-hosted-preflight-v0.1.md --config mcp-solostack/hosted-profiles.json`

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
