# MCP Audit Retention Policy v0.1

Date: 2026-02-24  
Status: Decision baseline for P3-6 hosted hardening

## 1) Decision Summary

Adopt environment-based retention windows for MCP tool-call audit logs:

- `dev`: 14 days (cost-first, short troubleshooting cycle)
- `staging`: 30 days (release validation + incident lookback)
- `prod`: 90 days (security/compliance triage baseline)

Policy applies to audit events `event = mcp.tool_call` and transport errors emitted by MCP runtime.

## 2) Rationale

- 14 days in `dev` keeps storage/cost low while still covering recent regression loops.
- 30 days in `staging` covers at least one full release cycle plus delayed defect reports.
- 90 days in `prod` provides minimum history for incident correlation and abuse analysis.

## 3) Runtime Mapping

`mcp-solostack` currently enforces retention via:
- `SOLOSTACK_MCP_AUDIT_SINK` (`stdout|file|http`)
- `SOLOSTACK_MCP_AUDIT_RETENTION_DAYS` (`1..3650`, default `30`)

Recommended values by environment:

| Environment | Recommended sink | Recommended retention days |
| --- | --- | ---: |
| dev | `file` or `stdout` | `14` |
| staging | `file` or `http` | `30` |
| prod | `http` (+ centralized store) | `90` |

## 4) Hosted Hardening Gate

For hosted staging sign-off:
- Preflight should pass with:
  - valid hosted URL/token
  - health probe success
  - audit retention baseline >= 30 days when sink is `file`/`http`
- `stdout` sink is allowed for local experiments but should be treated as warning for hosted evidence.

## 5) Example Env Snippets

Staging:

```bash
SOLOSTACK_MCP_AUDIT_SINK=file
SOLOSTACK_MCP_AUDIT_LOG_DIR=/var/log/solostack/mcp
SOLOSTACK_MCP_AUDIT_RETENTION_DAYS=30
```

Production (centralized HTTP sink):

```bash
SOLOSTACK_MCP_AUDIT_SINK=http
SOLOSTACK_MCP_AUDIT_HTTP_URL=https://audit.example.com/v1/events
SOLOSTACK_MCP_AUDIT_HTTP_AUTH_TOKEN=<token>
SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS=3000
SOLOSTACK_MCP_AUDIT_RETENTION_DAYS=90
```

## 6) Follow-up

- Revisit policy after first 30 days of hosted telemetry to adjust based on observed event volume and storage cost.
