# MCP Hardening Report v0.1

Date: 2026-02-18  
Scope: `mcp-solostack` read-only runtime baseline

## 1) What Was Hardened

- Query bounds enforced per tool (`limit`, `cursor`, bounded defaults/max)
- Request body cap (`256KB`) for POST tool endpoints
- Deterministic ordering for pagination safety (`updated_at DESC, id DESC` / `created_at DESC, id DESC`)
- Structured error envelope with stable codes (`INVALID_ARGUMENT`, `NOT_FOUND`, `INTERNAL_ERROR`)
- Audit logging baseline for every tool call (`event = mcp.tool_call`)
- In-memory rate limiter สำหรับ `/tools*` (fixed window, configurable)
- Timeout guard แบบ configurable:
  - `soft` (duration-based post-check)
  - `worker_hard` (terminate worker on timeout)

## 2) Failure Handling Coverage

- Invalid JSON body -> `400 INVALID_ARGUMENT`
- Missing/invalid tool args -> `400 INVALID_ARGUMENT`
- Missing DB path -> `400 INVALID_ARGUMENT`
- SQLite file not found -> `404 NOT_FOUND`
- Rate limit exceeded -> `429 RATE_LIMITED`
- Tool duration exceeded timeout guard -> `504 TIMEOUT`
- Unexpected runtime/query failure -> `500 INTERNAL_ERROR`

## 3) Verification Snapshot

Validation commands run:
- `npx vitest run mcp-solostack/*.test.ts`
- `npm run mcp:load-matrix`
- `npm run build`

Result summary:
- MCP test suite passed (`config`, `app`, `tools`, `logger`, `tool-executor`)
- load/perf matrix baseline ถูก generate ที่ `docs/mcp-load-matrix-v0.1.md`
- Build passed on current branch

## 4) Known Gaps (Next Hardening Wave)

- ยังไม่มี persistent audit sink (ปัจจุบันเป็น stdout JSON)
- ยังไม่มี hosted staging load/perf comparison กับ local baseline

## 5) Recommended Next Steps

1. รัน load matrix ใน hosted staging แล้วเทียบกับ `docs/mcp-load-matrix-v0.1.md`
2. ส่ง audit log เข้า centralized sink พร้อม retention policy
3. เพิ่ม alert threshold จาก p95/p99 ใน hosted profile
