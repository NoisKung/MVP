# SoloStack Product Roadmap

อัปเดตล่าสุด: 2026-02-18

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
| P3-2 | Mobile Client Sync Beta (iOS/Android) | In Progress | ใช้งานข้าม desktop + mobile ได้ |
| P3-3 | Conflict Center + Recovery Tools | In Progress | ให้ผู้ใช้แก้ conflict ได้ชัดเจน |
| P3-4 | Security Hardening | Planned | เพิ่มความปลอดภัยระดับ production |
| P3-5 | Cloud Provider Connectors / Platform (Google/Microsoft/iCloud/AWS) | Discovery | เพิ่มทางเลือกการ sync ตาม ecosystem ผู้ใช้และตัวเลือก backend platform |
| P3-6 | MCP Server for SoloStack Agent Data Access | In Progress | ให้ Agent ดึงข้อมูลไปวิเคราะห์/สรุป/วางแผนได้อย่างปลอดภัย |

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
  - เพิ่ม `Sync Diagnostics (Session)` ใน Settings (success rate, latency, failure streak, conflict cycles)
  - เพิ่ม test coverage: unit tests (runtime normalization/visibility behavior) + Playwright flow (preset/validation)
- กำลังทำต่อ:
  - เตรียม mobile beta client ให้ใช้ contract/runtime tuning เดียวกับ desktop

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

### Progress Snapshot (2026-02-17)

- Done:
  - schema + index สำหรับ conflict/event tables
  - persist conflict จาก incoming sync change พร้อม dedupe โดย `incoming_idempotency_key`
  - Settings Conflict Center: list/detail/actions/timeline/export report
  - dedicated `Conflict Center` view + deep-link จาก global status (`Conflict`)
  - diff-based `Manual Merge` editor (replace prompt flow)
  - restore guardrails: preflight (`outbox/conflicts/latest backup`) + force restore + `Restore Latest Backup`
  - retry confirmation UX ใน conflict actions
  - Playwright coverage สำหรับ restore preflight/force flow
  - Playwright coverage สำหรับ conflict retry confirmation + re-resolve matrix
  - quality gates ปัจจุบันของ repo ผ่าน (`test`, `test:e2e`, `build`)
- Remaining:
  - test matrix conflict/recovery แบบ end-to-end ที่ผูก sync success path จริง
  - integration coverage สำหรับ idempotent retry/resolve replay

### Initial Milestones (Suggested)

1. Sprint A (3-4 วัน) - Completed
- ออกแบบและลง schema `sync_conflicts` + event log
- เพิ่ม conflict persist path ใน incoming apply flow
- ได้ baseline conflict types + resolution/event model

2. Sprint B (1 สัปดาห์) - In Progress
- สร้าง `Conflict Center` + detail panel + resolve actions ใน Settings แล้ว
- เพิ่ม timeline + export report แล้ว
- เพิ่ม dedicated view + deep-link จาก status แล้ว
- เหลือ E2E resolve coverage

3. Sprint C (3-4 วัน) - In Progress
- เพิ่ม restore preflight/force flow และ recovery guardrails (done)
- hardening conflict/recovery flows ก่อน internal beta

## Risks and Mitigations

- Conflict ซับซ้อนจนผู้ใช้งง
- ใช้กฎ deterministic + conflict copy + timeline log

- Mobile battery/network overhead สูง
- ใช้ adaptive interval + exponential backoff + delta-only sync

- Migration จาก local-only ไป sync ทำให้ข้อมูลผิดรูป
- ทำ preflight validation + backup ก่อนเปิด sync ครั้งแรก

## Open Decisions

- Backend stack สำหรับ sync service (hosting/runtime/database)
- Auth/session model สำหรับหลายอุปกรณ์
- Sync interval ที่เหมาะสมระหว่าง responsiveness กับ battery
- ขอบเขต telemetry ที่ต้องมีตั้งแต่ desktop beta
- Conflict resolution policy:
  - default strategy ต่อ entity (`keep-local`, `keep-remote`, merge)
  - ผู้ใช้เปลี่ยน policy ได้ระดับ global หรือเฉพาะรายการ
- Recovery boundaries:
  - restore ได้ถึงระดับไหน (ทั้ง DB vs เฉพาะ sync tables)
  - ต้องบังคับ outbox empty ก่อน restore หรืออนุญาต force restore
- Provider connector strategy ระยะกลาง:
  - Google-first หรือ Microsoft-first
  - เกณฑ์ตัดสิน (adoption, latency, complexity, support load)
- AWS architecture decision:
  - API Gateway + Lambda + DynamoDB vs API service + RDS
  - Cognito scope สำหรับ device/session auth
  - baseline observability (CloudWatch metrics/log/alarms)
- MCP deployment mode:
  - local-only sidecar vs hosted service
  - read-only first นานแค่ไหนก่อนเปิด write tools
  - auth model ระหว่าง agent runtime กับ MCP server

## Immediate Next Actions

1. ~~เพิ่ม E2E + integration coverage สำหรับ resolve -> sync success path (with transport)~~ [done]
2. ~~เพิ่ม telemetry counters (`opened`, `resolved`, `time_to_resolve`)~~ [done]
3. ~~ทำ technical spike เปรียบเทียบ Google `appDataFolder` vs OneDrive `approot`~~ [done]
4. ~~ออกแบบ MCP tool contract ชุดแรก (`get_tasks`, `get_projects`, `get_weekly_review`)~~ [done]
5. ~~ทำ AWS reference spike (sync API + MCP hosting + cost baseline)~~ [done]
