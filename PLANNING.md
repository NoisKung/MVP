# SoloStack Execution Planning

อัปเดตล่าสุด: 2026-02-18
แหล่งข้อมูลหลัก: `IDEA.md`

## 1) Planning Intent

เอกสารนี้ใช้ขมวดแผนจาก roadmap ให้เป็น execution plan ที่ลงมือทำได้ทันที โดยคงหลักการ:
- Local-first / Offline-first
- เพิ่มความเร็วในการ capture และปิดงาน
- คุมความซับซ้อนของระบบ

## 2) Current Baseline

### ฟีเจอร์ที่เสร็จแล้ว
- P0: Quick Capture, Task Template, Subtasks
- P1: Natural Language Due Date, Calendar View, Markdown Notes, Projects
- P2: Backup/Restore, Command Palette, Weekly Review, MVP CLI

### โฟกัสปัจจุบัน
- P3-1: Sync Foundation + Desktop Beta
- P3-3: Conflict Center + Recovery (baseline implementation started)

## 3) Strategic Goals (Q1-Q2 2026)

1. ส่งมอบ desktop sync ที่เสถียรและไม่ทำข้อมูลหาย
2. เตรียมฐานสำหรับ mobile sync โดยใช้ contract กลางเดียวกัน
3. วางทางเลือก cloud connector (Google/Microsoft/iCloud) โดยไม่ล็อกระบบกับ provider เดียว
4. เปิดช่องทางให้ Agent ดึงข้อมูล SoloStack ไปวิเคราะห์และสรุปงานผ่าน MCP อย่างปลอดภัย
5. ประเมิน AWS เป็น managed platform option สำหรับ sync backend และ MCP server

## 4) Phase Plan

## Phase A: P3-1 Sync Foundation + Desktop Beta

ช่วงเป้าหมาย: 2026-02-17 ถึง 2026-03-13

### Deliverables
- Schema sync พร้อม migration:
  - `sync_outbox`
  - `sync_checkpoints`
  - `deleted_records`
  - `sync_version`, `updated_by_device`
- Sync engine หลัก:
  - `preparePushBatch`
  - `applyPullBatch`
  - `advanceCursor`
- Settings UX:
  - ปุ่ม `Sync now`
  - สถานะ `Synced/Syncing/Offline/Conflict`
  - แสดงเวลาซิงก์ล่าสุดและ error ล่าสุด

### Exit Criteria
- Offline edit ไม่หายเมื่อกลับมา online
- Create/Update/Delete `project/task/subtask/template` sync ข้าม desktop ได้
- ผ่าน gate: `npm run test` -> `npm run test:e2e` -> `npm run build`

## Phase B: P3-2 Mobile Sync Beta

ช่วงเป้าหมาย: 2026-03-16 ถึง 2026-04-17

### Deliverables
- Mobile client beta ต่อกับ sync contract เดียวกับ desktop
- End-to-end sync flow desktop <-> mobile
- Sync SLA ระดับ beta สำหรับใช้งานจริงภายในทีม

### Current Implementation Snapshot (2026-02-17)
- เสร็จแล้ว:
  - เพิ่ม `Sync Runtime Profile` ใน Settings เพื่อปรับ foreground/background interval และ push/pull limits ผ่าน UI
  - เพิ่ม preset `Desktop` และ `Mobile Beta` สำหรับ tuning เร็ว
  - sync loop รองรับ adaptive interval ตาม foreground/background visibility
  - เพิ่ม mobile-aware runtime seed สำหรับ first launch บน iOS/Android
  - เพิ่ม `Sync Diagnostics (Session)` บน Settings เพื่อดู success rate/latency/failure streak ระหว่าง tuning
  - เติม test coverage ของ runtime profile แล้ว (unit + Playwright)
- คงเหลือ:
  - เตรียม mobile beta client ให้ใช้ contract + runtime profile ชุดเดียวกับ desktop

### Exit Criteria
- data model ไม่ drift ระหว่าง client
- conflict กรณีหลักถูกจัดการได้ deterministic
- ไม่มี critical data-loss case ใน test matrix

## Phase C: P3-3 Conflict Center + Recovery

ช่วงเป้าหมาย: 2026-04-20 ถึง 2026-05-08

### Deliverables
- Conflict data model + migration:
  - `sync_conflicts`
  - `sync_conflict_events`
- Conflict Center UI:
  - รายการ conflict + filter/sort
  - detail panel เทียบ `local/remote/base`
  - actions: `Keep Local`, `Keep Remote`, `Manual Merge`
- Recovery tools:
  - `Retry last failed sync`
  - `Restore from latest backup` พร้อม confirmation/preflight
  - `Export conflict report`
- Timeline/audit log สำหรับ conflict lifecycle
- playbook สำหรับแก้ conflict แบบ user-facing

### Current Implementation Snapshot (2026-02-17)
- เสร็จแล้ว:
  - schema + index สำหรับ conflict/event tables
  - conflict persistence จาก incoming sync apply path
  - Settings Conflict Center baseline (list/detail/actions/timeline/export)
  - dedicated conflict view + deep-link จาก status badge
  - diff-based manual merge editor (replace prompt flow)
  - restore preflight/force flow + `Restore Latest Backup`
  - retry confirmation UX สำหรับ conflict actions
  - Playwright coverage สำหรับ restore preflight/force flow
  - Playwright coverage สำหรับ conflict retry confirmation + re-resolve matrix
  - Playwright coverage สำหรับ retry failed sync (transport failure -> retry success)
- คงเหลือ:
  - integration coverage สำหรับ resolve replay + idempotent retry

### Exit Criteria
- ผู้ใช้แก้ conflict หลัก (`field_conflict`, `delete_vs_update`, `notes_collision`) ได้จาก UI โดยไม่แตะ DB
- ทุก resolution บันทึกใน event timeline พร้อม timestamp และ device context
- recovery actions ใช้งานได้จริงและมี guardrails
- ผ่าน gate: `npm run test` -> `npm run test:e2e` -> `npm run build`

## Phase D: P3-4 Security Hardening

ช่วงเป้าหมาย: 2026-05-11 ถึง 2026-05-29

### Deliverables
- auth/session hardening
- secure token storage + refresh policy
- security checklist ก่อนขยายผู้ใช้ beta

## Phase E: P3-5 Cloud Provider Connectors (Discovery -> Pilot)

ช่วงเป้าหมาย: 2026-06-01 ถึง 2026-06-26

### Deliverables
- Technical spike: Google Drive `appDataFolder`
- Technical spike: OneDrive `approot`
- Feasibility note: iCloud/CloudKit (Apple-first mode)
- AWS reference architecture spike:
  - API layer (`API Gateway` / service runtime)
  - compute (`Lambda`/container)
  - data store (`DynamoDB` หรือ `RDS`)
  - auth (`Cognito`) และ observability baseline (`CloudWatch`)
- ข้อเสนอเลือก provider ลำดับแรกพร้อมเกณฑ์ตัดสิน

### Comparative Spike Snapshot (2026-02-18)

Google Drive (`appDataFolder`) vs OneDrive (`approot`) ในมุม SoloStack sync connector:

1. Integration complexity (MVP speed)
- Google `appDataFolder`: API surface แคบกว่า, โฟลเดอร์ private ต่อแอปโดยตรง, path model ตรงไปตรงมา
- OneDrive `approot`: ทำได้ดีแต่ต้องเผื่อความหลากหลายของ tenant/org policy และ Graph edge cases มากกว่า

2. Data safety + connector semantics
- ทั้งสองฝั่งเหมาะกับ app-private storage และรองรับไฟล์ metadata/payload ได้
- ทั้งสองฝั่งยังต้องพึ่ง SoloStack sync core สำหรับ conflict/idempotency/domain merge logic อยู่ดี

3. Ecosystem fit
- Google: เหมาะกับ personal/workspace mix ที่ไม่ต้องเจอ org restriction หนัก
- OneDrive: แข็งแรงมากในองค์กรที่ใช้ Microsoft 365 เป็นหลัก (โอกาสเจอ policy governance สูงกว่า)

4. Operational risk (desktop beta)
- Google-first ช่วยลด unknowns ในรอบ pilot แรก
- OneDrive ควรเป็น wave ถัดไปพร้อม test matrix สำหรับ tenant policy / throttling / token refresh edge cases

### Recommendation (for P3-5 Pilot)

เลือก `Google appDataFolder` เป็น connector ลำดับแรกใน pilot และคง provider-neutral contract เดิม เพื่อให้ต่อ `OneDrive approot` ได้โดยไม่เปลี่ยน sync core.

### Exit Conditions Before Connector Build

- Freeze connector adapter contract (upload/download/list/delete + cursor metadata)
- แยก secret/token storage policy ให้ชัดเจน (desktop secure store)
- เพิ่ม integration fixture สำหรับ provider error mapping (`rate_limit`, `unauthorized`, `unavailable`)
- เพิ่ม observability fields ต่อ connector (`provider`, `latency_ms`, `http_status`, `retry_after_ms`)

## Phase F: P3-6 MCP Server for SoloStack

ช่วงเป้าหมาย: 2026-06-29 ถึง 2026-07-24

### Deliverables
- `mcp-solostack` server (local runtime ก่อน)
- Read-first tools:
  - `get_tasks`
  - `get_projects`
  - `get_weekly_review`
  - `search_tasks`
  - `get_task_changelogs`
- Tool schema + validation contract (request/response)
- Audit log ขั้นต่ำของการเรียก tool
- Integration tests กับ fixture DB จริง

### Exit Criteria
- Agent เรียก weekly summary ได้ภายใน <= 2 วินาทีใน local machine
- ไม่มี direct DB corruption case จาก MCP read path
- Query ที่หนักมี guardrails (limit/timeout/rate-limit) และไม่ทำให้ UI lag

## 5) Workstream Breakdown (P3-1 Priority)

1. Data Layer & Migration
- ออกแบบ migration แบบ backward-compatible
- เพิ่ม preflight backup ก่อนเปิด sync ครั้งแรก

2. Sync Engine
- queue drain + retry/backoff + idempotency
- ป้องกัน sync ซ้อนและ crash-safe recovery

3. API Contract
- freeze schema ของ push/pull/bootstrap + error shape
- รองรับ cursor-based incremental sync

4. UX & Status
- เพิ่ม sync state surfaces ใน Settings และระดับแอป
- ออกแบบข้อความ error/retry ให้เข้าใจง่าย

5. QA & Observability
- unit/integration สำหรับ merge rules, cursor, retry
- Playwright flow สำหรับ status + sync now + retry
- telemetry ขั้นต่ำ: success rate, latency, conflict count

6. Cloud Platform Evaluation
- เปรียบเทียบ AWS managed stack กับทางเลือก non-AWS
- ประเมิน cost/latency/ops complexity ภายใต้ sync polling workload
- นิยาม security baseline (IAM, secret management, logging)

## 5B) Workstream Breakdown (P3-6 Priority)

1. MCP Contract & Tool Design
- กำหนด tool contract ชุดแรก (read-first)
- นิยาม error shape เดียวกันทั้ง server/client agents

2. Data Access Layer
- แยก query adapter จาก app UI logic
- รองรับ filter/search/pagination แบบ bounded

3. Security & Governance
- read-only default
- write tools ต้องผ่าน allowlist + explicit flag
- audit log ต่อ session/tool call

4. Runtime & Integration
- local-only sidecar mode สำหรับ rollout แรก
- สคริปต์รัน MCP server สำหรับ dev/test

5. QA
- integration tests กับ fixture DB
- load test เบื้องต้นสำหรับ query ที่มีโอกาสหนัก

## 5C) Workstream Breakdown (P3-3 Priority)

1. Conflict Schema & Migration
- สร้างตาราง `sync_conflicts` และ `sync_conflict_events`
- ออกแบบ index หลัก (`status`, `entity_type`, `detected_at`)
- migration แบบ backward-compatible + rollback guidance

2. Sync Engine Conflict Envelope
- ให้ `applyPullBatch` คืนค่า conflict envelope แบบ deterministic
- persist conflict records ทุกเคสที่ user ต้อง resolve
- resolution flow ต้องสร้าง idempotency key ก่อน enqueue outbox

3. Conflict Center UX
- เพิ่ม entry point จาก status badge/notification
- หน้า list/detail/resolve actions พร้อม state ชัดเจน
- ทำ manual merge UX สำหรับ notes/text ที่ชนกัน

4. Recovery Tools
- เพิ่ม `Retry last failed sync` ที่ปลอดภัยจากการยิงซ้ำ
- เพิ่ม `Restore from latest backup` พร้อม preflight checks
- เพิ่ม export report สำหรับ support/debug

5. QA & Observability
- unit tests สำหรับ detect/merge rules
- integration tests สำหรับ conflict persistence + resolution replay
- Playwright coverage สำหรับ resolve/retry/restore flows
- telemetry ขั้นต่ำ: conflict opened/resolved rate, median time-to-resolve

## 6) Two-Week Action Plan (Starting 2026-02-17)

## Week 1 (2026-02-17 ถึง 2026-02-21)
- Freeze sync contract (`src/lib/sync-contract.ts`)
- Implement schema + migration ที่จำเป็น
- ปรับ write path ให้ทุก mutation enqueue outbox
- เพิ่ม unit tests สำหรับ outbox/idempotency

## Week 2 (2026-02-24 ถึง 2026-02-28)
- Implement pull/apply flow + cursor advance
- เพิ่ม sync status card ใน Settings + `Sync now`
- เพิ่ม retry/backoff และ error handling พื้นฐาน
- เพิ่ม Playwright scenario สำหรับ sync status/retry

## 6B) Four-Week Action Plan for P3-6 (Starting 2026-06-29)

## Week 1 (2026-06-29 ถึง 2026-07-03)
- Freeze MCP read tool list และ schema draft
- ออกแบบ adapter จาก SQLite -> MCP response model
- ตัดสินใจ runtime mode (local sidecar baseline)

## Week 2 (2026-07-06 ถึง 2026-07-10)
- Implement tools: `get_tasks`, `get_projects`, `search_tasks`
- เพิ่ม query bounds (`limit`, `cursor`, `timeout`)
- เพิ่ม integration tests ชุดแรก

## Week 3 (2026-07-13 ถึง 2026-07-17)
- Implement tools: `get_weekly_review`, `get_task_changelogs`
- เพิ่ม audit logging และ structured errors
- ทดสอบกับ agent workflow จริง (summary/planning prompt)

## Week 4 (2026-07-20 ถึง 2026-07-24)
- Hardening: performance tuning + failure handling
- เขียน usage/setup docs สำหรับ agent runtime
- รัน full quality gates และ prepare internal rollout

## 6C) Three-Week Action Plan for P3-3 (Starting 2026-04-20)

## Week 1 (2026-04-20 ถึง 2026-04-24)
- Freeze schema `sync_conflicts`/`sync_conflict_events` และ envelope contract (done early)
- Implement detect + persist flow ใน incoming apply path (done early)
- เพิ่ม integration tests สำหรับ conflict detect matrix (done: persist field/delete conflicts + replay/retry paths)

## Week 2 (2026-04-27 ถึง 2026-05-01)
- Build `Conflict Center` list + detail + resolve actions (done early in Settings view)
- เพิ่ม deep-link จาก status `Conflict` ไปยัง `Conflict Center` (done)
- เพิ่ม Playwright tests สำหรับ user resolve flow (done: open conflict center -> resolve -> sync success)

## Week 3 (2026-05-04 ถึง 2026-05-08)
- เพิ่ม recovery tools (`retry`, `restore`, `export report`) (done: มี preflight/force + restore latest backup)
- เพิ่ม conflict timeline event log + observability counters (done: event log + aggregate counters + median resolve time)
- hardening + bugfix + ผ่าน quality gates ก่อนประกาศ internal beta

## 6D) P3-3 Implementation Checklist (Dev Team)

## Schema / Migration
- [x] เพิ่มตาราง `sync_conflicts` พร้อมคอลัมน์ payload (`local_payload`, `remote_payload`, `base_payload`)
- [x] เพิ่มตาราง `sync_conflict_events` สำหรับ timeline (`detected`, `resolved`, `retried`, `exported`)
- [x] เพิ่ม index สำหรับ query หน้าจอ (`status`, `detected_at`, `entity_type`, `entity_id`)
- [x] เพิ่ม migration tests สำหรับ create/upgrade path และ backward compatibility
- [x] กำหนด retention policy ของ conflict event logs

## API / Sync Engine
- [x] นิยาม type/model สำหรับ conflict records/events ใน contract กลาง
- [x] ให้ `applyPullBatch` ส่ง conflict envelope กลับแบบ deterministic
- [x] เพิ่ม service methods: `listConflicts`, `getConflictDetail`, `resolveConflict`
- [x] ทุก `resolveConflict` ต้องสร้าง idempotency key และ enqueue outbox change
- [x] เพิ่ม `retryLastFailedSync` แบบกันยิงซ้ำและ safe re-entry
- [x] เพิ่ม `exportConflictReport` เป็น structured JSON
- [x] เพิ่ม `getSyncConflictObservabilityCounters` (total/open/resolved, retried/exported events, median resolve time)

## UI / UX
- [x] เพิ่ม global status entry point เมื่อสถานะเป็น `Conflict`
- [x] สร้างหน้า `Conflict Center` baseline (list + empty state) ใน Settings
- [x] เพิ่ม dedicated `Conflict Center` view + navigation entry
- [x] สร้าง detail panel พร้อม payload compare (`local` vs `remote`)
- [x] เพิ่ม actions: `Keep Local`, `Keep Remote`, `Manual Merge`
- [x] เปลี่ยน `Manual Merge` จาก prompt เป็น diff-based side-by-side editor
- [x] เพิ่ม confirmation UX สำหรับ restore/retry และแสดงผลลัพธ์หลังทำงาน
- [x] เพิ่ม timeline view ระดับ conflict item

## Tests / Quality
- [x] Unit tests: field conflict, notes collision, delete-vs-update
- [x] Integration tests: persist conflicts + resolve replay + idempotent retries
- [x] E2E tests: open conflict center -> resolve -> sync success
- [x] E2E tests: restore flow พร้อม preflight/force guardrails
- [x] E2E tests: conflict retry confirmation และ conflict re-resolve matrix
- [x] E2E tests: retry failed sync (transport/network failure path)
- [x] Non-functional checks: performance ของ list/detail และ large conflict sets
- [x] ผ่าน gate: `npm run test`, `npm run test:e2e`, `npm run build`

## 7) Quality Gates and Release Rules

- ทุก behavior change ต้องมี automated tests
- ถ้ามีหน้าใหม่หรือ flow ใหม่ ต้องมี Playwright coverage
- ลำดับ gate ก่อน build/release:
  1. `npm run test`
  2. `npm run test:e2e`
  3. `npm run build`

## 8) KPI / Success Metrics

- Sync success rate >= 99% (non-network-failure class)
- Median sync latency <= 3s (desktop-to-desktop, normal network)
- Data-loss incidents = 0
- Conflict auto-resolve rate >= 90% ของกรณีทั่วไป

## 9) Risk Register

1. Conflict complexity สูง
- Mitigation: deterministic rules + conflict copy + timeline log

2. Migration เสี่ยงข้อมูลผิดรูป
- Mitigation: preflight validation + backup + rollback guidance

3. API throttling/token issues (provider connectors)
- Mitigation: backoff, refresh strategy, quota-aware batching

4. Cloud cost/ops complexity (AWS or others)
- Mitigation: spike ด้วย realistic traffic model + budget guardrails + phased rollout

## 10) Open Decisions

- เลือก backend stack สำหรับ sync service
- Auth/session model สำหรับ multi-device
- เกณฑ์เลือก provider connector (Google-first vs Microsoft-first)
- ขอบเขต telemetry ขั้นต่ำที่ต้องมีใน desktop beta
- AWS stack decision: Lambda-first หรือ service-first และการเลือก data store หลัก
- MCP deployment mode: local sidecar vs hosted service
- MCP auth model ระหว่าง agent runtime กับ server
- จะเปิด write tools ใน phase ไหน และเงื่อนไขความปลอดภัยขั้นต่ำ

## 11) Immediate Next Actions

1. [done] comparative spike: Google `appDataFolder` vs OneDrive `approot`
2. ทำ connector adapter contract v0.1 ให้รองรับทั้ง Google/OneDrive ด้วย interface เดียว
3. เริ่ม AWS architecture spike พร้อม cost baseline สำหรับ sync + MCP
4. สรุป telemetry baseline ที่ต้องส่งออกนอกแอป (desktop session vs cloud observability)
5. แตกงาน P3-6 อ่านข้อมูลผ่าน MCP tool set ตาม contract v0.1

## 12) Immediate Next Actions (P3-6 Kickoff)

1. สรุป MCP read-tool contract v0.1 ในไฟล์ spec เดียว
2. สร้าง `mcp-solostack` skeleton + health check + config loader
3. ต่อ `get_tasks` และ `get_projects` ให้ใช้งานได้ end-to-end ก่อน
4. เพิ่ม integration tests กับ fixture DB ขนาดเล็กและกลาง
5. เขียน agent usage playbook สำหรับเคส weekly summary รุ่นแรก
6. นิยาม hosted MCP deployment profile บน AWS (ถ้าเลือก cloud mode)
