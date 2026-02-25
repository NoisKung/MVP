# SoloStack Sync Deep Dive (EN) v0.1

Date: 2026-02-23  
Status: Current implementation guide (matches the repository state)

## 1) Sync Goals

SoloStack follows a `local-first` model:
- Users can continue working offline.
- Every local mutation is persisted immediately to local SQLite.
- When transport is available, the app performs incremental push/pull sync.

Practical outcomes:
- Fast UI response.
- Offline resilience.
- Explicit conflict and recovery paths.

## 2) High-Level Architecture

```text
UI (Settings / Sync now / Runtime profile)
  -> useSync (src/hooks/use-sync.ts)
    -> resolveSyncTransportConfig (src/lib/sync-transport.ts)
      -> runLocalSyncCycle (src/lib/sync-service.ts)
        -> runSyncCycle (src/lib/sync-runner.ts)
          -> preparePushBatch / acknowledgePushResult / applyPullBatch
             (src/lib/sync-engine.ts)
          -> Database layer (src/lib/database.ts)
```

Transport modes:
- Custom endpoint mode (`push_url` + `pull_url`)
- Managed connector mode (Google/OneDrive adapter + connector gateway)

## 3) Sync Data Model

Core tables:
- `sync_checkpoints`: cursor state (`last_sync_cursor`, `last_synced_at`)
- `sync_outbox`: pending local changes for push
- `deleted_records`: tombstones for sync deletes
- `sync_conflicts`: conflict records
- `sync_conflict_events`: conflict lifecycle timeline

Important settings keys:
- `sync.device_id`
- `local.sync.push_url`
- `local.sync.pull_url`
- `local.sync.provider`
- `local.sync.provider_config`
- `local.sync.runtime_profile`
- any `local.*` key is treated as local-only

## 4) Local Write -> Outbox

For local entity mutations (create/update/delete):
- Increment `sync_version`
- Update `updated_by_device`
- Enqueue `sync_outbox` entry (`UPSERT` or `DELETE`)
- Attach deterministic `idempotency_key`

Notes:
- `idempotency_key` is `UNIQUE` in outbox.

## 5) One Sync Cycle

Main sequence:
1. Read `device_id` and checkpoint.
2. Load outbox changes (bounded by `pushLimit`).
3. Build push batch (`preparePushBatch`).
4. `transport.push(...)`.
5. Acknowledge push result:
   - accepted -> remove outbox rows
   - rejected -> increment attempts and keep error detail
6. Advance cursor from push response.
7. Pull loop (`transport.pull(...)`) until `has_more=false` or `maxPullPages`.
8. Apply incoming changes.
9. Advance cursor after each pull page.

Required response fields:
- Push response: `accepted`, `rejected`, `server_cursor`, `server_time`
- Pull response: `server_cursor`, `server_time`, `changes`, `has_more`

## 6) Ordering and Idempotency

Push and pull apply paths normalize/sort by:
- `updated_at`
- entity priority (`PROJECT` -> `TASK` -> `TASK_SUBTASK` -> `TASK_TEMPLATE` -> `SETTING`)
- `idempotency_key`

Pull apply behavior:
- Deduplicates by `idempotency_key`
- Skips self-originated changes by default (`updated_by_device == local device_id`)

## 7) Incoming Apply Rules and Conflicts

For synced entities, SoloStack applies LWW:
- Compare `updated_at`
- If equal timestamp, tie-break by `updated_by_device`

Local-only protections:
- `SETTING` rows for `sync.device_id` and keys starting with `local.` are not overwritten by remote changes.

Examples that become persisted conflicts:
- `MISSING_TASK_TITLE` -> `field_conflict`
- `TASK_PROJECT_NOT_FOUND` -> `delete_vs_update`
- `TASK_NOTES_COLLISION` -> `notes_collision`

Conflict persistence:
- `sync_conflicts` (with unique `incoming_idempotency_key`)
- `sync_conflict_events` (`detected`, `resolved`, `retried`, `exported`)

## 8) Conflict Resolution

UI strategies:
- `keep_local`
- `keep_remote`
- `manual_merge`
- `retry`

On resolve:
- Update `sync_conflicts`
- Enqueue resolution outbox record
- Append conflict event

## 9) Transport Resolver Logic

`resolveSyncTransportConfig` resolution order:
1. If provider is managed and managed connector config is valid -> use managed transport.
2. Otherwise evaluate custom endpoints.
3. Incomplete/invalid endpoints -> `invalid_config`.
4. Explicitly unavailable provider -> `provider_unavailable`.
5. No endpoints in provider-neutral mode -> `disabled`.

## 10) Managed Connector Transport (Current)

Managed mode currently uses RPC-over-file-key via connector adapter:
- Writes request key:
  - `_solostack_sync_rpc/requests/push-<requestId>.json`
  - `_solostack_sync_rpc/requests/pull-<requestId>.json`
- Reads response key:
  - `_solostack_sync_rpc/responses/push-<requestId>.json`
  - `_solostack_sync_rpc/responses/pull-<requestId>.json`
- Performs best-effort cleanup of request/response keys.

Connector gateway implementations must support this key-based request/response contract.

## 11) Runtime Scheduler and Backoff

`useSync` supports:
- Separate foreground/background auto-sync intervals
- Profiles:
  - `desktop`
  - `mobile_beta`
  - `custom`
- Validation bounds:
  - foreground: 15..3600s
  - background: 30..7200s and `>= foreground`
  - push/pull limit: 20..500
  - max pull pages: 1..20

Auto-sync failure behavior:
- Exponential backoff starts around 5s
- Capped at 300s

## 12) User-Visible Status Model

Primary states:
- `SYNCING`
- `SYNCED`
- `OFFLINE`
- `CONFLICT`
- `LOCAL_ONLY`

Important behavior:
- Invalid config without fallback transport -> `LOCAL_ONLY` + warning.
- Invalid config with last-known-good transport -> sync continues + warning.
- Provider unavailable -> `OFFLINE` + localized warning.

## 13) Token Security Policy (P3-5 v0.1)

Current policy:
- Sensitive managed auth fields are not persisted to SQLite/backup:
  - `access_token`
  - `refresh_token`
  - `client_secret`
- On Tauri desktop, sensitive auth is persisted via OS secure keystore (best-effort).
- On non-desktop runtimes, sensitive auth stays session-only.
- Persisted config includes policy marker:
  - `managed_auth_storage_policy`
  - values: `desktop_secure_keystore`, `mobile_session_only`, `browser_session_only`

Behavior impact:
- During the same app session: runtime can hydrate managed auth from memory.
- After restart:
  - Desktop Tauri: runtime can hydrate from secure keystore (if available).
  - Other runtimes: sensitive tokens are gone and user must re-auth/re-input.

## 14) Backup/Restore Interaction

Before restore/import:
- Preflight checks:
  - pending outbox changes
  - open conflicts
  - latest backup availability

If pending outbox or open conflicts exist:
- `force` restore is required.

On successful restore:
- Clears stale sync state (`sync_outbox`, `sync_conflicts`, checkpoint)
- Sync can start cleanly from restored state

## 15) Server Requirement

No server required:
- Single-device usage (`LOCAL_ONLY`)

Server/gateway required:
- Multi-device synchronization
- Custom mode: provide `/push` and `/pull` endpoints
- Managed mode: provide connector gateway implementing RPC key contract

## 16) Troubleshooting Quick Matrix

1. State stuck at `LOCAL_ONLY`
- Cause: incomplete/invalid endpoint config
- Check: both `push_url` and `pull_url` must be valid http(s)

2. `provider_unavailable`
- Cause: provider is flagged unavailable or managed config missing
- Check: `managed_available` and managed connector settings

3. Conflicts increase after sync
- Cause: incoming payload violates domain validation or collides with local edits
- Action: open Conflict Center, resolve, sync again

4. Managed provider stops working after restart
- Cause: secure keystore unavailable/blocked, or runtime is session-only mode
- Action: check keystore permissions on desktop, or re-auth/re-enter token for session-only runtimes

## 17) Primary Code References

- `src/lib/sync-contract.ts`
- `src/lib/sync-engine.ts`
- `src/lib/sync-runner.ts`
- `src/lib/sync-service.ts`
- `src/lib/sync-transport.ts`
- `src/lib/sync-provider-adapters.ts`
- `src/lib/sync-provider-auth.ts`
- `src/lib/sync-provider-adapter-factory.ts`
- `src/lib/sync-provider-token-policy.ts`
- `src/lib/database.ts`
- `src/hooks/use-sync.ts`
- `src/components/ReminderSettings.tsx`

---

Recommended follow-up docs:
- Provider-specific sequence diagrams (Google/OneDrive)
- Backend API implementation runbook with validation and pagination edge cases
