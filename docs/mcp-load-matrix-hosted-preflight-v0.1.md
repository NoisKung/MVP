# MCP Hosted Preflight v0.1

Date: 2026-02-24
Status: Pending configuration

## Check Matrix

| Check | Status | Required | Detail |
| --- | --- | --- | --- |
| Hosted base URL | FAIL | yes | Missing or invalid SOLOSTACK_MCP_HOSTED_BASE_URL. |
| Hosted auth token | FAIL | yes | Missing SOLOSTACK_MCP_HOSTED_AUTH_TOKEN. |
| Audit sink mode | PASS | no | SOLOSTACK_MCP_AUDIT_SINK=stdout |
| Audit HTTP URL | PASS | no | Not required because audit sink mode is not http. |
| Hosted health probe (/health) | FAIL | yes | Cannot probe without SOLOSTACK_MCP_HOSTED_BASE_URL. |

## Next Actions

1. Hosted base URL: Set SOLOSTACK_MCP_HOSTED_BASE_URL to http(s) endpoint and re-run preflight.
2. Hosted auth token: Set SOLOSTACK_MCP_HOSTED_AUTH_TOKEN for staging/protected endpoint validation.
3. Hosted health probe (/health): Set base URL and re-run preflight.

## Environment Snapshot

- `SOLOSTACK_MCP_HOSTED_BASE_URL`: not_set
- `SOLOSTACK_MCP_HOSTED_AUTH_TOKEN`: not_set
- `SOLOSTACK_MCP_AUDIT_SINK`: stdout
- `SOLOSTACK_MCP_AUDIT_HTTP_URL`: not_set
- `SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS`: 3000
