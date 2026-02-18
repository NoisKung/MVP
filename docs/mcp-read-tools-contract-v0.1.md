# MCP Read Tools Contract v0.1

Date: 2026-02-18  
Status: Draft (read-only baseline)

## 1) Common Request Envelope

```json
{
  "request_id": "string-uuid",
  "tool": "get_tasks",
  "args": {},
  "context": {
    "session_id": "string",
    "trace_id": "string"
  }
}
```

Rules:
- `request_id` ต้อง unique ต่อ call
- ทุก tool ต้องมี query bounds (`limit`, `cursor`, `timeout_ms`) ตามที่เกี่ยวข้อง

## 2) Common Response Envelope

```json
{
  "request_id": "string-uuid",
  "tool": "get_tasks",
  "ok": true,
  "data": {},
  "meta": {
    "duration_ms": 0,
    "next_cursor": null
  },
  "error": null
}
```

Error shape:

```json
{
  "code": "INVALID_ARGUMENT",
  "message": "Human-readable message",
  "retry_after_ms": null,
  "details": {}
}
```

## 3) Tool Contracts

## `get_tasks`

Args:
- `limit` (default 50, max 500)
- `cursor` (optional)
- `status` (`TODO|DOING|DONE|ARCHIVED`, optional)
- `project_id` (optional)
- `search` (optional)
- `timeout_ms` (default 1500, max 5000)

Returns:
- `items`: task[]
- `next_cursor`: string | null

## `get_projects`

Args:
- `limit` (default 50, max 200)
- `cursor` (optional)
- `status` (`ACTIVE|COMPLETED|ARCHIVED`, optional)
- `timeout_ms` (default 1500, max 5000)

Returns:
- `items`: project[]
- `next_cursor`: string | null

## `get_weekly_review`

Args:
- `week_start_iso` (optional; default current week)
- `timezone` (optional)
- `timeout_ms` (default 1500, max 5000)

Returns:
- `snapshot`: weekly review payload ตาม model ปัจจุบัน

## `search_tasks`

Args:
- `query` (required)
- `limit` (default 30, max 200)
- `cursor` (optional)
- `timeout_ms` (default 1500, max 5000)

Returns:
- `items`: matched task[]
- `next_cursor`: string | null

## `get_task_changelogs`

Args:
- `task_id` (required)
- `limit` (default 20, max 200)
- `cursor` (optional)
- `timeout_ms` (default 1500, max 5000)

Returns:
- `items`: changelog[]
- `next_cursor`: string | null

## 4) Error Codes

- `INVALID_ARGUMENT`
- `NOT_FOUND`
- `TIMEOUT`
- `RATE_LIMITED`
- `UNAUTHORIZED`
- `INTERNAL_ERROR`
- `UNAVAILABLE`

## 5) Guardrails

- Read-only only (no mutation tools)
- Enforce `limit` and `timeout_ms` ทุก call
- Reject unknown fields ใน args
- Return deterministic ordering สำหรับ pagination safety
