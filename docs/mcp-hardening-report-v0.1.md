# MCP Hardening Report v0.1

Date: 2026-02-23  
Scope: `mcp-solostack` read-only runtime baseline

## 1) What Was Hardened

- Query bounds enforced per tool (`limit`, `cursor`, bounded defaults/max)
- Request body cap (`256KB`) for POST tool endpoints
- Deterministic ordering for pagination safety (`updated_at DESC, id DESC` / `created_at DESC, id DESC`)
- Structured error envelope with stable codes (`INVALID_ARGUMENT`, `NOT_FOUND`, `INTERNAL_ERROR`)
- Audit logging baseline for every tool call (`event = mcp.tool_call`)
- Audit sink mode `file` พร้อม daily JSONL + retention pruning
- เพิ่ม audit sink mode `http` สำหรับส่ง event เข้า centralized endpoint โดยตรง
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
- เพิ่ม hosted load tooling:
  - `npm run mcp:load-matrix:hosted`
  - `npm run mcp:load-matrix:compare`
- Build passed on current branch

## 4) Known Gaps (Next Hardening Wave)

- ยังไม่มีผลการรัน hosted staging matrix จริงใน repo นี้ (มี tooling พร้อมแล้ว)

## 5) Recommended Next Steps

1. รัน `npm run mcp:load-matrix:hosted` กับ endpoint staging จริง
2. รัน `npm run mcp:load-matrix:compare` แล้วแนบ report เข้า PR/release notes
3. ส่ง file audit sink เข้า centralized sink (CloudWatch/S3) ตาม retention policy ของ environment
4. ถ้าใช้ `http` sink ให้ผูก `SOLOSTACK_MCP_AUDIT_HTTP_URL` และตรวจ delivery/error-rate บน staging ก่อน production
