# MCP Hosted vs Local Baseline Comparison v0.1

Date: 2026-02-23  
Status: Pending hosted staging report

## How to Generate

```bash
npm run mcp:load-matrix:compare
```

Default inputs:
- baseline: `docs/mcp-load-matrix-v0.1.md` (profile `medium`)
- hosted: `docs/mcp-load-matrix-hosted-staging-v0.1.md`

Default output:
- `docs/mcp-load-matrix-hosted-compare-v0.1.md`

## Notes

- ผล compare จะ valid เมื่อ hosted staging report ถูก generate ด้วยข้อมูลจริงก่อน
