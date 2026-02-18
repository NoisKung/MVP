# MCP Hardening Report v0.1

Date: 2026-02-18  
Scope: `mcp-solostack` read-only runtime baseline

## 1) What Was Hardened

- Query bounds enforced per tool (`limit`, `cursor`, bounded defaults/max)
- Request body cap (`256KB`) for POST tool endpoints
- Deterministic ordering for pagination safety (`updated_at DESC, id DESC` / `created_at DESC, id DESC`)
- Structured error envelope with stable codes (`INVALID_ARGUMENT`, `NOT_FOUND`, `INTERNAL_ERROR`)
- Audit logging baseline for every tool call (`event = mcp.tool_call`)

## 2) Failure Handling Coverage

- Invalid JSON body -> `400 INVALID_ARGUMENT`
- Missing/invalid tool args -> `400 INVALID_ARGUMENT`
- Missing DB path -> `400 INVALID_ARGUMENT`
- SQLite file not found -> `404 NOT_FOUND`
- Unexpected runtime/query failure -> `500 INTERNAL_ERROR`

## 3) Verification Snapshot

Validation commands run:
- `npx vitest run mcp-solostack/*.test.ts`
- `npm run build`

Result summary:
- MCP test suite passed (`config`, `app`, `tools`, `logger`)
- Build passed on current branch

## 4) Known Gaps (Next Hardening Wave)

- ยังไม่มี rate limiter ระดับ endpoint/tool
- ยังไม่มี per-call timeout enforcement ใน query layer
- ยังไม่มี persistent audit sink (ปัจจุบันเป็น stdout JSON)
- ยังไม่มี load-test profile และ p95/p99 latency report ที่ reproducible

## 5) Recommended Next Steps

1. เพิ่ม in-memory token bucket rate limiter สำหรับ `/tools*`
2. ทำ query timeout strategy สำหรับ heavy reads (hosted mode priority)
3. เพิ่ม synthetic load script + baseline report (small/medium fixture)
4. ส่ง audit log เข้า centralized sink เมื่อเปิด hosted profile
