# MCP Hosted Load Matrix v0.1

Date: 2026-02-23  
Status: Pending hosted staging run

## How to Generate

```bash
# one-time setup:
cp mcp-solostack/hosted-profiles.example.json mcp-solostack/hosted-profiles.json

# profile-based (recommended):
npm run mcp:load-matrix:hosted:pipeline -- --profile localhost
npm run mcp:load-matrix:hosted:pipeline -- --profile cloud

# or default pipeline:
npm run mcp:load-matrix:hosted:pipeline

# or manual sequence:
npm run mcp:load-matrix:hosted:preflight -- --profile cloud

SOLOSTACK_MCP_HOSTED_BASE_URL=https://<hosted-endpoint> \
SOLOSTACK_MCP_HOSTED_AUTH_TOKEN=<token> \
npm run mcp:load-matrix:hosted
```

Default output:
- `docs/mcp-load-matrix-hosted-preflight-v0.1.md`
- `docs/mcp-load-matrix-hosted-staging-v0.1.md`
- `docs/mcp-load-matrix-hosted-pipeline-v0.1.md`

## Notes

- Report นี้ถูกสร้างเป็น placeholder เพื่อรองรับ workflow hosted comparison
- ต้องรันใน environment staging จริงก่อนใช้เป็น evidence สำหรับ sign-off
