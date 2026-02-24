# SoloStack Sync Deep Dive (TH) v0.1

Date: 2026-02-23  
Status: Current implementation guide (ตรงกับโค้ดใน repo ณ ตอนนี้)

## 1) เป้าหมายของระบบ Sync

SoloStack ใช้แนวทาง `local-first`:
- ผู้ใช้ทำงานในเครื่องได้แม้ไม่มีเน็ต
- ทุกการแก้ไขจะถูกบันทึกลงฐานข้อมูล local ทันที
- เมื่อมี transport พร้อม ระบบจะค่อย sync ขึ้น/ลงแบบ incremental

ผลที่ได้:
- UI ตอบสนองเร็ว
- รองรับ offline
- มี recovery/conflict model ชัดเจนเมื่อข้อมูลชนกัน

## 2) ภาพรวมสถาปัตยกรรม

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

Transport มี 2 โหมดหลัก:
- Custom endpoint (`push_url` + `pull_url`)
- Managed connector (Google/OneDrive) ผ่าน adapter และ connector gateway

## 3) โครงสร้างข้อมูลที่เกี่ยวกับ Sync

ตารางหลัก:
- `sync_checkpoints`: เก็บ cursor ล่าสุด (`last_sync_cursor`, `last_synced_at`)
- `sync_outbox`: queue ของ local changes ที่รอ push
- `deleted_records`: tombstone สำหรับ delete sync
- `sync_conflicts`: conflict records (เปิด/ปิด/ignored)
- `sync_conflict_events`: timeline ของเหตุการณ์ conflict

settings keys สำคัญ:
- `sync.device_id`
- `local.sync.push_url`
- `local.sync.pull_url`
- `local.sync.provider`
- `local.sync.provider_config`
- `local.sync.runtime_profile`
- `local.sync.*` อื่น ๆ (ถือเป็น local-only settings)

## 4) Local Write -> Outbox

ทุก mutation ฝั่ง local (เช่น create/update/delete task/project/template/subtask):
- อัปเดต `sync_version`
- อัปเดต `updated_by_device`
- enqueue ลง `sync_outbox` เป็น `UPSERT` หรือ `DELETE`
- สร้าง `idempotency_key` แบบ deterministic ต่อ change

หมายเหตุ:
- `idempotency_key` ใน outbox เป็น `UNIQUE` เพื่อกันส่งซ้ำแบบไม่ตั้งใจ

## 5) Sync Cycle (หนึ่งรอบ)

Flow หลัก:
1. อ่าน `device_id` + `checkpoint`
2. ดึง outbox ตาม `pushLimit`
3. `preparePushBatch`
4. `transport.push(...)`
5. `acknowledgePushResult`:
   - accepted -> ลบ outbox
   - rejected -> mark failed (`attempts`, `last_error`)
6. advance cursor จาก push response
7. `transport.pull(...)` แบบ paging จน `has_more=false` หรือถึง `maxPullPages`
8. apply incoming changes
9. advance cursor จาก pull response ทุกหน้า

ข้อกำหนด response ที่ parser ต้องการ:
- Push response: `accepted`, `rejected`, `server_cursor`, `server_time`
- Pull response: `server_cursor`, `server_time`, `changes`, `has_more`

## 6) Ordering และ Idempotency

ก่อน push/pull apply ระบบจะ normalize/sort ตาม:
- `updated_at`
- entity priority (`PROJECT` -> `TASK` -> `TASK_SUBTASK` -> `TASK_TEMPLATE` -> `SETTING`)
- `idempotency_key`

ขณะ apply pull:
- dedupe ด้วย `idempotency_key`
- default จะ skip change ที่มาจาก device ตัวเอง (`updated_by_device == local device_id`)

## 7) กฎ Apply Incoming และ Conflict

สำหรับ entity หลักใช้ LWW:
- เทียบ `updated_at`
- ถ้าเวลาเท่ากัน ใช้ `updated_by_device` เป็น tie-break

local-only guard:
- `SETTING` ที่เป็น `sync.device_id` หรือขึ้นต้นด้วย `local.` จะไม่ให้ remote overwrite

ตัวอย่างกรณีที่ถูกยกระดับเป็น conflict:
- `MISSING_TASK_TITLE` (field_conflict)
- `TASK_PROJECT_NOT_FOUND` (delete_vs_update)
- `TASK_NOTES_COLLISION` (notes_collision)

เมื่อเกิด conflict:
- persist ลง `sync_conflicts` (unique ที่ `incoming_idempotency_key`)
- เขียน event ลง `sync_conflict_events` (detected/resolved/retried/exported)

## 8) Conflict Resolution Flow

ผู้ใช้ resolve ได้จาก UI:
- `keep_local`
- `keep_remote`
- `manual_merge`
- `retry`

เมื่อ resolve:
- update record ใน `sync_conflicts`
- enqueue outbox change ของ resolution
- append event ใน timeline

## 9) Transport Resolver Logic

`resolveSyncTransportConfig` เลือก transport ตามลำดับ:

1. ถ้า provider เป็น managed และมี managed connector config พร้อม
   - ใช้ managed connector transport
2. ถ้าไม่มี managed transport ให้พิจารณา custom endpoints
3. ถ้า config ไม่ครบ/ไม่ถูกต้อง -> `invalid_config`
4. ถ้า provider ถูก mark unavailable -> `provider_unavailable`
5. ถ้าไม่มี endpoint เลยและเป็น provider_neutral -> `disabled`

## 10) Managed Connector Transport (ปัจจุบัน)

Managed path ใช้ adapter (`SyncConnectorAdapter`) แล้วห่อเป็น RPC-over-file-key:
- เขียน request ไป key:
  - `_solostack_sync_rpc/requests/push-<requestId>.json`
  - `_solostack_sync_rpc/requests/pull-<requestId>.json`
- อ่าน response จาก key:
  - `_solostack_sync_rpc/responses/push-<requestId>.json`
  - `_solostack_sync_rpc/responses/pull-<requestId>.json`
- cleanup request/response keys แบบ best-effort

ดังนั้นฝั่ง connector gateway ต้องรู้ contract นี้ และเขียน response กลับตาม key ที่สอดคล้อง

## 11) Runtime Scheduler และ Backoff

ใน `useSync`:
- auto-sync interval แยก foreground/background
- profile:
  - `desktop`
  - `mobile_beta`
  - `custom`
- validation bounds:
  - foreground: 15..3600s
  - background: 30..7200s (และต้อง >= foreground)
  - push/pull limit: 20..500
  - max pull pages: 1..20

เมื่อ auto sync fail:
- exponential backoff เริ่มที่ ~5 วินาที
- cap ที่ 300 วินาที

## 12) Status Model ที่ผู้ใช้เห็น

สถานะหลัก:
- `SYNCING`
- `SYNCED`
- `OFFLINE`
- `CONFLICT`
- `LOCAL_ONLY`

behavior สำคัญ:
- config ผิดและไม่มี transport สำรอง -> `LOCAL_ONLY` + warning
- ถ้า config ผิดแต่มี `last-known-good transport` -> ระบบยัง run ได้และแจ้ง warning
- provider unavailable -> `OFFLINE` พร้อม warning ที่ localize แล้ว

## 13) Token Security Policy (P3-5 v0.1)

### Policy ปัจจุบัน
- sensitive fields ต่อไปนี้ไม่ persist ลง SQLite/backup:
  - `access_token`
  - `refresh_token`
  - `client_secret`
- บน Tauri desktop จะเก็บ sensitive token ผ่าน secure keystore ของระบบปฏิบัติการ (best-effort)
- runtime ที่ไม่ใช่ desktop จะยังเป็น session-only
- มี marker ใน config:
  - `managed_auth_storage_policy` (`desktop_secure_keystore` / `mobile_session_only` / `browser_session_only`)

### ผลลัพธ์เชิงพฤติกรรม
- ระหว่างแอปยังไม่ปิด: runtime สามารถ hydrate token จาก memory ได้
- หลัง restart:
  - Desktop Tauri: runtime hydrate จาก secure keystore ได้ (ถ้าใช้งานได้)
  - runtime อื่น: token sensitive หาย (ต้อง re-auth/re-input)

## 14) Backup/Restore กับ Sync

ก่อน restore/import:
- preflight ตรวจ:
  - pending outbox changes
  - open conflicts
  - latest backup availability

ถ้ามี pending outbox/open conflicts:
- ต้องใช้ `force` restore

เมื่อ restore สำเร็จ:
- เคลียร์ sync state ที่ stale (`sync_outbox`, `sync_conflicts`, checkpoint)
- ระบบพร้อมเริ่ม sync รอบใหม่จาก state ที่ restore

## 15) ต้องมี Server หรือไม่

ไม่ต้องมี server:
- ถ้าใช้เครื่องเดียว (`LOCAL_ONLY`)

ต้องมี server/gateway:
- ถ้าต้องการ sync ข้ามเครื่อง
- custom mode: ต้องมี `/push` และ `/pull` endpoint
- managed mode: ต้องมี connector gateway ที่รองรับ RPC key contract

## 16) Troubleshooting Quick Matrix

1. Sync ขึ้น `LOCAL_ONLY`
- สาเหตุ: endpoint ไม่ครบ หรือ config ไม่ valid
- ตรวจ: `push_url` / `pull_url` ต้องมีทั้งคู่และเป็น http(s)

2. Sync ขึ้น `provider_unavailable`
- สาเหตุ: provider ถูก mark unavailable หรือ managed connector ไม่พร้อม
- ตรวจ: `managed_available` และ managed config

3. กด Sync แล้ว conflict เพิ่ม
- สาเหตุ: incoming payload ไม่ผ่านกฎโดเมน หรือชนกับ local edits
- แก้: เปิด Conflict Center -> resolve -> sync ใหม่

4. Managed provider ใช้ไม่ได้หลัง restart
- สาเหตุ: secure keystore ใช้งานไม่ได้/ถูกบล็อก หรือ runtime เป็น session-only
- แก้: ตรวจสิทธิ์ secure keystore บน desktop หรือ re-auth/re-input สำหรับ runtime ที่เป็น session-only

## 17) ไฟล์อ้างอิงหลักในโค้ด

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

ถ้าต้องการเอกสารต่อยอด:
- Sequence diagram ต่อ provider (Google/OneDrive)
- API contract ตัวอย่าง request/response เต็มชุดสำหรับ backend implementer
- Runbook สำหรับ incident/recovery ฝั่ง operations
