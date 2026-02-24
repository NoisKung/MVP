# SoloStack Sync Backend API Examples v0.1

Date: 2026-02-23  
Audience: Backend implementers (custom sync service or connector gateway)

## 1) Scope

This document provides concrete request/response examples for:
- `POST /v1/sync/push`
- `POST /v1/sync/pull`
- error envelope format

The examples match SoloStack client parser expectations in:
- `src/lib/sync-contract.ts`
- `src/lib/types.ts`

## 2) Data Contract Summary

### 2.1 SyncPushRequest

```json
{
  "schema_version": 1,
  "device_id": "string",
  "base_cursor": "string-or-null",
  "changes": [
    {
      "entity_type": "PROJECT|TASK|TASK_SUBTASK|TASK_TEMPLATE|SETTING",
      "entity_id": "string",
      "operation": "UPSERT|DELETE",
      "updated_at": "ISO-8601 datetime",
      "updated_by_device": "string",
      "sync_version": 1,
      "payload": {},
      "idempotency_key": "string"
    }
  ]
}
```

### 2.2 SyncPushResponse

```json
{
  "accepted": ["idempotency-key-1", "idempotency-key-2"],
  "rejected": [
    {
      "idempotency_key": "idempotency-key-3",
      "reason": "INVALID_ENTITY|INVALID_OPERATION|SCHEMA_MISMATCH|CONFLICT|VALIDATION_ERROR",
      "message": "human-readable reason"
    }
  ],
  "server_cursor": "cursor-token",
  "server_time": "ISO-8601 datetime"
}
```

### 2.3 SyncPullRequest

```json
{
  "schema_version": 1,
  "device_id": "string",
  "cursor": "string-or-null",
  "limit": 200
}
```

### 2.4 SyncPullResponse

```json
{
  "server_cursor": "cursor-token",
  "server_time": "ISO-8601 datetime",
  "changes": [
    {
      "entity_type": "PROJECT|TASK|TASK_SUBTASK|TASK_TEMPLATE|SETTING",
      "entity_id": "string",
      "operation": "UPSERT|DELETE",
      "updated_at": "ISO-8601 datetime",
      "updated_by_device": "string",
      "sync_version": 1,
      "payload": {},
      "idempotency_key": "string"
    }
  ],
  "has_more": false
}
```

### 2.5 Error Envelope (non-2xx)

```json
{
  "code": "SCHEMA_MISMATCH|UNAUTHORIZED|FORBIDDEN|RATE_LIMITED|INVALID_CURSOR|VALIDATION_ERROR|INTERNAL_ERROR|UNAVAILABLE",
  "message": "human-readable message",
  "retry_after_ms": 3000,
  "details": {
    "any": "object"
  }
}
```

## 3) Endpoint Example: Push

### 3.1 Request

```http
POST /v1/sync/push HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "schema_version": 1,
  "device_id": "dev-mac-001",
  "base_cursor": "c_2026_02_23_000120",
  "changes": [
    {
      "entity_type": "PROJECT",
      "entity_id": "proj-alpha",
      "operation": "UPSERT",
      "updated_at": "2026-02-23T09:00:00.000Z",
      "updated_by_device": "dev-mac-001",
      "sync_version": 2,
      "payload": {
        "id": "proj-alpha",
        "name": "Alpha",
        "description": "Project Alpha",
        "color": "#3B82F6",
        "status": "ACTIVE",
        "created_at": "2026-02-20T08:00:00.000Z",
        "updated_at": "2026-02-23T09:00:00.000Z",
        "sync_version": 2,
        "updated_by_device": "dev-mac-001"
      },
      "idempotency_key": "dev-mac-001:outbox-1001"
    },
    {
      "entity_type": "TASK",
      "entity_id": "task-001",
      "operation": "UPSERT",
      "updated_at": "2026-02-23T09:01:00.000Z",
      "updated_by_device": "dev-mac-001",
      "sync_version": 3,
      "payload": {
        "id": "task-001",
        "title": "Draft release notes",
        "description": "v0.1.0 draft",
        "notes_markdown": "## Notes",
        "project_id": "proj-alpha",
        "status": "TODO",
        "priority": "NORMAL",
        "is_important": 0,
        "due_at": null,
        "remind_at": null,
        "recurrence": "NONE",
        "created_at": "2026-02-22T10:00:00.000Z",
        "updated_at": "2026-02-23T09:01:00.000Z",
        "sync_version": 3,
        "updated_by_device": "dev-mac-001"
      },
      "idempotency_key": "dev-mac-001:outbox-1002"
    }
  ]
}
```

### 3.2 Success Response with Partial Rejection

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "accepted": ["dev-mac-001:outbox-1001"],
  "rejected": [
    {
      "idempotency_key": "dev-mac-001:outbox-1002",
      "reason": "VALIDATION_ERROR",
      "message": "TASK.status must be one of TODO, DOING, DONE, ARCHIVED."
    }
  ],
  "server_cursor": "c_2026_02_23_000130",
  "server_time": "2026-02-23T09:01:05.000Z"
}
```

## 4) Endpoint Example: Pull (Paged)

### 4.1 First Page Request

```http
POST /v1/sync/pull HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "schema_version": 1,
  "device_id": "dev-mac-001",
  "cursor": "c_2026_02_23_000130",
  "limit": 2
}
```

### 4.2 First Page Response (`has_more=true`)

```json
{
  "server_cursor": "c_2026_02_23_000131",
  "server_time": "2026-02-23T09:01:20.000Z",
  "changes": [
    {
      "entity_type": "TASK",
      "entity_id": "task-901",
      "operation": "UPSERT",
      "updated_at": "2026-02-23T09:01:10.000Z",
      "updated_by_device": "dev-ios-017",
      "sync_version": 4,
      "payload": {
        "id": "task-901",
        "title": "QA smoke test",
        "description": null,
        "notes_markdown": null,
        "project_id": "proj-alpha",
        "status": "DOING",
        "priority": "NORMAL",
        "is_important": 0,
        "due_at": null,
        "remind_at": null,
        "recurrence": "NONE",
        "created_at": "2026-02-22T11:00:00.000Z",
        "updated_at": "2026-02-23T09:01:10.000Z",
        "sync_version": 4,
        "updated_by_device": "dev-ios-017"
      },
      "idempotency_key": "srv:chg-80001"
    },
    {
      "entity_type": "TASK_SUBTASK",
      "entity_id": "subtask-444",
      "operation": "DELETE",
      "updated_at": "2026-02-23T09:01:11.000Z",
      "updated_by_device": "dev-ios-017",
      "sync_version": 2,
      "payload": null,
      "idempotency_key": "srv:chg-80002"
    }
  ],
  "has_more": true
}
```

### 4.3 Next Page Request

```json
{
  "schema_version": 1,
  "device_id": "dev-mac-001",
  "cursor": "c_2026_02_23_000131",
  "limit": 2
}
```

### 4.4 Next Page Response (`has_more=false`)

```json
{
  "server_cursor": "c_2026_02_23_000132",
  "server_time": "2026-02-23T09:01:22.000Z",
  "changes": [
    {
      "entity_type": "SETTING",
      "entity_id": "theme.mode",
      "operation": "UPSERT",
      "updated_at": "2026-02-23T09:01:15.000Z",
      "updated_by_device": "dev-web-102",
      "sync_version": 3,
      "payload": {
        "key": "theme.mode",
        "value": "dark"
      },
      "idempotency_key": "srv:chg-80003"
    }
  ],
  "has_more": false
}
```

## 5) Error Examples

### 5.1 Invalid Cursor

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json
```

```json
{
  "code": "INVALID_CURSOR",
  "message": "Cursor is invalid or expired.",
  "retry_after_ms": null,
  "details": {
    "cursor": "c_old_123",
    "action": "rebootstrap_required"
  }
}
```

### 5.2 Rate Limited

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 2
```

```json
{
  "code": "RATE_LIMITED",
  "message": "Too many sync requests.",
  "retry_after_ms": 2000,
  "details": {
    "bucket": "device:dev-mac-001"
  }
}
```

### 5.3 Service Unavailable

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
```

```json
{
  "code": "UNAVAILABLE",
  "message": "Sync service is temporarily unavailable.",
  "retry_after_ms": 5000,
  "details": null
}
```

## 6) Backend Validation Checklist

1. Require `schema_version=1`.
2. Require non-empty `device_id`.
3. Validate each change:
   - `entity_type`, `operation`, `idempotency_key`, `updated_at`, `updated_by_device`.
4. Ensure push response always returns `server_cursor` and `server_time`.
5. Ensure pull response always returns `server_cursor`, `server_time`, `changes`, `has_more`.
6. Keep cursor monotonic.
7. Treat `idempotency_key` as idempotent per device/request stream.

## 7) Managed Connector Gateway Notes

If you implement managed mode gateway, support key-based RPC contract:
- request keys:
  - `_solostack_sync_rpc/requests/push-<id>.json`
  - `_solostack_sync_rpc/requests/pull-<id>.json`
- response keys:
  - `_solostack_sync_rpc/responses/push-<id>.json`
  - `_solostack_sync_rpc/responses/pull-<id>.json`

Response content at key should be a JSON string that matches:
- `SyncPushResponse` for push
- `SyncPullResponse` for pull

## 8) Suggested HTTP Status Mapping

- `200`: successful push/pull
- `400`: validation error / invalid cursor / schema mismatch
- `401`: unauthorized
- `403`: forbidden
- `429`: rate limited
- `500`: internal error
- `503`: unavailable

## 9) Contract Test Suggestions

1. Push partial accept/reject.
2. Pull multi-page (`has_more=true -> false`).
3. Error envelope parse for each `SyncApiErrorCode`.
4. Idempotent re-push with same `idempotency_key`.
5. Cursor regression protection.
