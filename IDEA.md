# SoloStack Product Roadmap

อัปเดตล่าสุด: 2026-02-23

## Product Principles

- โฟกัสงานเดี่ยว (solo workflow) ที่ใช้งานทุกวัน
- เพิ่มความเร็วในการจดงานและปิดงานให้ชัดเจน
- รักษาแนวคิด local-first/offline-first
- เพิ่มฟีเจอร์เท่าที่จำเป็นและคุมความซับซ้อน

## Status Snapshot

### Completed Foundation

- P0 (เสร็จแล้ว): Quick Capture, Task Template, Subtasks / Checklist
- P1 (เสร็จแล้ว): Natural Language Due Date, Calendar View, Markdown Notes, Projects
- P2 (เสร็จแล้ว): Backup/Restore, Command Palette, Weekly Review, MVP CLI

### Existing Capabilities

- Search + Filters + Sort (per-view)
- Saved Views
- Today / Upcoming views
- Due date + Reminder + Notification click-to-open
- Recurrence, Dashboard, Momentum metrics
- Reminder settings
- Command Palette (`Cmd/Ctrl + K`)

## Roadmap Overview

| Phase | Focus | Status | Goal |
| --- | --- | --- | --- |
| P3-1 | Sync Foundation + Desktop Beta (Windows/macOS/Linux) | In Progress | Sync หลักระหว่าง desktop ได้เสถียร |
| P3-2 | Mobile Client Sync Beta (iOS/Android) | Completed | ใช้งานข้าม desktop + mobile ได้ |
| P3-3 | Conflict Center + Recovery Tools | Completed | ให้ผู้ใช้แก้ conflict ได้ชัดเจน |
| P3-4 | Security Hardening | Planned | เพิ่มความปลอดภัยระดับ production |
| P3-5 | Cloud Provider Connectors / Platform (Google/Microsoft/iCloud/AWS) | In Progress | เพิ่มทางเลือกการ sync ตาม ecosystem ผู้ใช้และตัวเลือก backend platform |
| P3-6 | MCP Server for SoloStack Agent Data Access | In Progress | ให้ Agent ดึงข้อมูลไปวิเคราะห์/สรุป/วางแผนได้อย่างปลอดภัย |
| P3-7 | Product Quality of Life (QoL) | Completed | ลด friction การใช้งานรายวันและลด human error |
| P3-8 | Internationalization (TH/EN) | Completed | รองรับ UI สองภาษา (ไทย/อังกฤษ) และให้ผู้ใช้สลับภาษาได้เอง |

## Active Plan: P3-1 Sync Foundation + Desktop Beta

### Objective

- ให้ผู้ใช้เริ่มงานบนเครื่องหนึ่งและทำต่อบนอีกเครื่องได้ทันที โดยไม่สูญหายข้อมูล
- รักษา UX แบบ local-first: ใช้งาน offline ได้ และ sync เมื่อกลับมา online

### Scope v1 (In)

- Sync entities: `projects`, `tasks`, `task_subtasks`, `task_templates`, `settings` ที่จำเป็น
- Sync triggers:
  - ตอนเปิดแอป
  - แบบ interval (ทุก 30-60 วินาที)
  - ปุ่ม `Sync now` ใน Settings
- รองรับ offline queue + auto retry/backoff
- รองรับลบข้ามอุปกรณ์ด้วย tombstone (`deleted_records`)
- แสดงสถานะ sync: `Synced`, `Syncing`, `Offline`, `Conflict`

### Out of Scope v1 (Out)

- Collaborative editing แบบหลายคนพร้อมกัน
- Attachments ขนาดใหญ่
- Team workspace / permission model
- End-to-end encryption เต็มรูปแบบ

### Technical Direction

#### Client Data Layer

- ใช้ `device_id` และ `last_sync_cursor` ใน settings
- ใช้ `sync_outbox` สำหรับ local changes ที่รอ push
- ใช้ `deleted_records` สำหรับ deletion events
- บังคับทุก mutation ผ่าน write path เดียวที่ enqueue outbox เสมอ

#### API Contract (Proposed)

- `POST /v1/sync/push` รับ batched changes + idempotency key
- `POST /v1/sync/pull` ดึง incremental changes ด้วย cursor
- `GET /v1/sync/bootstrap` สำหรับ initial sync

#### Conflict Strategy

- ฟิลด์ทั่วไป: Last-Write-Wins (`updated_at`) + tie-break ด้วย `device_id`
- Subtasks: merge ตาม `subtask_id`
- Notes ชนกัน: เก็บ conflict copy เพื่อไม่ทิ้งข้อมูล

#### Cross-Platform Strategy

- Desktop ใช้โค้ดปัจจุบันต่อ (Tauri)
- Mobile (P3-2) แยก client แต่แชร์ types และ sync contract
- ทุก client ใช้ payload contract เดียวกันเพื่อลด drift

## Feasibility Analysis: Google / Microsoft / iCloud / AWS

### Executive Verdict

- Google Drive: ทำได้ และเหมาะเป็น connector เสริมสำหรับผู้ใช้ Google account
- Microsoft OneDrive: ทำได้ และเหมาะเป็น connector เสริมสำหรับผู้ใช้ Microsoft ecosystem
- iCloud (CloudKit): ทำได้บางส่วน (Apple ecosystem + web) แต่ไม่เหมาะเป็นแกนหลักสำหรับ Windows + Android
- AWS: ทำได้และเหมาะเป็น managed backend platform สำหรับ sync service และ MCP server (แต่ไม่ใช่ user cloud-drive connector โดยตรง)

### Option A: Google Drive (Google Drive API `appDataFolder`)

#### Feasibility

- ทำได้: ใช้ hidden app data folder ต่อผู้ใช้และต่อแอป
- Scope เฉพาะงานได้: `drive.appdata` (least privilege กว่า drive เต็ม)

#### Strengths

- เหมาะกับการเก็บ metadata/log/snapshot สำหรับ sync ต่อผู้ใช้
- ข้อมูลไม่รบกวนไฟล์หลักของผู้ใช้ใน My Drive
- มี OAuth มาตรฐานและ SDK พร้อมใช้งาน

#### Constraints

- จำกัดการใช้งานบางอย่างใน `appDataFolder` (เช่น share/trash/move)
- ยังต้องจัดการ token lifecycle, retry, quota, และ rate limit
- ต้องออกแบบ conflict/idempotency เองฝั่งแอปอยู่ดี

### Option B: Microsoft OneDrive / SharePoint (`/special/approot`)

#### Feasibility

- ทำได้: มี app folder ชัดเจนผ่าน Microsoft Graph
- ใช้ scope `Files.ReadWrite.AppFolder` สำหรับ least privilege

#### Strengths

- โครงสร้างแยกต่อแอปชัดเจน (`Apps/<AppName>`)
- รองรับ OneDrive ส่วนบุคคลและงานองค์กร
- สามารถขยายไป SharePoint drive ได้ในอนาคต

#### Constraints

- ต้องรองรับ policy ของ tenant องค์กร
- ต้องจัดการ Graph throttling/retry/token refresh
- ยังต้องออกแบบ merge/conflict logic ในระดับโดเมนของ SoloStack เอง

### Option C: iCloud (CloudKit)

#### Feasibility

- ทำได้: ดีมากบน Apple platforms และ web
- ใช้ความสามารถ native sync ของ CloudKit ได้

#### Strengths

- ประสิทธิภาพและประสบการณ์ดีใน ecosystem Apple
- มี tooling และ schema management สำหรับ CloudKit โดยตรง

#### Constraints

- ไม่ใช่เส้นทางหลักสำหรับ Windows/Android client
- ต้องใช้ Apple capability/entitlement และ deployment flow เฉพาะ Apple
- หากต้องการ cross-platform เต็มรูปแบบ ยังต้องมี sync core ที่เป็นกลางอยู่ดี

### Option D: AWS Managed Backend (API Gateway / Lambda / DynamoDB-RDS / Cognito)

#### Feasibility

- ทำได้: เหมาะกับการทำ sync API + auth + observability แบบ managed
- รองรับ scale และ multi-environment (dev/staging/prod) ชัดเจน

#### Strengths

- เหมาะเป็น backend กลางสำหรับ `push/pull/bootstrap` และ MCP endpoints
- มีบริการครบสำหรับ auth (`Cognito`), API (`API Gateway`), compute (`Lambda`/ECS), data (`DynamoDB`/RDS), telemetry (`CloudWatch`)
- ช่วยลดงาน infra operation เมื่อเทียบ self-hosted stack

#### Constraints

- มีความซับซ้อนด้าน IAM/security baseline ที่ต้องวางให้ดีตั้งแต่ต้น
- cost model ต้องคุมตาม traffic pattern (especially burst + polling)
- ยังต้องออกแบบ domain conflict/idempotency logic ในระดับแอปเอง

## Recommendation for SoloStack

1. คงแนวทางปัจจุบัน: สร้าง provider-neutral sync core ให้เสร็จใน P3-1/P3-2 ก่อน
2. เพิ่ม provider connectors เป็นชั้น transport ภายหลัง (P3-5)
3. ลำดับทดลองที่แนะนำ:
- ~~Spike 1: Google Drive connector (appDataFolder)~~ [done: discovery/spike]
- ~~Spike 2: OneDrive connector (approot)~~ [done: discovery/spike]
- ~~Spike 3: iCloud connector เฉพาะ Apple-first mode~~ [done: feasibility note]
- ~~Spike 4: AWS backend reference architecture สำหรับ sync + MCP~~ [done: architecture spike]

## P3-5 Implementation Update (2026-02-23)

- เสร็จแล้ว:
  - เพิ่ม managed connector stubs สำหรับ `google_appdata` และ `onedrive_approot`:
    - `src/lib/sync-provider-adapters.ts`
  - เพิ่ม provider auth/token helper พร้อม refresh flow:
    - `src/lib/sync-provider-auth.ts`
  - เพิ่ม UI settings สำหรับ managed connector (base URL + token fields) และปุ่ม `Test Connector`:
    - `src/components/ReminderSettings.tsx`
    - `src/lib/sync-provider-adapter-factory.ts`
  - ผูก managed connector adapter เข้ากับ sync transport resolver แล้ว (เลือก path managed ก่อน endpoint custom):
    - `src/lib/sync-transport.ts`
    - `src/lib/sync-transport.test.ts`
  - เพิ่ม secure token storage policy v0.2:
    - redaction ของ `managed_auth` sensitive fields ก่อน persist
    - เก็บ token ผ่าน secure keystore บน Tauri desktop/iOS/Android (best-effort)
    - fallback เป็น session-only สำหรับ runtime อื่น
    - เพิ่ม storage policy marker ใน config (`managed_auth_storage_policy`)
    - เพิ่ม tests: `src/lib/sync-provider-token-policy.test.ts`, `src/lib/database.migration.test.ts`, `src/lib/sync-provider-secure-store.test.ts`
  - เพิ่ม secure store self-test สำหรับยืนยัน read/write/delete โดยไม่ทับ token จริง:
    - Rust command: `run_sync_provider_secure_store_self_test`
    - Settings action: `Verify Secure Store`
  - เพิ่ม validation matrix baseline สำหรับรันบนอุปกรณ์จริง:
    - `docs/sync-provider-secure-store-validation-v0.1.md`
  - เพิ่ม integration tests สำหรับ connector behavior + error mapping:
    - `src/lib/sync-provider-adapters.test.ts`
    - `src/lib/sync-provider-auth.test.ts`
- คงเหลือ:
  - ยืนยัน real-device matrix ของ secure keystore บน iOS/Android และเก็บหลักฐานก่อน external beta

## New Initiative: P3-6 MCP Server for SoloStack

### Objective

- เปิดช่องให้ Agent (เช่น Codex/LLM agents) เข้าถึงข้อมูล SoloStack เพื่อสรุปงาน, วิเคราะห์ productivity, และช่วยวางแผนถัดไป
- แยก “data access layer สำหรับ agent” ออกจาก app UI/sync APIs เพื่อลด coupling

### Why This Matters

- ลดเวลา manual reporting (weekly review, bottleneck analysis, carry-over analysis)
- เพิ่มความสามารถ agent automation โดยไม่ต้องให้ agent แตะ SQLite โดยตรง
- คุม security และ audit ได้ดีกว่าเปิด DB file ตรง ๆ

### Proposed Scope v1

- ~~MCP server แบบ read-first:~~ [done]
  - `get_tasks`, `get_projects`, `get_weekly_review`, `search_tasks`, `get_task_changelogs`
- optional write tools (phase ถัดไป):
  - `create_task`, `update_task_status`, `add_subtask`
- ~~query guardrails:~~ [done]
  - limit/page/filter บังคับ
  - timeout และ rate-limit ต่อ session
- ~~response contract:~~ [done]
  - ใช้ schema ที่สอดคล้องกับ types ปัจจุบันของ SoloStack

### Security & Governance

- ~~default เป็น read-only~~ [done]
- ต้องมี explicit allowlist สำหรับ write tools
- redact fields ที่อ่อนไหวได้ (ถ้ามีในอนาคต)
- ~~เก็บ audit log: ใครเรียก tool ไหน เมื่อไหร่ และ query อะไร~~ [done]

### Out of Scope v1

- multi-tenant shared workspace
- full RAG/vector pipeline ในตัว MCP server
- remote public exposure โดยไม่มี auth layer

### Deliverables

1. ~~`mcp-solostack` server package (local runtime ก่อน)~~ [done]
2. ~~Tool spec + JSON schema สำหรับแต่ละ tool~~ [done: contract/spec baseline]
3. ~~Integration test กับ DB fixture จริง~~ [done]
4. ~~Usage guide สำหรับ agent setup ใน repo~~ [done]

### Success Criteria

- Agent ดึง weekly summary ได้ภายใน < 2 วินาทีใน local machine
- query ที่หนักมี limit/timeout ไม่ทำให้ UI lag
- ไม่มี data corruption case จาก MCP read path

## Workstreams (P3-1)

1. Data Layer & Migration
- เพิ่ม schema: `sync_outbox`, `sync_checkpoints`, `deleted_records`
- เพิ่ม `sync_version`, `updated_by_device` ใน entities หลัก
- ทำ migration แบบ backward-compatible + preflight backup

2. Sync Engine
- ทำ service หลัก: `preparePushBatch`, `applyPullBatch`, `advanceCursor`
- ทำ queue drain, retry/backoff, idempotency
- กัน sync ซ้อนและรองรับ crash-safe recovery

3. Sync API Contract
- ล็อก schema ของ push/pull/bootstrap + error shape
- รองรับ incremental cursor + batched events
- รองรับ conflict metadata สำหรับ UI

4. UX & Settings
- เพิ่ม Settings card: `Sync now`, last sync, last error
- เพิ่ม status badge ระดับแอป
- เพิ่ม retry flow และป้องกันการกดซ้ำตอน syncing

5. QA & Observability
- Unit/Integration tests: merge rules, cursor, retry, outbox drain
- Playwright tests: sync status + sync now + retry flow
- เพิ่ม telemetry/log ขั้นต่ำ: success rate, latency, conflict count

## Sprint Plan (Suggested)

1. Sprint 0 (2-3 วัน)
- Finalize sync contract
- Schema/migration spike
- Validate technical risks

2. Sprint 1 (1 สัปดาห์)
- Outbox + push/pull engine
- Retry/backoff + idempotency
- Core unit tests

3. Sprint 2 (1 สัปดาห์)
- UX status/settings
- E2E tests
- Hardening + internal beta

## Definition of Done (P3-1)

- Create/Update/Delete `project`, `task`, `subtask`, `template` จากอุปกรณ์ A แล้วสะท้อนอุปกรณ์ B ตาม SLA
- Offline edits ไม่หาย และ sync กลับได้เมื่อ online
- มี UI status ชัดเจน (`Synced`, `Syncing`, `Offline`, `Conflict`) พร้อม `Sync now` และ retry
- ผ่าน quality gates:
  1. `npm run test`
  2. `npm run test:e2e`
  3. `npm run build`

## Acceptance Targets

- Windows -> Android sync เห็นผลภายใน 10 วินาทีในเครือข่ายปกติ (เป้าหมายสำหรับ P3-2 readiness)
- ไม่มี data loss ใน offline/online transition ตาม test matrix
- conflict หลัก (same-field update, notes collision, delete-vs-update) ให้ผลลัพธ์ deterministic

## P3-2 Progress Snapshot (2026-02-17)

- เสร็จแล้ว:
  - เพิ่ม `Sync Runtime Profile` ใน Settings เพื่อปรับ interval/limits ผ่าน UI โดยตรง
  - เพิ่ม preset `Desktop` และ `Mobile Beta`
  - เพิ่ม adaptive auto-sync interval ตาม foreground/background visibility
  - เพิ่ม mobile-aware runtime seed: เปิดบน iOS/Android ครั้งแรกจะได้ค่าเริ่มต้นแบบ mobile preset อัตโนมัติ
  - harden mobile preset detection:
    - รองรับเคส `userAgentData.mobile`
    - รองรับ iPadOS ที่รายงาน UA เป็น `Macintosh` แต่มี touch points
  - เพิ่ม `Sync Diagnostics (Session)` ใน Settings (success rate, latency, failure streak, conflict cycles)
  - เพิ่ม diagnostics ของที่มา preset detection (`user_agent_data_mobile`, `user_agent_pattern`, `platform_pattern`, `ipad_touch_heuristic`, `fallback_desktop`)
  - ผูก diagnostics snapshot เข้า `Export conflict report` เพื่อช่วย support analysis ข้าม session
  - เพิ่ม rolling history ของ diagnostics ใน local DB + แนบ `session_diagnostics_history` ในไฟล์ report
  - เพิ่ม UI `Diagnostics History (Latest 5)` ในหน้า Settings สำหรับตรวจย้อนหลังโดยไม่ต้อง export
  - เพิ่ม `View Full History` พร้อม search + source/date filters + row limit ในหน้า Settings
  - เพิ่ม `Export Filtered JSON` ใน full-history view เพื่อส่งออก snapshot ตามตัวกรอง พร้อม metadata การกรอง
  - เพิ่ม Playwright test สำหรับ full-history export flow (validation + filter metadata)
  - เพิ่ม test coverage: unit tests (runtime normalization/visibility behavior) + Playwright flow (preset/validation)
- ปิดแล้ว:
  - dedicated mobile client beta ใช้ contract/runtime tuning ชุดเดียวกับ desktop แล้ว
  - desktop<->mobile real-device sync validation ผ่านตามเป้าหมาย P3-2

### P3-2 Core Readiness Update (2026-02-20)

- เสร็จแล้ว (shared-core ใน repo นี้):
  - lock runtime preset parity (`desktop`/`mobile_beta`) และ guardrails ใน sync loop
  - เพิ่ม source tracking สำหรับ runtime preset detection เพื่อ debug mobile auto-seed ได้ชัดเจนขึ้น
  - ครอบคลุม test matrix ฝั่ง core/runtime profile แล้ว
  - สรุป checklist readiness ไว้ที่ `docs/p3-2-mobile-beta-core-readiness-v0.1.md`
- ปิดแล้ว:
  - dedicated mobile client UI และ desktop<->mobile real-device flow validation

## Initiative: SoloStack iOS + Android Version (P3-2 Expansion)

### Product Goal

- ให้ SoloStack ใช้งานได้ทั้ง desktop + mobile แบบต่อเนื่อง โดยยังคง local-first/offline-first
- รองรับการจดงานระหว่างเดินทาง และกลับมาทำต่อบน desktop ได้ทันทีหลัง sync

### Scope v1 (Beta)

- Mobile core views: `Today`, `Upcoming`, `Board`
- Quick capture + CRUD สำหรับ `task`/`subtask`
- เลือก `project`, ตั้ง `due date`/`reminder`, และ mark done ได้จากมือถือ
- แสดง sync state (`Synced`, `Syncing`, `Offline`, `Conflict`) + ปุ่ม `Sync now`
- ใช้ runtime profile แบบ mobile preset เป็นค่า default

### Out of Scope v1

- parity เต็มรูปแบบทุกหน้า (เช่น Dashboard/Weekly Review เชิงลึก)
- conflict manual merge แบบเต็ม (mobile v1 เน้นรับรู้สถานะ + resolve ขั้นพื้นฐาน)
- advanced backup/recovery flows ทั้งหมดบน mobile

### Technical Direction

- ใช้ Tauri v2 mobile (iOS/Android) เพื่อ reuse React app และ shared modules เดิม
- ใช้ schema SQLite และ sync contract เดียวกับ desktop เพื่อลด model drift
- tune ค่า sync สำหรับ mobile โดยใช้ foreground/background interval และ limits จาก runtime settings

### Rollout Plan (Suggested)

1. iOS Internal Alpha
- ทดสอบผ่าน TestFlight ภายในทีม
- validate flows: quick capture, task update, desktop <-> iOS sync

2. Android Internal Alpha
- ทดสอบผ่าน Closed Testing ภายในทีม
- validate flows เดียวกับ iOS บนเครือข่ายและอุปกรณ์ที่ต่างกัน

3. Cross-Platform Mobile Beta
- เปิด iOS + Android beta พร้อมกัน
- freeze contract และวัด SLA sync จาก production-like environment

### Acceptance Targets

- sync desktop <-> mobile median <= 10 วินาทีในเครือข่ายปกติ
- offline edits บน mobile ไม่สูญหายเมื่อกลับมา online
- ไม่มี critical data-loss case ใน mobile test matrix

## Kickoff Plan: P3-3 Conflict Center + Recovery Tools

### Objective

- ทำให้ conflict เป็นสิ่งที่ผู้ใช้มองเห็นและแก้ได้เองจาก UI โดยไม่ต้องแก้ DB
- ลดโอกาส data loss ในเคส sync error/conflict ด้วย recovery path ที่ชัดเจน

### Problem to Solve

- มี Conflict Center แล้ว แต่ยังต้อง hardening policy/UX สำหรับเคส conflict ซับซ้อน
- `Manual Merge` เป็น diff-based side-by-side editor แล้ว แต่ยังไม่มี 3-way auto-merge
- recovery path มี `Restore from latest backup` + preflight/force แล้ว แต่ยังต้องเติม coverage และ UX รายงานผลเชิงลึก
- Test matrix และ E2E coverage สำหรับ conflict/recovery ยังไม่ครบ

### Scope v1 (In)

- Baseline ที่ทำแล้ว:
  - persistence model: `sync_conflicts`, `sync_conflict_events`
  - conflict detect + persist จาก incoming apply path
  - `Conflict Center` ในหน้า Settings (list + detail + resolve actions)
  - dedicated `Conflict Center` view + deep-link จาก global status
  - actions: `Keep Local`, `Keep Remote`, `Retry`, `Manual Merge`
  - `Manual Merge` แบบ side-by-side diff + quick merge actions
  - timeline events (`detected`, `resolved`, `retried`, `exported`)
  - `Export conflict report` (JSON)
  - `Restore from latest backup` + preflight/force guardrails
- งานที่เหลือใน v1:
  - เติม E2E/integration tests สำหรับ flow ใหม่ให้ครบ

### Out of Scope v1 (Out)

- CRDT/real-time collaborative editing เต็มรูปแบบ
- AI auto-merge semantic conflict
- rollback ข้ามหลายอุปกรณ์แบบ global transaction

### UX Flow (Proposed)

1. Sync engine ตรวจเจอ conflict ระหว่าง `applyPullBatch`
2. สร้าง conflict record + เปลี่ยน app status เป็น `Conflict`
3. ผู้ใช้กดเข้า `Conflict Center` จาก status badge/notification
4. ผู้ใช้เลือกแนวทาง resolve ต่อรายการ
5. ระบบบันทึก resolution log + enqueue change เพื่อ sync รอบถัดไป
6. เมื่อไม่มีรายการค้าง สถานะกลับเป็น `Synced`

### Technical Direction

#### Conflict Data Model

- ตาราง `sync_conflicts`:
  - `id`, `entity_type`, `entity_id`, `conflict_type`
  - `local_payload`, `remote_payload`, `base_payload` (optional)
  - `detected_at`, `status` (`open`,`resolved`,`ignored`)
  - `resolution_strategy`, `resolved_by_device`, `resolved_at`
- ตาราง `sync_conflict_events`:
  - เก็บ timeline ของ detect/resolve/retry/export

#### Sync Engine Integration

- `applyPullBatch` ต้อง return conflict envelopes ที่เป็น deterministic
- ทุก resolution ต้อง generate idempotency key ก่อน enqueue outbox
- รองรับ retry แบบ safe: ไม่สร้าง conflict ซ้ำสำหรับกรณีเดียวกัน

#### Recovery Integration

- ก่อน restore ให้ preflight check ว่า outbox ถูก flush หรือผู้ใช้ยืนยัน force restore
- หลัง restore ให้ trigger re-bootstrap sync พร้อม clear stale conflicts

### Definition of Done (P3-3)

- มี `Conflict Center` ใช้งานได้บน desktop พร้อมรายการ + detail + resolve actions
- ผู้ใช้แก้ conflict หลัก 3 แบบได้จาก UI โดยไม่แตะไฟล์ DB
- recovery actions (`retry`, `restore`, `export report`) ใช้งานได้จริงและมี guardrails
- ทุก resolution ถูกบันทึกใน conflict timeline และตรวจสอบย้อนหลังได้
- ผ่าน quality gates:
  1. `npm run test`
  2. `npm run test:e2e`
  3. test matrix conflict/recovery scenarios ผ่านครบ

### Progress Snapshot (2026-02-18)

- Done:
  - schema + index สำหรับ conflict/event tables
  - persist conflict จาก incoming sync change พร้อม dedupe โดย `incoming_idempotency_key`
  - Settings Conflict Center: list/detail/actions/timeline/export report
  - dedicated `Conflict Center` view + deep-link จาก global status (`Conflict`)
  - diff-based `Manual Merge` editor (replace prompt flow)
  - restore guardrails: preflight (`outbox/conflicts/latest backup`) + force restore + `Restore Latest Backup`
  - retry confirmation UX ใน conflict actions
  - restore guardrail hardening: force restore ต้องใช้เมื่อมี pending outbox หรือ open conflicts
  - Playwright coverage สำหรับ restore preflight/force flow
  - Playwright coverage สำหรับ conflict retry confirmation + re-resolve matrix
  - Playwright coverage สำหรับ resolve strategy matrix (`Keep Local`, `Keep Remote`, `Manual Merge`) และ sync success path
  - integration coverage สำหรับ idempotent retry/resolve replay
  - เพิ่ม integration test สำหรับ `retry ซ้ำ` + `incoming replay ซ้ำ` เพื่อยืนยันว่า
    - resolution outbox ยังเป็น idempotent (ไม่แตกเป็นหลายแถว)
    - replay ที่แก้แล้ว resolve conflict ได้
    - replay ซ้ำหลัง resolve ไม่ทำให้เกิด side effect ซ้ำใน conflict timeline
  - เพิ่ม transport-backed E2E สำหรับ flow `Retry` ที่ต้องรอ corrected replay แล้วกลับ `Synced`
  - unit coverage สำหรับ restore guardrails (force-required preflight + blocked restore + force restore success)
  - quality gates ปัจจุบันของ repo ผ่าน (`test`, `test:e2e`, `build`)

### Security Analysis: Resolve Replay + Idempotent Retry (2026-02-23)

Threat surface ที่วิเคราะห์:
- replay change เดิมซ้ำหลายครั้งจาก transport/backend
- ผู้ใช้กด `Retry` ซ้ำหลายครั้งบน conflict เดิม
- event log โตเร็วจาก conflict ที่ถูก replay บ่อย
- payload conflict/report ที่อาจมีข้อมูลละเอียดเกินจำเป็น

Current controls (implemented):
- dedupe ฝั่ง conflict identity ด้วย `incoming_idempotency_key` แบบ `UNIQUE` ใน `sync_conflicts`
- dedupe ฝั่ง resolution outbox ด้วย deterministic idempotency key:
  - key shape: `conflict-resolution:<conflict_id>:<strategy>`
  - เขียน `sync_outbox` ผ่าน `ON CONFLICT(idempotency_key) DO UPDATE`
- guard replay หลัง conflict ถูก `resolved/ignored`:
  - incoming key เดิมจะถูก `skip` และบันทึก event `retried` พร้อมเหตุผล `incoming_change_repeated`
- จำกัดการเติบโตของ timeline:
  - เก็บสูงสุด 200 events ต่อ conflict
  - retention 90 วัน
- เพิ่ม integration + E2E coverage สำหรับ retry/replay path เพื่อลด regression risk

Residual risks / next hardening:
- replay เดิมที่เป็น payload เดิมสามารถถูก apply ซ้ำได้ในบางกรณี LWW-equal (ไม่กระทบ conflict state แต่มี write ซ้ำ)
- ยังไม่มี cryptographic integrity/checksum ของ incoming payload ที่ผูกกับ idempotency key จากฝั่ง server
- export report เป็นข้อมูลเชิง support ที่ควรพิจารณา redaction policy เพิ่มก่อนขยาย beta ภายนอก

Recommended follow-up:
1. เพิ่ม optional replay guard cache สำหรับ applied incoming key ระยะสั้น (ลด write ซ้ำจาก replay storm)
2. เพิ่ม server-side signature/validation policy สำหรับ idempotency envelope
3. นิยาม redaction rules สำหรับ conflict/report export (เช่น masking fields ที่อาจมีข้อมูลอ่อนไหว)

### Initial Milestones (Suggested)

1. Sprint A (3-4 วัน) - Completed
- ออกแบบและลง schema `sync_conflicts` + event log
- เพิ่ม conflict persist path ใน incoming apply flow
- ได้ baseline conflict types + resolution/event model

2. Sprint B (1 สัปดาห์) - Completed
- สร้าง `Conflict Center` + detail panel + resolve actions ใน Settings แล้ว
- เพิ่ม timeline + export report แล้ว
- เพิ่ม dedicated view + deep-link จาก status แล้ว
- ปิด E2E resolve coverage แล้ว (resolve matrix + sync success path)

3. Sprint C (3-4 วัน) - Completed
- เพิ่ม restore preflight/force flow และ recovery guardrails (done)
- hardening conflict/recovery flows ก่อน internal beta (done)

## Risks and Mitigations

- Conflict ซับซ้อนจนผู้ใช้งง
- ใช้กฎ deterministic + conflict copy + timeline log

- Mobile battery/network overhead สูง
- ใช้ adaptive interval + exponential backoff + delta-only sync

- Migration จาก local-only ไป sync ทำให้ข้อมูลผิดรูป
- ทำ preflight validation + backup ก่อนเปิด sync ครั้งแรก

## QoL Improvement Ideas (Proposed)

### Quick Wins (1-3 วัน)

1. Global Undo Bar สำหรับ action เสี่ยง
- ครอบคลุม `Delete Task`, `Delete Project`, `Resolve Conflict`, `Restore`
- เป้าหมาย: ลด human error จาก mis-click ใน flow ที่ irreversible

2. Keyboard Shortcut Help + Power Shortcuts
- เพิ่ม shortcut สำหรับ `Sync now`, `Open Conflict Center`, `Open Settings`, `Export Backup`
- เป้าหมาย: ลดจำนวนคลิกต่องานหลักใน daily workflow

3. Autosave State Indicator ในฟอร์มสำคัญ
- แสดงสถานะ `Saving...`, `Saved`, `Retry` ใน Task form/Manual merge draft
- เป้าหมาย: ลดความไม่มั่นใจว่าข้อมูลถูกบันทึกแล้วหรือยัง

4. Quick Capture Date Chips
- แปลงภาษาธรรมชาติเป็น due/reminder พร้อม chip confirm (เช่น `พรุ่งนี้ 9 โมง`)
- เป้าหมาย: เพิ่มความเร็วตอนจดงานแบบเร่งด่วน

### Mid-size (3-7 วัน)

1. Bulk Edit / Multi-select Tasks
- แก้ `status`, `priority`, `project`, `due_at` พร้อมกันหลายรายการ
- เป้าหมาย: ลดงานซ้ำตอน triage backlog

2. Snooze Reminder from Notification
- ตัวเลือกเร็ว `15m`, `1h`, `Tomorrow`
- เป้าหมาย: ลดการหลุด reminder และลด context switch เข้าแอป

3. Resume Last Context
- เปิดแอปแล้วกลับไป view/filter/task ล่าสุดอัตโนมัติ
- เป้าหมาย: ลดเวลา re-orient ทุกครั้งที่กลับมาใช้งาน

4. Restore Dry-run Summary
- ก่อน restore แสดงสรุปผลกระทบ (`tasks/projects/templates`, outbox/conflicts ที่จะถูกเคลียร์)
- เป้าหมาย: เพิ่มความมั่นใจก่อนยืนยัน action ใหญ่

5. CalendarView Adaptive UX (Desktop + Mobile)
- Desktop: ปรับ layout ให้เหมาะจอใหญ่ (month/week density), เพิ่ม keyboard navigation และ day detail panel
- Mobile: ใช้ agenda-first + day detail แบบ bottom sheet, เพิ่ม touch target ให้กดง่าย และรองรับ swipe day/week
- Shared: คง filter/sort behavior ให้เหมือนกันทุกแพลตฟอร์ม, ระวัง timezone day-boundary และคุม performance ตอนสลับเดือน
- เป้าหมาย: ลด friction การวางแผนรายวัน/รายสัปดาห์ทั้ง desktop app และ mobile app

### Stretch (1-2 สปรินต์)

1. Personal Conflict Strategy Defaults
- ตั้งค่า default strategy ต่อ conflict type (ยังคงมี per-item override)
- เป้าหมาย: ลดเวลาการ resolve สำหรับ pattern ที่เกิดซ้ำ

2. Command Palette Workflow Actions
- สั่ง `Export Backup`, `Sync Diagnostics`, `Open Restore Preflight` จาก command palette
- เป้าหมาย: ให้ power user ทำงานได้เร็วขึ้นโดยไม่ออกคีย์บอร์ด

3. Lightweight Focus Mode
- เริ่มจับเวลา focus จาก task row โดยไม่ต้องเปิดหลายหน้าจอ
- เป้าหมาย: ลด friction จาก planning -> execution

### Candidate QoL Sprint Plan

1. QoL Sprint A
- Global Undo Bar
- Shortcut Help + Power Shortcuts
- Autosave State Indicator

2. QoL Sprint B
- Bulk Edit / Multi-select Tasks
- Resume Last Context
- Restore Dry-run Summary

3. QoL Sprint C
- Snooze Reminder from Notification
- Personal Conflict Strategy Defaults
- Command Palette Workflow Actions

4. QoL Sprint D - Completed
- CalendarView Adaptive UX (Desktop + Mobile)

### QoL Progress Snapshot (2026-02-23)

- Done:
  - เพิ่ม `Keyboard Shortcut Help` modal (เปิดจาก `?` และปุ่ม `Shortcuts ?` ใน sidebar)
  - เพิ่ม power shortcuts:
    - `Cmd/Ctrl + ,` -> เปิด `Settings`
    - `Cmd/Ctrl + Shift + C` -> เปิด `Conflict Center`
    - `Cmd/Ctrl + Shift + S` -> `Sync now`
  - เพิ่ม `Autosave State Indicator` ใน sidebar footer:
    - `Autosave ready`
    - `Autosaving...`
    - `Saved ...`
    - `Autosave failed`
  - เพิ่ม `Global Undo Bar` พร้อม undo window 5 วินาทีสำหรับ:
    - `Delete task`
    - `Delete project`
    - `Resolve conflict` / `Retry conflict`
    - `Restore latest backup`
    - `Restore from file (import backup)`
  - เพิ่ม `restore dry-run summary` ก่อน queue:
    - `Restore latest backup` (อ่าน latest backup summary จาก preflight)
    - `Restore from file` (preview summary จาก payload ก่อนยืนยัน)
    - แสดง impact ที่จะเคลียร์ `pending outbox` และ `open conflicts` ใน confirmation เดียวกัน
  - เพิ่ม `Resume Last Context` baseline:
    - จำ `active view` ล่าสุดไว้ และ restore อัตโนมัติเมื่อเปิดแอปใหม่
  - ขยาย `Resume Last Context`:
    - จำ `Projects` context (`selected project`, `search`, `status filter`, `task section filter`)
    - จำ `active saved view` แยกต่อ `Board/Today/Upcoming`
  - เพิ่ม `Bulk Edit / Multi-select Tasks` baseline:
    - เลือกหลายงานจากการ์ดใน `Board/Today/Upcoming`
    - มี `Select shown` / `Clear selected`
    - ทำ bulk actions ได้จากแถบเดียว: `status`, `priority`, `project`, `important`
  - ปิด `Bulk Edit / Multi-select Tasks` extension:
    - เพิ่ม bulk fields: `due`, `reminder`, `recurrence`
    - เพิ่ม confirmation summary ก่อน apply bulk edit ทุกครั้ง
  - ปิด `Resume Last Context` extension (detail focus state):
    - persist `TaskForm` focus (`CREATE`/`EDIT`) พร้อม `taskId/projectId`
    - reopen form/task เดิมอัตโนมัติเมื่อเปิดแอปใหม่
  - ปิด `Snooze Reminder from Notification`:
    - เพิ่ม action จาก notification: `15m`, `1h`, `Tomorrow`
    - map action -> update `remind_at` อัตโนมัติ
    - tap notification ยังเปิด task เดิมเหมือนเดิม
  - ปิด `Personal Conflict Strategy Defaults`:
    - เพิ่มหน้า config ใน `Settings > Sync` สำหรับตั้ง default strategy ต่อ conflict type
    - เพิ่มปุ่ม `Apply Default` ใน conflict list (ทั้ง Conflict Center และ Settings)
    - กรณี default เป็น `manual_merge` จะเปิด editor เพื่อให้ payload ครบตาม contract
  - ปิด `Command Palette Workflow Actions`:
    - เพิ่ม actions: `Run Sync now`, `Export backup`, `Open Sync diagnostics`, `Open Restore preflight`
    - เพิ่ม disabled state ใน command เมื่อ action ยังไม่พร้อม (เช่น sync ไม่มี transport หรือกำลังรัน)
    - เชื่อม `Open Sync diagnostics` / `Open Restore preflight` ให้เปิด Settings และ scroll ไป section เป้าหมายทันที
  - ปิด `Lightweight Focus Mode`:
    - เพิ่มปุ่ม start/stop focus บน `TaskCard` (Board/Today/Upcoming/Projects/Calendar)
    - แสดง elapsed timer (`mm:ss` / `h:mm:ss`) บนการ์ดที่กำลัง focus
    - เพิ่ม global focus indicator + stop control ใน sidebar footer เพื่อหยุด session ได้จากทุกหน้า
    - บันทึก focus session ลง `sessions` เมื่อ stop
    - harden การลบ task: clear `sessions.task_id` เป็น `NULL` ก่อน delete เพื่อกัน FK fail
    - เพิ่ม UI coverage test สำหรับ focus controls (`TaskCard` start/stop/disabled states)
  - ปิด `QoL Sprint D`:
    - ปรับ backlog เพิ่มหัวข้อ `CalendarView Adaptive UX (Desktop + Mobile)` และปิดเป็นงานเสร็จ
- Next:
  - QoL Sprint D และ P3-8 ปิดแล้ว
  - เดินงานถัดไปต่อ: รัน hosted staging matrix จริง + ship audit sink เข้า centralized backend สำหรับ `P3-6`

## New Initiative: P3-8 Internationalization (i18n) TH/EN

### Objective

- รองรับภาษา UI อย่างน้อย 2 ภาษา: ไทย (`th`) และอังกฤษ (`en`)
- ให้ผู้ใช้สลับภาษาเองได้จาก `Settings` โดยไม่กระทบข้อมูลงาน
- คงคุณภาพ UX เดิม: โหลดเร็ว, อ่านง่าย, และไม่เกิด fallback ข้อความแปลก

### Scope v1 (In)

- เพิ่ม i18n infrastructure ฝั่ง client (`React`) พร้อม fallback language
- ครอบคลุมข้อความในหน้าหลัก:
  - `Board`, `Projects`, `Today`, `Upcoming`, `Dashboard`, `Weekly Review`
  - `Settings`, `Conflict Center`, dialog สำคัญ, notification ข้อความระบบ
- รองรับการสลับภาษา runtime (ไม่ต้อง restart แอป)
- เก็บค่า locale ใน settings key กลางของแอป (`app.locale`)
- default locale ใช้ลำดับ:
  - ค่าที่ผู้ใช้ตั้งไว้
  - ระบบปฏิบัติการ (`navigator.language`)
  - fallback เป็น `en`

### Out of Scope v1 (Out)

- แปล payload ข้อมูลผู้ใช้ (เช่น title/notes ของ task)
- localize ภาษาใน MVP CLI และ MCP tool response
- แปลภาษาธรรมชาติ (NLP parser) ทุกภาษาแบบเต็มรูปแบบ

### Technical Direction

- ใช้ key-based translations (ไม่ hardcode string ใน component)
- แยก resource file ชัดเจน เช่น:
  - `src/i18n/en.json`
  - `src/i18n/th.json`
- ใช้ namespace ต่อโดเมน (`board.*`, `projects.*`, `settings.*`, `sync.*`)
- รองรับ pluralization และ date/time formatting ผ่าน `Intl`
- ใส่ missing-key guard ใน dev mode เพื่อกันหลุด key translation

### Rollout Plan (Completed)

1. Sprint i18n-A (2-3 วัน) - Completed
- วาง infra + locale provider + settings binding
- migrate shared/common labels ก่อน

2. Sprint i18n-B (3-5 วัน) - Completed
- ครอบคลุม core views และ settings/sync/conflict
- เติม test สำหรับ language switch + fallback

3. Sprint i18n-C (2-3 วัน) - Completed
- copy review (TH/EN), polish typography/spacing
- freeze key set และออก beta feedback รอบแรก

### Acceptance Targets

- ผู้ใช้สลับ `TH`/`EN` ได้จาก UI และเห็นผลทันทีทุกหน้าที่อยู่ใน scope
- ไม่มี hardcoded English string หลุดในหน้าหลักที่กำหนดใน v1
- fallback ทำงานถูกต้องเมื่อ key หายหรือ locale ไม่รองรับ
- ผ่าน quality gates:
  1. `npm run test`
  2. `npm run test:e2e`
  3. `npm run build`

### P3-8 Progress Update (2026-02-21)

- localize conflict reason codes ใน UI:
  - `Conflict Center`
  - `Settings > Sync > Conflict list`
- เพิ่ม mapping helper กลาง `reason_code -> i18n key` เพื่อลดการแสดง raw English message ในหน้า UI
- localize `entity_type` labels ใน conflict list/detail:
  - จากค่า raw เช่น `TASK` -> label แปลตามภาษา (`Task` / `งาน`)
- localize timestamp ใน conflict UI:
  - detected time และ timeline event time จะแสดงผลตาม locale ที่ผู้ใช้เลือก (`TH`/`EN`) อย่างสอดคล้องทั้ง `Conflict Center` และ `Settings > Sync`
- แปล copy ฝั่งไทยสำหรับ `Settings > Sync Diagnostics` และ `Conflict Observability` จากอังกฤษเป็นไทย
- แปล label ฝั่งไทยใน `Settings > Sync Runtime/Provider` เพิ่มเติม:
  - profile values (`Desktop`, `Mobile Beta`, `Custom`)
  - runtime fields (`Push/Pull Limit`, `Max Pull Pages`)
  - `N/A` duration และ `Push/Pull URL` labels
- เก็บคำแปลไทยเพิ่มใน flow `Settings > Sync` และ `Backup guardrails`:
  - endpoint/provider/runtime diagnostics copy
  - preflight/force-restore/dry-run copy ให้ลดการปนอังกฤษ
- ปรับคำศัพท์ไทยให้สม่ำเสมอใน Sync:
  - `Push/Pull URL` -> `URL ส่งข้อมูลขึ้น/ดึงข้อมูลลง`
  - `Push/Pull limit` -> `ขีดจำกัดการส่งขึ้น/ดึงลง`
  - หน่วยเวลา runtime (`ms/s/min/h`) -> คำไทย
- เก็บ sweep ภาษาไทยนอก Sync เพิ่ม:
  - `Conflict Center` (`Local/Remote` -> `ฝั่งเครื่อง/ฝั่งเซิร์ฟเวอร์`)
  - `Command Palette`/`Shortcut Help` wording
  - `Backup guardrails` wording (`outbox` -> คิวขาออก)
- เก็บ micro-copy ที่ค้างอังกฤษเพิ่ม:
  - `Device ID`, `conflict_id`, `Markdown`, `Undo`, `E2E transport` ในข้อความไทย
- ปรับถ้อยคำไทยให้สม่ำเสมอทั้งแอป:
  - สะกด `โปรเจกต์` ให้ตรงกัน (แทน `โปรเจค`)
  - แปลข้อความ `diff` ใน manual merge เป็นคำไทย
- ทำ sweep คำผสมอังกฤษในไทยเพิ่ม:
  - `transport` -> `ช่องทางรับส่ง`
  - `outbox` -> `คิวขาออก`
  - `push/pull` -> `ส่งขึ้น/ดึงลง`
  - เพิ่มถ้อยคำปุ่มเป็น `กดปุ่ม Enter/Esc`
- เพิ่ม i18n governance test กันสะกดคำไทยย้อนกลับ (`โปรเจค`)
- เพิ่ม unit tests สำหรับ helper เพื่อยืนยัน behavior:
  - known reason code -> localized message
  - unknown reason code -> fallback raw message
  - empty reason/message -> fallback `common.unknown`

### P3-8 Closure Update (2026-02-23)

- ปิด `P3-8 i18n expansion / rollout backlog` ใน scope ปัจจุบัน
- เปลี่ยนสถานะ roadmap ของ `P3-8` เป็น `Completed`
- งานถัดไปย้ายไป `P3-5 connector implementation` และ `P3-6 hosted hardening`

### P3-6 Hosted Hardening Update (2026-02-23)

- เสร็จแล้ว:
  - เพิ่ม audit sink mode `file` + retention policy baseline (30 วัน)
  - เพิ่ม retention policy decision by environment:
    - `dev=14`, `staging=30`, `prod=90`
    - เอกสาร: `docs/mcp-audit-retention-policy-v0.1.md`
  - เพิ่ม env config:
    - `SOLOSTACK_MCP_AUDIT_SINK`
    - `SOLOSTACK_MCP_AUDIT_LOG_DIR`
    - `SOLOSTACK_MCP_AUDIT_RETENTION_DAYS`
  - เพิ่ม hosted load/perf tooling:
    - `npm run mcp:load-matrix:hosted:preflight`
    - `npm run mcp:load-matrix:hosted:pipeline`
    - `npm run mcp:load-matrix:hosted`
    - `npm run mcp:load-matrix:compare`
  - เพิ่ม centralized audit sink mode `http`:
    - ส่ง `POST` ต่อ event ไป external endpoint
    - รองรับ timeout + optional bearer token
    - env config:
      - `SOLOSTACK_MCP_AUDIT_HTTP_URL`
      - `SOLOSTACK_MCP_AUDIT_HTTP_TIMEOUT_MS`
      - `SOLOSTACK_MCP_AUDIT_HTTP_AUTH_TOKEN`
- คงเหลือ:
  - รันรายงาน hosted staging จริงและแนบ compare report
  - blocker ปัจจุบันใน workspace นี้: ยังไม่มี `SOLOSTACK_MCP_HOSTED_BASE_URL` / `SOLOSTACK_MCP_HOSTED_AUTH_TOKEN`
  - ผูกค่า env ของ `http` sink เข้ากับ staging/prod และยืนยัน delivery/error-rate ตาม policy ของ environment

## Upgrade Plan: Old -> New (Migration Track)

### Objective

- ให้ผู้ใช้เดิมอัปเกรดจาก build เก่าไป build ใหม่ได้แบบไม่สูญหายข้อมูล
- รองรับการย้าย namespace/app data จาก `com.antigravity.solostack` -> `com.solutionsstudio.solostack`
- ทำ one-time migration แบบอัตโนมัติครั้งแรกที่เปิดแอปเวอร์ชันใหม่

### Scope v1 (In)

- ตรวจหา legacy DB path ของ bundle เก่า
- migrate DB หลักไป path ใหม่แบบปลอดภัย (copy-then-verify-then-switch)
- เก็บ migration marker เพื่อให้ flow เป็น idempotent (รันซ้ำแล้วไม่เสียหาย)
- migrate settings สำคัญที่เกี่ยวกับ:
  - sync endpoints/provider/runtime profile
  - backup metadata ล่าสุด
  - app locale (`app.locale`) เมื่อเริ่มใช้ i18n
- แจ้งสถานะ migration ใน startup log/diagnostics เพื่อช่วย support

### Out of Scope v1 (Out)

- downgrade จาก bundle ใหม่กลับ bundle เก่า
- รวมข้อมูลจากหลาย legacy DB เข้าไฟล์เดียวแบบ auto-merge
- migrate ข้าม major schema ที่ไม่เข้ากันโดยไม่มี preflight

### Technical Direction

- เพิ่ม migration orchestrator ใน startup path ก่อนเปิด sync loop
- ลำดับทำงาน:
  1. preflight ตรวจไฟล์เก่า/ใหม่ และ disk free space ขั้นต่ำ
  2. lock migration (กัน race จากหลาย process)
  3. copy DB ไปตำแหน่งใหม่ + verify ขนาด/เปิดอ่านได้
  4. set migration marker + release lock
  5. fallback: ถ้า fail ให้ใช้ DB path เดิมชั่วคราวพร้อม warning ชัดเจน
- เขียน event log สำหรับ `migration_started`, `migration_succeeded`, `migration_failed`

### Rollout Plan (Suggested)

1. Phase A (implementation + tests)
- unit/integration test สำหรับ migration happy path + fail path
- เพิ่ม fixture จำลอง legacy directory

2. Phase B (internal beta)
- ทดสอบอัปเกรดจาก v0.1.3/v0.1.4 -> build ใหม่บน macOS/Windows
- เก็บสถิติ migration success rate + startup time

3. Phase C (production release)
- เปิดใช้ migration default
- monitor failure buckets และมี hotfix path ถ้าพบ edge case

### Acceptance Targets

- ผู้ใช้ที่มีข้อมูลใน path เก่าสามารถเปิดเวอร์ชันใหม่แล้วเห็นข้อมูลเดิมครบ
- migration รันครั้งเดียวและไม่ทำข้อมูลซ้ำ/หายเมื่อเปิดแอปซ้ำ
- ถ้า migration fail แอปยังเปิดได้ (degraded mode) และมีข้อความ/diagnostics ชัดเจน
- ผ่าน quality gates:
  1. `npm run test`
  2. `npm run test:e2e`
  3. `npm run build`

## Open Decisions (Proposed for Sign-off)

อิงจาก:
- `docs/aws-spike-v0.1.md`
- `docs/telemetry-spec-v0.1.md`
- `docs/mcp-aws-hosted-profile-v0.1.md`
- `docs/mcp-read-tools-contract-v0.1.md`
- `docs/p3-6-execution-backlog-v0.1.md`

1. Backend stack สำหรับ sync service (hosting/runtime/database)
- **Proposal:** ใช้ `Lambda-first` เป็น baseline ในช่วง beta (`API Gateway HTTP API + Lambda + DynamoDB on-demand + Cognito + CloudWatch`)
- **Revisit trigger:** ถ้าโหลดต่อเนื่องสูงและ `p95 latency` เกินเป้าหมายต่อเนื่อง ให้พิจารณา `service-first (ECS + RDS)`

2. Auth/session model สำหรับหลายอุปกรณ์
- **Proposal:** ใช้ Cognito User Pool + `Authorization Code + PKCE` สำหรับ public clients (desktop/mobile) และแยก device session ด้วย `device_id`
- **Policy:** access token อายุสั้น, refresh token ตาม environment policy, รองรับ revoke per device

3. Sync interval ที่เหมาะสมระหว่าง responsiveness กับ battery
- **Proposal:** ให้ผู้ใช้ปรับได้เองจาก UI เป็นค่าเริ่มต้น (user-configurable runtime)
- มี preset แนะนำเริ่มต้น:
  - `desktop`: foreground 60s / background 300s
  - `mobile beta`: foreground 120s / background 600s
- **Guardrail:** มี min/max bounds, exponential backoff สูงสุด 300s และมี `Sync now` manual override
- **UX:** แสดง impact โดยย่อ (battery/network) และมีปุ่ม reset กลับค่าแนะนำ
- **Decision:** locked โดย product direction (ผู้ใช้ตั้งค่าเองใน UI)

4. ขอบเขต telemetry สำหรับ desktop beta
- **Proposal:** freeze ตาม `telemetry-spec v0.1` (Sync Health + Conflict Lifecycle + Connector Reliability + MCP Runtime)
- **Privacy baseline:** ไม่ส่ง task payload ดิบขึ้น telemetry, ส่งเฉพาะ count/timing/status/hash

5. Conflict resolution policy
- **Proposal:** ใช้แนวทาง conservative
- default เป็น user-assisted resolution ใน `Conflict Center`
- `notes_collision` ให้ `manual_merge` เป็นตัวเลือกแนะนำ
- เก็บ global policy เฉพาะ non-destructive defaults และให้ per-item override ได้เสมอ

6. Recovery boundaries
- **Proposal:** รองรับ restore ทั้ง DB ผ่าน backup payload (ไม่ใช่เฉพาะ sync tables)
- **Safety:** preflight ทุกครั้ง, ถ้ามี pending outbox/open conflicts ให้ require explicit force

7. Provider connector strategy ระยะกลาง
- **Proposal:** ให้ผู้ใช้เลือก provider ได้เองจาก UI (เช่น Google / Microsoft / iCloud / SoloStack Cloud-AWS)
- **Default UX:** เริ่มด้วย provider-neutral mode และแนะนำ connector ตาม platform/account ที่ผู้ใช้ล็อกอินอยู่
- **Guardrail:** แสดง capability/ข้อจำกัดของแต่ละ provider ชัดเจนก่อนเปิดใช้งาน
- **Decision:** locked โดย product direction (ไม่ fix provider เดียว)

8. AWS architecture decision (รายละเอียดเชิงแพลตฟอร์ม)
- **Proposal:** ใช้ `API Gateway + Lambda + DynamoDB on-demand` เป็น default profile
- **Observability:** ใช้ CloudWatch metric/log/alarm ตาม baseline ใน telemetry spec

9. MCP deployment mode + write tools phase
- **Proposal:** `local sidecar` เป็น default ใน production ช่วงแรก
- hosted MCP เปิดใน phase ถัดไปสำหรับ tenant ที่ต้องการ centralized control
- read-only tools เป็นค่าเริ่มต้น และเปิด write tools หลังผ่าน guardrails (allowlist + audit + latency/error gate) อย่างน้อย 1 release cycle

10. i18n default locale + translation governance
- **Proposal:** default เป็นระบบตรวจ locale อัตโนมัติครั้งแรก แล้วให้ผู้ใช้ override ได้จาก Settings
- ใช้ key governance: ทุก PR ที่เพิ่ม UI string ต้องเพิ่ม translation อย่างน้อย `en` และ `th` ใน change set เดียวกัน
- freeze key naming convention ก่อนเริ่ม Sprint i18n-B เพื่อลด migration cost

11. Old -> New upgrade fallback policy
- **Proposal:** ใช้ `copy-then-verify` เป็น default และเก็บไฟล์ legacy ไว้จนกว่าจะผ่านอย่างน้อย 1 successful startup cycle
- ถ้า migration fail ให้ fallback เข้า degraded mode โดยไม่เริ่ม sync write path จนกว่าจะกู้สำเร็จหรือผู้ใช้ยืนยัน override
- เพิ่ม diagnostics key สำหรับ support (`migration.last_status`, `migration.last_error`, `migration.legacy_path_detected`)

## Immediate Next Actions

1. ~~เพิ่ม E2E + integration coverage สำหรับ resolve -> sync success path (with transport)~~ [done]
2. ~~เพิ่ม telemetry counters (`opened`, `resolved`, `time_to_resolve`)~~ [done]
3. ~~ทำ technical spike เปรียบเทียบ Google `appDataFolder` vs OneDrive `approot`~~ [done]
4. ~~ออกแบบ MCP tool contract ชุดแรก (`get_tasks`, `get_projects`, `get_weekly_review`)~~ [done]
5. ~~ทำ AWS reference spike (sync API + MCP hosting + cost baseline)~~ [done]
6. ~~ตั้ง i18n foundation (`TH/EN`) + key governance และเริ่ม migrate strings กลุ่ม `Settings`/`Sync` ก่อน~~ [done]
7. ~~ปิด migration hardening checklist สำหรับ old -> new (legacy path detection, marker idempotency, diagnostics keys)~~ [done]
8. ~~ทำ dedicated mobile client beta implementation (UI + real-device desktop<->mobile sync validation)~~ [done]
