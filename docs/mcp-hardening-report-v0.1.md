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
- Timeout guard แบบ soft limit (`duration_ms` > threshold -> `TIMEOUT`)

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
- `npm run build`

Result summary:
- MCP test suite passed (`config`, `app`, `tools`, `logger`)
- Build passed on current branch

## 4) Known Gaps (Next Hardening Wave)

- timeout guard ยังเป็น soft enforcement หลัง query จบ (ยังไม่มี query cancellation)
- ยังไม่มี persistent audit sink (ปัจจุบันเป็น stdout JSON)
- ยังไม่มี load-test profile และ p95/p99 latency report ที่ reproducible

## 5) Recommended Next Steps

1. เพิ่ม query-timeout/cancellation strategy สำหรับ hosted mode
2. เพิ่ม synthetic load script + baseline report (small/medium fixture)
3. ส่ง audit log เข้า centralized sink เมื่อเปิด hosted profile
