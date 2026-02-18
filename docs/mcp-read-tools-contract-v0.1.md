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
- ทุก tool ต้องมี query bounds (`limit`, `cursor`) ตามที่เกี่ยวข้อง
- เรียกได้ทั้ง path mode (`POST /tools/<tool>`) และ generic mode (`POST /tools` + `tool` ใน body)

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

Returns:
- `items`: task[]
- `next_cursor`: string | null

## `get_projects`

Args:
- `limit` (default 50, max 200)
- `cursor` (optional)
- `status` (`ACTIVE|COMPLETED|ARCHIVED`, optional)

Returns:
- `items`: project[]
- `next_cursor`: string | null

## `get_weekly_review`

Args:
- `week_start_iso` (optional; default current week)
- `item_limit` (default 20, max 100)

Returns:
- `completed_count`, `created_count`, `pending_count`, `overdue_count`, `carry_over_count`, `due_this_week_open_count`
- `completed_tasks`, `pending_tasks`, `overdue_tasks`

## `search_tasks`

Args:
- `query` (required)
- `limit` (default 30, max 200)
- `cursor` (optional)
- `status` (`TODO|DOING|DONE|ARCHIVED`, optional)

Returns:
- `items`: matched task[]
- `next_cursor`: string | null

## `get_task_changelogs`

Args:
- `task_id` (required)
- `limit` (default 20, max 200)
- `cursor` (optional)

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
- Enforce `limit` bounds ทุก call
- Return deterministic ordering สำหรับ pagination safety
